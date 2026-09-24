<template>
  <div class="billing-page">
    <header class="app-header">
      <div class="topbar">
        <van-icon name="arrow-left" class="back-icon" @click="goBack" />
        <div class="page-title">存储增额</div>
        <span class="topbar-right"></span>
      </div>
    </header>

    <div class="scroll">
      <!-- 额度总览 -->
      <div class="quota-card">
        <div class="quota-head">
          <span class="quota-label">总容量</span>
          <span class="quota-total">{{ formatSize(totalBytes) }}</span>
        </div>
        <van-progress :percentage="usedPercent" :color="barColor" stroke-width="8" track-color="rgba(255,255,255,.25)" />
        <div class="quota-used">已用 {{ formatSize(quota.usedBytes) }} / {{ formatSize(totalBytes) }}</div>
        <div class="quota-break">
          <div class="break-row">
            <span>免费额度</span><span>{{ formatSize(quota.freeBytes) }}</span>
          </div>
          <div class="break-row">
            <span>增额</span>
            <span :class="{ 'extra-warn': expireSoon }">{{ formatSize(quota.extraBytes) }}<template v-if="quota.extraExpireAt"> · {{ fmtDate(quota.extraExpireAt) }} 到期</template></span>
          </div>
        </div>
        <div v-if="quota.blocked" class="blocked-tip">存储额度已满，请申请增额</div>
      </div>

      <!-- 申请增额 -->
      <van-cell-group inset class="group">
        <div class="group-title">申请增额</div>
        <van-field
          v-model="gbCount"
          type="digit"
          label="增额大小"
          placeholder="输入 GB 数（1~1000）"
        >
          <template #right-icon><span class="unit">GB</span></template>
        </van-field>
        <div class="quick-gb">
          <span
            v-for="g in quickOptions" :key="g"
            class="gb-chip" :class="{ active: String(g) === gbCount }"
            @click="gbCount = String(g)"
          >{{ g }}GB</span>
        </div>
        <van-field v-model="remark" label="备注" placeholder="选填，说明用途" maxlength="500" />
        <div class="price-row" v-if="priceCents">
          应付金额 <span class="price">¥{{ priceYuan }}</span>
          <span class="price-sub">（{{ priceCents / 100 }} 元/GB/月 × {{ gbCount || 0 }} GB，有效期 30 天）</span>
        </div>
        <van-button
          block round type="primary" class="submit-btn"
          :loading="submitting" :disabled="!validGb"
          @click="onSubmit"
        >提交申请</van-button>
        <p class="tip">提交后需管理员审批，通过后立即生效</p>
      </van-cell-group>

      <!-- 申请记录 -->
      <van-cell-group inset class="group">
        <div class="group-title">申请记录</div>
        <van-list :loading="listLoading" :finished="listFinished" finished-text="没有更多了" @load="loadRequests">
          <div v-for="r in requests" :key="r.id" class="req-item">
            <div class="req-main">
              <div class="req-gb">+{{ r.gbCount }} GB</div>
              <div class="req-sub">¥{{ (r.amountCents / 100).toFixed(2) }} · {{ fmtTime(r.createdAt) }}</div>
              <div v-if="r.remark" class="req-remark">{{ r.remark }}</div>
            </div>
            <span class="req-status" :class="'st-' + r.status">{{ statusText(r.status) }}</span>
          </div>
          <van-empty v-if="listFinished && requests.length === 0" description="还没有申请记录" />
        </van-list>
      </van-cell-group>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { showSuccessToast, showToast } from 'vant'
import { billingApi } from '@/api'
import { formatSize } from '@/utils/file'
import { pushBackHandler } from '@/utils/back'

const router = useRouter()

// ===== 额度 =====
const quota = ref({ freeBytes: 0, extraBytes: 0, extraExpireAt: null, usedBytes: 0, blocked: false })
const totalBytes = computed(() => (quota.value.freeBytes || 0) + (quota.value.extraBytes || 0))
const usedPercent = computed(() => totalBytes.value ? Math.min(100, Math.round(quota.value.usedBytes / totalBytes.value * 100)) : 0)
// 用量分档配色：蓝卡上正常白色，>70% 黄，>85% 红
const barColor = computed(() => {
  if (usedPercent.value > 85) return '#ff4d4f'
  if (usedPercent.value > 70) return '#ffd666'
  return '#95de64' // 薄荷绿：健康档，和白色数字区分开
})
const expireSoon = computed(() => {
  if (!quota.value.extraExpireAt) return false
  return new Date(quota.value.extraExpireAt) - Date.now() < 7 * 86400000
})

// ===== 申请 =====
const priceCents = ref(0)
const gbCount = ref('')
const remark = ref('')
const submitting = ref(false)
const quickOptions = [10, 50, 100, 500]

const validGb = computed(() => {
  const n = parseInt(gbCount.value, 10)
  return Number.isInteger(n) && n >= 1 && n <= 1000
})
const priceYuan = computed(() => {
  const n = parseInt(gbCount.value, 10) || 0
  return (n * priceCents.value / 100).toFixed(2)
})

async function onSubmit() {
  if (!validGb.value) { showToast('请输入 1~1000 的整数 GB'); return }
  submitting.value = true
  try {
    await billingApi.createRequest({ gbCount: parseInt(gbCount.value, 10), remark: remark.value || undefined })
    showSuccessToast('申请已提交，等待审批')
    gbCount.value = ''
    remark.value = ''
    refreshRequests()
  } catch (e) { /* 拦截器已提示 */ } finally {
    submitting.value = false
  }
}

// ===== 申请记录 =====
const requests = ref([])
const reqPage = ref(1)
const listLoading = ref(false)
const listFinished = ref(false)

async function loadRequests(force = false) {
  if (!force && listLoading.value) return // 防 van-list @load 与手动触发并发
  listLoading.value = true
  try {
    const res = await billingApi.myRequests({ page: reqPage.value, size: 20 })
    const rows = res.records || res.list || []
    // 第一页整体替换，后续页才追加，避免重复
    requests.value = reqPage.value === 1 ? rows : requests.value.concat(rows)
    const total = res.total || 0
    if (rows.length === 0 || requests.value.length >= total) listFinished.value = true
    else reqPage.value += 1
  } catch (e) { listFinished.value = true } finally { listLoading.value = false }
}
function refreshRequests() {
  requests.value = []
  reqPage.value = 1
  listFinished.value = false
  loadRequests(true)
}

// ===== 工具 =====
function statusText(s) { return { pending: '待审批', approved: '已通过', rejected: '已驳回' }[s] || s }
function fmtDate(t) { const d = new Date(t); return (d.getMonth() + 1) + '月' + d.getDate() + '日' }
function fmtTime(t) {
  const d = new Date(t)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

// 返回键：直接返回上一页
const removeBack = pushBackHandler(() => { goBack(); return true })
function goBack() { router.back() }
onUnmounted(removeBack)

onMounted(async () => {
  try {
    const [q, c] = await Promise.all([billingApi.quota(), billingApi.config()])
    quota.value = q
    priceCents.value = c.pricePerGbMonthCents || 0
  } catch (e) { /* 拦截器已提示 */ }
  // 申请记录由 van-list 的 @load 自动发起第一页，无需手动加载
})
</script>

<style scoped>
.billing-page { display: flex; flex-direction: column; height: 100%; background: #f7f8fa; }
.scroll { flex: 1; overflow-y: auto; padding-top: 12px; padding-bottom: calc(24px + env(safe-area-inset-bottom)); }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; }
.back-icon { font-size: 20px; color: #323233; }
.page-title { font-size: 17px; font-weight: 600; }
.topbar-right { width: 20px; }

.quota-card { margin: 0 16px 12px; padding: 16px; border-radius: 12px; background: linear-gradient(135deg, #3ba0ff, #1989fa); color: #fff; }
.quota-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
.quota-label { font-size: 13px; opacity: .9; }
.quota-total { font-size: 24px; font-weight: 700; }
.quota-used { font-size: 12px; opacity: .9; margin-top: 8px; }
.quota-break { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.25); }
.break-row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
.extra-warn { color: #ffe58f; font-weight: 600; }
.blocked-tip { margin-top: 10px; font-size: 13px; background: rgba(255,255,255,.2); border-radius: 8px; padding: 6px 10px; }

.group { margin-bottom: 12px; }
.group-title { font-size: 14px; font-weight: 600; padding: 14px 16px 6px; color: #323233; }
.unit { color: #969799; font-size: 13px; }
.quick-gb { display: flex; gap: 10px; padding: 4px 16px 12px; }
.gb-chip { padding: 5px 14px; border-radius: 16px; background: #f2f3f5; font-size: 13px; color: #646566; }
.gb-chip.active { background: #e8f3ff; color: #1989fa; font-weight: 600; }
.price-row { padding: 4px 16px 12px; font-size: 13px; color: #646566; }
.price { color: #ee0a24; font-size: 18px; font-weight: 700; margin: 0 4px; }
.price-sub { color: #969799; font-size: 12px; }
.submit-btn { margin: 4px 16px 8px; width: calc(100% - 32px); }
.tip { text-align: center; font-size: 12px; color: #969799; padding-bottom: 12px; margin: 0; }

.req-item { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #f2f3f5; }
.req-item:last-child { border-bottom: none; }
.req-main { flex: 1; min-width: 0; }
.req-gb { font-size: 15px; font-weight: 600; }
.req-sub { font-size: 12px; color: #969799; margin-top: 3px; }
.req-remark { font-size: 12px; color: #646566; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.req-status { font-size: 12px; padding: 3px 10px; border-radius: 10px; flex-shrink: 0; }
.st-pending { background: #fff7e8; color: #ff976a; }
.st-approved { background: #e8fff3; color: #07c160; }
.st-rejected { background: #ffece8; color: #ee0a24; }
</style>
