<template>
  <view class="profile-page">
    <view class="user-header">
      <view class="user-info">
        <view class="avatar-wrapper">
          <image
            class="avatar"
            :src="avatarSrc"
            mode="aspectFill"
          />
        </view>
        <view class="user-details">
          <view class="name">
            {{ userInfo.realName || '微信用户' }}
          </view>
          <view class="card-number">
            就诊卡号: {{ userInfo.idNumber || '暂无' }}
          </view>
        </view>
      </view>
    </view>

    <view class="order-section">
      <view class="section-header">
        <view class="section-title">
          我的订单
        </view>
        <view
          class="view-all"
          @click="goToOrderList"
        >
          <text class="view-all-text">全部订单</text>
          <uni-icons type="right" size="10" color="#999999" />
        </view>
      </view>
      <view class="order-grid">
        <view
          class="order-card"
          @click="goToOrderListByStatus(0)"
        >
          <view class="order-card-icon">
            <uni-icons
              type="wallet"
              size="28"
              color="#4A90E2"
            />
          </view>
          <text class="order-card-text">
            待支付
          </text>
          <view
            v-if="orderStats.pending > 0"
            class="order-card-badge"
          >
            {{ orderStats.pending }}
          </view>
        </view>
        <view
          class="order-card"
          @click="goToOrderListByStatus(1)"
        >
          <view class="order-card-icon">
            <uni-icons
              type="checkbox"
              size="28"
              color="#4A90E2"
            />
          </view>
          <text class="order-card-text">
            已支付
          </text>
          <view
            v-if="orderStats.paid > 0"
            class="order-card-badge"
          >
            {{ orderStats.paid }}
          </view>
        </view>
        <view
          class="order-card"
          @click="goToOrderListByStatus(4)"
        >
          <view class="order-card-icon">
            <uni-icons
              type="close"
              size="28"
              color="#4A90E2"
            />
          </view>
          <text class="order-card-text">
            已取消
          </text>
          <view
            v-if="orderStats.cancelled > 0"
            class="order-card-badge"
          >
            {{ orderStats.cancelled }}
          </view>
        </view>
        <view
          class="order-card"
          @click="goToOrderListByStatus('refund')"
        >
          <view class="order-card-icon">
            <uni-icons
              type="loop"
              size="28"
              color="#4A90E2"
            />
          </view>
          <text class="order-card-text">
            退款/售后
          </text>
          <view
            v-if="orderStats.refund > 0"
            class="order-card-badge"
          >
            {{ orderStats.refund }}
          </view>
        </view>
      </view>
    </view>

    <view class="service-section">
      <view class="section-title">
        我的服务
      </view>
      <view class="service-grid">
        <view
          class="service-item"
          @click="goToAddressList"
        >
          <view class="service-icon">
            <uni-icons
              type="location"
              size="32"
              color="#4A90E2"
            />
          </view>
          <text class="service-text">
            收货地址
          </text>
        </view>
        <view
          class="service-item"
          @click="goToPatientList"
        >
          <view class="service-icon">
            <uni-icons
              type="person"
              size="32"
              color="#4A90E2"
            />
          </view>
          <text class="service-text">
            就诊人管理
          </text>
        </view>
        <view
          class="service-item"
          @click="handleContact"
        >
          <view class="service-icon">
            <uni-icons
              type="chat"
              size="32"
              color="#4A90E2"
            />
          </view>
          <text class="service-text">
            联系客服
          </text>
          <text class="service-tip">
            人工客服 / AI 客服
          </text>
        </view>
      </view>
    </view>

    <view class="settings-section">
      <view class="section-title">
        设置
      </view>
      <view
        class="settings-item"
        @click="handleLogout"
      >
        <view class="settings-left">
          <uni-icons
            type="close"
            size="32"
            color="#e64340"
          />
          <text class="settings-text">
            退出登录
          </text>
        </view>
      </view>
    </view>

    <TabBar
      :current="currentTab"
      :cart-count="cartCount"
      @change="handleTabChange"
    />
  </view>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getUserProfile, logout } from '@/api/auth.js'
import { getMyOrders } from '@/api/order.js'
import TabBar from '@/components/TabBar/TabBar.vue'
import { logButtonClick, logPageView } from '@/utils/accessLog.js'
import { getCartTotalQuantity } from '@/utils/cart.js'
import { subscribeCartUpdated } from '@/utils/cart-events.js'
import { getImageUrl } from '@/utils/config.js'
import { openCustomerServiceChat } from '@/utils/customer-service.js'
import {
  STORAGE_KEY_TOKEN,
  STORAGE_KEY_USER_REGISTER
} from '@/utils/storage.js'

const userInfo = ref({
  realName: '',
  phone: '',
  idNumber: ''
})

const avatarSrc = computed(() => getImageUrl('/profile/liaoning_zongyi/zaixian_mingyi_logo.png'))
const successIcon = computed(() => getImageUrl('/profile/liaoning_zongyi/success.png'))

const currentTab = ref('mine')
const cartCount = ref(0)
let unsubscribeCartUpdated = null

const orderStats = ref({
  pending: 0,
  paid: 0,
  cancelled: 0,
  refund: 0
})

const loadUserProfile = async () => {
  try {
    uni.showLoading({ title: '加载中...' })

    const userData = await getUserProfile()

    if (userData) {
      userInfo.value = {
        realName: userData.userName || '',
        phone: userData.phone || '',
        idNumber: userData.idCardNo || ''
      }

      uni.setStorageSync(STORAGE_KEY_USER_REGISTER, userInfo.value)
    }

    uni.hideLoading()
  } catch (error) {
    console.error('加载用户信息失败:', error)
    uni.hideLoading()

    try {
      const localUserInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
      if (localUserInfo) {
        userInfo.value = localUserInfo
      }
    } catch (storageError) {
      console.error('读取本地用户信息失败:', storageError)
    }
  }
}

const handleLogout = async () => {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: async (res) => {
      if (!res.confirm) {
        return
      }

      try {
        uni.showLoading({ title: '退出中...' })
        await logout()
      } catch (error) {
        console.error('退出登录失败:', error)
      } finally {
        uni.removeStorageSync(STORAGE_KEY_TOKEN)
        uni.removeStorageSync(STORAGE_KEY_USER_REGISTER)
        uni.hideLoading()
      }

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
  })
}

const loadOrderStats = async () => {
  try {
    const orderList = await getMyOrders()

    if (orderList && orderList.length > 0) {
      orderStats.value = {
        pending: orderList.filter((item) => (item.orderStatus === 0 || item.status === 0) && (item.payStatus === 0 || item.payStatus === undefined)).length,
        paid: orderList.filter((item) => (item.payStatus === 1 || item.orderStatus === 1 || item.orderStatus === 2 || item.orderStatus === 3) && item.orderStatus !== 4).length,
        cancelled: orderList.filter((item) => item.orderStatus === 4).length,
        refund: orderList.filter((item) => item.payStatus === 2 || item.payStatus === 3).length
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
    4: '已取消',
    refund: '退款'
  }

  logButtonClick(`查看${statusMap[status] || '订单'}`, 'USER_PROFILE', '', { status })

  if (status === 'refund') {
    uni.navigateTo({
      url: '/pages/order/refund_list'
    })
    return
  }

  const statusParamMap = {
    0: 'pending',
    1: 'shipping',
    2: 'received',
    3: 'completed',
    4: 'all'
  }

  uni.navigateTo({
    url: `/pages/order/order_list?status=${statusParamMap[status] || 'all'}`
  })
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

const openHumanCustomerService = () => {
  logButtonClick('人工客服', 'USER_PROFILE')
  openCustomerServiceChat()
}

const openAiCustomerService = () => {
  logButtonClick('AI客服', 'USER_PROFILE')
  uni.navigateTo({
    url: '/pages/ai/chat'
  })
}

const handleContact = () => {
  logButtonClick('联系客服', 'USER_PROFILE')

  uni.showActionSheet({
    itemList: ['人工客服', 'AI客服'],
    success: (res) => {
      if (res.tapIndex === 0) {
        openHumanCustomerService()
        return
      }

      if (res.tapIndex === 1) {
        openAiCustomerService()
      }
    }
  })
}

const handleTabChange = (tab) => {
  currentTab.value = tab
}

const refreshCartCount = () => {
  cartCount.value = getCartTotalQuantity()
}

onMounted(() => {
  logPageView('USER_PROFILE')
  loadUserProfile()
  loadOrderStats()
  refreshCartCount()
  unsubscribeCartUpdated = subscribeCartUpdated(refreshCartCount)
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

const getCurrentRoute = () => {
  try {
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1] || {}
    let route = currentPage.route || '/pages/user/profile'
    const options = currentPage.options || {}
    const queryString = Object.keys(options)
      .map((key) => `${key}=${encodeURIComponent(options[key])}`)
      .join('&')

    if (queryString) {
      route += `?${queryString}`
    }

    return route
  } catch (error) {
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

.user-header {
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
  padding: 60rpx 30rpx 80rpx;
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

.order-section {
  margin: 20rpx;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 30rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}

.view-all {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 28rpx;
  color: #999999;
}

.view-all-text {
  color: #999999;
}

.order-grid {
  display: flex;
  justify-content: space-around;
  align-items: flex-start;
}

.order-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  padding: 20rpx 0;
  position: relative;
  transition: all 0.3s;
}

.order-card:active {
  transform: scale(0.95);
  opacity: 0.7;
}

.order-card-icon {
  width: 80rpx;
  height: 80rpx;
  background: linear-gradient(135deg, rgba(74, 144, 226, 0.1) 0%, rgba(74, 144, 226, 0.05) 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12rpx;
}

.order-card-img {
  width: 28rpx;
  height: 28rpx;
}

.order-card-text {
  font-size: 24rpx;
  color: #333333;
  margin-top: 8rpx;
}

.order-card-badge {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  min-width: 32rpx;
  height: 32rpx;
  background: #ff6b6b;
  border-radius: 16rpx;
  color: #ffffff;
  font-size: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8rpx;
}

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
}

.service-section .section-title {
  margin-bottom: 30rpx;
}

.service-grid {
  display: flex;
  justify-content: space-around;
  align-items: flex-start;
}

.service-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  padding: 20rpx 0;
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

.service-tip {
  margin-top: 10rpx;
  font-size: 20rpx;
  line-height: 1.4;
  color: #8b96a6;
  text-align: center;
}

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
</style>
