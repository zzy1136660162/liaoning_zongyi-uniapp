<template>
  <view class="page">
    <!-- 医院标识与首页保持一致，订单内容仍全部读取现有服务端记录。 -->
    <view class="hospital-brand">
      <image
        class="hospital-logo"
        src="https://shop.lntcm.com/assets_files/upload/2026/01/26/logotou.png"
        mode="aspectFit"
      />
      <view class="hospital-identity">
        <text class="hospital-name">
          辽宁中医药大学附属医院
        </text>
        <text class="hospital-subtitle">
          互联网医院
        </text>
      </view>
    </view>

    <view class="content">
      <view
        class="result-card"
        :class="{ 'result-card--pending': paymentOutcome.state !== 'success' }"
      >
        <view class="result-heading">
          <view class="result-icon">
            <uni-icons
              :type="paymentOutcome.state === 'success' ? 'checkmarkempty' : 'info'"
              size="26"
              :color="paymentOutcome.state === 'success' ? '#4A90E2' : '#b68028'"
            />
          </view>
          <view class="result-copy">
            <text class="success-text">
              {{ paymentOutcome.title }}
            </text>
            <text class="result-caption">
              {{ syncing ? '正在确认订单状态，请稍候' : paymentOutcome.state === 'success' ? '付款已确认，请留意后续订单进度' : paymentInfo.primaryTip }}
            </text>
          </view>
        </view>
        <view class="amount-section">
          <text class="amount-label">
            {{ paymentOutcome.state === 'success' ? '实付金额' : '订单金额' }}
          </text>
          <view
            v-if="!loading && paymentInfo.hasOrder"
            class="amount-main"
          >
            <text class="currency">
              ¥
            </text><text class="amount-value">
              {{ paymentInfo.amount.toFixed(2) }}
            </text>
          </view>
          <text
            v-else
            class="amount-placeholder"
          >
            {{ loading ? '确认中…' : '—' }}
          </text>
        </view>
        <view
          v-if="paymentInfo.hasOrder"
          class="order-receipt"
        >
          <text class="receipt-label">
            订单号
          </text>
          <text class="order-no">
            {{ paymentInfo.orderNo || '暂未获取' }}
          </text>
          <button
            v-if="paymentInfo.orderNo"
            class="copy-link"
            @click.stop="copyOrderNo"
          >
            <view
              class="copy-icon"
              aria-hidden="true"
            /><text>复制</text>
          </button>
        </view>
      </view>

      <view
        v-if="paymentInfo.hasOrder"
        class="info-card products-card"
      >
        <view class="card-heading">
          <text class="card-title">
            购买商品
          </text>
          <text class="card-note">
            共 {{ paymentInfo.itemCount }} 件
          </text>
        </view>
        <view
          v-for="item in paymentInfo.items"
          :key="item.id || item.productId + ':' + item.skuId"
          class="purchased-item"
        >
          <image
            class="product-image"
            :src="getProductImageUrl(item.productImage)"
            mode="aspectFill"
            @error="handleProductImageError(item.productImage)"
          />
          <view class="product-info">
            <text class="product-name">
              {{ item.productName || '订单商品' }}
            </text>
            <text class="product-meta">
              {{ formatOrderItemMeta(item) || '规格以订单详情为准' }}
            </text>
          </view>
          <view class="product-value">
            <text class="product-price">
              ¥{{ orderItemSubtotal(item).toFixed(2) }}
            </text>
            <text class="product-quantity">
              ×{{ item.quantity }}
            </text>
          </view>
        </view>
        <text
          v-if="!paymentInfo.items.length"
          class="empty-detail"
        >
          商品明细暂未获取，请在订单详情查看
        </text>
        <view class="goods-total">
          <text>商品金额</text><text>¥{{ paymentInfo.goodsAmount.toFixed(2) }}</text>
        </view>
      </view>

      <view
        v-if="paymentInfo.hasOrder"
        class="info-card delivery-card"
      >
        <view class="card-heading">
          <text class="card-title">
            {{ paymentInfo.requiresShipping ? '配送与收货' : '到院服务' }}
          </text>
          <text class="delivery-tag">
            {{ paymentInfo.orderStatusLabel }}
          </text>
        </view>
        <template v-if="paymentInfo.requiresShipping">
          <view class="delivery-method">
            <view class="shipping-method">
              <uni-icons
                type="paperplane"
                size="17"
                color="#8899ac"
              /><text>{{ paymentInfo.shippingMethod }}</text>
            </view>
            <text class="freight-note">
              运费说明：{{ paymentInfo.shippingFeeText }}
            </text>
          </view>
          <view
            v-if="paymentInfo.receiverName || paymentInfo.receiverPhone || paymentInfo.addressText"
            class="address-block"
          >
            <view class="address-icon">
              <uni-icons
                type="location"
                size="18"
                color="#899aac"
              />
            </view>
            <view class="address-content">
              <view class="receiver">
                <text>{{ paymentInfo.receiverName || '收货人' }}</text><text>{{ paymentInfo.receiverPhone }}</text>
              </view>
              <text class="address-text">
                {{ paymentInfo.addressText || '收货地址暂未获取，请在订单详情查看' }}
              </text>
            </view>
          </view>
          <text
            v-else
            class="empty-detail"
          >
            收货信息暂未获取，请在订单详情查看
          </text>
          <view
            v-if="paymentInfo.hasTherapy"
            class="service-note"
          >
            本单还包含到院服务，请在订单详情查看核销券。
          </view>
        </template>
        <view
          v-else
          class="therapy-note"
        >
          <text>传统疗法到院核销，无需物流配送</text>
          <text>可在订单详情查看服务项目及核销信息。</text>
        </view>
      </view>

      <view
        v-if="paymentInfo.hasOrder"
        class="info-card"
      >
        <view class="card-heading">
          <text class="card-title">
            订单信息
          </text>
        </view>
        <view class="info-row">
          <text class="info-label">
            订单状态
          </text><text class="info-value">
            {{ paymentInfo.orderStatusLabel }}
          </text>
        </view>
        <view class="info-row">
          <text class="info-label">
            支付方式
          </text><text class="info-value">
            {{ paymentInfo.paymentMethod }}
          </text>
        </view>
        <view class="info-row">
          <text class="info-label">
            下单时间
          </text><text class="info-value">
            {{ paymentInfo.createdTime || '—' }}
          </text>
        </view>
        <view
          v-if="paymentInfo.paymentTime"
          class="info-row"
        >
          <text class="info-label">
            支付时间
          </text><text class="info-value">
            {{ paymentInfo.paymentTime }}
          </text>
        </view>
      </view>

      <view class="tip-section">
        <text class="tip-text">
          {{ paymentInfo.secondaryTip || '付款与订单进度请以订单详情为准' }}
        </text>
      </view>
    </view>

    <view class="footer">
      <button
        class="list-btn"
        @click="goOrderList"
      >
        返回订单列表
      </button>
      <button
        class="complete-btn"
        @click="goToOrder"
      >
        {{ paymentOutcome.state === 'success' ? '查看本次订单' : '查看订单进度' }}
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { getOrderDetail } from '@/api/order.js'
import { syncPaymentByOrder } from '@/api/payment.js'
import { consumeOrderCart } from '@/utils/order-submission.js'
import { logPageView, logButtonClick, logAccess } from '@/utils/accessLog.js'
import { isTherapyOrder, hasTherapyEntitlement } from '@/utils/therapy.js'
import { getPaymentOutcome, getOrderStatusText } from '@/utils/order-status.js'
import { useProductImages } from '@/utils/product-image.js'
import { getSessionGeneration, assertCurrentSession, isCurrentSession } from '@/utils/session.js'

const PAGE_LOG = { moduleCode: 'PAYMENT', accessType: '订单支付', pageType: 'PAYMENT_RESULT', requestUri: '/pages/order/payment_success' }

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

const clearPaidCartItems = async (orderData = {}) => {
  if (cartCleared.value || !isOrderPaid(orderData)) {
    return
  }

  if (!orderData.id) return
  try {
    if (await consumeOrderCart(orderData.id)) cartCleared.value = true
  } catch (error) {
    if (pageActive && error.code !== 'SESSION_CHANGED') {
      uni.showToast({ title: '支付已成功，购物车清理失败，请稍后重试', icon: 'none' })
    }
  }
}

const applyOrderData = async (orderData) => {
  assertCurrentSession(pageSession)
  if (!pageActive) return
  paymentOutcome.value = getPaymentOutcome(orderData)
  paymentInfo.value.hasOrder = true
  paymentInfo.value.items = Array.isArray(orderData.items) ? orderData.items : []
  // 待确认订单的实付字段默认为 0，应展示应付金额；成功后才使用真实实付金额。
  paymentInfo.value.amount = toAmount(paymentOutcome.value.state === 'success'
    ? orderData.paidAmount ?? orderData.payableAmount ?? orderData.totalAmount
    : orderData.payableAmount ?? orderData.totalAmount ?? orderData.paidAmount, 0)
  paymentInfo.value.goodsAmount = toAmount(orderData.totalAmount ?? paymentInfo.value.amount, 0)
  paymentInfo.value.itemCount = sumItemCount(orderData.items)
  paymentInfo.value.orderStatusLabel = resolveOrderStatusLabel(orderData)
  paymentInfo.value.orderNo = orderData.orderNo || ''
  paymentInfo.value.createdTime = formatTime(orderData.createdAt)
  paymentInfo.value.shippingFeeText = resolveShippingFeeText(orderData)
  paymentInfo.value.requiresShipping = !isTherapyOrder(orderData)
  paymentInfo.value.hasTherapy = hasTherapyEntitlement(orderData)
  paymentInfo.value.shippingMethod = orderData.logisticsCompany || '快递配送'
  // 使用下单时保存的收货快照，地址簿后续修改不能改变购买回执。
  paymentInfo.value.receiverName = orderData.receiverName || ''
  paymentInfo.value.receiverPhone = orderData.receiverPhone || ''
  paymentInfo.value.addressText = [orderData.province, orderData.city, orderData.district, orderData.addressDetail].filter(Boolean).join(' ')

  const payTime = orderData.payTime
  paymentInfo.value.paymentTime = formatTime(payTime)

  await clearPaidCartItems(orderData)

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
      await applyOrderData(orderData)
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
      await applyOrderData(orderData)
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
    await applyOrderData(orderData)

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
  if (pageActive && isCurrentSession(pageSession)) logAccess({ ...PAGE_LOG, pageId: orderId, actionType: 'BEHAVIOR', actionCode: 'PAYMENT_STATUS_DISPLAYED', actionResult: paymentOutcome.value.terminal ? 'SUCCESS' : 'UNKNOWN', accessTitle: '展示支付结果', accessDescription: paymentOutcome.value.terminal ? '已展示服务端确认的支付与履约状态，具体资金结果以支付状态为准' : '本次等待结束，支付与履约结果仍待服务端确认', extraData: { paymentState: paymentOutcome.value.state } })
}

onLoad(async (options) => {
  console.debug('event=ui_order_payment_success stage=page_load result=started')
  const orderId = options.orderId || options.id
  const outTradeNo = options.combineOutTradeNo || options.outTradeNo || ''
  currentOrderId = orderId || ''
  console.debug('event=ui_order_payment_success stage=route_context result=parsed')

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

onShow(() => {
  if (pageActive && isCurrentSession(pageSession)) logPageView({ ...PAGE_LOG, pageId: currentOrderId, actionCode: 'PAYMENT_RESULT_VIEW', accessTitle: '支付结果', accessDescription: '进入支付结果页面，查询服务端确认的支付与订单履约状态' })
})

const goOrderList = () => {
  if (!pageActive || !isCurrentSession(pageSession)) return
  logButtonClick({ ...PAGE_LOG, pageId: currentOrderId, actionCode: 'PAYMENT_ORDER_LIST_OPEN', accessTitle: '查看订单列表', accessDescription: '从支付结果页面返回我的订单列表' })
  uni.redirectTo({ url: '/pages/order/order_list' })
}

const goToOrder = () => {
  if (!pageActive || !isCurrentSession(pageSession)) return
  // 保留当前这笔订单的状态与履约信息，不能跳回商品列表或猜一个订单筛选状态。
  if (currentOrderId) {
    logButtonClick({ ...PAGE_LOG, pageId: currentOrderId, actionCode: 'PAYMENT_ORDER_DETAIL_OPEN', accessTitle: '查看本次订单', accessDescription: '从支付结果页面查看当前订单的最新状态与履约信息' })
    uni.redirectTo({ url: `/pages/order/order-detail?orderId=${encodeURIComponent(currentOrderId)}` })
  }
  else goOrderList()
}

const copyOrderNo = () => {
  if (!paymentInfo.value.orderNo || !pageActive) return
  uni.setClipboardData({ data: paymentInfo.value.orderNo,
    fail: () => { if (pageActive) uni.showToast({ title: '复制失败，请重试', icon: 'none' }) } })
}
</script>

<style scoped>
.page {
  --brand: #4A90E2;
  --brand-dark: #397bc9;
  --ink: #243347;
  --muted: #718093;
  --line: #edf0f4;
  min-height: 100vh;
  background: #f5f7fa;
  color: var(--ink);
  /* 固定底栏和安全区占位，长订单的最后一行仍可完整滚动查看。 */
  padding-bottom: calc(156rpx + env(safe-area-inset-bottom));
}
.hospital-brand { display: flex; align-items: center; gap: 22rpx; min-height: 148rpx; box-sizing: border-box; padding: 28rpx 40rpx; background: #fff; border-bottom: 1rpx solid var(--line); }
.hospital-logo { width: 68rpx; height: 76rpx; flex-shrink: 0; }
.hospital-identity { flex: 1; min-width: 0; }
.hospital-name { display: block; font-size: 29rpx; line-height: 1.4; font-weight: 600; }
.hospital-subtitle { display: block; margin-top: 8rpx; color: var(--muted); font-size: 23rpx; letter-spacing: 2rpx; }
.content { padding: 32rpx 32rpx 20rpx; }
.result-card { padding: 42rpx 40rpx 0; margin-bottom: 24rpx; border-radius: 24rpx; background: #fff; border: 1rpx solid var(--line); }
.result-heading { display: flex; align-items: center; gap: 24rpx; }
.result-icon { width: 70rpx; height: 70rpx; flex-shrink: 0; border: 2rpx solid var(--brand); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.result-copy { flex: 1; min-width: 0; }
.success-text { display: block; font-size: 44rpx; line-height: 1.35; font-weight: 600; letter-spacing: 1rpx; }
.result-caption { display: block; margin-top: 10rpx; color: var(--muted); font-size: 24rpx; line-height: 1.6; }
.amount-section { padding: 48rpx 0 44rpx; text-align: center; }
.amount-label { display: block; color: var(--muted); font-size: 24rpx; line-height: 1.5; }
.amount-main { display: flex; justify-content: center; align-items: baseline; gap: 8rpx; margin-top: 8rpx; }
.currency { font-size: 42rpx; font-weight: 500; }
.amount-value { font-size: 78rpx; font-weight: 600; line-height: 1.25; font-variant-numeric: tabular-nums; letter-spacing: -1rpx; }
.amount-placeholder { display: block; margin-top: 8rpx; font-size: 38rpx; line-height: 1.6; }
.order-receipt { min-height: 96rpx; display: flex; align-items: flex-start; gap: 14rpx; box-sizing: border-box; border-top: 1rpx solid var(--line); padding: 28rpx 0; line-height: 1.6; }
.receipt-label { color: #8993a1; font-size: 23rpx; flex-shrink: 0; }
.order-no { flex: 1; min-width: 0; color: #647286; font-size: 23rpx; word-break: break-all; font-variant-numeric: tabular-nums; }
.copy-link { display: flex; align-items: center; gap: 6rpx; flex-shrink: 0; margin: -8rpx 0 -8rpx auto; padding: 8rpx 0 8rpx 8rpx; background: transparent; color: var(--brand-dark); font-size: 23rpx; line-height: 1.6; border-radius: 0; }
.copy-link::after { border: none; }
.copy-icon { position: relative; display: block; width: 16rpx; height: 18rpx; margin-left: 4rpx; border: 1.5rpx solid currentColor; border-radius: 2rpx; }
.copy-icon::before { content: ''; position: absolute; width: 12rpx; height: 14rpx; top: -6rpx; left: -6rpx; border-top: 1.5rpx solid currentColor; border-left: 1.5rpx solid currentColor; border-radius: 2rpx 0 0; }
.result-card--pending .result-icon { border-color: #b68028; }
.result-card--pending .success-text { color: #6e5329; }
.info-card { padding: 36rpx 34rpx; margin-bottom: 24rpx; border-radius: 24rpx; background: #fff; border: 1rpx solid var(--line); }
.card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; margin-bottom: 36rpx; }
.card-title { display: flex; align-items: center; gap: 16rpx; min-width: 0; font-size: 30rpx; line-height: 1.4; font-weight: 600; }
.card-title::before { content: ''; display: block; width: 6rpx; height: 28rpx; flex-shrink: 0; border-radius: 4rpx; background: var(--brand); }
.card-note { color: #8993a1; font-size: 22rpx; line-height: 1.6; flex-shrink: 0; }
.purchased-item { display: flex; align-items: center; gap: 26rpx; }
.purchased-item + .purchased-item { margin-top: 30rpx; padding-top: 30rpx; border-top: 1rpx solid var(--line); }
.product-image { width: 130rpx; height: 130rpx; flex-shrink: 0; border-radius: 14rpx; background: #f5f7f9; }
.product-info { flex: 1; min-width: 0; }
.product-name { display: block; font-size: 30rpx; line-height: 1.5; font-weight: 500; word-break: break-all; }
.product-meta { display: block; margin-top: 12rpx; color: #8993a1; font-size: 24rpx; line-height: 1.5; word-break: break-all; }
.product-value { display: flex; flex-direction: column; align-items: flex-end; gap: 16rpx; flex-shrink: 0; max-width: 200rpx; }
.product-price { font-size: 30rpx; line-height: 1.4; font-variant-numeric: tabular-nums; word-break: break-all; text-align: right; }
.product-quantity { font-size: 24rpx; line-height: 1.5; color: #8993a1; }
.goods-total { display: flex; justify-content: space-between; gap: 20rpx; margin-top: 30rpx; padding-top: 24rpx; border-top: 1rpx solid var(--line); color: #718093; font-size: 24rpx; line-height: 1.5; }
.goods-total text:last-child { color: #59687b; font-variant-numeric: tabular-nums; }
.delivery-card .card-heading { margin-bottom: 30rpx; }
.delivery-tag { flex-shrink: 0; max-width: 330rpx; padding: 6rpx 18rpx; border-radius: 8rpx; background: #f0f6fe; color: var(--brand-dark); font-size: 22rpx; line-height: 1.5; text-align: right; }
.delivery-method { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 14rpx 20rpx; }
.shipping-method { display: flex; align-items: center; gap: 12rpx; font-size: 28rpx; line-height: 1.5; }
.freight-note { max-width: 100%; font-size: 23rpx; line-height: 1.7; color: var(--muted); }
.address-block { display: flex; gap: 20rpx; margin-top: 32rpx; padding-top: 32rpx; border-top: 1rpx solid var(--line); }
.address-icon { flex-shrink: 0; padding-top: 2rpx; }
.address-content { flex: 1; min-width: 0; }
.receiver { display: flex; flex-wrap: wrap; gap: 8rpx 28rpx; font-size: 28rpx; line-height: 1.5; font-weight: 500; }
.receiver text:last-child { color: #4a596c; font-size: 26rpx; font-weight: 400; }
.address-text { display: block; margin-top: 14rpx; color: #7c8897; font-size: 26rpx; line-height: 1.8; word-break: break-all; }
.service-note { margin-top: 28rpx; padding-top: 24rpx; border-top: 1rpx solid var(--line); color: #718093; font-size: 24rpx; line-height: 1.7; }
.therapy-note text { display: block; font-size: 26rpx; line-height: 1.8; }
.therapy-note text:last-child { margin-top: 8rpx; color: var(--muted); font-size: 24rpx; }
.empty-detail { display: block; padding: 12rpx 0; color: var(--muted); font-size: 24rpx; line-height: 1.6; }
.info-row { display: flex; align-items: baseline; justify-content: space-between; gap: 24rpx; font-size: 24rpx; line-height: 1.6; }
.info-row + .info-row { margin-top: 22rpx; }
.info-label { flex-shrink: 0; color: #8993a1; }
.info-value { min-width: 0; color: #59687b; font-variant-numeric: tabular-nums; text-align: right; word-break: break-all; }
.tip-section { padding: 12rpx 12rpx 0; text-align: center; }
.tip-text { color: #8993a1; font-size: 22rpx; line-height: 1.7; }
.footer { position: fixed; left: 0; right: 0; bottom: 0; z-index: 5; display: flex; gap: 24rpx; padding: 28rpx 32rpx 34rpx; padding-bottom: calc(34rpx + env(safe-area-inset-bottom)); background: #fff; border-top: 1rpx solid #e8edf3; }
.footer button { box-sizing: border-box; margin: 0; padding: 0 16rpx; height: 88rpx; line-height: 86rpx; border-radius: 16rpx; font-size: 28rpx; font-weight: 500; }
.footer button::after { border: none; }
.list-btn { width: 278rpx; flex-shrink: 0; background: #fff; color: #63758b; border: 1rpx solid #cbd6e3; }
.complete-btn { flex: 1; background: var(--brand); color: #fff; border: 1rpx solid var(--brand); }
.footer button:active, .copy-link:active { opacity: .8; }
</style>
