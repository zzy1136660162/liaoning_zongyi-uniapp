<template>
  <view class="order-list-page">
    <!-- 标签页 -->
    <view class="tabs-sticky">
      <view class="order-search">
        <view class="search-field">
          <uni-icons type="search" size="18" color="#716a60" />
          <input v-model="searchInput" class="order-search-input" placeholder="搜索商品名称或订单号" confirm-type="search" :maxlength="100" @confirm="submitSearch" />
          <button v-if="searchInput || keyword" class="order-search-clear" aria-label="清空搜索" @click="clearSearch">×</button>
        </view>
        <button class="order-search-submit" @click="submitSearch">搜索</button>
      </view>
      <scroll-view
        class="tabs"
        scroll-x
        :scroll-into-view="'order-tab-' + activeTab"
        :show-scrollbar="false"
      >
        <view class="tabs-content">
          <button
            v-for="tab in tabs"
            :id="'order-tab-' + tab.key"
            :key="tab.key"
            class="tab-item"
            :class="{ active: activeTab === tab.key }"
            :aria-label="tab.label + (activeTab === tab.key ? '，当前选中' : '')"
            @click="switchTab(tab.key)"
          >
            {{ tab.label }}
            <view
              v-if="tab.key === 'pending' && pendingCount > 0"
              class="tab-dot"
            />
          </button>
        </view>
      </scroll-view>
    </view>

    <!-- 订单列表 -->
    <view class="order-list">
      <view
        v-if="hasLoaded && !loading && !loadError && orders.length === 0"
        class="empty"
      >
        <view class="empty-icon">
          <image src="/static/profile/parcel.svg" mode="aspectFit" />
        </view>
        <text class="empty-text">
          {{ keyword ? '当前分类未找到相关订单' : '暂无订单' }}
        </text>
        <button v-if="keyword" class="list-retry" @click="clearSearch">清除搜索条件</button>
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
          <button class="order-shop" @click.stop="goToMedicineList">
            <image
              class="order-shop-logo"
              src="https://smf.lntcm.com/static/shop/icon.png"
              mode="aspectFit"
            />
            <text class="order-shop-name">
              {{ HOSPITAL_NAME }}
            </text>
            <view class="order-shop-arrow" />
          </button>
          <text
            class="order-status"
            :class="'s-' + order.status"
          >
            {{ activeTab === 'unused' ? '待使用' : getStatusText(order.status, order) }}
          </text>
        </view>

        <view v-if="getDisplayOrderNo(order)" class="order-number-detail">
          <text class="order-no">订单号 {{ getDisplayOrderNo(order) }}</text>
          <button class="copy-order-no" aria-label="复制订单号" @click.stop="copyOrderNo(getDisplayOrderNo(order))">复制</button>
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
                  v-if="isNoReasonReturnDisabled(item)"
                  class="product-no-reason-tip"
                >
                  {{ getOrderItemReturnPolicyText(item) }}
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
                下单时间
              </text>
              <text class="date-value">
                {{ formatDate(order.createTime) }}
              </text>
            </view>
            <view class="order-amount">
              <text class="amount-label">
                {{ order.amountSummary.payable ? '应付款' : (activeTab === 'unused' ? '整单实付款' : '实付款') }}
              </text>
              <text class="amount-value">
                <text class="amount-currency">
                  {{ order.amountSummary.text === '待确认' ? '' : '¥' }}
                </text>{{ order.amountSummary.text }}
              </text>
            </view>
          </view>
          <text v-if="getRefundedAmountText(order)" class="order-refunded">{{ getRefundedAmountText(order) }}</text>
          <view class="order-extra-row">
            <view class="order-extra-actions">
              <button
                class="extra-btn"
                @click.stop="consultDoctor(order)"
              >
                在线咨询
              </button>
              <button v-if="activeTab === 'unused'" class="extra-btn" @click.stop="goToOrderDetail(order.id)">查看使用码</button>
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

    <DoctorConsultation v-if="showDoctorConsultation" :product-id="consultationProductId" @close="showDoctorConsultation = false" />
    <TabBar
      current="order"
    />
  </view>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { onLoad, onShow, onHide, onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { getOrderPage, getOrderDetail, cancelOrder, confirmReceipt, getOrderStats } from '@/api/order.js'
import { checkCanApplyRefund } from '@/api/refund.js'
import { getOrderItemRefundText, getOrderItemReturnPolicyText, canOrderApplyRefund, shouldReviewPhysicalRefund, getRefundErrorModal } from '@/utils/refund.js'
import { logPageView, logButtonClick, logAccess, getActionFailureResult } from '@/utils/accessLog.js'
import { isTherapyOrder, hasTherapyEntitlement } from '@/utils/therapy.js'
import { canPayOrder, getOrderStatusText, getRedeemStatusText } from '@/utils/order-status.js'
import { getSessionGeneration, getSessionToken, isCurrentSession, onSessionChanged } from '@/utils/session.js'
import { redirectToWithFallback } from '@/utils/navigate.js'
import { useProductImages } from '@/utils/product-image.js'
import { HOSPITAL_NAME } from '@/utils/config.js'
import TabBar from '@/components/TabBar/TabBar.vue'
import DoctorConsultation from '@/components/DoctorConsultation.vue'
import { getDisplayOrderNo, getPaidAmountText, getRefundedAmountText } from '@/utils/order-display.js'
import { isTherapyRefundItem } from '@/utils/refund.js'

const PAGE_LOG = { moduleCode: 'ORDER', accessType: '订单', pageType: 'ORDER_LIST', pageId: '', requestUri: '/pages/order/order_list' }

const { getProductImageUrl, handleProductImageError } = useProductImages()
const activeTab = ref('all')
const searchInput = ref('')
const keyword = ref('')
const showDoctorConsultation = ref(false)
const consultationProductId = ref(null)
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
// 首次展示才拉取列表；离开再返回时复用已有数据与滚动位置
let hasShownOnce = false
// 账号切换后列表已被清空，下次展示需要重新拉取
let needsReload = true
let savedPageScrollTop = 0

const tabs = ref([
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待付款' },
  { key: 'received', label: '待收货' },
  { key: 'unused', label: '待使用' },
  { key: 'shipping', label: '待发货' },
  { key: 'afterSale', label: '退款' },
  { key: 'closed', label: '已关闭' }
])

const normalizeRedeemVouchers = (item = {}) => {
  const vouchers = item.redeemVouchers || []
  if (!Array.isArray(vouchers)) return []
  return vouchers.map((voucher, index) => ({
    id: voucher.id,
    sequenceNo: voucher.sequenceNo || index + 1,
    redeemStatus: voucher.redeemStatus ?? null,
    redeemTime: voucher.redeemTime,
    refundApplicationId: voucher.refundApplicationId,
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

// 按已确认口径保留：传统疗法(3)不展示实物退货提示。
const isMedicineItem = (item = {}) => Number(item.productCategorySnapshot) !== 3

// 以商品快照的 supportReturn 为准：0 不支持退货，1 允许退货；旧数据缺字段时回退按分类判断。
const isNoReasonReturnDisabled = (item = {}) => {
  const supportReturn = item.supportReturn
  if (supportReturn === 0 || supportReturn === 1 || supportReturn === '0' || supportReturn === '1') {
    return Number(supportReturn) === 0
  }
  return isMedicineItem(item)
}

const isAvailableRedeemVoucher = voucher => voucher.redeemStatus != null && Number(voucher.redeemStatus) === 0 &&
  !voucher.redeemTime && !voucher.refundApplicationId

const visibleOrderItems = (order = {}) => {
  const items = order.items || []
  const selected = activeTab.value === 'unused' ? items.filter(item => isTherapyRefundItem(item, order) &&
    (item.redeemVouchers || []).some(isAvailableRedeemVoucher)) : items
  return selected.slice(0, ORDER_LIST_PREVIEW_LIMIT)
}

const remainingOrderItemCount = (order = {}) => {
  return Math.max((order.items || []).length - visibleOrderItems(order).length, 0)
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
    const availableCount = vouchers.filter(isAvailableRedeemVoucher).length
    const frozenCount = vouchers.filter(voucher => Number(voucher.redeemStatus) === 3).length
    const refundedCount = vouchers.filter(voucher => Number(voucher.redeemStatus) === 2).length
    return `到店核销：可用 ${availableCount}，已核销 ${redeemedCount}，退款中 ${frozenCount}，已退费 ${refundedCount}`
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
  supportReturnSnapshot: item.supportReturnSnapshot == null ? null : Number(item.supportReturnSnapshot),
  refundOpened: Number(item.refundOpened || 0),
  refundBlockedReason: item.refundBlockedReason || '',
  price: item.price || '0.00',
  subtotalAmount: item.subtotalAmount,
  refundCompletedQuantity: Number(item.refundCompletedQuantity || 0),
  productCategorySnapshot: item.productCategorySnapshot,
  redeemRequiredSnapshot: item.redeemRequiredSnapshot,
  redeemVouchers: normalizeRedeemVouchers(item)
})

const orderAmountSummary = (order) => {
  // 仅明确可续付且没有已收款记录时强调应付金额；异常收款与支付确认中沿用实付款口径。
  const amount = order.payableAmount
  if (canPayOrder(order) && !(Number(order.paidAmount) > 0) &&
      amount != null && /^\d+(\.\d{1,2})?$/.test(String(amount)) && Number.isFinite(Number(amount))) {
    return { payable: true, text: Number(amount).toFixed(2) }
  }
  return { payable: false, text: getPaidAmountText(order) }
}

const mapOrderListItem = (order = {}) => ({
  id: order.id,
  amountSummary: orderAmountSummary(order),
  orderNo: order.orderNo,
  hisOrderNo: order.hisOrderNo,
  paidAmount: order.paidAmount,
  refundedAmount: order.refundedAmount,
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
  const search = keyword.value
  const isCurrentRequest = () => !disposed && sequence === requestSequence &&
    isCurrentSession(session) && activeTab.value === tab && keyword.value === search
  loading.value = true
  loadError.value = ''
  try {
    const page = await getOrderPage({ tab, pageNum: nextPage, pageSize: ORDER_PAGE_SIZE, ...(search ? { keyword: search } : {}) })
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

const submitSearch = () => {
  keyword.value = searchInput.value.trim()
  searchInput.value = keyword.value
  stopRefreshing()
  uni.pageScrollTo({ scrollTop: 0, duration: 0 })
  return loadOrders()
}
const clearSearch = () => {
  searchInput.value = ''
  return submitSearch()
}
const consultDoctor = (order = {}) => {
  // 使用完整订单的首项，避免待使用筛选或预览截断改变咨询医生。
  consultationProductId.value = order.items?.[0]?.productId ?? null
  logButtonClick({ ...PAGE_LOG, actionCode: 'ORDER_CONSULT_DOCTOR', accessTitle: '在线咨询', accessDescription: '优先展示首个商品关联医生，不可咨询时随机展示', extraData: { orderId: order.id } })
  showDoctorConsultation.value = true
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
  const status = options.status === 'cancelled' ? 'closed' : options.status
  if (tabs.value.some(tab => tab.key === status)) {
    activeTab.value = status
  }
  unsubscribeSessionChanged = onSessionChanged(() => {
    showDoctorConsultation.value = false
    consultationProductId.value = null
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
    needsReload = true
  })
})

onShow(() => {
  if (!disposed) logPageView({ ...PAGE_LOG, actionCode: 'ORDER_LIST_VIEW', accessTitle: '我的订单', accessDescription: '进入我的订单列表，查看当前状态筛选下的订单', extraData: { statusFilter: activeTab.value } })
  if (!hasShownOnce || needsReload) {
    hasShownOnce = true
    needsReload = false
    loadOrders()
    return
  }
  // 从其他页面返回：不重新加载列表，只刷新待支付角标并回到离开时的滚动位置
  loadPendingCount()
  if (savedPageScrollTop > 0) uni.pageScrollTo({ scrollTop: savedPageScrollTop, duration: 0 })
})

onPageScroll((event) => {
  savedPageScrollTop = (event && event.scrollTop) || 0
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
$ink: #263832;
$muted: #676d66;
$gold: #806038;
$line: #eae8e0;
$paper: #f6f5f1;

.order-list-page { min-height: 100vh; background: $paper; color: $ink; }
button { margin: 0; padding: 0; border-radius: 0; background: transparent; color: inherit; line-height: 1.5; }
button::after { border: none; }
button:active { opacity: .75; }

/* 用不透明的吸顶区域承载搜索和横向筛选，滚动列表时保留当前筛选。 */
.tabs-sticky { position: sticky; top: 0; z-index: 20; background: #fff; border-bottom: 1rpx solid $line; }
.order-search {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx 26rpx 10rpx;
  background: linear-gradient(180deg, #faf7f0, white);
}
.search-field {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 14rpx;
  height: 72rpx;
  box-sizing: border-box;
  padding: 0 20rpx;
  border: 1rpx solid #dfded4;
  border-radius: 16rpx;
  background: white;
}
.order-search-input { flex: 1; min-width: 0; height: 100%; font-size: 27rpx; color: $ink; }
.order-search-clear { flex: none; min-width: 56rpx; font-size: 38rpx; line-height: 68rpx; color: $muted; }
.order-search-submit { flex: none; padding: 0 27rpx; line-height: 72rpx; border-radius: 16rpx; font-size: 27rpx; background: $ink; color: white; }
.tabs { white-space: nowrap; }
.tabs-content { display: inline-flex; min-width: 100%; box-sizing: border-box; padding: 0 18rpx; vertical-align: top; }
.tab-item { position: relative; flex: 1 0 auto; padding: 24rpx 20rpx; color: $muted; font-size: 27rpx; }
.tab-item.active { color: $ink; font-weight: 600; }
.tab-item.active::before {
  content: ''; position: absolute; bottom: 0; left: 50%;
  width: 32rpx; height: 5rpx; border-radius: 5rpx; background: #a17c49; transform: translateX(-50%);
}
.tab-dot { position: absolute; top: 20rpx; right: 10rpx; width: 10rpx; height: 10rpx; border-radius: 50%; background: #ac5241; }

.order-list { padding: 22rpx 24rpx calc(142rpx + env(safe-area-inset-bottom)); box-sizing: border-box; }
.order-item {
  overflow: hidden;
  margin-bottom: 22rpx;
  padding: 0 26rpx 22rpx;
  border: 1rpx solid $line;
  border-radius: 22rpx;
  background: white;
  box-shadow: 0 3rpx 12rpx rgba(51, 55, 42, .025);
}
.order-item--hover { background: #fcfbf8; }
.order-header { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; min-height: 86rpx; }
.order-shop { display: flex; align-items: center; flex: 0 1 auto; min-width: 0; gap: 10rpx; padding: 12rpx 0; text-align: left; }
.order-shop-logo { flex: none; width: 37rpx; height: 37rpx; border-radius: 8rpx; }
.order-shop-name { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 28rpx; color: $ink; font-weight: 600; }
.order-shop-arrow { flex: none; width: 8rpx; height: 8rpx; margin-right: 4rpx; border-top: 2rpx solid #95998e; border-right: 2rpx solid #95998e; transform: rotate(45deg); }
.order-status {
  flex: none;
  max-width: 40%;
  padding: 5rpx 13rpx;
  border-radius: 8rpx;
  background: #f1f2ef;
  color: $muted;
  font-size: 24rpx;
  line-height: 1.5;
  text-align: center;
  font-weight: 600;
  word-break: break-all;
}
.order-status.s-0, .order-status.s-5, .order-status.s-6 { color: #865523; background: #faf0de; }
.order-status.s-1, .order-status.s-2 { color: #31574a; background: #e9f1ea; }
.order-status.s-3 { color: #46614d; background: #f0f4ec; }
.order-number-detail { display: flex; align-items: center; gap: 16rpx; padding-bottom: 11rpx; font-size: 23rpx; color: $muted; }
.order-no { min-width: 0; word-break: break-all; font-variant-numeric: tabular-nums; }
.copy-order-no { flex: none; min-width: 64rpx; padding: 9rpx 2rpx; color: $gold; font-size: 23rpx; }
.order-products { padding: 21rpx 0 19rpx; border-top: 1rpx solid $line; }
.product-item, .product-main { display: flex; min-width: 0; align-items: flex-start; gap: 18rpx; }
.product-item + .product-item { margin-top: 24rpx; }
.product-main { flex: 1; }
.product-image { flex: none; width: 122rpx; height: 122rpx; border-radius: 13rpx; background: $paper; }
.product-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5rpx; }
.product-name { color: $ink; font-size: 30rpx; font-weight: 600; line-height: 1.45; word-break: break-all; }
.order-product-meta, .product-quantity { color: $muted; font-size: 24rpx; line-height: 1.5; }
.order-product-meta { word-break: break-all; }
.product-side { display: flex; flex: none; flex-direction: column; align-items: flex-end; gap: 6rpx; max-width: 27%; text-align: right; word-break: break-all; }
.product-subtotal { font-size: 27rpx; font-weight: 500; line-height: 1.5; font-variant-numeric: tabular-nums; }
.product-no-reason-tip, .product-refund-summary { font-size: 22rpx; line-height: 1.55; color: $gold; }
.order-more { margin-top: 12rpx; padding: 10rpx 0; text-align: right; font-size: 25rpx; color: $gold; }

.order-products-empty, .order-redeem-summary, .refund-contact-tip, .order-logistics {
  margin-bottom: 16rpx; padding: 15rpx 18rpx; border-radius: 12rpx; background: #f6f6f1;
  color: $muted; font-size: 24rpx; line-height: 1.6;
}
.order-redeem-summary { background: #eef3eb; color: #385744; }
.refund-contact-tip { background: #faf4e9; color: #795e3c; }
.order-logistics { display: flex; gap: 14rpx; align-items: center; }
.order-logistics-info { display: flex; align-items: center; flex: 1; min-width: 0; flex-wrap: wrap; gap: 4rpx 12rpx; }
.order-logistics-logo { width: 32rpx; height: 32rpx; flex: none; }
.order-logistics-no { word-break: break-all; color: $ink; }
.copy-logistics-btn { flex: none; padding: 8rpx; color: $gold; font-size: 24rpx; }

.order-footer { padding-top: 16rpx; border-top: 1rpx solid $line; }
.order-summary { display: flex; align-items: baseline; justify-content: space-between; gap: 8rpx 16rpx; flex-wrap: wrap; }
.order-date { display: flex; flex-wrap: wrap; gap: 4rpx 9rpx; color: $muted; font-size: 22rpx; line-height: 1.5; }
.date-value { word-break: break-all; }
.order-amount { display: flex; align-items: baseline; flex-wrap: wrap; justify-content: flex-end; margin-left: auto; gap: 10rpx; max-width: 100%; }
.amount-label { font-size: 24rpx; color: $muted; }
.amount-value { color: $ink; font-size: 38rpx; font-weight: 650; font-variant-numeric: tabular-nums; line-height: 1.3; word-break: break-all; }
.amount-currency { font-size: 25rpx; padding-right: 3rpx; }
.order-refunded { display: block; margin-top: 8rpx; color: $gold; text-align: right; font-size: 24rpx; }
.order-extra-row { margin-top: 18rpx; }
.order-extra-actions { display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: 12rpx; }
.extra-btn { flex: none; box-sizing: border-box; padding: 0 19rpx; line-height: 64rpx; border: 1rpx solid #d9dcd3; border-radius: 12rpx; color: #414c45; font-size: 24rpx; }
.pay-btn, .confirm-btn { order: 1; border-color: $ink; background: $ink; color: #fff; font-weight: 600; }
.list-status { padding: 22rpx 0; text-align: center; font-size: 25rpx; color: $muted; }
.list-retry { display: inline-block; padding: 14rpx 28rpx; color: $gold; font-size: 26rpx; }
.empty { display: flex; align-items: center; flex-direction: column; gap: 16rpx; text-align: center; padding: 116rpx 24rpx; }
.empty-icon { display: flex; align-items: center; justify-content: center; width: 106rpx; height: 106rpx; border-radius: 50%; background: #eee7d9; }
.empty-icon image { width: 58rpx; height: 58rpx; }
.empty-text { color: $muted; font-size: 28rpx; }
</style>
