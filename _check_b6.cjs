const fs = require('fs')
const esbuild = require('E:/cloud-storage-platform/node_modules/esbuild')
const t = fs.readFileSync('E:/cloud-storage-platform/src/views/user/FileList.vue', 'utf8')
const m = t.match(/<script setup>([\s\S]*?)<\/script>/)
if (!m) { console.error('NO SCRIPT FOUND'); process.exit(1) }
try {
  esbuild.transformSync(m[1], { loader: 'js' })
  console.log('FileList.vue script OK')
} catch (e) {
  console.error('SYNTAX ERROR:', e.message)
  process.exit(1)
}