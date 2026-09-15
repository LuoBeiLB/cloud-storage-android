import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('cs-token') || '')
  const username = ref(localStorage.getItem('cs-username') || '')
  const role = ref(localStorage.getItem('cs-role') || 'user')
  const quota = ref({ used: 8589934592, total: 21474836480 })

  function login(data) {
    token.value = data.token; username.value = data.username; role.value = data.role
    localStorage.setItem('cs-token', data.token)
    localStorage.setItem('cs-username', data.username)
    localStorage.setItem('cs-role', data.role)
  }

  function logout() {
    token.value = ''; username.value = ''; role.value = 'user'
    localStorage.removeItem('cs-token')
    localStorage.removeItem('cs-username')
    localStorage.removeItem('cs-role')
  }

  return { token, username, role, quota, login, logout }
})