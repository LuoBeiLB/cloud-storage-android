// 增量 SHA-256 入口：主线程计算文件 SHA-256，分片读 + 增量更新。
// 关键设计：≤1GB 用浏览器原生 crypto.subtle（硬件加速）；>1GB 用 Worker 线程算纯 JS SHA-256，
// 主线程只做分片读取与零拷贝传递，避免大文件在主线程同步计算时阻塞 UI。
import { Sha256 } from './sha256-core'

// 向后兼容导出（历史上 Sha256 从本文件导出）
export { Sha256 } from './sha256-core'

// 对浏览器 File 流式计算 SHA-256，返回 64 位 hex
// onProgress: (percent 0-100) => void
export async function computeSha256(file, onProgress) {
  // ≤1GB 用浏览器原生 SHA-256（硬件加速，比纯 JS 快一个数量级，且不占主线程）
  const NATIVE_LIMIT = 1024 * 1024 * 1024 // 1GB
  if (file.size <= NATIVE_LIMIT && typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    onProgress?.(100)
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // 大文件：Worker 线程算哈希，主线程只做分片读取 + transfer 传递，不阻塞 UI
  const worker = new Worker(new URL('./sha256.worker.js', import.meta.url), { type: 'module' })
  const CHUNK = 8 * 1024 * 1024 // 8MB 分片读
  const total = file.size
  let offset = 0

  return new Promise((resolve, reject) => {
    const sendNext = () => {
      if (offset >= total) {
        worker.postMessage({ type: 'finalize' })
        return
      }
      const start = offset
      const end = Math.min(start + CHUNK, total)
      const percent = Math.min(100, Math.round((end / total) * 100))
      offset = end
      file.slice(start, end).arrayBuffer()
        .then(buf => worker.postMessage({ type: 'update', buffer: buf, percent }, [buf]))
        .catch(err => { worker.terminate(); reject(err) })
    }
    worker.onmessage = (e) => {
      const { type, percent, hex } = e.data
      if (type === 'ok') {
        onProgress?.(percent)
        sendNext()
      } else if (type === 'done') {
        worker.terminate()
        resolve(hex)
      }
    }
    worker.onerror = (err) => {
      worker.terminate()
      reject(err)
    }
    sendNext()
  })
}