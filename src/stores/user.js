import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authApi } from '@/api'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('cs-token') || '')
  const username = ref(localStorage.getItem('cs-username') || '')
  const role = ref(localStorage.getItem('cs-role') || 'user')
  const userId = ref(localStorage.getItem('cs-user-id') || '')
  const savedQuota = localStorage.getItem('cs-quota')
  const quota = ref(savedQuota ? JSON.parse(savedQuota) : { used: 0, total: 0 })

  // data: { accessToken, refreshToken, user: { id, username, role, quotaBytes, usedBytes, mustChangePassword } }
  function login(data) {
    const u = data.user || {}
    token.value = data.accessToken || ''
    username.value = u.username || ''
    role.value = u.role || 'user'
    userId.value = u.id != null ? String(u.id) : ''
    quota.value = { used: u.usedBytes || 0, total: u.quotaBytes || 0 }
    localStorage.setItem('cs-quota', JSON.stringify(quota.value))
    localStorage.setItem('cs-token', data.accessToken || '')
    localStorage.setItem('cs-refresh-token', data.refreshToken || '')
    localStorage.setItem('cs-username', u.username || '')
    localStorage.setItem('cs-role', u.role || 'user')
    if (u.id != null) localStorage.setItem('cs-user-id', String(u.id))
  }

  async function loadProfile() {
    const p = await authApi.profile()
    if (!p) return
    username.value = p.username || username.value
    role.value = p.role || role.value
    userId.value = p.id != null ? String(p.id) : userId.value
    quota.value = { used: p.usedBytes || 0, total: p.quotaBytes || 0 }
    localStorage.setItem('cs-quota', JSON.stringify(quota.value))
  }

  async function changePassword(payload) {
    return authApi.changePassword(payload)
  }

  function logout() {
    authApi.logout().catch(() => {})
    token.value = ''; username.value = ''; role.value = 'user'; userId.value = ''
    quota.value = { used: 0, total: 0 }
    ;['cs-token', 'cs-refresh-token', 'cs-user-id', 'cs-username', 'cs-role', 'cs-quota'].forEach(k => localStorage.removeItem(k))
  }

  return { token, username, role, userId, quota, login, loadProfile, changePassword, logout }
})
