<template>
  <div class="login-page">
    <div class="login-bg">
      <div class="bg-orb orb-1"></div>
      <div class="bg-orb orb-2"></div>
      <div class="bg-orb orb-3"></div>
    </div>
    <div class="login-container">
      <div class="login-brand">
        <div class="brand-icon"><el-icon :size="48" color="#fff"><Coin /></el-icon></div>
        <h1 class="brand-title">CloudVault</h1>
        <p class="brand-desc">私有云存储平台</p>
        <div class="brand-features">
          <div class="feature-item"><el-icon :size="20"><UploadFilled /></el-icon><span>分片上传 / 秒传 / 断点续传</span></div>
          <div class="feature-item"><el-icon :size="20"><Lock /></el-icon><span>数据本地存储 / 安全可控</span></div>
          <div class="feature-item"><el-icon :size="20"><Monitor /></el-icon><span>200人起步 / 可扩展至1000+</span></div>
        </div>
      </div>
      <div class="login-form-wrapper">
        <div class="portal-switch">
          <el-radio-group v-model="portal" size="large">
            <el-radio-button value="user"><el-icon><User /></el-icon><span>用户端</span></el-radio-button>
            <el-radio-button value="admin"><el-icon><UserFilled /></el-icon><span>管理端</span></el-radio-button>
          </el-radio-group>
        </div>
        <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="handleLogin">
          <el-form-item prop="username">
            <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" />
          </el-form-item>
          <el-form-item prop="password">
            <el-input v-model="form.password" type="password" placeholder="密码" :prefix-icon="Lock" show-password @keyup.enter="handleLogin" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" class="login-btn" @click="handleLogin">登 录</el-button>
          </el-form-item>
        </el-form>
        <div class="login-footer"><span class="footer-text">内网访问 / 数据安全</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { mockLogin } from '@/api/mock'

const router = useRouter()
const userStore = useUserStore()
const portal = ref('user')
const loading = ref(false)
const formRef = ref(null)
const form = ref({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const res = await mockLogin(form.value.username, form.value.password, portal.value)
    userStore.login(res.data)
    ElMessage.success('登录成功')
    router.push(portal.value === 'admin' ? '/admin/dashboard' : '/files')
  } catch (e) {
    ElMessage.error('登录失败，请重试')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--cs-bg-page); position: relative; overflow: hidden; }
.login-bg { position: absolute; inset: 0; pointer-events: none; }
.bg-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.15; }
[data-theme="dark"] .bg-orb { opacity: 0.08; }
.orb-1 { width: 400px; height: 400px; background: #1677ff; top: -100px; right: -50px; }
.orb-2 { width: 300px; height: 300px; background: #764ba2; bottom: -80px; left: -30px; }
.orb-3 { width: 200px; height: 200px; background: #4facfe; top: 50%; left: 40%; }
.login-container { display: flex; width: 860px; min-height: 480px; background: var(--cs-bg-container); border-radius: var(--cs-radius-lg); box-shadow: var(--cs-shadow-lg); overflow: hidden; position: relative; z-index: 1; border: 1px solid var(--cs-border); }
.login-brand { width: 380px; background: linear-gradient(135deg, #1677ff 0%, #4096ff 50%, #764ba2 100%); padding: 48px 36px; display: flex; flex-direction: column; justify-content: center; color: #fff; flex-shrink: 0; }
[data-theme="dark"] .login-brand { background: linear-gradient(135deg, #0d1117 0%, #161b22 50%, #1c2128 100%); border-right: 1px solid var(--cs-border); }
.brand-icon { width: 72px; height: 72px; background: rgba(255,255,255,0.15); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; backdrop-filter: blur(10px); }
[data-theme="dark"] .brand-icon { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); }
.brand-title { font-size: 28px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.5px; }
.brand-desc { font-size: 14px; opacity: 0.85; margin-bottom: 36px; }
.brand-features { display: flex; flex-direction: column; gap: 16px; }
.feature-item { display: flex; align-items: center; gap: 10px; font-size: 13px; opacity: 0.9; }
.login-form-wrapper { flex: 1; padding: 48px 40px; display: flex; flex-direction: column; justify-content: center; }
.portal-switch { display: flex; justify-content: center; margin-bottom: 32px; }
.portal-switch .el-radio-button__inner { display: flex; align-items: center; gap: 6px; }
.login-btn { width: 100%; height: 44px; font-size: 16px; border-radius: var(--cs-radius); }
.login-footer { text-align: center; margin-top: 20px; }
.footer-text { font-size: 12px; color: var(--cs-text-tertiary); }
@media (max-width: 768px) {
  .login-container { flex-direction: column; width: 90%; min-height: auto; }
  .login-brand { width: 100%; padding: 32px 24px; }
  .brand-features { display: none; }
  .login-form-wrapper { padding: 32px 24px; }
}
@media (max-width: 480px) {
  .login-container { width: 94%; }
  .login-brand { padding: 24px 20px; }
  .brand-icon { width: 56px; height: 56px; margin-bottom: 12px; }
  .brand-title { font-size: 22px; }
  .brand-desc { font-size: 13px; margin-bottom: 0; }
  .login-form-wrapper { padding: 24px 20px; }
  .portal-switch { margin-bottom: 20px; }
}
</style>