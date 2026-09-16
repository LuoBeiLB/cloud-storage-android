<template>
  <div class="cs-page">
    <div class="breadcrumb-bar">
      <h2 class="page-title"><el-icon><UserFilled /></el-icon>用户管理</h2>
      <el-button type="primary" @click="showCreateDialog = true"><el-icon><Plus /></el-icon>创建用户</el-button>
    </div>
    <div class="toolbar">
      <div class="toolbar-left">
        <el-input v-model="searchText" placeholder="搜索用户名..." :prefix-icon="Search" clearable style="width: 220px" />
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 140px">
          <el-option label="正常" value="active" /><el-option label="禁用" value="disabled" />
        </el-select>
      </div>
      <div class="toolbar-right"><el-tag>共 {{ total }} 位用户</el-tag></div>
    </div>
    <div class="cs-card table-card">
      <el-table :data="users" v-loading="loading" style="width: 100%; min-width: 900px">
        <el-table-column prop="username" label="用户名" min-width="140" />
        <el-table-column prop="role" label="角色" width="110">
          <template #default="{ row }"><el-tag :type="roleTagType(row.role)" size="small">{{ roleLabel(row.role) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }"><el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="需改密" width="100">
          <template #default="{ row }"><el-tag :type="row.mustChangePassword ? 'warning' : 'success'" size="small">{{ row.mustChangePassword ? '是' : '否' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="配额使用" width="200">
          <template #default="{ row }">
            <div class="quota-cell">
              <el-progress :percentage="quotaPercent(row)" :stroke-width="6" :show-text="false" :color="quotaPercent(row) > 80 ? 'var(--cs-danger)' : 'var(--cs-primary)'" />
              <span class="quota-text">{{ formatSize(row.usedBytes) }} / {{ formatSize(row.quotaBytes) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <div class="op-actions">
              <el-button link type="primary" size="small" @click="handleEditQuota(row)"><el-icon><Edit /></el-icon>编辑</el-button>
              <el-button link :type="isDisabled(row) ? 'success' : 'warning'" size="small" @click="handleToggleStatus(row)">
                <el-icon><component :is="isDisabled(row) ? 'CircleCheck' : 'CircleClose'" /></el-icon>{{ isDisabled(row) ? '启用' : '禁用' }}
              </el-button>
              <el-button link type="info" size="small" @click="handleResetPassword(row)"><el-icon><Key /></el-icon>重置密码</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div class="pagination-bar">
      <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[20, 50, 100]" :total="total" layout="total, sizes, prev, pager, next" background @current-change="loadUsers" @size-change="handleSizeChange" />
    </div>
    <el-dialog v-model="showCreateDialog" title="创建用户" width="min(480px, 92vw)" destroy-on-close>
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="用户名" required><el-input v-model="createForm.username" placeholder="请输入用户名" /></el-form-item>
        <el-form-item label="初始密码">
          <el-input v-model="createForm.password" placeholder="留空则自动生成">
            <template #append><el-button @click="generatePassword">随机生成</el-button></template>
          </el-input>
        </el-form-item>
        <el-form-item label="配额(GB)"><el-input-number v-model="createForm.quota" :min="1" :max="100" :step="5" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="createForm.role" style="width: 100%">
            <el-option label="普通用户" value="user" /><el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="showCreateDialog = false">取消</el-button><el-button type="primary" :loading="creating" @click="handleCreate">创建</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminApi } from '@/api'
import { formatSize, formatDate } from '@/utils/file'

const users = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const searchText = ref('')
const statusFilter = ref('')
const showCreateDialog = ref(false)
const creating = ref(false)
const createForm = ref({ username: '', password: '', quota: 20, role: 'user' })

// 搜索防抖（后端 keyword 服务端搜索）
let searchTimer = null
watch(searchText, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { currentPage.value = 1; loadUsers() }, 400)
})
watch(statusFilter, () => { currentPage.value = 1; loadUsers() })

onMounted(() => loadUsers())

async function loadUsers() {
  loading.value = true
  try {
    const params = { page: currentPage.value, size: pageSize.value }
    if (searchText.value.trim()) params.keyword = searchText.value.trim()
    if (statusFilter.value) params.status = statusFilter.value
    const res = await adminApi.listUsers(params)
    // Spring 标准分页结构 { content, totalElements, ... }
    users.value = res.content || []
    total.value = res.totalElements || 0
  } finally {
    loading.value = false
  }
}

function handleSizeChange() { currentPage.value = 1; loadUsers() }

const normStatus = s => (s || '').toLowerCase()
const isDisabled = row => normStatus(row.status) === 'disabled' || row.disabled === true
function quotaPercent(row) { return row.quotaBytes > 0 ? Math.round((row.usedBytes || 0) / row.quotaBytes * 100) : 0 }
function statusTagType(s) { return { active: 'success', disabled: 'danger', locked: 'warning' }[normStatus(s)] || 'info' }
function statusLabel(s) { return { active: '正常', disabled: '禁用', locked: '锁定' }[normStatus(s)] || s || '--' }
function roleLabel(r) { return r === 'admin' ? '管理员' : '普通用户' }
function roleTagType(r) { return r === 'admin' ? 'danger' : 'info' }

function handleToggleStatus(row) {
  const next = isDisabled(row) ? 'active' : 'disabled'
  const action = next === 'disabled' ? '禁用' : '启用'
  ElMessageBox.confirm(`确定${action}用户 "${row.username}" ？`, '确认操作', { type: 'warning' })
    .then(() => {
      adminApi.updateUser(row.id, { status: next }).then(() => { ElMessage.success('已' + action); loadUsers() }).catch(() => {})
    }).catch(() => {})
}

function handleEditQuota(row) {
  const curGB = Math.round((row.quotaBytes || 0) / 1024 / 1024 / 1024)
  ElMessageBox.prompt('请输入新配额（GB）', '调整配额', { inputValue: String(curGB), confirmButtonText: '确定', cancelButtonText: '取消', inputPattern: /^\d+(\.\d+)?$/, inputErrorMessage: '请输入有效数字' })
    .then(({ value }) => {
      adminApi.updateUser(row.id, { quotaBytes: Math.round(parseFloat(value) * 1024 * 1024 * 1024) })
        .then(() => { ElMessage.success('配额已更新'); loadUsers() }).catch(() => {})
    }).catch(() => {})
}

function handleResetPassword(row) {
  ElMessageBox.confirm(`确定重置用户 "${row.username}" 的密码？`, '确认操作', { type: 'warning' })
    .then(() => {
      adminApi.resetPassword(row.id).then(res => {
        const pwd = res?.password || res?.newPassword || ''
        loadUsers()
        if (pwd) ElMessageBox.alert(`新密码：${pwd}`, '重置成功', { confirmButtonText: '我已记下' })
        else ElMessage.success('密码已重置')
      }).catch(() => {})
    }).catch(() => {})
}

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pwd = ''; for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  createForm.value.password = pwd
}

async function handleCreate() {
  if (!createForm.value.username.trim()) { ElMessage.error('请输入用户名'); return }
  creating.value = true
  try {
    const data = {
      username: createForm.value.username.trim(),
      quotaBytes: Math.round(createForm.value.quota * 1024 * 1024 * 1024),
      role: createForm.value.role || 'user'
    }
    if (createForm.value.password) data.initialPassword = createForm.value.password
    const res = await adminApi.createUser(data)
    showCreateDialog.value = false
    createForm.value = { username: '', password: '', quota: 20, role: 'user' }
    const pwd = res?.password || res?.initialPassword || ''
    if (pwd) ElMessageBox.alert(`初始密码：${pwd}`, '用户创建成功', { confirmButtonText: '我已记下' })
    else ElMessage.success('用户创建成功')
    loadUsers()
  } catch (e) {
    // 错误提示由拦截器统一弹出
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.page-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 600; color: var(--cs-text-primary); margin: 0; }
.quota-cell { display: flex; flex-direction: column; gap: 4px; }
.quota-text { font-size: 12px; color: var(--cs-text-tertiary); }
.table-card { overflow-x: auto; }
.op-actions { display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; }
.op-actions .el-button { margin-left: 0; }
.op-actions .el-button + .el-button { margin-left: 0; }
.op-actions .el-button .el-icon + span { margin-left: 4px; }
.toolbar-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 20px; }
@media (max-width: 768px) {
  .breadcrumb-bar { flex-wrap: wrap; gap: 12px; }
  .toolbar { gap: 10px; }
  .toolbar-left { flex: 1 1 100%; }
  .toolbar-left .el-input, .toolbar-left .el-select { width: 100% !important; }
  .pagination-bar { justify-content: center; }
}
</style>
