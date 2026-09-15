<template>
  <div class="cs-page">
    <h2 class="page-title"><el-icon><Document /></el-icon>审计日志</h2>
    <div class="toolbar cs-card" style="padding: 16px 20px; margin-bottom: 20px;">
      <div class="filter-row">
        <el-input v-model="filters.username" placeholder="操作人" clearable style="width: 160px" :prefix-icon="User" />
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
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 120px">
          <el-option label="成功" value="success" /><el-option label="失败" value="failed" />
        </el-select>
        <el-button type="primary" @click="handleSearch"><el-icon><Search /></el-icon>查询</el-button>
        <el-button @click="handleReset"><el-icon><Refresh /></el-icon>重置</el-button>
      </div>
    </div>
    <div class="cs-card">
      <el-table :data="pagedLogs" style="width: 100%">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-detail">
              <h4>详细信息</h4>
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="日志ID">{{ row.id }}</el-descriptions-item>
                <el-descriptions-item label="操作人">{{ row.username }}</el-descriptions-item>
                <el-descriptions-item label="动作">{{ actionLabel(row.action) }}</el-descriptions-item>
                <el-descriptions-item label="目标">{{ row.target || '--' }}</el-descriptions-item>
                <el-descriptions-item label="IP地址">{{ row.ip }}</el-descriptions-item>
                <el-descriptions-item label="状态"><el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">{{ row.status === 'success' ? '成功' : '失败' }}</el-tag></el-descriptions-item>
                <el-descriptions-item label="耗时">{{ row.detail.duration }}ms</el-descriptions-item>
                <el-descriptions-item label="User-Agent">{{ row.detail.userAgent }}</el-descriptions-item>
              </el-descriptions>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="username" label="操作人" width="120" />
        <el-table-column prop="action" label="动作" width="140">
          <template #default="{ row }"><el-tag size="small" :type="actionTagType(row.action)">{{ actionLabel(row.action) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="target" label="目标" min-width="200">
          <template #default="{ row }">{{ row.target || '--' }}</template>
        </el-table-column>
        <el-table-column prop="ip" label="IP" width="140" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-icon :size="16" :color="row.status === 'success' ? 'var(--cs-success)' : 'var(--cs-danger)'">
              <CircleCheck v-if="row.status === 'success'" /><CircleClose v-else />
            </el-icon>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div class="pagination-bar">
      <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[20, 50, 100]" :total="filteredLogs.length" layout="total, sizes, prev, pager, next" background />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Search, User } from '@element-plus/icons-vue'
import { mockLogs } from '@/mock/logs'

const logs = ref([...mockLogs])
const currentPage = ref(1)
const pageSize = ref(20)
const filters = ref({ username: '', action: '', dateRange: null, status: '' })

const filteredLogs = computed(() => {
  let list = logs.value
  if (filters.value.username) list = list.filter(l => l.username.includes(filters.value.username))
  if (filters.value.action) list = list.filter(l => l.action === filters.value.action)
  if (filters.value.status) list = list.filter(l => l.status === filters.value.status)
  if (filters.value.dateRange && filters.value.dateRange.length === 2) {
    const start = filters.value.dateRange[0].getTime(), end = filters.value.dateRange[1].getTime() + 86400000
    list = list.filter(l => { const t = new Date(l.createdAt).getTime(); return t >= start && t < end })
  }
  return list
})

const pagedLogs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredLogs.value.slice(start, start + pageSize.value)
})

const actionMap = { LOGIN:'登录',LOGOUT:'登出',UPLOAD:'上传',DOWNLOAD:'下载',DELETE:'删除',RESTORE:'恢复',CREATE_FOLDER:'新建文件夹',RENAME:'重命名',MOVE:'移动',SHARE:'分享',ADMIN_CREATE_USER:'创建用户',ADMIN_DISABLE_USER:'禁用用户',ADMIN_UPDATE_QUOTA:'调整配额',ADMIN_RESET_PASSWORD:'重置密码' }
function actionLabel(a) { return actionMap[a] || a }
function actionTagType(a) { if (a.startsWith('ADMIN_')) return 'warning'; if (['DELETE','LOGOUT'].includes(a)) return 'info'; return '' }
function handleSearch() { currentPage.value = 1 }
function handleReset() { filters.value = { username: '', action: '', dateRange: null, status: '' }; currentPage.value = 1 }
function formatDate(iso) { const d = new Date(iso); return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }
</script>

<style scoped>
.page-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 600; color: var(--cs-text-primary); margin: 0 0 24px 0; }
.filter-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.expand-detail { padding: 16px 24px; }
.expand-detail h4 { font-size: 14px; font-weight: 600; color: var(--cs-text-primary); margin: 0 0 12px 0; }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 20px; }
</style>