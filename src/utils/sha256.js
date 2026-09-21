// 增量 SHA-256 入口：
// ≤1GB 用浏览器原生 crypto.subtle（硬件加速，一次性驻留内存可控）；
// >1GB 用 Worker + hash-wasm（WASM 流式计算，比纯 JS 快 5-10 倍）。
// 主线程预读下一片与 Worker 计算当前片重叠（IO/计算/UI 三路并行），进度回调 200ms 节流避免高频渲染拖慢主线程。
import { Sha256 } from './sha256-core'

// 向后兼容导出（历史上 Sha256 从本文件导出）
export { Sha256 } from './sha256-core'

// 对浏览器 File 流式计算 SHA-256，返回 64 位 hex
// onProgress: (percent 0-100) => void
export async function computeSha256(file, onProgress) {
  // ≤1GB 用浏览器原生 SHA-256（硬件加速，比纯 JS 快一个数量级）
  const NATIVE_LIMIT = 1024 * 1024 * 1024 // 1GB
  if (file.size <= NATIVE_LIMIT && typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    onProgress?.(100)
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // 大文件：Worker（WASM 计算）+ 主线程预读流水线 + 进度节流
  const worker = new Worker(new URL('./sha256.worker.js', import.meta.url), { type: 'module' })
  const CHUNK = 8 * 1024 * 1024 // 8MB 分片读
  const total = file.size
  const chunkCount = Math.ceil(total / CHUNK)
  let okCount = 0  // Worker 已算完片数
  let lastEmit = 0 // 进度节流时间戳

  function readChunk(no) { // 读第 no 片（从 1 开始），无更多片返回 null
    if (no > chunkCount) return null
    const start = (no - 1) * CHUNK
    return file.slice(start, Math.min(start + CHUNK, total)).arrayBuffer()
  }

  return new Promise((resolve, reject) => {
    let nextBuf = readChunk(1) // 预读第 1 片
    let nextNo = 1

    async function sendNext() {
      if (!nextBuf) { // 所有片已发完，请求最终结果
        worker.postMessage({ type: 'finalize' })
        return
      }
      const buf = await nextBuf
      const no = nextNo
      nextNo++
      nextBuf = readChunk(nextNo) // 预读下一片：主线程 IO 与 Worker 计算重叠
      worker.postMessage(
        { type: 'update', buffer: buf, percent: Math.min(100, Math.round((no / chunkCount) * 100)) },
        [buf] // transferable 零拷贝
      )
    }

    worker.onmessage = (e) => {
      const { type, percent, hex } = e.data
      if (type === 'ok') {
        okCount++
        const now = Date.now()
        if (now - lastEmit > 200 || okCount >= chunkCount) { // 节流：UI 至多 200ms 更新一次，最后一片强制发
          onProgress?.(percent)
          lastEmit = now
        }
        sendNext()
      } else if (type === 'done') {
        worker.terminate()
        onProgress?.(100)
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
