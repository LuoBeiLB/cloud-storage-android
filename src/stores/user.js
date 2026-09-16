import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authApi } from '@/api'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('cs-token') || '')
  const username = ref(localStorage.getItem('cs-username') || '')
  const role = ref(localStorage.getItem('cs-role') || 'user')
  const userId = ref(localStorage.getItem('cs-user-id') || '')
  const quota = ref({ used: 0, total: 0 })

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
  }

  // 从 /auth/profile 刷新配额（后端实测返回 { id, username, role, quotaBytes, usedBytes, mustChangePassword }）
  async function loadProfile() {
    const p = await authApi.profile()
    if (!p) return
    username.value = p.username || username.value
    role.value = p.role || role.value
    userId.value = p.id != null ? String(p.id) : userId.value
    quota.value = { used: p.usedBytes || 0, total: p.quotaBytes || 0 }
  }

  function logout() {
    authApi.logout().catch(() => {})
    token.value = ''; username.value = ''; role.value = 'user'; userId.value = ''
    quota.value = { used: 0, total: 0 }
    ;['cs-token', 'cs-refresh-token', 'cs-user-id', 'cs-username', 'cs-role'].forEach(k => localStorage.removeItem(k))
  }

  return { token, username, role, userId, quota, login, logout, loadProfile }
})
