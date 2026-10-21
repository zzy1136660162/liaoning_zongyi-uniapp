<template>
  <view class="page">
    <view class="content">
      <view class="result-card" :class="{ 'result-card--pending': paymentOutcome.state !== 'success' }">
        <view class="result-heading">
          <view class="result-icon">
            <uni-icons :type="paymentOutcome.state === 'success' ? 'checkmarkempty' : 'info'" size="28" color="#ffffff" />
          </view>
          <view class="result-copy">
            <text class="success-text">{{ paymentOutcome.title }}</text>
            <text class="result-caption">{{ syncing ? '正在确认订单状态，请稍候' : paymentInfo.primaryTip }}</text>
          </view>
        </view>
        <view class="amount-section">
          <text class="amount-label">{{ paymentOutcome.state === 'success' ? '实付金额' : '订单金额' }}</text>
          <view class="amount-main" v-if="!loading && paymentInfo.hasOrder">
            <text class="currency">¥</text><text class="amount-value">{{ paymentInfo.amount.toFixed(2) }}</text>
          </view>
          <text class="amount-placeholder" v-else>{{ loading ? '确认中…' : '—' }}</text>
        </view>
        <view class="receipt-decoration" aria-hidden="true">
          <view class="receipt-paper"><view /><view /><view /></view>
          <view class="receipt-seal"><uni-icons type="checkmarkempty" size="18" color="#ffffff" /></view>
        </view>
      </view>

      <view class="info-card products-card" v-if="paymentInfo.hasOrder">
        <view class="card-heading">
          <text class="card-title">购买商品</text>
          <text class="card-note">共 {{ paymentInfo.itemCount }} 件</text>
        </view>
        <view class="purchased-item" v-for="item in paymentInfo.items" :key="item.id || item.productId + ':' + item.skuId">
          <image class="product-image" :src="getProductImageUrl(item.productImage)" mode="aspectFill"
            @error="handleProductImageError(item.productImage)" />
          <view class="product-info">
            <text class="product-name">{{ item.productName || '订单商品' }}</text>
            <text class="product-meta">{{ formatOrderItemMeta(item) || '规格以订单详情为准' }}</text>
            <view class="product-bottom">
              <text class="product-price">¥{{ orderItemSubtotal(item).toFixed(2) }}</text>
              <text class="product-quantity">×{{ item.quantity }}</text>
            </view>
          </view>
        </view>
        <text v-if="!paymentInfo.items.length" class="empty-detail">商品明细暂未获取，请在订单详情查看</text>
        <view class="goods-total"><text>商品金额</text><text>¥{{ paymentInfo.goodsAmount.toFixed(2) }}</text></view>
      </view>

      <view class="info-card delivery-card" v-if="paymentInfo.hasOrder">
        <view class="card-heading">
          <view class="card-title-with-icon"><uni-icons :type="paymentInfo.requiresShipping ? 'paperplane' : 'shop'" size="20" color="#15856f" />
            <text class="card-title">{{ paymentInfo.requiresShipping ? '配送与收货' : '到院服务' }}</text>
          </view>
          <text class="delivery-tag">{{ paymentInfo.requiresShipping ? '快递配送' : '无需配送' }}</text>
        </view>
        <template v-if="paymentInfo.requiresShipping">
          <view class="delivery-method"><text>{{ paymentInfo.shippingMethod }}</text><text class="freight-note">{{ paymentInfo.shippingFeeText }}</text></view>
          <view class="address-block" v-if="paymentInfo.receiverName || paymentInfo.receiverPhone || paymentInfo.addressText">
            <view class="address-icon"><uni-icons type="location-filled" size="19" color="#15856f" /></view>
            <view class="address-content">
              <view class="receiver"><text>{{ paymentInfo.receiverName || '收货人' }}</text><text>{{ paymentInfo.receiverPhone }}</text></view>
              <text class="address-text">{{ paymentInfo.addressText || '收货地址暂未获取，请在订单详情查看' }}</text>
            </view>
          </view>
          <text v-else class="empty-detail">收货信息暂未获取，请在订单详情查看</text>
          <view v-if="paymentInfo.hasTherapy" class="service-note">本单还包含到院服务，请在订单详情查看核销券。</view>
        </template>
        <view v-else class="therapy-note">
          <text>传统疗法到院核销，无需物流配送</text>
          <text>可在订单详情查看服务项目及核销信息。</text>
        </view>
      </view>

      <view class="info-card" v-if="paymentInfo.hasOrder">
        <view class="card-heading"><text class="card-title">订单信息</text></view>
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
          <view class="order-number"><text class="info-value order-no">{{ paymentInfo.orderNo || '暂未获取' }}</text>
            <text v-if="paymentInfo.orderNo" class="copy-link" role="button" @click.stop="copyOrderNo">复制</text>
          </view>
        </view>
        <view class="info-row">
          <text class="info-label">下单时间</text>
          <text class="info-value">{{ paymentInfo.createdTime || '—' }}</text>
        </view>
        <view class="info-row" v-if="paymentInfo.paymentTime">
          <text class="info-label">支付时间</text>
          <text class="info-value">{{ paymentInfo.paymentTime }}</text>
        </view>
      </view>

      <view class="tip-section">
        <text class="tip-text">{{ paymentInfo.secondaryTip || '付款与订单进度请以订单详情为准' }}</text>
      </view>
    </view>

    <view class="footer">
      <button class="list-btn" @click="goOrderList">订单列表</button>
      <button class="complete-btn" @click="goToOrder">{{ paymentOutcome.state === 'success' ? '查看已支付订单' : '查看订单进度' }}</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { getOrderDetail } from '@/api/order.js'
import { syncPaymentByOrder } from '@/api/payment.js'
import { buildCartItemKey, removeFromCart } from '@/utils/cart.js'
import { logPageView, logButtonClick } from '@/api/access-log.js'
import { isTherapyOrder, hasTherapyEntitlement } from '@/utils/therapy.js'
import { getPaymentOutcome, getOrderStatusText } from '@/utils/order-status.js'
import { useProductImages } from '@/utils/product-image.js'
import { getSessionGeneration, assertCurrentSession } from '@/utils/session.js'

const pageSession = getSessionGeneration()
let pageActive = true
const paymentOutcome = ref(getPaymentOutcome())
const { getProductImageUrl, handleProductImageError } = useProductImages()
onUnload(() => { pageActive = false })

const paymentInfo = ref({
  amount: 0,
  hasOrder: false,
  items: [],
  goodsAmount: 0,
  itemCount: 0,
  paymentMethod: '微信支付',
  orderStatusLabel: '待支付确认',
  orderNo: '',
  createdTime: '',
  paymentTime: '',
  requiresShipping: true,
  hasTherapy: false,
  shippingMethod: '',
  receiverName: '',
  receiverPhone: '',
  addressText: '',
  shippingFeeText: '运费到付，由快递员收取，以实际支付为准',
  primaryTip: '订单已提交，我们将尽快为您处理',
  secondaryTip: '运费到付，由快递员收取，以实际支付为准'
})

const loading = ref(true)
const syncing = ref(false)
const cartCleared = ref(false)

let currentOrderId = ''

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
    const quantity = Number(item.quantity || 1)
    return total + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1)
  }, 0)
}

const formatOrderItemMeta = (item = {}) => [item.skuSpecText || item.specText || item.skuName, item.unit].filter(Boolean).join(' / ')

const orderItemSubtotal = (item = {}) => item.subtotalAmount != null
  ? toAmount(item.subtotalAmount) : toAmount(item.price) * (Number(item.quantity) || 1)

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
  return getOrderStatusText(orderData)
}

const resolveShippingFeeText = (orderData = {}) => {
  if (isTherapyOrder(orderData)) {
    return '传统疗法无需快递费'
  }

  const shippingFee = toAmount(orderData.shippingFee, 0)
  if (shippingFee > 0) {
    return `约¥${shippingFee.toFixed(2)}（到付）`
  }
  return orderData.shippingPaymentMethod || '运费到付，由快递员收取，以实际支付为准'
}

const applyTips = (orderData = {}) => {
  if (paymentOutcome.value.state !== 'success') {
    paymentInfo.value.primaryTip = paymentOutcome.value.tip
    paymentInfo.value.secondaryTip = ''
    return
  }
  if (isTherapyOrder(orderData)) {
    paymentInfo.value.primaryTip = '支付成功后可在订单详情查看核销二维码'
    paymentInfo.value.secondaryTip = '传统疗法到院核销，无需物流配送'
    return
  }
  paymentInfo.value.primaryTip = '订单已提交，我们将尽快为您处理'
  paymentInfo.value.secondaryTip = paymentInfo.value.shippingFeeText
}

const isOrderPaid = orderData => getPaymentOutcome(orderData).state === 'success'

const clearPaidCartItems = (orderData = {}) => {
  if (cartCleared.value || !isOrderPaid(orderData)) {
    return
  }

  const itemProductIds = Array.isArray(orderData.items)
    ? uniqueStringIds(orderData.items.map(item => buildCartItemKey(item.productId, item.skuId)))
    : []
  const productIds = itemProductIds

  if (productIds.length > 0 && removeFromCart(productIds)) {
    cartCleared.value = true
  }
}

const applyOrderData = (orderData) => {
  assertCurrentSession(pageSession)
  if (!pageActive) return
  paymentOutcome.value = getPaymentOutcome(orderData)
  paymentInfo.value.hasOrder = true
  paymentInfo.value.items = Array.isArray(orderData.items) ? orderData.items : []
  paymentInfo.value.amount = toAmount(orderData.paidAmount ?? orderData.payableAmount ?? orderData.totalAmount, 0)
  paymentInfo.value.goodsAmount = toAmount(orderData.totalAmount ?? paymentInfo.value.amount, 0)
  paymentInfo.value.itemCount = sumItemCount(orderData.items)
  paymentInfo.value.orderStatusLabel = resolveOrderStatusLabel(orderData)
  paymentInfo.value.orderNo = orderData.orderNo || ''
  paymentInfo.value.createdTime = formatTime(orderData.createdAt)
  paymentInfo.value.shippingFeeText = resolveShippingFeeText(orderData)
  paymentInfo.value.requiresShipping = !isTherapyOrder(orderData)
  paymentInfo.value.hasTherapy = hasTherapyEntitlement(orderData)
  paymentInfo.value.shippingMethod = orderData.shippingCompany || '快递配送'
  // 使用下单时保存的收货快照，地址簿后续修改不能改变购买回执。
  paymentInfo.value.receiverName = orderData.receiverName || ''
  paymentInfo.value.receiverPhone = orderData.receiverPhone || ''
  paymentInfo.value.addressText = [orderData.province, orderData.city, orderData.district, orderData.addressDetail].filter(Boolean).join(' ')

  const payTime = orderData.payTime
  paymentInfo.value.paymentTime = formatTime(payTime)

  clearPaidCartItems(orderData)

  applyTips(orderData)
}

const fetchOrderDetail = async (orderId) => {
  assertCurrentSession(pageSession)
  if (!pageActive) throw new Error('页面已关闭')
  const result = await getOrderDetail(orderId, { showLoading: false })
  assertCurrentSession(pageSession)
  return result
}

const waitForPaymentConfirmed = async (orderId, outTradeNo) => {
  syncing.value = true

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    try {
      const orderData = await fetchOrderDetail(orderId)
      applyOrderData(orderData)
      if (getPaymentOutcome(orderData).terminal) {
        return true
      }
    } catch (error) {
      if (!pageActive || error.code === 'SESSION_CHANGED') return false
      console.warn('event=ui_order_payment_success stage=payment_poll result=unknown reason=query_failed')
    }

    if (attempt < POLL_MAX_ATTEMPTS - 1) {
      await sleep(POLL_INTERVAL_MS)
    }
  }

  if (outTradeNo) {
    try {
      assertCurrentSession(pageSession)
      if (!pageActive) return false
      await syncPaymentByOrder(orderId, outTradeNo)
      const orderData = await fetchOrderDetail(orderId)
      applyOrderData(orderData)
      if (getPaymentOutcome(orderData).terminal) {
        return true
      }
    } catch (error) {
      console.warn('event=ui_order_payment_success stage=payment_sync result=unknown reason=sync_failed')
    }
  }

  return false
}

const loadOrderInfo = async (orderId, outTradeNo = '') => {
  if (!orderId) {
    console.warn('event=ui_order_payment_success stage=payment_state_request result=rejected reason=missing_order_id')
    loading.value = false
    return
  }

  try {
    console.debug('event=ui_order_payment_success stage=payment_state_request result=started')
    uni.showLoading({ title: '加载中...' })

    const orderData = await fetchOrderDetail(orderId)
    console.debug('event=ui_order_payment_success stage=payment_state_response result=received')
    applyOrderData(orderData)

    if (!getPaymentOutcome(orderData).terminal) {
      uni.hideLoading()
      await waitForPaymentConfirmed(orderId, outTradeNo)
    }
  } catch (error) {
    if (error.code === 'SESSION_CHANGED' || !pageActive) return
    paymentOutcome.value = { state: 'unknown', title: '支付结果待确认', tip: '暂时无法获取订单状态，请稍后在订单列表查看。' }
    paymentInfo.value.primaryTip = paymentOutcome.value.tip
    console.error('event=ui_order_payment_success stage=payment_state_request result=unknown reason=query_failed')
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
  console.debug('event=ui_order_payment_success stage=page_load result=started')
  const orderId = options.orderId || options.id
  const outTradeNo = options.combineOutTradeNo || options.outTradeNo || ''
  currentOrderId = orderId || ''
  console.debug('event=ui_order_payment_success stage=route_context result=parsed')

  logPageView('支付成功页面', '用户进入支付成功页面', orderId)

  if (orderId) {
    await loadOrderInfo(orderId, outTradeNo)
  } else {
    paymentOutcome.value = { state: 'unknown', title: '支付结果待确认' }
    paymentInfo.value.orderStatusLabel = '缺少订单信息'
    paymentInfo.value.primaryTip = '请在订单列表查看实际付款结果。'
    paymentInfo.value.secondaryTip = ''
    loading.value = false
  }
})

const goOrderList = () => {
  if (pageActive) uni.redirectTo({ url: '/pages/order/order_list' })
}

const goToOrder = () => {
  if (!pageActive) return
  logButtonClick('支付成功页面', '查看订单')
  // 保留当前这笔订单的状态与履约信息，不能跳回商品列表或猜一个订单筛选状态。
  if (currentOrderId) uni.redirectTo({ url: `/pages/order/order-detail?orderId=${encodeURIComponent(currentOrderId)}` })
  else goOrderList()
}

const copyOrderNo = () => {
  if (!paymentInfo.value.orderNo || !pageActive) return
  uni.setClipboardData({ data: paymentInfo.value.orderNo,
    success: () => uni.showToast({ title: '订单号已复制', icon: 'success' }) })
}
</script>

<style scoped>
.page {
  --brand: #11856e;
  --ink: #1b3330;
  --muted: #7b8987;
  --line: #edf1ef;
  min-height: 100vh;
  background: #f3f7f5;
  color: var(--ink);
  padding-bottom: calc(126rpx + env(safe-area-inset-bottom));
}
.content { padding: 28rpx 26rpx 16rpx; }
.result-card {
  position: relative;
  overflow: hidden;
  padding: 32rpx;
  margin-bottom: 24rpx;
  border-radius: 28rpx;
  background: linear-gradient(125deg, #dff4e9, #edf8f2 75%);
  border: 1rpx solid #d4eade;
}
.result-heading { display: flex; align-items: center; gap: 18rpx; position: relative; z-index: 1; }
.result-icon { width: 64rpx; height: 64rpx; flex-shrink: 0; border-radius: 50%; background: var(--brand); display: flex; align-items: center; justify-content: center; }
.result-copy { flex: 1; min-width: 0; }
.success-text { display: block; font-size: 38rpx; line-height: 1.4; font-weight: 700; letter-spacing: 1rpx; }
.result-caption { display: block; margin-top: 6rpx; font-size: 23rpx; line-height: 1.65; color: #547b6d; }
.amount-section { position: relative; z-index: 1; margin: 30rpx 120rpx 0 82rpx; }
.amount-label { display: block; font-size: 23rpx; color: #547b6d; margin-bottom: 4rpx; }
.amount-main { display: flex; align-items: baseline; }
.currency { font-size: 32rpx; font-weight: 600; margin-right: 6rpx; }
.amount-value { font-size: 64rpx; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; letter-spacing: -1rpx; }
.amount-placeholder { font-size: 38rpx; line-height: 1.6; }
.receipt-decoration { position: absolute; width: 110rpx; height: 136rpx; right: 34rpx; bottom: 25rpx; transform: rotate(10deg); opacity: .85; }
.receipt-paper { position: absolute; width: 82rpx; height: 108rpx; top: 0; right: 8rpx; border: 3rpx solid #a8d3bc; border-radius: 9rpx; background: #ffffff; padding: 24rpx 12rpx; box-sizing: border-box; }
.receipt-paper view { height: 4rpx; border-radius: 4rpx; background: #cce5d6; margin-bottom: 12rpx; }
.receipt-paper view:last-child { width: 60%; }
.receipt-seal { position: absolute; bottom: 6rpx; right: 0; width: 46rpx; height: 46rpx; border-radius: 50%; background: #4ba381; border: 6rpx solid #e9f7ef; display: flex; align-items: center; justify-content: center; }
.result-card--pending { background: #fff6e6; border-color: #f2e4c5; }
.result-card--pending .result-icon { background: #c78b28; }
.result-card--pending .result-caption, .result-card--pending .amount-label { color: #95773f; }
.result-card--pending .receipt-decoration { display: none; }
.info-card { background: #fff; border: 1rpx solid #e8efea; border-radius: 24rpx; padding: 28rpx; margin-bottom: 22rpx; }
.card-heading { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-bottom: 26rpx; }
.card-title { font-size: 29rpx; font-weight: 650; }
.card-title-with-icon { display: flex; align-items: center; gap: 12rpx; }
.card-note { color: var(--muted); font-size: 23rpx; flex-shrink: 0; }
.purchased-item { display: flex; gap: 22rpx; margin-bottom: 26rpx; }
.product-image { width: 128rpx; height: 128rpx; flex-shrink: 0; border-radius: 12rpx; background: #f2f5f2; }
.product-info { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.product-name { font-size: 28rpx; line-height: 1.45; font-weight: 600; word-break: break-all; }
.product-meta { font-size: 23rpx; color: var(--muted); line-height: 1.5; margin-top: 8rpx; }
.product-bottom { display: flex; align-items: baseline; justify-content: space-between; gap: 12rpx; margin-top: auto; padding-top: 10rpx; }
.product-price { font-size: 28rpx; font-weight: 600; }
.product-quantity { font-size: 24rpx; color: var(--muted); }
.goods-total { border-top: 1rpx solid var(--line); padding-top: 24rpx; display: flex; justify-content: space-between; font-size: 25rpx; }
.goods-total text:last-child { font-weight: 600; }
.delivery-tag { font-size: 22rpx; padding: 6rpx 14rpx; background: #edf7f2; color: var(--brand); border-radius: 6rpx; flex-shrink: 0; }
.delivery-method { font-size: 26rpx; display: flex; flex-direction: column; gap: 12rpx; padding-bottom: 22rpx; border-bottom: 1rpx solid var(--line); }
.freight-note { color: var(--muted); font-size: 23rpx; line-height: 1.6; }
.address-block { display: flex; gap: 14rpx; padding-top: 24rpx; }
.address-icon { padding-top: 2rpx; flex-shrink: 0; }
.address-content { min-width: 0; flex: 1; }
.receiver { display: flex; flex-wrap: wrap; gap: 8rpx 22rpx; font-size: 27rpx; font-weight: 600; line-height: 1.5; }
.receiver text:last-child { font-weight: 400; }
.address-text { display: block; margin-top: 12rpx; font-size: 25rpx; line-height: 1.7; color: #586c65; word-break: break-all; }
.service-note { margin-top: 22rpx; padding: 16rpx; border-radius: 8rpx; background: #f3f8f5; color: #648174; font-size: 23rpx; line-height: 1.6; }
.therapy-note text { display: block; font-size: 26rpx; line-height: 1.8; }
.therapy-note text:last-child { color: var(--muted); font-size: 23rpx; }
.empty-detail { display: block; padding: 12rpx 0; font-size: 24rpx; color: var(--muted); line-height: 1.6; }
.info-card > .card-heading:last-child { margin-bottom: 0; }
.info-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 22rpx; padding: 18rpx 0; border-bottom: 1rpx solid var(--line); line-height: 1.6; }
.info-row:last-child { padding-bottom: 0; border-bottom: none; }
.info-label { font-size: 24rpx; color: var(--muted); flex-shrink: 0; }
.info-value { font-size: 24rpx; color: #334b43; text-align: right; word-break: break-all; }
.order-number { display: flex; align-items: flex-start; justify-content: flex-end; gap: 12rpx; min-width: 0; }
.order-no { font-variant-numeric: tabular-nums; }
.copy-link { color: var(--brand); font-size: 23rpx; flex-shrink: 0; padding: 0 4rpx; line-height: 1.7; }
.tip-section { padding: 0 16rpx 16rpx; text-align: center; }
.tip-text { font-size: 22rpx; line-height: 1.7; color: #90a098; }
.footer { position: fixed; left: 0; right: 0; bottom: 0; z-index: 5; display: flex; gap: 20rpx; padding: 20rpx 28rpx; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); background: #fff; border-top: 1rpx solid #e8efea; }
.footer button { margin: 0; padding: 0 20rpx; height: 84rpx; line-height: 84rpx; font-size: 27rpx; font-weight: 600; border-radius: 16rpx; }
.footer button::after { border: none; }
.list-btn { width: 208rpx; flex-shrink: 0; background: #f1f6f2; color: #4b6f5e; }
.complete-btn { flex: 1; background: var(--brand); color: #fff; }
.footer button:active { opacity: .8; }
</style>
