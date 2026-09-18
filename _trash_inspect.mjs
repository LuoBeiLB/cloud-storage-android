const CRE = { 'Content-Type': 'application/json' }
const BASES = [
  'http://192.168.9.118:3001/api',
  'http://192.168.9.160:3001/api',
  'http://192.168.9.113:3001/api'
]

async function jfetch(url, opts = {}) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(6000) })
  return r.json()
}

async function main() {
  let token = null, base = null
  for (const b of BASES) {
    try {
      const j = await jfetch(b + '/auth/login', {
        method: 'POST', headers: CRE,
        body: JSON.stringify({ username: 'admin', password: 'Admin@123' })
      })
      if (j && j.code === 0) { token = j.data.accessToken; base = b; break }
      console.log('[login fail]', b, j?.code, j?.message)
    } catch (e) {
      console.log('[connect fail]', b, String(e.message || e))
    }
  }
  if (!token) { console.log('NO BASE REACHABLE'); return }

  console.log('BASE =', base)
  const tj = await jfetch(base + '/files/trash?page=1&size=500', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  console.log('trash code =', tj.code, 'message =', tj.message)
  const d = tj.data || {}
  const list = d.list || []
  console.log('total =', d.total, 'list length =', list.length)
  for (const f of list) {
    console.log(`  ${f.isDir ? '[dir]' : '[file]'} id=${f.id} parentId=${f.parentId} name=${f.name} deletedAt=${f.deletedAt || '--'} updatedAt=${f.updatedAt || '--'}`)
  }
  console.log('\nRAW (first 3000 chars):\n', JSON.stringify(d, null, 2).slice(0, 3000))
}

main().catch(e => console.error('脚本错误', e))