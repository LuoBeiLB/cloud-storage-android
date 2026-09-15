<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item><el-icon><HomeFilled /></el-icon></el-breadcrumb-item>
        <el-breadcrumb-item v-for="item in breadcrumbs" :key="item.path">
          <a @click.prevent="navigateTo(item.path)">{{ item.name }}</a>
        </el-breadcrumb-item>
      </el-breadcrumb>
      <div class="breadcrumb-actions">
        <el-button type="primary" @click="showUploadDialog = true"><el-icon><UploadFilled /></el-icon>上传文件</el-button>
        <el-button @click="handleNewFolder"><el-icon><FolderAdd /></el-icon>新建文件夹</el-button>
      </div>
    </div>
    <div class="toolbar">
      <div class="toolbar-left">
        <el-input v-model="searchText" placeholder="搜索文件..." :prefix-icon="Search" clearable style="width: 240px" />
      </div>
      <div class="toolbar-right">
        <el-select v-model="sortBy" style="width: 140px">
          <el-option label="按名称" value="name" /><el-option label="按大小" value="size" /><el-option label="按时间" value="time" />
        </el-select>
        <el-button-group>
          <el-button :type="viewMode === 'table' ? 'primary' : ''" @click="viewMode = 'table'"><el-icon><List /></el-icon></el-button>
          <el-button :type="viewMode === 'grid' ? 'primary' : ''" @click="viewMode = 'grid'"><el-icon><Grid /></el-icon></el-button>
        </el-button-group>
      </div>
    </div>
    <div v-if="viewMode === 'table'" class="file-table cs-card">
      <el-table :data="filteredFiles" style="width: 100%" :default-sort="{ prop: 'updatedAt', order: 'descending' }">
        <el-table-column prop="name" label="文件名" min-width="300" sortable>
          <template #default="{ row }">
            <div class="file-name-cell" @dblclick="handleOpen(row)">
              <el-icon :size="20" :color="getFileIconColor(row)"><component :is="getFileIcon(row)" /></el-icon>
              <span class="file-name-text">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="size" label="大小" width="120" sortable>
          <template #default="{ row }">{{ row.type === 'folder' ? '--' : formatSize(row.size) }}</template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="修改时间" width="180" sortable>
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small"><el-icon><Download /></el-icon>下载</el-button>
            <el-button link type="primary" size="small"><el-icon><EditPen /></el-icon>重命名</el-button>
            <el-popconfirm title="确定删除此文件?" @confirm="handleDelete(row.id)">
              <template #reference><el-button link type="danger" size="small"><el-icon><Delete /></el-icon>删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div v-else class="file-grid">
      <div v-for="file in filteredFiles" :key="file.id" class="file-grid-item cs-card" @dblclick="handleOpen(file)">
        <div class="grid-icon"><el-icon :size="48" :color="getFileIconColor(file)"><component :is="getFileIcon(file)" /></el-icon></div>
        <div class="grid-name" :title="file.name">{{ file.name }}</div>
        <div class="grid-meta">{{ file.type === 'folder' ? '文件夹' : formatSize(file.size) }}</div>
      </div>
    </div>
    <div class="pagination-bar">
      <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[20, 50, 100]" :total="filteredFiles.length" layout="total, sizes, prev, pager, next" background />
    </div>
    <el-dialog v-model="showUploadDialog" title="上传文件" width="520px" destroy-on-close>
      <el-upload drag multiple action="#" :auto-upload="false">
        <el-icon :size="48" class="upload-icon"><UploadFilled /></el-icon>
        <div class="el-upload__text">拖拽文件到此处，或 <em>点击上传</em></div>
        <template #tip><div class="el-upload__tip">支持任意文件类型，单文件最大 10GB</div></template>
      </el-upload>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { useFileStore } from '@/stores/file'
import { ElMessage } from 'element-plus'

const fileStore = useFileStore()
const searchText = ref('')
const sortBy = ref('time')
const viewMode = ref('table')
const currentPage = ref(1)
const pageSize = ref(20)
const showUploadDialog = ref(false)

const breadcrumbs = computed(() => {
  const parts = fileStore.currentPath.split('/').filter(Boolean)
  return parts.map((p, i) => ({ name: p, path: '/' + parts.slice(0, i + 1).join('/') + '/' }))
})

const filteredFiles = computed(() => {
  let list = [...fileStore.files]
  if (searchText.value) list = list.filter(f => f.name.toLowerCase().includes(searchText.value.toLowerCase()))
  list.sort((a, b) => { if (a.type === 'folder' && b.type !== 'folder') return -1; if (a.type !== 'folder' && b.type === 'folder') return 1; return 0 })
  return list
})

function navigateTo(path) { fileStore.navigateTo(path) }
function handleOpen(row) { if (row.type === 'folder') fileStore.navigateTo(row.path) }
function handleDelete(id) { fileStore.deleteFile(id); ElMessage.success('已删除') }
function handleNewFolder() { ElMessage.info('新建文件夹功能待接入接口') }

function getFileIcon(file) {
  const m = { folder:'Folder',pdf:'Document',image:'Picture',word:'Document',excel:'Grid',ppt:'Monitor',video:'VideoCamera',archive:'Files',text:'Notebook' }
  return m[file.type] || 'Document'
}
function getFileIconColor(file) {
  const m = { folder:'#faad14',pdf:'#ff4d4f',image:'#52c41a',word:'#1677ff',excel:'#52c41a',ppt:'#fa8c16',video:'#722ed1',archive:'#8c8c8c',text:'#595959' }
  return m[file.type] || '#8c8c8c'
}
function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024, s = ['B','KB','MB','GB','TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i]
}
function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.file-name-cell { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.file-name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-table { overflow: hidden; }
.file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
.file-grid-item { padding: 20px 16px 16px; text-align: center; cursor: pointer; transition: all var(--cs-transition); }
.file-grid-item:hover { transform: translateY(-2px); box-shadow: var(--cs-shadow); }
.grid-icon { margin-bottom: 12px; }
.grid-name { font-size: 13px; color: var(--cs-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; }
.grid-meta { font-size: 12px; color: var(--cs-text-tertiary); }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 20px; padding: 12px 0; }
.upload-icon { color: var(--cs-primary); margin-bottom: 8px; }
</style>