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
        <div class="chart-header">
          <h3 class="chart-title">近 {{ trafficDays }} 日流量趋势</h3>
          <el-radio-group v-model="trafficDays" size="small" @change="loadTraffic">
            <el-radio-button :value="7">7 天</el-radio-button>
            <el-radio-button :value="30">30 天</el-radio-button>
            <el-radio-button :value="90">90 天</el-radio-button>
          </el-radio-group>
        </div>
        <div ref="trafficChart" class="chart-container"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import { useAppStore } from '@/stores/app'
import { adminApi } from '@/api'
import { formatSize } from '@/utils/file'

const appStore = useAppStore()
const topUsersChart = ref(null)
const trafficChart = ref(null)
let topChartInstance = null, trafficChartInstance = null

// R-C09 管理端统计数据
const adminOverview = ref({ totalQuotaBytes: 0, usedBytes: 0, remainingBytes: 0, userCount: 0 })
const topUsers = ref([])
const trafficData = ref([])
const trafficDays = ref(7)

const statCards = computed(() => [
  { label: '总配额', value: formatSize(adminOverview.value.totalQuotaBytes), icon: 'Wallet', gradient: 'stat-card-gradient-1' },
  { label: '已用空间', value: formatSize(adminOverview.value.usedBytes), icon: 'Coin', gradient: 'stat-card-gradient-2' },
  { label: '剩余空间', value: formatSize(adminOverview.value.remainingBytes), icon: 'TrendCharts', gradient: 'stat-card-gradient-3' },
  { label: '注册用户数', value: adminOverview.value.userCount.toLocaleString(), icon: 'User', gradient: 'stat-card-gradient-4' }
])

function getTextColor() { return appStore.theme === 'dark' ? '#e6edf3' : '#1f2937' }
function getSubTextColor() { return appStore.theme === 'dark' ? '#8b949e' : '#6b7280' }
function getBorderColor() { return appStore.theme === 'dark' ? '#30363d' : '#e5e7eb' }

// 加载平台总览
async function loadOverview() {
  try {
    const data = await adminApi.statsOverview()
    adminOverview.value = data
  } catch (e) {
    // code=40301 无权限，拦截器已提示
  }
}

// 加载 Top 榜
async function loadTopUsers() {
  try {
    const data = await adminApi.statsTopUsers()
    topUsers.value = Array.isArray(data) ? data : []
  } catch (e) {
    topUsers.value = []
  }
}

// 加载流量曲线
async function loadTraffic() {
  try {
    const data = await adminApi.statsTraffic(trafficDays.value)
    trafficData.value = Array.isArray(data) ? data : []
  } catch (e) {
    trafficData.value = []
  }
  initTrafficChart()
}

// Top 榜横向柱状图
function initTopUsersChart() {
  if (!topUsersChart.value) return
  if (topChartInstance) topChartInstance.dispose()
  topChartInstance = echarts.init(topUsersChart.value)
  const isDark = appStore.theme === 'dark'
  const sorted = [...topUsers.value].sort((a, b) => a.usedBytes - b.usedBytes)
  topChartInstance.setOption({
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: p => {
        const item = sorted[p[0].dataIndex]
        return `${item.username}<br/>已用: ${formatSize(item.usedBytes)}<br/>配额: ${formatSize(item.quotaBytes)}`
      }
    },
    grid: { left: 80, right: 30, top: 10, bottom: 20 },
    xAxis: {
      type: 'value',
      axisLabel: { color: getSubTextColor(), formatter: v => formatSize(v) },
      splitLine: { lineStyle: { color: getBorderColor() } },
      axisLine: { show: false }
    },
    yAxis: {
      type: 'category',
      data: sorted.map(u => u.username),
      axisLabel: { color: getTextColor() },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    series: [{
      type: 'bar',
      data: sorted.map(u => ({
        value: u.usedBytes,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: isDark ? '#3b82f6' : '#1677ff' },
            { offset: 1, color: isDark ? '#8b5cf6' : '#764ba2' }
          ]),
          borderRadius: [0, 4, 4, 0]
        }
      })),
      barWidth: 20
    }]
  })
}

// 流量趋势折线图
function initTrafficChart() {
  if (!trafficChart.value) return
  if (trafficChartInstance) trafficChartInstance.dispose()
  trafficChartInstance = echarts.init(trafficChart.value)
  const isDark = appStore.theme === 'dark'
  const dates = trafficData.value.map(d => d.date)
  const uploads = trafficData.value.map(d => d.uploadBytes)
  const downloads = trafficData.value.map(d => d.downloadBytes)
  trafficChartInstance.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: p => {
        let s = p[0].axisValue
        p.forEach(item => { s += `<br/>${item.marker}${item.seriesName}: ${formatSize(item.value)}` })
        return s
      }
    },
    legend: {
      data: ['上传', '下载'],
      textStyle: { color: getTextColor() },
      top: 0, right: 0
    },
    grid: { left: 60, right: 20, top: 36, bottom: 30 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: getSubTextColor(), fontSize: 11 },
      axisLine: { lineStyle: { color: getBorderColor() } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: getSubTextColor(), formatter: v => formatSize(v) },
      splitLine: { lineStyle: { color: getBorderColor() } },
      axisLine: { show: false }
    },
    series: [
      {
        name: '上传', type: 'line', data: uploads, smooth: true,
        lineStyle: { width: 2, color: isDark ? '#3b82f6' : '#1677ff' },
        itemStyle: { color: isDark ? '#3b82f6' : '#1677ff' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: isDark ? 'rgba(59,130,246,0.3)' : 'rgba(22,119,255,0.15)' },
          { offset: 1, color: 'rgba(255,255,255,0)' }
        ]) }
      },
      {
        name: '下载', type: 'line', data: downloads, smooth: true,
        lineStyle: { width: 2, color: isDark ? '#10b981' : '#52c41a' },
        itemStyle: { color: isDark ? '#10b981' : '#52c41a' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: isDark ? 'rgba(16,185,129,0.3)' : 'rgba(82,196,26,0.15)' },
          { offset: 1, color: 'rgba(255,255,255,0)' }
        ]) }
      }
    ]
  })
}

function refreshCharts() { initTopUsersChart(); initTrafficChart() }
function handleResize() { topChartInstance?.resize(); trafficChartInstance?.resize() }

onMounted(async () => {
  await Promise.allSettled([loadOverview(), loadTopUsers(), loadTraffic()])
  initTopUsersChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  topChartInstance?.dispose()
  trafficChartInstance?.dispose()
})

watch(() => appStore.theme, () => { refreshCharts() })
</script>

<style scoped>
.page-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 600; color: var(--cs-text-primary); margin: 0 0 24px 0; }
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { border-radius: var(--cs-radius-lg); padding: 20px; color: #fff; position: relative; overflow: hidden; transition: transform 0.25s ease, box-shadow 0.25s ease; }
.stat-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
.stat-card::after { content: ''; position: absolute; top: -20px; right: -20px; width: 80px; height: 80px; border-radius: 50%; background: rgba(255,255,255,0.1); }
.stat-card-content { display: flex; align-items: center; gap: 16px; position: relative; z-index: 1; }
.stat-icon { width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-value { font-size: 22px; font-weight: 700; line-height: 1.2; }
.stat-label { font-size: 13px; opacity: 0.85; margin-top: 2px; }
.charts-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
.chart-card { padding: 20px; transition: box-shadow 0.25s ease; }
.chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.chart-title { font-size: 15px; font-weight: 600; color: var(--cs-text-primary); margin: 0; }
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
  .chart-header { flex-wrap: wrap; gap: 8px; }
  .chart-container { height: 240px; }
}
</style>
