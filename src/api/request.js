import axios from 'axios'
import { showToast } from 'vant'
import router from '@/router'
import { API_BASE } from '@/config'

const request = axios.create({ baseURL: API_BASE, timeout: 30000 })

// 请求拦截：注入 token
request.interceptors.request.use(config => {
  const token = localStorage.getItem('cs-token')
  if (token) config.headers.Authorization = 'Bearer ' + token
  return config
})

let refreshing = false

// 响应拦截：统一 Result{code, message, data}，code=0 成功
request.interceptors.response.use(
  response => {
    const { code, message } = response.data
    if (code === 0) return response.data.data
    if (code === 40103) {
      redirectToLogin()
      return Promise.reject(new Error(message || '登录已过期'))
    }
    showToast(message || '请求失败')
    return Promise.reject(new Error(message || '请求失败'))
  },
  error => {
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED' || error.name === 'AbortError') {
      return Promise.reject(error)
    }
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('cs-refresh-token')
      if (refreshToken && !refreshing && !error.config?._retried) {
        refreshing = true
        return axios.post(API_BASE + '/auth/refresh', { refreshToken }).then(res => {
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
    showToast(error.response?.data?.message || '网络异常，请稍后重试')
    return Promise.reject(error)
  }
)

function redirectToLogin() {
  localStorage.removeItem('cs-token')
  localStorage.removeItem('cs-refresh-token')
  localStorage.removeItem('cs-user-id')
  localStorage.removeItem('cs-username')
  localStorage.removeItem('cs-role')
  if (router.currentRoute.value.path !== '/login') {
    router.replace('/login')
  }
}

export default request
