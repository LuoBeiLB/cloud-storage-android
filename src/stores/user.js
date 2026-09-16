import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authApi } from '@/api'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('cs-token') || '')
  const username = ref(localStorage.getItem('cs-username') || '')
  const role = ref(localStorage.getItem('cs-role') || 'user')
  const userId = ref(localStorage.getItem('cs-user-id') || '')
  const quota = ref({ used: 0, total: 0 })
  // 强制改密标志：后端 mustChangePassword 为 true（新账号初始密码 / 管理员重置密码后）时布局层弹出不可关闭的改密弹框，false 不拦截
  const mustChangePwd = ref(localStorage.getItem('cs-must-change-pwd') === '1')

  function setMustChangeFlag(v) {
    mustChangePwd.value = !!v
    localStorage.setItem('cs-must-change-pwd', v ? '1' : '0')
  }

  // data: { accessToken, refreshToken, user: { id, username, role, quotaBytes, usedBytes, mustChangePassword } }
  function login(data) {
    const u = data.user || {}
    token.value = data.accessToken || ''
    username.value = u.username || ''
    role.value = u.role || 'user'
    userId.value = u.id != null ? String(u.id) : ''
    quota.value = { used: u.usedBytes || 0, total: u.quotaBytes || 0 }
    localStorage.setItem('cs-token', data.accessToken || '')
    localStorage.setItem('cs-refresh-token', data.refreshToken || '')
    localStorage.setItem('cs-username', u.username || '')
    localStorage.setItem('cs-role', u.role || 'user')
    if (u.id != null) localStorage.setItem('cs-user-id', String(u.id))
    setMustChangeFlag(!!u.mustChangePassword)
  }

  // 从 /auth/profile 刷新配额与强制改密标志（后端实测返回 { id, username, role, quotaBytes, usedBytes, mustChangePassword }）
  async function loadProfile() {
    const p = await authApi.profile()
    if (!p) return
    username.value = p.username || username.value
    role.value = p.role || role.value
    userId.value = p.id != null ? String(p.id) : userId.value
    quota.value = { used: p.usedBytes || 0, total: p.quotaBytes || 0 }
    if (p.mustChangePassword != null) setMustChangeFlag(!!p.mustChangePassword)
  }

  function logout() {
    authApi.logout().catch(() => {})
    token.value = ''; username.value = ''; role.value = 'user'; userId.value = ''
    quota.value = { used: 0, total: 0 }
    mustChangePwd.value = false
    ;['cs-token', 'cs-refresh-token', 'cs-user-id', 'cs-username', 'cs-role', 'cs-must-change-pwd'].forEach(k => localStorage.removeItem(k))
  }

  return { token, username, role, userId, quota, mustChangePwd, login, logout, loadProfile, setMustChangeFlag }
})
