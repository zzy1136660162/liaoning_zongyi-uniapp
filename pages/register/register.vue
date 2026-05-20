<template>
	<view class="register-container">
		<view class="header">
			<view class="title">注册/登录</view>
			<view class="subtitle">未注册用户登录默认注册账号</view>
		</view>
		
		<view class="form-container">
			<!-- 鐪熷疄濮撳悕 -->
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
			
			<!-- 璇佷欢绫诲瀷鍜屽彿鐮?-->
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
						<text class="picker-text">{{ formData.idType || '身份证' }}</text>
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
			
			<!-- 鎵嬫満鍙?-->
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
			
			<!-- 楠岃瘉鐮?-->
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
			
			<!-- 鐢ㄦ埛鍗忚 -->
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
			
			<!-- 鐧诲綍鎸夐挳 -->
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
import { 
	STORAGE_KEY_USER_REGISTER,
	STORAGE_KEY_AGREEMENT_ACCEPTED,
	STORAGE_KEY_USER_INFO,
	STORAGE_KEY_USER_LOGIN_STATUS
} from '@/utils/storage.js'
import { sendSmsCode, login, ensureWeChatIdentity, getWeChatUserProfile } from '@/api/auth.js'
import { saveToken } from '@/utils/request.js'
import { logPageView } from '@/api/access-log.js'

export default {
	data() {
		return {
			formData: {
				realName: '',
				idType: '身份证',
				idNumber: '',
				phone: '',
				verifyCode: ''
			},
			idTypeList: ['身份证', '护照', '港澳通行证', '台胞证', '军官证', '士兵证', '户口簿', '出生医学证明', '外国人居留证'],
			idTypeIndex: 0,
			isAgreed: false,
			countdown: 0,
			countdownTimer: null,
			redirectUrl: '' // 登录成功后的跳转地址
		}
	},
	computed: {
		canSubmit() {
			return this.formData.realName &&
			this.formData.idType &&
			this.formData.idNumber &&
			this.formData.phone &&
			this.formData.verifyCode &&
			this.isAgreed
		}
	},
	onLoad(options) {
		// 鎺ユ敹 redirect 鍙傛暟
		if (options && options.redirect) {
			this.redirectUrl = decodeURIComponent(options.redirect)
		}
		// 鍔犺浇宸蹭繚瀛樼殑娉ㄥ唽淇℃伅
		this.loadSavedData()

		// 璁板綍椤甸潰璁块棶鏃ュ織
		logPageView('注册页面', '用户进入注册页面')
	},
	onUnload() {
		// 娓呴櫎鍊掕鏃跺畾鏃跺櫒
		if (this.countdownTimer) {
			clearInterval(this.countdownTimer)
		}
	},
	methods: {
		// 鍔犺浇宸蹭繚瀛樼殑鏁版嵁
		loadSavedData() {
			try {
				const savedData = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
				if (savedData) {
					this.formData = { ...this.formData, ...savedData }
					// 鎭㈠璇佷欢绫诲瀷绱㈠紩
					const index = this.idTypeList.indexOf(savedData.idType)
					if (index !== -1) {
						this.idTypeIndex = index
					}
				}
				
				// 鍔犺浇鍗忚鍚屾剰鐘舵€?
				const agreementStatus = uni.getStorageSync(STORAGE_KEY_AGREEMENT_ACCEPTED)
				if (agreementStatus) {
					this.isAgreed = agreementStatus
				}
			} catch (e) {
				console.error('鍔犺浇淇濆瓨鏁版嵁澶辫触:', e)
			}
		},
		
		// 淇濆瓨琛ㄥ崟鏁版嵁
		saveFormData() {
			try {
				uni.setStorageSync(STORAGE_KEY_USER_REGISTER, this.formData)
				uni.setStorageSync(STORAGE_KEY_AGREEMENT_ACCEPTED, this.isAgreed)
			} catch (e) {
				console.error('淇濆瓨鏁版嵁澶辫触:', e)
			}
		},
		
		// 璇佷欢绫诲瀷閫夋嫨
		onIdTypeChange(e) {
			this.idTypeIndex = e.detail.value
			this.formData.idType = this.idTypeList[this.idTypeIndex]
			this.saveFormData()
		},
		
		// 鑾峰彇楠岃瘉鐮?
		async getVerifyCode() {
			// 楠岃瘉鎵嬫満鍙?
			if (!this.formData.phone) {
				uni.showToast({
					title: '请输入手机号',
					icon: 'none'
				})
				return
			}
			
			// 楠岃瘉鎵嬫満鍙锋牸寮?
			const phoneReg = /^1[3-9]\d{9}$/
			if (!phoneReg.test(this.formData.phone)) {
				uni.showToast({
					title: '请输入正确的手机号',
					icon: 'none'
				})
				return
			}
			
			try {
				// 鉁?璋冪敤鍚庣API鍙戦€侀獙璇佺爜
				await sendSmsCode(this.formData.phone)
				
				// 寮€濮嬪€掕鏃?
				this.countdown = 60
				this.countdownTimer = setInterval(() => {
					this.countdown--
					if (this.countdown <= 0) {
						clearInterval(this.countdownTimer)
						this.countdownTimer = null
					}
				}, 1000)
				
			} catch (error) {
				console.error('发送验证码失败:', error)
				uni.showToast({
					title: error.message || '发送失败，请重试',
					icon: 'none'
				})
			}
		},
		
		// 鍒囨崲鍗忚鍚屾剰鐘舵€?
		toggleAgreement() {
			this.isAgreed = !this.isAgreed
			this.saveFormData()
		},
		
		// 鏌ョ湅鐢ㄦ埛鏈嶅姟鍗忚
		viewServiceAgreement() {
			uni.showToast({
				title: '用户服务协议',
				icon: 'none'
			})

		},
		
		// 鏌ョ湅鐢ㄦ埛闅愮鍗忚
		viewPrivacyAgreement() {
			uni.showToast({
				title: '用户隐私协议',
				icon: 'none'
			})

		},

		
		// 澶勭悊鐧诲綍
		async handleLogin() {
			if (!this.canSubmit) {
				uni.showToast({
					title: '请完善所有信息',
					icon: 'none'
				})
				return
			}

			try {
				uni.showLoading({ title: '获取微信信息...' })
				
				// 1. 获取微信 openid / unionid，支付链路依赖该信息
				const wechatInfo = await ensureWeChatIdentity()
				
				// 2. 灏濊瘯鑾峰彇寰俊鐢ㄦ埛淇℃伅锛堝ご鍍忋€佹樀绉帮級
				let wechatUserInfo = {}
				try {
					wechatUserInfo = await getWeChatUserProfile()

				} catch (userInfoError) {
					console.error('鑾峰彇寰俊鐢ㄦ埛淇℃伅澶辫触:', userInfoError)
					// 鐢ㄦ埛鍙兘鎷掔粷鎺堟潈锛屼笉褰卞搷鐧诲綍
				}
				
				uni.showLoading({ title: '登录中...' })
				
				// 3. 鍑嗗鐧诲綍鏁版嵁锛堝寘鍚畬鏁寸殑鐢ㄦ埛淇℃伅锛?
				const loginData = {
					phone: this.formData.phone,
					code: this.formData.verifyCode,
					userName: this.formData.realName, // 鐪熷疄濮撳悕
					idType: this.formData.idType, // 璇佷欢绫诲瀷
					idCardNo: this.formData.idNumber, // 璇佷欢鍙风爜
					wechatOpenid: wechatInfo.openid || '', // 寰俊openid
					wechatUnionid: wechatInfo.unionid || '', // 寰俊unionid锛堝彲鑳戒负绌猴級
					avatarUrl: wechatUserInfo.avatarUrl || '', // 寰俊澶村儚
					gender: this.parseGender(wechatUserInfo.gender), // 鎬у埆
				}
				

				
				// 4. 璋冪敤鍚庣API鐧诲綍/娉ㄥ唽
				const result = await login(loginData)
				

				
				// 5. 淇濆瓨Token
				if (result && result.token) {
					saveToken(result.token)
				}
				
				// 6. 淇濆瓨鍚庣杩斿洖鐨勫熀纭€鐢ㄦ埛淇℃伅
				try {
					if (result) {
						const userInfo = {
							userId: result.userId,
							phone: result.phone || this.formData.phone,
							userName: result.userName || this.formData.realName,
							avatarUrl: result.avatarUrl || wechatUserInfo.avatarUrl || '',
							openid: wechatInfo.openid || ''
						}
						uni.setStorageSync(STORAGE_KEY_USER_INFO, userInfo)
						uni.setStorageSync(STORAGE_KEY_USER_LOGIN_STATUS, true)
					}
				} catch (storageError) {
					console.error('淇濆瓨鐢ㄦ埛淇℃伅澶辫触:', storageError)
				}
				
				// 7. 淇濆瓨鐢ㄦ埛鏁版嵁
				this.saveFormData()
				
				uni.hideLoading()
				uni.showToast({
					title: '登录成功',
					icon: 'success'
				})
				
				// 8. 鐧诲綍鎴愬姛鍚庤烦杞?
				setTimeout(() => {
					// 濡傛灉鏈?redirect 鍙傛暟锛岃烦杞埌鎸囧畾椤甸潰锛屽惁鍒欒烦杞埌棣栭〉
					const targetUrl = this.redirectUrl || '/pages/products/medicine_list'
					uni.redirectTo({ url: targetUrl })
				}, 1500)
				
			} catch (error) {
				console.error('鐧诲綍澶辫触:', error)
				uni.hideLoading()
				uni.showToast({
					title: error.message || '鐧诲綍澶辫触锛岃閲嶈瘯',
					icon: 'none'
				})
			}
		},
		
		// 瑙ｆ瀽寰俊鎬у埆锛?-鏈煡锛?-鐢凤紝2-濂?
		parseGender(wechatGender) {
			if (wechatGender === 1) return 1 // 鐢?
			if (wechatGender === 2) return 2 // 濂?
			return 0 // 鏈煡
		}
	},
	
	watch: {
		// 鐩戝惉琛ㄥ崟鏁版嵁鍙樺寲锛岃嚜鍔ㄤ繚瀛?
		formData: {
			handler() {
				this.saveFormData()
			},
			deep: true
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
