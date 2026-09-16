<template>
  <el-dialog
    :model-value="userStore.mustChangePwd"
    title="修改初始密码"
    width="420px"
    :show-close="false"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    append-to-body
    align-center
  >
    <div class="force-pwd-tip">
      <el-icon :size="18" color="#e6a23c"><WarningFilled /></el-icon>
      <span>当前账号正在使用初始密码，为保障账户安全，请先设置新密码后再使用系统功能。</span>
    </div>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" @submit.prevent>
      <el-form-item label="当前密码" prop="oldPassword">
        <el-input v-model="form.oldPassword" type="password" show-password placeholder="请输入当前密码" autocomplete="off" />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input v-model="form.newPassword" type="password" show-password placeholder="至少 6 位" autocomplete="off" />
      </el-form-item>
      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input v-model="form.confirmPassword" type="password" show-password placeholder="请再次输入新密码" autocomplete="off" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button type="primary" :loading="submitting" class="force-pwd-submit" @click="handleSubmit">确认修改并重新登录</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { authApi } from '@/api'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref()
const submitting = ref(false)
const form = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })

const rules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码至少 6 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: (rule, value, callback) => value === form.value.newPassword ? callback() : callback(new Error('两次输入的密码不一致')), trigger: 'blur' }
  ]
}

async function handleSubmit() {
  try { await formRef.value.validate() } catch { return }
  if (form.value.newPassword === form.value.oldPassword) {
    ElMessage.warning('新密码不能与当前密码相同')
    return
  }
  submitting.value = true
  try {
    await authApi.changePassword({ oldPassword: form.value.oldPassword, newPassword: form.value.newPassword })
    ElMessage.success('密码修改成功，请使用新密码重新登录')
    userStore.logout()
    router.replace('/login')
  } catch (e) {
    // 错误提示由请求拦截器统一弹出
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.force-pwd-tip { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; margin-bottom: 20px; background: var(--cs-bg-hover, #f5f7fa); border-radius: 6px; font-size: 13px; line-height: 1.6; color: var(--cs-text-secondary, #909399); }
.force-pwd-tip .el-icon { margin-top: 2px; flex-shrink: 0; }
.force-pwd-submit { width: 100%; }
</style>
