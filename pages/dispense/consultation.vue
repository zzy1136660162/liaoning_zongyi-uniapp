<template>
  <view class="consultation-page">
    <!-- 状态栏占位 -->
    <view class="safe-top" />



    <!-- 聊天内容区域 -->
    <scroll-view
      class="chat-container"
      scroll-y
      :scroll-top="scrollTop"
      scroll-with-animation
      :scroll-into-view="scrollIntoView"
    >
      <view class="chat-messages" id="chat-messages">
        <view
          v-for="(message, index) in messages"
          :key="index"
          class="message-item"
          :class="{ 'show': message.show }"
          :id="`message-${index}`"
        >
          <view class="message-avatar">
            <image
              class="avatar-img"
              :src="getImageUrl(doctorAvatar)"
              mode="aspectFill"
            />
          </view>
          <view class="message-content">
            <view class="doctor-name">{{ doctorName }}</view>
            <view class="message-bubble">
              <text class="message-text">{{ message.text }}</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-if="consultationError" class="footer">
      <text>{{ consultationError }}</text>
      <button :disabled="isSubmitting" @click="createConsultationRecord">重新获取本次处方</button>
    </view>
    <!-- 查看处方按钮 -->
    <view class="footer" v-if="showPrescriptionBtn">
      <view class="prescription-status-banner">{{ prescriptionStatusText }}</view>
      <button class="prescription-btn" @click="viewPrescription">查看处方</button>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { createConsultation, getPrescriptionByConsultation } from '@/api/consultation.js'
import { getProductDetail } from '@/api/product.js'
import { STORAGE_KEY_PRODUCT_QUANTITIES } from '@/utils/storage.js'
import { getCartEntries, getCurrentCheckoutProductIds, setCheckoutProductIds, splitCartItemKey } from '@/utils/cart.js'
import { logPageView } from '@/api/access-log.js'
import { getImageUrl } from '@/utils/config.js'
import { PRODUCT_FLOW_CONSULTATION, resolveProductFlow, resolveProductFlowType } from '@/utils/product-biz.js'
import { AI_DOCTOR, CONSULTATION_MODE_AI, CONSULTATION_MODE_MANUAL, normalizeConsultationMode } from '@/utils/consultation-mode.js'

import { getSessionGeneration, assertCurrentSession } from '@/utils/session.js'
import { requireConsultationPatient, requireCreatedPrescription } from '@/utils/consultation-checkout.js'

const pageSession = getSessionGeneration()
let pageActive = true
let createdConsultation = null
const consultationError = ref('')
const checkoutContext = ref(null)
const consultationMode = ref(CONSULTATION_MODE_AI)
const doctorName = ref(AI_DOCTOR.name)
const doctorAvatar = ref(AI_DOCTOR.avatar)
const doctorId = ref(null)
const patientId = ref(null)
const isSubmitting = ref(false)

const messages = ref([{ text: '正在提交本次复诊申请，请稍候。', show: true }])
const showPrescriptionBtn = ref(false)
const prescriptionStatusText = ref('')
const scrollTop = ref(0)
const scrollIntoView = ref('')
const selectedProductIds = ref([])

// 滚动到指定消息
const scrollToMessage = (index) => {
  nextTick(() => {
    scrollIntoView.value = `message-${index}`
    // 延迟重置，以便下次滚动可以触发
    setTimeout(() => {
      scrollIntoView.value = ''
    }, 100)
  })
}

const viewPrescription = () => {
  if (!checkoutContext.value || !showPrescriptionBtn.value) return
  assertCurrentSession(pageSession)
  const ids = selectedProductIds.value.length > 0
    ? selectedProductIds.value
    : getCurrentCheckoutProductIds()
  const queryParts = []
  if (ids.length > 0) {
    queryParts.push(`selectedItems=${ids.join(',')}`)
  }
  queryParts.push(`consultationId=${checkoutContext.value.consultationId}`)
  queryParts.push(`patientId=${checkoutContext.value.patientId}`)
  const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''
  uni.navigateTo({
    url: `/pages/order/prescription_list${query}`
  })
}

// 从购物车获取当前勾选的所有商品，用于创建处方明细
const loadProductsForConsultation = async () => {
  const itemKeys = selectedProductIds.value.length > 0
    ? selectedProductIds.value
    : getCurrentCheckoutProductIds()
  if (itemKeys.length === 0) return []

  const products = []
  const cartEntries = getCartEntries()
  for (const itemKey of itemKeys) {
    const entry = cartEntries[itemKey] || {}
    const split = splitCartItemKey(itemKey)
    const productId = entry.productId || split.productId || itemKey
    const skuId = entry.skuId || split.skuId || null
    assertCurrentSession(pageSession)
    const detail = await getProductDetail(productId)
    if (detail) {
      const skus = Array.isArray(detail.skus) ? detail.skus : []
      const sku = skuId
        ? skus.find(item => String(item.id) === String(skuId))
        : null
      products.push({
        ...detail,
        id: productId,
        productId,
        cartKey: itemKey,
        skuId,
        skuCode: sku?.skuCode || entry.skuCode || '',
        skuName: sku?.skuName || entry.skuName || '',
        skuSpecText: sku?.specText || sku?.skuName || entry.skuSpecText || '',
        specText: sku?.specText || sku?.skuName || detail.specText,
        price: sku ? Number(sku.price || 0) : detail.price,
        quantity: entry.quantity || 1
      })
    }
  }
  return products
}

// ✅ 创建咨询
const createConsultationRecord = async () => {
  if (!patientId.value || isSubmitting.value) {
    return null
  }
  isSubmitting.value = true
  consultationError.value = ''
  showPrescriptionBtn.value = false
  checkoutContext.value = null
  console.info('event=ui_dispense_consultation stage=create result=started')
  try {
    assertCurrentSession(pageSession)
    const products = await loadProductsForConsultation()
    const flow = resolveProductFlow(products)
    if (!flow.valid || !flow.requiresConsultation) throw new Error(flow.message || '本次商品无需复诊，请返回重新结算')
    const consultationProducts = products.filter(product => resolveProductFlowType(product) === PRODUCT_FLOW_CONSULTATION)
    if (consultationProducts.length === 0) throw new Error('本次没有可复诊商品')

    // 人工模式使用上页传入的真实医生ID；AI模式不写入商品默认医生，避免下游展示与「」不一致
    const firstProduct = consultationProducts[0]

    // 将购物车内所有已勾选商品作为处方明细传递到后端
    // 优先使用本地存储的商品数量（由上页 apply.vue 存储），回退到商品对象中的数量或 1
    const productQuantities = uni.getStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES) || {}
    // 注意: 小程序打包/编译器旧版可能不支持 nullish coalescing (??)，因此使用兼容写法
    const resolveQuantity = (item) => {
      const stored = productQuantities[String(item.cartKey || item.id)]
      if (stored !== undefined && stored !== null) return stored
      if (item.quantity !== undefined && item.quantity !== null) return item.quantity
      if (item.count !== undefined && item.count !== null) return item.count
      if (item.num !== undefined && item.num !== null) return item.num
      return 1
    }

    const prescriptionItems = consultationProducts.map(p => ({
      productId: p.productId || p.id,
      drugName: p.productName || p.name || '未命名药品',
      quantity: resolveQuantity(p),
      remark: p.usageDesc || p.notice || ''
    }))

    const consultationData = {
      patientId: patientId.value,
      consultType: 1, // 在线咨询
      symptomDesc: consultationMode.value === CONSULTATION_MODE_MANUAL ? '人工接诊复诊开药' : '实时接诊复诊开药',
      historyDesc: consultationMode.value === CONSULTATION_MODE_MANUAL ? `人工接诊医生：${doctorName.value}` : '实时医生接诊',
      doctorId: doctorId.value,
      diagnosis: firstProduct?.prescriptionDiagnosis || '复诊开药',
      usageNote: firstProduct?.usageDesc || '',
      prescriptionItems
    }

    assertCurrentSession(pageSession)
    const result = createdConsultation || await createConsultation(consultationData)
    assertCurrentSession(pageSession)
    if (!pageActive) return null
    const context = { consultationId: Number(result?.id), patientId: patientId.value }
    requireConsultationPatient(result, context)
    createdConsultation = result
    console.debug('event=ui_dispense_consultation stage=consultation_context result=validated')
    const prescription = await getPrescriptionByConsultation(context.consultationId)
    assertCurrentSession(pageSession)
    if (!pageActive) return null
    requireCreatedPrescription(prescription, context)
    console.info('event=ui_dispense_consultation stage=prescription_context result=validated')
    prescriptionStatusText.value = Number(prescription.status) === 0 ? '本次处方已生成，待审核' : '本次处方已生成'
    checkoutContext.value = context
    messages.value = [{ text: '本次复诊申请已提交，处方已生成。请查看处方信息后确认订单。', show: true }]
    showPrescriptionBtn.value = true
    return result
  } catch (error) {
    if (!pageActive || error?.code === 'SESSION_CHANGED') return null
    console.warn('event=ui_dispense_consultation stage=create result=failed reason=consultation_incomplete')
    consultationError.value = error?.message || '问诊未完成，请重试'
    messages.value = [{ text: '本次复诊尚未完成。', show: true }]
    return null
  } finally {
    isSubmitting.value = false
  }
}

const redirectHealthGoodsToConfirm = async () => {
  let products
  try {
    products = await loadProductsForConsultation()
    assertCurrentSession(pageSession)
    if (!pageActive) return true
  } catch (error) {
    if (error.code === 'SESSION_CHANGED' || !pageActive) return true
    return false
  }
  const flow = resolveProductFlow(products)
  if (flow.valid && !flow.requiresConsultation) {
    const ids = selectedProductIds.value.length > 0 ? selectedProductIds.value : getCurrentCheckoutProductIds()
    const therapyParam = flow.allTraditionalTherapy ? '&therapy=1' : ''
    uni.redirectTo({
      url: `/pages/order/confirm?selectedItems=${ids.join(',')}${therapyParam}`
    })
    return true
  }
  return false
}

onMounted(async () => {
  if (!patientId.value) {
    return
  }
  if (await redirectHealthGoodsToConfirm()) {
    return
  }

  // 页面加载后创建咨询记录
  await createConsultationRecord()

  // 记录页面访问日志
  logPageView('咨询页面', '用户进入咨询页面')
})

onUnload(() => { pageActive = false })

onLoad((options) => {
  const parsedPatientId = Number(options?.patientId)
  if (!Number.isInteger(parsedPatientId) || parsedPatientId <= 0) {
    uni.showToast({ title: '请选择有效就诊人', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1200)
    return
  }
  patientId.value = parsedPatientId
  if (options?.selectedItems) {
    selectedProductIds.value = options.selectedItems.split(',').filter(id => id.trim())
    setCheckoutProductIds(selectedProductIds.value)
  } else {
    selectedProductIds.value = getCurrentCheckoutProductIds()
  }
  consultationMode.value = normalizeConsultationMode(options?.consultationMode)
  if (options?.doctorId) {
    doctorId.value = Number(options.doctorId)
  }
  if (options?.doctorName) {
    doctorName.value = decodeURIComponent(options.doctorName)
  } else if (consultationMode.value === CONSULTATION_MODE_AI) {
    doctorName.value = AI_DOCTOR.name
  }
  if (options?.doctorAvatar) {
    doctorAvatar.value = decodeURIComponent(options.doctorAvatar)
  } else if (consultationMode.value === CONSULTATION_MODE_AI) {
    doctorAvatar.value = AI_DOCTOR.avatar
  }
})
</script>

<style scoped>
.consultation-page {
  background: #f6f7fb;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.safe-top {
  height: env(safe-area-inset-top);
  background: #fff;
}

.nav-bar {
  height: 88rpx;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0 20rpx;
  border-bottom: 1rpx solid #eee;
}

.nav-left, .nav-right {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 120rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  font-size: 36rpx;
}

.nav-left {
  left: 0;
}

.nav-right {
  right: 0;
}

.nav-title {
  font-size: 34rpx;
  font-weight: 600;
}

.chat-container {
  height: 100vh;
  flex: 1;
  padding: 30rpx 20rpx 200rpx;
  box-sizing: border-box;
}

.chat-messages {
  display: flex;
  flex-direction: column;
  gap: 30rpx;
  min-height: 1000rpx;
}

.message-item {
  display: flex;
  align-items: flex-start;
  opacity: 0;
  transform: translateY(20rpx);
  transition: all 0.6s ease-out;
}

.message-item.show {
  opacity: 1;
  transform: translateY(0);
}

.message-avatar {
  width: 80rpx;
  height: 80rpx;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #eee;
}

.message-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.doctor-name {
  font-size: 24rpx;
  color: #666;
  margin-bottom: 10rpx;
}

.message-bubble {
  background: #f0f0f0;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  max-width: 80%;
  position: relative;
}

.message-bubble::before {
  content: '';
  position: absolute;
  left: -12rpx;
  top: 20rpx;
  width: 0;
  height: 0;
  border: 12rpx solid transparent;
  border-right-color: #f0f0f0;
}

.message-text {
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
}

.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  padding: 30rpx 40rpx;
  padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.08);
  z-index: 100;
  animation: slideUp 0.3s ease-out;
}

.prescription-status-banner {
  margin-bottom: 20rpx;
  padding: 18rpx 24rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #e8f8ee 0%, #f6fff8 100%);
  border: 1rpx solid rgba(31, 138, 76, 0.15);
  color: #1f8a4c;
  font-size: 28rpx;
  font-weight: 600;
  text-align: center;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.prescription-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: linear-gradient(135deg, #4A90E2 0%, #6BB3FF 100%);
  color: #fff;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 44rpx;
  border: none;
  box-shadow: 0 8rpx 20rpx rgba(74, 144, 226, 0.3);
}

.prescription-btn:active {
  transform: scale(0.98);
  box-shadow: 0 4rpx 12rpx rgba(74, 144, 226, 0.2);
}
</style>
