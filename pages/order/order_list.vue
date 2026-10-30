<template>
  <view class="order-list-page">
    <!-- 标签页 -->
    <view class="tabs-sticky">
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
            <view
              v-if="tab.key === 'pending' && pendingCount > 0"
              class="tab-dot"
            />
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 订单列表 -->
    <view class="order-list">
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
          <view class="order-shop">
            <image
              class="order-shop-logo"
              src="https://smf.lntcm.com/static/shop/icon.png"
              mode="aspectFit"
            />
            <text class="order-shop-name">
              辽宁中医院互联网医院
            </text>
            <view
              class="order-shop-arrow"
              @click.stop="goToMedicineList"
            >
              ›
            </view>
          </view>
          <text
            class="order-status"
            :class="'s-' + order.status"
          >
            {{ getStatusText(order.status, order) }}
          </text>
        </view>

        <view
          v-if="order.items && order.items.length > 0"
          class="order-products"
        >
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
                <text class="product-name">
                  {{ item.productName }}
                </text>
                <text
                  v-if="formatOrderItemMeta(item)"
                  class="order-product-meta"
                >
                  {{ formatOrderItemMeta(item) }}
                </text>
                <text
                  v-if="isMedicineItem(item)"
                  class="product-no-reason-tip"
                >
                  不支持7天无理由退货
                </text>
                <text
                  v-if="getOrderItemRefundText(item)"
                  class="product-refund-summary"
                >
                  {{ getOrderItemRefundText(item) }}
                </text>
              </view>
            </view>
            <view class="product-side">
              <text class="product-subtotal">
                ¥{{ orderItemSubtotal(item).toFixed(2) }}
              </text>
              <text class="product-quantity">
                ×{{ item.quantity }}
              </text>
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
        <view
          v-else
          class="order-products-empty"
        >
          暂无商品明细
        </view>

        <view
          v-if="redeemSummaryText(order)"
          class="order-redeem-summary"
        >
          {{ redeemSummaryText(order) }}
        </view>

        <view
          v-if="order.logisticsNo"
          class="order-logistics"
          @click.stop
        >
          <view class="order-logistics-info">
            <image
              class="order-logistics-logo"
              src="https://smf.lntcm.com/static/shop/sf.png"
              mode="aspectFit"
            />
            <text class="order-logistics-label">
              {{ order.logisticsCompany || '物流' }}单号
            </text>
            <text
              class="order-logistics-no"
              selectable
            >
              {{ order.logisticsNo }}
            </text>
          </view>
          <button
            class="copy-logistics-btn"
            @click.stop="copyLogisticsNo(order.logisticsNo)"
          >
            复制
          </button>
        </view>

        <view
          v-if="shouldReviewPhysicalRefund(order)"
          class="refund-contact-tip"
        >
          实物商品已发货，可提交退款申请，由后台核查物流后处理。
        </view>
        <view class="order-footer">
          <view class="order-summary">
            <view class="order-date">
              <text class="date-label">
                下单时间:
              </text>
              <text class="date-value">
                {{ formatDate(order.createTime) }}
              </text>
            </view>
            <view class="order-amount">
              <text class="amount-label">
                实付款:
              </text>
              <text class="amount-value">
                <text class="amount-currency">
                  ¥
                </text>{{ (Number(order.payableAmount || 0) + Number(order.shippingFee || 0)).toFixed(2) }}
              </text>
            </view>
          </view>
          <view class="order-extra-row">
            <view class="order-extra-actions">
              <button
                class="extra-btn"
                @click.stop="consultDoctor(order)"
              >
                咨询医生
              </button>
              <!-- 按逐项可退数量显示入口，部分核销或已有退款不影响剩余项目申请。 -->
              <button
                v-if="canOrderApplyRefund(order)"
                class="extra-btn"
                @click.stop="applyRefund(order.id)"
              >
                {{ refundActionText(order) }}
              </button>
              <!-- 申请记录与继续退款是两种操作，可以同时显示。 -->
              <button
                v-if="order.refundApplicationId"
                class="extra-btn"
                @click.stop="viewRefundApplication(order.refundApplicationId)"
              >
                退款记录
              </button>
              <button
                class="extra-btn"
                @click.stop="rebuyOrder(order)"
              >
                再次购买
              </button>
              <button
                v-if="order.status === 0"
                class="extra-btn cancel-btn"
                @click.stop="handleCancelOrder(order.id)"
              >
                取消订单
              </button>
              <button
                v-if="canPayOrder(order)"
                class="extra-btn pay-btn"
                @click.stop="handlePayOrder(order)"
              >
                去支付
              </button>
              <button
                v-if="order.status === 2"
                class="extra-btn confirm-btn"
                @click.stop="handleConfirmReceipt(order.id)"
              >
                确认收货
              </button>
            </view>
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
    </view>

    <TabBar
      current="order"
    />
  </view>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { onLoad, onShow, onHide, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getOrderPage, getOrderDetail, cancelOrder, confirmReceipt, getOrderStats } from '@/api/order.js'
import { checkCanApplyRefund } from '@/api/refund.js'
import { getOrderItemRefundText, canOrderApplyRefund, shouldReviewPhysicalRefund, getRefundErrorModal } from '@/utils/refund.js'
import { logPageView, logButtonClick, logAccess, getActionFailureResult } from '@/utils/accessLog.js'
import { isTherapyOrder, hasTherapyEntitlement } from '@/utils/therapy.js'
import { canPayOrder, getOrderStatusText, getRedeemStatusText } from '@/utils/order-status.js'
import { getSessionGeneration, getSessionToken, isCurrentSession, onSessionChanged } from '@/utils/session.js'
import { openCustomerServiceChat } from '@/utils/customer-service.js'
import { redirectToWithFallback } from '@/utils/navigate.js'
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
const pendingCount = ref(0)
const ORDER_LIST_PREVIEW_LIMIT = 2
const ORDER_PAGE_SIZE = 20
let unsubscribeSessionChanged = null
let requestSequence = 0
let disposed = false

const tabs = ref([
  { key: 'all', label: '全部' },
  { key: 'completed', label: '已完成' },
  { key: 'pending', label: '待支付' },
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

// 制剂（实物商品）不支持七天无理由退货，治疗类商品不展示该提示。
const isMedicineItem = (item = {}) => Number(item.productCategorySnapshot) !== 3

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
  // 购买资格尚未生效时不提示核销：仅已支付(1)、进入履约(1/2/3)或售后(5/6/7)的订单可展示。
  if (Number(order.payStatus) !== 1 || ![1, 2, 3, 5, 6, 7].includes(Number(order.status))) return ''
  // 历史订单可没有履约标记；付款确认中、异常退款中不能按默认核销状态展示可用权益。
  if (order.paymentFulfillmentStatus && order.paymentFulfillmentStatus !== 'READY') return ''
  const vouchers = flattenRedeemVouchers(order)
  if (vouchers.length > 0) {
    const redeemedCount = vouchers.filter(voucher => Number(voucher.redeemStatus) === 1).length
    const availableCount = vouchers.filter(voucher => Number(voucher.redeemStatus) === 0).length
    const frozenCount = vouchers.filter(voucher => Number(voucher.redeemStatus) === 3).length
    const refundedCount = vouchers.filter(voucher => Number(voucher.redeemStatus) === 2).length
    return `到店核销：可用 ${availableCount}，已核销 ${redeemedCount}，退款中 ${frozenCount}，已退废 ${refundedCount}`
  }
  return `到店核销：${getRedeemStatusText(order)}`
}

const resolveRawOrderItems = (order = {}) => {
  return order.items || []
}

const mapOrderItem = (item = {}) => ({
  id: item.id,
  productId: item.productId ?? null,
  skuId: item.skuId ?? null,
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
  logisticsCompany: String(order.logisticsCompany || '').trim(),
  logisticsNo: String(order.logisticsNo || '').trim(),
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
      logisticsCompany: order.logisticsCompany || String(detail.logisticsCompany || '').trim(),
      logisticsNo: order.logisticsNo || String(detail.logisticsNo || '').trim(),
      items: detailItems
    }
  })
}

const stopRefreshing = () => {
  if (!refreshing.value) return
  refreshing.value = false
  uni.stopPullDownRefresh()
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
      stopRefreshing()
    }
  }
}

// 待支付数量用于「待支付」标签的红点提醒，统计失败不影响列表展示。
const loadPendingCount = async () => {
  if (!getSessionToken()) {
    pendingCount.value = 0
    return
  }
  const session = getSessionGeneration()
  try {
    const stats = (await getOrderStats({ silent: true })) || {}
    if (disposed || !isCurrentSession(session)) return
    pendingCount.value = Number(stats.pending) || 0
  } catch (error) {
    if (disposed || !isCurrentSession(session)) return
    console.warn('event=ui_order_order_list stage=load_pending_count result=failed reason=operation_incomplete')
  }
}

// 取消、收货和下拉刷新都重新读取当前分类的第一页。
const loadOrders = () => {
  if (disposed) return
  loadPendingCount()
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
  if (disposed || refreshing.value) return
  refreshing.value = true
  return loadOrders()
}

const refundActionText = (order = {}) => {
  return order.refundApplicationId ? '继续退款' : '申请退款'
}

// 切换标签
const switchTab = (key) => {
  if (key === activeTab.value || !tabs.value.some(tab => tab.key === key)) return
  stopRefreshing()
  activeTab.value = key
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
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

const copyLogisticsNo = (value) => copyOrderNo(value)

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

// 进入互联网医院商城
const goToMedicineList = () => {
  logButtonClick({ ...PAGE_LOG, actionCode: 'ORDER_SHOP_OPEN', accessTitle: '进入医院商城', accessDescription: '用户从订单列表进入制剂商品列表', extraData: {} })
  redirectToWithFallback('/pages/products/medicine_list')
}

// 咨询医生：复用企业微信客服会话
const consultDoctor = (order = {}) => {
  const orderId = order.id
  const session = getSessionGeneration()
  const actionLog = { ...PAGE_LOG, actionCode: 'ORDER_CONSULT_DOCTOR', accessTitle: '咨询医生', accessDescription: '用户从订单列表发起医生咨询', extraData: { orderId } }
  logButtonClick(actionLog)
  Promise.resolve(openCustomerServiceChat()).then(result => {
    if (!disposed && isCurrentSession(session)) logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: result ? 'SUCCESS' : 'FAILED' })
  }).catch(error => {
    if (!disposed && isCurrentSession(session)) logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: getActionFailureResult(error), extraData: { orderId, reason: 'CUSTOMER_SERVICE_UNAVAILABLE' } })
  })
}

// 再买一次：回到订单首个商品的详情页重新选购
const rebuyOrder = (order = {}) => {
  const orderId = order.id
  const item = (order.items || []).find(orderItem => orderItem.productId)
  if (!item) {
    logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'ORDER_REBUY_RESULT', actionResult: 'FAILED', accessTitle: '再买一次', accessDescription: '订单缺少商品标识，无法重新购买', extraData: { orderId, reason: 'PRODUCT_ID_MISSING' } })
    uni.showToast({ title: '商品信息缺失，请到商城中重新选购', icon: 'none' })
    return
  }
  logButtonClick({ ...PAGE_LOG, actionCode: 'ORDER_REBUY', accessTitle: '再买一次', accessDescription: '用户从订单列表重新购买订单内商品', extraData: { orderId, productId: item.productId } })
  const page = isTherapyOrder(order) ? '/pages/products/therapy_detail' : '/pages/products/medicine_detail'
  const query = [`id=${encodeURIComponent(item.productId)}`]
  if (item.skuId) query.push(`skuId=${encodeURIComponent(item.skuId)}`)
  uni.navigateTo({ url: `${page}?${query.join('&')}` })
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
    const modal = getRefundErrorModal(error)
    if (modal) uni.showModal(modal)
    else uni.showToast({
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
    stopRefreshing()
    loadError.value = '登录状态已变更'
    pendingCount.value = 0
  })
})

onShow(() => {
  if (!disposed) logPageView({ ...PAGE_LOG, actionCode: 'ORDER_LIST_VIEW', accessTitle: '我的订单', accessDescription: '进入我的订单列表，查看当前状态筛选下的订单', extraData: { statusFilter: activeTab.value } })
  // 返回页面复用已有列表，避免重复请求并保留滚动位置
  if (!hasLoaded.value && !loading.value) {
    loadOrders()
  } else {
    loadPendingCount()
  }
})

onPullDownRefresh(refreshOrders)
onReachBottom(loadMoreOrders)
// 原生刷新动画属于当前页面，离开时结束，避免迟到响应影响其他页面。
onHide(stopRefreshing)

onUnmounted(() => {
  stopRefreshing()
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
  min-height: 100vh;
  background: $order-bg;
  color: $text;
}

/* 普通容器承担吸顶和完整遮挡，避免列表透过横向滚动组件的上沿。 */
.tabs-sticky {
  position: sticky;
  top: 0;
  z-index: 20;
  background: $card-bg;
}

.tabs {
  flex-shrink: 0;
  white-space: nowrap;
  border-bottom: 1rpx solid $border;
}

.tabs-content {
  display: inline-flex;
  min-width: 100%;
  padding: 18rpx 24rpx;
  gap: 16rpx;
  box-sizing: border-box;
  vertical-align: top;
}

.tab-item {
  position: relative;
  flex: 1 0 auto;
  text-align: center;
  padding: 14rpx 24rpx;
  font-size: 28rpx;
  line-height: 1.5;
  color: $muted;
  background: #f6f7fb;
  border-radius: 12rpx;
}

/* 有待支付订单时在标签右上角显示红点提醒 */
.tab-dot {
  position: absolute;
  top: 8rpx;
  right: 10rpx;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #ff3b30;
}

.tab-item.active {
  color: $primary;
  background: #eff6ff;
  font-weight: 700;
}

/* 列表容器：底部留安全区 */
.order-list {
  padding: 20rpx 24rpx calc(140rpx + env(safe-area-inset-bottom));
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

.empty {
  text-align: center;
  padding: 220rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: rgba(100, 116, 139, 0.9);
}

.order-item {
  background: $card-bg;
  border-radius: 20rpx;
  margin-bottom: 20rpx;
  padding: 24rpx;
  overflow: hidden;
}

.order-item--hover {
  background: #f8fafc;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 24rpx;
}

.order-shop {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  margin-right: 16rpx;
}

.order-shop-logo {
  width: 36rpx;
  height: 36rpx;
  margin-right: 12rpx;
  flex-shrink: 0;
  border-radius: 6rpx;
}

.order-shop-name {
  font-size: 30rpx;
  font-family: 'PingFang SC';
  font-weight: 500;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-shop-arrow {
  flex-shrink: 0;
  margin-left: 6rpx;
  padding: 0 6rpx;
  font-size: 32rpx;
  line-height: 1;
  color: #9ca3af;
}

.order-status {
  flex-shrink: 0;
  max-width: 42%;
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1.5;
  text-align: right;
  word-break: break-all;
}

/* 0待支付 1待发货 2待收货 3已完成 4已取消 */
.order-status.s-0 { color: $warning; }
.order-status.s-1 { color: $info; }
.order-status.s-2 { color: $info; }
.order-status.s-3 { color: $success; }
.order-status.s-4 { color: #94a3b8; }

/* 退货状态 */
.order-status.s-5 { color: #ff6b35; }
.order-status.s-6 { color: #007aff; }
.order-status.s-7 { color: #ff9500; }

.order-date {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4rpx 8rpx;
  min-width: 0;
  font-size: 22rpx;
  color: $muted;
  line-height: 1.5;
}

.date-value {
  word-break: break-all;
}

.order-products {
  margin-bottom: 20rpx;
}

.product-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  padding-bottom: 24rpx;
}

.product-item:last-child {
  padding-bottom: 0;
}

.product-name {
  font-size: 28rpx;
  color: $text;
  line-height: 1.5;
  font-weight: 600;
  word-break: break-all;
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
  border-radius: 12rpx;
  flex-shrink: 0;
  background: #f6f7fb;
}

.product-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.order-product-meta {
  font-size: 24rpx;
  color: $muted;
  line-height: 1.5;
  word-break: break-all;
}

.product-side {
  flex-shrink: 0;
  min-width: 96rpx;
  max-width: 190rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10rpx;
  text-align: right;
  word-break: break-all;
}

.product-no-reason-tip {
  font-size: 22rpx;
  color: #9e6e40;
  line-height: 1.5;
}

.product-refund-summary {
  font-size: 22rpx;
  color: #b45309;
  line-height: 1.5;
}

.refund-contact-tip {
  margin-bottom: 14rpx;
  padding: 14rpx 18rpx;
  border-radius: 12rpx;
  background: #f8fafc;
  font-size: 24rpx;
  color: #64748b;
  line-height: 1.5;
}

.product-quantity {
  font-size: 24rpx;
  color: $muted;
  line-height: 1.5;
}

.product-subtotal {
  font-size: 28rpx;
  color: $text;
  font-weight: 600;
  line-height: 1.5;
}

.order-more {
  margin-top: 8rpx;
  padding: 16rpx 0 0;
  font-size: 24rpx;
  color: $primary;
  text-align: right;
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
  margin-bottom: 16rpx;
  padding: 14rpx 18rpx;
  border-radius: 12rpx;
  background: #eff6ff;
  color: $primary;
  font-size: 24rpx;
  line-height: 1.6;
}

.order-footer {
  padding-top: 8rpx;
}

.order-summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 12rpx 16rpx;
}

.order-amount {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: baseline;
  margin-left: auto;
  gap: 8rpx;
  max-width: 100%;
}

.amount-label {
  font-size: 24rpx;
  color: $text;
  white-space: nowrap;
}

.amount-value {
  font-size: 36rpx;
  color: $danger;
  font-weight: 700;
  line-height: 1.3;
  word-break: break-all;
}

.amount-currency {
  margin-right: 2rpx;
  font-size: 24rpx;
}

.order-extra-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f1f2f4;
}

.order-extra-actions {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8rpx;
  overflow: hidden;
}

.extra-btn {
  flex-shrink: 0;
  margin: 0;
  padding: 0 12rpx;
  height: 58rpx;
  line-height: 56rpx;
  font-size: 24rpx;
  border-radius: 10rpx;
  background: #f6f7fb;
  color: #1f2937;
  border: 1rpx solid #eceef1;
  box-sizing: border-box;
  white-space: nowrap;
  transition: transform 100ms ease, opacity 100ms ease;
}

.extra-btn::after {
  border: none;
}

.extra-btn:active {
  transform: scale(0.98);
  opacity: 0.92;
}

.order-logistics {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 14rpx 18rpx;
  margin-bottom: 16rpx;
  background: #f8fafc;
  border-radius: 12rpx;
}

.order-logistics-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx 16rpx;
  font-size: 24rpx;
  line-height: 1.6;
}

.order-logistics-logo {
  flex-shrink: 0;
  align-self: center;
  width: 32rpx;
  height: 32rpx;
}

.order-logistics-label { color: #64748b; }
.order-logistics-no { color: #334155; word-break: break-all; }
.copy-logistics-btn {
  flex-shrink: 0;
  margin: 0;
  padding: 0 18rpx;
  line-height: 52rpx;
  font-size: 24rpx;
  color: $primary;
  background: #eff6ff;
  border-radius: 8rpx;
}
.copy-logistics-btn::after { border: none; }

.cancel-btn {
  background: #f6f7fb;
  color: $muted;
}

.pay-btn {
  order: 1;
  background: $danger;
  color: #fff;
  font-weight: 600;
}

.confirm-btn {
  order: 1;
  background: $primary;
  color: #fff;
  font-weight: 600;
}

</style>
