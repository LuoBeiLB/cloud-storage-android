<template>
  <div class="file-page">
    <!-- 头部：面包屑 + 操作 -->
    <header class="app-header">
      <div class="topbar">
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
    </header>

    <!-- 列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh" class="list-scroll">
      <van-list
        v-model:loading="listLoading"
        :finished="fileStore.finished"
        finished-text="没有更多了"
        @load="onLoad"
        :immediate-check="false"
      >
        <div
          v-for="file in orderedFiles"
          :key="file.id"
          class="file-item"
          @click="onItemClick(file)"
          @long-press="openActions(file)"
        >
          <van-icon :name="iconOf(file)" :color="colorOf(file)" size="26" class="file-icon" />
          <div class="file-meta">
            <div class="file-name">{{ file.name }}</div>
            <div class="file-sub">{{ file.isDir ? '文件夹' : formatSize(file.size) + ' · ' + shortDate(file.updatedAt) }}</div>
          </div>
          <van-icon name="ellipsis" class="more-icon" @click.stop="openActions(file)" />
        </div>

        <van-empty v-if="fileStore.finished && orderedFiles.length === 0 && !listLoading" description="这个文件夹还是空的" />
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
        <van-icon name="cross" @click="showMove = false" />
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
          <van-icon name="folder-o" color="#ffb300" size="24" />
          <div class="file-meta"><div class="file-name">{{ d.name }}</div></div>
        </div>
        <van-empty v-if="moveDirs.length === 0" description="没有子文件夹" />
      </div>
    </van-popup>

    <input ref="fileInput" type="file" multiple class="hidden-input" @change="onFilePicked" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import { useFileStore } from '@/stores/file'
import { useTransferStore } from '@/stores/transfer'
import { fileApi, uploadApi } from '@/api'
import { formatSize } from '@/utils/file'

const fileStore = useFileStore()
const transfer = useTransferStore()

const refreshing = ref(false)
const listLoading = ref(false)
const canGoUp = computed(() => fileStore.currentParentId !== 0)
const orderedFiles = computed(() => {
  const dirs = fileStore.files.filter(f => f.isDir)
  const files = fileStore.files.filter(f => !f.isDir)
  return dirs.concat(files)
})

onMounted(() => {
  if (fileStore.files.length === 0) fileStore.loadDir(0, { reset: true })
})

function onLoad() {
  fileStore.loadMore().finally(() => { listLoading.value = false })
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
  if (f.isDir) return 'folder-o'
  const map = {
    pdf: 'description', image: 'photo-o', word: 'description', excel: 'balance-list-o',
    ppt: 'notes-o', video: 'video-o', audio: 'music-o', archive: 'records', text: 'document'
  }
  return map[f.type] || 'document'
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
  { name: '上传文件', icon: 'upload' },
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
  const parentId = fileStore.currentParentId.value
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
    return fileApi.mkdir({ parentId: fileStore.currentParentId.value, name })
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

function onItemClick(file) {
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
.file-page { display: flex; flex-direction: column; height: 100%; }
.topbar {
  height: 46px; display: flex; align-items: center; padding: 0 14px; gap: 10px;
}
.back-icon { font-size: 20px; color: #323233; flex-shrink: 0; }
.back-icon.disabled { color: #c8c9cc; }
.crumb-scroll { flex: 1; overflow-x: auto; white-space: nowrap; font-size: 15px; -webkit-overflow-scrolling: touch; }
.crumb { color: #1989fa; }
.sep { color: #c8c9cc; margin: 0 4px; }
.add-icon { font-size: 22px; color: #1989fa; flex-shrink: 0; }
.list-scroll { flex: 1; overflow-y: auto; }
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

.move-popup { width: 100%; max-width: 480px; display: flex; flex-direction: column; height: 100%; }
.move-header {
  height: 48px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px; border-bottom: 1px solid #f2f3f5; font-size: 16px; font-weight: 600;
}
.move-here { color: #1989fa; font-size: 14px; font-weight: 500; }
.move-crumb { padding: 10px 16px; font-size: 13px; color: #1989fa; white-space: nowrap; overflow-x: auto; border-bottom: 1px solid #f2f3f5; }
.move-list { flex: 1; overflow-y: auto; }
</style>
