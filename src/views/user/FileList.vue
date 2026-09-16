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
        <el-button type="primary" @click="showUploadDialog = true"><el-icon><UploadFilled /></el-icon><span>上传文件</span></el-button>
        <el-button @click="handleNewFolder"><el-icon><FolderAdd /></el-icon><span>新建文件夹</span></el-button>
      </div>
    </div>
    <div class="toolbar">
      <div class="toolbar-left">
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
      <el-table :data="filteredFiles" v-loading="fileStore.loading" style="width: 100%; min-width: 720px">
        <el-table-column prop="name" label="文件名" min-width="300">
          <template #default="{ row }">
            <div class="file-name-cell" @dblclick="handleOpen(row)">
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
      <el-upload drag multiple action="#" :auto-upload="false">
        <el-icon :size="48" class="upload-icon"><UploadFilled /></el-icon>
        <div class="el-upload__text">拖拽文件到此处，或 <em>点击上传</em></div>
        <template #tip><div class="el-upload__tip">上传接口待后端开放，当前暂不可用</div></template>
      </el-upload>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { useFileStore } from '@/stores/file'
import { ElMessage, ElMessageBox } from 'element-plus'
import { formatSize, formatDate } from '@/utils/file'

const fileStore = useFileStore()
const searchText = ref('')
const sortBy = ref('time')
const viewMode = ref('table')
const currentPage = ref(1)
const pageSize = ref(20)
const showUploadDialog = ref(false)

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
function handleSizeChange() { currentPage.value = 1; reload() }
function handleNavigate(id) { currentPage.value = 1; fileStore.navigateTo(id) }

function handleOpen(row) {
  if (row.isDir) { handleNavigate(row.id) }
  else ElMessage.info('在线预览待后端接口支持')
}
function handleDownload() { ElMessage.info('下载待后端接口支持') }

function handleDelete(id) {
  fileStore.remove(id).then(() => { ElMessage.success('已移入回收站'); reload() }).catch(() => {})
}

function handleRename(row) {
  ElMessageBox.prompt('请输入新名称', '重命名', { inputValue: row.name, confirmButtonText: '确定', cancelButtonText: '取消', inputPattern: /\S+/, inputErrorMessage: '名称不能为空' })
    .then(({ value }) => {
      fileStore.rename(row.id, value.trim()).then(() => { ElMessage.success('重命名成功'); reload() }).catch(() => {})
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
