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
      <button :disabled="isSubmitting" @click="retryConsultation">重新获取本次处方</button>
    </view>
    <!-- 查看处方按钮 -->
    <view class="footer" v-if="showPrescriptionBtn">
      <view class="prescription-status-banner">{{ prescriptionStatusText }}</view>
      <button class="prescription-btn" @click="viewPrescription">查看处方</button>
    </view>
  </view>
</template>

<script setup>
import { logPageView, logButtonClick, logAccess, getActionFailureResult } from '@/utils/accessLog.js'

const PAGE_LOG = { moduleCode: 'CONSULTATION', accessType: '在线诊疗', pageType: 'DISPENSE_CONSULTATION', requestUri: '/pages/dispense/consultation', pageId: '' }
import { ref, onMounted, nextTick } from 'vue'
import { onLoad, onUnload, onShow } from '@dcloudio/uni-app'
import { createConsultation, getPrescriptionByConsultation } from '@/api/consultation.js'
import { loadCartProducts } from '@/utils/cart-products.js'
import { getProductDetail } from '@/api/product.js'
import { getCurrentCheckoutProductIds, setCheckoutProductIds } from '@/utils/cart.js'
import { parseDirectPurchase, directPurchaseQuery, checkoutEntries } from '@/utils/checkout.js'
import { getImageUrl } from '@/utils/config.js'
import { PRODUCT_FLOW_CONSULTATION, resolveProductFlow, resolveProductFlowType } from '@/utils/product-biz.js'
import { AI_DOCTOR, CONSULTATION_MODE_AI, CONSULTATION_MODE_MANUAL, resolveConsultationDoctor } from '@/utils/consultation-mode.js'

import { getSessionGeneration, assertCurrentSession } from '@/utils/session.js'
import { requireConsultationPatient, requireCreatedPrescription } from '@/utils/consultation-checkout.js'

const pageSession = getSessionGeneration()
let pageActive = true
let createdConsultation = null
let messageTimer = null
const consultationError = ref('')
const checkoutContext = ref(null)
const directPurchase = ref(null)
const checkoutRouteError = ref('')
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

const stopMessageAnimation = () => {
  clearTimeout(messageTimer)
  messageTimer = null
}

// 取得本次真实处方后再播放过程，动画结束才开放查看入口。
const showMessages = () => {
  stopMessageAnimation()
  messages.value = [
    '您好，我是辽宁中医在线医生，已收到您的复诊开药诉求，正在为您诊断开方，预计1分钟，请不要离开。',
    '请问您是否还有其他信息需要补充，如无，我将依据您的资料开具处方。',
    '请稍等，正在审核您提交的购买制剂信息。',
    '如无信息补充，我将根据您提交的复诊信息开具处方。',
    '已为您开具处方，您可以点击下方查看处方按钮，完成支付。'
  ].map(text => ({ text, show: false }))
  let index = 0
  const showNextMessage = () => {
    messageTimer = null
    if (!pageActive) return
    try { assertCurrentSession(pageSession) } catch (_) { return }
    if (index === messages.value.length) {
      showPrescriptionBtn.value = true
      return
    }
    messages.value[index].show = true
    scrollToMessage(index)
    index += 1
    messageTimer = setTimeout(showNextMessage, index === messages.value.length ? 1000 : 1500)
  }
  messageTimer = setTimeout(showNextMessage, 500)
}

const scrollToMessage = (index) => {
  nextTick(() => {
    if (pageActive) scrollIntoView.value = `message-${index}`
  })
}

const viewPrescription = () => {
  if (!pageActive || !checkoutContext.value || !showPrescriptionBtn.value) return
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
  logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_PRESCRIPTION', accessTitle: '查看本次复诊处方', accessDescription: '进入本次复诊关联的处方和选购商品确认页面', pageId: checkoutContext.value.consultationId, extraData: { consultationId: checkoutContext.value.consultationId } })
  const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''
  uni.navigateTo({
    url: `/pages/order/prescription_list${query}${directPurchaseQuery(directPurchase.value)}`
  })
}

// 同次创建只读取一次商品；再次创建时仍重新核验商品和规格。
const loadProductsForConsultation = async () => {
  if (checkoutRouteError.value) throw Object.assign(new Error(checkoutRouteError.value), { code: 400 })
  const itemKeys = selectedProductIds.value.length > 0
    ? selectedProductIds.value
    : getCurrentCheckoutProductIds()
  if (itemKeys.length === 0) return []

  const products = await loadCartProducts(itemKeys, checkoutEntries(itemKeys, directPurchase.value), getProductDetail)
  assertCurrentSession(pageSession)
  if (products.some(product => product.loadFailure || product.available === false)) {
    const error = new Error('所选商品或规格已失效，请重新选择')
    if (!products.some(product => product.loadFailure)) error.code = 400
    throw error
  }
  return products

}

const buildConsultationData = (products) => {
  // 混合结算保留全部行，处方只包含购买分类1的制剂。
  const consultationProducts = products.filter(product => resolveProductFlowType(product) === PRODUCT_FLOW_CONSULTATION)
  if (consultationProducts.length === 0) throw Object.assign(new Error('本次没有可复诊商品'), { code: 400 })
  const firstProduct = consultationProducts[0]
  return {
    patientId: patientId.value,
    consultType: 1,
    symptomDesc: consultationMode.value === CONSULTATION_MODE_MANUAL ? '人工接诊复诊开药' : '实时接诊复诊开药',
    historyDesc: consultationMode.value === CONSULTATION_MODE_MANUAL ? `人工接诊医生：${doctorName.value}` : '实时医生接诊',
    doctorId: doctorId.value,
    diagnosis: firstProduct.prescriptionDiagnosis || '复诊开药',
    usageNote: firstProduct.usageDesc || '',
    // 购买数量和规格继续由结算行保留，不作为处方剂量。
    prescriptionItems: consultationProducts.map(p => ({
      productId: p.productId || p.id,
      drugName: p.productName || p.name || '未命名药品',
      remark: p.usageDesc || p.notice || ''
    }))
  }
}

const createConsultationRecord = async () => {
  if (!pageActive || !patientId.value || isSubmitting.value) {
    return null
  }
  isSubmitting.value = true
  stopMessageAnimation()
  consultationError.value = ''
  showPrescriptionBtn.value = false
  prescriptionStatusText.value = ''
  checkoutContext.value = null
  messages.value = [{ text: '正在提交本次复诊申请，请稍候。', show: true }]
  scrollIntoView.value = ''
  console.info('event=ui_dispense_consultation stage=create result=started')
  try {
    assertCurrentSession(pageSession)
    let result = createdConsultation
    if (!result) {
      const products = await loadProductsForConsultation()
      if (!pageActive) return null
      const flow = resolveProductFlow(products)
      if (!flow.valid) throw Object.assign(new Error(flow.message), { code: 400 })
      if (!flow.requiresConsultation) {
        redirectToConfirm()
        return null
      }
      result = await createConsultation(buildConsultationData(products))
    }
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
    prescriptionStatusText.value = '处方审核通过'
    checkoutContext.value = context
    logAccess({ ...PAGE_LOG, actionCode: 'PREPARE_CONSULTATION', accessTitle: '本次复诊处方已就绪', accessDescription: '服务端返回的本次复诊及处方已通过关联校验', pageId: context.consultationId, actionType: 'BEHAVIOR', actionResult: 'SUCCESS', extraData: { consultationId: context.consultationId, consultationMode: consultationMode.value } })
    showMessages()
    return result
  } catch (error) {
    if (!pageActive || error?.code === 'SESSION_CHANGED') return null
    logAccess({ ...PAGE_LOG, actionCode: 'PREPARE_CONSULTATION', accessTitle: '本次复诊处方准备未完成', accessDescription: '复诊或处方尚未取得可继续购买的明确结果', actionType: 'BEHAVIOR', actionResult: getActionFailureResult(error), extraData: { reason: 'consultation_incomplete', consultationMode: consultationMode.value } })
    console.warn('event=ui_dispense_consultation stage=create result=failed reason=consultation_incomplete')
    consultationError.value = error?.message || '问诊未完成，请重试'
    messages.value = [{ text: '本次复诊尚未完成。', show: true }]
    return null
  } finally {
    isSubmitting.value = false
  }
}

const retryConsultation = () => {
  if (isSubmitting.value || !pageActive) return
  logButtonClick({ ...PAGE_LOG, actionCode: 'RETRY_PRESCRIPTION', accessTitle: '重新获取本次处方', accessDescription: '用户主动重试准备本次复诊与处方' })
  return createConsultationRecord()
}

const redirectToConfirm = () => {
  const ids = selectedProductIds.value.length > 0 ? selectedProductIds.value : getCurrentCheckoutProductIds()
  uni.redirectTo({
    url: `/pages/order/confirm?selectedItems=${ids.join(',')}${directPurchaseQuery(directPurchase.value)}`
  })
}

onMounted(async () => {
  if (!patientId.value) {
    return
  }
  // 页面加载后创建咨询记录
  await createConsultationRecord()

  // 记录页面访问日志

})

onUnload(() => {
  pageActive = false
  stopMessageAnimation()
})

onLoad((options) => {
  try { directPurchase.value = parseDirectPurchase(options) }
  catch (error) { checkoutRouteError.value = error.message }
  if (directPurchase.value && !options?.selectedItems) checkoutRouteError.value = '购买信息无效，请返回商品页重新选择'
  const parsedPatientId = Number(options?.patientId)
  if (!Number.isInteger(parsedPatientId) || parsedPatientId <= 0) {
    uni.showToast({ title: '请选择有效就诊人', icon: 'none' })
    setTimeout(() => {
      if (!pageActive) return
      try { assertCurrentSession(pageSession) } catch (_) { return }
      uni.navigateBack()
    }, 1200)
    return
  }
  patientId.value = parsedPatientId
  if (options?.selectedItems) {
    selectedProductIds.value = options.selectedItems.split(',').filter(id => id.trim())
    if (!directPurchase.value) setCheckoutProductIds(selectedProductIds.value)
  } else {
    selectedProductIds.value = getCurrentCheckoutProductIds()
  }
  try {
    const doctor = resolveConsultationDoctor(options)
    consultationMode.value = doctor.mode
    doctorId.value = doctor.id
    doctorName.value = doctor.name
    doctorAvatar.value = doctor.avatar
  } catch (error) {
    checkoutRouteError.value = error.message
  }
})
onShow(() => {
  logPageView({ ...PAGE_LOG, actionCode: 'VIEW_PAGE', accessTitle: '访问在线复诊', accessDescription: '进入本次在线复诊页面，查看复诊与处方进度' })
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
