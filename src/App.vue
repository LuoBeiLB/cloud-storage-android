<template>
  <router-view />
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { App } from '@capacitor/app'
import { dispatchBack } from '@/utils/back'

const route = useRoute()
const router = useRouter()
let listener = null

onMounted(async () => {
  listener = await App.addListener('backButton', () => {
    // 1. 页面自己处理（关弹窗/退多选/回上级目录）
    if (dispatchBack()) return
    // 2. 登录页：允许退出（登录页没有返回意义）
    if (route.path === '/login') { App.exitApp(); return }
    // 3. 非文件 Tab：先回文件页
    if (route.path !== '/files') { router.replace('/files'); return }
    // 4. 文件页根目录：最小化到后台，不杀死 App（保留登录态和传输任务）
    App.minimizeApp()
  })
})
onUnmounted(() => { listener && listener.remove() })
</script>
