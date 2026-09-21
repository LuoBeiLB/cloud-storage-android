// SHA-256 计算 Worker：hash-wasm（WASM 硬件级加速，比纯 JS 快 5-10 倍）在独立线程执行，
// 避免大文件（>1GB）同步计算卡死 UI 主线程。hash-wasm 的 wasm 二进制内嵌在 JS 中，Worker 内无需额外网络请求。
// 协议（主线程 → Worker）：
//   { type: 'update', buffer: ArrayBuffer, percent: number }  传入一片数据（transfer 零拷贝），算完回 ok
//   { type: 'finalize' }                                      结束并回传最终 hex
// 协议（Worker → 主线程）：
//   { type: 'ok', percent }        一片算完
//   { type: 'done', hex }          全部算完
import { createSHA256 } from 'hash-wasm'

const hasherReady = createSHA256() // 模块加载即初始化 WASM 实例；update/finalize 时 await 就绪

self.onmessage = async (e) => {
  const { type, buffer, percent } = e.data
  if (type === 'update') {
    const hasher = await hasherReady
    hasher.update(new Uint8Array(buffer))
    self.postMessage({ type: 'ok', percent })
  } else if (type === 'finalize') {
    const hasher = await hasherReady
    const hex = hasher.digest('hex')
    hasher.init() // 重置内部状态，Worker 常驻可复用
    self.postMessage({ type: 'done', hex })
  }
}
