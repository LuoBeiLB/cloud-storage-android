import { uploadApi } from '@/api'
import { computeSha256 } from '@/utils/sha256'

// 文件上传控制器：分片上传 + 秒传 + 断点续传（对接 B 组文件传输接口）
//
// 调用：uploadFile(file, parentId, onProgress)
//   file      浏览器 File 对象
//   parentId  目标目录 ID，0 表示根目录
//   onProgress  ({ phase: 'hash' | 'upload', percent: 0-100 }) => void
// 返回：{ fileId, instant }，instant=true 表示秒传命中（零字节传输）

export async function uploadFile(file, parentId, onProgress) {
  // 1. 计算文件 SHA-256（B 组内容寻址存储，必填）
  const sha256 = await computeSha256(file, p => onProgress?.({ phase: 'hash', percent: p }))

  // 2. 初始化上传（含秒传分支）
  const init = await uploadApi.init({ name: file.name, size: file.size, parentId, sha256 })
  if (init.status === 'done') {
    return { fileId: init.fileId, instant: true }
  }

  const { sessionId, chunkSize } = init
  const totalParts = Math.ceil(file.size / chunkSize)

  // 3. 断点续传：查询已传分片，只补缺失片
  const session = await uploadApi.getSession(sessionId)
  const uploaded = new Set(session.uploadedParts || [])

  // 4. 逐片上传（串行，稳定优先；序号从 1 开始）
  for (let no = 1; no <= totalParts; no++) {
    if (uploaded.has(no)) continue
    const start = (no - 1) * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    await uploadApi.uploadPart(sessionId, no, file.slice(start, end))
    onProgress?.({ phase: 'upload', percent: Math.round(no / totalParts * 100) })
  }

  // 5. 合并分片、落库
  const done = await uploadApi.complete(sessionId)
  return { fileId: done.fileId, instant: false }
}