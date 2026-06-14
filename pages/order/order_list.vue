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
        <view
          v-if="tab.count > 0"
          class="tab-badge"
        >
          {{ tab.count }}
        </view>
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

        <view class="order-products">
          <!-- 显示每个商品的名称和数量（不显示图片，简洁列表） -->
          <view 
            v-for="item in order.items" 
            :key="item.id"
            class="product-item simple"
          >
            <text class="product-name">
              {{ item.productName }}
            </text>
            <text class="product-spec">
              ×{{ item.quantity }}
            </text>
          </view>
        </view>

        <view
          v-if="showTherapyQr(order)"
          class="therapy-qr-card"
          @click.stop
        >
          <view class="therapy-qr-head">
            <text class="therapy-qr-tag">
              到店核销
            </text>
            <text class="therapy-qr-hint">
              请向工作人员出示此码
            </text>
          </view>
          <image
            class="therapy-qr-image"
            :src="order.verifyQrBase64"
            mode="aspectFit"
            show-menu-by-longpress
          />
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
              v-if="order.status === 0" 
              class="action-btn pay-btn" 
              @click.stop="goToOrderDetail(order.id)"
            >
              查看订单
            </button>
            <button
              v-if="order.status === 2"
              class="action-btn confirm-btn"
              @click.stop="handleConfirmReceipt(order.id)"
            >
              确认收货
            </button>
            <!-- 申请退货按钮：仅在已完成且无退货申请时显示 -->
            <button
              v-if="order.status === 3 && !order.refundApplicationId"
              class="action-btn refund-btn"
              @click.stop="applyRefund(order.id)"
            >
              申请退货
            </button>
            <!-- 查看申请按钮：在已完成且有退货申请时，或退货中状态时显示 -->
            <button
              v-if="(order.status === 3 && order.refundApplicationId) || (order.status === 5 && order.refundApplicationId)"
              class="action-btn view-refund-btn"
              @click.stop="viewRefundApplication(order.refundApplicationId)"
            >
              查看申请
            </button>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getMyOrders, cancelOrder, confirmReceipt } from '@/api/order.js'
import { checkCanApplyRefund, getRefundList } from '@/api/refund.js'
import { logPageView, logButtonClick } from '@/utils/accessLog.js'
import { isTherapyOrder } from '@/utils/therapy.js'

const activeTab = ref('all')
const orders = ref([])

const tabs = ref([
  { key: 'all', label: '全部', count: 0 },
  { key: 'pending', label: '待支付', count: 0 },
  { key: 'shipping', label: '待发货', count: 0 },
  { key: 'received', label: '待收货', count: 0 },
  { key: 'completed', label: '退款/售后', count: 0 }
])

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
            createdAt: refund.createdAt
          })
        }
      })
    }
    
    if (orderList && orderList.length > 0) {
      orders.value = orderList.map(order => {
        const refundInfo = refundMap.get(order.id)
        return {
          id: order.id,
          orderNo: order.orderNo || order.id,
          orderType: order.orderType ?? order.order_type,
          payStatus: order.payStatus ?? order.pay_status,
          redeemStatus: order.redeemStatus ?? order.redeem_status,
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
          createTime: order.createTime || order.createdAt,
          refundApplicationId: refundInfo ? refundInfo.id : null, // 添加退货申请ID
          items: (order.items || order.items || []).map(item => ({
            id: item.id,
            productName: item.productName || item.name,
            productImage: item.productImage || item.image,
            quantity: item.quantity || 1,
            price: item.price || '0.00'
          }))
        }
      })
      
      updateTabCounts()
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

// 更新标签页数量
const updateTabCounts = () => {
  //tabs.value[0].count = orders.value.length
  tabs.value[1].count = orders.value.filter(o => o.status === 0).length
  tabs.value[2].count = orders.value.filter(o => o.status === 1).length
  tabs.value[3].count = orders.value.filter(o => o.status === 2).length
  //tabs.value[4].count = orders.value.filter(o => o.status === 3).length
}

// 过滤订单
const filteredOrders = computed(() => {
  if (activeTab.value === 'all') {
    return orders.value
  }
  
  const statusMap = {
    pending: 0,
    shipping: 1,
    received: 2,
    completed: 3
  }
  
  return orders.value.filter(o => o.status === statusMap[activeTab.value])
})

// 切换标签
const switchTab = (key) => {
  activeTab.value = key
}

const showTherapyQr = (order) => {
  if (!isTherapyOrder(order)) return false
  const paid = Number(order.payStatus) === 1 || order.status >= 1
  const pendingRedeem = Number(order.redeemStatus) !== 1
  return paid && pendingRedeem && !!order.verifyQrBase64
}

// 获取状态文本
const getStatusText = (status, order = null) => {
  if (order && isTherapyOrder(order)) {
    if (status === 0) return '待支付'
    if (Number(order.redeemStatus) === 1 || status === 3) return '已核销'
    if (status >= 1) return '待核销'
  }
  const statusMap = {
    0: '待支付',
    1: '待发货',
    2: '待收货',
    3: '已完成',
    4: '已取消',
    5: '退货中',
    6: '部分退货',
    7: '已退货'
  }
  return statusMap[status] || '未知'
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
  logButtonClick('查看订单详情', 'ORDER_LIST', orderId.toString())
  console.log('goToOrderDetail called with orderId=', orderId)
  uni.navigateTo({
    url: `/pages/order/order-detail?orderId=${encodeURIComponent(orderId)}`
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
  loadOrders()
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

.tab-badge {
  min-width: 34rpx;
  height: 34rpx;
  line-height: 34rpx;
  padding: 0 10rpx;
  background: $danger;
  color: #fff;
  font-size: 20rpx;
  border-radius: 999rpx;
  text-align: center;
  box-shadow: 0 6rpx 14rpx rgba(239, 68, 68, 0.18);
  position: absolute;
  top: 8rpx;
  right: 16rpx;
  z-index: 30;
}

/* 列表容器：底部留安全区 */
.order-list {
  flex: 1;
  padding: 20rpx 20rpx calc(24rpx + env(safe-area-inset-bottom));
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
}

.product-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  padding: 10rpx 0;
  border-bottom: 1rpx dashed rgba(231, 238, 248, 0.9);
}

.product-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.product-name {
  font-size: 26rpx;
  color: rgba(15, 23, 42, 0.88);
  flex: 1;
  margin-right: 12rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.product-spec {
  font-size: 24rpx;
  color: rgba(100, 116, 139, 0.9);
  min-width: 90rpx;
  text-align: right;
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

.therapy-qr-card {
  margin: 14rpx 0 6rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: linear-gradient(180deg, #f8fbff 0%, #f1f5f9 100%);
  border: 1rpx dashed rgba(37, 99, 235, 0.22);
  text-align: center;
}

.therapy-qr-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  margin-bottom: 12rpx;
}

.therapy-qr-tag {
  display: inline-block;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(37, 99, 235, 0.12);
  color: $primary;
  font-size: 22rpx;
  font-weight: 700;
}

.therapy-qr-hint {
  font-size: 24rpx;
  color: $muted;
}

.therapy-qr-image {
  width: 280rpx;
  height: 280rpx;
  margin: 0 auto;
  border-radius: 12rpx;
  background: #fff;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.08);
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
