<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <div class="breadcrumb-left">
        <span class="page-title">回收站</span>
      </div>
      <div class="breadcrumb-actions">
        <el-button v-if="selectedRows.length > 0" type="primary" @click="openRestoreDialog(null)">
          <el-icon><RefreshRight /></el-icon><span>批量恢复（{{ selectedRows.length }}）</span>
        </el-button>
        <el-button v-if="selectedRows.length > 0" type="danger" plain :loading="deleting" @click="handleBatchDelete">
          <el-icon><Delete /></el-icon><span>彻底删除（{{ selectedRows.length }}）</span>
        </el-button>
        <el-button v-if="recycleTotal > 0" type="danger" plain :loading="deleting" @click="handleDeleteAll">
          <el-icon><Delete /></el-icon><span>删除全部文件</span>
        </el-button>
      </div>
    </div>

    <div class="toolbar">
      <div class="toolbar-left">
        <el-input v-model="searchText" placeholder="搜索回收站..." :prefix-icon="Search" clearable class="search-input" />
      </div>
      <div class="toolbar-right">
        <el-tag type="info">30 天后自动清理</el-tag>
      </div>
    </div>

    <div class="file-table cs-card">
      <el-table
        ref="tableRef"
        :key="tableKey"
        :data="tableFiles"
        v-loading="loading"
        row-key="id"
        :lazy="lazyMode"
        :load="loadChildren"
        :tree-props="{ checkStrictly: true, children: 'children', hasChildren: 'hasChildren' }"
        :default-expand-all="searchActive && !lazyMode"
        style="width: 100%; min-width: 760px"
        @selection-change="handleSelectionChange"
        @select="onRowSelect"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="name" label="文件名" min-width="300">
          <template #default="{ row }">
            <div class="file-name-cell" :class="{ 'is-dir': row.isDir }" @dblclick="handleOpen(row)">
              <el-icon :size="20" :color="getFileIconColor(row)"><component :is="getFileIcon(row)" /></el-icon>
              <span class="file-name-text">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="size" label="大小" width="120">
          <template #default="{ row }">{{ row.isDir ? '--' : formatSize(row.size) }}</template>
        </el-table-column>
        <el-table-column prop="deletedAt" label="删除时间" width="180">
          <template #default="{ row }">{{ formatDate(row.deletedAt) }}</template>
        </el-table-column>
        <el-table-column prop="expireAt" label="过期时间" width="180">
          <template #default="{ row }"><span class="expire-text">{{ formatDate(row.expireAt) }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <div class="op-actions">
              <el-button link type="primary" size="small" @click="openRestoreDialog(row)">
                <el-icon><RefreshRight /></el-icon><span>恢复</span>
              </el-button>
              <el-popconfirm title="彻底删除后无法恢复，确定？" width="220" @confirm="handlePermanentDelete(row)">
                <template #reference>
                  <el-button link type="danger" size="small">
                    <el-icon><Delete /></el-icon><span>彻底删除</span>
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="回收站为空" :image-size="100" />
        </template>
      </el-table>
      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="recycleTotal"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <!-- 恢复目标目录选择对话框 -->
    <el-dialog v-model="showRestoreDialog" :title="restoreBatch ? '批量恢复到' : '恢复到'" width="440px" append-to-body>
      <div class="restore-target__label">选择恢复到的目标文件夹（默认「全部文件」）：</div>
      <div v-loading="restoreTreeLoading" class="restore-target__tree">
        <el-tree
          ref="restoreTreeRef"
          :data="restoreTreeData"
          :props="{ label: 'label', children: 'children' }"
          node-key="id"
          highlight-current
          :expand-on-click-node="false"
          default-expand-all
          @node-click="handleRestoreNodeClick"
        />
      </div>
      <template #footer>
        <el-button @click="showRestoreDialog = false">取消</el-button>
        <el-button type="primary" :loading="restoring" @click="confirmRestore">恢复</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fileApi } from '@/api'
import { useUserStore } from '@/stores/user'
import { mapFileNode, formatSize, formatDate } from '@/utils/file'

const userStore = useUserStore()

// ===== 数据状态 =====
// 后端 trash 实测（2026-09-21）：
//   - page/size 分页已生效；
//   - parent 参数未实现（传啥都返回全部被删节点）。
// 前端做能力探测：后端支持 parent 过滤时走「懒加载分页下钻」（每次只拉当前页）；
// 否则回退「全量拉取 + 本地建树」（当前可用）。后端补上 parent 后会自动切换到前者。
const parentFilterSupported = ref(false)  // 后端 trash 是否支持 parent 过滤
const allTrashNodes = ref([])             // 全量模式：全部被删节点（含真实 parentId）
const recycleRows = ref([])               // 懒加载模式：根层当前页顶层节点
const pagedTotal = ref(0)                 // 懒加载模式：根层 total
const currentPage = ref(1)
const pageSize = ref(10)                  // 默认每页 10 条
const loading = ref(false)
const searchText = ref('')
const selectedRows = ref([])
const deleting = ref(false)
const tableRef = ref(null)
const tableKey = ref(0)

// 恢复目标选择
const showRestoreDialog = ref(false)
const restoreTreeRef = ref(null)
const restoreTreeData = ref([])
const restoreTreeLoading = ref(false)
const restoreTargetId = ref(0)   // 默认「全部文件」= 根目录 0
const restoring = ref(false)
const restoreRow = ref(null)     // 单条恢复时的行；批量恢复时为 null
const restoreBatch = ref(false)

const lazyMode = computed(() => parentFilterSupported.value)
const searchActive = computed(() => searchText.value.trim() !== '')

onMounted(async () => {
  parentFilterSupported.value = await detectParentFilter()
  if (lazyMode.value) await loadPage(1)
  else await loadAll()
})

function mapRecycleNode(f) {
  return mapFileNode(f, { deletedAt: f.deletedAt || f.updatedAt, expireAt: f.expireAt || null })
}

// 探测后端 trash 是否支持 parent 过滤：
// 用不存在的 parent=-1 请求，返回空说明 parent 生效；返回数据说明 parent 被忽略。
async function detectParentFilter() {
  try {
    const res = await fileApi.trash({ parent: -1, page: 1, size: 1 })
    return !(res.list && res.list.length > 0)
  } catch { return false }
}

// 懒加载模式：按 parent=0 分页拉根层顶层节点（每次只拉当前页）
async function loadPage(page = currentPage.value) {
  loading.value = true
  try {
    const res = await fileApi.trash({ parent: 0, page, size: pageSize.value })
    let rows = (res.list || []).map(mapRecycleNode)
    const total = res.total || 0
    if (rows.length === 0 && total > 0 && page > 1) {
      page = Math.max(1, Math.ceil(total / pageSize.value))
      const res2 = await fileApi.trash({ parent: 0, page, size: pageSize.value })
      rows = (res2.list || []).map(mapRecycleNode)
    }
    recycleRows.value = rows
    pagedTotal.value = total
    currentPage.value = page
  } finally { loading.value = false }
}

// ---- 勾选规则：勾父带全部子孙；勾子只选自己（不带父/兄弟）；取消任意层文件夹则其父联动取消 ----
const loadedKids = new Map()
const nodeById = new Map()
const checkedDirs = new Set()
const skipCascadeFor = new Set()
let isCascading = false
let unlinking = false

function findInTree(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children && n.children.length) { const f = findInTree(n.children, id); if (f) return f }
  }
  return null
}
function findNode(id) {
  return nodeById.get(id) || findInTree(tableFiles.value, id)
}

function kidsOf(row) {
  if (!lazyMode.value && Array.isArray(row.children)) return row.children
  return loadedKids.get(row.id) || []
}

function cascade(row, selected) {
  for (const child of kidsOf(row)) {
    isCascading = true
    tableRef.value?.toggleRowSelection(child, selected)
    isCascading = false
    if (child.isDir) {
      if (selected) checkedDirs.add(child.id); else checkedDirs.delete(child.id)
      cascade(child, selected)
    }
  }
}

function onRowSelect(selection, row) {
  if (isCascading || unlinking) return
  const selected = selection.some(r => r.id === row.id)
  if (selected) {
    if (row.isDir) {
      checkedDirs.add(row.id)
      cascade(row, true)
    }
    return
  }
  // 取消：先级联取消自身子树，再一路向上取消所有仍勾选的祖先（含根文件夹）
  if (row.isDir) {
    checkedDirs.delete(row.id)
    cascade(row, false)
  }
  const selIds = new Set(selection.map(r => r.id))
  unlinking = true
  try {
    let cur = row
    while (cur && cur.parentId) {
      const parent = findNode(cur.parentId)
      if (!parent) break
      if (selIds.has(parent.id)) {
        checkedDirs.delete(parent.id)
        tableRef.value?.toggleRowSelection(parent, false)
      }
      cur = parent
    }
  } finally { unlinking = false }
}

// 懒加载模式：展开目录时按 parent=目录id 拉其直接子项
async function loadChildren(row, treeNode, resolve) {
  try {
    const res = await fileApi.trash({ parent: row.id, page: 1, size: 1000 })
    const children = (res.list || []).map(mapRecycleNode).map(f => ({ ...f, hasChildren: f.isDir }))
    loadedKids.set(row.id, children)
    children.forEach(c => nodeById.set(c.id, c))
    if (checkedDirs.has(row.id)) {
      children.forEach(c => {
        isCascading = true
        tableRef.value?.toggleRowSelection(c, true)
        isCascading = false
        if (c.isDir) checkedDirs.add(c.id)
      })
    }
    resolve(children)
  } catch { resolve([]) }
}

// ===== 全量模式（后端 parent 未实现时的兜底） =====

// 排序：目录在前，同类型按删除时间倒序（递归每层）
function sortNodes(list) {
  list.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1
    if (!a.isDir && b.isDir) return 1
    return new Date(b.deletedAt) - new Date(a.deletedAt)
  })
  list.forEach(n => { if (n.children && n.children.length) sortNodes(n.children) })
  return list
}

// 本地建树：父节点也在回收站里的挂为 children，否则为顶层根节点
function buildTree(nodes) {
  const map = new Map()
  nodes.forEach(n => { map.set(n.id, { ...n, children: [] }) })
  const roots = []
  map.forEach(node => {
    if (node.parentId && map.has(node.parentId)) map.get(node.parentId).children.push(node)
    else roots.push(node)
  })
  return sortNodes(roots)
}

// 全量拉取：后端 trash 返回全部被删节点，循环分页拉全后本地建树
async function loadAll() {
  loading.value = true
  try {
    const all = []
    const size = 500
    for (let page = 1; page <= 200; page++) {
      const res = await fileApi.trash({ page, size })
      const list = (res.list || []).map(mapRecycleNode)
      all.push(...list)
      const total = res.total || 0
      if (list.length === 0 || page * size >= total) break
    }
    allTrashNodes.value = all
    const maxPage = Math.max(1, Math.ceil(recycleRoots.value.length / pageSize.value))
    if (currentPage.value > maxPage) currentPage.value = maxPage
  } finally {
    loading.value = false
  }
}

// 完整目录树的顶层根节点（全量模式，未分页）
const recycleRoots = computed(() => buildTree(allTrashNodes.value))

// 顶层总数（分页用）：懒加载模式用后端 total，全量模式用顶层节点数
const recycleTotal = computed(() => lazyMode.value ? pagedTotal.value : recycleRoots.value.length)

// 搜索：匹配节点 + 其祖先链（保证结果的层级路径完整，仅全量模式）
function familyOf(matchedIds) {
  const idMap = new Map(allTrashNodes.value.map(n => [n.id, n]))
  const keep = new Set(matchedIds)
  let changed = true
  while (changed) {
    changed = false
    for (const id of [...keep]) {
      const n = idMap.get(id)
      if (n && n.parentId && idMap.has(n.parentId) && !keep.has(n.parentId)) {
        keep.add(n.parentId)
        changed = true
      }
    }
  }
  return allTrashNodes.value.filter(n => keep.has(n.id))
}

// 展示的顶层数组
const tableFiles = computed(() => {
  if (lazyMode.value) {
    // 懒加载模式：根层当前页（后端已按 parent=0 分页），展开由 :load 下钻
    let list = [...recycleRows.value]
    if (searchActive.value) {
      const kw = searchText.value.trim().toLowerCase()
      list = list.filter(f => f.name.toLowerCase().includes(kw))
    }
    return list.map(f => ({ ...f, hasChildren: f.isDir }))
  }
  // 全量模式：本地建树
  if (searchActive.value) {
    const kw = searchText.value.trim().toLowerCase()
    const matched = allTrashNodes.value.filter(n => n.name.toLowerCase().includes(kw)).map(n => n.id)
    return buildTree(familyOf(matched))
  }
  const start = (currentPage.value - 1) * pageSize.value
  return recycleRoots.value.slice(start, start + pageSize.value)
})

// 搜索切换时重建表格，让 default-expand-all 重新生效（全量模式搜索态全展开）
watch(searchText, () => { tableKey.value++ })

// 统一刷新入口（恢复/删除后调用）：重建表格并清空树形缓存，确保展开的子列表也更新
async function refresh() {
  if (lazyMode.value) await loadPage(currentPage.value)
  else await loadAll()
  loadedKids.clear()
  nodeById.clear()
  checkedDirs.clear()
  tableKey.value++
}

function handlePageChange(page) {
  selectedRows.value = []
  tableRef.value?.clearSelection()
  if (lazyMode.value) loadPage(page)
  else currentPage.value = page
}

function handleSizeChange(size) {
  pageSize.value = size
  handlePageChange(1)
}

// 双击：文件夹展开/收起，文件无操作
function handleOpen(row) {
  if (row.isDir) tableRef.value?.toggleRowExpansion(row)
}

function handleSelectionChange(rows) {
  selectedRows.value = rows
}

// 删除全部文件：彻底删除回收站中的全部内容（不可恢复）
async function handleDeleteAll() {
  try {
    await ElMessageBox.confirm('确定彻底删除回收站中的全部内容吗？此操作不可恢复。', '删除全部文件', { confirmButtonText: '彻底删除', cancelButtonText: '取消', type: 'warning' })
  } catch { return }
  deleting.value = true
  try {
    const all = []
    const size = 500
    for (let page = 1; page <= 200; page++) {
      const res = await fileApi.trash({ page, size })
      const list = res.list || []
      all.push(...list)
      const total = res.total || 0
      if (list.length === 0 || page * size >= total) break
    }
    if (all.length === 0) { ElMessage.info('回收站已为空'); return }
    // 只删顶层节点：后端对文件夹会级联物理删除其子孙，避免父子节点重复删除
    const targets = topLevelItems(all)
    const results = await Promise.allSettled(targets.map(r => fileApi.remove(r.id, 1)))
    const ok = results.filter(x => x.status === 'fulfilled').length
    const fail = targets.length - ok
    if (fail === 0) ElMessage.success('已彻底删除 ' + ok + ' 项')
    else ElMessage.warning('已彻底删除 ' + ok + ' 项，' + fail + ' 项失败')
    tableRef.value?.clearSelection()
    selectedRows.value = []
    await refresh()
    userStore.loadProfile().catch(() => {})
  } finally { deleting.value = false }
}

// 过滤出「顶层选中节点」：父节点也在选中集合时，子节点会随父级联，避免重复请求
function topLevelItems(items) {
  const idSet = new Set(items.map(r => r.id))
  return items.filter(r => !idSet.has(r.parentId))
}

// 打开恢复对话框（row 为空 = 批量恢复）
async function openRestoreDialog(row) {
  restoreRow.value = row
  restoreBatch.value = row == null
  restoreTargetId.value = 0
  showRestoreDialog.value = true
  restoreTreeLoading.value = true
  try {
    const list = await fileApi.tree()
    restoreTreeData.value = buildFolderTree(list || [])
  } catch {
    restoreTreeData.value = [{ id: 0, label: '全部文件', children: [] }]
  } finally {
    restoreTreeLoading.value = false
    await nextTick()
    restoreTreeRef.value?.setCurrentKey(0)
  }
}

function handleRestoreNodeClick(node) {
  restoreTargetId.value = node.id ?? 0
}

async function confirmRestore() {
  const rows = restoreBatch.value
    ? topLevelItems(selectedRows.value)
    : (restoreRow.value ? [restoreRow.value] : [])
  if (rows.length === 0) return
  restoring.value = true
  try {
    const results = await Promise.allSettled(rows.map(r => fileApi.restore(r.id, { targetParentId: restoreTargetId.value })))
    const okRows = []
    const failRows = []
    results.forEach((x, i) => (x.status === 'fulfilled' ? okRows : failRows).push(rows[i]))
    if (okRows.length === 1 && failRows.length === 0) {
      ElMessage.success(okRows[0]?.name ? '「' + okRows[0].name + '」已恢复' : '已恢复')
    } else if (failRows.length === 0) {
      ElMessage.success('已恢复 ' + okRows.length + ' 项')
    } else if (okRows.length > 0) {
      ElMessage.warning('已恢复 ' + okRows.length + ' 项，' + failRows.length + ' 项失败')
    }
    showRestoreDialog.value = false
    tableRef.value?.clearSelection()
    selectedRows.value = []
    await refresh()
    userStore.loadProfile().catch(() => {})
  } finally {
    restoring.value = false
  }
}

function handlePermanentDelete(row) {
  fileApi.remove(row.id, 1)
    .then(() => { ElMessage.success('已彻底删除'); refresh(); userStore.loadProfile().catch(() => {}) })
    .catch(() => {})
}

// 批量彻底删除：对顶层选中项逐个删除，后端级联物理删除其子孙
async function handleBatchDelete() {
  const rows = topLevelItems(selectedRows.value)
  if (rows.length === 0) return
  try {
    await ElMessageBox.confirm('确定彻底删除选中的 ' + rows.length + ' 项吗？此操作不可恢复。', '彻底删除', { confirmButtonText: '彻底删除', cancelButtonText: '取消', type: 'warning' })
  } catch (e) { return }
  deleting.value = true
  try {
    const results = await Promise.allSettled(rows.map(r => fileApi.remove(r.id, 1)))
    const ok = results.filter(x => x.status === 'fulfilled').length
    const fail = results.length - ok
    if (fail === 0) ElMessage.success('已彻底删除 ' + rows.length + ' 项')
    else ElMessage.warning('已彻底删除 ' + ok + ' 项，' + fail + ' 项失败')
    tableRef.value?.clearSelection()
    selectedRows.value = []
    refresh()
    userStore.loadProfile().catch(() => {})
  } catch (e) { /* 拦截器已提示 */ } finally { deleting.value = false }
}

// 扁平目录列表 → 树（仅目录，根节点「全部文件」）
function buildFolderTree(flatList) {
  const dirs = flatList.filter(f => f.isDir)
  const map = {}
  dirs.forEach(d => { map[d.id] = { id: d.id, label: d.name, children: [] } })
  const roots = []
  dirs.forEach(d => {
    if (d.parentId === 0 || !map[d.parentId]) roots.push(map[d.id])
    else map[d.parentId].children.push(map[d.id])
  })
  return [{ id: 0, label: '全部文件', children: roots }]
}

// 图标映射对齐文件管理页
function getFileIcon(file) {
  const m = { folder: 'Folder', pdf: 'Document', image: 'Picture', word: 'Document', excel: 'Grid', ppt: 'Monitor', video: 'VideoCamera', audio: 'Headset', archive: 'Files', text: 'Notebook' }
  return m[file.type] || 'Document'
}
function getFileIconColor(file) {
  const m = { folder: '#faad14', pdf: '#ff4d4f', image: '#52c41a', word: '#1677ff', excel: '#52c41a', ppt: '#fa8c16', video: '#722ed1', audio: '#13c2c2', archive: '#8c8c8c', text: '#595959' }
  return m[file.type] || '#8c8c8c'
}
</script>

<style scoped>
.file-name-cell { display: flex; align-items: center; gap: 10px; }
.file-name-cell.is-dir { cursor: pointer; }
.file-name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-table { overflow-x: auto; }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 12px; }
.expire-text { color: var(--cs-warning); }
.search-input { width: 240px; }

/* ===== 树形表格样式（对齐文件管理页：展开箭头在文件名左侧同行，而非上方） ===== */
.file-table :deep(.el-table__row .cell) {
  display: flex;
  align-items: center;
}
.file-table :deep(.el-table__expand-icon) {
  color: #c0c4cc;
  font-size: 16px;
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  transition: transform 0.2s ease, color 0.2s ease;
  cursor: pointer;
}
.file-table :deep(.el-table__expand-icon:hover) {
  color: var(--cs-primary, #409eff);
}
.file-table :deep(.el-table__expand-icon--expanded) {
  transform: rotate(90deg);
  color: var(--cs-primary, #409eff);
}
.file-table :deep(.el-table__indent) {
  padding-left: 24px !important;
}
.file-table :deep(.el-table__placeholder) {
  width: 24px;
  display: inline-block;
}
.file-table :deep(.el-table__row--level-1) { background-color: #fafbfc; }
.file-table :deep(.el-table__row--level-2) { background-color: #f5f7fa; }
.file-table :deep(.el-table__row--level-3) { background-color: #f0f2f5; }

/* 工具栏：左搜索框 + 右提示，三端统一 flex 排列 */
.toolbar-left { display: flex; align-items: center; flex: 1; min-width: 0; }
.toolbar-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

/* 面包屑左侧：返回上一级 + 面包屑 */
.breadcrumb-left { display: flex; align-items: center; gap: 4px; min-width: 0; }
.breadcrumb-left .page-title { font-size: 15px; font-weight: 600; }
.breadcrumb-left .back-btn { margin-right: 4px; }
.breadcrumb-left .el-breadcrumb { white-space: nowrap; }

/* 面包屑右侧按钮 */
.breadcrumb-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.breadcrumb-actions .el-button { margin-left: 0; }
.breadcrumb-actions .el-button .el-icon + span { margin-left: 4px; }

/* 表格操作列按钮 */
.op-actions { display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; }
.op-actions .el-button { margin-left: 0; }
.op-actions .el-button + .el-button { margin-left: 0; }
.op-actions .el-button .el-icon + span { margin-left: 4px; }

.restore-target__label { margin-bottom: 8px; font-size: 13px; color: var(--cs-text-secondary); }
.restore-target__tree { max-height: 300px; overflow-y: auto; padding: 4px 8px; border: 1px solid var(--cs-header-border, #dcdfe6); border-radius: 6px; }

@media (max-width: 768px) {
  .breadcrumb-bar { flex-wrap: wrap; gap: 12px; }
  .toolbar { gap: 10px; }
  .toolbar-left { flex: 1 1 100%; }
  .search-input { width: 100%; }
  .toolbar-right { width: 100%; justify-content: flex-start; }
}
</style>