<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <div class="breadcrumb-left">
        <el-button class="back-btn" :disabled="!canGoUp" @click="goUp" title="返回上一级">
          <el-icon><Back /></el-icon><span>上一级</span>
        </el-button>
        <el-breadcrumb separator="/">
          <el-breadcrumb-item><el-icon><HomeFilled /></el-icon></el-breadcrumb-item>
          <el-breadcrumb-item v-for="item in recycleBreadcrumb" :key="item.id">
            <a @click.prevent="handleRecycleNavigate(item.id)">{{ item.name }}</a>
          </el-breadcrumb-item>
        </el-breadcrumb>
      </div>
      <div class="breadcrumb-actions">
        <el-button v-if="selectedRows.length > 0" type="primary" @click="openRestoreDialog(null)">
          <el-icon><RefreshRight /></el-icon><span>批量恢复（{{ selectedRows.length }}）</span>
        </el-button>
        <el-button v-if="selectedRows.length > 0" type="danger" plain :loading="deleting" @click="handleBatchDelete">
          <el-icon><Delete /></el-icon><span>彻底删除（{{ selectedRows.length }}）</span>
        </el-button>
        <el-button v-if="recycleRoots.length > 0" plain @click="toggleSelectAll">
          <span>{{ selectAll ? '取消全选' : '全选' }}</span>
        </el-button>
      </div>
    </div>

    <div class="toolbar">
      <div class="toolbar-left">
        <el-input v-model="searchText" placeholder="搜索当前目录..." :prefix-icon="Search" clearable class="search-input" />
      </div>
      <div class="toolbar-right">
        <el-tag type="info">30 天后自动清理</el-tag>
      </div>
    </div>

    <div class="file-table cs-card">
      <el-table ref="tableRef" :data="currentNodes" v-loading="loading" row-key="id" style="width: 100%; min-width: 760px" @selection-change="handleSelectionChange">
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
import { ref, computed, onMounted, nextTick } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fileApi } from '@/api'
import { useUserStore } from '@/stores/user'
import { mapFileNode, formatSize, formatDate } from '@/utils/file'

const userStore = useUserStore()

// 回收站数据：全量拉取后本地建树，下钻式浏览（文件夹默认折叠，双击进入子目录）
const flatMap = ref({})           // id → 节点（含 children）
const recycleRoots = ref([])     // 顶层节点（回收站根层直接子项）
const currentRecycleDirId = ref(0) // 0 = 回收站根层
const loading = ref(false)
const searchText = ref('')
const selectedRows = ref([])
const selectAll = ref(false)
const deleting = ref(false)
const tableRef = ref(null)

// 恢复目标选择
const showRestoreDialog = ref(false)
const restoreTreeRef = ref(null)
const restoreTreeData = ref([])
const restoreTreeLoading = ref(false)
const restoreTargetId = ref(0)   // 默认「全部文件」= 根目录 0
const restoring = ref(false)
const restoreRow = ref(null)     // 单条恢复时的行；批量恢复时为 null
const restoreBatch = ref(false)

onMounted(() => loadTrash())

// 全量拉取回收站（循环分页；回收站 30 天内数据量通常不大）
async function fetchAllTrash() {
  const size = 500
  let page = 1
  const all = []
  while (true) {
    const res = await fileApi.trash({ page, size })
    const list = res.list || []
    all.push(...list)
    if (all.length >= (res.total || 0) || list.length < size) break
    page++
  }
  return all
}

// 回收站扁平列表 → 树（父目录不在回收站集合里的节点作为顶层根）
function buildRecycleTree(flatList) {
  const map = {}
  flatList.forEach(f => { map[f.id] = { ...f, children: [] } })
  const roots = []
  flatList.forEach(f => {
    const node = map[f.id]
    if (f.parentId && map[f.parentId]) map[f.parentId].children.push(node)
    else roots.push(node)
  })
  return { map, roots }
}

async function loadTrash() {
  loading.value = true
  try {
    const list = await fetchAllTrash()
    const mapped = list.map(f => mapFileNode(f, { deletedAt: f.deletedAt || f.updatedAt, expireAt: f.expireAt || null }))
    const { map, roots } = buildRecycleTree(mapped)
    flatMap.value = map
    recycleRoots.value = roots
    // 当前目录若已被恢复/彻底删除，回退到根层
    if (currentRecycleDirId.value !== 0 && !flatMap.value[currentRecycleDirId.value]) {
      currentRecycleDirId.value = 0
    }
  } finally {
    loading.value = false
  }
}

// 当前层级节点：根层取顶层，否则取当前目录的 children；搜索 + 排序
const currentNodes = computed(() => {
  let list = currentRecycleDirId.value === 0
    ? recycleRoots.value
    : (flatMap.value[currentRecycleDirId.value]?.children || [])
  list = [...list]
  if (searchText.value) list = list.filter(f => f.name.toLowerCase().includes(searchText.value.toLowerCase()))
  list.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1
    if (!a.isDir && b.isDir) return 1
    return new Date(b.deletedAt) - new Date(a.deletedAt)
  })
  return list
})

// 面包屑：[回收站(0), ...祖先..., 当前]
const recycleBreadcrumb = computed(() => {
  const chain = []
  let id = currentRecycleDirId.value
  while (id !== 0 && id != null) {
    const node = flatMap.value[id]
    if (!node) break
    chain.unshift({ id: node.id, name: node.name })
    id = node.parentId
  }
  return [{ id: 0, name: '回收站' }, ...chain]
})

const canGoUp = computed(() => recycleBreadcrumb.value.length > 1)

function handleRecycleNavigate(id) {
  currentRecycleDirId.value = id
  selectedRows.value = []
  tableRef.value?.clearSelection()
}

function goUp() {
  if (!canGoUp.value) return
  const parent = recycleBreadcrumb.value[recycleBreadcrumb.value.length - 2]
  handleRecycleNavigate(parent.id)
}

// 双击：文件夹进入子目录，文件无操作
function handleOpen(row) {
  if (row.isDir) handleRecycleNavigate(row.id)
}

function handleSelectionChange(rows) {
  selectedRows.value = rows
  // 当前层级全部勾选时自动进入「全选」态，手动取消任意项则退出
  selectAll.value = currentNodes.value.length > 0 && rows.length === currentNodes.value.length
}

function toggleSelectAll() {
  if (selectAll.value) tableRef.value?.clearSelection()
  else tableRef.value?.toggleAllSelection()
}

// 过滤出「顶层选中节点」：父节点也在选中集合时，子节点会随父级联恢复，避免重复请求
function topLevelItems(items) {
  const idSet = new Set(items.map(r => r.id))
  return items.filter(r => !idSet.has(r.parentId))
}

// 收集节点及其所有子孙 id（彻底删除需全量，避免后端不级联时残留孤儿）
function collectSubtreeIds(nodes) {
  const ids = new Set()
  const stack = [...nodes]
  while (stack.length) {
    const node = stack.pop()
    if (!node || ids.has(node.id)) continue
    ids.add(node.id)
    for (const c of (node.children || [])) stack.push(c)
  }
  return [...ids]
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
    const fulfilled = results.filter(x => x.status === 'fulfilled').map(x => x.value)
    const fail = rows.length - fulfilled.length
    if (rows.length === 1 && fail === 0) {
      const name = fulfilled[0]?.name
      ElMessage.success(name ? `「${name}」已恢复` : '已恢复')
    } else if (fail === 0) {
      ElMessage.success('已恢复 ' + rows.length + ' 项')
    } else {
      ElMessage.warning('已恢复 ' + (rows.length - fail) + ' 项，' + fail + ' 项失败')
    }
    showRestoreDialog.value = false
    tableRef.value?.clearSelection()
    loadTrash()
    userStore.loadProfile().catch(() => {})
  } finally {
    restoring.value = false
  }
}

function handlePermanentDelete(row) {
  fileApi.remove(row.id, 1)
    .then(() => { ElMessage.success('已彻底删除'); loadTrash(); userStore.loadProfile().catch(() => {}) })
    .catch(() => {})
}

// 批量彻底删除（含选中目录的子孙，全量删，后端幂等兜底）
async function handleBatchDelete() {
  if (selectedRows.value.length === 0) return
  try {
    await ElMessageBox.confirm(`确定彻底删除选中的 ${selectedRows.value.length} 项吗？此操作不可恢复。`, '彻底删除', { confirmButtonText: '彻底删除', cancelButtonText: '取消', type: 'warning' })
  } catch (e) { return }
  deleting.value = true
  try {
    const ids = collectSubtreeIds(selectedRows.value)
    const results = await Promise.allSettled(ids.map(id => fileApi.remove(id, 1)))
    const ok = results.filter(x => x.status === 'fulfilled').length
    const fail = results.length - ok
    if (fail === 0) ElMessage.success('已彻底删除 ' + selectedRows.value.length + ' 项')
    else ElMessage.warning('已彻底删除 ' + ok + ' 项，' + fail + ' 项失败')
    tableRef.value?.clearSelection()
    loadTrash()
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
.expire-text { color: var(--cs-warning); }
.search-input { width: 240px; }

/* 工具栏：左搜索框 + 右提示，三端统一 flex 排列 */
.toolbar-left { display: flex; align-items: center; flex: 1; min-width: 0; }
.toolbar-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

/* 面包屑左侧：返回上一级 + 面包屑 */
.breadcrumb-left { display: flex; align-items: center; gap: 4px; min-width: 0; }
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