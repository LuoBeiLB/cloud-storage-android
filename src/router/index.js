import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'Login', component: () => import('@/views/login/LoginView.vue'), meta: { requiresAuth: false } },
  { path: '/', component: () => import('@/layouts/UserLayout.vue'), meta: { requiresAuth: true, role: 'user' }, redirect: '/files',
    children: [
      { path: 'files', name: 'FileList', component: () => import('@/views/user/FileList.vue'), meta: { title: '我的文件' } },
      { path: 'recycle', name: 'RecycleBin', component: () => import('@/views/user/RecycleBin.vue'), meta: { title: '回收站' } },
      { path: 'profile', name: 'PersonalCenter', component: () => import('@/views/user/PersonalCenter.vue'), meta: { title: '个人中心' } }
    ]
  },
  { path: '/admin', component: () => import('@/layouts/AdminLayout.vue'), meta: { requiresAuth: true, role: 'admin' }, redirect: '/admin/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/admin/Dashboard.vue'), meta: { title: '统计大盘' } },
      { path: 'users', name: 'UserManagement', component: () => import('@/views/admin/UserManagement.vue'), meta: { title: '用户管理' } },
      { path: 'logs', name: 'AuditLog', component: () => import('@/views/admin/AuditLog.vue'), meta: { title: '审计日志' } }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/login' }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('cs-token')
  const userRole = localStorage.getItem('cs-role')
  if (to.meta.requiresAuth !== false && !token) return next('/login')
  if (to.meta.role === 'admin' && userRole !== 'admin') return next('/')
  next()
})

export default router