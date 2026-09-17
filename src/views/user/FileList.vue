<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item><el-icon><HomeFilled /></el-icon></el-breadcrumb-item>
        <el-breadcrumb-item v-for="item in fileStore.breadcrumb" :key="item.id">
          <a @click.prevent="handleNavigate(item.id)">{{ item.name }}</a>
        </el-breadcrumb-item>
      </el-breadcrumb>
      <div class="breadcrumb-actions">
        <el-button type="primary" @click="openUploadDialog"><el-icon><UploadFilled /></el-icon><span>上传文件</span></el-button>
        <el-button @click="handleNewFolder"><el-icon><FolderAdd /></el-icon><span>新建文件夹</span></el-button>
        <el-button v-if="selectedRows.length > 0" type="warning" @click="openMoveDialog"><el-icon><FolderOpened /></el-icon><span>移动到（{{ selectedRows.length }}）</span></el-button>
        <el-button v-if="deleteCount > 0" type="danger" plain :loading="deleting" @click="handleBatchDelete"><el-icon><Delete /></el-icon><span>删除（{{ deleteCount }}）</span></el-button>
      </div>
    </div>
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button v-if="fileStore.total > 0" plain :loading="selectLoading" @click="toggleSelectAll"><span>{{ selectAll ? '取消全选' : '全选' }}</span></el-button>
        <el-input v-model="searchText" placeholder="搜索当前页文件..." :prefix-icon="Search" clearable class="search-input" />
      </div>
      <div class="toolbar-right">
        <el-select v-model="sortBy" class="sort-select">
          <el-option label="按名称" value="name" />
          <el-option label="按大小" value="size" />
          <el-option label="按时间" value="time" />
        </el-select>
        <el-button-group class="view-switch">
          <el-button :type="viewMode === 'table' ? 'primary' : ''" @click="viewMode = 'table'"><el-icon><List /></el-icon></el-button>
          <el-button :type="viewMode === 'grid' ? 'primary' : ''" @click="viewMode = 'grid'"><el-icon><Grid /></el-icon></el-button>
        </el-button-group>
      </div>
    </div>
    <div v-if="viewMode === 'table'" class="file-table cs-card">
      <el-table ref="tableRef" :key="tableKey" :data="tableFiles" v-loading="fileStore.loading" lazy row-key="id" :tree-props="{ children: 'children', hasChildren: 'hasChildren' }" :load="loadChildren" style="width: 100%; min-width: 720px" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="name" label="文件名" min-width="300">
          <template #default="{ row }">
            <div class="file-name-cell" :class="{ 'drop-target': dragOverId === row.id && row.isDir, 'dragging': draggedItem && draggedItem.id === row.id, 'drop-success': dropSuccessId === row.id }" @dblclick="handleOpen(row)" @dragover="row.isDir && handleDragOver(row, $event)" @dragleave="handleDragLeave" @drop="row.isDir && handleDrop(row, $event)">
              <el-icon class="drag-handle" draggable="true" @dragstart="handleDragStart(row, $event)" @dragend="handleDragEnd" :size="14"><Rank /></el-icon>
              <el-icon :size="20" :color="getFileIconColor(row)"><component :is="getFileIcon(row)" /></el-icon>
              <span class="file-name-text">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="size" label="大小" width="120">
          <template #default="{ row }">{{ row.isDir ? '--' : formatSize(row.size) }}</template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="修改时间" width="180">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <div class="op-actions">
              <el-button link type="primary" size="small" @click="handleDownload(row)"><el-icon><Download /></el-icon><span>下载</span></el-button>
              <el-button link type="primary" size="small" @click="handleRename(row)"><el-icon><EditPen /></el-icon><span>重命名</span></el-button>
              <el-popconfirm title="删除后进入回收站，确定？" width="220" @confirm="handleDelete(row.id)">
                <template #reference><el-button link type="danger" size="small"><el-icon><Delete /></el-icon><span>删除</span></el-button></template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div v-else class="file-grid">
      <div v-for="file in filteredFiles" :key="file.id" class="file-grid-item cs-card" @dblclick="handleOpen(file)">
        <div class="grid-icon"><el-icon :size="48" :color="getFileIconColor(file)"><component :is="getFileIcon(file)" /></el-icon></div>
        <div class="grid-name" :title="file.name">{{ file.name }}</div>
        <div class="grid-meta">{{ file.isDir ? '文件夹' : formatSize(file.size) }}</div>
      </div>
    </div>
    <div class="pagination-bar">
      <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[20, 50, 100]" :total="fileStore.total" layout="total, sizes, prev, pager, next" background @current-change="reload" @size-change="handleSizeChange" />
    </div>
    <el-dialog v-model="showUploadDialog" title="上传文件" width="min(520px, 92vw)" destroy-on-close>
      <div class="upload-target">
        <div class="upload-target__label">上传到目录（默认「全部文件」）</div>
        <div v-loading="uploadTreeLoading" class="upload-target__tree">
          <el-tree
            ref="uploadTreeRef"
            :data="uploadTreeData"
            :props="{ label: 'label', children: 'children' }"
            node-key="id"
            highlight-current
            :expand-on-click-node="false"
            default-expand-all
            empty-text="暂无目录，默认上传到全部文件"
            @node-click="handleUploadNodeClick"
          />
        </div>
      </div>
      <el-upload drag multiple :http-request="doUpload" :show-file-list="true">
        <el-icon :size="48" class="upload-icon"><UploadFilled /></el-icon>
        <div class="el-upload__text">拖拽文件到此处，或 <em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">将上传到「{{ uploadTargetName }}」；支持秒传与大文件分片上传</div>
        </template>
      </el-upload>
    </el-dialog>
    <el-dialog v-model="showMoveDialog" title="移动到" width="min(480px, 92vw)" destroy-on-close>
      <div v-loading="moveTreeLoading" style="min-height: 200px; max-height: 400px; overflow-y: auto">
        <el-tree :data="folderTreeData" :props="{ label: 'label', children: 'children', disabled: 'disabled' }" node-key="id" highlight-current :expand-on-click-node="false" default-expand-all @node-click="handleMoveNodeClick" />
      </div>
      <template #footer>
        <el-button @click="showMoveDialog = false">取消</el-button>
        <el-button type="primary" :loading="moveLoading" :disabled="moveTargetId == null" @click="confirmBatchMove">确定移动</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { Search, Rank, FolderOpened } from '@element-plus/icons-vue'
import { useFileStore } from '@/stores/file'
import { fileApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { formatSize, formatDate, mapFileNode } from '@/utils/file'
import { uploadApi } from '@/api'
import { uploadFile } from '@/utils/upload'

const fileStore = useFileStore()
const searchText = ref('')
const sortBy = ref('time')
const viewMode = ref('table')
const currentPage = ref(1)
const pageSize = ref(20)
const showUploadDialog = ref(false)
const uploadTreeRef = ref(null)
const uploadTreeData = ref([])
const uploadTreeLoading = ref(false)
const uploadTargetId = ref(0)
const uploadTargetName = ref('全部文件')
const draggedItem = ref(null)
const dragOverId = ref(null)
const dropSuccessId = ref(null)
const tableKey = ref(0)
const selectedRows = ref([])
const showMoveDialog = ref(false)
const folderTreeData = ref([])
const moveTargetId = ref(null)
const moveTreeLoading = ref(false)
const moveLoading = ref(false)
const deleting = ref(false)
const selectAll = ref(false)
const allItems = ref([])
const selectLoading = ref(false)
const tableRef = ref(null)
const selecting = ref(false)

onMounted(() => {
  // 移动端默认用网格视图，更适配小屏
  if (window.innerWidth <= 768) viewMode.value = 'grid'
  fileStore.loadDir(0, 1, pageSize.value)
})

// 搜索与排序为当前页本地处理（后端暂无搜索接口）
const filteredFiles = computed(() => {
  let list = [...fileStore.files]
  if (searchText.value) list = list.filter(f => f.name.toLowerCase().includes(searchText.value.toLowerCase()))
  list.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1
    if (!a.isDir && b.isDir) return 1
    if (sortBy.value === 'name') return a.name.localeCompare(b.name, 'zh-CN')
    if (sortBy.value === 'size') return (b.size || 0) - (a.size || 0)
    return new Date(b.updatedAt) - new Date(a.updatedAt)
  })
  return list
})

function reload() { fileStore.loadDir(fileStore.currentParentId, currentPage.value, pageSize.value) }

// 过滤出"顶层选中节点"：父节点也在选中集合时，子节点会随父级联删，避免重复请求
function topLevelItems(items) {
  const idSet = new Set(items.map(r => r.id))
  return items.filter(r => !idSet.has(r.parentId))
}

// 实际要删除的顶层节点数（删除按钮显示用）
const deleteCount = computed(() => topLevelItems(selectAll.value ? allItems.value : selectedRows.value).length)

// 树形表格：给每行标记 hasChildren（文件夹才能展开）
const tableFiles = computed(() => {
  return filteredFiles.value.map(f => ({ ...f, hasChildren: f.isDir }))
})

// 懒加载子目录
async function loadChildren(row, treeNode, resolve) {
  try {
    const res = await fileApi.listDir({ parent: row.id, page: 1, size: 1000 })
    const children = (res.list || []).map(f => mapFileNode(f)).map(f => ({ ...f, hasChildren: f.isDir }))
    resolve(children)
  } catch { resolve([]) }
}
// 拖拽移动
function handleDragStart(row, event) {
  draggedItem.value = row
  event.dataTransfer.effectAllowed = 'move'
  // 自定义拖拽幽灵
  const ghost = document.createElement('div')
  ghost.className = 'drag-ghost'
  ghost.textContent = row.isDir ? `📁 ${row.name}` : `📄 ${row.name}`
  document.body.appendChild(ghost)
  event.dataTransfer.setDragImage(ghost, 20, 14)
  setTimeout(() => ghost.remove(), 0)
}
function handleDragEnd() {
  draggedItem.value = null
  dragOverId.value = null
  if (!dropSuccessId.value) dropSuccessId.value = null
}
function handleDragOver(row, event) {
  event.preventDefault()
  if (draggedItem.value && draggedItem.value.id !== row.id) {
    dragOverId.value = row.id
    event.dataTransfer.dropEffect = 'move'
  }
}
function handleDragLeave() {
  dragOverId.value = null
}
async function handleDrop(targetRow, event) {
  event.preventDefault()
  dragOverId.value = null
  const item = draggedItem.value
  if (!item || item.id === targetRow.id) return
  if (!targetRow.isDir) return
  try {
    await fileApi.update(item.id, { parentId: targetRow.id })
    dropSuccessId.value = targetRow.id
    ElMessage.success(`已将「${item.name}」移动到「${targetRow.name}」`)
    setTimeout(() => { dropSuccessId.value = null; selectedRows.value = []; tableKey.value++; reload() }, 400)
  } catch {}
}
// 表格勾选
function handleSelectionChange(rows) {
  selectedRows.value = rows
  if (selecting.value) return
  if (selectAll.value) { selectAll.value = false; allItems.value = [] }
}

// 批量移动：打开文件夹树弹窗
async function openMoveDialog() {
  showMoveDialog.value = true
  moveTargetId.value = null
  moveTreeLoading.value = true
  try {
    const list = await fileApi.tree()
    folderTreeData.value = buildFolderTree(list || [], selectedRows.value.map(r => r.id))
  } catch { folderTreeData.value = [{ id: 0, label: '全部文件', children: [] }] }
  finally { moveTreeLoading.value = false }
}

function handleMoveNodeClick(node) {
  if (node.disabled) { moveTargetId.value = null; return }
  moveTargetId.value = node.id
}

// 扁平列表 → 树形结构（仅文件夹）
function buildFolderTree(flatList, excludeIds = []) {
  const dirs = flatList.filter(f => f.isDir)
  // 禁用集合：被选中项自身 + 其全部后代目录（不能移入自身或自己的子目录，否则后端判环回滚）
  const childMap = {}
  flatList.forEach(f => { (childMap[f.parentId] = childMap[f.parentId] || []).push(f.id) })
  const disabledSet = new Set()
  const stack = [...excludeIds]
  while (stack.length) {
    const id = stack.pop()
    if (disabledSet.has(id)) continue
    disabledSet.add(id)
    for (const cid of childMap[id] || []) stack.push(cid)
  }
  const map = {}
  dirs.forEach(d => { map[d.id] = { id: d.id, label: d.name, children: [], disabled: disabledSet.has(d.id) } })
  const roots = []
  dirs.forEach(d => {
    if (d.parentId === 0 || !map[d.parentId]) roots.push(map[d.id])
    else map[d.parentId].children.push(map[d.id])
  })
  return [{ id: 0, label: '全部文件', children: roots }]
}

// 确认批量移动
async function confirmBatchMove() {
  if (moveTargetId.value == null) return
  moveLoading.value = true
  try {
    // 过滤掉目标目录未变化的项目（已在该目录下，避免后端报无意义移动导致整体回滚）
    const moving = selectedRows.value.filter(r => r.parentId !== moveTargetId.value)
    if (moving.length === 0) { ElMessage.info('所选项目已在该目录下'); moveLoading.value = false; return }
    const ids = moving.map(r => r.id)
    await fileApi.batchMove({ ids, targetParentId: moveTargetId.value })
    ElMessage.success(`已移动 ${ids.length} 个项目`)
    showMoveDialog.value = false
    selectedRows.value = []
    tableKey.value++
    reload()
  } catch {} finally { moveLoading.value = false }
}
function handleSizeChange() { currentPage.value = 1; reload() }
function handleNavigate(id) { currentPage.value = 1; fileStore.navigateTo(id) }

function handleOpen(row) {
  if (row.isDir) { handleNavigate(row.id) }
  else ElMessage.info('在线预览待后端接口支持')
}

// 打开上传对话框：加载目录树，默认选中「全部文件」（根目录）
async function openUploadDialog() {
  showUploadDialog.value = true
  uploadTargetId.value = 0
  uploadTargetName.value = '全部文件'
  uploadTreeLoading.value = true
  try {
    const list = await fileApi.tree()
    uploadTreeData.value = buildFolderTree(list || [])
  } catch {
    uploadTreeData.value = [{ id: 0, label: '全部文件', children: [] }]
  } finally {
    uploadTreeLoading.value = false
    await nextTick()
    uploadTreeRef.value?.setCurrentKey(0)
  }
}

// 选择上传目标目录
function handleUploadNodeClick(node) {
  uploadTargetId.value = node.id
  uploadTargetName.value = node.label
}

// el-upload 自定义上传：分片上传 + 秒传 + 断点续传
function doUpload(options) {
  // 注意：element-plus http-request 的 options.file 就是原始 File（带 uid），没有 .raw 属性
  const raw = options.file
  const name = raw?.name || '未命名文件'
  if (!raw) {
    ElMessage.error('读取文件失败，请重新选择')
    options.onError(new Error('empty file'))
    return
  }
  const parentId = uploadTargetId.value ?? 0
  uploadFile(raw, parentId, ({ phase, percent }) => {
    // 哈希阶段(本地计算指纹，不发网络请求)映射 0-30%，分片上传映射 30-100%
    const total = phase === 'hash' ? Math.round(percent * 0.3) : 30 + Math.round(percent * 0.7)
    options.onProgress({ percent: total })
  })
    .then(res => {
      options.onSuccess(res)
      ElMessage.success(res.instant ? `「${name}」秒传成功` : `「${name}」上传成功`)
      reload()
    })
    .catch(err => {
      // 具体错误已由 request 拦截器统一 toast
      options.onError(err)
    })
}

async function handleDownload(row) {
  if (row.isDir) { ElMessage.warning('文件夹暂不支持下载'); return }
  try {
    const { url } = await uploadApi.getDownloadUrl(row.id)
    // 预签名 URL（5 分钟有效）为跨域直链，用 a 标签触发；
    // download 属性在同源时生效，跨域时浏览器会按后端响应头（Content-Disposition）决定下载还是预览
    const a = document.createElement('a')
    a.href = url
    a.download = row.name
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch (e) {
    // 错误已由拦截器统一提示
  }
}

function handleDelete(id) {
  fileStore.remove(id).then(() => { ElMessage.success('已移入回收站'); selectedRows.value = []; tableKey.value++; reload() }).catch(() => {})
}

function handleRename(row) {
  ElMessageBox.prompt('请输入新名称', '重命名', { inputValue: row.name, confirmButtonText: '确定', cancelButtonText: '取消', inputPattern: /\S+/, inputErrorMessage: '名称不能为空' })
    .then(({ value }) => {
      fileStore.rename(row.id, value.trim()).then(() => { ElMessage.success('重命名成功'); selectedRows.value = []; tableKey.value++; reload() }).catch(() => {})
    }).catch(() => {})
}

function handleNewFolder() {
  ElMessageBox.prompt('请输入文件夹名称', '新建文件夹', { confirmButtonText: '创建', cancelButtonText: '取消', inputPattern: /\S+/, inputErrorMessage: '名称不能为空' })
    .then(({ value }) => {
      fileStore.createFolder(value.trim()).then(res => {
        // 后端同级重名会自动改名，返回实际创建的名称
        ElMessage.success(res?.name ? `已创建「${res.name}」` : '文件夹已创建')
        reload()
      }).catch(() => {})
    }).catch(() => {})
}

// 批量删除勾选项（移入回收站，可恢复）
async function handleBatchDelete() {
  const rows = topLevelItems(selectAll.value ? allItems.value : selectedRows.value)
  if (rows.length === 0) return
  try {
    await ElMessageBox.confirm('确定删除选中的 ' + rows.length + ' 项吗？包含文件夹时将连同其内所有文件一起移入回收站。', '批量删除', { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' })
  } catch (e) { return }
  deleting.value = true
  try {
    const results = await Promise.allSettled(rows.map(r => fileApi.remove(r.id, 0)))
    const ok = results.filter(x => x.status === 'fulfilled').length
    const fail = results.length - ok
    if (fail === 0) ElMessage.success('已删除 ' + ok + ' 项（移入回收站）')
    else ElMessage.warning('已删除 ' + ok + ' 项，' + fail + ' 项失败')
    selectAll.value = false
    allItems.value = []
    selectedRows.value = []
    tableKey.value++
    reload()
  } catch (e) { /* 拦截器已提示 */ } finally { deleting.value = false }
}

// 全选/取消全选：全选当前文件夹下所有子项（跨页）
async function toggleSelectAll() {
  if (selectAll.value) {
    selectAll.value = false
    allItems.value = []
    tableRef.value?.clearSelection()
    return
  }
  selectLoading.value = true
  try {
    const items = await fetchAllChildren()
    if (items.length === 0) { ElMessage.info('当前文件夹已为空'); return }
    allItems.value = items
    selectAll.value = true
    selecting.value = true
    tableRef.value?.toggleAllSelection()
    await nextTick()
    selecting.value = false
  } catch (e) { /* 拦截器已提示 */ } finally { selectLoading.value = false }
}

// 拉取当前文件夹下所有内容（递归，包含子文件夹内的所有文件）
async function fetchAllChildren() {
  const list = await fileApi.tree()
  const childMap = {}
  list.forEach(n => { (childMap[n.parentId] = childMap[n.parentId] || []).push(n) })
  const result = []
  const queue = [...(childMap[fileStore.currentParentId] || [])]
  while (queue.length) {
    const node = queue.shift()
    result.push(node)
    for (const c of (childMap[node.id] || [])) queue.push(c)
  }
  return result
}

function getFileIcon(file) {
  const m = { folder:'Folder',pdf:'Document',image:'Picture',word:'Document',excel:'Grid',ppt:'Monitor',video:'VideoCamera',archive:'Files',text:'Notebook' }
  return m[file.type] || 'Document'
}
function getFileIconColor(file) {
  const m = { folder:'#faad14',pdf:'#ff4d4f',image:'#52c41a',word:'#1677ff',excel:'#52c41a',ppt:'#fa8c16',video:'#722ed1',archive:'#8c8c8c',text:'#595959' }
  return m[file.type] || '#8c8c8c'
}
</script>

<style scoped>
.file-name-cell { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.file-name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-table { overflow-x: auto; }
.file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
.file-grid-item { padding: 24px 16px 18px; text-align: center; cursor: pointer; transition: all 0.25s ease; }
.file-grid-item:hover { transform: translateY(-4px); box-shadow: var(--cs-shadow-lg); border-color: var(--cs-primary-light); }
.grid-icon { margin-bottom: 12px; }
.grid-name { font-size: 13px; color: var(--cs-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; }
.grid-meta { font-size: 12px; color: var(--cs-text-tertiary); }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 20px; padding: 12px 0; }
.upload-icon { color: var(--cs-primary); margin-bottom: 8px; }

/* 上传对话框：目录选择器 */
.upload-target { margin-bottom: 16px; }
.upload-target__label { font-size: 13px; color: #606266; margin-bottom: 6px; }
.upload-target__tree { max-height: 220px; overflow-y: auto; padding: 2px 6px; border: 1px solid #dcdfe6; border-radius: 6px; }

/* 工具栏：左搜索框、右排序+视图切换，三端统一 flex 排列 */
.toolbar-left { display: flex; align-items: center; flex: 1; min-width: 0; }
.toolbar-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.search-input { width: 240px; }
.sort-select { width: 140px; }

/* 面包屑右侧按钮 */
.breadcrumb-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.breadcrumb-actions .el-button { margin-left: 0; }
.breadcrumb-actions .el-button .el-icon + span { margin-left: 4px; }

/* 表格操作列按钮 */
.op-actions { display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; }
.op-actions .el-button { margin-left: 0; }
.op-actions .el-button + .el-button { margin-left: 0; }
.op-actions .el-button .el-icon + span { margin-left: 4px; }

/* ===== 树形表格样式优化 ===== */
/* 展开箭头：颜色、大小、旋转动画 */
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

/* 缩进与占位：保持对齐 */
.file-table :deep(.el-table__indent) {
  padding-left: 24px !important;
}
.file-table :deep(.el-table__placeholder) {
  width: 24px;
  display: inline-block;
}

/* 子级行背景：区分层级 */
.file-table :deep(.el-table__row--level-1) {
  background-color: #fafbfc;
}
.file-table :deep(.el-table__row--level-2) {
  background-color: #f5f7fa;
}
.file-table :deep(.el-table__row--level-3) {
  background-color: #f0f2f5;
}

/* 行 hover 效果 */
.file-table :deep(.el-table__body tr:hover > td) {
  background-color: #ecf5ff !important;
}

/* 文件名单元格：平滑过渡 */
.file-name-cell {
  transition: background-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease, transform 0.2s ease;
}

/* 被拖拽行：完全隐藏 */
.file-name-cell.dragging {
  opacity: 0;
  transform: scale(0.95);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

/* 拖拽幽灵：跟随鼠标的浮动标签 */
.drag-ghost {
  position: fixed;
  top: -1000px;
  left: -1000px;
  padding: 6px 14px;
  background: var(--cs-primary, #409eff);
  color: #fff;
  border-radius: 6px;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: 0 4px 16px rgba(64, 158, 255, 0.35);
  pointer-events: none;
  z-index: 9999;
}

/* 拖拽手柄：hover 显示，抓取光标 */
.drag-handle {
  cursor: grab;
  color: #dcdfe6;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s, color 0.2s;
}
.file-name-cell:hover .drag-handle { opacity: 1; }
.drag-handle:hover { color: var(--cs-primary, #409eff); }
.drag-handle:active { cursor: grabbing; }

/* 拖拽放置目标高亮：平滑进入 */
.file-name-cell.drop-target {
  background-color: #ecf5ff;
  border-radius: 4px;
  box-shadow: inset 0 0 0 2px var(--cs-primary, #409eff);
  animation: dropPulse 0.6s ease infinite alternate;
}

@keyframes dropPulse {
  from { box-shadow: inset 0 0 0 2px var(--cs-primary, #409eff); }
  to { box-shadow: inset 0 0 0 3px var(--cs-primary, #409eff), 0 0 8px rgba(64, 158, 255, 0.3); }
}

/* 拖拽放置成功闪烁 */
@keyframes dropSuccess {
  0% { background-color: #67c23a33; }
  100% { background-color: transparent; }
}
.file-name-cell.drop-success {
  animation: dropSuccess 0.6s ease;
}

/* 层级递进偏移：每深一层文件名右移 */
.file-table :deep(.el-table__row--level-1) .file-name-cell { padding-left: 20px; }
.file-table :deep(.el-table__row--level-2) .file-name-cell { padding-left: 40px; }
.file-table :deep(.el-table__row--level-3) .file-name-cell { padding-left: 60px; }
.file-table :deep(.el-table__row--level-4) .file-name-cell { padding-left: 80px; }
.file-table :deep(.el-table__row--level-5) .file-name-cell { padding-left: 100px; }


/* 文件名单元格：与箭头对齐 */
.file-table :deep(.el-table__row .cell) {
  display: flex;
  align-items: center;
}

@media (max-width: 768px) {
  .breadcrumb-bar { flex-wrap: wrap; gap: 12px; }
  .toolbar { gap: 10px; }
  .toolbar-left { flex: 1 1 100%; }
  .search-input { width: 100%; }
  .toolbar-right { width: 100%; justify-content: space-between; flex-wrap: nowrap; }
  .file-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }
  .pagination-bar { justify-content: center; }
}
</style>