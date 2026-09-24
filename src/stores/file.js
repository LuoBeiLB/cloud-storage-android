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
  const loading = ref(false)   // 唯一的加载状态，页面 van-list 直接绑它
  const finished = ref(false)

  let loadSeq = 0

  // 拉取当前 page。reset=true 表示重置到第一页；否则追加下一页。
  async function loadDir(parentId, { reset = false, append = false } = {}) {
    if (reset) {
      loadSeq++ // 使所有进行中的旧请求作废，避免响应串台/重复追加
      parentId = parentId ?? currentParentId.value
      currentParentId.value = parentId
      page.value = 1
      finished.value = false
      // 注意：不在此处清空 files，等数据返回后整体替换——避免刷新瞬间列表闪白
    }
    const seq = loadSeq
    loading.value = true
    try {
      const res = await fileApi.listDir({ parent: currentParentId.value, page: page.value, size: pageSize })
      if (seq !== loadSeq) return // 已被更新的加载取代
      const rows = (res.list || []).map(f => mapFileNode(f))
      files.value = append ? files.value.concat(rows) : rows
      total.value = res.total || 0
      breadcrumb.value = [{ id: 0, name: '全部文件' }, ...(res.breadcrumb || [])]
      if (files.value.length >= total.value || rows.length === 0) {
        finished.value = true
      } else {
        page.value += 1 // 预取下一页页码，供 van-list 下次触发
      }
    } catch (e) {
      if (seq === loadSeq) finished.value = true
      // 拦截器已提示
    } finally {
      if (seq === loadSeq) loading.value = false
    }
  }

  // 下拉刷新 / 操作后刷新
  function refresh() {
    return loadDir(currentParentId.value, { reset: true })
  }

  // 上拉加载更多
  function loadMore() {
    if (finished.value || loading.value) return Promise.resolve()
    return loadDir(currentParentId.value, { append: true })
  }

  // 进入子目录
  function enter(parentId) {
    return loadDir(parentId, { reset: true })
  }

  return { files, breadcrumb, currentParentId, total, page, pageSize, loading, finished, loadDir, refresh, loadMore, enter }
})
