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
          <el-option label="正常" value="active" /><el-option label="禁用" value="disabled" /><el-option label="锁定" value="locked" />
        </el-select>
      </div>
      <div class="toolbar-right"><el-tag>共 {{ filteredUsers.length }} 位用户</el-tag></div>
    </div>
    <div class="cs-card">
      <el-table :data="filteredUsers" style="width: 100%">
        <el-table-column prop="username" label="用户名" width="140" />
        <el-table-column prop="nickname" label="昵称" width="120" />
        <el-table-column prop="email" label="邮箱" min-width="200" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }"><el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="配额使用" width="200">
          <template #default="{ row }">
            <div class="quota-cell">
              <el-progress :percentage="Math.round(row.quotaUsed / row.quotaTotal * 100)" :stroke-width="6" :show-text="false" :color="row.quotaUsed / row.quotaTotal > 0.8 ? 'var(--cs-danger)' : 'var(--cs-primary)'" />
              <span class="quota-text">{{ formatSize(row.quotaUsed) }} / {{ formatSize(row.quotaTotal) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="lastLogin" label="最后登录" width="160">
          <template #default="{ row }">{{ formatDate(row.lastLogin) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small"><el-icon><Edit /></el-icon>编辑</el-button>
            <el-button link :type="row.status === 'disabled' ? 'success' : 'warning'" size="small" @click="handleToggleStatus(row)">
              <el-icon><component :is="row.status === 'disabled' ? 'CircleCheck' : 'CircleClose'" /></el-icon>{{ row.status === 'disabled' ? '启用' : '禁用' }}
            </el-button>
            <el-button link type="info" size="small"><el-icon><Key /></el-icon>重置密码</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <el-dialog v-model="showCreateDialog" title="创建用户" width="480px" destroy-on-close>
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="用户名" required><el-input v-model="createForm.username" placeholder="请输入用户名" /></el-form-item>
        <el-form-item label="初始密码">
          <el-input v-model="createForm.password" placeholder="留空则自动生成">
            <template #append><el-button @click="generatePassword">随机生成</el-button></template>
          </el-input>
        </el-form-item>
        <el-form-item label="配额(GB)"><el-input-number v-model="createForm.quota" :min="1" :max="100" :step="5" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="showCreateDialog = false">取消</el-button><el-button type="primary" @click="handleCreate">创建</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { mockUsers } from '@/mock/users'

const users = ref([...mockUsers])
const searchText = ref('')
const statusFilter = ref('')
const showCreateDialog = ref(false)
const createForm = ref({ username: '', password: '', quota: 20 })

const filteredUsers = computed(() => {
  let list = users.value
  if (searchText.value) list = list.filter(u => u.username.includes(searchText.value) || u.nickname.includes(searchText.value))
  if (statusFilter.value) list = list.filter(u => u.status === statusFilter.value)
  return list
})

function statusTagType(s) { return { active:'success',disabled:'danger',locked:'warning' }[s] || 'info' }
function statusLabel(s) { return { active:'正常',disabled:'禁用',locked:'锁定' }[s] || s }

function handleToggleStatus(row) {
  const action = row.status === 'disabled' ? '启用' : '禁用'
  ElMessageBox.confirm('确定' + action + '用户 "' + row.username + '" ？', '确认操作', { type: 'warning' }).then(() => { row.status = row.status === 'disabled' ? 'active' : 'disabled'; ElMessage.success('已' + action) }).catch(() => {})
}

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pwd = ''; for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  createForm.value.password = pwd
}

function handleCreate() {
  if (!createForm.value.username) { ElMessage.error('请输入用户名'); return }
  ElMessage.success('用户创建成功（Mock）'); showCreateDialog.value = false; createForm.value = { username: '', password: '', quota: 20 }
}

function formatSize(bytes) { if (!bytes) return '0 B'; const k=1024,s=['B','KB','MB','GB','TB']; const i=Math.floor(Math.log(bytes)/Math.log(k)); return parseFloat((bytes/Math.pow(k,i)).toFixed(1))+' '+s[i] }
function formatDate(iso) { const d=new Date(iso); return d.toLocaleDateString('zh-CN')+' '+d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) }
</script>

<style scoped>
.page-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 600; color: var(--cs-text-primary); margin: 0; }
.quota-cell { display: flex; flex-direction: column; gap: 4px; }
.quota-text { font-size: 12px; color: var(--cs-text-tertiary); }
</style>