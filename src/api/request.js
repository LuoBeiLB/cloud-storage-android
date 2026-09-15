import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const request = axios.create({ baseURL: '/api', timeout: 30000 })

request.interceptors.request.use(config => {
  const token = localStorage.getItem('cs-token')
  if (token) config.headers.Authorization = 'Bearer ' + token
  return config
})

request.interceptors.response.use(
  response => {
    const { code, message, data } = response.data
    if (code === 0) return data
    ElMessage.error(message || '请求失败')
    return Promise.reject(new Error(message))
  },
  error => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('cs-refresh-token')
      if (refreshToken && !error.config._retry) {
        error.config._retry = true
        return axios.post('/api/auth/refresh', { refreshToken }).then(res => {
          const { token } = res.data.data
          localStorage.setItem('cs-token', token)
          error.config.headers.Authorization = 'Bearer ' + token
          return request(error.config)
        }).catch(() => { localStorage.clear(); router.push('/login') })
      }
      localStorage.clear(); router.push('/login')
    }
    ElMessage.error(error.response?.data?.message || '网络异常')
    return Promise.reject(error)
  }
)

export default request
// TODO: 后端就绪后替换 mock 为真实 API
// export const authApi = { login, logout, refreshToken, changePassword }
// export const fileApi = { list, upload, download, delete, restore, createFolder }
// export const adminApi = { getUsers, createUser, toggleUser, updateQuota, getStats, getLogs }