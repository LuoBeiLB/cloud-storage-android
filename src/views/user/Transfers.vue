<template>
  <div class="page">
    <header class="app-header">
      <div class="page-title">
        传输任务
        <span v-if="doneList.length" class="clear-done" @click="transfer.clearDone()">清空已完成</span>
      </div>
    </header>

    <div class="list">
      <div v-for="t in sortedTasks" :key="t.id" class="task-card">
        <div class="task-head">
          <van-icon :name="state === 'done' ? 'passed' : 'underway-o'" :color="iconColor(t)" size="20" />
          <span class="task-name">{{ t.name }}</span>
        </div>

        <div class="task-progress">
          <van-progress
            :percentage="transfer.percent(t)"
            :color="progressColor(t)"
            :show-pivot="stateOf(t) === 'uploading' || stateOf(t) === 'waiting'"
            :pivot-text="transfer.percent(t) + '%'"
            stroke-width="6"
          />
        </div>

        <div class="task-status">
          <span :class="['state', stateOf(t)]">{{ statusText(t) }}</span>
        </div>

        <div class="task-actions">
          <template v-if="stateOf(t) === 'done'">
            <van-button size="small" plain @click="transfer.removeRecord(t)">移除记录</van-button>
          </template>
          <template v-else-if="stateOf(t) === 'uploading' || stateOf(t) === 'waiting'">
            <van-button size="small" type="warning" plain @click="transfer.pauseTask(t)">暂停</van-button>
            <van-button size="small" type="danger" plain @click="transfer.discardTask(t)">放弃</van-button>
          </template>
          <template v-else>
            <van-button size="small" type="primary" @click="transfer.resumeTask(t)">继续</van-button>
            <van-button size="small" type="danger" plain @click="transfer.discardTask(t)">放弃</van-button>
          </template>
        </div>
      </div>

      <van-empty v-if="transfer.tasks.length === 0" description="暂无传输任务" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTransferStore } from '@/stores/transfer'

const transfer = useTransferStore()
const stateOf = transfer.stateOf

const sortedTasks = computed(() => {
  const rank = { waiting: 0, uploading: 1, paused: 2, done: 3 }
  return [...transfer.tasks].sort((a, b) => (rank[stateOf(a)] ?? 9) - (rank[stateOf(b)] ?? 9))
})
const doneList = computed(() => transfer.tasks.filter(t => stateOf(t) === 'done'))

function statusText(t) {
  const s = stateOf(t)
  if (s === 'done') return '已完成'
  if (s === 'uploading') return '上传中 ' + (t.doneParts || 0) + '/' + (t.totalParts || 0)
  if (s === 'waiting') return transfer.hashing[t.id] != null ? '正在校验指纹 ' + transfer.hashing[t.id] + '%' : '准备中…'
  return '已暂停 ' + (t.doneParts || 0) + '/' + (t.totalParts || 0)
}
function iconColor(t) {
  const s = stateOf(t)
  if (s === 'done') return '#07c160'
  if (s === 'paused') return '#c8c9cc'
  return '#1989fa'
}
function progressColor(t) {
  const s = stateOf(t)
  if (s === 'done') return '#07c160'
  if (s === 'paused') return '#c8c9cc'
  return '#1989fa'
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100%; padding-bottom: calc(84px + env(safe-area-inset-bottom)); }
.page-title .clear-done {
  position: absolute; right: 14px; font-size: 13px; color: #1989fa; font-weight: 400;
}
.list { flex: 1; overflow-y: auto; padding: 10px 12px; }
.task-card {
  background: #fff; border-radius: 12px; padding: 12px 14px; margin-bottom: 10px;
}
.task-head { display: flex; align-items: center; gap: 8px; }
.task-name { font-size: 15px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.task-progress { margin: 12px 0 6px; }
.task-status .state { font-size: 12px; color: #969799; }
.task-status .state.uploading, .task-status .state.waiting { color: #1989fa; }
.task-status .state.done { color: #07c160; }
.task-actions { display: flex; gap: 10px; margin-top: 12px; }
</style>
