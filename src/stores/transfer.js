import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import { listUploadTasks, upsertUploadTask, removeUploadTask } from '@/utils/uploadTaskStore'
import { getCachedFile, removeCachedFile, cacheFile } from '@/utils/uploadFileStore'
import { uploadFile } from '@/utils/upload'
import { uploadApi } from '@/api'

// 上传任务运行时：waiting → uploading → done
export const useTransferStore = defineStore('transfer', () => {
  const tasks = ref([])
  const resuming = reactive({})
  const resumeLocks = new Set()
  const uploadingSha = new Set()
  const hashing = reactive({})

  function refresh() {
    tasks.value = listUploadTasks()
  }

  function percent(t) {
    if (t.status === 'done') return 100
    if (!t.totalParts) return 0
    return Math.min(100, Math.round(((t.doneParts || 0) / t.totalParts) * 100))
  }

  function stateOf(t) {
    if (t.status === 'done') return 'done'
    if (resuming[t.id]) return t.totalParts ? 'uploading' : 'waiting'
    return t.totalParts ? 'paused' : 'waiting'
  }

  function upload(file, parentId) {
    const controller = new AbortController()
    const tmpKey = 'tmp-' + Date.now().toString(36) + Math.random().toString(36).slice(2)
    resuming[tmpKey] = controller
    let snapId = null
    let lastSnap = null
    let lastSha = null

    upsertUploadTask({ id: tmpKey, name: file.name, size: file.size, parentId, status: 'waiting', totalParts: 0, doneParts: 0 })
    cacheFile(tmpKey, file)
    refresh()

    const clearResume = () => {
      if (resuming[tmpKey] === controller) delete resuming[tmpKey]
      delete hashing[tmpKey]
      if (snapId && resuming[snapId] === controller) delete resuming[snapId]
      if (lastSha) uploadingSha.delete(lastSha)
    }

    return uploadFile(file, parentId, {
      signal: controller.signal,
      onBeforeInit: sha => {
        if (uploadingSha.has(sha)) {
          showToast('「' + file.name + '」已在传输中')
          return false
        }
        uploadingSha.add(sha)
        lastSha = sha
        return true
      },
      onProgress: p => {
        if (p.phase === 'hash') hashing[tmpKey] = p.percent
      },
      onSnapshot: snap => {
        if (controller.signal.aborted) return
        if (snapId !== snap.id) {
          removeUploadTask(tmpKey)
          removeCachedFile(tmpKey)
          delete hashing[tmpKey]
        }
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
        if (res.skipped) {
          removeUploadTask(tmpKey)
          removeCachedFile(tmpKey)
          refresh()
          return res
        }
        if (controller.signal.aborted) {
          removeUploadTask(snapId || tmpKey)
          refresh()
          return res
        }
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
        showSuccessToast(res.instant ? '「' + file.name + '」秒传成功' : '「' + file.name + '」上传成功')
        return res
      })
      .catch(err => {
        clearResume()
        // 非主动取消：保留已有快照记录并标记暂停（进度不丢，可续传）
        if (err.name !== 'AbortError') {
          if (snapId && lastSnap) {
            upsertUploadTask({ ...lastSnap, status: 'paused' })
          } else {
            upsertUploadTask({ id: tmpKey, name: file.name, size: file.size, parentId, status: 'waiting', totalParts: 0, doneParts: 0 })
          }
          refresh()
          showToast('「' + file.name + '」已暂停，可继续')
        } else {
          removeUploadTask(tmpKey)
          removeCachedFile(tmpKey)
          refresh()
        }
        throw err
      })
  }

  async function resumeTask(task) {
    if (resuming[task.id] || (task.sha256 && uploadingSha.has(task.sha256)) || resumeLocks.has(task.id)) return
    resumeLocks.add(task.id)
    const cacheKey = task.sha256 || task.id
    const cached = await getCachedFile(cacheKey)
    if (cached) {
      removeUploadTask(task.id)
      removeCachedFile(cacheKey)
      refresh()
      upload(cached, task.parentId).catch(() => {})
      resumeLocks.delete(task.id)
    } else {
      showToast('本地缓存已失效，请重新选择该文件')
      resumeLocks.delete(task.id)
    }
  }

  function pauseTask(task) {
    const c = resuming[task.id]
    if (c) {
      c.abort()
      delete resuming[task.id]
      showToast('已暂停「' + task.name + '」')
    }
  }

  function discardTask(task) {
    showConfirmDialog({ title: '放弃上传？', message: '将取消「' + task.name + '」的未完成上传并删除记录。' })
      .then(() => {
        if (task.sessionId) uploadApi.abort(task.sessionId).catch(() => {})
        const c = resuming[task.id]
        if (c) c.abort()
        delete resuming[task.id]
        removeUploadTask(task.id)
        removeCachedFile(task.sha256 || task.id)
        refresh()
      })
      .catch(() => {})
  }

  function removeRecord(task) {
    removeUploadTask(task.id)
    refresh()
  }

  function clearDone() {
    listUploadTasks().forEach(t => { if (t.status === 'done') removeUploadTask(t.id) })
    refresh()
  }

  refresh()

  return { tasks, resuming, hashing, refresh, percent, stateOf, upload, resumeTask, pauseTask, discardTask, removeRecord, clearDone }
})
