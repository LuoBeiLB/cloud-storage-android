<template>
  <div class="login-page">
    <div class="login-hero">
      <div class="logo"><van-icon name="cluster" /></div>
      <h1 class="brand">我的云盘</h1>
      <p class="slogan">安全存储 · 随时访问</p>
    </div>

    <van-form @submit="onSubmit">
      <van-cell-group inset class="form-group">
        <van-field
          v-model="username"
          name="username"
          label="账号"
          label-width="48"
          placeholder="请输入账号"
          left-icon="manager-o"
          clearable
          :rules="[{ required: true, message: '请输入账号' }]"
        />
        <van-field
          v-model="password"
          type="password"
          name="password"
          label="密码"
          label-width="48"
          placeholder="请输入密码"
          left-icon="lock"
          clearable
          :rules="[{ required: true, message: '请输入密码' }]"
        />
      </van-cell-group>

      <div class="submit-wrap">
        <van-button round block type="primary" native-type="submit" :loading="loading">
          登 录
        </van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showSuccessToast, showDialog } from 'vant'
import { authApi } from '@/api'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const username = ref('')
const password = ref('')
const loading = ref(false)

async function onSubmit() {
  loading.value = true
  try {
    const res = await authApi.login({ username: username.value.trim(), password: password.value })
    userStore.login(res)
    showSuccessToast('登录成功')
    if (res.user?.mustChangePassword) {
      showDialog({
        title: '请先修改密码',
        message: '检测到这是初始密码，为了账号安全，请先在「我的」页面修改密码。',
        confirmButtonText: '知道了'
      }).then(() => router.replace('/profile'))
    } else {
      router.replace('/files')
    }
  } catch (e) {
    // 拦截器已提示
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page { min-height: 100%; background: linear-gradient(180deg, #eaf3ff 0%, #f7f8fa 40%); display: flex; flex-direction: column; }
.login-hero { text-align: center; padding: calc(48px + var(--safe-top)) 0 32px; }
.logo {
  width: 76px; height: 76px; margin: 0 auto 14px;
  border-radius: 22px;
  background: linear-gradient(135deg, #3ba0ff, #1989fa);
  color: #fff; font-size: 40px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 10px 24px rgba(25, 137, 250, 0.32);
}
.brand { font-size: 24px; font-weight: 700; color: #1f2937; }
.slogan { margin-top: 6px; font-size: 13px; color: #969799; }
.form-group { margin-top: 8px; overflow: hidden; border-radius: 12px; }
.submit-wrap { margin: 28px 24px; }
</style>
