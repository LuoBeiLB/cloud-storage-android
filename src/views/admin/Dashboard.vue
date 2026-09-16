<template>
  <div class="cs-page">
    <h2 class="page-title"><el-icon><DataAnalysis /></el-icon>统计大盘</h2>
    <div class="stats-row">
      <div v-for="stat in statCards" :key="stat.label" class="stat-card" :class="stat.gradient">
        <div class="stat-card-content">
          <div class="stat-icon"><el-icon :size="24"><component :is="stat.icon" /></el-icon></div>
          <div class="stat-info"><div class="stat-value">{{ stat.value }}</div><div class="stat-label">{{ stat.label }}</div></div>
        </div>
      </div>
    </div>
    <div class="charts-row">
      <div class="cs-card chart-card">
        <h3 class="chart-title">存储用量 Top 10</h3>
        <div ref="topUsersChart" class="chart-container"></div>
      </div>
      <div class="cs-card chart-card">
        <h3 class="chart-title">文件类型分布</h3>
        <div ref="typeChart" class="chart-container"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import { useAppStore } from '@/stores/app'
import { statsApi, adminApi } from '@/api'
import { formatSize } from '@/utils/file'

const appStore = useAppStore()
const topUsersChart = ref(null)
const typeChart = ref(null)
let topChart = null, typeChartInstance = null

// 后端 /stats/overview（个人维度）+ /admin/users（Top10）
const overview = ref({ totalFiles: 0, totalDirs: 0, totalBytes: 0, todayNew: 0, recycleCount: 0, recycleBytes: 0, typeBreakdown: [] })
const topUsers = ref([])

const statCards = computed(() => [
  { label: '已用空间', value: formatSize(overview.value.totalBytes), icon: 'Coin', gradient: 'stat-card-gradient-1' },
  { label: `文件总数（今日 +${overview.value.todayNew}）`, value: overview.value.totalFiles.toLocaleString(), icon: 'Files', gradient: 'stat-card-gradient-4' },
  { label: '目录总数', value: overview.value.totalDirs.toLocaleString(), icon: 'Folder', gradient: 'stat-card-gradient-3' },
  { label: '回收站文件', value: overview.value.recycleCount.toLocaleString(), icon: 'Delete', gradient: 'stat-card-gradient-2' }
])

function getTextColor() { return appStore.theme === 'dark' ? '#e6edf3' : '#1f2937' }
function getSubTextColor() { return appStore.theme === 'dark' ? '#8b949e' : '#6b7280' }
function getBorderColor() { return appStore.theme === 'dark' ? '#30363d' : '#e5e7eb' }

function initTopUsersChart() {
  if (!topUsersChart.value) return
  if (topChart) topChart.dispose()
  topChart = echarts.init(topUsersChart.value)
  const isDark = appStore.theme === 'dark'
  const sorted = [...topUsers.value].sort((a, b) => a.used - b.used)
  topChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: p => p[0].name + ': ' + formatSize(p[0].value) },
    grid: { left: 80, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: getSubTextColor(), formatter: v => formatSize(v) }, splitLine: { lineStyle: { color: getBorderColor() } }, axisLine: { show: false } },
    yAxis: { type: 'category', data: sorted.map(u => u.username), axisLabel: { color: getTextColor() }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: 'bar', data: sorted.map(u => ({ value: u.used, itemStyle: { color: new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:isDark?'#3b82f6':'#1677ff'},{offset:1,color:isDark?'#8b5cf6':'#764ba2'}]), borderRadius: [0,4,4,0] } })), barWidth: 20 }]
  })
}

function initTypeChart() {
  if (!typeChart.value) return
  if (typeChartInstance) typeChartInstance.dispose()
  typeChartInstance = echarts.init(typeChart.value)
  const isDark = appStore.theme === 'dark'
  const data = (overview.value.typeBreakdown || []).map(t => ({ name: t.ext ? '.' + t.ext : '其他', value: t.count }))
  typeChartInstance.setOption({
    tooltip: { trigger: 'item', formatter: p => `${p.name}: ${p.value} 个 (${p.percent}%)` },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: getTextColor() } },
    series: [{
      type: 'pie', radius: ['42%', '70%'], center: ['38%', '50%'],
      data,
      label: { color: getSubTextColor() },
      itemStyle: { borderRadius: 6, borderWidth: 2, borderColor: isDark ? '#161b22' : '#fff' }
    }]
  })
}

function refreshCharts() { initTopUsersChart(); initTypeChart() }
function handleResize() { topChart?.resize(); typeChartInstance?.resize() }

onMounted(async () => {
  await Promise.allSettled([
    statsApi.overview().then(s => { overview.value = { ...overview.value, ...s } }),
    adminApi.listUsers({ page: 1, size: 100 }).then(res => {
      topUsers.value = (res.content || [])
        .map(u => ({ username: u.username, used: u.usedBytes || 0 }))
        .sort((a, b) => b.used - a.used)
        .slice(0, 10)
    })
  ])
  refreshCharts()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => { window.removeEventListener('resize', handleResize); topChart?.dispose(); typeChartInstance?.dispose() })
watch(() => appStore.theme, () => { refreshCharts() })
</script>

<style scoped>
.page-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 600; color: var(--cs-text-primary); margin: 0 0 24px 0; }
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { border-radius: var(--cs-radius-lg); padding: 20px; color: #fff; position: relative; overflow: hidden; transition: transform 0.25s ease, box-shadow 0.25s ease; }
.stat-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
.chart-card { transition: box-shadow 0.25s ease; }
.stat-card::after { content: ''; position: absolute; top: -20px; right: -20px; width: 80px; height: 80px; border-radius: 50%; background: rgba(255,255,255,0.1); }
.stat-card-content { display: flex; align-items: center; gap: 16px; position: relative; z-index: 1; }
.stat-icon { width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-value { font-size: 22px; font-weight: 700; line-height: 1.2; }
.stat-label { font-size: 13px; opacity: 0.85; margin-top: 2px; }
.charts-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
.chart-card { padding: 20px; }
.chart-title { font-size: 15px; font-weight: 600; color: var(--cs-text-primary); margin: 0 0 16px 0; }
.chart-container { height: 320px; }
@media (max-width: 1200px) { .stats-row { grid-template-columns: repeat(2, 1fr); } .charts-row { grid-template-columns: 1fr; } }
@media (max-width: 768px) {
  .stats-row { gap: 10px; margin-bottom: 16px; }
  .stat-card { padding: 14px; }
  .stat-card-content { gap: 10px; }
  .stat-icon { width: 40px; height: 40px; border-radius: 10px; }
  .stat-icon .el-icon { font-size: 20px; }
  .stat-value { font-size: 17px; }
  .stat-label { font-size: 12px; }
  .chart-card { padding: 14px; }
  .chart-title { margin-bottom: 12px; }
  .chart-container { height: 240px; }
}
</style>
