<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <h2 class="page-title"><el-icon><Delete /></el-icon>回收站</h2>
      <el-tag type="info">30 天后自动清理</el-tag>
    </div>
    <div class="cs-card table-card">
      <el-table :data="recycleFiles" style="width: 100%; min-width: 720px">
        <el-table-column prop="name" label="文件名" min-width="280">
          <template #default="{ row }">
            <div class="file-name-cell"><el-icon :size="18" :color="getFileIconColor(row)"><component :is="getFileIcon(row)" /></el-icon><span>{{ row.name }}</span></div>
          </template>
        </el-table-column>
        <el-table-column prop="size" label="大小" width="120">
          <template #default="{ row }">{{ row.type === 'folder' ? '--' : formatSize(row.size) }}</template>
        </el-table-column>
        <el-table-column prop="deletedAt" label="删除时间" width="180">
          <template #default="{ row }">{{ formatDate(row.deletedAt) }}</template>
        </el-table-column>
        <el-table-column prop="expireAt" label="过期时间" width="180">
          <template #default="{ row }"><span class="expire-text">{{ formatDate(row.expireAt) }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleRestore(row)"><el-icon><RefreshRight /></el-icon>恢复</el-button>
            <el-popconfirm title="彻底删除后无法恢复，确定？" @confirm="handlePermanentDelete(row)">
              <template #reference><el-button link type="danger" size="small"><el-icon><Delete /></el-icon>彻底删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div class="pagination-bar">
      <el-pagination :total="recycleFiles.length" :page-size="20" layout="total, prev, pager, next" background />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { mockRecycleFiles } from '@/mock/files'

const recycleFiles = ref([...mockRecycleFiles])
function handleRestore(row) { const i = recycleFiles.value.findIndex(f => f.id === row.id); if (i > -1) recycleFiles.value.splice(i, 1); ElMessage.success('已恢复') }
function handlePermanentDelete(row) { const i = recycleFiles.value.findIndex(f => f.id === row.id); if (i > -1) recycleFiles.value.splice(i, 1); ElMessage.success('已彻底删除') }
function getFileIcon(file) { const m = { folder:'Folder',pdf:'Document',image:'Picture',text:'Notebook',archive:'Files' }; return m[file.type] || 'Document' }
function getFileIconColor(file) { const m = { folder:'#faad14',pdf:'#ff4d4f',image:'#52c41a',text:'#595959',archive:'#8c8c8c' }; return m[file.type] || '#8c8c8c' }
function formatSize(bytes) { if (!bytes) return '0 B'; const k=1024,s=['B','KB','MB','GB','TB']; const i=Math.floor(Math.log(bytes)/Math.log(k)); return parseFloat((bytes/Math.pow(k,i)).toFixed(1))+' '+s[i] }
function formatDate(iso) { const d=new Date(iso); return d.toLocaleDateString('zh-CN')+' '+d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) }
</script>

<style scoped>
.page-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 600; color: var(--cs-text-primary); margin: 0; }
.file-name-cell { display: flex; align-items: center; gap: 8px; }
.expire-text { color: var(--cs-warning); }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 20px; }
.table-card { overflow-x: auto; }
@media (max-width: 768px) {
  .breadcrumb-bar { flex-wrap: wrap; gap: 8px; }
  .pagination-bar { justify-content: center; }
}
</style>