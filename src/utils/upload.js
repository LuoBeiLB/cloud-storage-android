import { uploadApi } from '@/api'
import { computeSha256 } from '@/utils/sha256'
import { cacheFile, removeCachedFile } from '@/utils/uploadFileStore'

// 文件上传控制器：分片上传 + 秒传 + 断点续传（对接 B 组文件传输接口）
//
// 调用：uploadFile(file, parentId, options)
//   file      浏览器 File 对象
//   parentId  目标目录 ID，0 表示根目录
//   options:
//     onProgress  ({ phase: 'hash' | 'upload', percent: 0-100 }) => void
//     onSnapshot  (snapshot) => void —— 每次可持久化状态变化时回调，供外部写 localStorage
//   snapshot: { id, name, size, parentId, sha256, sessionId, totalParts, doneParts }
// 返回：{ fileId, instant }，instant=true 表示秒传命中（零字节传输）

const PART_RETRY = 2

export async function uploadFile(file, parentId, options = {}) {
  const { onProgress = () => {}, onSnapshot = () => {}, signal } = options

  // 1. 计算文件 SHA-256（B 组内容寻址，必填）
  const sha256 = await computeSha256(file, p => onProgress({ phase: 'hash', percent: p }))

  // 2. 初始化上传（含秒传分支；后端对相同 sha256 幂等复用未完成 session，支持断点续传）
  const init = await uploadApi.init({ name: file.name, size: file.size, parentId, sha256 })
  if (init.status === 'done') {
    return { fileId: init.fileId, instant: true }
  }

  const { sessionId, chunkSize } = init
  // 本地缓存文件本体（IndexedDB），刷新后无需重新选择文件即可续传
  cacheFile(sha256, file)
  const totalParts = Math.ceil(file.size / chunkSize)
  const emit = doneParts => onSnapshot({
    id: sha256,
    name: file.name,
    size: file.size,
    parentId,
    sha256,
    sessionId,
    totalParts,
    doneParts
  })

  // 3. 断点续传：查询已传分片（MinIO 实时权威），只补缺失片
  const session = await uploadApi.getSession(sessionId)
  const uploaded = new Set(session.uploadedParts || [])
  emit(uploaded.size)

  // 4. 分片上传（并发 + 信号量控流；序号从 1 开始，跳过已传；单片失败重试）
  const CONCURRENCY = 4
  const pending = []
  for (let no = 1; no <= totalParts; no++) {
    if (!uploaded.has(no)) pending.push(no)
  }
  const baseCount = uploaded.size
  let doneCount = 0

  const isAbort = () => !!(signal && signal.aborted)
  const abortErr = () => {
    const e = new Error('上传已暂停')
    e.name = 'AbortError'
    return e
  }

  async function uploadOne(no) {
    if (isAbort()) throw abortErr()
    const start = (no - 1) * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    let lastErr
    for (let attempt = 0; attempt <= PART_RETRY; attempt++) {
      if (isAbort()) throw abortErr()
      try {
        await uploadApi.uploadPart(sessionId, no, file.slice(start, end), signal)
        return
      } catch (e) {
        if (isAbort()) throw abortErr()
        lastErr = e
        if (attempt < PART_RETRY) continue
        throw lastErr
      }
    }
  }

  async function worker() {
    while (pending.length > 0) {
      const no = pending.shift()
      await uploadOne(no)
      doneCount++
      emit(baseCount + doneCount)
      onProgress({ phase: 'upload', percent: Math.round((baseCount + doneCount) / totalParts * 100) })
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, () => worker()))

  // 5. 合并分片、落库
  const done = await uploadApi.complete(sessionId)
  removeCachedFile(sha256)
  return { fileId: done.fileId, instant: false }
}
