<template>
  <view class="consultation-page">
    <!-- 状态栏占位 -->
    <view class="safe-top" />
    
 
    
    <!-- 聊天内容区域 -->
    <scroll-view 
      class="chat-container" 
      scroll-y 
      :scroll-top="scrollTop" 
      scroll-with-animation
      :scroll-into-view="scrollIntoView"
    >
      <view class="chat-messages" id="chat-messages">
        <view 
          v-for="(message, index) in messages" 
          :key="index"
          class="message-item"
          :class="{ 'show': message.show }"
          :id="`message-${index}`"
        >
          <view class="message-avatar">
            <image 
              class="avatar-img" 
              :src="getImageUrl(doctorAvatar)" 
              mode="aspectFill"
            />
          </view>
          <view class="message-content">
            <view class="doctor-name">{{ doctorName }}</view>
            <view class="message-bubble">
              <text class="message-text">{{ message.text }}</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
    
    <!-- 查看处方按钮 -->
    <view class="footer" v-if="showPrescriptionBtn">
      <button class="prescription-btn" @click="viewPrescription">查看处方</button>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createConsultation } from '@/api/consultation.js'
import { getProductDetail } from '@/api/product.js'
import { STORAGE_KEY_USER_REGISTER, STORAGE_KEY_VERIFIED_PRODUCTS, STORAGE_KEY_CURRENT_CONSULTATION_ID, STORAGE_KEY_PRODUCT_QUANTITIES } from '@/utils/storage.js'
import { logPageView } from '@/api/access-log.js'
import { getImageUrl } from '@/utils/config.js'

const doctorName = ref('线上名医')
const doctorAvatar = ref('/profile/liaoning_zongyi/zaixian_mingyi_logo.png')
const doctorId = ref(null)

const messages = ref([
  {
    text: '您好，我是辽宁中医在线医生，已收到您的复诊开药诉求，正在为您诊断开方，预计1分钟，请不要离开。',
    show: false
  },
  {
    text: '请问您是否还有其他信息需要补充，如无，我将依据您的资料开具处方。',
    show: false
  },
  {
    text: '请稍等，正在审核您提交的用药信息。',
    show: false
  },
  {
    text: '如无信息补充，我将根据您提交的复诊信息开具处方。',
    show: false
  },
  {
    text: '已为您开具处方，您可以点击下方查看处方按钮，完成支付。',
    show: false
  }
])

const showPrescriptionBtn = ref(false)
const scrollTop = ref(0)
const scrollIntoView = ref('')

// 显示消息动画
const showMessages = async () => {
  for (let i = 0; i < messages.value.length; i++) {
    // 延迟显示每条消息
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // 显示当前消息
    messages.value[i].show = true
    
    // 滚动到当前消息
    await nextTick()
    scrollToMessage(i)
    
    // 如果是最后一条消息，延迟后显示按钮
    if (i === messages.value.length - 1) {
      setTimeout(() => {
        showPrescriptionBtn.value = true
        scrollToMessage(i)
      }, 1000)
    }
  }
}

// 滚动到指定消息
const scrollToMessage = (index) => {
  nextTick(() => {
    scrollIntoView.value = `message-${index}`
    // 延迟重置，以便下次滚动可以触发
    setTimeout(() => {
      scrollIntoView.value = ''
    }, 100)
  })
}

const onClose = () => {
  uni.navigateBack({ delta: 1 })
}

const viewPrescription = () => {
  uni.navigateTo({
    url: '/pages/order/prescription_list'
  })
}

// 从购物车获取当前勾选的所有商品，用于创建处方明细
const loadProductsForConsultation = async () => {
  const verifiedProducts = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
  const productIds = Object.keys(verifiedProducts).filter(id => verifiedProducts[id])
  if (productIds.length === 0) return []

  const products = []
  try {
    for (const productId of productIds) {
      const detail = await getProductDetail(productId)
      if (detail) {
        products.push(detail)
      }
    }
    return products
  } catch (e) {
    console.error('获取商品详情失败:', e)
    return products
  }
}

// ✅ 创建咨询
const createConsultationRecord = async () => {
  try {
    const userInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
    const products = await loadProductsForConsultation()

    // 取医生ID（默认使用购物车第一件商品的医生）
    const firstProduct = products[0]
    doctorId.value = firstProduct?.doctorId || null

    // 将购物车内所有已勾选商品作为处方明细传递到后端
    // 优先使用本地存储的商品数量（由上页 apply.vue 存储），回退到商品对象中的数量或 1
    const productQuantities = uni.getStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES) || {}
    // 注意: 小程序打包/编译器旧版可能不支持 nullish coalescing (??)，因此使用兼容写法
    const resolveQuantity = (item) => {
      const stored = productQuantities[String(item.id)]
      if (stored !== undefined && stored !== null) return stored
      if (item.quantity !== undefined && item.quantity !== null) return item.quantity
      if (item.count !== undefined && item.count !== null) return item.count
      if (item.num !== undefined && item.num !== null) return item.num
      return 1
    }

    const prescriptionItems = products.map(p => ({
      productId: p.id,
      drugName: p.productName || p.name || '未命名药品',
      quantity: resolveQuantity(p),
      remark: p.usageDesc || p.notice || ''
    }))
    
    const consultationData = {
      consultType: 1, // 在线咨询
      symptomDesc: '复诊开药',
      historyDesc: '',
      doctorId: doctorId.value,
      diagnosis: firstProduct?.prescriptionDiagnosis || '复诊开药',
      usageNote: firstProduct?.usageDesc || '',
      prescriptionItems
    }
    
    const result = await createConsultation(consultationData)
    console.log('创建咨询成功:', result)
    
    // 将问诊ID保存到本地，用于后续创建订单时关联处方
    if (result && result.id) {
      uni.setStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID, result.id)
    }
    
    return result
  } catch (error) {
    console.error('创建咨询失败:', error)
    return null
  }
}

onMounted(() => {
  // 页面加载后创建咨询记录
  createConsultationRecord()

  // 开始显示消息
  setTimeout(() => {
    showMessages()
  }, 500)

  // 记录页面访问日志
  logPageView('咨询页面', '用户进入咨询页面')
})

onLoad((options) => {
  if (options?.doctorName) {
    doctorName.value = decodeURIComponent(options.doctorName)
  }
  if (options?.doctorAvatar) {
    doctorAvatar.value = decodeURIComponent(options.doctorAvatar)
  }
})
</script>

<style scoped>
.consultation-page {
  background: #f6f7fb;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.safe-top {
  height: env(safe-area-inset-top);
  background: #fff;
}

.nav-bar {
  height: 88rpx;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0 20rpx;
  border-bottom: 1rpx solid #eee;
}

.nav-left, .nav-right {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 120rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  font-size: 36rpx;
}

.nav-left {
  left: 0;
}

.nav-right {
  right: 0;
}

.nav-title {
  font-size: 34rpx;
  font-weight: 600;
}

.chat-container {
  height: 100vh;
  flex: 1;
  padding: 30rpx 20rpx 200rpx;
  box-sizing: border-box;
}

.chat-messages {
  display: flex;
  flex-direction: column;
  gap: 30rpx;
  min-height: 1000rpx;
}

.message-item {
  display: flex;
  align-items: flex-start;
  opacity: 0;
  transform: translateY(20rpx);
  transition: all 0.6s ease-out;
}

.message-item.show {
  opacity: 1;
  transform: translateY(0);
}

.message-avatar {
  width: 80rpx;
  height: 80rpx;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #eee;
}

.message-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.doctor-name {
  font-size: 24rpx;
  color: #666;
  margin-bottom: 10rpx;
}

.message-bubble {
  background: #f0f0f0;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  max-width: 80%;
  position: relative;
}

.message-bubble::before {
  content: '';
  position: absolute;
  left: -12rpx;
  top: 20rpx;
  width: 0;
  height: 0;
  border: 12rpx solid transparent;
  border-right-color: #f0f0f0;
}

.message-text {
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
}

.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  padding: 30rpx 40rpx;
  padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.08);
  z-index: 100;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.prescription-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: linear-gradient(135deg, #4A90E2 0%, #6BB3FF 100%);
  color: #fff;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 44rpx;
  border: none;
  box-shadow: 0 8rpx 20rpx rgba(74, 144, 226, 0.3);
}

.prescription-btn:active {
  transform: scale(0.98);
  box-shadow: 0 4rpx 12rpx rgba(74, 144, 226, 0.2);
}
</style>

