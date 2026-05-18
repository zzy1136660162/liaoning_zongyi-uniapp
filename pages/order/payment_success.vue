<template>
  <view class="page">
    <view class="content">
      <!-- 鎴愬姛鍥炬爣鍜屾枃瀛?-->
      <view class="success-header">
        <view class="success-icon-wrapper">
          <view class="success-icon">
            <uni-icons type="checkmarkempty" size="60" color="#07c160"></uni-icons>
          </view>
        </view>
        <text class="success-text">支付成功</text>
      </view>
      
      <!-- 鏀粯閲戦 -->
      <view class="amount-section">
        <text class="amount-label">支付金额</text>
        <text class="amount-value" v-if="!loading">楼{{ (paymentInfo.amount || 0).toFixed(2) }}</text>
        <text class="amount-value" v-else>加载中...</text>
      </view>
      
      <!-- 鏀粯淇℃伅鍗＄墖 -->
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
          <text class="info-label">鏀粯鏃堕棿</text>
          <text class="info-value">{{ paymentInfo.paymentTime }}</text>
        </view>
      </view>
      
      <!-- 鎻愮ず淇℃伅 -->
      <view class="tip-section">
        <text class="tip-text">订单已提交，我们将尽快为您处理</text>
      </view>
    </view>
    
    <!-- 搴曢儴鎸夐挳 -->
    <view class="footer">
      <button class="complete-btn" @click="goHome">瀹屾垚</button>
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

// 鏍煎紡鍖栨椂闂?
const formatTime = (timeStr) => {
  if (!timeStr) return ''
  return dayjs(timeStr).format('YYYY-MM-DD HH:mm:ss')
}

// 浠庡悗绔姞杞借鍗曚俊鎭?
const loadOrderInfo = async (orderId) => {
  if (!orderId) {
    console.warn('订单ID为空，无法加载订单信息')
    loading.value = false
    return
  }

  try {
    uni.showLoading({ title: '加载中...' })
    
    const orderData = await getOrderDetail(orderId)
    

    
    // 鏄犲皠璁㈠崟鏁版嵁锛堜紭鍏堝睍绀哄疄浠橀噾棰?paidAmount锛?
    paymentInfo.value.amount = parseFloat(orderData.paidAmount || orderData.totalAmount || orderData.amount || 0)
    paymentInfo.value.orderNo = orderData.orderNo || ''
    
    // 鏀粯鏃堕棿锛氫紭鍏堜娇鐢?payTime锛屽鏋滄病鏈夊垯浣跨敤 createTime
    const payTime = orderData.payTime || orderData.createTime || orderData.createdAt
    paymentInfo.value.paymentTime = formatTime(payTime)
    
    // 鏀粯鏂瑰紡锛氭牴鎹?paymentType 鍒ゆ柇锛岄粯璁や负鍦ㄧ嚎鏀粯
    if (orderData.paymentType) {
      paymentInfo.value.paymentMethod = orderData.paymentType === 'single' ? '在线支付' : orderData.paymentType
    }
    
    // 鉁?鏀粯鎴愬姛鍚庯紝浠庤喘鐗╄溅涓Щ闄ゅ凡涓嬪崟鐨勫晢鍝?
    // 鍚庣鐜板湪淇濊瘉杩斿洖 items 瀛楁锛屾瘡涓?item 閮芥湁 productId 瀛楁锛堥┘宄板懡鍚嶏級
    if (orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0) {
      // 鎻愬彇鍟嗗搧ID锛堝悗绔繑鍥炵殑鏄?productId 椹煎嘲鍛藉悕锛?
      const productIds = orderData.items
        .map(item => item.productId)
        .filter(Boolean)
        .map(id => String(id)) // 缁熶竴杞崲涓哄瓧绗︿覆锛岀‘淇濅笌璐墿杞﹀瓨鍌ㄦ牸寮忎竴鑷?

      if (productIds.length > 0) {
        const removed = removeFromCart(productIds)

        // 閫氱煡鍏朵粬椤甸潰璐墿杞﹀凡鏇存柊
        uni.$emit('cartUpdated')
      } else {
        console.warn('订单商品列表中没有有效的 productId')
      }
    } else {
      console.warn('订单详情中没有 items 字段或 items 为空')
    }

  } catch (error) {
    console.error('鍔犺浇璁㈠崟淇℃伅澶辫触:', error)
    uni.showToast({
      title: '鍔犺浇璁㈠崟淇℃伅澶辫触',
      icon: 'none',
      duration: 2000
    })
  } finally {
    uni.hideLoading()
    loading.value = false
  }
}

onLoad(async (options) => {
  // 浼樺厛浠?URL 鍙傛暟鑾峰彇璁㈠崟ID
  // 璁板綍椤甸潰璁块棶鏃ュ織
  const orderId = options.orderId || options.id
  logPageView('鏀粯鎴愬姛椤甸潰', '鐢ㄦ埛杩涘叆鏀粯鎴愬姛椤甸潰', orderId)

  // 浼樺厛浠?URL 鍙傛暟鑾峰彇璁㈠崟ID
  if (orderId) {
    // 浠庡悗绔姞杞借鍗曚俊鎭?
    await loadOrderInfo(orderId)
  } else {
    // 濡傛灉娌℃湁璁㈠崟ID锛屼娇鐢ㄩ〉闈㈠弬鏁颁綔涓哄厹搴?
    if (options.amount) {
      paymentInfo.value.amount = parseFloat(options.amount)
    }
    
    // 鐢熸垚涓存椂璁㈠崟鍙凤紙浠呯敤浜庢樉绀猴紝瀹為檯搴旇浠庡悗绔幏鍙栵級
    paymentInfo.value.orderNo = options.outTradeNo || '临时订单号'
    paymentInfo.value.paymentTime = formatTime(new Date())
    
    if (options.paymentMethod) {
      paymentInfo.value.paymentMethod = decodeURIComponent(options.paymentMethod)
    }
    
    loading.value = false
  }
})

const goHome = () => {
  // 璁板綍鎸夐挳鐐瑰嚮鏃ュ織
  logButtonClick('支付成功页面', '用户点击完成按钮', paymentInfo.value.orderNo)

  // 璺宠浆鍒颁骇鍝佸垪琛ㄩ〉闈?
  uni.redirectTo({
    url: '/pages/products/medicine_index'
  })
}
</script>

<style scoped>
.page {
  /* 鏇村共鍑€鐨勬祬鐏拌摑鑳屾櫙 */
  background: #f5f7fb;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(112rpx + env(safe-area-inset-bottom));

  /* 缁熶竴瑙嗚鍙橀噺锛堜究浜庡悗缁崲涓婚锛?*/
  --brand: #16a34a;          /* 鏇粹€滀笓涓氣€濈殑缁胯壊 */
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
  max-width: 420rpx;        /* 闃叉璁㈠崟鍙锋妸甯冨眬鎾戠垎 */
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
  height: 88rpx;           /* 鍏抽敭锛氫笉瑕佸お澶?*/
  line-height: 88rpx;      /* 鍏抽敭锛氬榻愰珮搴?*/
  background: #10b981;     /* 浠や汉鎰夋偊鐨勭豢鑹?*/
  color: #fff;
  font-size: 30rpx;
  font-weight: 700;
  border-radius: 9999px;    /* 鏇?鍟嗗姟"鐨勫渾瑙掞紝涓嶇敤 50rpx 閭ｄ箞澶稿紶 */
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

