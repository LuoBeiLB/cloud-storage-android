export { mockFiles, mockRecycleFiles } from '@/mock/files'
export { mockUsers } from '@/mock/users'
export { mockStats, mockTrafficData, mockTopUsers } from '@/mock/stats'
export { mockLogs } from '@/mock/logs'

export function mockRequest(data, delay = 300) {
  return new Promise(resolve => {
    setTimeout(() => { resolve({ code: 0, message: 'success', data }) }, delay)
  })
}

export function mockLogin(username, password, portal) {
  return mockRequest({
    token: 'mock-token-' + Date.now(),
    refreshToken: 'mock-refresh-' + Date.now(),
    username,
    role: portal === 'admin' ? 'admin' : 'user',
    mustChangePassword: false
  }, 800)
}