import request from './request'

// ===== 认证 =====
export const authApi = {
  login: data => request.post('/auth/login', data),
  logout: () => request.post('/auth/logout'),
  changePassword: data => request.post('/auth/change-password', data),
  profile: () => request.get('/auth/profile'),
  me: () => request.get('/user/me'),
  // 刷新 token：{ refreshToken } → LoginResponse
  refresh: data => request.post('/auth/refresh', data)
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
  restore: id => request.post(`/files/${id}/restore`),
  // 下载文件 → Map<string,string>
  download: id => request.get(`/files/${id}/download`),
  // 获取完整目录树（扁平 id+parentId 列表，前端自行建树）
  tree: () => request.get('/files/tree'),
  // 批量移动：{ ids: number[], targetParentId: number } → FileNodeVO[]
  batchMove: data => request.patch('/files/batch-move', data)
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

// ===== 文件传输（B 组：分片上传 / 秒传 / 断点续传 / 下载）=====
export const uploadApi = {
  // 初始化上传（含秒传分支）：{ name, size, parentId, sha256 } → { status:'done', fileId } 或 { status:'uploading', sessionId, uploadId, chunkSize }
  init: data => request.post('/uploads/init', data),
  // 上传单个分片：body 为该分片二进制，Content-Type 固定 octet-stream
  uploadPart: (sessionId, partNo, blob) => request.put(`/uploads/${sessionId}/parts/${partNo}`, blob, { headers: { 'Content-Type': 'application/octet-stream' }, timeout: 5 * 60 * 1000 }),
  // 查询会话（断点续传）→ { sessionId, status, uploadId, chunkSize, uploadedParts, partsDetail }
  getSession: sessionId => request.get(`/uploads/${sessionId}`),
  // 合并分片、落库、扣配额 → { fileId, alreadyDone }
  complete: sessionId => request.post(`/uploads/${sessionId}/complete`),
  // 取消上传
  abort: sessionId => request.post(`/uploads/${sessionId}/abort`),
  // 获取 5 分钟预签名下载地址 → { url }
  getDownloadUrl: fileId => request.get(`/files/${fileId}/download`)
}