<template>
  <div class="page">
    <header class="app-header">
      <div class="page-title">回收站</div>
    </header>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh" class="list">
      <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="load" :immediate-check="false">
        <div v-for="f in rows" :key="f.id" class="rb-item">
          <van-icon :name="f.isDir ? 'folder-o' : 'document'" :color="f.isDir ? '#ffb300' : '#969799'" size="24" />
          <div class="rb-meta">
            <div class="rb-name">{{ f.name }}</div>
            <div class="rb-sub">{{ f.isDir ? '文件夹' : formatSize(f.size) }} · 删除于 {{ shortDate(f.deletedAt) }}</div>
          </div>
        </div>
        <div class="rb-ops">
          <van-button size="small" type="primary" plain @click="onRestore(f)">还原</van-button>
          <van-button size="small" type="danger" plain @click="onPurge(f)">彻底删除</van-button>
        </div>

        <van-empty v-if="finished && rows.length === 0 && !loading" description="回收站是空的" />
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { showToast, showSuccessToast, showConfirmDialog } from 'vant'
import { fileApi } from '@/api'
import { mapFileNode, formatSize } from '@/utils/file'

const rows = ref([])
const page = ref(1)
const size = 20
const total = ref(0)
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)

async function load() {
  try {
    const res = await fileApi.trash({ page: page.value, size })
    const list = (res.list || []).map(f => mapFileNode(f, { deletedAt: f.deletedAt }))
    rows.value = rows.value.concat(list)
    total.value = res.total || 0
    if (rows.value.length >= total.value || list.length === 0) finished.value = true
  } catch (e) {} finally {
    loading.value = false
  }
}

function reset() {
  rows.value = []; page.value = 1; total.value = 0; finished.value = false
}

function onRefresh() {
  reset()
  load()
  setTimeout(() => { refreshing.value = false }, 500)
}

function onRestore(f) {
  showConfirmDialog({ title: '还原文件？', message: '「' + f.name + '」将还原到原来的位置。' })
    .then(() => fileApi.restore(f.id, {}))
    .then(() => { showSuccessToast('已还原'); reset(); load() })
    .catch(() => {})
}

function onPurge(f) {
  showConfirmDialog({ title: '彻底删除？', message: '「' + f.name + '」将被永久删除，无法恢复。' })
    .then(() => fileApi.remove(f.id, 1))
    .then(() => { showSuccessToast('已彻底删除'); reset(); load() })
    .catch(() => {})
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
.rb-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px 4px; }
.rb-meta { flex: 1; min-width: 0; }
.rb-name { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rb-sub { font-size: 12px; color: #969799; margin-top: 3px; }
.rb-ops { display: flex; gap: 10px; padding: 4px 16px 12px 52px; border-bottom: 1px solid #f2f3f5; }
</style>
