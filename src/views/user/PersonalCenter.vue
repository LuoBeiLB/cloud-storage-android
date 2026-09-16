<template>
  <div class="cs-page">
    <h2 class="page-title"><el-icon><User /></el-icon>个人中心</h2>
    <div class="profile-grid">
      <div class="cs-card quota-card">
        <div class="quota-header">
          <h3>存储空间</h3>
          <el-tag :type="quotaPercent > 80 ? 'danger' : quotaPercent > 60 ? 'warning' : 'success'" size="small">{{ quotaPercent }}%</el-tag>
        </div>
        <div class="quota-visual">
          <div class="quota-bar"><div class="quota-bar-fill" :style="{ width: quotaPercent + '%' }" :class="{ 'quota-danger': quotaPercent > 80 }"></div></div>
          <div class="quota-detail"><span>已用 {{ formatSize(userStore.quota.used) }}</span><span>总计 {{ formatSize(userStore.quota.total) }}</span></div>
        </div>
        <div class="quota-stats">
          <div class="quota-stat-item"><el-icon :size="20" color="var(--cs-primary)"><Document /></el-icon><div><div class="stat-num">{{ stats.totalFiles }}</div><div class="stat-label">文件数</div></div></div>
          <div class="quota-stat-item"><el-icon :size="20" color="var(--cs-success)"><Folder /></el-icon><div><div class="stat-num">{{ stats.totalDirs }}</div><div class="stat-label">文件夹</div></div></div>
          <div class="quota-stat-item"><el-icon :size="20" color="var(--cs-warning)"><Delete /></el-icon><div><div class="stat-num">{{ stats.recycleCount }}</div><div class="stat-label">回收站</div></div></div>
        </div>
      </div>
      <div class="cs-card password-card">
        <h3>修改密码</h3>
        <el-form :model="pwdForm" label-width="80px" style="margin-top: 20px">
          <el-form-item label="当前密码"><el-input v-model="pwdForm.oldPassword" type="password" show-password /></el-form-item>
          <el-form-item label="新密码"><el-input v-model="pwdForm.newPassword" type="password" show-password /></el-form-item>
          <el-form-item label="确认密码"><el-input v-model="pwdForm.confirmPassword" type="password" show-password /></el-form-item>
          <el-form-item><el-button type="primary" :loading="changing" @click="handleChangePassword">确认修改</el-button></el-form-item>
        </el-form>
      </div>
      <div class="cs-card info-card">
        <h3>账户信息</h3>
        <el-descriptions :column="1" border style="margin-top: 20px">
          <el-descriptions-item label="用户名">{{ userStore.username }}</el-descriptions-item>
          <el-descriptions-item label="角色"><el-tag :type="userStore.role === 'admin' ? 'danger' : ''">{{ userStore.role === 'admin' ? '管理员' : '普通用户' }}</el-tag></el-descriptions-item>
          <el-descriptions-item label="用户ID">{{ userStore.userId || '--' }}</el-descriptions-item>
          <el-descriptions-item label="上次登录">--</el-descriptions-item>
        </el-descriptions>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { statsApi, authApi } from '@/api'
import { formatSize } from '@/utils/file'

const userStore = useUserStore()
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const changing = ref(false)
const stats = ref({ totalFiles: 0, totalDirs: 0, recycleCount: 0 })

const quotaPercent = computed(() => userStore.quota.total > 0 ? Math.round(userStore.quota.used / userStore.quota.total * 100) : 0)

onMounted(() => {
  // 刷新配额（/auth/profile）
  userStore.loadProfile().catch(() => {})
  // 个人存储统计（/stats/overview）
  statsApi.overview().then(s => {
    stats.value = { totalFiles: s.totalFiles || 0, totalDirs: s.totalDirs || 0, recycleCount: s.recycleCount || 0 }
  }).catch(() => {})
})

async function handleChangePassword() {
  if (!pwdForm.value.oldPassword || !pwdForm.value.newPassword) { ElMessage.error('请填写当前密码和新密码'); return }
  if (pwdForm.value.newPassword !== pwdForm.value.confirmPassword) { ElMessage.error('两次密码输入不一致'); return }
  changing.value = true
  try {
    await authApi.changePassword({ oldPassword: pwdForm.value.oldPassword, newPassword: pwdForm.value.newPassword })
    ElMessage.success('密码修改成功')
    pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  } catch (e) {
    // 错误提示由拦截器统一弹出
  } finally {
    changing.value = false
  }
}
</script>

<style scoped>
.page-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 600; color: var(--cs-text-primary); margin: 0 0 24px 0; }
.profile-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
.quota-card { grid-column: 1 / -1; padding: 24px; }
.password-card, .info-card { padding: 24px; }
.password-card h3, .info-card h3, .quota-card h3 { font-size: 16px; font-weight: 600; color: var(--cs-text-primary); margin: 0; }
.quota-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.quota-bar { height: 12px; background: var(--cs-bg-hover); border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
.quota-bar-fill { height: 100%; background: linear-gradient(90deg, var(--cs-primary), var(--cs-primary-light)); border-radius: 6px; transition: width 0.3s ease; }
.quota-bar-fill.quota-danger { background: linear-gradient(90deg, var(--cs-danger), #ff7875); }
.quota-detail { display: flex; justify-content: space-between; font-size: 14px; color: var(--cs-text-secondary); margin-bottom: 24px; }
.quota-stats { display: flex; gap: 32px; padding-top: 20px; border-top: 1px solid var(--cs-border); }
.quota-stat-item { display: flex; align-items: center; gap: 12px; }
.stat-num { font-size: 20px; font-weight: 600; color: var(--cs-text-primary); }
.stat-label { font-size: 12px; color: var(--cs-text-tertiary); }
@media (max-width: 768px) {
  .profile-grid { grid-template-columns: 1fr; gap: 16px; }
  .quota-stats { gap: 16px; flex-wrap: wrap; }
  .quota-card, .password-card, .info-card { padding: 16px; }
  .quota-stat-item { gap: 8px; }
}
</style>
