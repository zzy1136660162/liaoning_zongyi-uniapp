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
						<text class="picker-text">{{ formData.idType || '身份证' }}</text>
						<text class="picker-arrow">▼</text>
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
					<text class="link-text" @click.stop="viewServiceAgreement">《用户服务协议》</text>
					<text class="link-text" @click.stop="viewPrivacyAgreement">《用户隐私协议》</text>
				</text>
			</view>
			
			<!-- 登录按钮 -->
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
import { sendSmsCode, login, getWeChatOpenId, getWeChatUserProfile } from '@/api/auth.js'
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
		// 接收 redirect 参数
		if (options && options.redirect) {
			this.redirectUrl = decodeURIComponent(options.redirect)
		}
		// 加载已保存的注册信息
		this.loadSavedData()

		// 记录页面访问日志
		logPageView('注册页面', '用户进入注册页面')
	},
	onUnload() {
		// 清除倒计时定时器
		if (this.countdownTimer) {
			clearInterval(this.countdownTimer)
		}
	},
	methods: {
		// 加载已保存的数据
		loadSavedData() {
			try {
				const savedData = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
				if (savedData) {
					this.formData = { ...this.formData, ...savedData }
					// 恢复证件类型索引
					const index = this.idTypeList.indexOf(savedData.idType)
					if (index !== -1) {
						this.idTypeIndex = index
					}
				}
				
				// 加载协议同意状态
				const agreementStatus = uni.getStorageSync(STORAGE_KEY_AGREEMENT_ACCEPTED)
				if (agreementStatus) {
					this.isAgreed = agreementStatus
				}
			} catch (e) {
				console.error('加载保存数据失败:', e)
			}
		},
		
		// 保存表单数据
		saveFormData() {
			try {
				uni.setStorageSync(STORAGE_KEY_USER_REGISTER, this.formData)
				uni.setStorageSync(STORAGE_KEY_AGREEMENT_ACCEPTED, this.isAgreed)
			} catch (e) {
				console.error('保存数据失败:', e)
			}
		},
		
		// 证件类型选择
		onIdTypeChange(e) {
			this.idTypeIndex = e.detail.value
			this.formData.idType = this.idTypeList[this.idTypeIndex]
			this.saveFormData()
		},
		
		// 获取验证码
		async getVerifyCode() {
			// 验证手机号
			if (!this.formData.phone) {
				uni.showToast({
					title: '请输入手机号',
					icon: 'none'
				})
				return
			}
			
			// 验证手机号格式
			const phoneReg = /^1[3-9]\d{9}$/
			if (!phoneReg.test(this.formData.phone)) {
				uni.showToast({
					title: '请输入正确的手机号',
					icon: 'none'
				})
				return
			}
			
			try {
				// ✅ 调用后端API发送验证码
				await sendSmsCode(this.formData.phone)
				
				// 开始倒计时
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
		
		// 切换协议同意状态
		toggleAgreement() {
			this.isAgreed = !this.isAgreed
			this.saveFormData()
		},
		
		// 查看用户服务协议
		viewServiceAgreement() {
			uni.showToast({
				title: '用户服务协议',
				icon: 'none'
			})
			// TODO: 跳转到协议详情页
		},
		
		// 查看用户隐私协议
		viewPrivacyAgreement() {
			uni.showToast({
				title: '用户隐私协议',
				icon: 'none'
			})
			// TODO: 跳转到协议详情页
		},

		
		// 处理登录
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
				
				// 1. 获取微信 openid 和 unionid
				let wechatInfo = {}
				try {
					wechatInfo = await getWeChatOpenId()
					console.log('获取微信信息成功:', wechatInfo)
				} catch (wechatError) {
					console.error('获取微信openid失败:', wechatError)
					// 不阻塞登录流程，继续执行
				}
				
				// 2. 尝试获取微信用户信息（头像、昵称）
				let wechatUserInfo = {}
				try {
					wechatUserInfo = await getWeChatUserProfile()
					console.log('获取微信用户信息成功:', wechatUserInfo)
				} catch (userInfoError) {
					console.error('获取微信用户信息失败:', userInfoError)
					// 用户可能拒绝授权，不影响登录
				}
				
				uni.showLoading({ title: '登录中...' })
				
				// 3. 准备登录数据（包含完整的用户信息）
				const loginData = {
					phone: this.formData.phone,
					code: this.formData.verifyCode,
					userName: this.formData.realName, // 真实姓名
					idType: this.formData.idType, // 证件类型
					idCardNo: this.formData.idNumber, // 证件号码
					wechatOpenid: wechatInfo.openid || '', // 微信openid
					wechatUnionid: wechatInfo.unionid || '', // 微信unionid（可能为空）
					avatarUrl: wechatUserInfo.avatarUrl || '', // 微信头像
					gender: this.parseGender(wechatUserInfo.gender), // 性别
				}
				
				console.log('登录数据:', loginData)
				
				// 4. 调用后端API登录/注册
				const result = await login(loginData)
				
				console.log('登录成功:', result)
				
				// 5. 保存Token
				if (result && result.token) {
					saveToken(result.token)
				}
				
				// 6. 保存后端返回的基础用户信息
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
					console.error('保存用户信息失败:', storageError)
				}
				
				// 7. 保存用户数据
				this.saveFormData()
				
				uni.hideLoading()
				uni.showToast({
					title: '登录成功',
					icon: 'success'
				})
				
				// 8. 登录成功后跳转
				setTimeout(() => {
					// 如果有 redirect 参数，跳转到指定页面，否则跳转到首页
					const targetUrl = this.redirectUrl || '/pages/products/priducts_list'
					uni.redirectTo({ url: targetUrl })
				}, 1500)
				
			} catch (error) {
				console.error('登录失败:', error)
				uni.hideLoading()
				uni.showToast({
					title: error.message || '登录失败，请重试',
					icon: 'none'
				})
			}
		},
		
		// 解析微信性别：0-未知，1-男，2-女
		parseGender(wechatGender) {
			if (wechatGender === 1) return 1 // 男
			if (wechatGender === 2) return 2 // 女
			return 0 // 未知
		}
	},
	
	watch: {
		// 监听表单数据变化，自动保存
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
