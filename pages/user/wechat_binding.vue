<template>
  <view class="binding-page">
    <view class="title">微信绑定管理</view>
    <view class="description">绑定微信后，可在下次打开小程序时自动登录。更换或解除绑定不会修改您的姓名、证件和订单。</view>
    <view v-if="loading" class="description">正在读取绑定状态…</view>
    <view v-else-if="error" class="description">{{ error }}<button @click="loadBinding">重新加载</button></view>
    <template v-else>
      <view class="status">{{ bound ? '账号已绑定微信' : '账号尚未绑定微信' }}</view>
      <view v-if="!smsVerified">
        <view class="description">请验证当前账号手机号：{{ maskedPhone }}</view>
        <input v-model="smsCode" class="field" type="number" maxlength="6" placeholder="请输入短信验证码" aria-label="短信验证码" />
        <button :disabled="busy || sending || countdown > 0" @click="sendCode">{{ countdown > 0 ? countdown + '秒后重发' : '获取验证码' }}</button>
      </view>
      <button class="primary" :disabled="busy || (!smsVerified && !smsCode)" @click="confirmBinding(false)">{{ bound ? '更换为当前微信' : '绑定当前微信' }}</button>
      <button v-if="bound" :disabled="busy || (!smsVerified && !smsCode)" @click="confirmBinding(true)">解除微信绑定</button>
      <button v-if="redirectUrl" :disabled="busy" @click="continueBusiness">继续刚才的操作</button>
    </template>
  </view>
</template>

<script>
import { getWechatBinding, bindWechat, unbindWechat, getWeChatLoginCode, sendSmsCode } from '@/api/auth.js'
import { fetchAccountProfile } from '@/utils/account.js'
import { requireAccountSession, accountReturnPath } from '@/utils/auth-session.js'
import { getSessionGeneration, assertCurrentSession, onSessionChanged } from '@/utils/session.js'
import { STORAGE_KEY_WECHAT_OPENID, STORAGE_KEY_WECHAT_UNIONID } from '@/utils/storage.js'
import { redirectToWithFallback } from '@/utils/navigate.js'
import { logPageView } from '@/utils/accessLog.js'

const PAGE_LOG = { moduleCode: 'AUTH', accessType: '微信绑定', pageType: 'WECHAT_BINDING', requestUri: '/pages/user/wechat_binding', pageId: '' }

export default {
  data() { return { loading: true, error: '', bound: false, smsVerified: false, phone: '', smsCode: '',
    busy: false, sending: false, countdown: 0, timer: null, pageActive: true, redirectUrl: '',
    loadedSession: null, stopSession: null } },
  computed: { maskedPhone() { return this.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') } },
  onLoad(options = {}) {
    if (options.redirect) this.redirectUrl = accountReturnPath(decodeURIComponent(options.redirect))
    this.stopSession = onSessionChanged(() => {
      this.loadedSession = null
      this.phone = ''; this.smsCode = ''; this.bound = false; this.smsVerified = false
      this.error = '登录状态已变化，请重新加载绑定状态'
      clearInterval(this.timer); this.countdown = 0
    })
    this.loadBinding()
  },
  onUnload() { this.pageActive = false; this.stopSession?.(); clearInterval(this.timer); this.smsCode = '' },
  onShow() { logPageView({ ...PAGE_LOG, actionCode: 'VIEW_PAGE', accessTitle: '访问微信绑定页', accessDescription: '查看和管理账号的微信绑定' }) },
  methods: {
    async loadBinding() {
      this.loading = true
      this.error = ''
      if (!(await requireAccountSession('/pages/user/wechat_binding'))) { this.loading = false; return }
      const session = getSessionGeneration()
      try {
        const [profile, binding] = await Promise.all([fetchAccountProfile(), getWechatBinding()])
        assertCurrentSession(session)
        if (!this.pageActive) return
        this.phone = profile.phone
        this.bound = binding.bound
        this.smsVerified = binding.smsVerified
        this.loadedSession = session
      } catch (error) {
        if (this.pageActive && session === getSessionGeneration()) this.error = error.message || '读取失败，请重试'
      } finally { if (this.pageActive) this.loading = false }
    },
    async sendCode() {
      if (this.sending || this.countdown > 0 || this.loadedSession !== getSessionGeneration()) return
      this.sending = true
      const session = getSessionGeneration()
      try {
        await sendSmsCode(this.phone)
        assertCurrentSession(session)
        if (!this.pageActive) return
        this.countdown = 60
        this.timer = setInterval(() => { if (--this.countdown <= 0) clearInterval(this.timer) }, 1000)
      } catch (error) {
        if (this.pageActive && session === getSessionGeneration()) uni.showToast({ title: error.message || '发送失败，请重试', icon: 'none' })
      } finally { this.sending = false }
    },
    confirmBinding(remove) {
      if (this.busy || this.loading || this.loadedSession !== getSessionGeneration()) return
      const session = getSessionGeneration()
      uni.showModal({ title: remove ? '解除绑定' : this.bound ? '更换绑定微信' : '绑定当前微信',
        content: remove ? '解除后，该微信将不能自动登录此账号。确认解除？'
          : this.bound ? '确认将账号绑定到当前微信？原微信将不能自动登录此账号。' : '确认绑定当前微信，方便下次自动登录？',
        success: res => { if (res.confirm && this.pageActive && session === getSessionGeneration()) this.saveBinding(remove) } })
    },
    async saveBinding(remove) {
      if (this.busy || this.loadedSession !== getSessionGeneration()) return
      this.busy = true
      const session = getSessionGeneration()
      try {
        const code = remove ? '' : await getWeChatLoginCode()
        assertCurrentSession(session)
        if (!this.pageActive) return
        await (remove ? unbindWechat : bindWechat)({ code, smsCode: this.smsCode, replace: this.bound, confirmed: true })
        assertCurrentSession(session)
        if (!this.pageActive) return
        this.smsCode = ''
        try {
          uni.removeStorageSync(STORAGE_KEY_WECHAT_OPENID)
          uni.removeStorageSync(STORAGE_KEY_WECHAT_UNIONID)
        } catch (_) { /* 支付使用本次微信 code，缓存清理失败不影响已完成的绑定。 */ }
        await this.loadBinding()
        if (this.pageActive && session === getSessionGeneration()) uni.showToast({ title: remove ? '已解除绑定' : '绑定成功', icon: 'success' })
      } catch (error) {
        if (!this.pageActive || session !== getSessionGeneration() || error.code === 'SESSION_CHANGED') return
        if (Number(error.code) === 428) this.smsVerified = false
        uni.showToast({ title: error.message || '操作未确认，请重新读取绑定状态', icon: 'none', duration: 3000 })
      } finally { this.busy = false }
    },
    continueBusiness() { redirectToWithFallback(this.redirectUrl) }
  }
}
</script>

<style scoped>
.binding-page { padding: 48rpx 36rpx; }
.title { font-size: 40rpx; font-weight: 600; color: #243b4b; }
.description { margin: 24rpx 0; font-size: 28rpx; color: #526570; line-height: 1.8; }
.status { margin: 40rpx 0; font-size: 32rpx; color: #243b4b; }
.field { background: #f4f7f9; height: 96rpx; padding: 0 24rpx; border-radius: 16rpx; margin: 24rpx 0; }
button { margin: 24rpx 0; font-size: 30rpx; }
.primary { background: #2875a8; color: #fff; border-radius: 44rpx; }
</style>
