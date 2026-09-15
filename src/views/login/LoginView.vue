<template>
  <div class="login-page">
    <div class="login-bg">
      <div class="bg-orb orb-1"></div>
      <div class="bg-orb orb-2"></div>
      <div class="bg-orb orb-3"></div>
    </div>
    <button class="theme-toggle login-theme-toggle" @click="appStore.toggleTheme" :title="appStore.theme === 'light' ? '切换暗色模式' : '切换亮色模式'">
      <el-icon :size="18"><Moon v-if="appStore.theme === 'light'" /><Sunny v-else /></el-icon>
    </button>
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
        <div class="brand-footer"><el-icon :size="14"><LocationInformation /></el-icon><span>内网部署 · 数据安全</span></div>
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
            <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" clearable />
          </el-form-item>
          <el-form-item prop="password">
            <el-input v-model="form.password" type="password" placeholder="密码" :prefix-icon="Lock" show-password @keyup.enter="handleLogin" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" class="login-btn" @click="handleLogin">
              <el-icon v-if="!loading" style="margin-right: 4px"><Right /></el-icon>登 录
            </el-button>
          </el-form-item>
        </el-form>
        <div class="login-footer"><span class="footer-text">© 2026 CloudVault · 私有化部署方案</span></div>
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
import { useAppStore } from '@/stores/app'
import { mockLogin } from '@/api/mock'

const router = useRouter()
const userStore = useUserStore()
const appStore = useAppStore()
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
.bg-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.15; animation: orb-float 12s ease-in-out infinite; }
[data-theme="dark"] .bg-orb { opacity: 0.1; }
.orb-1 { width: 400px; height: 400px; background: #1677ff; top: -100px; right: -50px; }
.orb-2 { width: 300px; height: 300px; background: #764ba2; bottom: -80px; left: -30px; animation-delay: -4s; }
.orb-3 { width: 200px; height: 200px; background: #4facfe; top: 50%; left: 40%; animation-delay: -8s; }
@keyframes orb-float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(20px, -24px) scale(1.08); }
}
.login-theme-toggle { position: absolute; top: 20px; right: 20px; z-index: 10; width: 40px; height: 40px; border-radius: 12px; border: 1px solid var(--cs-border); background: var(--cs-bg-container); box-shadow: var(--cs-shadow); }
.login-container { display: flex; width: 880px; min-height: 500px; background: var(--cs-bg-container); border-radius: 20px; box-shadow: var(--cs-shadow-xl); overflow: hidden; position: relative; z-index: 1; border: 1px solid var(--cs-border); animation: cs-fade-up 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
.login-brand { width: 400px; background: linear-gradient(135deg, #1677ff 0%, #4096ff 50%, #764ba2 100%); padding: 48px 36px; display: flex; flex-direction: column; justify-content: center; color: #fff; flex-shrink: 0; position: relative; overflow: hidden; }
.login-brand::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px); background-size: 22px 22px; pointer-events: none; }
[data-theme="dark"] .login-brand { background: linear-gradient(135deg, #0f1b33 0%, #131c31 50%, #1b1b35 100%); border-right: 1px solid var(--cs-border); }
.brand-icon { width: 72px; height: 72px; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.25); border-radius: 18px; display: flex; align-items: center; justify-content: center; margin-bottom: 22px; backdrop-filter: blur(10px); box-shadow: 0 8px 20px rgba(0,0,0,0.15); }
[data-theme="dark"] .brand-icon { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.35); box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
.brand-title { font-size: 28px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.5px; }
.brand-desc { font-size: 14px; opacity: 0.85; margin-bottom: 40px; }
.brand-features { display: flex; flex-direction: column; gap: 18px; position: relative; z-index: 1; }
.feature-item { display: flex; align-items: center; gap: 12px; font-size: 13px; opacity: 0.92; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); padding: 10px 14px; border-radius: 10px; backdrop-filter: blur(4px); transition: all 0.25s ease; }
.feature-item:hover { background: rgba(255,255,255,0.16); transform: translateX(4px); }
[data-theme="dark"] .feature-item { background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.2); }
[data-theme="dark"] .feature-item:hover { background: rgba(59,130,246,0.2); }
.brand-footer { display: flex; align-items: center; gap: 6px; margin-top: 40px; font-size: 12px; opacity: 0.7; position: relative; z-index: 1; }
.login-form-wrapper { flex: 1; padding: 48px 44px; display: flex; flex-direction: column; justify-content: center; }
.portal-switch { display: flex; justify-content: center; margin-bottom: 36px; animation: cs-fade-up 0.45s ease 0.1s backwards; }
.portal-switch :deep(.el-radio-button__inner) { display: flex; align-items: center; gap: 6px; padding: 12px 32px; font-weight: 500; transition: all 0.25s ease; }
.portal-switch :deep(.el-radio-button.is-active .el-radio-button__original-radio + .el-radio-button__inner) {
  background: linear-gradient(135deg, var(--cs-primary) 0%, var(--cs-primary-dark) 100%);
  border-color: var(--cs-primary-dark);
  box-shadow: var(--cs-primary-shadow);
  color: #fff;
}
.login-form-wrapper :deep(.el-form) { animation: cs-fade-up 0.45s ease 0.18s backwards; }
.login-form-wrapper :deep(.el-input__wrapper) { padding: 4px 14px; }
.login-btn { width: 100%; height: 46px; font-size: 16px; font-weight: 600; border-radius: 10px; letter-spacing: 4px; }
.login-footer { text-align: center; margin-top: 24px; animation: cs-fade-up 0.45s ease 0.26s backwards; }
.footer-text { font-size: 12px; color: var(--cs-text-tertiary); }
@media (max-width: 768px) {
  .login-container { flex-direction: column; width: 90%; min-height: auto; }
  .login-brand { width: 100%; padding: 32px 24px; }
  .brand-features, .brand-footer { display: none; }
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
