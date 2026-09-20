<template>
  <div class="cs-page">
    <!-- 页头 -->
    <div class="transfer-head">
      <div class="transfer-head__left">
        <h2 class="page-title"><el-icon><Upload /></el-icon>传输任务</h2>
        <p class="transfer-subtitle">上传记录实时展示，未完成任务可暂停、续传或放弃</p>
      </div>
      <el-button v-if="doneCount > 0" text size="small" @click="transfer.clearDone()">
        <el-icon><Delete /></el-icon><span>清空已完成（{{ doneCount }}）</span>
      </el-button>
    </div>

    <!-- 任务列表（整体一个卡片，行式布局） -->
    <div class="cs-card task-panel">
      <!-- 空状态 -->
      <div v-if="!transfer.tasks.length" class="panel-empty">
        <el-empty description="当前没有传输任务" :image-size="120" />
        <p class="empty-tip">上传文件后，任务将显示在这里，支持断点续传</p>
      </div>

      <!-- 任务行 -->
      <div v-for="t in sortedTasks" v-else :key="t.id" class="task-row">
        <div class="task-row__icon" :style="iconStyle(t)">
          <el-icon :size="20"><component :is="getIconName(t)" /></el-icon>
        </div>

        <div class="task-row__main">
          <div class="task-row__title">
            <span class="task-row__name" :title="t.name">{{ t.name }}</span>
            <span class="task-row__size">{{ formatSize(t.size || 0) }}</span>
          </div>

          <!-- 传输中 / 已暂停：进度条 -->
          <div v-if="stateOf(t) === 'uploading' || stateOf(t) === 'paused'" class="task-row__progress">
            <span class="progress-track">
              <span class="progress-fill" :class="{ 'is-paused': stateOf(t) === 'paused' }" :style="{ width: transfer.percent(t) + '%' }"></span>
            </span>
            <span class="progress-pct" :class="{ 'is-paused': stateOf(t) === 'paused' }">{{ transfer.percent(t) }}%</span>
            <span v-if="stateOf(t) === 'paused'" class="progress-hint">已暂停</span>
          </div>

          <!-- 等待上传 -->
          <div v-else-if="stateOf(t) === 'waiting'" class="task-row__status is-waiting">
            <el-icon><Clock /></el-icon><span>等待上传</span>
          </div>

          <!-- 已完成 -->
          <div v-else class="task-row__status is-done">
            <el-icon><CircleCheckFilled /></el-icon><span>已完成</span>
          </div>
        </div>

        <div class="task-row__ops">
          <el-tooltip v-if="stateOf(t) === 'uploading'" content="暂停" placement="top">
            <button class="op-btn" @click="transfer.pauseTask(t)"><el-icon><VideoPause /></el-icon></button>
          </el-tooltip>
          <template v-else-if="stateOf(t) === 'paused' || stateOf(t) === 'waiting'">
            <el-tooltip content="继续上传" placement="top">
              <button class="op-btn is-primary" @click="transfer.resumeTask(t)"><el-icon><VideoPlay /></el-icon></button>
            </el-tooltip>
            <el-tooltip content="放弃任务" placement="top">
              <button class="op-btn" @click="transfer.discardTask(t)"><el-icon><Close /></el-icon></button>
            </el-tooltip>
          </template>
          <el-tooltip v-else content="移除记录" placement="top">
            <button class="op-btn" @click="transfer.removeRecord(t)"><el-icon><Close /></el-icon></button>
          </el-tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { formatSize, extToType } from '@/utils/file'
import { useTransferStore } from '@/stores/transfer'

const transfer = useTransferStore()

onMounted(() => transfer.refresh())

const stateOf = t => transfer.stateOf(t)

// ---- 文件图标（与文件列表一致：类型色浅底 + 彩色图标）----
const iconMap = { pdf: 'Document', image: 'Picture', word: 'Document', excel: 'Grid', ppt: 'Monitor', video: 'VideoCamera', audio: 'Headset', archive: 'Files', text: 'Notebook' }
const iconColorMap = { pdf: '#ff4d4f', image: '#52c41a', word: '#1677ff', excel: '#52c41a', ppt: '#fa8c16', video: '#722ed1', audio: '#13c2c2', archive: '#8c8c8c', text: '#595959' }
function getIconName(t) { return iconMap[extToType(t.name)] || 'Document' }
function iconStyle(t) {
  const c = iconColorMap[extToType(t.name)] || '#8c8c8c'
  return { color: c, background: c + '1a' }
}

// ---- 统计与排序：进行中在前，已完成在后 ----
const doneCount = computed(() => transfer.tasks.filter(t => transfer.stateOf(t) === 'done').length)
const ORDER = { uploading: 0, waiting: 1, paused: 2, done: 3 }
const sortedTasks = computed(() => {
  return [...transfer.tasks].sort((a, b) => {
    const oa = ORDER[transfer.stateOf(a)] ?? 9
    const ob = ORDER[transfer.stateOf(b)] ?? 9
    if (oa !== ob) return oa - ob
    return (b.updatedAt || 0) - (a.updatedAt || 0) // 同状态：新任务在前
  })
})
</script>

<style scoped>
/* ===== 页头 ===== */
.transfer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.transfer-subtitle { font-size: 13px; color: var(--cs-text-secondary); margin: 6px 0 0 28px; }

/* ===== 任务面板（整体一个卡片）===== */
.task-panel { overflow: hidden; }

/* 空状态 */
.panel-empty { padding: 48px 24px 40px; text-align: center; }
.empty-tip { font-size: 13px; color: var(--cs-text-tertiary); margin: 4px 0 20px; }

/* ===== 任务行 ===== */
.task-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  transition: background 0.2s ease;
  animation: rowIn 0.3s ease;
}
.task-row + .task-row { border-top: 1px solid var(--cs-border-light); }
.task-row:hover { background: var(--cs-bg-hover); }
@keyframes rowIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

.task-row__icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
}

.task-row__main { flex: 1; min-width: 0; }
.task-row__title { display: flex; align-items: center; gap: 10px; }
.task-row__name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--cs-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-row__size { flex-shrink: 0; font-size: 12px; color: var(--cs-text-tertiary); }

/* ===== 进度条 ===== */
.task-row__progress { display: flex; align-items: center; gap: 10px; margin-top: 7px; }
.progress-track { display: block; flex: 1; height: 5px; background: var(--cs-bg-hover); border-radius: 100px; overflow: hidden; }
.progress-fill {
  display: block;
  height: 100%;
  border-radius: 100px;
  background: linear-gradient(90deg, var(--cs-primary), var(--cs-primary-light));
  background-size: 200% 100%;
  animation: flow 1.4s linear infinite;
  transition: width 0.25s ease;
}
.progress-fill.is-paused { background: var(--cs-warning); background-size: 100% 100%; animation: none; }
@keyframes flow { from { background-position: 0% 0; } to { background-position: -200% 0; } }
.progress-pct { flex-shrink: 0; font-size: 12px; font-weight: 600; color: var(--cs-primary); min-width: 34px; text-align: right; font-variant-numeric: tabular-nums; }
.progress-pct.is-paused { color: var(--cs-warning); }
.progress-hint { flex-shrink: 0; font-size: 12px; color: var(--cs-warning); }

/* ===== 状态文字 ===== */
.task-row__status { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; margin-top: 7px; }
.task-row__status.is-waiting { color: var(--cs-text-tertiary); }
.task-row__status.is-done { color: var(--cs-success); }

/* ===== 操作按钮 ===== */
.task-row__ops { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.op-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--cs-text-tertiary);
  cursor: pointer;
  font-size: 15px;
  transition: all 0.2s ease;
}
.op-btn:hover { background: var(--cs-bg-hover); color: var(--cs-text-primary); transform: translateY(-1px); }
.op-btn.is-primary { color: var(--cs-primary); }
.op-btn.is-primary:hover { background: var(--cs-primary-lighter); color: var(--cs-primary); }
/* 放弃/移除 hover 变红 */
.task-row__ops .op-btn:not(.is-primary):hover { color: var(--cs-danger); background: rgba(255, 77, 79, 0.08); }

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .transfer-subtitle { margin-left: 0; }
  .task-row { flex-wrap: wrap; padding: 12px 14px; gap: 10px; }
  .task-row__main { flex: 1 1 calc(100% - 54px); }
  .task-row__ops { width: 100%; justify-content: flex-end; }
}
</style>
