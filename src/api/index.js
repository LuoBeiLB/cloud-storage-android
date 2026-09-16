import request from './request'

// ===== 认证 =====
export const authApi = {
  login: data => request.post('/auth/login', data),
  logout: () => request.post('/auth/logout'),
  changePassword: data => request.post('/auth/change-password', data),
  profile: () => request.get('/auth/profile'),
  me: () => request.get('/user/me')
}

// ===== 文件管理 =====
export const fileApi = {
  // 列目录：{ parent, page, size, sort } → { total, list, breadcrumb }
  listDir: params => request.get('/files', { params }),
  // 新建文件夹：{ parentId, name }
  mkdir: data => request.post('/files/mkdir', data),
  // 重命名/移动：{ name } 或 { parentId }
  update: (id, data) => request.patch(`/files/${id}`, data),
  // 删除：force=1 彻底删除（回收站内），默认进回收站
  remove: (id, force = 0) => request.delete(`/files/${id}`, { params: { force } }),
  // 回收站列表：{ page, size } → { total, list }
  trash: params => request.get('/files/trash', { params }),
  // 从回收站还原
  restore: id => request.post(`/files/${id}/restore`)
}

// ===== 统计大盘（个人维度）=====
export const statsApi = {
  overview: () => request.get('/stats/overview')
}

// ===== 审计日志 =====
export const auditApi = {
  // { userId, action, start, end, page, size } → { total, list }
  query: params => request.get('/audit-logs', { params })
}

// ===== 用户管理（admin）=====
export const adminApi = {
  // { keyword, status, page, size } → Spring Page { content, totalElements, ... }
  listUsers: params => request.get('/admin/users', { params }),
  // { username, initialPassword, quotaBytes, role }
  createUser: data => request.post('/admin/users', data),
  // { status, quotaBytes, role }
  updateUser: (id, data) => request.patch(`/admin/users/${id}`, data),
  // 重置密码 → { password: 'xxx' }（新密码）
  resetPassword: id => request.post(`/admin/users/${id}/reset-password`)
}
