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
        <h3 class="chart-title">近 7 日流量趋势</h3>
        <div ref="trafficChart" class="chart-container"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import { useAppStore } from '@/stores/app'
import { mockStats, mockTopUsers, mockTrafficData } from '@/mock/stats'

const appStore = useAppStore()
const topUsersChart = ref(null)
const trafficChart = ref(null)
let topChart = null, flowChart = null

const statCards = computed(() => [
  { label: '总容量', value: formatSize(mockStats.totalCapacity), icon: 'Coin', gradient: 'stat-card-gradient-1' },
  { label: '已使用', value: formatSize(mockStats.usedCapacity), icon: 'Loading', gradient: 'stat-card-gradient-2' },
  { label: '注册用户', value: mockStats.totalUsers + ' 人', icon: 'UserFilled', gradient: 'stat-card-gradient-3' },
  { label: '文件总数', value: mockStats.totalFiles.toLocaleString(), icon: 'Files', gradient: 'stat-card-gradient-4' }
])

function getTextColor() { return appStore.theme === 'dark' ? '#e6edf3' : '#1f2937' }
function getSubTextColor() { return appStore.theme === 'dark' ? '#8b949e' : '#6b7280' }
function getBorderColor() { return appStore.theme === 'dark' ? '#30363d' : '#e5e7eb' }

function initTopUsersChart() {
  if (!topUsersChart.value) return
  if (topChart) topChart.dispose()
  topChart = echarts.init(topUsersChart.value)
  const isDark = appStore.theme === 'dark'
  const sorted = [...mockTopUsers].sort((a, b) => a.used - b.used)
  topChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: p => p[0].name + ': ' + formatSize(p[0].value) },
    grid: { left: 80, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: getSubTextColor(), formatter: v => formatSize(v) }, splitLine: { lineStyle: { color: getBorderColor() } }, axisLine: { show: false } },
    yAxis: { type: 'category', data: sorted.map(u => u.username), axisLabel: { color: getTextColor() }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: 'bar', data: sorted.map(u => ({ value: u.used, itemStyle: { color: new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:isDark?'#3b82f6':'#1677ff'},{offset:1,color:isDark?'#8b5cf6':'#764ba2'}]), borderRadius: [0,4,4,0] } })), barWidth: 20 }]
  })
}

function initTrafficChart() {
  if (!trafficChart.value) return
  if (flowChart) flowChart.dispose()
  flowChart = echarts.init(trafficChart.value)
  flowChart.setOption({
    tooltip: { trigger: 'axis', formatter: params => params[0].axisValue + '<br/>' + params.map(p => p.marker + p.seriesName + ': ' + formatSize(p.value)).join('<br/>') },
    legend: { data: ['上传','下载'], top: 0, textStyle: { color: getTextColor() } },
    grid: { left: 60, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: mockTrafficData.dates, axisLabel: { color: getSubTextColor() }, axisLine: { lineStyle: { color: getBorderColor() } } },
    yAxis: { type: 'value', axisLabel: { color: getSubTextColor(), formatter: v => formatSize(v) }, splitLine: { lineStyle: { color: getBorderColor() } }, axisLine: { show: false } },
    series: [
      { name: '上传', type: 'line', smooth: true, data: mockTrafficData.upload, lineStyle: { color: '#1677ff', width: 2 }, itemStyle: { color: '#1677ff' }, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(22,119,255,0.25)'},{offset:1,color:'rgba(22,119,255,0.02)'}]) } },
      { name: '下载', type: 'line', smooth: true, data: mockTrafficData.download, lineStyle: { color: '#764ba2', width: 2 }, itemStyle: { color: '#764ba2' }, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(118,75,162,0.25)'},{offset:1,color:'rgba(118,75,162,0.02)'}]) } }
    ]
  })
}

function formatSize(bytes) { if (!bytes) return '0 B'; const k=1024,s=['B','KB','MB','GB','TB']; const i=Math.floor(Math.log(bytes)/Math.log(k)); return parseFloat((bytes/Math.pow(k,i)).toFixed(1))+s[i] }
function refreshCharts() { initTopUsersChart(); initTrafficChart() }
function handleResize() { topChart?.resize(); flowChart?.resize() }

onMounted(() => { refreshCharts(); window.addEventListener('resize', handleResize) })
onBeforeUnmount(() => { window.removeEventListener('resize', handleResize); topChart?.dispose(); flowChart?.dispose() })
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
</style>