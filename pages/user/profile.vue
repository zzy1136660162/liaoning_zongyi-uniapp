<template>
  <view class="profile-page">
    <!-- 用户信息头部 -->
    <view class="user-header">
      <view class="user-info">
        <view class="avatar-wrapper">
          <image class="avatar" :src="avatarSrc" mode="aspectFill"></image>
        </view>
        <view class="user-details">
          <view class="name">{{ userInfo.realName || '微信用户' }}</view>
          <view class="card-number">就诊卡号: {{ userInfo.idNumber || '暂无' }}</view>
        </view>
      </view>
    </view>

    <!-- 订单状态卡片 -->
    <view class="order-status-card">
      <view class="order-header">
        <text class="order-title">我的订单</text>
        <view class="view-all" @click="goToOrderList">
          <text>全部订单</text>
          <text class="arrow">›</text>
        </view>
      </view>
      <view class="order-status-list">
        <view class="status-item" @click="goToOrderListByStatus(0)">
          <view class="status-icon">
            <uni-icons type="wallet" size="32" color="#333333"></uni-icons>
          </view>
          <text class="status-text">待支付</text>
          <view class="status-badge" v-if="orderStats.pending > 0">{{ orderStats.pending }}</view>
        </view>
        <view class="status-item" @click="goToOrderListByStatus(1)">
          <view class="status-icon">
            <image class="status-img" :src="successIcon" mode="aspectFit"></image>
          </view>
          <text class="status-text">已支付</text>
          <view class="status-badge" v-if="orderStats.paid > 0">{{ orderStats.paid }}</view>
        </view>
        <view class="status-item" @click="goToOrderListByStatus(4)">
          <view class="status-icon">
            <uni-icons type="closeempty" size="32" color="#333333"></uni-icons>
          </view>
          <text class="status-text">已作废</text>
          <view class="status-badge" v-if="orderStats.cancelled > 0">{{ orderStats.cancelled }}</view>
        </view>
        <view class="status-item" @click="goToOrderListByStatus('refund')">
          <view class="status-icon">
            <uni-icons type="loop" size="32" color="#333333"></uni-icons>
          </view>
          <text class="status-text">退/换</text>
          <view class="status-badge" v-if="orderStats.refund > 0">{{ orderStats.refund }}</view>
        </view>
      </view>
    </view>

    <!-- 我的服务 -->
    <view class="service-section">
      <view class="section-title">我的服务</view>
      <view class="service-grid">
        <view class="service-item" @click="goToAddressList">
          <view class="service-icon">
            <uni-icons type="location" size="32" color="#4A90E2"></uni-icons>
          </view>
          <text class="service-text">收货地址</text>
        </view>
        <view class="service-item" @click="goToPatientList">
          <view class="service-icon">
            <uni-icons type="person" size="32" color="#4A90E2"></uni-icons>
          </view>
          <text class="service-text">就诊人管理</text>
        </view>
        <view class="service-item">
          <!-- 暂时注释企业微信客服，使用微信原生客服 -->
          
          <view class="service-item" @click="handleContact">
            <view class="service-icon">
              <uni-icons type="chat" size="32" color="#4A90E2"></uni-icons>
            </view>
            <text class="service-text">联系客服</text>
          </view>
         
          <!-- <button class="contact-button" open-type="contact" bindcontact="handleContact">
            <view class="service-icon">
              <uni-icons type="chat" size="32" color="#4A90E2"></uni-icons>
            </view>
            <text class="service-text">联系客服</text>
          </button> -->
        </view>
      </view>
    </view>

    <!-- 设置 -->
    <view class="settings-section">
      <view class="section-title">设置</view>
      <view class="settings-item" @click="handleLogout">
        <view class="settings-left">
          <uni-icons type="close" size="32" color="#e64340"></uni-icons>
          <text class="settings-text">退出登录</text>
        </view>
        <text class="settings-arrow">›</text>
      </view>
    </view>

    <!-- Tab Bar 导航栏 -->
    <TabBar :current="currentTab" :cartCount="cartCount" @change="handleTabChange" />
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { logPageView, logButtonClick } from '@/utils/accessLog.js'
import { getUserProfile, logout } from '@/api/auth.js'
import { getMyOrders } from '@/api/order.js'
import { STORAGE_KEY_USER_REGISTER, STORAGE_KEY_TOKEN, STORAGE_KEY_VERIFIED_PRODUCTS, STORAGE_KEY_PRODUCT_QUANTITIES } from '@/utils/storage.js'
import { loadCartItems, calculateTotalQuantity } from '@/utils/cart.js'
import TabBar from '@/components/TabBar/TabBar.vue'
import { getImageUrl } from '@/utils/config.js'

const userInfo = ref({
  realName: '',
  phone: '',
  idNumber: ''
})

// 头像与图标地址（通过 getImageUrl 统一处理）
const avatarSrc = computed(() => getImageUrl('/profile/liaoning_zongyi/zaixian_mingyi_logo.png'))
const successIcon = computed(() => getImageUrl('/profile/liaoning_zongyi/success.png'))

const currentTab = ref('mine')

// 购物车相关数据
const cartItems = ref([])
const cartCount = ref(0)

const orderStats = ref({
  pending: 0,      // 待支付
  paid: 0,         // 已支付
  cancelled: 0,    // 已作废
  refund: 0        // 退/换
})

// ✅ 从API加载用户信息
const loadUserProfile = async () => {
  try {
    uni.showLoading({ title: '加载中...' })
    
    const userData = await getUserProfile()
    
    console.log('用户信息:', userData)
    
    if (userData) {
      userInfo.value = {
        realName: userData.userName || '',
        phone: userData.phone || '',
        idNumber: userData.idCardNo || ''
      }
      
      // 更新本地缓存
      uni.setStorageSync(STORAGE_KEY_USER_REGISTER, userInfo.value)
    }
    
    uni.hideLoading()
  } catch (error) {
    console.error('加载用户信息失败:', error)
    uni.hideLoading()
    
    // API失败时从本地加载
    try {
      const localUserInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
      if (localUserInfo) {
        userInfo.value = localUserInfo
      }
    } catch (e) {
      console.error('从本地加载用户信息失败:', e)
    }
  }
}

// ✅ 退出登录
const handleLogout = async () => {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '退出中...' })
          
          await logout()
          
          // 清除本地缓存
          uni.removeStorageSync(STORAGE_KEY_TOKEN)
          uni.removeStorageSync(STORAGE_KEY_USER_REGISTER)
          
          uni.hideLoading()
          uni.showToast({
            title: '已退出登录',
            icon: 'success'
          })
          
          // 跳转到注册页并传递 redirectUrl
          setTimeout(() => {
            uni.reLaunch({
              url: `/pages/register/register?redirectUrl=${encodeURIComponent(getCurrentRoute())}`
            })
          }, 1500)
        } catch (error) {
          console.error('退出登录失败:', error)
          uni.hideLoading()
          
          // 即使API失败，也清除本地缓存
          uni.removeStorageSync(STORAGE_KEY_TOKEN)
          uni.removeStorageSync(STORAGE_KEY_USER_REGISTER)
          
          uni.showToast({
            title: '已退出登录',
            icon: 'success'
          })
          
          setTimeout(() => {
            uni.reLaunch({
              url: `/pages/register/register?redirectUrl=${encodeURIComponent(getCurrentRoute())}`
            })
          }, 1500)
        }
      }
    }
  })
}

// 加载订单统计数据
const loadOrderStats = async () => {
  try {
    const orderList = await getMyOrders()
    
    if (orderList && orderList.length > 0) {
      orderStats.value = {
        pending: orderList.filter(o => (o.orderStatus === 0 || o.status === 0) && (o.payStatus === 0 || o.payStatus === undefined)).length,
        paid: orderList.filter(o => (o.payStatus === 1 || o.orderStatus === 1 || o.orderStatus === 2 || o.orderStatus === 3) && o.orderStatus !== 4).length,
        cancelled: orderList.filter(o => o.orderStatus === 4).length,
        refund: orderList.filter(o => o.payStatus === 2 || o.payStatus === 3).length
      }
    }
  } catch (error) {
    console.error('加载订单统计失败:', error)
  }
}

const goToOrderList = () => {
  uni.navigateTo({
    url: '/pages/order/order_list'
  })
}

const goToOrderListByStatus = (status) => {
  const statusMap = {
    0: '待支付',
    1: '已支付',
    4: '已作废',
    'refund': '退换'
  }
  logButtonClick(`查看${statusMap[status] || '订单'}`, 'USER_PROFILE', '', { status: status })

  // 退货状态特殊处理：跳转到退货申请列表
  if (status === 'refund') {
    uni.navigateTo({
      url: '/pages/order/refund_list'
    })
    return
  }

  let url = '/pages/order/order_list'

  // 根据状态映射到订单列表页面的标签页
  const statusParamMap = {
    0: 'pending',    // 待支付 -> pending
    1: 'shipping',   // 已支付 -> shipping (待发货)
    2: 'received',   // 待收货 -> received
    3: 'completed',  // 已完成 -> completed
    4: 'all',        // 已作废 -> all (全部)
  }

  const statusParam = statusParamMap[status] || 'all'
  url += `?status=${statusParam}`

  uni.navigateTo({ url })
}

const goToAddressList = () => {
  logButtonClick('收货地址', 'USER_PROFILE')
  uni.navigateTo({
    url: '/pages/order/address_list'
  })
}

const goToPatientList = () => {
  logButtonClick('就诊人管理', 'USER_PROFILE')
  uni.navigateTo({
    url: '/pages/dispense/apply'
  })
}

const handleContact = (e) => {
  logButtonClick('联系客服', 'USER_PROFILE')

  console.log('客服联系事件:', e.detail)

  // 处理客服联系结果
  // if (e.detail.errMsg === 'enterContact:ok') {
  //   console.log('用户成功进入客服会话')
  // } else {
  //   console.log('客服联系失败:', e.detail.errMsg)
  //   uni.showToast({
  //     title: '客服功能暂时不可用',
  //     icon: 'none'
  //   })
  // }

  // 暂时注释企业微信客服实现，以备后续切换
 //  辽宁中医
 console.log({
  extInfo:{url: 'https://work.weixin.qq.com/kfid/kfcc92471bfa5f832db'}, // 企业微信客服URL
    corpId: '', // 企业ID
 })
  // 打开企业微信客服
  uni.openCustomerServiceChat({
    extInfo:{url: 'https://work.weixin.qq.com/kfid/kfc79feecc56cb032bc'}, // 企业微信客服URL
    corpId: 'ww55d1004932944831', // 企业ID
    success: (res) => {
      console.log('打开客服成功:', res)
    },
    fail: (err) => {
      console.error('打开客服失败:', err)
      // 如果企业微信客服不可用，显示友好提示
      uni.showToast({
        title: '客服功能暂时不可用',
        icon: 'none'
      })
    }
  })
  
}

const goToPrescriptionList = () => {
  logButtonClick('我的处方', 'USER_PROFILE')
  uni.navigateTo({
    url: '/pages/order/prescription_list'
  })
}

const handleTabChange = (tab) => {
  currentTab.value = tab
}

// 加载购物车数据（只加载购物车中的商品）
const loadCartData = async () => {
  try {
    // 先从购物车获取需要的产品ID
    const verifiedProducts = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
    const productIds = Object.keys(verifiedProducts).filter(id => verifiedProducts[id])
    
    if (productIds.length === 0) {
      // 如果购物车为空，直接设置数量为0
      cartItems.value = []
      cartCount.value = 0
      return
    }
    
    // 为购物车中的商品创建虚拟分类结构
    const cartCategory = {
      id: 'cart_items',
      name: '购物车商品',
      products: []
    }
    
    // 逐个获取购物车商品的详细信息（只加载需要的商品）
    const { getProductDetail } = await import('@/api/product.js')
    for (const productId of productIds) {
      try {
        const productDetail = await getProductDetail(productId)
        if (productDetail) {
          cartCategory.products.push({
            id: productDetail.id,
            name: productDetail.productName || productDetail.name,
            description: productDetail.subTitle || productDetail.description,
            image: productDetail.coverImage || productDetail.image,
            price: productDetail.price,
            unit: productDetail.unit || '份',
            notice: productDetail.usageDesc || productDetail.notice
          })
        }
      } catch (err) {
        console.error(`获取商品${productId}详情失败:`, err)
      }
    }
    
    // 使用相同的工具函数计算购物车数据
    cartItems.value = loadCartItems([cartCategory])
    cartCount.value = calculateTotalQuantity(cartItems.value)
    
    console.log('个人中心页面购物车数量:', cartCount.value)
    console.log('购物车项目:', cartItems.value)
  } catch (error) {
    console.error('加载购物车数据失败:', error)
    cartItems.value = []
    cartCount.value = 0
  }
}

onMounted(() => {
  logPageView('USER_PROFILE')
  loadUserProfile()
  loadOrderStats()
  loadCartData()
})

// Helper: 获取当前页面完整路径（带查询参数），用于回跳 redirectUrl
const getCurrentRoute = () => {
  try {
    const pages = getCurrentPages()
    const cur = pages[pages.length - 1] || {}
    let route = cur.route || '/pages/user/profile'
    const options = cur.options || {}
    const qs = Object.keys(options).map(k => `${k}=${encodeURIComponent(options[k])}`).join('&')
    if (qs) route += `?${qs}`
    return route
  } catch (e) {
    return '/pages/user/profile'
  }
}
</script>

<style scoped lang="scss">
.profile-page {
  min-height: 100vh;
  background: #f6f7fb;
  padding-bottom: calc(100rpx + env(safe-area-inset-bottom));
}

/* 用户信息头部 */
.user-header {
  background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
  padding: 60rpx 30rpx 80rpx 30rpx;
  position: relative;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.avatar-wrapper {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
}

.user-details {
  flex: 1;
  color: #fff;
}

.name {
  font-size: 36rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
  color: #ffffff;
}

.card-number {
  font-size: 26rpx;
  opacity: 0.9;
  color: #ffffff;
}

/* 订单状态卡片 */
.order-status-card {
  background: #ffffff;
  border-radius: 24rpx 24rpx 0 0;
  margin-top: -40rpx;
  padding: 30rpx;
  position: relative;
  z-index: 1;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}

.order-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333333;
}

.view-all {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 28rpx;
  color: #333333;
}

.arrow {
  font-size: 32rpx;
  color: #999999;
}

.order-status-list {
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.status-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  flex: 1;
}

.status-icon {
  width: 80rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12rpx;
}

.status-img {
  width: 32rpx;
  height: 32rpx;
  transform: scale(1.5);
}

.status-text {
  font-size: 24rpx;
  color: #333333;
}

.status-badge {
  position: absolute;
  top: -8rpx;
  right: 8rpx;
  background: linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%);
  color: #ffffff;
  font-size: 20rpx;
  min-width: 32rpx;
  height: 32rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8rpx;
  font-weight: 500;
  box-shadow: 0 2rpx 8rpx rgba(255, 107, 107, 0.5);
  border: 2rpx solid #ffffff;
}

/* 我的服务 */
.service-section {
  margin: 20rpx;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 30rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333333;
  margin-bottom: 30rpx;
}

.service-grid {
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.service-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  padding: 20rpx 0;
  cursor: pointer;
  transition: all 0.3s;
}

.service-item:active {
  transform: scale(0.95);
  opacity: 0.7;
}

.service-icon {
  width: 80rpx;
  height: 80rpx;
  background: linear-gradient(135deg, rgba(74, 144, 226, 0.1) 0%, rgba(74, 144, 226, 0.05) 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
  border: 2rpx solid rgba(74, 144, 226, 0.2);
}

.service-text {
  font-size: 26rpx;
  color: #333333;
  text-align: center;
}

/* 设置 */
.settings-section {
  margin: 20rpx;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 30rpx;
}

.settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 0;
  cursor: pointer;
  transition: all 0.3s;
}

.settings-item:active {
  background-color: #f8f8f8;
  border-radius: 12rpx;
  margin: 0 -12rpx;
  padding: 24rpx 12rpx;
}

.settings-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.settings-text {
  font-size: 30rpx;
  color: #333333;
}

.settings-arrow {
  font-size: 32rpx;
  color: #999999;
}

/* 客服按钮样式 */
.contact-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 20rpx 0;
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.3s;
}

.contact-button:active {
  transform: scale(0.95);
  opacity: 0.7;
}

/* Tab Bar 样式已移至组件中 */

</style>
