const CRE = { 'Content-Type': 'application/json' }
const BASE = 'http://192.168.9.160:3001/api'

async function jfetch(url, opts = {}) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(10000) })
  return r.json()
}

async function login() {
  const j = await jfetch(BASE + '/auth/login', {
    method: 'POST', headers: CRE,
    body: JSON.stringify({ username: 'admin', password: 'Admin@123' })
  })
  if (j.code !== 0) throw new Error('login ' + j.message)
  return j.data.accessToken
}

async function mkdir(t, parentId, name) {
  const j = await jfetch(BASE + '/files/mkdir', {
    method: 'POST', headers: { ...CRE, 'Authorization': 'Bearer ' + t },
    body: JSON.stringify({ parentId, name })
  })
  console.log('mkdir', name, '->', j.code, j.message, 'id=' + (j.data?.id || ''))
  return j.data?.id
}

async function uploadSmall(t, name, content, parentId) {
  const { createHash } = await import('node:crypto')
  const sha = createHash('sha256').update(content).digest('hex')
  const buf = Buffer.from(content)
  const ir = await jfetch(BASE + '/uploads/init', {
    method: 'POST', headers: { ...CRE, 'Authorization': 'Bearer ' + t },
    body: JSON.stringify({ name, size: buf.length, parentId, sha256: sha })
  })
  if (ir.code !== 0) { console.log('init fail', name, ir.message); return }
  if (ir.data.status === 'done') { console.log('upload(秒传)', name); return ir.data.fileId }
  const sid = ir.data.sessionId, cs = ir.data.chunkSize
  const total = Math.ceil(buf.length / cs)
  for (let no = 1; no <= total; no++) {
    const s = (no - 1) * cs, e = Math.min(s + cs, buf.length)
    await fetch(`${BASE}/uploads/${sid}/parts/${no}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'Authorization': 'Bearer ' + t },
      body: buf.subarray(s, e), signal: AbortSignal.timeout(10000)
    })
  }
  const cr = await jfetch(BASE + '/uploads/' + sid + '/complete', { method: 'POST', headers: { 'Authorization': 'Bearer ' + t } })
  console.log('upload', name, '->', cr.code, cr.message)
}

async function listDir(t, parentId) {
  const j = await jfetch(`${BASE}/files?parent=${parentId}&page=1&size=100`, { headers: { 'Authorization': 'Bearer ' + t } })
  if (j.code !== 0) { console.log('list fail', parentId, j.message); return [] }
  return j.data.list || []
}

async function deleteNode(t, id) {
  const j = await jfetch(`${BASE}/files/${id}?force=0`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + t } })
  console.log('delete dir', id, '->', j.code, j.message)
}

async function trash(t) {
  const j = await jfetch(BASE + '/files/trash?page=1&size=500', { headers: { 'Authorization': 'Bearer ' + t } })
  return j.data || {}
}

async function main() {
  const t = await login()
  console.log('== 1. 构建测试：根目录下建目录 d + 子目录 d/sub + 两个文件 ==')
  const d = await mkdir(t, 0, '_tree_test_' + Date.now())
  const sub = await mkdir(t, d, 'sub')
  await uploadSmall(t, 'a.txt', 'hello-a', d)
  await uploadSmall(t, 'b.txt', 'hello-b', sub)

  console.log('\n== 2. 删除前：目录 d 的内容 ==')
  const inside = await listDir(t, d)
  inside.forEach(f => console.log(`  ${f.isDir ? '[dir]' : '[file]'} id=${f.id} parentId=${f.parentId} name=${f.name}`))

  console.log('\n== 3. 软删目录 d ==')
  await deleteNode(t, d)

  console.log('\n== 4. 删除后 trash 完整内容 ==')
  const tr = await trash(t)
  console.log('total =', tr.total)
  ;(tr.list || []).forEach(f => console.log(`  ${f.isDir ? '[dir]' : '[file]'} id=${f.id} parentId=${f.parentId} name=${f.name}`))

  console.log('\n== 5. 结论 ==')
  const names = new Set((tr.list || []).map(f => f.name))
  const hasA = [...names].some(n => n === 'a.txt')
  const hasSub = [...names].some(n => n === 'sub')
  const hasB = [...names].some(n => n === 'b.txt')
  console.log('a.txt 在回收站?', hasA, '| sub 在回收站?', hasSub, '| b.txt 在回收站?', hasB)
}

main().catch(e => console.error('脚本错误', e))