// 文件本体缓存：用 IndexedDB 保存 File/Blob，刷新后无需重新选文件即可断点续传
// 对比 localStorage：localStorage 只能存字符串（约 5MB），存不了二进制文件；
// IndexedDB 可结构化存储 Blob（二进制按引用传递，不额外拷贝磁盘数据），容量充足。
const DB_NAME = 'cloud-storage-upload'
const STORE = 'files'
let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

// 缓存文件本体（异步 fire-and-forget，失败不影响上传主流程）
export async function cacheFile(id, file) {
  try {
    const db = await openDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ blob: file, name: file.name, size: file.size, type: file.type }, id)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } catch (e) {
    console.warn('[uploadFileStore] cacheFile failed', e)
  }
}

// 取回缓存的文件本体；不存在或失败返回 null
export async function getCachedFile(id) {
  try {
    const db = await openDB()
    const rec = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(id)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    if (!rec || !rec.blob) return null
    return new File([rec.blob], rec.name || '未命名文件', { type: rec.type || '' })
  } catch (e) {
    return null
  }
}

export async function removeCachedFile(id) {
  try {
    const db = await openDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } catch (e) {
    /* ignore */
  }
}
