import { defineStore } from 'pinia'
import { ref } from 'vue'
import { mockFiles } from '@/mock/files'

export const useFileStore = defineStore('file', () => {
  const files = ref([...mockFiles])
  const currentPath = ref('/')
  const loading = ref(false)

  function navigateTo(path) { currentPath.value = path }
  function refreshFiles() { loading.value = true; setTimeout(() => { loading.value = false }, 300) }
  function createFolder(name) {
    files.value.unshift({ id: Date.now(), name, type: 'folder', size: 0, updatedAt: new Date().toISOString(), path: currentPath.value + name + '/' })
  }
  function deleteFile(id) {
    const idx = files.value.findIndex(f => f.id === id)
    if (idx > -1) files.value.splice(idx, 1)
  }

  return { files, currentPath, loading, navigateTo, refreshFiles, createFolder, deleteFile }
})