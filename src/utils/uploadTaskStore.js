// 上传任务本地持久化：刷新 / 断网后可从 localStorage 恢复未完成的上传
const KEY = 'cs-upload-tasks'

export function listUploadTasks() {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function upsertUploadTask(task) {
  const arr = listUploadTasks()
  const idx = arr.findIndex(t => t.id === task.id)
  const next = { ...task, updatedAt: Date.now() }
  if (idx >= 0) arr[idx] = next
  else arr.push(next)
  localStorage.setItem(KEY, JSON.stringify(arr))
}

export function removeUploadTask(id) {
  localStorage.setItem(KEY, JSON.stringify(listUploadTasks().filter(t => t.id !== id)))
}

export function clearUploadTasks() {
  localStorage.removeItem(KEY)
}
