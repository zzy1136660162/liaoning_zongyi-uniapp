<template>
  <view class="order-list-page">
    <!-- 标签页 -->
    <scroll-view
      class="tabs"
      scroll-x
      :scroll-into-view="'order-tab-' + activeTab"
      :show-scrollbar="false"
    >
      <view class="tabs-content">
        <view
          v-for="tab in tabs"
          :id="'order-tab-' + tab.key"
          :key="tab.key"
          class="tab-item"
          :class="{ active: activeTab === tab.key }"
          @click="switchTab(tab.key)"
        >
          {{ tab.label }}
        </view>
      </view>
    </scroll-view>

    <!-- 订单列表 -->
    <scroll-view
      :key="activeTab"
      class="order-list"
      scroll-y
      refresher-enabled
      :refresher-triggered="refreshing"
      :lower-threshold="120"
      @refresherrefresh="refreshOrders"
      @scrolltolower="loadMoreOrders"
    >
      <view
        v-if="hasLoaded && !loading && !loadError && orders.length === 0"
        class="empty"
      >
        <text class="empty-text">
          暂无订单
        </text>
      </view>

      <view
        v-for="order in orders"
        :key="order.id"
        class="order-item"
        hover-class="order-item--hover"
        hover-stay-time="80"
        @click="goToOrderDetail(order.id)"
      >
        <view class="order-header">
          <view class="order-number">
            <text class="order-no">
              订单号: {{ order.orderNo }}
            </text>
            <text
              v-if="order.orderNo"
              class="copy-order-no"
              @click.stop="copyOrderNo(order.orderNo)"
            >
              复制
            </text>
          </view>
          <text
            class="order-status"
            :class="'s-' + order.status"
          >
            {{ getStatusText(order.status, order) }}
          </text>
        </view>

        <!-- 订单日期 -->
        <view class="order-date">
          <text class="date-label">
            下单时间:
          </text>
          <text class="date-value">
            {{ formatDate(order.createTime) }}
          </text>
        </view>

        <view class="order-products" v-if="order.items && order.items.length > 0">
          <view
            v-for="item in visibleOrderItems(order)"
            :key="item.id"
            class="product-item"
          >
            <view class="product-main">
              <image
                class="product-image"
                :src="getProductImageUrl(item.productImage)"
                mode="aspectFill"
                @error="handleProductImageError(item.productImage)"
              />
              <view class="product-text">
                <text class="product-name">{{ item.productName }}</text>
                <text v-if="formatOrderItemMeta(item)" class="order-product-meta">{{ formatOrderItemMeta(item) }}</text>
                <text
                  v-if="getOrderItemRefundText(item)"
                  class="product-refund-summary"
                >
                  {{ getOrderItemRefundText(item) }}
                </text>
              </view>
            </view>
            <view class="product-side">
              <text class="product-quantity">×{{ item.quantity }}</text>
              <text class="product-subtotal">¥{{ orderItemSubtotal(item).toFixed(2) }}</text>
            </view>
          </view>
          <view
            v-if="remainingOrderItemCount(order) > 0"
            class="order-more"
            @click.stop="goToOrderDetail(order.id)"
          >
            还有 {{ remainingOrderItemCount(order) }} 件商品，查看详情
          </view>
        </view>
        <view v-else class="order-products-empty">暂无商品明细</view>

        <view
          v-if="hasRedeemEntitlement(order)"
          class="order-redeem-summary"
        >
          {{ redeemSummaryText(order) }}
        </view>

        <view v-if="shouldContactForPhysicalRefund(order)" class="refund-contact-tip">
          实物商品已发货，如需退款请线下联系客服。
        </view>
        <view class="order-footer">
          <view class="order-amount">
            <text class="amount-label">
              实付款:
            </text>
            <text class="amount-value">
              ¥{{ (Number(order.payableAmount || 0) + Number(order.shippingFee || 0)).toFixed(2) }}
            </text>
          </view>
          <view class="order-actions">
            <button
              v-if="order.status === 0"
              class="action-btn cancel-btn"
              @click.stop="handleCancelOrder(order.id)"
            >
              取消订单
            </button>
            <button
              v-if="canPayOrder(order)"
              class="action-btn pay-btn"
              @click.stop="handlePayOrder(order)"
            >
              去支付
            </button>
            <button
              v-if="order.status === 2"
              class="action-btn confirm-btn"
              @click.stop="handleConfirmReceipt(order.id)"
            >
              确认收货
            </button>
            <!-- 按逐项可退数量显示入口，部分核销或已有退款不影响剩余项目申请。 -->
            <button
              v-if="canOrderApplyRefund(order)"
              class="action-btn refund-btn"
              @click.stop="applyRefund(order.id)"
            >
              {{ refundActionText(order) }}
            </button>
            <!-- 申请记录与继续退款是两种操作，可以同时显示。 -->
            <button
              v-if="order.refundApplicationId"
              class="action-btn view-refund-btn"
              @click.stop="viewRefundApplication(order.refundApplicationId)"
            >
              退款记录
            </button>
          </view>
        </view>
      </view>
      <view class="list-status">
        <text v-if="loading">
          订单加载中...
        </text>
        <button
          v-else-if="loadError"
          class="list-retry"
          @click="retryOrders"
        >
          {{ loadError }}，点击重试
        </button>
        <button
          v-else-if="hasMore"
          class="list-retry"
          @click="loadMoreOrders"
        >
          加载更多
        </button>
        <text v-else-if="hasLoaded && orders.length > 0">
          没有更多订单了
        </text>
      </view>
    </scroll-view>

    <TabBar
      current="order"
    />
  </view>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getOrderPage, getOrderDetail, cancelOrder, confirmReceipt } from '@/api/order.js'
import { checkCanApplyRefund } from '@/api/refund.js'
import { getOrderItemRefundText, canOrderApplyRefund, shouldContactForPhysicalRefund } from '@/utils/refund.js'
import { logPageView, logButtonClick, logAccess, getActionFailureResult } from '@/utils/accessLog.js'
import { isTherapyOrder, hasTherapyEntitlement } from '@/utils/therapy.js'
import { canPayOrder, getOrderStatusText } from '@/utils/order-status.js'
import { getSessionGeneration, isCurrentSession, onSessionChanged } from '@/utils/session.js'
import { useProductImages } from '@/utils/product-image.js'
import TabBar from '@/components/TabBar/TabBar.vue'

const PAGE_LOG = { moduleCode: 'ORDER', accessType: '订单', pageType: 'ORDER_LIST', pageId: '', requestUri: '/pages/order/order_list' }

const { getProductImageUrl, handleProductImageError } = useProductImages()
const activeTab = ref('all')
const orders = ref([])
const pageNum = ref(0)
const total = ref(0)
const hasMore = ref(false)
const hasLoaded = ref(false)
const loading = ref(false)
const refreshing = ref(false)
const loadError = ref('')
const navigatingOrderId = ref(null)
const ORDER_LIST_PREVIEW_LIMIT = 2
const ORDER_PAGE_SIZE = 20
let unsubscribeSessionChanged = null
let requestSequence = 0
let disposed = false

const tabs = ref([
  { key: 'all', label: '全部' },
  { key: 'completed', label: '已完成' },
  { key: 'pending', label: '待支付' },
  { key: 'paid', label: '已支付' },
  { key: 'shipping', label: '待发货' },
  { key: 'received', label: '待收货' },
  { key: 'cancelled', label: '已取消' },
  { key: 'afterSale', label: '退款' }
])

const normalizeRedeemVouchers = (item = {}) => {
  const vouchers = item.redeemVouchers || []
  if (!Array.isArray(vouchers)) return []
  return vouchers.map((voucher, index) => ({
    id: voucher.id,
    sequenceNo: voucher.sequenceNo || index + 1,
    redeemStatus: voucher.redeemStatus ?? 0,
    redeemStatusText: voucher.redeemStatusText || '',
    verifyQrBase64: voucher.verifyQrBase64 || ''
  }))
}

const orderItemSubtotal = (item = {}) => {
  const subtotal = Number(item.subtotalAmount)
  if (Number.isFinite(subtotal) && subtotal > 0) {
    return subtotal
  }
  const price = Number(item.price) || 0
  const quantity = Number(item.quantity) || 1
  return price * quantity
}

const formatOrderItemMeta = (item = {}) => {
  const parts = [
    item.specText,
    item.unit
  ].filter(Boolean)
  return parts.join(' / ')
}

const visibleOrderItems = (order = {}) => {
  return (order.items || []).slice(0, ORDER_LIST_PREVIEW_LIMIT)
}

const remainingOrderItemCount = (order = {}) => {
  return Math.max((order.items || []).length - ORDER_LIST_PREVIEW_LIMIT, 0)
}

const flattenRedeemVouchers = (order = {}) => {
  return (order.items || []).flatMap(item => item.redeemVouchers || [])
}

const hasRedeemEntitlement = (order = {}) => {
  // 只认购买时的核销资格或已生成的真实券，整单默认核销状态不代表有权益。
  return hasTherapyEntitlement(order)
}

const redeemSummaryText = (order = {}) => {
  if (!hasRedeemEntitlement(order)) return ''
  const vouchers = flattenRedeemVouchers(order)
  if (vouchers.length > 0) {
    const redeemedCount = vouchers.filter(voucher => Number(voucher.redeemStatus) === 1).length
    const availableCount = vouchers.filter(voucher => Number(voucher.redeemStatus) === 0).length
    const frozenCount = vouchers.filter(voucher => Number(voucher.redeemStatus) === 3).length
    const refundedCount = vouchers.filter(voucher => Number(voucher.redeemStatus) === 2).length
    return `到店核销：可用 ${availableCount}，已核销 ${redeemedCount}，退款中 ${frozenCount}，已退废 ${refundedCount}`
  }
  return Number(order.redeemStatus) === 1 ? '到店核销：已核销' : '到店核销：待核销'
}

const resolveRawOrderItems = (order = {}) => {
  return order.items || []
}

const mapOrderItem = (item = {}) => ({
  id: item.id,
  productName: item.productName,
  productImage: item.productImage,
  specText: item.specText || '',
  unit: item.unit || '',
  quantity: item.quantity || 1,
  // 列表保留服务端的可退结果，历史申请只占用对应明细的数量。
  refundedQuantity: Number(item.refundedQuantity || 0),
  redeemedQuantity: Number(item.redeemedQuantity || 0),
  refundFrozenQuantity: Number(item.refundFrozenQuantity || 0),
  refundableQuantity: Number(item.refundableQuantity || 0),
  refundable: Boolean(item.refundable),
  refundBlockedReason: item.refundBlockedReason || '',
  price: item.price || '0.00',
  subtotalAmount: item.subtotalAmount,
  refundCompletedQuantity: Number(item.refundCompletedQuantity || 0),
  productCategorySnapshot: item.productCategorySnapshot,
  redeemRequiredSnapshot: item.redeemRequiredSnapshot,
  redeemVouchers: normalizeRedeemVouchers(item)
})

const mapOrderListItem = (order = {}) => ({
  id: order.id,
  orderNo: order.orderNo,
  orderType: order.orderType,
  payStatus: order.payStatus,
  paymentFulfillmentStatus: order.paymentFulfillmentStatus,
  redeemStatus: order.redeemStatus,
  displayStatusText: order.displayStatusText || '',
  verifyQrBase64: order.verifyQrBase64 || '',
  status: order.orderStatus,
  payableAmount: order.payableAmount,
  shippingFee: Number(order.shippingFee) || 0,
  createTime: order.createdAt,
  refundApplicationId: order.refundApplicationId ?? null,
  refundStatus: order.refundStatus ?? null,
  items: resolveRawOrderItems(order).map(mapOrderItem)
})

const hydrateMissingOrderItems = async (pageOrders, isCurrentRequest) => {
  const missingOrders = pageOrders.filter(order =>
    order.id && (!order.items || order.items.length === 0)
  )
  if (missingOrders.length === 0) {
    return
  }

  const detailResults = await Promise.all(missingOrders.map(order =>
    getOrderDetail(order.id, { showLoading: false })
      .then(detail => ({ orderId: order.id, detail }))
      .catch(() => {
        if (isCurrentRequest()) console.warn('event=ui_order_order_list stage=hydrate_missing_order_items result=warning reason=operation_incomplete')
        return null
      })
  ))
  if (!isCurrentRequest()) return
  const detailMap = new Map()
  detailResults
    .filter(Boolean)
    .forEach(result => detailMap.set(result.orderId, result.detail))

  if (detailMap.size === 0) {
    return
  }

  orders.value = orders.value.map(order => {
    const detail = detailMap.get(order.id)
    const detailItems = resolveRawOrderItems(detail).map(mapOrderItem)
    if (!detail || detailItems.length === 0) {
      return order
    }

    return {
      ...order,
      orderType: order.orderType ?? detail.orderType,
      payStatus: order.payStatus ?? detail.payStatus,
      paymentFulfillmentStatus: detail.paymentFulfillmentStatus ?? order.paymentFulfillmentStatus,
      redeemStatus: order.redeemStatus ?? detail.redeemStatus,
      displayStatusText: order.displayStatusText || detail.displayStatusText || '',
      verifyQrBase64: order.verifyQrBase64 || detail.verifyQrBase64 || '',
      items: detailItems
    }
  })
}

const fetchOrderPage = async (nextPage) => {
  const sequence = ++requestSequence
  const session = getSessionGeneration()
  const tab = activeTab.value
  const isCurrentRequest = () => !disposed && sequence === requestSequence &&
    isCurrentSession(session) && activeTab.value === tab
  loading.value = true
  loadError.value = ''
  try {
    const page = await getOrderPage({ tab, pageNum: nextPage, pageSize: ORDER_PAGE_SIZE })
    if (!isCurrentRequest()) return
    const rows = (page.rows || []).map(order => mapOrderListItem(order))
    const merged = new Map((nextPage === 1 ? [] : orders.value).map(order => [String(order.id), order]))
    rows.forEach(order => merged.set(String(order.id), order))
    orders.value = [...merged.values()]
    pageNum.value = page.pageNum
    total.value = page.total
    hasMore.value = page.hasMore
    hasLoaded.value = true
    await hydrateMissingOrderItems(rows, isCurrentRequest)
  } catch (error) {
    if (!isCurrentRequest()) return
    console.error('event=ui_order_order_list stage=load_orders result=failed reason=operation_incomplete')
    loadError.value = error.message || '订单加载失败'
  } finally {
    if (isCurrentRequest()) {
      loading.value = false
      refreshing.value = false
    }
  }
}

// 取消、收货和下拉刷新都重新读取当前分类的第一页。
const loadOrders = () => {
  if (disposed) return
  orders.value = []
  pageNum.value = 0
  total.value = 0
  hasMore.value = false
  hasLoaded.value = false
  return fetchOrderPage(1)
}

const loadMoreOrders = () => {
  if (disposed || loading.value || loadError.value || !hasMore.value) return
  return fetchOrderPage(pageNum.value + 1)
}

const retryOrders = () => {
  if (disposed || loading.value) return
  return pageNum.value === 0 ? loadOrders() : fetchOrderPage(pageNum.value + 1)
}

const refreshOrders = () => {
  refreshing.value = true
  return loadOrders()
}

const refundActionText = (order = {}) => {
  return order.refundApplicationId ? '继续退款' : '申请退款'
}

// 切换标签
const switchTab = (key) => {
  if (key === activeTab.value || !tabs.value.some(tab => tab.key === key)) return
  activeTab.value = key
  logButtonClick({ ...PAGE_LOG, actionCode: 'ORDER_FILTER', accessTitle: '筛选订单', accessDescription: '切换订单列表的状态筛选', extraData: { statusFilter: key } })
  return loadOrders()
}

// 获取状态文本
const getStatusText = (status, order = null) => {
  return getOrderStatusText({
    ...(order || {}),
    orderStatus: status,
    hasRedeemVouchers: order ? hasRedeemEntitlement(order) : false
  })
}

// 获取状态颜色
const getStatusColor = (status) => {
  const colorMap = {
    0: '#ff9900',
    1: '#3388ff',
    2: '#3388ff',
    3: '#00cc66',
    4: '#999999',
    5: '#ff6b35',
    6: '#007aff',
    7: '#ff9500'
  }
  return colorMap[status] || '#333333'
}

// ✅ 取消订单
const handleCancelOrder = async (orderId) => {
  const session = getSessionGeneration()
  uni.showModal({
    title: '提示',
    content: '确定要取消此订单吗？',
    success: async (res) => {
      if (disposed || !isCurrentSession(session)) return
      if (!res.confirm) {
        logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'ORDER_CANCEL_RESULT', actionResult: 'CANCELLED', accessTitle: '取消订单', accessDescription: '用户关闭确认弹窗，保留原订单', extraData: { orderId } })
        return
      }
      if (res.confirm) {
        try {
          logButtonClick({ ...PAGE_LOG, actionCode: 'ORDER_CANCEL', accessTitle: '取消订单', accessDescription: '用户确认取消指定订单', extraData: { orderId } })
          uni.showLoading({ title: '取消中...' })

          await cancelOrder(orderId)
          if (disposed || !isCurrentSession(session)) return
          logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'ORDER_CANCEL_RESULT', actionResult: 'SUCCESS', accessTitle: '取消订单', accessDescription: '服务端已确认订单取消', extraData: { orderId } })

          uni.hideLoading()
          uni.showToast({
            title: '订单已取消',
            icon: 'success'
          })

          // 重新加载订单列表
          loadOrders()
        } catch (error) {
          if (disposed || !isCurrentSession(session)) return
          logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'ORDER_CANCEL_RESULT', actionResult: getActionFailureResult(error), accessTitle: '取消订单', accessDescription: '取消订单未获得服务端成功确认', extraData: { orderId, reason: 'CANCEL_NOT_CONFIRMED' } })
          console.error('event=ui_order_order_list stage=cancel_order result=failed reason=request_failed')
          uni.hideLoading()
          uni.showToast({
            title: error.message || '取消失败',
            icon: 'none'
          })
        }
      }
    }
  })
}

// 去支付
const handlePayOrder = (order) => {
  if (!canPayOrder(order)) return
  goToOrderDetail(order.id, 'ORDER_PAY_OPEN')
}

// ✅ 确认收货
const handleConfirmReceipt = async (orderId) => {
  const session = getSessionGeneration()
  uni.showModal({
    title: '提示',
    content: '确认已收到货物吗？',
    success: async (res) => {
      if (disposed || !isCurrentSession(session)) return
      if (!res.confirm) {
        logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'ORDER_RECEIPT_RESULT', actionResult: 'CANCELLED', accessTitle: '确认收货', accessDescription: '用户取消确认收货，订单状态保持原样', extraData: { orderId } })
        return
      }
      if (res.confirm) {
        try {
          logButtonClick({ ...PAGE_LOG, actionCode: 'ORDER_RECEIPT', accessTitle: '确认收货', accessDescription: '用户确认已经收到指定订单商品', extraData: { orderId } })
          uni.showLoading({ title: '确认中...' })

          await confirmReceipt(orderId)
          if (disposed || !isCurrentSession(session)) return
          logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'ORDER_RECEIPT_RESULT', actionResult: 'SUCCESS', accessTitle: '确认收货', accessDescription: '服务端已保存确认收货结果', extraData: { orderId } })

          uni.hideLoading()
          uni.showToast({
            title: '确认收货成功',
            icon: 'success'
          })

          // 重新加载订单列表
          loadOrders()
        } catch (error) {
          if (disposed || !isCurrentSession(session)) return
          logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'ORDER_RECEIPT_RESULT', actionResult: getActionFailureResult(error), accessTitle: '确认收货', accessDescription: '确认收货未获得服务端成功确认', extraData: { orderId, reason: 'RECEIPT_NOT_CONFIRMED' } })
          console.error('event=ui_order_order_list stage=confirm_receipt result=failed reason=request_failed')
          uni.hideLoading()
          uni.showToast({
            title: error.message || '确认失败',
            icon: 'none'
          })
        }
      }
    }
  })
}

const copyOrderNo = (value) => {
  const orderNo = String(value ?? '').trim()
  if (!orderNo) return
  // setClipboardData 成功时使用平台原生提示，不叠加第二个成功提示。
  uni.setClipboardData({
    data: orderNo,
    fail: () => uni.showToast({ title: '复制失败，请重试', icon: 'none' })
  })
}

// 跳转到订单详情
const goToOrderDetail = (orderId, actionCode = 'ORDER_DETAIL_OPEN') => {
  if (!orderId || navigatingOrderId.value === orderId) {
    return
  }
  navigatingOrderId.value = orderId
  logButtonClick({ ...PAGE_LOG, actionCode, accessTitle: actionCode === 'ORDER_PAY_OPEN' ? '去支付' : '查看订单详情', accessDescription: actionCode === 'ORDER_PAY_OPEN' ? '从订单列表进入待支付订单，准备继续付款' : '从订单列表查看指定订单的详细状态', extraData: { orderId } })
  console.debug('event=ui_order_order_list stage=go_to_order_detail result=observed')
  uni.navigateTo({
    url: `/pages/order/order-detail?orderId=${encodeURIComponent(orderId)}`,
    complete: () => {
      setTimeout(() => {
        if (navigatingOrderId.value === orderId) {
          navigatingOrderId.value = null
        }
      }, 800)
    }
  })
}

// 申请退货
const applyRefund = async (orderId) => {
  const session = getSessionGeneration()
  try {
    logButtonClick({ ...PAGE_LOG, actionCode: 'ORDER_REFUND_OPEN', accessTitle: '申请退款售后', accessDescription: '检查指定订单是否允许申请退款售后', extraData: { orderId } })

    // 检查是否可以申请退货
    const checkResult = await checkCanApplyRefund(orderId)
    if (disposed || !isCurrentSession(session)) return
    if (!checkResult) {
      logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'ORDER_REFUND_OPEN_RESULT', actionResult: 'FAILED', accessTitle: '申请退款售后', accessDescription: '订单不符合申请条件，未进入退款申请', extraData: { orderId, reason: 'REFUND_NOT_ALLOWED' } })
      uni.showToast({
        title: '该订单不符合退货条件',
        icon: 'none'
      })
      return
    }

    // 跳转到退货申请页面
    uni.navigateTo({
      url: `/pages/order/refund_apply?orderId=${orderId}`
    })

  } catch (error) {
    if (disposed || !isCurrentSession(session)) return
    logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'ORDER_REFUND_OPEN_RESULT', actionResult: getActionFailureResult(error), accessTitle: '申请退款售后', accessDescription: '未能确认订单的退款申请条件', extraData: { orderId, reason: 'ELIGIBILITY_NOT_CONFIRMED' } })
    console.error('event=ui_order_order_list stage=apply_refund result=failed reason=operation_incomplete')
    uni.showToast({
      title: error.message || '操作失败',
      icon: 'none'
    })
  }
}

// 查看退货申请
const viewRefundApplication = (refundApplicationId) => {
  logButtonClick({ ...PAGE_LOG, actionCode: 'ORDER_REFUND_DETAIL_OPEN', accessTitle: '查看退款详情', accessDescription: '从订单列表查看关联的退款申请进度', extraData: { refundApplicationId } })
  uni.navigateTo({
    url: `/pages/order/refund_detail?refundApplicationId=${refundApplicationId}`
  })
}

// 简单日期格式化 YYYY-MM-DD HH:mm
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const Y = d.getFullYear()
    const M = String(d.getMonth() + 1).padStart(2, '0')
    const D = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${Y}-${M}-${D} ${h}:${m}`
  } catch (e) {
    return dateStr
  }
}

onLoad((options = {}) => {
  // onShow 会早于 mounted 发起首屏请求，筛选条件必须先在 onLoad 中确定。
  const status = options.status
  if (tabs.value.some(tab => tab.key === status)) {
    activeTab.value = status
  }
  unsubscribeSessionChanged = onSessionChanged(() => {
    requestSequence += 1
    orders.value = []
    pageNum.value = 0
    total.value = 0
    hasMore.value = false
    hasLoaded.value = false
    loading.value = false
    refreshing.value = false
    loadError.value = '登录状态已变更'
  })
})

onShow(() => {
  if (!disposed) logPageView({ ...PAGE_LOG, actionCode: 'ORDER_LIST_VIEW', accessTitle: '我的订单', accessDescription: '进入我的订单列表，查看当前状态筛选下的订单', extraData: { statusFilter: activeTab.value } })
  loadOrders()
})

onUnmounted(() => {
  disposed = true
  requestSequence += 1
  unsubscribeSessionChanged?.()
})
</script>

<style scoped lang="scss">
$order-bg: #f6f7fb;
$card-bg: #ffffff;
$text: #0f172a;
$muted: #64748b;
$border: #e7eef8;
$primary: #2563eb;

$danger: #ef4444;
$warning: #f59e0b;
$success: #10b981;
$info: #3b82f6;

.order-list-page {
  height: 100vh;
  overflow: hidden;
  background: $order-bg;
  display: flex;
  flex-direction: column;
  color: $text;
}

/* 顶部 Tabs：更“粘性 + 质感” */
.tabs {
  position: sticky;
  top: 0;
  z-index: 20;
  flex-shrink: 0;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1rpx solid rgba(231, 238, 248, 0.9);
  box-shadow: 0 8rpx 18rpx rgba(15, 23, 42, 0.04);
}

.tabs-content {
  display: inline-flex;
  min-width: 100%;
  vertical-align: top;
}

.tab-item {
  flex: 1 0 auto;
  text-align: center;
  padding: 26rpx 24rpx 22rpx;
  font-size: 28rpx;
  color: rgba(100, 116, 139, 0.95);
  position: relative;
  letter-spacing: 0.2rpx;

  /* 让点击区域更“稳” */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}

.tab-item.active {
  color: $primary;
  font-weight: 700;
}

.tab-item::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 0;
  height: 4rpx;
  border-radius: 999rpx;
  background: $primary;
  transform: translateX(-50%);
  transition: width 180ms ease;
}

.tab-item.active::after {
  width: 64rpx;
}

/* 列表容器：底部留安全区 */
.order-list {
  flex: 1;
  height: 0;
  min-height: 0;
  padding: 20rpx 20rpx calc(140rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.list-status {
  padding: 24rpx 0;
  text-align: center;
  color: $muted;
  font-size: 26rpx;
}

.list-retry {
  font-size: 26rpx;
  color: $primary;
  background: transparent;
}

.list-retry::after {
  border: none;
}

/* 空态：更干净 */
.empty {
  text-align: center;
  padding: 220rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: rgba(100, 116, 139, 0.9);
}

/* 卡片：更高级的层级与边框 */
.order-item {
  background: $card-bg;
  border-radius: 18rpx;
  margin-bottom: 18rpx;
  padding: 20rpx 20rpx 18rpx;
  border: 1rpx solid rgba(231, 238, 248, 0.9);
  box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.06);
  overflow: hidden;
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.order-item--hover {
  transform: translateY(-2rpx);
  box-shadow: 0 14rpx 34rpx rgba(15, 23, 42, 0.08);
}

/* Header：订单号弱化为信息，状态强调 */
.order-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 12rpx;
}

.order-number {
  display: flex;
  align-items: flex-start;
  flex: 1;
  min-width: 0;
  margin-right: 16rpx;
}

.order-no {
  min-width: 0;
  font-size: 26rpx;
  color: rgba(15, 23, 42, 0.92);
  font-weight: 700;
  line-height: 1.5;
  word-break: break-all;
}

.copy-order-no {
  flex-shrink: 0;
  margin-left: 12rpx;
  padding: 2rpx 0;
  font-size: 22rpx;
  line-height: 1.5;
  color: $primary;
}

/* 状态徽标：class 驱动，颜色/背景一致 */
.order-status {
  flex-shrink: 0;
  font-size: 22rpx;
  font-weight: 700;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  border: 1rpx solid transparent;
  line-height: 1.2;
  white-space: nowrap;
}

/* 0待支付 1待发货 2待收货 3已完成 4已取消 */
.order-status.s-0 { color: $warning; background: rgba(245, 158, 11, 0.10); border-color: rgba(245, 158, 11, 0.18); }
.order-status.s-1 { color: $info;    background: rgba(59, 130, 246, 0.10); border-color: rgba(59, 130, 246, 0.18); }
.order-status.s-2 { color: $info;    background: rgba(59, 130, 246, 0.10); border-color: rgba(59, 130, 246, 0.18); }
.order-status.s-3 { color: $success; background: rgba(16, 185, 129, 0.10); border-color: rgba(16, 185, 129, 0.18); }
.order-status.s-4 { color: #94a3b8;  background: rgba(148, 163, 184, 0.14); border-color: rgba(148, 163, 184, 0.22); }

/* 退货状态 */
.order-status.s-5 { color: #ff6b35; background: rgba(255, 107, 53, 0.10); border-color: rgba(255, 107, 53, 0.18); }
.order-status.s-6 { color: #007aff; background: rgba(0, 122, 255, 0.10); border-color: rgba(0, 122, 255, 0.18); }
.order-status.s-7 { color: #ff9500; background: rgba(255, 149, 0, 0.10); border-color: rgba(255, 149, 0, 0.18); }

/* 日期信息：做成“信息条”更像产品 */
.order-date {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 10rpx 12rpx;
  border-radius: 12rpx;
  background: #f8fafc;
  border: 1rpx solid rgba(231, 238, 248, 0.9);
  margin-bottom: 12rpx;
}

.date-label {
  font-size: 24rpx;
  color: rgba(100, 116, 139, 0.95);
}

.date-value {
  font-size: 24rpx;
  color: rgba(15, 23, 42, 0.9);
  font-weight: 600;
}

/* 商品列表：紧凑、分隔更细 */
.order-products {
  margin-bottom: 14rpx;
  padding: 4rpx 0;
}

.product-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx dashed rgba(231, 238, 248, 0.9);
}

.product-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.product-name {
  font-size: 26rpx;
  color: rgba(15, 23, 42, 0.88);
  line-height: 1.45;
  font-weight: 600;
}

.product-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 16rpx;
}

.product-image {
  width: 160rpx;
  height: 160rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}

.product-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.order-product-meta {
  font-size: 24rpx;
  color: rgba(100, 116, 139, 0.9);
  line-height: 1.35;
}

.product-side {
  min-width: 140rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
}

.product-refund-summary {
  font-size: 22rpx;
  color: #b45309;
  line-height: 1.4;
}

.refund-contact-tip {
  margin-bottom: 14rpx;
  font-size: 24rpx;
  color: #64748b;
  line-height: 1.5;
}

.product-quantity {
  font-size: 24rpx;
  color: rgba(100, 116, 139, 0.92);
}

.product-subtotal {
  font-size: 26rpx;
  color: rgba(15, 23, 42, 0.92);
  font-weight: 700;
}

.order-more {
  margin-top: 8rpx;
  padding: 12rpx 0 2rpx;
  font-size: 24rpx;
  color: $primary;
  text-align: right;
  font-weight: 700;
}

.order-products-empty {
  margin: 12rpx 0 16rpx;
  padding: 18rpx;
  border-radius: 12rpx;
  background: #f8fafc;
  color: $muted;
  font-size: 24rpx;
}

.order-redeem-summary {
  margin: 10rpx 0 8rpx;
  padding: 10rpx 14rpx;
  border-radius: 10rpx;
  background: #eff6ff;
  color: $primary;
  font-size: 24rpx;
  font-weight: 700;
}

/* Footer：金额更突出，按钮更规范 */
.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 14rpx;
  margin-top: 12rpx;
  border-top: 1rpx solid rgba(231, 238, 248, 0.9);
}

.order-amount {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.amount-label {
  font-size: 24rpx;
  color: rgba(100, 116, 139, 0.95);
}

.amount-value {
  font-size: 34rpx;
  color: $danger;
  font-weight: 800;
  letter-spacing: 0.2rpx;
}

.order-actions {
  display: flex;
  gap: 12rpx;
  align-items: center;
}

/* 按钮：统一高度、圆角、字重、阴影；取消用描边更“克制” */
.action-btn {
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 22rpx;
  font-size: 26rpx;
  border-radius: 999rpx;
  font-weight: 700;
  border: 1rpx solid transparent;
  box-sizing: border-box;
  transition: transform 100ms ease, opacity 100ms ease;
}

.action-btn::after {
  border: none;
}

.action-btn:active {
  transform: scale(0.98);
  opacity: 0.92;
}

.cancel-btn {
  background: #ffffff;
  color: rgba(100, 116, 139, 0.95);
  border-color: rgba(203, 213, 225, 0.9);
}

.pay-btn {
  background: $danger;
  color: #fff;
  box-shadow: 0 10rpx 18rpx rgba(239, 68, 68, 0.20);
}

.confirm-btn {
  background: $primary;
  color: #fff;
  box-shadow: 0 10rpx 18rpx rgba(37, 99, 235, 0.20);
}

.refund-btn {
  background: #ff6b35;
  color: #fff;
  box-shadow: 0 10rpx 18rpx rgba(255, 107, 53, 0.20);
}

.view-refund-btn {
  background: $primary;
  color: #fff;
  box-shadow: 0 10rpx 18rpx rgba(37, 99, 235, 0.20);
}

</style>
