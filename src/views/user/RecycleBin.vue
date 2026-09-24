<template>
  <div class="page">
    <header class="app-header">
      <div class="page-title">回收站</div>
    </header>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh" class="list">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        :finished-text="refreshing ? '' : '没有更多了'"
        @load="load"
        :immediate-check="true"
      >
        <template #loading>
          <div v-if="!refreshing" class="list-loading"><van-loading size="18">加载中...</van-loading></div>
        </template>

        <div v-for="f in rows" :key="f.id" class="rb-card">
          <div class="rb-main">
            <svg v-if="f.isDir" viewBox="0 0 24 24" width="24" height="24" fill="#ffc53d"><path d="M10 4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6z"/></svg>
            <van-icon v-else name="description" color="#969799" size="24" />
            <div class="rb-meta">
              <div class="rb-name">{{ f.name }}</div>
              <div class="rb-sub">{{ f.isDir ? '文件夹' : formatSize(f.size) }} · 删除于 {{ shortDate(f.deletedAt) }}</div>
            </div>
          </div>
          <div class="rb-ops">
            <van-button size="small" type="primary" plain hairline @click="onRestore(f)">还原</van-button>
            <van-button size="small" type="danger" plain hairline @click="onPurge(f)">删除</van-button>
          </div>
        </div>

        <van-empty v-if="finished && rows.length === 0" description="回收站是空的" />
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<script setup>
import { ref, onActivated } from 'vue'
import { showSuccessToast, showConfirmDialog } from 'vant'
import { fileApi } from '@/api'
import { mapFileNode, formatSize } from '@/utils/file'

const rows = ref([])
const page = ref(1)
const size = 20
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
let reqToken = 0 // 请求代次：只接受最新一次刷新/翻页的结果，丢弃重复/过期响应

async function load() {
  const myToken = reqToken
  try {
    const res = await fileApi.trash({ page: page.value, size })
    if (myToken !== reqToken) return // 已被更新的刷新取代，丢弃本页，避免重复数据
    const list = (res.list || []).map(f => mapFileNode(f, { deletedAt: f.deletedAt }))
    rows.value = page.value === 1 ? list : rows.value.concat(list) // 第1页整体替换，翻页才追加
    const total = res.total || 0
    if (list.length === 0 || rows.value.length >= total) {
      finished.value = true
    } else {
      page.value += 1
    }
  } catch (e) {
    finished.value = true
  } finally {
    if (myToken === reqToken) loading.value = false
  }
}

function reset() {
  reqToken++ // 使所有进行中的旧请求作废
  page.value = 1
  finished.value = false
  loading.value = true
  // 不清空 rows：等新数据到达后整体替换，避免刷新瞬间列表闪白
}

function onRefresh() {
  reset()
  load()
  refreshing.value = false
}

let firstActivated = true
onActivated(() => {
  // 从文件页切回时自动刷新（文件页新删的要能立刻看到）；首次激活跳过，与列表自身初始加载去重
  if (firstActivated) { firstActivated = false; return }
  reset()
  load()
})

function reloadAfterAction() {
  reset()
  load()
}

function onRestore(f) {
  showConfirmDialog({ title: '还原文件？', message: '「' + f.name + '」将还原到原来的位置。' })
    .then(() => fileApi.restore(f.id, {}))
    .then(() => { showSuccessToast('已还原'); reloadAfterAction() })
    .catch(() => {})
}

function onPurge(f) {
  showConfirmDialog({ title: '彻底删除？', message: '「' + f.name + '」将被永久删除，无法恢复。' })
    .then(() => fileApi.remove(f.id, 1))
    .then(() => { showSuccessToast('已彻底删除'); reloadAfterAction() })
    .catch(() => {})
}

function iconOf(f) {
  if (f.isDir) return 'cluster-o'
  return 'description'
}
function colorOf(f) {
  return f.isDir ? '#ffb300' : '#969799'
}
function shortDate(iso) {
  if (!iso) return '--'
  const d = new Date(iso)
  return (d.getMonth() + 1) + '-' + d.getDate()
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100%; }
.list { flex: 1; overflow-y: auto; }
.rb-card { padding: 12px 16px; border-bottom: 1px solid #f2f3f5; }
.rb-main { display: flex; align-items: center; gap: 12px; }
.rb-meta { flex: 1; min-width: 0; }
.rb-name { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rb-sub { font-size: 12px; color: #969799; margin-top: 3px; }
.rb-ops { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
</style>
