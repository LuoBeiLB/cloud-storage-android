<template>
  <div class="file-page">
    <!-- 头部：面包屑 + 操作 -->
    <header class="app-header">
      <div v-if="!selectMode" class="topbar">
        <van-icon class="back-icon" :class="{ disabled: !canGoUp }" name="arrow-left" @click="goUp" />
        <div class="crumb-scroll">
          <span class="crumb" @click="enterDir(0)">全部文件</span>
          <template v-for="(item, idx) in fileStore.breadcrumb.slice(1)" :key="item.id">
            <span class="sep">/</span>
            <span class="crumb" @click="enterDir(item.id)">{{ item.name }}</span>
          </template>
        </div>
        <van-icon name="plus" class="add-icon" @click="showAddSheet = true" />
      </div>
      <div v-else class="topbar select-bar">
        <van-icon name="cross" class="back-icon" @click="exitSelect" />
        <div class="sel-count">已选 {{ selected.size }} 项</div>
        <span class="sel-all" @click="toggleSelectAll">{{ isAllSelected ? '取消全选' : '全选' }}</span>
      </div>
    </header>

    <!-- 列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh" class="list-scroll">
      <van-list
        :loading="fileStore.loading"
        :finished="fileStore.finished"
        :finished-text="refreshing ? '' : '没有更多了'"
        @load="onLoad"
        :immediate-check="false"
      >
        <template #loading>
          <div v-if="!refreshing" class="list-loading"><van-loading size="18">加载中...</van-loading></div>
        </template>

        <div
          v-for="file in orderedFiles"
          :key="file.id"
          class="file-item"
          :class="{ selected: selectMode && selected.has(file.id) }"
          @click="onItemClick(file)"
          @touchstart.passive="onTouchStart(file, $event)"
          @touchend="onTouchEnd"
          @touchcancel="onTouchEnd"
        >
          <van-checkbox
            v-if="selectMode"
            :model-value="selected.has(file.id)"
            class="sel-check"
            @click.stop
            @update:model-value="toggleSelect(file)"
          />
          <svg v-if="file.isDir" viewBox="0 0 24 24" width="26" height="26" class="file-icon" fill="#ffc53d"><path d="M10 4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6z"/></svg>
          <van-icon v-else :name="iconOf(file)" :color="colorOf(file)" size="26" class="file-icon" />
          <div class="file-meta">
            <div class="file-name">{{ file.name }}</div>
            <div class="file-sub">{{ file.isDir ? '文件夹' : formatSize(file.size) + ' · ' + shortDate(file.updatedAt) }}</div>
          </div>
          <van-icon v-if="!selectMode" name="ellipsis" class="more-icon" @click.stop="openActions(file)" />
        </div>

        <van-empty v-if="fileStore.finished && orderedFiles.length === 0 && !fileStore.loading" description="这个文件夹还是空的" />
        <div class="bottom-spacer"></div>
      </van-list>
    </van-pull-refresh>

    <!-- 添加操作 -->
    <van-action-sheet v-model:show="showAddSheet" :actions="addActions" @select="onAddSelect" cancel-text="取消" close-on-click-action />

    <!-- 文件操作 -->
    <van-action-sheet
      v-model:show="showActionSheet"
      :actions="currentActions"
      @select="onActionSelect"
      cancel-text="取消"
      close-on-click-action
    />

    <!-- 新建文件夹 -->
    <van-dialog
      v-model:show="showMkdir"
      title="新建文件夹"
      show-cancel-button
      :before-close="onMkdir"
    >
      <van-field v-model="newFolderName" placeholder="请输入文件夹名称" style="margin: 10px 16px;" />
    </van-dialog>

    <!-- 重命名 -->
    <van-dialog
      v-model:show="showRename"
      title="重命名"
      show-cancel-button
      :before-close="onRename"
    >
      <van-field v-model="renameValue" placeholder="请输入新名称" style="margin: 10px 16px;" />
    </van-dialog>

    <!-- 移动到：目录选择 -->
    <van-popup v-model:show="showMove" position="right" class="move-popup">
      <div class="move-header">
        <van-icon v-if="moveParentId !== 0" name="arrow-left" @click="moveGoUp" />
        <van-icon v-else name="cross" @click="showMove = false" />
        <span>移动到</span>
        <span class="move-here" @click="doMove(moveParentId)">移到这里</span>
      </div>
      <div class="move-crumb">
        <span @click="moveParentId = 0">全部文件</span>
        <template v-for="(item, idx) in moveBreadcrumb.slice(1)" :key="item.id">
          <span class="sep">/</span><span @click="loadMoveDir(item.id)">{{ item.name }}</span>
        </template>
      </div>
      <div class="move-list">
        <div v-for="d in moveDirs" :key="d.id" class="file-item" @click="loadMoveDir(d.id)">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="#ffc53d"><path d="M10 4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6z"/></svg>
          <div class="file-meta"><div class="file-name">{{ d.name }}</div></div>
        </div>
        <van-empty v-if="moveDirs.length === 0" description="没有子文件夹" />
      </div>
    </van-popup>

    <!-- 多选批量操作栏 -->
    <div v-if="selectMode" class="batch-bar">
      <van-button block round type="danger" size="small" :disabled="selected.size === 0" @click="batchDelete">
        删除{{ selected.size ? '（' + selected.size + '）' : '' }}
      </van-button>
    </div>

    <input ref="fileInput" type="file" multiple class="hidden-input" @change="onFilePicked" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, onUnmounted } from 'vue'
import { pushBackHandler } from '@/utils/back'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import { useFileStore } from '@/stores/file'
import { useTransferStore } from '@/stores/transfer'
import { fileApi, uploadApi } from '@/api'
import { formatSize } from '@/utils/file'

const fileStore = useFileStore()
const transfer = useTransferStore()

const refreshing = ref(false)
const canGoUp = computed(() => fileStore.currentParentId !== 0)
const orderedFiles = computed(() => {
  const dirs = fileStore.files.filter(f => f.isDir)
  const files = fileStore.files.filter(f => !f.isDir)
  return dirs.concat(files)
})

// Android 返回键：先关弹层，再退多选，再回上级目录；都无可退则交还给全局
const removeBackHandler = pushBackHandler(() => {
  if (showMove.value) {
    if (moveParentId.value !== 0) moveGoUp()
    else showMove.value = false
    return true
  }
  if (showActionSheet.value) { showActionSheet.value = false; return true }
  if (showAddSheet.value) { showAddSheet.value = false; return true }
  if (selectMode.value) { exitSelect(); return true }
  if (canGoUp.value) { goUp(); return true }
  return false
})
onUnmounted(removeBackHandler)

let firstActivated = true
onActivated(() => {
  // keep-alive 缓存页：从回收站等切回时自动刷新，保证看到最新目录（含刚还原的文件）。
  // 首次激活与 onMounted 同时发生，跳过避免重复加载。
  if (firstActivated) { firstActivated = false; return }
  fileStore.refresh()
})
onMounted(() => {
  if (fileStore.files.length === 0) fileStore.loadDir(0, { reset: true })
})

function onLoad() {
  fileStore.loadMore()
}
function onRefresh() {
  fileStore.refresh().finally(() => { refreshing.value = false })
}
function enterDir(id) {
  fileStore.enter(id)
}
function goUp() {
  if (!canGoUp.value) return
  const crumbs = fileStore.breadcrumb
  const parent = crumbs.length >= 2 ? crumbs[crumbs.length - 2].id : 0
  fileStore.enter(parent)
}

// 图标映射
function iconOf(f) {
  if (f.isDir) return 'cluster-o'
  const map = {
    pdf: 'description', image: 'photo-o', word: 'description', excel: 'balance-list-o',
    ppt: 'notes-o', video: 'video-o', audio: 'music-o', archive: 'records', text: 'description'
  }
  return map[f.type] || 'description'
}
function colorOf(f) {
  if (f.isDir) return '#ffb300'
  const map = {
    pdf: '#ff5252', image: '#4caf50', word: '#2196f3', excel: '#4caf50',
    ppt: '#ff7043', video: '#ab47bc', audio: '#ff9800', archive: '#78909c', text: '#607d8b'
  }
  return map[f.type] || '#607d8b'
}
function shortDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return (d.getMonth() + 1) + '-' + d.getDate()
}

// ===== 添加 =====
const showAddSheet = ref(false)
const addActions = [
  { name: '上传文件', icon: 'upgrade' },
  { name: '新建文件夹', icon: 'add-o' }
]
const fileInput = ref(null)
function onAddSelect(action) {
  if (action.name === '上传文件') fileInput.value && fileInput.value.click()
  else showMkdir.value = true
}
function onFilePicked(e) {
  const picked = Array.from(e.target.files || [])
  if (!picked.length) return
  const parentId = fileStore.currentParentId
  let done = 0
  picked.forEach(f => {
    transfer.upload(f, parentId).then(() => {
      done++
      if (done === picked.length) fileStore.refresh()
    }).catch(() => {
      done++
      if (done === picked.length) fileStore.refresh()
    })
  })
  e.target.value = ''
  showToast({ message: '已加入传输任务', position: 'bottom' })
}

// 新建文件夹
const showMkdir = ref(false)
const newFolderName = ref('')
function onMkdir(action) {
  if (action === 'confirm') {
    const name = newFolderName.value.trim()
    if (!name) { showToast('请输入名称'); return false }
    return fileApi.mkdir({ parentId: fileStore.currentParentId, name })
      .then(() => { newFolderName.value = ''; fileStore.refresh(); return true })
      .catch(() => false)
  }
  newFolderName.value = ''
  return true
}

// ===== 单文件操作 =====
const showActionSheet = ref(false)
const currentFile = ref(null)
const currentActions = computed(() => {
  const f = currentFile.value
  if (!f) return []
  const acts = []
  if (!f.isDir) acts.push({ name: '下载', icon: 'down' })
  acts.push({ name: '重命名', icon: 'edit' })
  acts.push({ name: '移动到', icon: 'apps-o' })
  acts.push({ name: '删除', icon: 'delete', color: '#ee0a24' })
  return acts
})
function openActions(file) {
  currentFile.value = file
  showActionSheet.value = true
}
function onActionSelect(action) {
  const f = currentFile.value
  if (action.name === '下载') doDownload(f)
  else if (action.name === '重命名') openRename(f)
  else if (action.name === '移动到') openMove(f)
  else if (action.name === '删除') doDelete(f)
}

// ===== 多选模式 =====
const selectMode = ref(false)
const selected = ref(new Set())

const isAllSelected = computed(() => orderedFiles.value.length > 0 && selected.value.size === orderedFiles.value.length)

// 长按手势（Vue 没有 @long-press，自行用 touch 事件实现）
let lpTimer = null
let lpFired = false // 本次触摸是否已触发长按；触发后吞掉紧随的 click，避免长按后误进目录/下载
function onTouchStart(file, e) {
  lpFired = false
  clearTimeout(lpTimer)
  const t = e.touches && e.touches[0]
  const startX = t ? t.clientX : 0
  const startY = t ? t.clientY : 0
  lpTimer = setTimeout(() => {
    lpFired = true
    onLongPress(file)
  }, 400)
  // 手指移动超过阈值视为滑动，取消长按
  const el = e.currentTarget
  const onMove = ev => {
    const m = ev.touches && ev.touches[0]
    if (m && (Math.abs(m.clientX - startX) > 12 || Math.abs(m.clientY - startY) > 12)) {
      clearTimeout(lpTimer)
      el.removeEventListener('touchmove', onMove)
    }
  }
  el.addEventListener('touchmove', onMove, { passive: true, once: false })
  const clear = () => el.removeEventListener('touchmove', onMove)
  el.addEventListener('touchend', clear, { once: true })
  el.addEventListener('touchcancel', clear, { once: true })
}
function onTouchEnd() {
  clearTimeout(lpTimer)
}
function onLongPress(file) {
  if (selectMode.value) { toggleSelect(file); return }
  selectMode.value = true
  selected.value = new Set([file.id])
}
function toggleSelect(file) {
  const ns = new Set(selected.value)
  if (ns.has(file.id)) ns.delete(file.id)
  else ns.add(file.id)
  selected.value = ns
}
function toggleSelectAll() {
  selected.value = isAllSelected.value ? new Set() : new Set(orderedFiles.value.map(f => f.id))
}
function exitSelect() {
  selectMode.value = false
  selected.value = new Set()
}
function batchDelete() {
  const ids = [...selected.value]
  if (!ids.length) return
  showConfirmDialog({ title: '删除 ' + ids.length + ' 项？', message: '选中内容将移入回收站。' })
    .then(() => Promise.all(ids.map(id => fileApi.remove(id))))
    .then(() => { showSuccessToast('已删除'); exitSelect(); fileStore.refresh() })
    .catch(() => {})
}

function onItemClick(file) {
  if (lpFired) { lpFired = false; return } // 长按已处理，吞掉这次 click
  if (selectMode.value) { toggleSelect(file); return }
  if (file.isDir) enterDir(file.id)
  else doDownload(file)
}

async function doDownload(row) {
  if (row.isDir) { showToast('文件夹暂不支持下载'); return }
  try {
    const { url } = await uploadApi.getDownloadUrl(row.id)
    const a = document.createElement('a')
    a.href = url
    a.download = row.name
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch (e) { /* 已提示 */ }
}

const showRename = ref(false)
const renameValue = ref('')
function openRename(f) {
  currentFile.value = f
  renameValue.value = f.name
  showRename.value = true
}
function onRename(action) {
  if (action === 'confirm') {
    const name = renameValue.value.trim()
    if (!name) { showToast('请输入名称'); return false }
    return fileApi.update(currentFile.value.id, { name })
      .then(() => { fileStore.refresh(); return true })
      .catch(() => false)
  }
  return true
}

// 删除
function doDelete(f) {
  showConfirmDialog({ title: '删除文件？', message: '「' + f.name + '」将移入回收站，可在回收站还原。' })
    .then(() => fileApi.remove(f.id))
    .then(() => { showSuccessToast('已移入回收站'); fileStore.refresh() })
    .catch(() => {})
}

// 移动
const showMove = ref(false)
const moveParentId = ref(0)
const moveDirs = ref([])
const moveBreadcrumb = ref([{ id: 0, name: '全部文件' }])
function openMove(f) {
  currentFile.value = f
  moveParentId.value = 0
  loadMoveDir(0)
  showMove.value = true
}
function moveGoUp() {
  const bc = moveBreadcrumb.value
  const parent = bc.length >= 2 ? bc[bc.length - 2].id : 0
  loadMoveDir(parent)
}

async function loadMoveDir(id) {
  moveParentId.value = id
  try {
    const res = await fileApi.listDir({ parent: id, page: 1, size: 200 })
    moveDirs.value = (res.list || []).filter(x => x.isDir)
    moveBreadcrumb.value = [{ id: 0, name: '全部文件' }, ...(res.breadcrumb || [])]
  } catch (e) {}
}
function doMove(targetId) {
  fileApi.update(currentFile.value.id, { parentId: targetId })
    .then(() => { showSuccessToast('已移动'); showMove.value = false; fileStore.refresh() })
    .catch(() => {})
}
</script>

<style scoped>
.file-page { display: flex; flex-direction: column; height: 100%; background: #fff; }
.topbar {
  height: 46px; display: flex; align-items: center; padding: 0 14px; gap: 10px;
}
.back-icon { font-size: 20px; color: #323233; flex-shrink: 0; }
.back-icon.disabled { color: #c8c9cc; }
.crumb-scroll { flex: 1; overflow-x: auto; white-space: nowrap; font-size: 15px; -webkit-overflow-scrolling: touch; }
.crumb { color: #1989fa; }
.sep { color: #c8c9cc; margin: 0 4px; }
.add-icon { font-size: 22px; color: #1989fa; flex-shrink: 0; }
.list-scroll { flex: 1; overflow-y: auto; padding-bottom: calc(84px + env(safe-area-inset-bottom)); background: #fff; }
.file-item {
  display: flex; align-items: center; padding: 12px 16px; background: #fff;
  border-bottom: 1px solid #f2f3f5; gap: 12px;
}
.file-item:active { background: #f7f8fa; }
.file-icon { flex-shrink: 0; }
.file-meta { flex: 1; min-width: 0; }
.file-name {
  font-size: 15px; color: #323233; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.file-sub { font-size: 12px; color: #969799; margin-top: 3px; }
.more-icon { color: #c8c9cc; font-size: 18px; padding: 4px; flex-shrink: 0; }
.hidden-input { display: none; }

.move-popup { width: 100%; max-width: 480px; display: flex; flex-direction: column; height: 100%; padding-top: env(safe-area-inset-top); }
.move-header {
  height: 48px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px; border-bottom: 1px solid #f2f3f5; font-size: 16px; font-weight: 600;
}
.move-here { color: #1989fa; font-size: 14px; font-weight: 500; }
.move-crumb { padding: 10px 16px; font-size: 13px; color: #1989fa; white-space: nowrap; overflow-x: auto; border-bottom: 1px solid #f2f3f5; }
.move-list { flex: 1; overflow-y: auto; }

.select-bar { justify-content: space-between; }
.sel-count { flex: 1; font-size: 16px; font-weight: 600; margin-left: 12px; }
.sel-all { font-size: 14px; color: #1989fa; padding: 6px 4px; }
.sel-check { margin-right: 4px; }
.file-item.selected { background: #e8f3ff; }
.batch-bar { position: fixed; left: 14px; right: 14px; bottom: calc(84px + env(safe-area-inset-bottom)); background: #fff; padding: 12px 16px; border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,.10); z-index: 99; }

.file-item { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }

.bottom-spacer { height: calc(80px + env(safe-area-inset-bottom)); flex-shrink: 0; }
</style>
