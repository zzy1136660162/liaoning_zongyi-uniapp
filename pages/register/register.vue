<template>
	<view class="register-container">
		<view class="header">
			<view class="title">注册/登录</view>
			<view class="subtitle">未注册用户登录默认注册账号</view>
		</view>
		
		<view class="form-container">
			<!-- 真实姓名 -->
			<view class="input-group">
				<uni-icons type="contact" size="18" color="#666666" class="input-icon"></uni-icons>
				<input 
					class="input-field" 
					type="text" 
					v-model="formData.realName"
					placeholder="请输入真实姓名 (成人)"
					placeholder-style="color: #999999"
				/>
			</view>
			
			<!-- 证件类型和号码 -->
			<view class="input-group">
				<uni-icons type="wallet" size="18" color="#666666" class="input-icon"></uni-icons>
				<picker 
					mode="selector" 
					:range="idTypeList" 
					:value="idTypeIndex"
					@change="onIdTypeChange"
					class="picker-wrapper"
				>
					<view class="picker-display">
						<text class="picker-text">{{ formData.idType || '请选择' }}</text>
						<text class="picker-arrow">v</text>
					</view>
				</picker>
			</view>
			
			<view class="input-group">
				<uni-icons type="paperclip" size="18" color="#666666" class="input-icon"></uni-icons>
				<input 
					class="input-field" 
					type="text" 
					v-model="formData.idNumber"
					placeholder="请输入证件号码"
					placeholder-style="color: #999999"
				/>
			</view>
			
			<!-- 手机号 -->
			<view class="input-group">
				<uni-icons type="phone" size="18" color="#666666" class="input-icon"></uni-icons>
				<input 
					class="input-field" 
					type="number" 
					v-model="formData.phone"
					placeholder="请输入手机号"
					placeholder-style="color: #999999"
					maxlength="11"
				/>
			</view>
			
			<!-- 验证码 -->
			<view class="input-group verify-code-group">
				<uni-icons type="locked" size="18" color="#666666" class="input-icon"></uni-icons>
				<input 
					class="input-field verify-code-input" 
					type="number" 
					v-model="formData.verifyCode"
					placeholder="请输入验证码"
					placeholder-style="color: #999999"
					maxlength="6"
				/>
				<button 
					class="verify-code-btn" 
					:disabled="countdown > 0"
					@click="getVerifyCode"
				>
					{{ countdown > 0 ? `${countdown}秒` : '获取验证码' }}
				</button>
			</view>
			
			<!-- 用户协议 -->
			<view class="agreement-group" @click="toggleAgreement">
				<view class="checkbox" :class="{ checked: isAgreed }">
					<uni-icons v-if="isAgreed" type="checkmarkempty" size="16" color="#ffffff" class="checkbox-icon"></uni-icons>
				</view>
				<text class="agreement-text">
					我已阅读并同意
					<text class="link-text" @click.stop="viewServiceAgreement">用户服务协议</text>
					<text class="link-text" @click.stop="viewPrivacyAgreement">用户隐私协议</text>
				</text>
			</view>
			
			<!-- 登录按钮 -->
      <view
        v-if="waitingForRecovery"
        class="session-notice"
      >
        正在恢复登录，请稍候…
      </view>
      <view
        v-else-if="recoveryUnavailable"
        class="session-notice"
        @click="retryRecovery"
      >
        登录校验暂不可用，点击重试
      </view>
			<button 
				class="login-btn" 
				:class="{ disabled: !canSubmit }"
				:disabled="!canSubmit"
				@click="handleLogin"
			>
				登录
			</button>
		</view>
	</view>
</template>

<script>
import { logPageView, logButtonClick, logAccess, getActionFailureResult } from '@/utils/accessLog.js'
import { STORAGE_KEY_AGREEMENT_ACCEPTED } from '@/utils/storage.js'
import { sendSmsCode, login, getWeChatLoginCode, getWeChatUserProfile } from '@/api/auth.js'
import { establishAccountSession } from '@/utils/account.js'
import { redirectToWithFallback } from '@/utils/navigate.js'
import { beginManualAccountLogin, getAccountSessionState, onAccountSessionState, waitForSessionRecovery, restoreAccountSession } from '@/utils/auth-session.js'
import { assertCurrentSession, getSessionGeneration } from '@/utils/session.js'
import { ID_TYPE_OPTIONS, patientHisSyncNotice } from '@/utils/patient.js'

const PAGE_LOG = { moduleCode: 'AUTH', accessType: '用户登录', pageType: 'REGISTER', requestUri: '/pages/register/register', pageId: '' }

export default {
  onShow() {
    logPageView({ ...PAGE_LOG, actionCode: 'VIEW_PAGE', accessTitle: '访问注册登录页', accessDescription: '进入注册登录页面，准备完成身份验证' })
  },
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
			countdownTimer: null,
			loggingIn: false,
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
			this.redirectUrl = decodeURIComponent(options.redirect || options.redirectUrl)
		}
		this.loadAgreementPreference()
		this.waitingForRecovery = Boolean(waitForSessionRecovery())
		this.recoveryUnavailable = getAccountSessionState().status === 'unavailable'
		this.stopAccountState = onAccountSessionState(this.updateRecoveryState)
		if (getAccountSessionState().status === 'authenticated' && !this.loggingIn) {
			redirectToWithFallback(this.redirectUrl || '/pages/products/medicine_list')
		}
	},
	onUnload() {
		this.stopAccountState?.()
		// 离开页面后停止短信倒计时。
		if (this.countdownTimer) {
			clearInterval(this.countdownTimer)
		}
	},
	methods: {
		updateRecoveryState(state) {
			if (this.waitingForRecovery && !this.loggingIn && state.status === 'authenticated') {
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
			try {
				// 请求短信验证码。
				logButtonClick({ ...PAGE_LOG, actionCode: 'SEND_SMS_CODE', accessTitle: '获取登录验证码', accessDescription: '用户请求发送登录验证码' })
				await sendSmsCode(this.formData.phone)
				assertCurrentSession(smsSession)
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
				if (getSessionGeneration() !== smsSession) return
				logAccess({ ...PAGE_LOG, actionCode: 'SEND_SMS_CODE', accessTitle: '验证码请求未完成', accessDescription: '未取得短信发送受理的明确成功结果', actionType: 'BEHAVIOR', actionResult: getActionFailureResult(error), extraData: { reason: 'sms_request_incomplete' } })
				console.error('event=ui_register_register stage=sms_request result=failed reason=request_failed')
				uni.showToast({
					title: error.message || '发送失败，请重试',
					icon: 'none'
				})
			}
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

		
		// 微信授权与短信身份验证都属于本次页面登录操作。
		async handleLogin() {
			if (!this.canSubmit) {
				uni.showToast({
					title: '请完善所有信息',
					icon: 'none'
				})
				return
			}

			logButtonClick({ ...PAGE_LOG, actionCode: 'LOGIN', accessTitle: '提交注册登录', accessDescription: '用户提交注册登录并进行微信及身份验证' })
			this.loggingIn = true
			this.waitingForRecovery = false
			const finishManualLogin = beginManualAccountLogin()
			const session = getSessionGeneration()
			let expectedSession = session
			try {
				uni.showLoading({ title: '获取微信信息...' })
				
				// 取得一次性微信授权码，不能把本地 openid 当作登录凭证。
				const wechatCode = await getWeChatLoginCode()
				assertCurrentSession(session)
				
				// 微信头像授权可拒绝，身份验证仍按注册表单继续。
				let wechatUserInfo = {}
				try {
					wechatUserInfo = await getWeChatUserProfile()

				} catch (userInfoError) {
					console.error('event=ui_register_register stage=wechat_profile result=failed reason=provider_error')
				}
				assertCurrentSession(session)
				
				uni.showLoading({ title: '登录中...' })
				
				// 本次表单仅用于请求，不写入本地资料或草稿。
				const loginData = {
					wechatCode,
					phone: this.formData.phone,
					code: this.formData.verifyCode,
					userName: this.formData.realName,
					idType: this.formData.idType,
					idCardNo: this.formData.idNumber,
					avatarUrl: wechatUserInfo.avatarUrl || '',
					gender: this.parseGender(wechatUserInfo.gender),
				}
				

				
				// 服务端验证身份后建立新会话，后续页面自行请求资料。
				assertCurrentSession(session)
				const result = await login(loginData)
				assertCurrentSession(session)
				expectedSession = establishAccountSession(result)
				
				logAccess({ ...PAGE_LOG, actionCode: 'LOGIN', accessTitle: '注册登录成功', accessDescription: '服务端已返回有效凭证并建立本次登录会话', actionType: 'BEHAVIOR', actionResult: 'SUCCESS' })
				uni.hideLoading()
				const syncNotice = patientHisSyncNotice(result.hisBindingStatus)
				uni.showToast({
					title: syncNotice || '登录成功',
					icon: syncNotice ? 'none' : 'success',
					duration: syncNotice ? 2500 : 1500
				})
				
				// 延迟跳转只属于本次登录，避免退出或切号后跳回旧流程。
				const signedInSession = expectedSession
				setTimeout(() => {
					if (signedInSession !== getSessionGeneration()) return
					const rawUrl = this.redirectUrl || '/pages/products/medicine_list'
					const targetUrl = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`
					redirectToWithFallback(targetUrl)
				}, syncNotice ? 2500 : 1500)
				
			} catch (error) {
				const failureSession = error?.code === 'SESSION_STORAGE_FAILED' ? error.sessionGeneration : expectedSession
				if (error?.code === 'SESSION_CHANGED' || getSessionGeneration() !== failureSession) return
				logAccess({ ...PAGE_LOG, actionCode: 'LOGIN', accessTitle: '注册登录未完成', accessDescription: '本次登录未取得有效登录完成结果', actionType: 'BEHAVIOR', actionResult: getActionFailureResult(error), extraData: { reason: 'login_incomplete' } })
				console.error('event=ui_register_register stage=login result=failed reason=login_incomplete')
				uni.hideLoading()
				uni.showToast({
					title: error.message || '登录失败，请重试',
					icon: 'none'
				})
			} finally {
				finishManualLogin()
				this.loggingIn = false
			}
		},
		
		// 微信性别：0 未知、1 男、2 女。
		parseGender(wechatGender) {
			if (wechatGender === 1) return 1
			if (wechatGender === 2) return 2
			return 0
		}
	}
}
</script>

<style scoped>
.register-container {
	min-height: 100vh;
	background-color: #ffffff;
	padding: 60rpx 40rpx;
	box-sizing: border-box;
}

.header {
	margin-bottom: 60rpx;
}

.title {
	font-size: 48rpx;
	font-weight: bold;
	color: #333333;
	margin-bottom: 16rpx;
}

.subtitle {
	font-size: 26rpx;
	color: #999999;
}

.form-container {
	width: 100%;
}

.input-group {
	display: flex;
	align-items: center;
	background-color: #f5f5f5;
	border-radius: 12rpx;
	padding: 24rpx 20rpx;
	margin-bottom: 32rpx;
}

.input-icon {
	margin-right: 20rpx;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
}

.input-field {
	flex: 1;
	font-size: 30rpx;
	color: #333333;
}

.picker-wrapper {
	flex: 1;
}

.picker-display {
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
}

.picker-text {
	font-size: 30rpx;
	color: #333333;
}

.picker-arrow {
	font-size: 24rpx;
	color: #999999;
	margin-left: 10rpx;
}

.verify-code-group {
	padding-right: 0;
}

.verify-code-input {
	flex: 1;
	margin-right: 20rpx;
}

.verify-code-btn {
	width: 180rpx;
	height: 64rpx;
	line-height: 64rpx;
	background-color: #87CEEB;
	color: #ffffff;
	font-size: 26rpx;
	border-radius: 8rpx;
	border: none;
	flex-shrink: 0;
	padding: 0;
	margin: 0;
}

.verify-code-btn:disabled {
	background-color: #cccccc;
	color: #999999;
}

.agreement-group {
	display: flex;
	align-items: flex-start;
	margin-bottom: 60rpx;
	padding: 0 10rpx;
}

.checkbox {
	width: 32rpx;
	height: 32rpx;
	border: 2rpx solid #cccccc;
	border-radius: 6rpx;
	margin-right: 16rpx;
	margin-top: 4rpx;
	flex-shrink: 0;
	display: flex;
	justify-content: center;
	align-items: center;
	background-color: #ffffff;
	transition: all 0.3s;
}

.checkbox.checked {
	background-color: #87CEEB;
	border-color: #87CEEB;
}

.checkbox-icon {
	display: flex;
	align-items: center;
	justify-content: center;
}

.agreement-text {
	font-size: 26rpx;
	color: #666666;
	line-height: 1.6;
	flex: 1;
}

.link-text {
	color: #87CEEB;
}

.session-notice {
  padding: 16rpx 0;
  color: #3284ed;
  font-size: 26rpx;
  text-align: center;
}

.login-btn {
	width: 100%;
	height: 88rpx;
	line-height: 88rpx;
	background-color: #87CEEB;
	color: #ffffff;
	font-size: 32rpx;
	font-weight: 500;
	border-radius: 44rpx;
	border: none;
	box-shadow: 0 8rpx 20rpx rgba(135, 206, 235, 0.3);
	transition: all 0.3s;
}

.login-btn.disabled {
	background-color: #cccccc;
	color: #999999;
	box-shadow: none;
}

.login-btn:active:not(.disabled) {
	transform: scale(0.98);
	box-shadow: 0 4rpx 12rpx rgba(135, 206, 235, 0.2);
}
</style>
