<template>
  <view class="page">
    <view class="content">
      <view class="success-header">
        <view class="success-icon-wrapper">
          <view class="success-icon">
            <uni-icons type="checkmarkempty" size="60" color="#07c160"></uni-icons>
          </view>
        </view>
        <text class="success-text">支付成功</text>
        <text v-if="syncing" class="sync-hint">正在确认订单状态...</text>
      </view>

      <view class="amount-section">
        <text class="amount-label">支付金额</text>
        <text class="amount-value" v-if="!loading">¥{{ (paymentInfo.amount || 0).toFixed(2) }}</text>
        <text class="amount-value" v-else>加载中...</text>
      </view>

      <view class="info-card">
        <view class="info-row">
          <text class="info-label">订单状态</text>
          <text class="info-value">{{ paymentInfo.orderStatusLabel }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">支付方式</text>
          <text class="info-value">{{ paymentInfo.paymentMethod }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">订单号</text>
          <text class="info-value order-no">{{ paymentInfo.orderNo }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">下单时间</text>
          <text class="info-value">{{ paymentInfo.createdTime }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">支付时间</text>
          <text class="info-value">{{ paymentInfo.paymentTime }}</text>
        </view>
      </view>

      <view class="info-card">
        <view class="info-row">
          <text class="info-label">商品金额</text>
          <text class="info-value">¥{{ paymentInfo.goodsAmount.toFixed(2) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">商品数量</text>
          <text class="info-value">{{ paymentInfo.itemCount }} 件</text>
        </view>
        <view class="info-row">
          <text class="info-label">运费说明</text>
          <text class="info-value">{{ paymentInfo.shippingFeeText }}</text>
        </view>
      </view>

      <view class="tip-section">
        <text class="tip-text">{{ paymentInfo.primaryTip }}</text>
        <text class="tip-text" v-if="paymentInfo.secondaryTip">{{ paymentInfo.secondaryTip }}</text>
      </view>
    </view>

    <view class="footer">
      <button class="complete-btn" @click="goHome">完成</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { getOrderDetail } from '@/api/order.js'
import { syncPaymentByOrder } from '@/api/payment.js'
import { getCurrentCheckoutProductIds, removeFromCart } from '@/utils/cart.js'
import { logPageView, logButtonClick } from '@/api/access-log.js'
import { ORDER_TYPE_THERAPY } from '@/utils/therapy.js'

const paymentInfo = ref({
  amount: 0,
  goodsAmount: 0,
  itemCount: 0,
  paymentMethod: '在线支付',
  orderStatusLabel: '支付成功',
  orderNo: '',
  createdTime: '',
  paymentTime: '',
  shippingFeeText: '运费到付，由快递员收取，以实际支付为准',
  primaryTip: '订单已提交，我们将尽快为您处理',
  secondaryTip: '运费到付，由快递员收取，以实际支付为准'
})

const loading = ref(true)
const syncing = ref(false)
const cartCleared = ref(false)

let currentOrderId = ''

const PAY_STATUS_PAID = 1
const POLL_INTERVAL_MS = 1500
const POLL_MAX_ATTEMPTS = 12

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  return dayjs(timeStr).format('YYYY-MM-DD HH:mm:ss')
}

const toAmount = (value, fallback = 0) => {
  const amount = parseFloat(value)
  return Number.isFinite(amount) ? amount : fallback
}

const sumItemCount = (items = []) => {
  if (!Array.isArray(items)) return 0
  return items.reduce((total, item) => {
    const quantity = Number(item.quantity || item.count || item.num || 1)
    return total + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1)
  }, 0)
}

const resolveOrderItemProductId = (item = {}) => {
  const product = item.product || item.productInfo || item.goods || {}
  return item.productId ??
    item.product_id ??
    item.goodsId ??
    item.goods_id ??
    product.id ??
    product.productId ??
    product.product_id ??
    null
}

const uniqueStringIds = (ids = []) => {
  const seen = new Set()
  return ids
    .filter(id => id !== null && id !== undefined && id !== '')
    .map(id => String(id))
    .filter(id => {
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
}

const resolveOrderStatusLabel = (orderData = {}) => {
  if (isOrderPaid(orderData)) {
    return '支付成功'
  }
  return '待支付确认'
}

const resolveShippingFeeText = (orderData = {}) => {
  const orderType = orderData.orderType ?? orderData.order_type
  if (Number(orderType) === ORDER_TYPE_THERAPY) {
    return '传统疗法无需快递费'
  }

  const shippingFee = toAmount(orderData.shippingFee ?? orderData.shipping_fee, 0)
  if (shippingFee > 0) {
    return `约¥${shippingFee.toFixed(2)}（到付）`
  }
  return orderData.shippingPaymentMethod || orderData.shipping_payment_method || '运费到付，由快递员收取，以实际支付为准'
}

const applyTips = (orderData = {}) => {
  const orderType = orderData.orderType ?? orderData.order_type
  if (Number(orderType) === ORDER_TYPE_THERAPY) {
    paymentInfo.value.primaryTip = '支付成功后可在订单详情查看核销二维码'
    paymentInfo.value.secondaryTip = '传统疗法到店核销，无需物流配送'
    return
  }
  paymentInfo.value.primaryTip = '订单已提交，我们将尽快为您处理'
  paymentInfo.value.secondaryTip = paymentInfo.value.shippingFeeText
}

const isOrderPaid = (orderData) => {
  const payStatus = orderData?.payStatus ?? orderData?.pay_status
  const orderStatus = orderData?.orderStatus ?? orderData?.order_status ?? orderData?.status
  return Number(payStatus) === PAY_STATUS_PAID || Number(orderStatus) >= 1
}

const clearPaidCartItems = (orderData = {}) => {
  if (cartCleared.value || !isOrderPaid(orderData)) {
    return
  }

  const itemProductIds = Array.isArray(orderData.items)
    ? uniqueStringIds(orderData.items.map(resolveOrderItemProductId))
    : []
  const checkoutProductIds = uniqueStringIds(getCurrentCheckoutProductIds())
  const productIds = itemProductIds.length > 0 ? itemProductIds : checkoutProductIds

  if (productIds.length > 0 && removeFromCart(productIds)) {
    uni.$emit('cartUpdated')
    cartCleared.value = true
  }
}

const applyOrderData = (orderData) => {
  paymentInfo.value.amount = toAmount(orderData.paidAmount || orderData.payableAmount || orderData.totalAmount || orderData.amount, 0)
  paymentInfo.value.goodsAmount = toAmount(orderData.totalAmount || orderData.amount || paymentInfo.value.amount, 0)
  paymentInfo.value.itemCount = sumItemCount(orderData.items)
  paymentInfo.value.orderStatusLabel = resolveOrderStatusLabel(orderData)
  paymentInfo.value.orderNo = orderData.orderNo || orderData.order_no || currentOrderId || ''
  paymentInfo.value.createdTime = formatTime(orderData.createdAt || orderData.createTime || orderData.created_at)
  paymentInfo.value.shippingFeeText = resolveShippingFeeText(orderData)

  const payTime = orderData.payTime || orderData.createTime || orderData.createdAt
  paymentInfo.value.paymentTime = formatTime(payTime)

  if (orderData.paymentType) {
    paymentInfo.value.paymentMethod = orderData.paymentType === 'single' ? '在线支付' : orderData.paymentType
  }

  clearPaidCartItems(orderData)

  applyTips(orderData)
}

const fetchOrderDetail = async (orderId) => {
  return getOrderDetail(orderId, { showLoading: false })
}

const waitForPaymentConfirmed = async (orderId, outTradeNo) => {
  syncing.value = true

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    try {
      const orderData = await fetchOrderDetail(orderId)
      if (isOrderPaid(orderData)) {
        applyOrderData(orderData)
        return true
      }
    } catch (error) {
      console.warn('轮询订单支付状态失败:', error)
    }

    if (attempt < POLL_MAX_ATTEMPTS - 1) {
      await sleep(POLL_INTERVAL_MS)
    }
  }

  if (outTradeNo) {
    try {
      await syncPaymentByOrder(orderId, outTradeNo)
      const orderData = await fetchOrderDetail(orderId)
      if (isOrderPaid(orderData)) {
        applyOrderData(orderData)
        return true
      }
    } catch (error) {
      console.warn('主动同步支付状态失败:', error)
    }
  }

  return false
}

const loadOrderInfo = async (orderId, outTradeNo = '') => {
  if (!orderId) {
    console.warn('订单ID为空，无法加载订单信息')
    loading.value = false
    return
  }

  try {
    uni.showLoading({ title: '加载中...' })

    const orderData = await fetchOrderDetail(orderId)
    applyOrderData(orderData)

    if (!isOrderPaid(orderData)) {
      uni.hideLoading()
      await waitForPaymentConfirmed(orderId, outTradeNo)
    }
  } catch (error) {
    console.error('加载订单信息失败:', error)
    uni.showToast({
      title: '加载订单信息失败',
      icon: 'none',
      duration: 2000
    })
  } finally {
    uni.hideLoading()
    syncing.value = false
    loading.value = false
  }
}

onLoad(async (options) => {
  const orderId = options.orderId || options.id
  const outTradeNo = options.combineOutTradeNo || options.outTradeNo || ''
  currentOrderId = orderId || ''

  logPageView('支付成功页面', '用户进入支付成功页面', orderId)

  if (options.paymentMethod) {
    paymentInfo.value.paymentMethod = decodeURIComponent(options.paymentMethod)
  } else if (options.paymentType === 'single') {
    paymentInfo.value.paymentMethod = '在线支付'
  }

  if (orderId) {
    await loadOrderInfo(orderId, outTradeNo)
  } else {
    if (options.amount) {
      paymentInfo.value.amount = toAmount(options.amount, 0)
      paymentInfo.value.goodsAmount = paymentInfo.value.amount
    }

    paymentInfo.value.orderNo = options.outTradeNo || '临时订单号'
    paymentInfo.value.orderStatusLabel = '支付成功'
    paymentInfo.value.createdTime = formatTime(new Date())
    paymentInfo.value.paymentTime = formatTime(new Date())
    paymentInfo.value.itemCount = Number(options.itemCount || 0)
    paymentInfo.value.shippingFeeText = options.shippingFeeText
      ? decodeURIComponent(options.shippingFeeText)
      : '运费到付，由快递员收取，以实际支付为准'
    paymentInfo.value.primaryTip = '订单已提交，我们将尽快为您处理'
    paymentInfo.value.secondaryTip = paymentInfo.value.shippingFeeText

    loading.value = false
  }
})

const goHome = () => {
  logButtonClick('支付成功页面', '用户点击完成按钮', paymentInfo.value.orderNo)

  uni.redirectTo({
    url: '/pages/products/medicine_list'
  })
}
</script>

<style scoped>
.page {
  background: #f5f7fb;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(112rpx + env(safe-area-inset-bottom));

  --brand: #16a34a;
  --brand-dark: #15803d;
  --text: #0f172a;
  --text-2: #64748b;
  --border: #e8edf5;
  --card: #ffffff;
}

.content {
  flex: 1;
  padding: 48rpx 32rpx;
}

.success-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 56rpx;
  padding-top: 24rpx;
}

.success-icon-wrapper {
  margin-bottom: 24rpx;
}

.success-icon {
  width: 132rpx;
  height: 132rpx;
  border-radius: 66rpx;
  background: linear-gradient(135deg, #ecfdf3 0%, #dcfce7 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10rpx 26rpx rgba(22, 163, 74, 0.12);
  animation: scaleIn 0.45s ease-out;
}

@keyframes scaleIn {
  0% { transform: scale(0.92); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.success-text {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 1rpx;
}

.sync-hint {
  margin-top: 16rpx;
  font-size: 24rpx;
  color: var(--text-2);
}

.amount-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 56rpx;
  padding: 20rpx 0 8rpx;
}

.amount-label {
  font-size: 26rpx;
  color: var(--text-2);
  margin-bottom: 18rpx;
}

.amount-value {
  font-size: 68rpx;
  font-weight: 800;
  color: var(--text);
  letter-spacing: 1rpx;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}

.info-card {
  background: var(--card);
  border-radius: 20rpx;
  padding: 28rpx 28rpx;
  margin-bottom: 28rpx;
  border: 1rpx solid var(--border);
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.06);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 22rpx 0;
  border-bottom: 1rpx solid #f2f5fa;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 26rpx;
  color: var(--text-2);
}

.info-value {
  font-size: 26rpx;
  color: var(--text);
  font-weight: 600;
  max-width: 420rpx;
  text-align: right;
  overflow: visible;
  white-space: normal;
  word-break: break-all;
}

.order-no {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
  letter-spacing: 0.5rpx;
}

.tip-section {
  text-align: center;
  padding: 12rpx 0;
}

.tip-text {
  display: block;
  font-size: 24rpx;
  color: #94a3b8;
  line-height: 1.7;
}

.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.96);
  padding: 18rpx 32rpx;
  padding-bottom: calc(18rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--border);
  box-shadow: 0 -10rpx 26rpx rgba(15, 23, 42, 0.06);
}

.complete-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: #10b981;
  color: #fff;
  font-size: 30rpx;
  font-weight: 700;
  border-radius: 9999px;
  border: none;
  margin: 0;
  padding: 0;
  box-shadow: 0 14rpx 24rpx rgba(16, 185, 129, 0.18);
}

.complete-btn:active {
  transform: translateY(1rpx);
  opacity: 0.92;
}

.complete-btn::after {
  border: none;
}
</style>
