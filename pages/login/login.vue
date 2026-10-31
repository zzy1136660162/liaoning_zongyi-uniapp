<template>
  <view class="auth-page">
    <view class="title">手机号登录</view>
    <view class="subtitle">登录后继续使用您的订单、就诊人和个人资料</view>
    <input v-model="phone" class="field" type="number" maxlength="11" placeholder="请输入手机号" aria-label="手机号" />
    <view class="sms-row">
      <input v-model="code" class="field" type="number" maxlength="6" placeholder="请输入验证码" aria-label="短信验证码" />
      <button class="sms-button" :disabled="sending || countdown > 0" @click="sendCode">{{ countdown > 0 ? countdown + '秒' : '获取验证码' }}</button>
    </view>
    <checkbox-group @change="changeAgreement">
      <label class="agreement"><checkbox value="agreed" :checked="agreed" color="#2875a8" />我已阅读并同意</label>
    </checkbox-group>
    <view class="agreement-links">
      <text @click="showAgreement('用户服务协议')">用户服务协议</text> 与
      <text @click="showAgreement('用户隐私协议')">用户隐私协议</text>
    </view>
    <view v-if="recoveryUnavailable" class="hint" @click="retryRecovery">登录校验暂不可用，点击重试</view>
    <button class="primary" :disabled="loggingIn || !phone || !code || !agreed" @click="handleLogin">{{ loggingIn ? '登录中…' : '登录' }}</button>
    <button class="secondary" :disabled="loggingIn" @click="goRegister(false)">还没有账号？去注册</button>
  </view>
</template>

<script>
import { login, sendSmsCode } from '@/api/auth.js'
import { establishAccountSession } from '@/utils/account.js'
import { STORAGE_KEY_AGREEMENT_ACCEPTED } from '@/utils/storage.js'
import { getSessionGeneration, assertCurrentSession } from '@/utils/session.js'
import { beginManualAccountLogin, getAccountSessionState, onAccountSessionState, waitForSessionRecovery, restoreAccountSession, accountReturnPath } from '@/utils/auth-session.js'
import { redirectToWithFallback } from '@/utils/navigate.js'
import { logPageView, logAccess } from '@/utils/accessLog.js'

const PAGE_LOG = { moduleCode: 'AUTH', accessType: '用户登录', pageType: 'LOGIN', requestUri: '/pages/login/login', pageId: '' }
export default {
  data() {
    return { phone: '', code: '', agreed: false, countdown: 0, timer: null, sending: false,
      loggingIn: false, pageActive: true, recoveryUnavailable: false, stopAccountState: null,
      redirectUrl: '/pages/products/medicine_list' }
  },
  onLoad(options = {}) {
    if (options.redirect) this.redirectUrl = accountReturnPath(decodeURIComponent(options.redirect))
    this.agreed = uni.getStorageSync(STORAGE_KEY_AGREEMENT_ACCEPTED) === true
    this.stopAccountState = onAccountSessionState(this.updateRecovery)
    this.updateRecovery(getAccountSessionState())
  },
  onShow() {
    this.pageActive = true
    this.updateRecovery(getAccountSessionState())
    logPageView({ ...PAGE_LOG, actionCode: 'VIEW_PAGE', accessTitle: '访问手机号登录页', accessDescription: '进入短信登录页面' })
  },
  onHide() { this.pageActive = false },
  onUnload() {
    this.pageActive = false
    this.stopAccountState?.()
    clearInterval(this.timer)
    this.code = ''
  },
  methods: {
    updateRecovery(state) {
      this.recoveryUnavailable = state.status === 'unavailable'
      if (this.pageActive && !this.loggingIn && state.status === 'authenticated') redirectToWithFallback(this.redirectUrl)
    },
    async retryRecovery() {
      if (this.loggingIn || waitForSessionRecovery()) return
      try { await restoreAccountSession({ retry: true }) }
      catch (error) { if (this.pageActive && error.code !== 'SESSION_CHANGED') uni.showToast({ title: '登录校验暂不可用，请重试', icon: 'none' }) }
    },
    changeAgreement(event) {
      this.agreed = event.detail.value.includes('agreed')
      uni.setStorageSync(STORAGE_KEY_AGREEMENT_ACCEPTED, this.agreed)
    },
    showAgreement(title) { uni.showToast({ title, icon: 'none' }) },
    async sendCode() {
      if (this.sending || this.countdown > 0) return
      if (!/^1[3-9]\d{9}$/.test(this.phone)) return uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
      const session = getSessionGeneration()
      this.sending = true
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
    goRegister(carryCode = false) {
      const phone = this.phone
      const code = carryCode ? this.code : ''
      this.code = ''
      uni.navigateTo({
        url: '/pages/register/register?redirect=' + encodeURIComponent(this.redirectUrl),
        success: res => res.eventChannel.emit('registration-phone', { phone, code })
      })
    },
    async handleLogin() {
      if (this.loggingIn || !this.agreed) return
      if (!/^1[3-9]\d{9}$/.test(this.phone) || !/^\d{6}$/.test(this.code)) {
        return uni.showToast({ title: '请填写正确的手机号和六位验证码', icon: 'none' })
      }
      this.loggingIn = true
      const finish = beginManualAccountLogin()
      let session = getSessionGeneration()
      try {
        const result = await login({ phone: this.phone, code: this.code })
        assertCurrentSession(session)
        if (!this.pageActive) return
        session = establishAccountSession(result)
        this.code = ''
        logAccess({ ...PAGE_LOG, actionCode: 'LOGIN', actionType: 'BEHAVIOR', actionResult: 'SUCCESS', accessTitle: '手机号登录成功', accessDescription: '短信验证后建立账号会话' })
        if (result.wechatOpenid) {
          redirectToWithFallback(this.redirectUrl)
        } else {
          uni.showModal({ title: '登录成功', content: '是否绑定当前微信，方便下次自动登录？',
            confirmText: '去绑定', cancelText: '稍后再说',
            success: res => {
              if (!this.pageActive || session !== getSessionGeneration()) return
              redirectToWithFallback(res.confirm ? '/pages/user/wechat_binding?redirect=' + encodeURIComponent(this.redirectUrl) : this.redirectUrl)
            },
            fail: () => { if (this.pageActive && session === getSessionGeneration()) redirectToWithFallback(this.redirectUrl) }
          })
        }
      } catch (error) {
        const failedSession = error.code === 'SESSION_STORAGE_FAILED' ? error.sessionGeneration : session
        if (!this.pageActive || failedSession !== getSessionGeneration() || error.code === 'SESSION_CHANGED') return
        if (Number(error.code) === 404) {
          uni.showModal({ title: '尚未注册', content: '该手机号尚未注册，请完善资料后使用。', confirmText: '去注册',
            success: res => { if (res.confirm && this.pageActive && session === getSessionGeneration()) this.goRegister(true) } })
        } else uni.showToast({ title: error.message || '登录失败，请重试', icon: 'none' })
      } finally { finish(); this.loggingIn = false }
    }
  }
}
</script>

<style scoped>
.auth-page { padding: 72rpx 40rpx; background: #fff; min-height: 100vh; box-sizing: border-box; }
.title { font-size: 44rpx; font-weight: 600; color: #243b4b; margin-bottom: 18rpx; }
.subtitle { color: #667985; font-size: 26rpx; line-height: 1.7; margin-bottom: 48rpx; }
.field { min-width: 0; height: 96rpx; padding: 0 24rpx; background: #f4f7f9; border-radius: 16rpx; margin-bottom: 24rpx; font-size: 30rpx; }
.sms-row { display: flex; gap: 16rpx; align-items: flex-start; }
.sms-row .field { flex: 1; }
.sms-button { height: 96rpx; line-height: 96rpx; font-size: 26rpx; color: #2875a8; background: #edf5fa; }
.agreement { display: flex; align-items: center; font-size: 26rpx; color: #526570; }
.agreement-links { margin: 12rpx 0 32rpx; font-size: 26rpx; color: #526570; }
.agreement-links text { color: #2875a8; }
.primary { background: #1677ff; color: #fff; border-radius: 44rpx; font-size: 32rpx; margin-top: 28rpx; }
.primary::after { border: 0; }
.primary[disabled] { background: #9db8e8; color: #fff; }
.secondary { color: #2875a8; background: transparent; font-size: 28rpx; margin-top: 24rpx; }
.secondary::after { border: 0; }
.hint { padding: 20rpx 0; color: #2875a8; font-size: 26rpx; }
</style>
