<template>
  <div class="app-shell">
    <div class="page-wrap">
      <router-view v-slot="{ Component }">
        <transition name="tab-fade" mode="out-in">
          <keep-alive include="FileList,RecycleBin">
            <component :is="Component" />
          </keep-alive>
        </transition>
      </router-view>
    </div>

    <!-- 悬浮胶囊 tabbar（自绘，不用 van-tabbar，避免默认样式盖不干净） -->
    <nav class="float-tabbar">
      <div
        v-for="t in tabs"
        :key="t.to"
        class="tab-item"
        :class="{ active: isActive(t.to) }"
        @click="go(t.to)"
      >
        <van-icon :name="t.icon" size="21" />
        <span>{{ t.label }}</span>
      </div>
    </nav>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const tabs = [
  { to: '/files', icon: 'description-o', label: '文件' },
  { to: '/transfers', icon: 'exchange', label: '传输' },
  { to: '/recycle', icon: 'delete-o', label: '回收站' },
  { to: '/profile', icon: 'user-o', label: '我的' }
]
const isActive = to => route.path === to || (to === '/files' && route.path === '/')
const go = to => { if (route.path !== to) router.push(to) }
</script>

<style scoped>
.app-shell { display: flex; flex-direction: column; height: 100%; }
.page-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; padding-bottom: 80px; }

/* 切换动画：淡入 + 轻微上移 */
.tab-fade-enter-active,
.tab-fade-leave-active { transition: opacity .18s ease, transform .18s ease; }
.tab-fade-enter-from { opacity: 0; transform: translateY(8px); }
.tab-fade-leave-to { opacity: 0; transform: translateY(-4px); }

/* 悬浮胶囊 tabbar */
.float-tabbar {
  position: fixed;
  left: 14px;
  right: 14px;
  bottom: calc(14px + env(safe-area-inset-bottom));
  height: 58px;
  border-radius: 29px;
  background: rgba(255, 255, 255, .92);
  box-shadow: 0 8px 28px rgba(31, 45, 61, .16), 0 1px 4px rgba(31, 45, 61, .08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  z-index: 100;
}
.tab-item {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 11px;
  color: #646566;
  transition: color .18s ease;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.tab-item.active { color: #1989fa; font-weight: 600; }
</style>
