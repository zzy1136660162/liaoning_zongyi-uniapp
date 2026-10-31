<template>
  <view class="auth-page">
    <view class="auth-content">
      <view class="auth-header">
        <view class="auth-title">注册账号</view>
        <view class="auth-subtitle">填写本人资料，注册后即可使用</view>
      </view>
      <view class="auth-field">
        <uni-icons type="contact" size="18" color="#82929b" class="auth-icon" />
        <input v-model="formData.realName" class="auth-input" type="text" placeholder="请输入本人真实姓名（成人）" placeholder-style="color: #929da3" aria-label="本人真实姓名" />
      </view>
      <view class="auth-field">
        <uni-icons type="wallet" size="18" color="#82929b" class="auth-icon" />
        <picker class="auth-picker" mode="selector" :range="idTypeList" :value="idTypeIndex" aria-label="证件类型" @change="onIdTypeChange">
          <view class="auth-picker-display">
            <text>{{ formData.idType || '请选择证件类型' }}</text>
            <uni-icons type="bottom" size="14" color="#929da3" />
          </view>
        </picker>
      </view>
      <view class="auth-field">
        <uni-icons type="paperclip" size="18" color="#82929b" class="auth-icon" />
        <input v-model="formData.idNumber" class="auth-input" type="text" placeholder="请输入证件号码" placeholder-style="color: #929da3" aria-label="证件号码" />
      </view>
      <view class="auth-field">
        <uni-icons type="phone" size="18" color="#82929b" class="auth-icon" />
        <input v-model="formData.phone" class="auth-input" type="number" maxlength="11" placeholder="请输入手机号" placeholder-style="color: #929da3" aria-label="手机号" />
      </view>
      <view class="auth-field auth-code-field">
        <uni-icons type="locked" size="18" color="#82929b" class="auth-icon" />
        <input v-model="formData.verifyCode" class="auth-input" type="number" maxlength="6" placeholder="请输入验证码" placeholder-style="color: #929da3" aria-label="短信验证码" />
        <button class="auth-code-button" hover-class="auth-pressed" :disabled="sendingCode || countdown > 0" @click="getVerifyCode">{{ countdown > 0 ? countdown + '秒后重发' : sendingCode ? '发送中…' : '获取验证码' }}</button>
      </view>
      <checkbox-group @change="toggleAgreement">
        <view class="auth-agreement">
          <label class="auth-checkbox-hit" for="register-agreement">
            <checkbox id="register-agreement" value="agreed" class="auth-checkbox" :checked="isAgreed" color="#377b9b" aria-label="同意用户服务协议和隐私协议" />
          </label>
          <view class="auth-agreement-text">
            <label for="register-agreement">我已阅读并同意</label>
            <text class="auth-link" @click="viewServiceAgreement">用户服务协议</text>
            <text class="auth-agreement-separator">和</text>
            <text class="auth-link" @click="viewPrivacyAgreement">用户隐私协议</text>
          </view>
        </view>
      </checkbox-group>
      <view v-if="waitingForRecovery" class="auth-notice">正在恢复登录，请稍候…</view>
      <view v-else-if="recoveryUnavailable" class="auth-notice" @click="retryRecovery">登录校验暂不可用，点击重试</view>
      <view class="auth-actions">
        <button class="auth-submit" hover-class="auth-pressed" :disabled="!canSubmit" @click="handleLogin">{{ loggingIn ? '注册中…' : '注册并登录' }}</button>
        <button class="auth-switch" hover-class="auth-pressed" :disabled="loggingIn" @click="goToLogin">已有账号？<text class="auth-switch-action">去登录</text></button>
      </view>
    </view>
  </view>
</template>

<script>
import { logPageView, logButtonClick, logAccess, getActionFailureResult } from '@/utils/accessLog.js'
import { STORAGE_KEY_AGREEMENT_ACCEPTED } from '@/utils/storage.js'
import { sendSmsCode, register } from '@/api/auth.js'
import { establishAccountSession } from '@/utils/account.js'
import { redirectToWithFallback } from '@/utils/navigate.js'
import { accountReturnPath } from '@/utils/auth-session.js'
import { beginManualAccountLogin, getAccountSessionState, onAccountSessionState, waitForSessionRecovery, restoreAccountSession } from '@/utils/auth-session.js'
import { assertCurrentSession, getSessionGeneration } from '@/utils/session.js'
import { ID_TYPE_OPTIONS, patientHisSyncNotice } from '@/utils/patient.js'

const PAGE_LOG = { moduleCode: 'AUTH', accessType: '用户登录', pageType: 'REGISTER', requestUri: '/pages/register/register', pageId: '' }

export default {
  onShow() {
    this.pageActive = true
    logPageView({ ...PAGE_LOG, actionCode: 'VIEW_PAGE', accessTitle: '访问注册登录页', accessDescription: '进入注册登录页面，准备完成身份验证' })
  },
  onHide() { this.pageActive = false },
	data() {
		return {
			formData: {
				realName: '',
				idType: '身份证',
				idNumber: '',
				phone: '',
				verifyCode: ''
			},
			idTypeList: ID_TYPE_OPTIONS,
			idTypeIndex: 0,
			isAgreed: false,
			countdown: 0,
			sendingCode: false,
			countdownTimer: null,
			loggingIn: false,
            pageActive: true,
            returnTimer: null,
			waitingForRecovery: false,
			recoveryUnavailable: false,
			stopAccountState: null,
			redirectUrl: '' // 登录成功后的跳转地址
		}
	},
	computed: {
		canSubmit() {
			return !this.loggingIn && this.formData.realName &&
			this.formData.idType &&
			this.formData.idNumber &&
			this.formData.phone &&
			this.formData.verifyCode &&
			this.isAgreed
		}
	},
	onLoad(options) {
		// 保留登录前的业务入口，成功后返回原流程。
		if (options && (options.redirect || options.redirectUrl)) {
			this.redirectUrl = accountReturnPath(decodeURIComponent(options.redirect || options.redirectUrl))
		}
        const channel = this.getOpenerEventChannel?.()
        channel?.on('registration-phone', data => {
          if (this.loggingIn) return
          this.formData.phone = data.phone || ''
          this.formData.verifyCode = data.code || ''
        })
		this.loadAgreementPreference()
		this.waitingForRecovery = Boolean(waitForSessionRecovery())
		this.recoveryUnavailable = getAccountSessionState().status === 'unavailable'
		this.stopAccountState = onAccountSessionState(this.updateRecoveryState)
		if (getAccountSessionState().status === 'authenticated' && !this.loggingIn) {
			redirectToWithFallback(this.redirectUrl || '/pages/products/medicine_list')
		}
	},
	onUnload() {
        this.pageActive = false
        clearTimeout(this.returnTimer)
        this.formData.verifyCode = ''
		this.stopAccountState?.()
		// 离开页面后停止短信倒计时。
		if (this.countdownTimer) {
			clearInterval(this.countdownTimer)
		}
	},
	methods: {
		updateRecoveryState(state) {
			if (this.pageActive && this.waitingForRecovery && !this.loggingIn && state.status === 'authenticated') {
				this.waitingForRecovery = false
				redirectToWithFallback(this.redirectUrl || '/pages/products/medicine_list')
			}
			this.waitingForRecovery = ['checking', 'recovering'].includes(state.status)
			this.recoveryUnavailable = state.status === 'unavailable'
		},
		async retryRecovery() {
			if (this.loggingIn || this.waitingForRecovery) return
			try { await restoreAccountSession({ retry: true }) }
			catch (error) {
				if (error.code !== 'SESSION_CHANGED') uni.showToast({ title: '登录校验暂不可用，请稍后重试', icon: 'none' })
			}
		},
		// 仅恢复设备上的协议偏好，姓名、证件和手机号不保存草稿。
		loadAgreementPreference() {
			try {
				this.isAgreed = uni.getStorageSync(STORAGE_KEY_AGREEMENT_ACCEPTED) === true
			} catch (e) {
				console.error('event=ui_register_register stage=agreement_read result=failed reason=storage_error')
			}
		},
		
		// 按原证件类型提交，不转换成其他类型。
		onIdTypeChange(e) {
			this.idTypeIndex = e.detail.value
			const idType = this.idTypeList[this.idTypeIndex]
			this.formData.idType = ID_TYPE_OPTIONS.includes(idType) ? idType : ''
		},
		
		// 通过短信验证注册手机号。
		async getVerifyCode() {
			if (this.sendingCode || this.countdown > 0) return
			// 先检查手机号，避免发送无效请求。
			if (!this.formData.phone) {
				uni.showToast({
					title: '请输入手机号',
					icon: 'none'
				})
				return
			}
			
			const phoneReg = /^1[3-9]\d{9}$/
			if (!phoneReg.test(this.formData.phone)) {
				uni.showToast({
					title: '请输入正确的手机号',
					icon: 'none'
				})
				return
			}
			
			const smsSession = getSessionGeneration()
			this.sendingCode = true
			try {
				// 请求短信验证码。
				logButtonClick({ ...PAGE_LOG, actionCode: 'SEND_SMS_CODE', accessTitle: '获取登录验证码', accessDescription: '用户请求发送登录验证码' })
				await sendSmsCode(this.formData.phone)
				assertCurrentSession(smsSession)
				if (!this.pageActive) return
				logAccess({ ...PAGE_LOG, actionCode: 'SEND_SMS_CODE', accessTitle: '验证码请求已受理', accessDescription: '短信服务已受理发送请求，不代表用户已收到短信', actionType: 'BEHAVIOR', actionResult: 'SUCCESS' })
				
				// 当前会话发送成功后开始倒计时。
				this.countdown = 60
				this.countdownTimer = setInterval(() => {
					this.countdown--
					if (this.countdown <= 0) {
						clearInterval(this.countdownTimer)
						this.countdownTimer = null
					}
				}, 1000)
				
			} catch (error) {
				if (!this.pageActive || getSessionGeneration() !== smsSession) return
				logAccess({ ...PAGE_LOG, actionCode: 'SEND_SMS_CODE', accessTitle: '验证码请求未完成', accessDescription: '未取得短信发送受理的明确成功结果', actionType: 'BEHAVIOR', actionResult: getActionFailureResult(error), extraData: { reason: 'sms_request_incomplete' } })
				console.error('event=ui_register_register stage=sms_request result=failed reason=request_failed')
				uni.showToast({
					title: error.message || '发送失败，请重试',
					icon: 'none'
				})
			} finally { this.sendingCode = false }
		},
		
		// 协议勾选是设备偏好，不与个人资料或登录状态混存。
		toggleAgreement() {
			this.isAgreed = !this.isAgreed
			try {
				uni.setStorageSync(STORAGE_KEY_AGREEMENT_ACCEPTED, this.isAgreed)
			} catch (e) {
				console.error('event=ui_register_register stage=agreement_write result=failed reason=storage_error')
			}
		},
		
		// 查看用户服务协议。
		viewServiceAgreement() {
			uni.showToast({
				title: '用户服务协议',
				icon: 'none'
			})

		},
		
		// 查看用户隐私协议。
		viewPrivacyAgreement() {
			uni.showToast({
				title: '用户隐私协议',
				icon: 'none'
			})

		},

		
		// 注册表单只用于创建账号，微信绑定在注册成功后单独确认。
		async handleLogin() {
			if (!this.canSubmit) {
				uni.showToast({
					title: '请完善所有信息',
					icon: 'none'
				})
				return
			}

			logButtonClick({ ...PAGE_LOG, actionCode: 'LOGIN', accessTitle: '提交注册登录', accessDescription: '用户提交注册资料及短信验证' })
			this.loggingIn = true
			this.waitingForRecovery = false
			const finishManualLogin = beginManualAccountLogin()
			const session = getSessionGeneration()
			let expectedSession = session
			try {
                uni.showLoading({ title: '注册中...' })
                const loginData = {
                    phone: this.formData.phone,
                    code: this.formData.verifyCode,
                    userName: this.formData.realName,
                    idType: this.formData.idType,
                    idCardNo: this.formData.idNumber
                }

				// 服务端验证身份后建立新会话，后续页面自行请求资料。
				assertCurrentSession(session)
				const result = await register(loginData)
				assertCurrentSession(session)
				if (!this.pageActive) return
				expectedSession = establishAccountSession(result)
                this.formData.verifyCode = ''
				
				logAccess({ ...PAGE_LOG, actionCode: 'LOGIN', accessTitle: '注册登录成功', accessDescription: '服务端已返回有效凭证并建立本次登录会话', actionType: 'BEHAVIOR', actionResult: 'SUCCESS' })
				uni.hideLoading()
				const syncNotice = patientHisSyncNotice(result.hisBindingStatus)
				uni.showToast({
					title: syncNotice || '注册成功',
					icon: syncNotice ? 'none' : 'success',
					duration: syncNotice ? 2500 : 1500
				})
				
				// 延迟跳转只属于本次登录，避免退出或切号后跳回旧流程。
				const signedInSession = expectedSession
				this.returnTimer = setTimeout(() => {
					if (!this.pageActive || signedInSession !== getSessionGeneration()) return
					this.continueAfterRegistration()
				}, syncNotice ? 2500 : 1500)
				
			} catch (error) {
				const failureSession = error?.code === 'SESSION_STORAGE_FAILED' ? error.sessionGeneration : expectedSession
				if (!this.pageActive || error?.code === 'SESSION_CHANGED' || getSessionGeneration() !== failureSession) return
				logAccess({ ...PAGE_LOG, actionCode: 'LOGIN', accessTitle: '注册登录未完成', accessDescription: '本次登录未取得有效登录完成结果', actionType: 'BEHAVIOR', actionResult: getActionFailureResult(error), extraData: { reason: 'login_incomplete' } })
				console.error('event=ui_register_register stage=login result=failed reason=login_incomplete')
				uni.hideLoading()
				uni.showToast({
					title: error.message || '注册失败，请重试',
					icon: 'none'
				})
			} finally {
				finishManualLogin()
				this.loggingIn = false
			}
		},
		
        continueAfterRegistration() {
          const session = getSessionGeneration()
          const target = this.redirectUrl || '/pages/products/medicine_list'
          uni.showModal({ title: '注册成功', content: '是否绑定当前微信，方便下次自动登录？',
            confirmText: '去绑定', cancelText: '稍后再说',
            success: res => {
              if (!this.pageActive || session !== getSessionGeneration()) return
              redirectToWithFallback(res.confirm ? `/pages/user/wechat_binding?redirect=${encodeURIComponent(target)}` : target)
            }, fail: () => { if (this.pageActive && session === getSessionGeneration()) redirectToWithFallback(target) } })
        },
        goToLogin() {
          redirectToWithFallback(`/pages/login/login?redirect=${encodeURIComponent(this.redirectUrl || '/pages/products/medicine_list')}`)
        },
	}
}
</script>

<style lang="scss" scoped>
@import "../../styles/auth.scss";
</style>
