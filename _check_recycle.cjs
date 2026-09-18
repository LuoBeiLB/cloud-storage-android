const fs = require('fs')
const esbuild = require('E:/cloud-storage-platform/node_modules/esbuild')

function checkVueScript(p) {
  const t = fs.readFileSync(p, 'utf8')
  const m = t.match(/<script setup>([\s\S]*?)<\/script>/)
  if (!m) { console.error('NO SCRIPT in ' + p); return false }
  try {
    esbuild.transformSync(m[1], { loader: 'js' })
    console.log('OK ' + p)
    return true
  } catch (e) {
    console.error('SYNTAX ERROR ' + p + ': ' + e.message)
    return false
  }
}

function checkJs(p) {
  const t = fs.readFileSync(p, 'utf8')
  try {
    esbuild.transformSync(t, { loader: 'js' })
    console.log('OK ' + p)
    return true
  } catch (e) {
    console.error('SYNTAX ERROR ' + p + ': ' + e.message)
    return false
  }
}

let ok = true
ok = checkVueScript('E:/cloud-storage-platform/src/views/user/RecycleBin.vue') && ok
ok = checkVueScript('E:/cloud-storage-platform/src/views/user/FileList.vue') && ok
ok = checkJs('E:/cloud-storage-platform/src/api/index.js') && ok
process.exit(ok ? 0 : 1)