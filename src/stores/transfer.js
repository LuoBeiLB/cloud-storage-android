import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listUploadTasks, upsertUploadTask, removeUploadTask } from '@/utils/uploadTaskStore'
import { getCachedFile, removeCachedFile } from '@/utils/uploadFileStore'
import { uploadFile } from '@/utils/upload'
import { uploadApi } from '@/api'

// 传输任务运行时状态：跨页面保持续传进行中状态（切换路由不销毁 store，上传继续）
export const useTransferStore = defineStore('transfer', () => {
  const tasks = ref([])
  const resuming = reactive({}) // task.id -> AbortController（表示该任务正在上传/续传中）

  function refresh() {
    tasks.value = listUploadTasks()
  }

  function percent(t) {
    if (!t.totalParts) return 0
    return Math.min(100, Math.round(((t.doneParts || 0) / t.totalParts) * 100))
  }

  // 统一上传入口：首次上传与续传共用。
  // 维护 resuming 状态（可暂停）、实时刷新进度列表；成功后清理任务，暂停/失败保留任务以便续传。
  function upload(file, parentId, handlers = {}) {
    const { onProgress } = handlers
    const controller = new AbortController()
    // 首次上传时 sha256 尚未算出，暂用临时 key 登记；拿到快照 id 后迁移到真实 id
    const tmpKey = 'tmp-' + Date.now().toString(36) + Math.random().toString(36).slice(2)
    resuming[tmpKey] = controller
    let snapId = null

    const clearResume = () => {
      if (resuming[tmpKey] === controller) delete resuming[tmpKey]
      if (snapId && resuming[snapId] === controller) delete resuming[snapId]
    }

    return uploadFile(file, parentId, {
      signal: controller.signal,
      onProgress,
      onSnapshot: snap => {
        snapId = snap.id
        if (resuming[tmpKey] === controller) {
          delete resuming[tmpKey]
          resuming[snapId] = controller
        }
        upsertUploadTask(snap)
        refresh()
      }
    })
      .then(res => {
        clearResume()
        if (snapId) { removeUploadTask(snapId); removeCachedFile(snapId) }
        refresh()
        ElMessage.success(res.instant ? `「${file.name}」秒传成功` : `「${file.name}」上传成功`)
        return res
      })
      .catch(err => {
        clearResume()
        refresh()
        throw err
      })
  }

  // 续传：优先从 IndexedDB 取回缓存文件本体，无需重新选择；缓存缺失时回退到重新选文件
  async function resumeTask(task) {
    const cached = await getCachedFile(task.id)
    if (cached) {
      ElMessage.info(`正在续传「${task.name}」，已传 ${task.doneParts || 0}/${task.totalParts} 片`)
      upload(cached, task.parentId).catch(() => {})
    } else {
      ElMessage.warning(`本地未找到「${task.name}」的缓存，请重新选择同一个文件继续`)
      pickFileForResume(task)
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
        removeCachedFile(task.id)
        refresh()
      })
      .catch(() => {})
  }

  refresh()

  return { tasks, resuming, refresh, percent, resumeTask, upload, pauseTask, discardTask }
})