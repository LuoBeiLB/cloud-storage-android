<template>
  <div class="layout-user">
    <aside class="sidebar" :class="{ collapsed: isCollapsed, 'mobile-open': mobileMenuOpen }">
      <div class="sidebar-header">
        <div class="logo-badge"><el-icon :size="20" color="#fff"><Coin /></el-icon></div>
        <span v-show="!isCollapsed" class="sidebar-title">CloudVault</span>
      </div>
      <el-menu :default-active="route.path" :collapse="isCollapsed" router class="sidebar-menu" @select="handleMenuNavigate">
        <el-menu-item index="/files"><el-icon><FolderOpened /></el-icon><template #title>我的文件</template></el-menu-item>
        <el-menu-item index="/recycle"><el-icon><Delete /></el-icon><template #title>回收站</template></el-menu-item>
        <el-menu-item index="/profile"><el-icon><User /></el-icon><template #title>个人中心</template></el-menu-item>
      </el-menu>
      <div class="sidebar-bottom">
        <div class="quota-info" v-show="!isCollapsed">
          <div class="quota-label">
            <span>存储空间</span>
            <span class="quota-value">{{ formatSize(userStore.quota.used) }} / {{ formatSize(userStore.quota.total) }}</span>
          </div>
          <el-progress :percentage="quotaPercent" :stroke-width="6" :show-text="false" :color="quotaPercent > 80 ? 'var(--cs-danger)' : 'var(--cs-primary)'" />
        </div>
      </div>
    </aside>
    <div v-if="isMobile && mobileMenuOpen" class="mobile-mask" @click="closeMobileMenu"></div>
    <div class="layout-main">
      <header class="header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="handleMenuClick" :size="20">
            <template v-if="isMobile">
              <Close v-if="mobileMenuOpen" />
              <Menu v-else />
            </template>
            <template v-else>
              <Fold v-if="!isCollapsed" />
              <Expand v-else />
            </template>
          </el-icon>
        </div>
        <div class="header-right">
          <button class="theme-toggle" @click="appStore.toggleTheme" :title="appStore.theme === 'light' ? '切换暗色' : '切换亮色'">
            <el-icon :size="18"><Moon v-if="appStore.theme === 'light'" /><Sunny v-else /></el-icon>
          </button>
          <el-dropdown trigger="click">
            <span class="user-info">
              <el-avatar :size="32" class="user-avatar"><el-icon :size="18"><User /></el-icon></el-avatar>
              <span class="user-name">{{ userStore.username }}</span>
              <el-icon :size="12"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="router.push('/profile')"><el-icon><Setting /></el-icon>个人设置</el-dropdown-item>
                <el-dropdown-item divided @click="handleLogout"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <main class="content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in"><component :is="Component" /></transition>
        </router-view>
      </main>
      <ForcePasswordDialog />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import ForcePasswordDialog from '@/components/ForcePasswordDialog.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()

const isMobile = ref(false)
const mobileMenuOpen = ref(false)

// 移动端抽屉里菜单始终展开；桌面/平板的折叠状态由 appStore 控制
const isCollapsed = computed(() => !isMobile.value && appStore.sidebarCollapsed)
const quotaPercent = computed(() => userStore.quota.total > 0 ? Math.round(userStore.quota.used / userStore.quota.total * 100) : 0)

function updateViewport() {
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) mobileMenuOpen.value = false
}

onMounted(() => {
  updateViewport()
  // 平板端（≤1024 且 >768）默认折叠侧边栏
  if (window.innerWidth <= 1024 && window.innerWidth > 768) {
    appStore.sidebarCollapsed = true
  }
  window.addEventListener('resize', updateViewport)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport)
})

function handleMenuClick() {
  if (isMobile.value) {
    mobileMenuOpen.value = !mobileMenuOpen.value
  } else {
    appStore.toggleSidebar()
  }
}

function handleMenuNavigate() {
  if (isMobile.value) mobileMenuOpen.value = false
}

function closeMobileMenu() { mobileMenuOpen.value = false }

function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024, sizes = ['B','KB','MB','GB','TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function handleLogout() { userStore.logout(); router.push('/login') }
</script>

<style scoped>
.layout-user { display: flex; height: 100vh; overflow: hidden; }
.sidebar { width: var(--cs-sidebar-width); height: 100vh; background: var(--cs-sidebar-bg); border-right: 1px solid var(--cs-sidebar-border); display: flex; flex-direction: column; transition: width var(--cs-transition); flex-shrink: 0; overflow: hidden; }
.sidebar.collapsed { width: 64px; }
.sidebar-header { height: var(--cs-header-height); display: flex; align-items: center; padding: 0 16px; gap: 10px; border-bottom: 1px solid var(--cs-sidebar-border); flex-shrink: 0; }
.sidebar.collapsed .sidebar-header { justify-content: center; padding: 0; }
.sidebar-title { font-size: 16px; font-weight: 700; color: #ffffff; white-space: nowrap; letter-spacing: -0.3px; }
.logo-badge { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--cs-primary) 0%, var(--cs-primary-dark) 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: var(--cs-shadow); }
.sidebar-menu { flex: 1; border-right: none !important; padding: 8px; background: transparent !important; }
.sidebar-menu .el-menu-item { position: relative; border-radius: var(--cs-radius); margin-bottom: 4px; height: 44px; line-height: 44px; transition: all 0.2s ease; color: var(--cs-sidebar-text); }
.sidebar-menu .el-menu-item:hover { background: var(--cs-sidebar-hover-bg); color: var(--cs-sidebar-active-text); }
.sidebar-menu .el-menu-item.is-active { background: var(--cs-sidebar-active-bg); color: var(--cs-sidebar-active-text); font-weight: 600; }
.sidebar-menu .el-menu-item.is-active::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 3px; height: 18px; border-radius: 2px; background: #ffffff; }
.sidebar-bottom { padding: 12px 16px; border-top: 1px solid var(--cs-sidebar-border); flex-shrink: 0; }
.quota-info .quota-label { display: flex; justify-content: space-between; font-size: 12px; color: var(--cs-sidebar-text); margin-bottom: 6px; }
.quota-value { color: var(--cs-sidebar-active-text); font-weight: 500; }
.layout-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.header { height: var(--cs-header-height); background: var(--cs-header-bg); border-bottom: 1px solid var(--cs-header-border); display: flex; align-items: center; justify-content: space-between; padding: 0 20px; flex-shrink: 0; }
.header-left { display: flex; align-items: center; }
.collapse-btn { cursor: pointer; color: var(--cs-text-secondary); transition: color var(--cs-transition); }
.collapse-btn:hover { color: var(--cs-primary); }
.header-right { display: flex; align-items: center; gap: 12px; }
.user-info { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px 8px; border-radius: var(--cs-radius-sm); transition: background var(--cs-transition); }
.user-info:hover { background: var(--cs-bg-hover); }
.user-avatar { background: var(--cs-primary-lighter); color: var(--cs-primary); }
.user-name { font-size: 14px; color: var(--cs-text-primary); font-weight: 500; }
.content { flex: 1; overflow-y: auto; background: var(--cs-bg-page); }
.mobile-mask { display: none; }

/* 平板端：侧边栏折叠成图标栏 */
@media (max-width: 1024px) and (min-width: 769px) {
  .header { padding: 0 16px; }
}

/* 移动端：侧边栏变抽屉，默认隐藏 */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0; top: 0; bottom: 0;
    width: var(--cs-sidebar-width) !important;
    transform: translateX(-100%);
    transition: transform var(--cs-transition);
    z-index: 1001;
    box-shadow: var(--cs-shadow-lg);
  }
  .sidebar.mobile-open { transform: translateX(0); }
  .mobile-mask {
    display: block;
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 1000;
  }
  .header { padding: 0 12px; }
  .header-right { gap: 8px; }
  .user-name { display: none; }
}
</style>