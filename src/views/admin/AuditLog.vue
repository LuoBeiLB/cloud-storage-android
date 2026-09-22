<template>
  <div class="cs-page">
    <h2 class="page-title"><el-icon><Document /></el-icon>审计日志</h2>
    <div class="toolbar cs-card" style="padding: 16px 20px; margin-bottom: 20px;">
      <div class="filter-row">
        <el-input v-model="filters.username" placeholder="操作人名称" clearable style="width: 160px" :prefix-icon="User" />
        <el-select v-model="filters.action" placeholder="动作类型" clearable style="width: 160px">
          <el-option-group label="用户操作">
            <el-option label="登录" value="login" /><el-option label="登出" value="logout" /><el-option label="上传" value="upload" />
            <el-option label="下载" value="download" /><el-option label="删除" value="delete" /><el-option label="恢复" value="restore" />
            <el-option label="新建文件夹" value="mkdir" /><el-option label="重命名" value="rename" /><el-option label="移动" value="move" />
          </el-option-group>
          <el-option-group label="管理操作">
            <el-option label="用户管理操作" value="user_manage" />
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
                <el-descriptions-item label="操作人">{{ userMap[row.userId] ? userMap[row.userId] + '（ID ' + row.userId + '）' : 'ID ' + row.userId }}</el-descriptions-item>
                <el-descriptions-item label="动作">{{ actionLabel(row.action) }}</el-descriptions-item>
                <el-descriptions-item label="目标">{{ targetLabel(row) }}</el-descriptions-item>
                <el-descriptions-item label="IP地址">{{ row.ip || '--' }}</el-descriptions-item>
                <el-descriptions-item label="时间">{{ formatDate(row.createdAt) }}</el-descriptions-item>
                <el-descriptions-item label="详情" :span="2"><pre class="detail-pre">{{ detailText(row) }}</pre></el-descriptions-item>
              </el-descriptions>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="userId" label="操作人" width="120">
          <template #default="{ row }"><span class="user-cell">{{ userMap[row.userId] || ('用户 ' + row.userId) }}</span></template>
        </el-table-column>
        <el-table-column prop="action" label="动作" width="140">
          <template #default="{ row }"><el-tag size="small" :type="actionTagType(row.action)">{{ actionLabel(row.action) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="target" label="目标" min-width="200">
          <template #default="{ row }">{{ targetLabel(row) }}</template>
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
import { auditApi, adminApi } from '@/api'
import { formatDate } from '@/utils/file'

const logs = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const filters = ref({ username: '', action: '', dateRange: null })
// 用户ID → 用户名映射（审计日志只带 userId，用用户列表补全显示）
const userMap = ref({})
// 用户名 → ID 反向映射（筛选用）
const nameToIdMap = ref({})

onMounted(() => {
  loadLogs()
  adminApi.listUsers({ page: 1, size: 100 }).then(res => {
    const m = {}, rev = {}
    ;(res.content || []).forEach(u => { m[u.id] = u.username; rev[u.username] = u.id })
    userMap.value = m
    nameToIdMap.value = rev
  }).catch(() => {})
})

async function loadLogs() {
  loading.value = true
  try {
    const params = { page: currentPage.value, size: pageSize.value }
    if (filters.value.username) {
      const uid = nameToIdMap.value[filters.value.username]
      if (uid) params.userId = uid
      else { params.userId = -1 } // 用户不存在，让后端返回空结果
    }
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
function handleReset() { filters.value = { username: '', action: '', dateRange: null }; currentPage.value = 1; loadLogs() }

// 后端实际动作值为小写（login / mkdir / user_manage 等），未收录的显示原文
const actionMap = { login: '登录', logout: '登出', upload: '上传', download: '下载', delete: '删除', restore: '恢复', mkdir: '新建文件夹', create_folder: '新建文件夹', rename: '重命名', move: '移动', share: '分享', user_manage: '用户管理' }
function actionLabel(a) { return actionMap[String(a || '').toLowerCase()] || a }
function actionTagType(a) { const k = String(a || '').toLowerCase(); if (!k) return 'info'; if (k === 'user_manage') return 'warning'; if (['delete', 'logout'].includes(k)) return 'info'; if (k === 'login') return 'success'; return '' }
// detail 是 JSON 字符串，格式化后展示；target 优先取 detail 里的 name（如目录名）
function detailText(row) {
  if (!row.detail) return '--'
  try { return JSON.stringify(JSON.parse(row.detail), null, 2) } catch { return row.detail }
}
function targetLabel(row) {
  if (row.target == null || row.target === '') return '--'
  try { const o = JSON.parse(row.detail); if (o && o.name) return o.name } catch {}
  return row.target
}
</script>

<style scoped>
.page-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 600; color: var(--cs-text-primary); margin: 0 0 24px 0; }
.expand-detail { padding: 16px 24px; }
.expand-detail h4 { font-size: 14px; font-weight: 600; color: var(--cs-text-primary); margin: 0 0 12px 0; }
.user-cell { color: var(--cs-text-secondary); }
.detail-pre { white-space: pre-wrap; word-break: break-all; margin: 0; font-family: inherit; font-size: 13px; color: var(--cs-text-secondary); }
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
