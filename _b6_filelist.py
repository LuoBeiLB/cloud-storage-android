import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

p = r'E:\cloud-storage-platform\src\views\user\FileList.vue'
t = open(p, 'rb').read().decode('utf-8').replace('\r\n', '\n')

old = """  if (!raw) {
    ElMessage.error('读取文件失败，请重新选择')
    options.onError(new Error('empty file'))
    return
  }
  const parentId = uploadTargetId.value ?? 0"""

new = """  if (!raw) {
    ElMessage.error('读取文件失败，请重新选择')
    options.onError(new Error('empty file'))
    return
  }
  // 单文件上限 10GB（与后端 init 一致），选文件时先拦截，避免对大文件做无谓的 SHA256 计算
  if (raw.size > 10 * 1024 * 1024 * 1024) {
    ElMessage.error(`\u300c${name}\u300d\u8d85\u8fc7\u5355\u6587\u4ef6\u4e0a\u4f20\u4e0a\u9650 10GB\uff0c\u8bf7\u9009\u62e9\u66f4\u5c0f\u7684\u6587\u4ef6`)
    options.onError(new Error('file too large'))
    return
  }
  const parentId = uploadTargetId.value ?? 0"""

cnt = t.count(old)
assert cnt == 1, 'matched=%d' % cnt

t = t.replace(old, new)
open(p, 'wb').write(t.replace('\n', '\r\n').encode('utf-8'))
print('OK inserted size check')