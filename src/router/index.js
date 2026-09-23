import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'Login', component: () => import('@/views/login/LoginView.vue'), meta: { requiresAuth: false } },
  {
    path: '/',
    component: () => import('@/layouts/TabLayout.vue'),
    meta: { requiresAuth: true },
    redirect: '/files',
    children: [
      { path: 'files', name: 'Files', component: () => import('@/views/user/FileList.vue'), meta: { title: '我的文件', tab: 0 } },
      { path: 'transfers', name: 'Transfers', component: () => import('@/views/user/Transfers.vue'), meta: { title: '传输', tab: 1 } },
      { path: 'recycle', name: 'Recycle', component: () => import('@/views/user/RecycleBin.vue'), meta: { title: '回收站', tab: 2 } },
      { path: 'profile', name: 'Profile', component: () => import('@/views/user/PersonalCenter.vue'), meta: { title: '我的', tab: 3 } }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/files' }
]

const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('cs-token')
  if (to.meta.requiresAuth !== false && !token) return next('/login')
  if (to.path === '/login' && token) return next('/files')
  next()
})

export default router
