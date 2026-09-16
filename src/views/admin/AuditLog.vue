<template>
  <div class="cs-page">
    <h2 class="page-title"><el-icon><Document /></el-icon>审计日志</h2>
    <div class="toolbar cs-card" style="padding: 16px 20px; margin-bottom: 20px;">
      <div class="filter-row">
        <el-input v-model="filters.userId" placeholder="用户ID" clearable style="width: 140px" :prefix-icon="User" @input="v => filters.userId = v.replace(/\D/g, '')" />
        <el-select v-model="filters.action" placeholder="动作类型" clearable style="width: 160px">
          <el-option-group label="用户操作">
            <el-option label="登录" value="LOGIN" /><el-option label="登出" value="LOGOUT" /><el-option label="上传" value="UPLOAD" />
            <el-option label="下载" value="DOWNLOAD" /><el-option label="删除" value="DELETE" /><el-option label="恢复" value="RESTORE" />
            <el-option label="新建文件夹" value="CREATE_FOLDER" /><el-option label="重命名" value="RENAME" /><el-option label="移动" value="MOVE" />
          </el-option-group>
          <el-option-group label="管理操作">
            <el-option label="创建用户" value="ADMIN_CREATE_USER" /><el-option label="禁用用户" value="ADMIN_DISABLE_USER" />
            <el-option label="调整配额" value="ADMIN_UPDATE_QUOTA" /><el-option label="重置密码" value="ADMIN_RESET_PASSWORD" />
          </el-option-group>
        </el-select>
        <el-date-picker v-model="filters.dateRange" type="daterange" range-separator="-" start-placeholder="开始日期" end-placeholder="结束日期" style="width: 260px" />
        <el-button type="primary" @click="handleSearch"><el-icon><Search /></el-icon>查询</el-button>
        <el-button @click="handleReset"><el-icon><Refresh /></el-icon>重置</el-button>
      </div>
    </div>
    <div class="cs-card table-card">
      <el-table :data="logs" v-loading="loading" style="width: 100%; min-width: 820px">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-detail">
              <h4>详细信息</h4>
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="日志ID">{{ row.id }}</el-descriptions-item>
                <el-descriptions-item label="操作人ID">{{ row.userId }}</el-descriptions-item>
                <el-descriptions-item label="动作">{{ actionLabel(row.action) }}</el-descriptions-item>
                <el-descriptions-item label="目标">{{ row.target || '--' }}</el-descriptions-item>
                <el-descriptions-item label="IP地址">{{ row.ip || '--' }}</el-descriptions-item>
                <el-descriptions-item label="时间">{{ formatDate(row.createdAt) }}</el-descriptions-item>
                <el-descriptions-item label="详情" :span="2">{{ row.detail || '--' }}</el-descriptions-item>
              </el-descriptions>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="userId" label="操作人" width="120">
          <template #default="{ row }"><span class="user-cell">用户 {{ row.userId }}</span></template>
        </el-table-column>
        <el-table-column prop="action" label="动作" width="140">
          <template #default="{ row }"><el-tag size="small" :type="actionTagType(row.action)">{{ actionLabel(row.action) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="target" label="目标" min-width="200">
          <template #default="{ row }">{{ row.target || '--' }}</template>
        </el-table-column>
        <el-table-column prop="ip" label="IP" width="140">
          <template #default="{ row }">{{ row.ip || '--' }}</template>
        </el-table-column>
      </el-table>
    </div>
    <div class="pagination-bar">
      <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[20, 50, 100]" :total="total" layout="total, sizes, prev, pager, next" background @current-change="loadLogs" @size-change="handleSizeChange" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Search, User } from '@element-plus/icons-vue'
import { auditApi } from '@/api'
import { formatDate } from '@/utils/file'

const logs = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const filters = ref({ userId: '', action: '', dateRange: null })

onMounted(() => loadLogs())

async function loadLogs() {
  loading.value = true
  try {
    const params = { page: currentPage.value, size: pageSize.value }
    const uid = parseInt(filters.value.userId)
    if (!isNaN(uid) && uid > 0) params.userId = uid
    if (filters.value.action) params.action = filters.value.action
    if (filters.value.dateRange && filters.value.dateRange.length === 2) {
      const [s, e] = filters.value.dateRange
      const start = new Date(s); start.setHours(0, 0, 0, 0)
      const end = new Date(e); end.setHours(23, 59, 59, 999)
      params.start = start.toISOString()
      params.end = end.toISOString()
    }
    const res = await auditApi.query(params)
    logs.value = res.list || []
    total.value = res.total || 0
  } finally {
    loading.value = false
  }
}

function handleSearch() { currentPage.value = 1; loadLogs() }
function handleSizeChange() { currentPage.value = 1; loadLogs() }
function handleReset() { filters.value = { userId: '', action: '', dateRange: null }; currentPage.value = 1; loadLogs() }

const actionMap = { LOGIN:'登录',LOGOUT:'登出',UPLOAD:'上传',DOWNLOAD:'下载',DELETE:'删除',RESTORE:'恢复',CREATE_FOLDER:'新建文件夹',RENAME:'重命名',MOVE:'移动',SHARE:'分享',ADMIN_CREATE_USER:'创建用户',ADMIN_DISABLE_USER:'禁用用户',ADMIN_UPDATE_QUOTA:'调整配额',ADMIN_RESET_PASSWORD:'重置密码' }
function actionLabel(a) { return actionMap[a] || a }
function actionTagType(a) { if (!a) return 'info'; if (a.startsWith('ADMIN_')) return 'warning'; if (['DELETE','LOGOUT'].includes(a)) return 'info'; return '' }
</script>

<style scoped>
.page-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 600; color: var(--cs-text-primary); margin: 0 0 24px 0; }
.expand-detail { padding: 16px 24px; }
.expand-detail h4 { font-size: 14px; font-weight: 600; color: var(--cs-text-primary); margin: 0 0 12px 0; }
.user-cell { color: var(--cs-text-secondary); }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 20px; }
.table-card { overflow-x: auto; }
.filter-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.filter-row .el-input, .filter-row .el-select, .filter-row .el-date-editor { flex-shrink: 0; }
@media (max-width: 768px) {
  .filter-row .el-input, .filter-row .el-select, .filter-row .el-date-editor { width: 100% !important; flex: 1 1 100%; }
  .filter-row .el-button { flex: 1 1 calc(50% - 8px); margin-left: 0; }
  .filter-row .el-button + .el-button { margin-left: 0; }
  .expand-detail { padding: 12px 16px; }
  .pagination-bar { justify-content: center; }
}
</style>
