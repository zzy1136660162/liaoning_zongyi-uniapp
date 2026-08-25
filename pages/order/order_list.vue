<template>
  <view class="order-list-page">
    <!-- 标签页 -->
    <view class="tabs">
      <view 
        v-for="tab in tabs" 
        :key="tab.key"
        class="tab-item"
        :class="{ active: activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
      </view>
    </view>

    <!-- 订单列表 -->
    <scroll-view
      class="order-list"
      scroll-y
    >
      <view
        v-if="filteredOrders.length === 0"
        class="empty"
      >
        <text class="empty-text">
          暂无订单
        </text>
      </view>
      
      <view 
        v-for="order in filteredOrders"
        :key="order.id"
        class="order-item"
        hover-class="order-item--hover"
        hover-stay-time="80"
        @click="goToOrderDetail(order.id)"
      >
        <view class="order-header">
          <text class="order-no">
            订单号: {{ order.orderNo }}
          </text>
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
                :src="'https://shop.lntcm.com/assets_files' + item.productImage"
                mode="aspectFill"
              />
              <view class="product-text">
                <text class="product-name">{{ item.productName }}</text>
                <text v-if="formatOrderItemMeta(item)" class="order-product-meta">{{ formatOrderItemMeta(item) }}</text>
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

        <view v-if="hasRedeemVouchers(order)" class="order-redeem-summary">
          {{ redeemSummaryText(order) }}
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
            <!-- <button
              v-if="order.status === 0" 
              class="action-btn pay-btn" 
              @click.stop="goToOrderDetail(order.id)"
            >
              查看订单
            </button> -->
            <button
              v-if="order.status === 2"
              class="action-btn confirm-btn"
              @click.stop="handleConfirmReceipt(order.id)"
            >
              确认收货
            </button>
            <!-- 申请退货按钮：普通商品已完成可申请；传统疗法已支付即可申请 -->
            <!-- <button
              v-if="canOrderApplyRefund(order)"
              class="action-btn refund-btn"
              @click.stop="applyRefund(order.id)"
            >
              {{ refundActionText(order) }}
            </button> -->
            <!-- 查看申请按钮：在已完成且有退货申请时，或退货中状态时显示 -->
            <!-- <button
              v-if="(order.status === 3 && order.refundApplicationId) || (order.status === 5 && order.refundApplicationId)"
              class="action-btn view-refund-btn"
              @click.stop="viewRefundApplication(order.refundApplicationId)"
            >
              查看申请
            </button> -->
          </view>
        </view>
      </view>
    </scroll-view>

    <TabBar
      current="order"
      :cart-count="cartCount"
      @change="handleTabChange"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getMyOrders, getOrderDetail, cancelOrder, confirmReceipt } from '@/api/order.js'
import { checkCanApplyRefund, getRefundList } from '@/api/refund.js'
import { logPageView, logButtonClick } from '@/utils/accessLog.js'
import { isTherapyOrder } from '@/utils/therapy.js'
import { getOrderStatusText } from '@/utils/order-status.js'
import { getCartTotalQuantity } from '@/utils/cart.js'
import { subscribeCartUpdated } from '@/utils/cart-events.js'
import TabBar from '@/components/TabBar/TabBar.vue'

const activeTab = ref('all')
const orders = ref([])
const navigatingOrderId = ref(null)
const cartCount = ref(0)
const ORDER_LIST_PREVIEW_LIMIT = 2
const AFTER_SALE_ORDER_STATUSES = [5, 6, 7]
let unsubscribeCartUpdated = null

const tabs = ref([
  { key: 'all', label: '全部' },
  { key: 'completed', label: '已完成' },
  { key: 'pending', label: '待支付' },
  { key: 'shipping', label: '待发货' },
  { key: 'received', label: '待收货' },
  { key: 'afterSale', label: '退款' }
])

const normalizeRedeemVouchers = (item = {}) => {
  const vouchers = item.redeemVouchers || item.redeem_vouchers || []
  if (!Array.isArray(vouchers)) return []
  return vouchers.map((voucher, index) => ({
    id: voucher.id,
    sequenceNo: voucher.sequenceNo || voucher.sequence_no || index + 1,
    redeemStatus: voucher.redeemStatus ?? voucher.redeem_status ?? 0,
    redeemStatusText: voucher.redeemStatusText || voucher.redeem_status_text || '',
    verifyQrBase64: voucher.verifyQrBase64 || voucher.verify_qr_base64 || ''
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

const hasRedeemVouchers = (order = {}) => {
  return flattenRedeemVouchers(order).length > 0 ||
    (isTherapyOrder(order) && (order.redeemStatus !== null && order.redeemStatus !== undefined))
}

const redeemSummaryText = (order = {}) => {
  const vouchers = flattenRedeemVouchers(order)
  if (vouchers.length > 0) {
    const redeemedCount = vouchers.filter(voucher => Number(voucher.redeemStatus) === 1).length
    return `到店核销：${redeemedCount}/${vouchers.length} 已核销`
  }
  return Number(order.redeemStatus) === 1 ? '到店核销：已核销' : '到店核销：待核销'
}

const resolveRawOrderItems = (order = {}) => {
  return order.items || order.orderItems || order.order_items || []
}

const mapOrderItem = (item = {}) => ({
  id: item.id,
  productName: item.productName || item.product_name || item.name,
  productImage: item.productImage || item.product_image || item.image,
  specText: item.specText || item.spec_text || '',
  unit: item.unit || '',
  quantity: item.quantity || 1,
  price: item.price || '0.00',
  subtotalAmount: item.subtotalAmount ?? item.subtotal_amount,
  redeemVouchers: normalizeRedeemVouchers(item)
})

const mapOrderListItem = (order = {}, refundInfo = null) => ({
  id: order.id,
  orderNo: order.orderNo || order.order_no || order.id,
  orderType: order.orderType ?? order.order_type,
  payStatus: order.payStatus ?? order.pay_status,
  redeemStatus: order.redeemStatus ?? order.redeem_status,
  displayStatusText: order.displayStatusText || order.display_status_text || '',
  verifyQrBase64: order.verifyQrBase64 || order.verify_qr_base64 || '',
  // 优先使用 orderStatus，如果没有则使用 status，最后默认为 0
  status: order.orderStatus !== null && order.orderStatus !== undefined
    ? order.orderStatus
    : (order.status !== null && order.status !== undefined ? order.status : 0),
  // 实付款：优先 payableAmount，其次 paidAmount，再其次 totalAmount + shippingFee
  payableAmount: (function () {
    if (order.payableAmount !== null && order.payableAmount !== undefined) {
      return order.payableAmount
    }
    if (order.paidAmount !== null && order.paidAmount !== undefined) {
      return order.paidAmount
    }
    return (Number(order.totalAmount) || 0) + (Number(order.shippingFee) || 0)
  })(),
  shippingFee: Number(order.shippingFee) || 0,
  createTime: order.createTime || order.create_time || order.createdAt || order.created_at,
  refundApplicationId: refundInfo ? refundInfo.id : null,
  refundStatus: order.refundStatus ?? order.refund_status ?? refundInfo?.refundStatus ?? refundInfo?.status ?? null,
  items: resolveRawOrderItems(order).map(mapOrderItem)
})

const hydrateMissingOrderItems = async () => {
  const missingOrders = orders.value.filter(order =>
    order.id && (!order.items || order.items.length === 0)
  )
  if (missingOrders.length === 0) {
    return
  }

  const detailResults = await Promise.all(missingOrders.map(order =>
    getOrderDetail(order.id, { showLoading: false })
      .then(detail => ({ orderId: order.id, detail }))
      .catch(error => {
        console.warn('补全订单商品明细失败:', order.id, error)
        return null
      })
  ))
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
      orderType: order.orderType ?? detail.orderType ?? detail.order_type,
      payStatus: order.payStatus ?? detail.payStatus ?? detail.pay_status,
      redeemStatus: order.redeemStatus ?? detail.redeemStatus ?? detail.redeem_status,
      displayStatusText: order.displayStatusText || detail.displayStatusText || detail.display_status_text || '',
      verifyQrBase64: order.verifyQrBase64 || detail.verifyQrBase64 || detail.verify_qr_base64 || '',
      items: detailItems
    }
  })
}

// ✅ 从API加载订单列表
const loadOrders = async () => {
  try {
    uni.showLoading({ title: '加载中...' })
    
    // 并行加载订单列表和退货申请列表
    const [orderList, refundList] = await Promise.all([
      getMyOrders(),
      getRefundList().catch(() => []) // 如果加载失败，返回空数组
    ])
    
    console.log('订单列表:', orderList)
    console.log('退货申请列表:', refundList)
    
    // 创建订单ID到退货申请ID的映射（包含所有退货申请）
    const refundMap = new Map()
    if (refundList && refundList.length > 0) {
      refundList.forEach(refund => {
        const orderId = refund.orderId
        // 如果已存在，保留最新的（按创建时间）
        if (!refundMap.has(orderId) ||
            (refund.createdAt && refundMap.get(orderId).createdAt < refund.createdAt)) {
          refundMap.set(orderId, {
            id: refund.id,
            status: refund.status,
            refundStatus: refund.refundStatus ?? refund.refund_status,
            createdAt: refund.createdAt
          })
        }
      })
    }
    
    if (orderList && orderList.length > 0) {
      orders.value = orderList.map(order => {
        const refundInfo = refundMap.get(order.id)
        return mapOrderListItem(order, refundInfo)
      })
      await hydrateMissingOrderItems()
    } else {
      orders.value = []
    }
    
    uni.hideLoading()
  } catch (error) {
    console.error('加载订单列表失败:', error)
    uni.hideLoading()
    uni.showToast({
      title: error.message || '加载失败',
      icon: 'none'
    })
  }
}

const isAfterSaleOrder = (order = {}) => {
  const status = Number(order.status)
  const refundStatus = Number(order.refundStatus)
  return AFTER_SALE_ORDER_STATUSES.includes(status) ||
    !!order.refundApplicationId ||
    (Number.isFinite(refundStatus) && refundStatus > 0)
}

const canOrderApplyRefund = (order = {}) => {
  if (!order.id || order.refundApplicationId) {
    return false
  }
  const refundStatus = Number(order.refundStatus)
  if (Number.isFinite(refundStatus) && refundStatus > 0) {
    return false
  }
  if (isTherapyOrder(order) || hasRedeemVouchers(order)) {
    return Number(order.payStatus) === 1 && Number(order.status) !== 4
  }
  return Number(order.status) === 1
}

const refundActionText = (order = {}) => {
  return isTherapyOrder(order) || hasRedeemVouchers(order) ? '申请退款' : '申请退货'
}

// 过滤订单
const filteredOrders = computed(() => {
  if (activeTab.value === 'all') {
    return orders.value
  }

  if (activeTab.value === 'afterSale') {
    return orders.value.filter(isAfterSaleOrder)
  }

  const statusMap = {
    pending: 0,
    shipping: 1,
    received: 2,
    completed: 3
  }

  const status = statusMap[activeTab.value]
  if (status === undefined) {
    return orders.value
  }

  return orders.value.filter(o => o.status === status)
})

// 切换标签
const switchTab = (key) => {
  activeTab.value = key
}

// 获取状态文本
const getStatusText = (status, order = null) => {
  return getOrderStatusText({
    ...(order || {}),
    orderStatus: status,
    hasRedeemVouchers: order ? hasRedeemVouchers(order) : false
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
  logButtonClick('取消订单', 'ORDER_LIST', orderId.toString())
  uni.showModal({
    title: '提示',
    content: '确定要取消此订单吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '取消中...' })
          
          await cancelOrder(orderId)
          
          uni.hideLoading()
          uni.showToast({
            title: '订单已取消',
            icon: 'success'
          })
          
          // 重新加载订单列表
          loadOrders()
        } catch (error) {
          console.error('取消订单失败:', error)
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
const handlePayOrder = (orderId) => {
  logButtonClick('去支付', 'ORDER_LIST', orderId.toString())
  uni.showToast({
    title: '跳转支付页面',
    icon: 'none'
  })
  // TODO: 跳转到支付页面
}

// ✅ 确认收货
const handleConfirmReceipt = async (orderId) => {
  logButtonClick('确认收货', 'ORDER_LIST', orderId.toString())
  uni.showModal({
    title: '提示',
    content: '确认已收到货物吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '确认中...' })
          
          await confirmReceipt(orderId)
          
          uni.hideLoading()
          uni.showToast({
            title: '确认收货成功',
            icon: 'success'
          })
          
          // 重新加载订单列表
          loadOrders()
        } catch (error) {
          console.error('确认收货失败:', error)
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

// 跳转到订单详情
const goToOrderDetail = (orderId) => {
  if (!orderId || navigatingOrderId.value === orderId) {
    return
  }
  navigatingOrderId.value = orderId
  logButtonClick('查看订单详情', 'ORDER_LIST', orderId.toString())
  console.log('goToOrderDetail called with orderId=', orderId)
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
  try {
    logButtonClick('申请退货', 'ORDER_LIST', orderId.toString())

    // 检查是否可以申请退货
    const checkResult = await checkCanApplyRefund(orderId)
    if (!checkResult) {
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
    console.error('检查退货条件失败:', error)
    uni.showToast({
      title: error.message || '操作失败',
      icon: 'none'
    })
  }
}

// 查看退货申请
const viewRefundApplication = (refundApplicationId) => {
  logButtonClick('查看退货申请', 'ORDER_LIST', refundApplicationId.toString())
  uni.navigateTo({
    url: `/pages/order/refund_detail?refundApplicationId=${refundApplicationId}`
  })
}

const refreshCartCount = () => {
  cartCount.value = getCartTotalQuantity()
}

const handleTabChange = () => {
  refreshCartCount()
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

onMounted(() => {
  // 检查页面参数，设置默认标签页
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const status = currentPage?.options?.status

  if (status) {
    activeTab.value = status
  }

  logPageView('ORDER_LIST', activeTab.value)
  refreshCartCount()
  unsubscribeCartUpdated = subscribeCartUpdated(refreshCartCount)
  loadOrders()
})

onShow(() => {
  refreshCartCount()
})

onUnmounted(() => {
  if (unsubscribeCartUpdated) {
    unsubscribeCartUpdated()
    unsubscribeCartUpdated = null
  }
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
  display: flex;
  flex-direction: column;
  color: $text;
}

/* 顶部 Tabs：更“粘性 + 质感” */
.tabs {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1rpx solid rgba(231, 238, 248, 0.9);
  box-shadow: 0 8rpx 18rpx rgba(15, 23, 42, 0.04);
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 26rpx 0 22rpx;
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
  padding: 20rpx 20rpx calc(140rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
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
  align-items: center;
  padding-bottom: 12rpx;
}

.order-no {
  font-size: 26rpx;
  color: rgba(15, 23, 42, 0.92);
  font-weight: 700;
}

/* 状态徽标：class 驱动，颜色/背景一致 */
.order-status {
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
