<template>
  <view class="auth-page">
    <view class="auth-content">
      <view class="auth-header">
        <view class="auth-title">手机号登录</view>
        <view class="auth-subtitle">验证码登录，继续使用健康服务</view>
      </view>
      <view class="auth-field">
        <uni-icons type="phone" size="18" color="#82929b" class="auth-icon" />
        <input v-model="phone" class="auth-input" type="number" maxlength="11" placeholder="请输入手机号" placeholder-style="color: #929da3" aria-label="手机号" />
      </view>
      <view class="auth-field auth-code-field">
        <uni-icons type="locked" size="18" color="#82929b" class="auth-icon" />
        <input v-model="code" class="auth-input" type="number" maxlength="6" placeholder="请输入验证码" placeholder-style="color: #929da3" aria-label="短信验证码" />
        <button class="auth-code-button" hover-class="auth-pressed" :disabled="sending || countdown > 0" @click="sendCode">{{ countdown > 0 ? countdown + '秒后重发' : sending ? '发送中…' : '获取验证码' }}</button>
      </view>
      <checkbox-group @change="changeAgreement">
        <view class="auth-agreement">
          <label class="auth-checkbox-hit" for="login-agreement">
            <checkbox id="login-agreement" value="agreed" class="auth-checkbox" :checked="agreed" color="#377b9b" aria-label="同意用户服务协议和隐私协议" />
          </label>
          <view class="auth-agreement-text">
            <label for="login-agreement">我已阅读并同意</label>
            <text class="auth-link" @click="showAgreement('用户服务协议')">用户服务协议</text>
            <text class="auth-agreement-separator">和</text>
            <text class="auth-link" @click="showAgreement('用户隐私协议')">用户隐私协议</text>
          </view>
        </view>
      </checkbox-group>
      <view v-if="recoveryUnavailable" class="auth-notice" @click="retryRecovery">登录校验暂不可用，点击重试</view>
      <view class="auth-actions">
        <button class="auth-submit" hover-class="auth-pressed" :disabled="loggingIn || !phone || !code || !agreed" @click="handleLogin">{{ loggingIn ? '登录中…' : '登录' }}</button>
        <button class="auth-switch" hover-class="auth-pressed" :disabled="loggingIn" @click="goRegister(false)">还没有账号？<text class="auth-switch-action">去注册</text></button>
      </view>
    </view>
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

<style lang="scss" scoped>
@import "../../styles/auth.scss";
</style>
