<template>
  <div class="page">
    <!-- 用户卡片 -->
    <div class="profile-card">
      <div class="avatar-letter">{{ avatarLetter }}</div>
      <div class="uinfo">
        <div class="uname">{{ userStore.username || '未登录' }}</div>
        <div class="uid">ID: {{ userStore.userId || '--' }}</div>
      </div>
    </div>

    <!-- 容量 -->
    <van-cell-group inset class="group">
      <van-cell title="存储空间">
        <template #label>
          <div class="quota-wrap">
            <van-progress :percentage="quotaPercent" :color="quotaPercent > 85 ? '#ee0a24' : '#1989fa'" stroke-width="8" />
            <div class="quota-text">{{ formatSize(userStore.quota.used) }} / {{ formatSize(userStore.quota.total) }}</div>
          </div>
        </template>
      </van-cell>
    </van-cell-group>

    <!-- 设置 -->
    <van-cell-group inset class="group">
      <van-cell title="修改密码" is-link @click="showPwd = true" icon-name="lock" />
      <van-cell title="退出登录" is-link @click="onLogout" icon-name="cross" />
    </van-cell-group>

    <p class="tip">退出登录后，本地登录状态将被清除</p>

    <!-- 修改密码 -->
    <van-dialog v-model:show="showPwd" title="修改密码" show-cancel-button :before-close="onChangePwd" class="pwd-dialog">
      <van-field v-model="oldPwd" type="password" placeholder="当前密码" style="margin: 12px 16px 0;" />
      <van-field v-model="newPwd" type="password" placeholder="新密码（至少6位）" style="margin: 8px 16px 0;" />
      <van-field v-model="confirmPwd" type="password" placeholder="确认新密码" style="margin: 8px 16px 16px;" />
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import { useUserStore } from '@/stores/user'
import { formatSize } from '@/utils/file'

const router = useRouter()
const userStore = useUserStore()
const avatarLetter = computed(() => (userStore.username || '云').slice(0, 1).toUpperCase())

const quotaPercent = computed(() => {
  if (!userStore.quota.total) return 0
  return Math.min(100, Math.round(userStore.quota.used / userStore.quota.total * 100))
})

onMounted(() => {
  userStore.loadProfile().catch(() => {})
})

function onLogout() {
  showConfirmDialog({ title: '退出登录？', message: '退出后需要重新输入账号密码。' })
    .then(() => { userStore.logout(); router.replace('/login') })
    .catch(() => {})
}

const showPwd = ref(false)
const oldPwd = ref('')
const newPwd = ref('')
const confirmPwd = ref('')

function onChangPwd(action) {
  if (action !== 'confirm') { resetPwd(); return true }
  if (!oldPwd.value) { showToast('请输入当前密码'); return false }
  if (newPwd.value.length < 6) { showToast('新密码至少6位'); return false }
  if (newPwd.value !== confirmPwd.value) { showToast('两次输入的新密码不一致'); return false }
  return userStore.changePassword({ oldPassword: oldPwd.value, newPassword: newPwd.value })
    .then(() => { showSuccessToast('密码修改成功'); resetPwd(); return true })
    .catch(() => false)
}
function resetPwd() { oldPwd.value = ''; newPwd.value = ''; confirmPwd.value = '' }
</script>

<style scoped>
.page { height: 100%; overflow-y: auto; }
.profile-card {
  margin: calc(14px + var(--safe-top)) 12px 0; padding: 18px; border-radius: 14px;
  background: linear-gradient(135deg, #3ba0ff, #1989fa);
  display: flex; align-items: center; gap: 14px; color: #fff;
}
.avatar-letter { width: 60px; height: 60px; border-radius: 50%; background: rgba(255,255,255,.25); border: 2px solid rgba(255,255,255,.7); color: #fff; font-size: 26px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.uname { font-size: 19px; font-weight: 600; }
.uid { font-size: 12px; opacity: 0.85; margin-top: 4px; }
.group { margin-top: 14px; }
.quota-wrap { margin-top: 10px; }
.quota-text { font-size: 12px; color: #969799; margin-top: 8px; }
.tip { text-align: center; font-size: 12px; color: #c8c9cc; margin: 18px 0; }
</style>
