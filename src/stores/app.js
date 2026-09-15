import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const theme = ref(localStorage.getItem('cs-theme') || 'light')
  const sidebarCollapsed = ref(false)

  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme.value)
    document.documentElement.classList.toggle('dark', theme.value === 'dark')
    localStorage.setItem('cs-theme', theme.value)
  }

  function toggleSidebar() { sidebarCollapsed.value = !sidebarCollapsed.value }

  return { theme, sidebarCollapsed, toggleTheme, toggleSidebar }
})