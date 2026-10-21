<template>
  <view class="profile-page">
    <view class="user-header">
      <view class="user-info">
        <view v-if="profileLoading" class="profile-status">个人资料加载中...</view>
        <view v-else-if="profileError" class="profile-status">
          <text>{{ profileError }}</text>
          <button class="profile-retry" size="mini" @click="loadUserProfile">重新加载</button>
        </view>
        <template v-else>
          <view class="name">
            {{ userInfo.realName || '微信用户' }}
          </view>
          <view class="card-info">
            <text class="card-label">
              就诊卡号
            </text>
            <text class="card-number">
              {{ userInfo.idNumber || '暂无' }}
            </text>
          </view>
        </template>
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
          <!-- <view
            v-if="orderStats.paid > 0"
            class="order-card-badge"
          >
            {{ orderStats.paid }}
          </view> -->
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
          <!-- <view
            v-if="orderStats.cancelled > 0"
            class="order-card-badge"
          >
            {{ orderStats.cancelled }}
          </view> -->
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
      @change="handleTabChange"
    />
  </view>
</template>

<script setup>
import { logPageView, logButtonClick } from '@/utils/accessLog.js'

const PAGE_LOG = { moduleCode: 'USER', accessType: '个人中心', pageType: 'USER_PROFILE', requestUri: '/pages/user/profile', pageId: '' }
import { onShow, onUnload } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { logout } from '@/api/auth.js'
import { fetchAccountProfile } from '@/utils/account.js'
import { endSession, getSessionToken, getSessionGeneration, isCurrentSession } from '@/utils/session.js'
import { getOrderStats } from '@/api/order.js'
import TabBar from '@/components/TabBar/TabBar.vue'
import { openCustomerServiceChat } from '@/utils/customer-service.js'
// 仅用于个人中心展示，不作为共享账号资料或注册表单。
const emptyUserInfo = () => ({
  realName: '',
  idType: '',
  phone: '',
  idNumber: ''
})
const userInfo = ref(emptyUserInfo())
const profileLoading = ref(false)
const profileError = ref('')
let profileRequestSequence = 0
let statsRequestSequence = 0
let pageActive = true

const currentTab = ref('mine')

const orderStats = ref({
  pending: 0,
  paid: 0,
  cancelled: 0,
  refund: 0
})

const loadUserProfile = async () => {
  if (!pageActive) return
  const sequence = ++profileRequestSequence
  const session = getSessionGeneration()
  const isCurrentRequest = () => pageActive && sequence === profileRequestSequence && isCurrentSession(session)
  // 重新进入或重试时立即清空上次展示，接口失败不能冒充资料仍然有效。
  userInfo.value = emptyUserInfo()
  profileLoading.value = true
  profileError.value = ''
  try {
    const userData = await fetchAccountProfile()
    if (!isCurrentRequest()) return
    userInfo.value = {
      realName: userData.userName || '',
      idType: userData.idType || '',
      phone: userData.phone || '',
      idNumber: userData.idCardNo || ''
    }
  } catch (error) {
    if (!isCurrentRequest()) return
    console.error('event=ui_user_profile stage=profile_request result=failed reason=request_failed')
    profileError.value = '个人资料加载失败，请重试'
  } finally {
    if (pageActive && sequence === profileRequestSequence) profileLoading.value = false
  }
}

const handleLogout = async () => {
  const session = getSessionGeneration()
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: async (res) => {
      if (!res.confirm || !isCurrentSession(session)) {
        return
      }

      logButtonClick({ ...PAGE_LOG, actionCode: 'LOGOUT', accessTitle: '确认退出登录', accessDescription: '用户确认退出，即将清除本机登录状态并请求注销凭证' })
      const revocation = logout(getSessionToken())
      endSession()
      const endedGeneration = getSessionGeneration()
      userInfo.value = emptyUserInfo()
      uni.reLaunch({ url: '/pages/register/register' })
      const result = await revocation
      if (!result.confirmed && isCurrentSession(endedGeneration)) {
        uni.showToast({ title: '本机已退出，服务端注销暂未确认', icon: 'none', duration: 3000 })
      }
    }
  })
}

const loadOrderStats = async () => {
  if (!pageActive) return
  const sequence = ++statsRequestSequence
  const session = getSessionGeneration()
  const isCurrentRequest = () => pageActive && sequence === statsRequestSequence && isCurrentSession(session)
  try {
    const stats = (await getOrderStats({ silent: true })) || {}
    if (!isCurrentRequest()) return

    orderStats.value = {
      pending: Number(stats.pending) || 0,
      paid: Number(stats.paid) || 0,
      cancelled: Number(stats.cancelled) || 0,
      refund: Number(stats.refund) || 0
    }
  } catch (error) {
    if (!isCurrentRequest()) return
    console.error('event=ui_user_profile stage=load_order_stats result=failed reason=operation_incomplete')
  }
}

const goToOrderList = () => {
  logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_ORDER_LIST', accessTitle: '查看全部订单', accessDescription: '从个人中心进入全部订单列表' })
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

  logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_ORDER_LIST', accessTitle: `查看${statusMap[status] || '订单'}`, accessDescription: '从个人中心进入指定状态的订单或退款列表', extraData: { status } })

  if (status === 'refund') {
    uni.navigateTo({
      url: '/pages/order/refund_list'
    })
    return
  }

  const statusParamMap = {
    0: 'pending',
    1: 'paid',
    2: 'received',
    3: 'completed',
    4: 'cancelled'
  }

  uni.navigateTo({
    url: `/pages/order/order_list?status=${statusParamMap[status] || 'all'}`
  })
}

const goToAddressList = () => {
  logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_ADDRESS_LIST', accessTitle: '管理收货地址', accessDescription: '从个人中心进入收货地址管理' })
  uni.navigateTo({
    url: '/pages/order/address_list'
  })
}

const goToPatientList = () => {
  logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_PATIENT_LIST', accessTitle: '管理就诊人', accessDescription: '从个人中心进入就诊人管理' })
  uni.navigateTo({
    url: '/pages/user/patient_list'
  })
}

const openHumanCustomerService = () => {
  logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_HUMAN_SERVICE', accessTitle: '选择人工客服', accessDescription: '用户选择人工客服渠道，准备打开客服会话' })
  openCustomerServiceChat()
}

const openAiCustomerService = () => {
  logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_AI_SERVICE', accessTitle: '选择智能客服', accessDescription: '用户选择智能客服渠道，进入智能客服页面' })
  uni.navigateTo({
    url: '/pages/ai/chat'
  })
}

const handleContact = () => {

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

onShow(() => {
  if (!pageActive) return
  logPageView({ ...PAGE_LOG, actionCode: 'VIEW_PAGE', accessTitle: '访问个人中心', accessDescription: '查看个人资料及订单、地址、就诊人与客服入口' })
  loadUserProfile()
  loadOrderStats()
})

onUnload(() => {
  pageActive = false
  profileRequestSequence++
  statsRequestSequence++
})
</script>

<style scoped lang="scss">
.profile-page {
  min-height: 100vh;
  background: #f6f7fb;
  padding-bottom: calc(100rpx + env(safe-area-inset-bottom));
}

.user-header {
  padding: 24rpx 20rpx 0;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  min-width: 0;
  padding: 32rpx 32rpx 30rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
}

.profile-status {
  color: #ffffff;
  font-size: 26rpx;
  line-height: 1.6;
}

.profile-retry {
  margin: 16rpx 0 0;
  color: #357abd;
}

.name {
  font-size: 38rpx;
  font-weight: 600;
  line-height: 1.4;
  color: #ffffff;
  word-break: break-all;
}

.card-info {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  min-width: 0;
}

.card-label {
  flex-shrink: 0;
  font-size: 24rpx;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.74);
}

.card-number {
  flex: 1;
  min-width: 0;
  font-size: 26rpx;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.95);
  font-variant-numeric: tabular-nums;
  word-break: break-all;
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
