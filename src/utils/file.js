// 文件类型推导：后端 FileNodeVO 无 type 字段，由文件名后缀推导
export function extToType(name) {
  if (!name || !name.includes('.')) return 'text'
  const ext = name.split('.').pop().toLowerCase()
  const map = {
    pdf: 'pdf',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', psd: 'image',
    doc: 'word', docx: 'word',
    xls: 'excel', xlsx: 'excel', csv: 'excel',
    ppt: 'ppt', pptx: 'ppt',
    mp4: 'video', avi: 'video', mov: 'video', mkv: 'video', webm: 'video',
    mp3: 'audio', wav: 'audio', flac: 'audio', ogg: 'audio', m4a: 'audio', aac: 'audio',
    zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
    md: 'text', txt: 'text', log: 'text', json: 'text', xml: 'text'
  }
  return map[ext] || 'text'
}

// FileNodeVO → 前端展示对象（extra 可附加 deletedAt 等字段）
export function mapFileNode(f, extra = {}) {
  return {
    id: f.id,
    parentId: f.parentId,
    name: f.name,
    isDir: !!f.isDir,
    type: f.isDir ? 'folder' : extToType(f.name),
    size: f.size || 0,
    updatedAt: f.updatedAt,
    ...extra
  }
}

export function formatSize(bytes) {
  if (!bytes) return '0 B'
  const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = Math.floor(Math.log(bytes) / Math.log(k))
  i = Math.max(0, Math.min(i, s.length - 1)) // 边界保护，防止单位 undefined
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i]
}

export function formatDate(iso) {
  if (!iso) return '--'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '--'
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
