<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <h2 class="page-title"><el-icon><Delete /></el-icon>回收站</h2>
      <el-tag type="info">30 天后自动清理</el-tag>
    </div>
    <div class="cs-card table-card">
      <el-table :data="recycleFiles" v-loading="loading" style="width: 100%; min-width: 760px">
        <el-table-column prop="name" label="文件名" min-width="280">
          <template #default="{ row }">
            <div class="file-name-cell"><el-icon :size="18" :color="getFileIconColor(row)"><component :is="getFileIcon(row)" /></el-icon><span>{{ row.name }}</span></div>
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
              <el-button link type="primary" size="small" @click="handleRestore(row)">
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
      </el-table>
    </div>
    <div class="pagination-bar">
      <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[20, 50, 100]" :total="total" layout="total, sizes, prev, pager, next" background @current-change="loadTrash" @size-change="handleSizeChange" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { fileApi } from '@/api'
import { mapFileNode, formatSize, formatDate } from '@/utils/file'

const recycleFiles = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)

onMounted(() => loadTrash())

async function loadTrash() {
  loading.value = true
  try {
    const res = await fileApi.trash({ page: currentPage.value, size: pageSize.value })
    // 后端 FileNodeVO 暂无 deletedAt/expireAt 字段：删除时间用 updatedAt 兜底，过期时间待后端补充
    recycleFiles.value = (res.list || []).map(f => mapFileNode(f, { deletedAt: f.deletedAt || f.updatedAt, expireAt: f.expireAt || null }))
    total.value = res.total || 0
  } finally {
    loading.value = false
  }
}

function handleSizeChange() { currentPage.value = 1; loadTrash() }

function handleRestore(row) {
  fileApi.restore(row.id).then(res => {
    // 后端重名/原目录不存在时会自动改名或回根目录，返回还原后的节点
    ElMessage.success(res?.name ? `「${res.name}」已恢复` : '已恢复')
    loadTrash()
  }).catch(() => {})
}

function handlePermanentDelete(row) {
  fileApi.remove(row.id, 1).then(() => { ElMessage.success('已彻底删除'); loadTrash() }).catch(() => {})
}

function getFileIcon(file) { const m = { folder:'Folder',pdf:'Document',image:'Picture',text:'Notebook',archive:'Files' }; return m[file.type] || 'Document' }
function getFileIconColor(file) { const m = { folder:'#faad14',pdf:'#ff4d4f',image:'#52c41a',text:'#595959',archive:'#8c8c8c' }; return m[file.type] || '#8c8c8c' }
</script>

<style scoped>
.page-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 600; color: var(--cs-text-primary); margin: 0; }
.file-name-cell { display: flex; align-items: center; gap: 8px; }
.expire-text { color: var(--cs-warning); }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 20px; }
.table-card { overflow-x: auto; }
.op-actions { display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; }
.op-actions .el-button { margin-left: 0; }
.op-actions .el-button + .el-button { margin-left: 0; }
.op-actions .el-button .el-icon + span { margin-left: 4px; }
@media (max-width: 768px) {
  .breadcrumb-bar { flex-wrap: wrap; gap: 8px; }
  .pagination-bar { justify-content: center; }
}
</style>
