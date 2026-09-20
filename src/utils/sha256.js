// 增量 SHA-256（纯 JS 实现，无第三方依赖）
// 用途：浏览器端对超大文件流式计算哈希（分片读 + 增量更新），用于 B 组秒传/内容寻址存储。
// 前端 crypto.subtle.digest 不支持增量，一次性读入会撑爆内存（单文件上限 10GB），故自实现标准 SHA-256。

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
])

function rotr(x, n) {
  return ((x >>> n) | (x << (32 - n))) >>> 0
}

export class Sha256 {
  constructor() {
    this.h = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ])
    this.buf = new Uint8Array(64)
    this.buflen = 0
    this.bytes = 0
  }

  update(data) {
    let off = 0
    const len = data.length
    this.bytes += len
    while (off < len) {
      const n = Math.min(64 - this.buflen, len - off)
      this.buf.set(data.subarray(off, off + n), this.buflen)
      this.buflen += n
      off += n
      if (this.buflen === 64) {
        this._block(this.h, this.buf)
        this.buflen = 0
      }
    }
    return this
  }

  hex() {
    const h = new Uint32Array(this.h)
    const buflen = this.buflen
    const bitLen = this.bytes * 8
    const high = Math.floor(bitLen / 4294967296)
    const low = bitLen >>> 0

    const tail = new Uint8Array(64)
    tail.set(this.buf.subarray(0, buflen), 0)
    tail[buflen] = 0x80
    if (buflen >= 56) {
      this._block(h, tail)
      tail.fill(0)
    }
    // 写入 64-bit 原始消息长度（大端）
    tail[56] = (high >>> 24) & 0xff
    tail[57] = (high >>> 16) & 0xff
    tail[58] = (high >>> 8) & 0xff
    tail[59] = high & 0xff
    tail[60] = (low >>> 24) & 0xff
    tail[61] = (low >>> 16) & 0xff
    tail[62] = (low >>> 8) & 0xff
    tail[63] = low & 0xff
    this._block(h, tail)

    return [...h].map(x => x.toString(16).padStart(8, '0')).join('')
  }

  _block(h, block) {
    const w = new Uint32Array(64)
    for (let i = 0; i < 16; i++) {
      const j = i * 4
      w[i] = (block[j] << 24) | (block[j + 1] << 16) | (block[j + 2] << 8) | block[j + 3]
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7]
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      hh = g; g = f; f = e; e = (d + t1) >>> 0
      d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    h[0] = (h[0] + a) >>> 0
    h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0
    h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0
    h[5] = (h[5] + f) >>> 0
    h[6] = (h[6] + g) >>> 0
    h[7] = (h[7] + hh) >>> 0
  }
}

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
  const CHUNK = 8 * 1024 * 1024 // 8MB 分片读，避免大文件占满内存
  const hash = new Sha256()
  const total = file.size
  let offset = 0
  while (offset < total) {
    const blob = file.slice(offset, Math.min(offset + CHUNK, total))
    const buf = new Uint8Array(await blob.arrayBuffer())
    hash.update(buf)
    offset += CHUNK
    onProgress?.(Math.min(100, Math.round(offset / total * 100)))
  }
  return hash.hex()
}