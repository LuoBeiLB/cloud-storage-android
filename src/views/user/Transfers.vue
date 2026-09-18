<template>
  <div class="transfers">
    <div class="transfers-head">
      <h2 class="transfers-title">传输任务</h2>
      <p class="transfers-sub">未完成的上传可在此续传、暂停或放弃，切换页面续传仍会继续</p>
    </div>

    <el-empty v-if="!transfer.tasks.length" description="当前没有传输任务" :image-size="120" />

    <div v-else class="transfers-list">
      <div v-for="t in transfer.tasks" :key="t.id" class="transfer-item">
        <div class="transfer-item__row">
          <span class="transfer-item__name" :title="t.name">{{ t.name }}</span>
          <el-tag v-if="transfer.resuming[t.id]" size="small" type="success" effect="dark">续传中</el-tag>
          <span class="transfer-item__meta">{{ formatSize(t.size) }} · {{ t.doneParts || 0 }}/{{ t.totalParts }} 片</span>
        </div>
        <el-progress :percentage="transfer.percent(t)" :stroke-width="8" />
        <div class="transfer-item__actions">
          <el-button v-if="!transfer.resuming[t.id]" size="small" type="primary" @click="transfer.resumeTask(t)">继续</el-button>
          <el-button v-else size="small" type="warning" @click="transfer.pauseTask(t)">暂停</el-button>
          <el-button size="small" text type="danger" @click="transfer.discardTask(t)">放弃</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { formatSize } from '@/utils/file'
import { useTransferStore } from '@/stores/transfer'

const transfer = useTransferStore()
onMounted(() => transfer.refresh())
</script>

<style scoped>
.transfers { padding: 24px; max-width: 860px; margin: 0 auto; }
.transfers-head { margin-bottom: 20px; }
.transfers-title { font-size: 20px; font-weight: 600; color: var(--cs-text-primary); margin: 0; }
.transfers-sub { font-size: 13px; color: var(--cs-text-secondary); margin: 6px 0 0; }
.transfer-item { padding: 14px 16px; border: 1px solid var(--cs-header-border); border-radius: var(--cs-radius); margin-bottom: 12px; }
.transfer-item__row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.transfer-item__name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 500; color: var(--cs-text-primary); }
.transfer-item__meta { font-size: 12px; color: var(--cs-text-secondary); white-space: nowrap; }
.transfer-item__actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
</style>
