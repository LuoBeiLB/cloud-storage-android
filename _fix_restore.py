import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

p = r'E:\cloud-storage-platform\src\api\index.js'
t = open(p, 'rb').read().decode('utf-8').replace('\r\n', '\n')

old = '  // ' + '\u4ece\u56de\u6536\u7ad9\u8fd8\u539f' + '\n  restore: id => request.post(`/files/${id}/restore`),'
new = '  // ' + '\u4ece\u56de\u6536\u7ad9\u8fd8\u539f' + '\uff1a\u53ef\u9009\u76ee\u6807\u76ee\u5f55 targetParentId\uff080=\u6839\u76ee\u5f55\u300c\u5168\u90e8\u6587\u4ef6\u300d\uff0c\u7f3a\u7701=\u539f\u4f4d\u7f6e\uff09' + '\n  restore: (id, data) => request.post(`/files/${id}/restore`, data || {}),'

cnt = t.count(old)
assert cnt == 1, 'matched=%d' % cnt

open(p, 'wb').write(t.replace(old, new).replace('\n', '\r\n').encode('utf-8'))
print('OK restore updated')