import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const request = axios.create({ baseURL: '/api', timeout: 30000 })

// 请求拦截：注入认证头（Bearer token + 用户标识，后端双通道识别）
request.interceptors.request.use(config => {
  const token = localStorage.getItem('cs-token')
  const userId = localStorage.getItem('cs-user-id')
  const role = localStorage.getItem('cs-role')
  if (token) config.headers.Authorization = 'Bearer ' + token
  if (userId) config.headers['X-User-Id'] = userId
  if (role) config.headers['X-User-Role'] = role
  return config
})

let refreshing = false

// 响应拦截：统一处理 Result{code, message, data}，code=0 成功
request.interceptors.response.use(
  response => {
    const { code, message } = response.data
    if (code === 0) return response.data.data
    if (code === 40103) {
      redirectToLogin()
      return Promise.reject(new Error(message || '登录已过期'))
    }
    ElMessage.error(message || '请求失败')
    return Promise.reject(new Error(message || '请求失败'))
  },
  error => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('cs-refresh-token')
      if (refreshToken && !refreshing && !error.config?._retried) {
        refreshing = true
        return axios.post('/api/auth/refresh', { refreshToken }).then(res => {
          const d = res.data?.data || {}
          if (!d.accessToken) throw new Error('refresh failed')
          localStorage.setItem('cs-token', d.accessToken)
          if (d.refreshToken) localStorage.setItem('cs-refresh-token', d.refreshToken)
          error.config._retried = true
          return request(error.config)
        }).catch(() => {
          redirectToLogin()
          return Promise.reject(error)
        }).finally(() => { refreshing = false })
      }
      redirectToLogin()
      return Promise.reject(error)
    }
    ElMessage.error(error.response?.data?.message || '网络异常')
    return Promise.reject(error)
  }
)

function redirectToLogin() {
  if (router.currentRoute.value.path === '/login') return
  localStorage.removeItem('cs-token')
  localStorage.removeItem('cs-refresh-token')
  localStorage.removeItem('cs-user-id')
  localStorage.removeItem('cs-username')
  localStorage.removeItem('cs-role')
  ElMessage.warning('登录已过期，请重新登录')
  router.push('/login')
}

export default request
