import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listUploadTasks, upsertUploadTask, removeUploadTask } from '@/utils/uploadTaskStore'
import { getCachedFile, removeCachedFile, cacheFile } from '@/utils/uploadFileStore'
import { uploadFile } from '@/utils/upload'
import { uploadApi } from '@/api'

// 传输任务运行时状态：跨页面保持续传进行中状态（切换路由不销毁 store，上传继续）
// 任务生命周期：waiting（等待上传：哈希/初始化中）→ uploading（分片传输中）→ done（已完成，记录保留）
export const useTransferStore = defineStore('transfer', () => {
  const tasks = ref([])
  const resuming = reactive({}) // task.id -> AbortController（表示该任务正在上传/续传中）
  const resumeLocks = new Set() // 续传启动锁：await 取缓存窗口内连点「继续」会开出多路并发续传
  const hashing = reactive({}) // tmpKey -> 哈希百分比（等待上传阶段的指纹计算进度，供传输页展示）

  function refresh() {
    tasks.value = listUploadTasks()
  }

  function percent(t) {
    if (t.status === 'done') return 100
    if (!t.totalParts) return 0
    return Math.min(100, Math.round(((t.doneParts || 0) / t.totalParts) * 100))
  }

  // 任务展示状态：done=已完成；resuming 中且无分片=等待上传；resuming 中=传输中；其余=已暂停（可续传）
  function stateOf(t) {
    if (t.status === 'done') return 'done'
    if (resuming[t.id]) return t.totalParts ? 'uploading' : 'waiting'
    return t.totalParts ? 'paused' : 'waiting' // 刷新后无运行态：有进度视为暂停待续传，无进度视为等待
  }

  // 统一上传入口：首次上传与续传共用。
  // 维护 resuming 状态（可暂停）、实时刷新进度列表；完成后任务标记 done 保留记录，暂停/失败保留任务以便续传。
  function upload(file, parentId, handlers = {}) {
    const { onProgress } = handlers
    const controller = new AbortController()
    // 首次上传时 sha256 尚未算出，暂用临时 key 登记；拿到快照 id 后迁移到真实 id
    const tmpKey = 'tmp-' + Date.now().toString(36) + Math.random().toString(36).slice(2)
    resuming[tmpKey] = controller
    let snapId = null
    let lastSnap = null
    // 立即登记一条「等待上传」记录（哈希计算/初始化阶段）
    upsertUploadTask({ id: tmpKey, name: file.name, size: file.size, parentId, status: 'waiting', totalParts: 0, doneParts: 0 })
    cacheFile(tmpKey, file) // 选定文件即缓存本体：大文件哈希耗时数分钟，期间暂停后继续也能命中缓存
    refresh()

    const clearResume = () => {
      if (resuming[tmpKey] === controller) delete resuming[tmpKey]
      delete hashing[tmpKey] // 哈希进度随运行态清理
      if (snapId && resuming[snapId] === controller) delete resuming[snapId]
    }

    return uploadFile(file, parentId, {
      signal: controller.signal,
      onProgress: p => {
        if (p.phase === 'hash') hashing[tmpKey] = p.percent // 等待阶段展示「正在校验指纹」进度
        onProgress && onProgress(p)
      },
      onSnapshot: snap => {
        if (controller.signal.aborted) return // 已暂停/放弃：丢弃迟到快照，防止已清理的任务复活
        if (snapId !== snap.id) { removeUploadTask(tmpKey); removeCachedFile(tmpKey); delete hashing[tmpKey] } // 临时记录与缓存被正式快照替换（正式缓存由 upload.js 写入）
        snapId = snap.id
        lastSnap = snap
        if (resuming[tmpKey] === controller) {
          delete resuming[tmpKey]
          resuming[snapId] = controller
        }
        upsertUploadTask({ ...snap, status: snap.status || 'uploading' })
        refresh()
      }
    })
      .then(res => {
        clearResume()
        if (controller.signal.aborted) { // 已放弃（如哈希阶段放弃后秒传返回）：不落完成记录，避免任务复活
          removeUploadTask(snapId || tmpKey)
          refresh()
          return res
        }
        // 完成后保留记录：显式写入 done（秒传时 lastSnap 可能为 null，直接构造）
        const doneId = snapId || tmpKey
        upsertUploadTask({
          id: doneId,
          name: file.name,
          size: file.size,
          parentId,
          sha256: lastSnap?.sha256,
          status: 'done',
          totalParts: lastSnap?.totalParts || 0,
          doneParts: lastSnap?.totalParts || 0
        })
        refresh()
        ElMessage.success(res.instant ? `「${file.name}」秒传成功` : `「${file.name}」上传成功`)
        return res
      })
      .catch(err => {
        clearResume()
        removeUploadTask(tmpKey) // 清理临时等待记录（已有快照时早已被替换，重复删除无害）
        removeCachedFile(tmpKey) // 同步清理临时缓存（重复删除无害）
        refresh()
        throw err
      })
  }

  // 续传：优先从 IndexedDB 取回缓存文件本体，无需重新选择；缓存缺失时回退到重新选文件
  async function resumeTask(task) {
    if (resumeLocks.has(task.id)) return // 节流：同一任务续传启动中，重复点击直接忽略
    resumeLocks.add(task.id)
    const cacheKey = task.sha256 || task.id // 正式记录按内容哈希取缓存；指纹阶段 tmpKey 记录无 sha256，按 tmpKey 取（cacheFile(tmpKey, file) 写入）
    const cached = await getCachedFile(cacheKey)
    if (cached) {
      ElMessage.info(`正在续传「${task.name}」，已传 ${task.doneParts || 0}/${task.totalParts} 片`)
      removeUploadTask(task.id) // 旧记录先移除，由新上传的快照重建，避免列表双条目
      removeCachedFile(cacheKey) // 旧缓存一并清理：文件本体已在内存，新上传链路会重建缓存
      refresh()
      upload(cached, task.parentId).catch(() => {})
      resumeLocks.delete(task.id) // 新任务已同步接管（waiting 态），释放锁
    } else {
      ElMessage.warning(`本地未找到「${task.name}」的缓存，请重新选择同一个文件继续`)
      pickFileForResume(task)
      resumeLocks.delete(task.id) // 缓存缺失走重选文件，释放锁
    }
  }

  function pickFileForResume(task) {
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = () => {
      const f = input.files && input.files[0]
      if (!f) return
      removeUploadTask(task.id)
      refresh()
      upload(f, task.parentId).catch(() => {})
    }
    input.click()
  }

  function pauseTask(task) {
    const c = resuming[task.id]
    if (c) {
      c.abort()
      delete resuming[task.id]
      ElMessage.info(`已暂停「${task.name}」，可随时继续`)
    }
  }

  // 放弃未完成上传：中止后端 session 并清除本地记录与文件缓存
  function discardTask(task) {
    ElMessageBox.confirm(`放弃「${task.name}」的未完成上传？`, '提示', { type: 'warning', confirmButtonText: '放弃', cancelButtonText: '取消' })
      .then(() => {
        if (task.sessionId) uploadApi.abort(task.sessionId).catch(() => {})
        const c = resuming[task.id]
        if (c) c.abort()
        delete resuming[task.id]
        removeUploadTask(task.id)
        removeCachedFile(task.sha256 || task.id) // tmpKey 记录的缓存挂在 tmpKey 上
        refresh()
      })
      .catch(() => {})
  }

  // 移除已完成任务的展示记录（仅清记录，无确认弹窗）
  function removeRecord(task) {
    removeUploadTask(task.id)
    refresh()
  }

  // 清空全部已完成记录
  function clearDone() {
    listUploadTasks().forEach(t => { if (t.status === 'done') removeUploadTask(t.id) })
    refresh()
  }

  refresh()

  return { tasks, resuming, hashing, refresh, percent, stateOf, upload, resumeTask, pauseTask, discardTask, removeRecord, clearDone }
})
