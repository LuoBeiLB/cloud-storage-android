// App 应用内更新：检查 → 弹窗 → 下载 → 校验 → 安装 → 启动清理
// 对应后端契约：GET /api/app/check-update?platform=android&versionCode=&userId=
import { registerPlugin, Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Network } from '@capacitor/network'
import { showDialog, showToast, showLoadingToast, closeToast } from 'vant'
import { SERVER_ORIGIN } from '@/config'
import { useUserStore } from '@/stores/user'

const AppUpdate = registerPlugin('AppUpdate')
const UPDATE_DIR = 'updates'
let checking = false

// 只在真机 Android 上工作；网页/模拟调试直接跳过
function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

// ============ 检查更新（App 启动时调用一次） ============
export async function checkAppUpdate() {
  if (!isNativeAndroid() || checking) return
  const userStore = useUserStore()
  if (!userStore.token) return // 未登录不打扰
  checking = true
  try {
    const info = await App.getInfo() // { build: "1", version: "1.0" }
    const url = `${SERVER_ORIGIN}/api/app/check-update?platform=android&versionCode=${info.build}&userId=${userStore.userId || 0}`
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${userStore.token}` } })
    if (!resp.ok) return
    const data = await resp.json()
    if (!data || !data.hasUpdate || !data.apkUrl) return
    await promptUpdate(data)
  } catch (e) {
    // 检查失败静默，不打断正常使用
  } finally {
    checking = false
  }
}

// ============ 更新弹窗 ============
async function promptUpdate(info) {
  const isForce = !!info.forceUpdate
  const doUpdate = () => downloadAndInstall(info)
  try {
    if (isForce) {
      // 强制更新：不可取消、不可点遮罩关闭
      await showDialog({
        title: `新版本 ${info.versionName || ''}`,
        message: info.updateNotes || '发现新版本，请更新后继续使用。',
        confirmButtonText: '立即更新',
        showCancelButton: false,
        closeOnClickOverlay: false,
        closeOnPopstate: false
      })
      doUpdate()
    } else {
      await showDialog({
        title: `新版本 ${info.versionName || ''}`,
        message: info.updateNotes || '发现新版本，是否立即更新？',
        confirmButtonText: '立即更新',
        cancelButtonText: '稍后再说',
        showCancelButton: true,
        closeOnPopstate: true
      })
      doUpdate()
    }
  } catch (e) { /* 用户点了稍后再说 */ }
}

// ============ 下载 → 校验 → 安装 ============
async function downloadAndInstall(info) {
  // 1. 网络检查：仅 WiFi 自动下载，移动网络二次确认
  try {
    const net = await Network.getStatus()
    if (net.connected && net.connectionType !== 'wifi') {
      const sizeMb = info.fileSize ? (info.fileSize / 1048576).toFixed(1) : '?'
      await showDialog({
        title: '当前为移动网络',
        message: `更新包约 ${sizeMb}MB，确定使用流量下载？`,
        confirmButtonText: '继续下载',
        cancelButtonText: '取消',
        showCancelButton: true
      })
    }
  } catch (e) {
    if (e && e.action === 'cancel') return // 用户取消流量下载
    // Network 插件异常则直接继续
  }

  // 2. 安装授权检查（Android 8+）
  try {
    const { value: canInstall } = await AppUpdate.canInstall()
    if (!canInstall) {
      await showDialog({
        title: '需要授权',
        message: '请开启"允许安装未知来源应用"后重试。',
        confirmButtonText: '去开启',
        cancelButtonText: '取消',
        showCancelButton: true
      })
      await AppUpdate.openInstallSetting()
      return
    }
  } catch (e) {
    if (e && e.action === 'cancel') return
  }

  // 3. 下载（带进度）
  const fileName = `update-v${info.versionName || info.versionCode || 'new'}.apk`
  showLoadingToast({ message: '下载中 0%', forbidClick: true, duration: 0 })
  let filePath
  try {
    filePath = await downloadFile(info.apkUrl, fileName, (percent) => {
      showLoadingToast({ message: `下载中 ${percent}%`, forbidClick: true, duration: 0 })
    })
  } catch (e) {
    closeToast()
    showToast('下载失败，请稍后重试')
    await cleanupUpdates()
    return
  }

  // 4. SHA-256 校验（后端提供 hash 才校验；校验不过删除并提示）
  if (info.fileHash) {
    showLoadingToast({ message: '校验安装包...', forbidClick: true, duration: 0 })
    try {
      const ok = await verifyFileSha256(filePath, info.fileHash)
      if (!ok) {
        closeToast()
        showToast('安装包校验失败，请重新下载')
        await cleanupUpdates()
        return
      }
    } catch (e) { /* 校验异常则继续安装（兼容后端 hash 格式差异） */ }
  }
  closeToast()

  // 5. 调起系统安装器
  try {
    const nativePath = await getNativePath(filePath)
    await AppUpdate.install({ path: nativePath })
  } catch (e) {
    showToast('无法打开安装器')
  }
}

// 流式下载到 updates/ 目录，返回相对路径（updates/xxx.apk）
async function downloadFile(url, fileName, onProgress) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('http ' + resp.status)
  const total = Number(resp.headers.get('content-length') || 0)
  const reader = resp.body.getReader()

  const relPath = `${UPDATE_DIR}/${fileName}`
  await Filesystem.deleteFile({ path: relPath, directory: Directory.Data }).catch(() => {})

  let received = 0
  // 先全部收到内存（APK 几 MB 可控），再一次性写盘，避免频繁 base64 拼接
  const chunks = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    if (total > 0) onProgress(Math.min(99, Math.round((received / total) * 100)))
  }
  const merged = new Uint8Array(received)
  let offset = 0
  for (const c of chunks) { merged.set(c, offset); offset += c.length }

  await Filesystem.writeFile({
    path: relPath,
    data: uint8ToBase64(merged),
    directory: Directory.Data,
    recursive: true
  })
  onProgress(100)
  return relPath
}

// Uint8Array → base64（分块防栈溢出）
function uint8ToBase64(u8) {
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < u8.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

// 校验文件 SHA-256（fileHash 允许带 "sha256:" 前缀或大小写）
async function verifyFileSha256(relPath, expected) {
  const want = String(expected).replace(/^sha256:/i, '').trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(want)) return true // 后端格式异常则不拦
  const file = await Filesystem.readFile({ path: relPath, directory: Directory.Data })
  const bytes = base64ToUint8(file.data)
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer)
  const got = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
  return got === want
}

function base64ToUint8(b64) {
  const bin = atob(b64)
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return u8
}

// 转原生可识别的 file:// 路径（给 Kotlin 插件用）
async function getNativePath(relPath) {
  const { uri } = await Filesystem.getUri({ path: relPath, directory: Directory.Data })
  return uri // 形如 file:///data/user/0/包名/files/updates/xxx.apk
}

// ============ 启动/回前台清理 updates 目录（防安装包堆积） ============
export async function cleanupUpdates() {
  if (!isNativeAndroid()) return
  try {
    const { files } = await Filesystem.readdir({ path: UPDATE_DIR, directory: Directory.Data })
    for (const f of files) {
      await Filesystem.deleteFile({ path: `${UPDATE_DIR}/${f.name}`, directory: Directory.Data }).catch(() => {})
    }
  } catch (e) { /* 目录不存在属正常 */ }
}

// ============ 在 App.vue 挂载：启动检查 + 回前台清理 ============
export async function initAppUpdate() {
  if (!isNativeAndroid()) return
  await cleanupUpdates()
  // 登录态就绪后检查更新（延迟执行，等路由和用户信息初始化）
  setTimeout(() => { checkAppUpdate() }, 1500)
  await App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) cleanupUpdates()
  })
}
