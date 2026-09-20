// SHA-256 计算 Worker：纯 JS 哈希在独立线程执行，避免大文件（>1GB）同步计算卡死 UI 主线程。
// 协议（主线程 → Worker）：
//   { type: 'update', buffer: ArrayBuffer, percent: number }  传入一片数据（transfer 零拷贝），算完回 ok
//   { type: 'finalize' }                                      结束并回传最终 hex
// 协议（Worker → 主线程）：
//   { type: 'ok', percent }        一片算完
//   { type: 'done', hex }          全部算完
import { Sha256 } from './sha256-core'

let hash = new Sha256()

self.onmessage = (e) => {
  const { type, buffer, percent } = e.data
  if (type === 'update') {
    hash.update(new Uint8Array(buffer))
    self.postMessage({ type: 'ok', percent })
  } else if (type === 'finalize') {
    const hex = hash.hex()
    hash = new Sha256()
    self.postMessage({ type: 'done', hex })
  }
}