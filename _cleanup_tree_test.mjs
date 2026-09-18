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
async function listDir(t, parentId) {
  const j = await jfetch(`${BASE}/files?parent=${parentId}&page=1&size=100`, { headers: { 'Authorization': 'Bearer ' + t } })
  return (j.data?.list || [])
}
async function trash(t) {
  const j = await jfetch(BASE + '/files/trash?page=1&size=500', { headers: { 'Authorization': 'Bearer ' + t } })
  return j.data || {}
}

async function main() {
  const t = await login()
  const DIR = 119

  console.log('== 1. restore 目录 119（空 body，看子孙是否随根回来）==')
  const rr = await jfetch(BASE + '/files/' + DIR + '/restore', { method: 'POST', headers: { 'Authorization': 'Bearer ' + t } })
  console.log('restore ->', rr.code, rr.message, JSON.stringify(rr.data || {}))

  console.log('\n== 2. 恢复后 list 根目录 ==')
  ;(await listDir(t, 0)).forEach(f => console.log(`  ${f.isDir ? '[dir]' : '[file]'} id=${f.id} name=${f.name}`))

  console.log('\n== 3. 恢复后 list 目录 119 ==')
  ;(await listDir(t, 119)).forEach(f => console.log(`  ${f.isDir ? '[dir]' : '[file]'} id=${f.id} parentId=${f.parentId} name=${f.name}`))

  console.log('\n== 4. force=1 彻底删 119 ==')
  const dr = await jfetch(`${BASE}/files/${DIR}?force=1`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + t } })
  console.log('force=1 ->', dr.code, dr.message)

  console.log('\n== 5. 清理后 list 根目录 ==')
  ;(await listDir(t, 0)).forEach(f => console.log(`  ${f.isDir ? '[dir]' : '[file]'} id=${f.id} name=${f.name}`))

  console.log('\n== 6. 清理后 trash ==')
  const tr = await trash(t)
  console.log('trash total =', tr.total)
  ;(tr.list || []).forEach(f => console.log(`  ${f.isDir ? '[dir]' : '[file]'} id=${f.id} name=${f.name}`))
}

main().catch(e => console.error('脚本错误', e))