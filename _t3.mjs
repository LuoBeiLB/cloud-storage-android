const BASE = 'http://192.168.9.160:3001/api'
async function login() {
  for (const body of [{ username: 'admin', password: 'Admin@123' }, { login: 'admin', password: 'Admin@123' }]) {
    try {
      const r = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      if (j.code === 0 && j.data && (j.data.accessToken || j.data.token)) return j.data.accessToken || j.data.token
    } catch (e) {}
  }
  return null
}
const token = await login()
async function api(method, path, body) {
  const opt = { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } }
  if (body !== undefined) opt.body = JSON.stringify(body)
  const r = await fetch(BASE + path, opt)
  return r.json()
}

const ts = Date.now()
const A = (await api('POST', '/files/mkdir', { parentId: 0, name: '_tA_' + ts })).data.id
const B = (await api('POST', '/files/mkdir', { parentId: A, name: '_tB_' + ts })).data.id
console.log('建嵌套 A=%s B=%s (B是A的子)', A, B)

await api('DELETE', `/files/${A}?force=0`)
console.log('已删除A（连带B进回收站）')

let trash = await api('GET', '/files/trash?page=1&size=100')
const inTrash = id => (trash.data.list || []).some(x => x.id === id)
console.log('删除后：trash含A=%s 含B=%s', inTrash(A), inTrash(B))

const rB1 = await api('POST', `/files/${B}/restore`, {})
console.log('>>> 恢复[子文件夹B] ->', JSON.stringify(rB1))

trash = await api('GET', '/files/trash?page=1&size=100')
console.log('恢复B后：trash含B=%s 含A=%s', inTrash(B), inTrash(A))

const rB2 = await api('POST', `/files/${B}/restore`, {})
console.log('>>> 再次恢复[子文件夹B] ->', JSON.stringify(rB2))

const rA = await api('POST', `/files/${A}/restore`, {})
console.log('>>> 恢复[根文件夹A] ->', JSON.stringify(rA))

console.log('--- 清理测试数据 ---')
console.log('delA force0 ->', JSON.stringify(await api('DELETE', `/files/${A}?force=0`)))
console.log('delA force1 ->', JSON.stringify(await api('DELETE', `/files/${A}?force=1`)))
console.log('delB force1 ->', JSON.stringify(await api('DELETE', `/files/${B}?force=1`)))