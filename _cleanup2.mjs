const CRE = { 'Content-Type': 'application/json' }
const BASE = 'http://192.168.9.160:3001/api'

async function jfetch(url, opts = {}) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(10000) })
  return r.json()
}
async function login() {
  const j = await jfetch(BASE + '/auth/login', { method: 'POST', headers: CRE, body: JSON.stringify({ username: 'admin', password: 'Admin@123' }) })
  return j.data.accessToken
}
async function del(t, id, force) {
  const j = await jfetch(`${BASE}/files/${id}?force=${force}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + t } })
  console.log(`delete id=${id} force=${force} ->`, j.code, j.message)
}
async function listDir(t, parentId) {
  const j = await jfetch(`${BASE}/files?parent=${parentId}&page=1&size=100`, { headers: { 'Authorization': 'Bearer ' + t } })
  if (j.code !== 0) return { code: j.code, message: j.message, list: [] }
  return { code: 0, list: j.data.list || [] }
}
async function trash(t) {
  const j = await jfetch(BASE + '/files/trash?page=1&size=500', { headers: { 'Authorization': 'Bearer ' + t } })
  return j.data || {}
}

async function main() {
  const t = await login()
  const DIR = 119
  console.log('== 软删 119 ==')
  await del(t, DIR, 0)
  console.log('== 彻底删 119 ==')
  await del(t, DIR, 1)

  console.log('\n== 删后 trash ==')
  const tr = await trash(t)
  console.log('trash total =', tr.total)
  ;(tr.list || []).forEach(f => console.log(`  ${f.isDir ? '[dir]' : '[file]'} id=${f.id} name=${f.name}`))

  console.log('\n== 删后 list 119（看子孙 120/121 是否残留）==')
  const r = await listDir(t, 119)
  console.log('list 119 -> code=' + r.code, r.message || '', 'list.length=' + r.list.length)
  r.list.forEach(f => console.log(`  ${f.isDir ? '[dir]' : '[file]'} id=${f.id} name=${f.name}`))

  console.log('\n== 删后 list 120（看 b.txt 是否残留）==')
  const r2 = await listDir(t, 120)
  console.log('list 120 -> code=' + r2.code, r2.message || '', 'list.length=' + r2.list.length)
  r2.list.forEach(f => console.log(`  ${f.isDir ? '[dir]' : '[file]'} id=${f.id} name=${f.name}`))
}

main().catch(e => console.error('脚本错误', e))