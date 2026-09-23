import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fileApi } from '@/api'
import { mapFileNode } from '@/utils/file'

export const useFileStore = defineStore('file', () => {
  const files = ref([])
  const breadcrumb = ref([{ id: 0, name: '全部文件' }])
  const currentParentId = ref(0)
  const total = ref(0)
  const page = ref(1)
  const pageSize = 20
  const loading = ref(false)
  const finished = ref(false)

  let loadSeq = 0

  // 进入/刷新目录：重置到第一页（reset=true），或追加下一页
  async function loadDir(parentId, { reset = false, append = false } = {}) {
    if (loading.value) return
    if (reset) {
      parentId = parentId ?? currentParentId.value
      currentParentId.value = parentId
      page.value = 1
      finished.value = false
    }
    const seq = ++loadSeq
    loading.value = true
    try {
      const res = await fileApi.listDir({ parent: currentParentId.value, page: page.value, size: pageSize })
      if (seq !== loadSeq) return
      const rows = (res.list || []).map(f => mapFileNode(f))
      if (append) files.value = files.value.concat(rows)
      else files.value = rows
      total.value = res.total || 0
      breadcrumb.value = [{ id: 0, name: '全部文件' }, ...(res.breadcrumb || [])]
      if (files.value.length >= total.value || rows.length === 0) finished.value = true
    } catch (e) {
      // 拦截器已提示
    } finally {
      if (seq === loadSeq) loading.value = false
    }
  }

  // 下拉刷新
  function refresh() {
    return loadDir(currentParentId.value, { reset: true })
  }

  // 上拉加载更多
  function loadMore() {
    if (finished.value || loading.value) return Promise.resolve()
    page.value += 1
    return loadDir(currentParentId.value, { append: true })
  }

  // 进入子目录
  function enter(parentId) {
    return loadDir(parentId, { reset: true })
  }

  return { files, breadcrumb, currentParentId, total, page, pageSize, loading, finished, loadDir, refresh, loadMore, enter }
})
