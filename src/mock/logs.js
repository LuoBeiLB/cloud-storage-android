const actionTypes = ['LOGIN','LOGOUT','UPLOAD','DOWNLOAD','DELETE','RESTORE','CREATE_FOLDER','RENAME','MOVE','SHARE','ADMIN_CREATE_USER','ADMIN_DISABLE_USER','ADMIN_UPDATE_QUOTA','ADMIN_RESET_PASSWORD']
const users = ['admin','zhangsan','lisi','wangwu','zhaoliu','sunqi','zhouba']

function genLogs(count) {
  const logs = []
  const baseTime = new Date('2026-09-15T09:00:00Z').getTime()
  for (let i = 0; i < count; i++) {
    const time = new Date(baseTime - i * 1800000 - Math.random() * 3600000)
    logs.push({
      id: 1000 + i,
      username: users[Math.floor(Math.random() * users.length)],
      action: actionTypes[Math.floor(Math.random() * actionTypes.length)],
      ip: '192.168.1.' + Math.floor(Math.random() * 200 + 10),
      target: ['产品文档.pdf','设计图.png','项目资料','季度报告.xlsx',''][Math.floor(Math.random() * 5)],
      status: Math.random() > 0.1 ? 'success' : 'failed',
      detail: { userAgent: 'Mozilla/5.0 Windows NT 10.0', duration: Math.floor(Math.random() * 5000) + 100 },
      createdAt: time.toISOString()
    })
  }
  return logs
}

export const mockLogs = genLogs(80)