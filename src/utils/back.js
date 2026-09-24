// Android 返回键分发：页面可注册自己的处理函数（栈顶优先），返回 true 表示已消费。
// 未消费的落到全局默认逻辑（Tab 回文件页 / 最小化）。
const handlers = []

export function pushBackHandler(fn) {
  handlers.push(fn)
  return () => {
    const i = handlers.indexOf(fn)
    if (i >= 0) handlers.splice(i, 1)
  }
}

// 返回 true 表示有页面消费了这次返回
export function dispatchBack() {
  for (let i = handlers.length - 1; i >= 0; i--) {
    try {
      if (handlers[i]()) return true
    } catch (e) { /* 忽略单个处理器异常，继续向下 */ }
  }
  return false
}
