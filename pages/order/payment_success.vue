<template>
  <view class="page">
    <view class="content">
      <!-- 成功图标和文字 -->
      <view class="success-header">
        <view class="success-icon-wrapper">
          <view class="success-icon">
            <uni-icons type="checkmarkempty" size="60" color="#07c160"></uni-icons>
          </view>
        </view>
        <text class="success-text">支付成功</text>
      </view>
      
      <!-- 支付金额 -->
      <view class="amount-section">
        <text class="amount-label">支付金额</text>
        <text class="amount-value" v-if="!loading">¥{{ (paymentInfo.amount || 0).toFixed(2) }}</text>
        <text class="amount-value" v-else>加载中...</text>
      </view>
      
      <!-- 支付信息卡片 -->
      <view class="info-card">
        <view class="info-row">
          <text class="info-label">支付方式</text>
          <text class="info-value">{{ paymentInfo.paymentMethod }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">订单号</text>
          <text class="info-value order-no">{{ paymentInfo.orderNo }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">支付时间</text>
          <text class="info-value">{{ paymentInfo.paymentTime }}</text>
        </view>
      </view>
      
      <!-- 提示信息 -->
      <view class="tip-section">
        <text class="tip-text">订单已提交，我们将尽快为您处理</text>
      </view>
    </view>
    
    <!-- 底部按钮 -->
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
import { removeFromCart } from '@/utils/cart.js'
import { logPageView, logButtonClick } from '@/api/access-log.js'

const paymentInfo = ref({
  amount: 0,
  paymentMethod: '在线支付',
  orderNo: '',
  paymentTime: ''
})

const loading = ref(true)

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return ''
  return dayjs(timeStr).format('YYYY-MM-DD HH:mm:ss')
}

// 从后端加载订单信息
const loadOrderInfo = async (orderId) => {
  if (!orderId) {
    console.warn('订单ID为空，无法加载订单信息')
    loading.value = false
    return
  }

  try {
    uni.showLoading({ title: '加载中...' })
    
    const orderData = await getOrderDetail(orderId)
    
    console.log('订单详情:', orderData)
    
    // 映射订单数据（优先展示实付金额 paidAmount）
    paymentInfo.value.amount = parseFloat(orderData.paidAmount || orderData.totalAmount || orderData.amount || 0)
    paymentInfo.value.orderNo = orderData.orderNo || ''
    
    // 支付时间：优先使用 payTime，如果没有则使用 createTime
    const payTime = orderData.payTime || orderData.createTime || orderData.createdAt
    paymentInfo.value.paymentTime = formatTime(payTime)
    
    // 支付方式：根据 paymentType 判断，默认为在线支付
    if (orderData.paymentType) {
      paymentInfo.value.paymentMethod = orderData.paymentType === 'single' ? '在线支付' : orderData.paymentType
    }
    
    // ✅ 支付成功后，从购物车中移除已下单的商品
    // 后端现在保证返回 items 字段，每个 item 都有 productId 字段（驼峰命名）
    if (orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0) {
      // 提取商品ID（后端返回的是 productId 驼峰命名）
      const productIds = orderData.items
        .map(item => item.productId)
        .filter(Boolean)
        .map(id => String(id)) // 统一转换为字符串，确保与购物车存储格式一致

      if (productIds.length > 0) {
        const removed = removeFromCart(productIds)
        console.log('支付成功，已从购物车移除商品:', productIds, removed ? '成功' : '失败')
        // 通知其他页面购物车已更新
        uni.$emit('cartUpdated')
      } else {
        console.warn('订单商品列表中没有有效的 productId')
      }
    } else {
      console.warn('订单详情中没有 items 字段或 items 为空')
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
    loading.value = false
  }
}

onLoad(async (options) => {
  // 优先从 URL 参数获取订单ID
  // 记录页面访问日志
  const orderId = options.orderId || options.id
  logPageView('支付成功页面', '用户进入支付成功页面', orderId)

  // 优先从 URL 参数获取订单ID
  if (orderId) {
    // 从后端加载订单信息
    await loadOrderInfo(orderId)
  } else {
    // 如果没有订单ID，使用页面参数作为兜底
    if (options.amount) {
      paymentInfo.value.amount = parseFloat(options.amount)
    }
    
    // 生成临时订单号（仅用于显示，实际应该从后端获取）
    paymentInfo.value.orderNo = options.outTradeNo || '临时订单号'
    paymentInfo.value.paymentTime = formatTime(new Date())
    
    if (options.paymentMethod) {
      paymentInfo.value.paymentMethod = decodeURIComponent(options.paymentMethod)
    }
    
    loading.value = false
  }
})

const goHome = () => {
  // 记录按钮点击日志
  logButtonClick('支付成功页面', '用户点击完成按钮', paymentInfo.value.orderNo)

  // 跳转到产品列表页面
  uni.redirectTo({
    url: '/pages/products/priducts_list'
  })
}
</script>

<style scoped>
.page {
  /* 更干净的浅灰蓝背景 */
  background: #f5f7fb;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(112rpx + env(safe-area-inset-bottom));

  /* 统一视觉变量（便于后续换主题） */
  --brand: #16a34a;          /* 更“专业”的绿色 */
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
  max-width: 420rpx;        /* 防止订单号把布局撑爆 */
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  height: 88rpx;           /* 关键：不要太大 */
  line-height: 88rpx;      /* 关键：对齐高度 */
  background: #10b981;     /* 令人愉悦的绿色 */
  color: #fff;
  font-size: 30rpx;
  font-weight: 700;
  border-radius: 9999px;    /* 更"商务"的圆角，不用 50rpx 那么夸张 */
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

