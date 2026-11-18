<template>
  <view class="profile-page">
    <view class="masthead">
      <image
        class="herb"
        src="/static/profile/herb.svg"
        mode="aspectFit"
        aria-hidden="true"
      />
      <view class="identity">
        <view class="avatar">
          <image
            v-if="userInfo.avatar"
            class="avatar-photo"
            :src="userInfo.avatar"
            mode="aspectFill"
            @error="userInfo.avatar = ''"
          />
          <image
            v-else
            class="avatar-symbol"
            src="/static/profile/avatar.svg"
            mode="aspectFit"
          />
        </view>
        <view class="account">
          <text class="institution">
            {{ hospitalName }}
          </text>
          <text
            v-if="profileLoading"
            class="account-name"
          >
            正在加载资料…
          </text>
          <button
            v-else-if="profileError"
            class="plain identity-action"
            @click="loadUserProfile"
          >
            资料加载失败，重试 ›
          </button>
          <button
            v-else-if="!isLoggedIn"
            class="plain identity-action"
            @click="goToLogin"
          >
            登录账号 ›
          </button>
          <template v-else>
            <text class="account-name">
              {{ userInfo.realName || '已登录用户' }}
            </text>
            <text
              v-if="userInfo.phone"
              class="account-phone"
            >
              {{ userInfo.phone }}
            </text>
          </template>
        </view>
      </view>
      <view
        v-if="isLoggedIn"
        class="patient-strip"
      >
        <view class="card-emblem">
          <image
            src="/static/profile/patient.svg"
            class="card-icon"
          />
        </view>
        <view class="patient-info">
          <text class="card-label">
            当前就诊人
          </text>
          <text
            v-if="patientLoading"
            class="patient-name"
          >
            正在加载…
          </text>
          <text
            v-else-if="patientError"
            class="patient-name"
          >
            就诊人加载失败
          </text>
          <text
            v-else-if="currentPatient"
            class="patient-name"
          >
            {{ currentPatient.name }}
          </text>
          <text
            v-else
            class="patient-name"
          >
            {{ patientRows.length ? '请选择就诊人' : '尚未添加就诊人' }}
          </text>
          <text
            v-if="currentPatient"
            class="patient-record-number"
          >
            病历号 {{ currentPatient.hisOutpNo || '暂无' }}
          </text>
        </view>
        <view
          v-if="!patientLoading"
          class="patient-actions"
        >
          <button
            v-if="patientError"
            class="plain card-action"
            @click="loadPatients"
          >
            重试
          </button>
          <picker
            v-if="!patientError && patientRows.length > 1"
            mode="selector"
            :range="pickerRows"
            range-key="pickerLabel"
            :value="Math.max(0, patientRows.indexOf(currentPatient))"
            @change="selectCurrentPatient"
          >
            <button class="plain card-action">
              {{ currentPatient ? '切换' : '选择' }}
            </button>
          </picker>
          <button
            class="plain card-action"
            @click="goToPatientList"
          >
            {{ patientError || patientRows.length ? '管理' : '去添加' }}
          </button>
        </view>
      </view>
    </view>

    <view class="sheet orders">
      <view class="section-heading">
        <text class="section-name">
          我的订单
        </text>
        <button
          class="plain all-orders"
          @click="goToOrderList"
        >
          全部订单 <text class="chevron" />
        </button>
      </view>
      <view class="order-grid">
        <button
          v-for="item in orders"
          :key="item.icon"
          class="plain order-entry"
          @click="goToOrderListByStatus(item.status)"
        >
          <view class="order-image">
            <image
              class="order-icon"
              :src="'/static/profile/' + item.icon + '.svg'"
            />
            <text
              v-if="item.count && orderStats[item.count] > 0"
              class="badge"
            >
              {{ orderStats[item.count] > 99 ? '99+' : orderStats[item.count] }}
            </text>
          </view>
          <text>{{ item.name }}</text>
        </button>
      </view>
    </view>

    <view class="sheet services">
      <view class="section-heading">
        <text class="section-name">
          我的服务
        </text>
      </view>
      <button
        v-for="item in services"
        :key="item.icon"
        class="plain service-row"
        @click="openService(item.icon)"
      >
        <image
          class="row-icon"
          :src="'/static/profile/' + item.icon + '.svg'"
        />
        <view class="row-body">
          <text>{{ item.name }}</text><text class="chevron" />
        </view>
      </button>
      <button
        v-if="isLoggedIn"
        class="plain service-row"
        @click="goToWechatBinding"
      >
        <image
          class="row-icon"
          src="/static/profile/binding.svg"
        />
        <view class="row-body">
          <text>微信绑定管理</text><text class="chevron" />
        </view>
      </button>
    </view>
    <button
      v-if="isLoggedIn"
      class="plain logout"
      @click="handleAuthAction"
    >
      退出登录
    </button>
    <TabBar current="mine" />
  </view>
</template>

<script setup>
import { logPageView, logButtonClick } from '@/utils/accessLog.js'

import { onShow, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { logout } from '@/api/auth.js'
import { fetchAccountProfile } from '@/utils/account.js'
import { waitForSessionRecovery, requireAccountSession } from '@/utils/auth-session.js'
import { endSession, getSessionToken, getSessionGeneration, isCurrentSession } from '@/utils/session.js'
import { getPatientList } from '@/api/patient.js'
import { preferredPatient } from '@/utils/patient.js'
import { STORAGE_KEY_CURRENT_PATIENT_ID } from '@/utils/storage.js'
import { getImageUrl, HOSPITAL_NAME as hospitalName } from '@/utils/config.js'
import { getOrderStats } from '@/api/order.js'
import TabBar from '@/components/TabBar/TabBar.vue'
import { openCustomerServiceChat } from '@/utils/customer-service.js'
const PAGE_LOG = { moduleCode: 'USER', accessType: '个人中心', pageType: 'USER_PROFILE', requestUri: '/pages/user/profile', pageId: '' }
// 仅用于个人中心展示，不作为共享账号资料或注册表单。
const emptyUserInfo = () => ({
  realName: '',
  phone: '',
  avatar: ''
})
const userInfo = ref(emptyUserInfo())
const isLoggedIn = ref(Boolean(getSessionToken()))
const profileLoading = ref(false)
const profileError = ref('')
let profileRequestSequence = 0
let statsRequestSequence = 0
let pageActive = true

const patientRows = ref([])
const currentPatient = ref(null)
// 未选择时保留占位项，确认首位就诊人也会触发选择变更。
const pickerRows = computed(() => currentPatient.value
  ? patientRows.value
  : [{ pickerLabel: '请选择就诊人' }, ...patientRows.value])
const patientError = ref(false)
const patientLoading = ref(false)
let patientRequestSequence = 0
let patientListSession = null

// 返回个人中心时重新核对本账号的就诊人列表，已删除的记录不能继续显示。
const loadPatients = async () => {
  const request = ++patientRequestSequence
  const session = getSessionGeneration()
  const current = () => pageActive && request === patientRequestSequence && isCurrentSession(session)
  patientRows.value = []
  currentPatient.value = null
  patientError.value = false
  patientLoading.value = true
  try {
    const recovery = waitForSessionRecovery()
    if (recovery) await recovery
    if (!current() || !getSessionToken()) return
    const rows = await getPatientList({ silent: true })
    if (!current()) return
    if (!Array.isArray(rows)) throw new Error('就诊人列表返回异常')
    patientRows.value = rows.map(row => ({
      ...row,
      pickerLabel: [row.name, row.idNumberMasked].filter(Boolean).join(' · ')
    }))
    patientListSession = session
    currentPatient.value = preferredPatient(patientRows.value)
  } catch (_) {
    if (current()) patientError.value = true
  } finally {
    if (pageActive && request === patientRequestSequence) patientLoading.value = false
  }
}

const selectCurrentPatient = event => {
  const patient = pickerRows.value[Number(event.detail.value)]
  if (!patient?.id || !getSessionToken() || !isCurrentSession(patientListSession)) return
  try {
    uni.setStorageSync(STORAGE_KEY_CURRENT_PATIENT_ID, String(patient.id))
    currentPatient.value = patient
  } catch (_) {
    uni.showToast({ title: '未能保存就诊人，请重试', icon: 'none' })
  }
}

const openAccountPage = async url => {
  if (await requireAccountSession(url)) uni.navigateTo({ url })
}

const orders = [
  { name: '待支付', icon: 'wallet', status: 0, count: 'pending' },
  { name: '待收货', icon: 'parcel', status: 2 },
  { name: '待使用', icon: 'ticket', status: 'unused' },
  { name: '已取消', icon: 'cancel', status: 4 },
  { name: '退款/售后', icon: 'refund', status: 'refund', count: 'refund' }
]

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
  // 重新进入或重试时清空上次展示，接口失败不能冒充资料仍然有效。
  userInfo.value = emptyUserInfo()
  profileError.value = ''
  const recovery = waitForSessionRecovery({ retryUnavailable: true })
  if (recovery) {
    profileLoading.value = true
    try { await recovery } catch (error) {
      if (isCurrentRequest()) profileError.value = error.message || '登录校验暂不可用，请重试'
      if (pageActive && sequence === profileRequestSequence) profileLoading.value = false
      return
    }
    if (!isCurrentRequest()) {
      if (pageActive && sequence === profileRequestSequence) {
        profileLoading.value = false
        isLoggedIn.value = Boolean(getSessionToken())
      }
      return
    }
  }
  isLoggedIn.value = Boolean(getSessionToken())
  profileLoading.value = false
  if (!isLoggedIn.value) return
  profileLoading.value = true
  try {
    const userData = await fetchAccountProfile()
    if (!isCurrentRequest()) return
    userInfo.value = {
      realName: userData.userName || '',
      phone: (userData.phone || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2'),
      avatar: getImageUrl(userData.avatarUrl || '')
    }
  } catch (error) {
    if (!isCurrentRequest()) return
    console.error('event=ui_user_profile stage=profile_request result=failed reason=request_failed')
    profileError.value = '个人资料加载失败，请重试'
  } finally {
    if (pageActive && sequence === profileRequestSequence) profileLoading.value = false
  }
}

const goToLogin = () => {
  const recovery = waitForSessionRecovery()
  if (recovery) {
    recovery.then(() => { if (pageActive) goToLogin() }).catch(error => {
      if (pageActive && error.code !== 'SESSION_CHANGED') uni.showToast({ title: error.message, icon: 'none' })
    })
    return
  }
  if (getSessionToken()) return
  logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_LOGIN', accessTitle: '去登录', accessDescription: '从个人中心进入登录页，完成后返回个人中心' })
  uni.navigateTo({ url: `/pages/login/login?redirect=${encodeURIComponent('/pages/user/profile')}` })
}

const goToWechatBinding = () => {
  if (!getSessionToken()) return goToLogin()
  uni.navigateTo({ url: '/pages/user/wechat_binding' })
}

const handleAuthAction = () => {
  if (!getSessionToken()) {
    goToLogin()
    return
  }
  handleLogout()
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
      isLoggedIn.value = false
      userInfo.value = emptyUserInfo()
      uni.reLaunch({ url: '/pages/login/login' })
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
  const recovery = waitForSessionRecovery()
  if (recovery) {
    try { await recovery } catch (_) { return }
    if (!pageActive || sequence !== statsRequestSequence || !isCurrentSession(session)) return
  }
  if (!getSessionToken()) {
    orderStats.value = { pending: 0, paid: 0, cancelled: 0, refund: 0 }
    return
  }
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
    2: '待收货',
    4: '已取消',
    unused: '待使用',
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
    2: 'received',
    3: 'completed',
    4: 'cancelled',
    unused: 'unused'
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
  openAccountPage('/pages/user/patient_list')
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

const services = [
  { name: '我的收藏', icon: 'favorite', open: () => openAccountPage('/pages/favorites/index') },
  { name: '问题反馈', icon: 'feedback', open: () => openAccountPage('/pages/feedback/index') },
  { name: '收货地址', icon: 'address', open: goToAddressList },
  { name: '联系客服', icon: 'headset', open: handleContact }
]

const openService = icon => services.find(item => item.icon === icon)?.open()

onShow(() => {
  if (!pageActive) return
  logPageView({ ...PAGE_LOG, actionCode: 'VIEW_PAGE', accessTitle: '访问个人中心', accessDescription: '查看个人资料及订单、地址、就诊人与客服入口' })
  loadUserProfile()
  loadPatients()
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
  box-sizing: border-box;
  padding-bottom: calc(132rpx + env(safe-area-inset-bottom));
  color: $mini-text;
  background: $mini-page;
}
.plain {
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  line-height: 1.45;
  text-align: left;
}
.plain::after { border: none; }
.masthead {
  position: relative;
  overflow: hidden;
  padding: 0 28rpx 22rpx;
  background: $mini-header-bg;
}
.herb {
  position: absolute;
  top: 0;
  right: -10rpx;
  width: 310rpx;
  height: 205rpx;
  pointer-events: none;
}
.identity {
  position: relative;
  display: flex;
  align-items: center;
  gap: 24rpx;
  min-height: 184rpx;
  padding: 14rpx 8rpx;
  box-sizing: border-box;
}
.avatar {
  width: 100rpx;
  height: 100rpx;
  box-sizing: border-box;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid $mini-surface;
  border-radius: 50%;
  background: $mini-primary-soft;
  box-shadow: 0 3rpx 14rpx rgba($mini-text, .1);
  overflow: hidden;
}
.avatar-photo { width: 100%; height: 100%; }
.avatar-symbol { width: 63rpx; height: 63rpx; }
.account, .patient-info { display: flex; flex: 1; min-width: 0; flex-direction: column; }
.institution { font-size: 22rpx; letter-spacing: 2rpx; color: $mini-text-muted; }
.account-name, .identity-action { font-size: 41rpx; line-height: 1.45; font-weight: 600; }
.identity-action { color: $mini-primary-pressed; }
.account-name, .patient-name, .account-phone, .patient-record-number { overflow-wrap: anywhere; word-break: break-all; }
.account-phone { margin-top: 2rpx; font-size: 24rpx; color: $mini-text-muted; letter-spacing: 1rpx; }
.patient-strip {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 16rpx 12rpx 18rpx;
  border: 1rpx solid $mini-primary-border;
  border-radius: 16rpx;
  background: $mini-surface;
}
.card-emblem { display: flex; align-items: center; justify-content: center; flex: none; width: 52rpx; height: 52rpx; border-radius: 12rpx; background: $mini-primary-soft; }
.card-icon { width: 39rpx; height: 39rpx; }
.card-label { font-size: 22rpx; color: $mini-text-muted; }
.patient-name { font-size: 29rpx; font-weight: 600; }
.patient-record-number { font-size: 22rpx; color: $mini-text-muted; }
.patient-actions { display: flex; align-items: center; gap: 4rpx; flex: none; }
.card-action { display: flex; align-items: center; justify-content: center; min-height: 88rpx; min-width: 88rpx; padding: 0 8rpx; font-size: 25rpx; color: $mini-primary; }
.patient-actions picker .card-action { font-weight: 600; }
.sheet { background: $mini-surface; padding: 0 34rpx; }
.section-heading { display: flex; justify-content: space-between; align-items: center; min-height: 93rpx; }
.section-name { font-size: 32rpx; font-weight: 600; letter-spacing: 1rpx; }
.all-orders { display: flex; align-items: center; gap: 12rpx; min-height: 82rpx; font-size: 24rpx; color: $mini-primary; }
.chevron { display: inline-block; width: 10rpx; height: 10rpx; border-top: 2rpx solid $mini-decoration; border-right: 2rpx solid $mini-decoration; transform: rotate(45deg); margin-right: 4rpx; }
.order-grid { display: flex; padding: 5rpx 0 27rpx; }
.order-entry { flex: 1; display: flex; align-items: center; flex-direction: column; gap: 12rpx; padding: 8rpx 0; font-size: 26rpx; }
.order-image { position: relative; width: 52rpx; height: 52rpx; }
.order-icon { display: block; width: 100%; height: 100%; }
.badge { position: absolute; left: 78%; top: -8rpx; padding: 0 7rpx; min-width: 25rpx; box-sizing: border-box; border: 2rpx solid $mini-surface; border-radius: 20rpx; background: $mini-danger-text; color: $mini-surface; font-size: 18rpx; line-height: 26rpx; text-align: center; }
.services { margin-top: 16rpx; }
.services .section-heading { min-height: 86rpx; }
.service-row, .row-body { display: flex; align-items: center; }
.service-row { width: 100%; gap: 25rpx; }
.row-icon { width: 43rpx; height: 43rpx; flex: none; }
.row-body { flex: 1; justify-content: space-between; min-height: 92rpx; font-size: 29rpx; border-bottom: 1rpx solid $mini-border; }
.service-row:last-child .row-body { border-bottom: none; }
.logout { margin: 18rpx 0 0; width: 100%; text-align: center; line-height: 87rpx; font-size: 26rpx; color: $mini-text-muted; background: $mini-surface; }
.order-entry:active, .service-row:active, .all-orders:active, .card-action:active { opacity: .65; }
</style>
