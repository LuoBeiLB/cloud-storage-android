import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fileApi } from '@/api'
import { mapFileNode } from '@/utils/file'

export const useFileStore = defineStore('file', () => {
  const files = ref([])
  const breadcrumb = ref([{ id: 0, name: '全部文件' }])
  const currentParentId = ref(0)
  const total = ref(0)
  const loading = ref(false)

  // 加载目录：后端返回 { total, list: FileNodeVO[], breadcrumb: [{id, name}] }
  // 请求序列号：快速切换目录/分页时只采纳最新请求的结果，避免旧请求晚返回覆盖新数据
  let loadSeq = 0
  async function loadDir(parentId = currentParentId.value, page = 1, size = 20, sort = null) {
    const seq = ++loadSeq
    loading.value = true
    currentParentId.value = parentId
    try {
      const res = await fileApi.listDir({ parent: parentId, page, size, ...(sort ? { sort } : {}) })
      if (seq !== loadSeq) return
      files.value = (res.list || []).map(f => mapFileNode(f))
      total.value = res.total || 0
      breadcrumb.value = [{ id: 0, name: '全部文件' }, ...(res.breadcrumb || [])]
    } catch (e) {
      // 拦截器已提示错误，保留旧数据
    } finally {
      if (seq === loadSeq) loading.value = false
    }
  }

  // 新建文件夹（同级重名由后端自动改名）
  function createFolder(name) {
    return fileApi.mkdir({ parentId: currentParentId.value, name })
  }

  // 重命名
  function rename(id, name) {
    return fileApi.update(id, { name })
  }

  // 删除（默认进回收站）
  function remove(id, force = 0) {
    return fileApi.remove(id, force)
  }

  // 进入目录（面包屑跳转也走这里）
  function navigateTo(parentId) {
    return loadDir(parentId, 1)
  }

  return { files, breadcrumb, currentParentId, total, loading, loadDir, createFolder, rename, remove, navigateTo }
})
