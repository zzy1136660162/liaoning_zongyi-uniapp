<template>
	<view class="splash-container">
		<image class="bg-image" :src="bgImage" mode="widthFit"></image>
		<view class="content">
			<view class="countdown" v-if="countdown > 0">
				<view class="countdown-circle">
					<text class="countdown-text">{{ countdown }}</text>
				</view>
			</view>
			<view class="button-container">
				<button class="enter-btn" @click="goToNotice">进入首页</button>
			</view>
		</view>
	</view>
</template>

<script>
import { getStoredWeChatOpenId, getWeChatOpenId } from '@/api/auth.js'
import { getUserByOpenid, loginByOpenid } from '@/api/auth.js'
import { STORAGE_KEY_USER_REGISTER, STORAGE_KEY_USER_INFO, STORAGE_KEY_USER_LOGIN_STATUS } from '@/utils/storage.js'
import { saveToken } from '@/utils/request.js'
import { getImageUrl } from '@/utils/config.js'

export default {
	data() {
		return {
			bgImage: getImageUrl('/profile/liaoning_zongyi/index_bg.jpg'),
			countdown: 5,
			timer: null
		}
	},
	onLoad() {
		this.loadUserInfoByOpenid()
		this.startCountdown()
	},
	onUnload() {
		if (this.timer) {
			clearInterval(this.timer)
		}
	},
	methods: {
		/**
		 * 通过 openid 查询用户信息，如果 STORAGE_KEY_USER_REGISTER 没有值则设置
		 */
		async loadUserInfoByOpenid() {
			try {
				// 1. 检查 STORAGE_KEY_USER_REGISTER 是否已有值
				const existingRegisterInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
				if (existingRegisterInfo) {
					console.log('STORAGE_KEY_USER_REGISTER 已有值，跳过查询',existingRegisterInfo)
					return
				}
				
				// 2. 获取 openid（先从本地存储获取，如果没有则通过微信登录获取）
				let openid = getStoredWeChatOpenId()
				
				if (!openid) {
					console.log('本地存储中没有 openid，尝试获取微信 openid')
					try {
						const wechatInfo = await getWeChatOpenId()
						openid = wechatInfo.openid
					} catch (error) {
						console.error('获取微信 openid 失败:', error)
						return
					}
				}
				
				if (!openid) {
					console.log('未获取到 openid，跳过查询')
					return
				}
				
				// 3. 通过 openid 查询用户信息
				console.log('通过 openid 查询用户信息:', openid)
				const userInfo = await getUserByOpenid(openid)
				
				if (!userInfo) {
					console.log('未找到用户信息')
					return
				}
				
				// 4. 将用户信息设置到 STORAGE_KEY_USER_REGISTER
				const registerInfo = {
					realName: userInfo.userName || '',
					idType: userInfo.idType || '身份证',
					idNumber: userInfo.idCardNo || '',
					phone: userInfo.phone || '',
					verifyCode: '' // 验证码需要重新获取
				}
				
				uni.setStorageSync(STORAGE_KEY_USER_REGISTER, registerInfo)
				console.log('✅ 已设置 STORAGE_KEY_USER_REGISTER:', registerInfo)
				
				// 5. 通过 openid 自动登录获取 token（与 register.vue 逻辑一致）
				try {
					console.log('通过 openid 自动登录获取 token:', openid)
					const loginResult = await loginByOpenid(openid)
					
					if (loginResult && loginResult.token) {
						// 保存 Token（与 register.vue 逻辑一致）
						saveToken(loginResult.token)
						console.log('✅ 已保存 Token')
						
						// 保存后端返回的基础用户信息（与 register.vue 逻辑一致）
						const userInfoData = {
							userId: loginResult.userId,
							phone: loginResult.phone || userInfo.phone || '',
							userName: loginResult.userName || userInfo.userName || '',
							avatarUrl: loginResult.avatarUrl || userInfo.avatarUrl || '',
							openid: loginResult.wechatOpenid || openid
						}
						uni.setStorageSync(STORAGE_KEY_USER_INFO, userInfoData)
						uni.setStorageSync(STORAGE_KEY_USER_LOGIN_STATUS, true)
						console.log('✅ 已保存用户信息和登录状态:', userInfoData)
					}
				} catch (loginError) {
					console.error('通过 openid 自动登录失败:', loginError)
					// 静默失败，不影响页面正常流程
				}
				
			} catch (error) {
				console.error('通过 openid 查询用户信息失败:', error)
				// 静默失败，不影响页面正常流程
			}
		},
		
		startCountdown() {
			this.timer = setInterval(() => {
				this.countdown--
				if (this.countdown <= 0) {
					clearInterval(this.timer)
					this.goToNotice()
				}
			}, 1000)
		},
		goToNotice() {
			if (this.timer) {
				clearInterval(this.timer)
			}
			uni.redirectTo({
				url: '/pages/notice/notice'
			})
		}
	}
}
</script>

<style scoped>
.splash-container {
	width: 100%;
	height: 100vh;
	position: relative;
	overflow: hidden;
}

.bg-image {
	width: 100%;
	height: 100%;
	position: absolute;
	top: 0;
	left: 0;
	z-index: 0;
}

.content {
	position: relative;
	z-index: 1;
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
}

.countdown {
	position: absolute;
	top: 170rpx;
	right: 60rpx;
	z-index: 2;
}

.countdown-circle {
	width: 80rpx;
	height: 80rpx;
	border-radius: 50%;
	background-color: rgba(255, 255, 255, 0.8);
	display: flex;
	justify-content: center;
	align-items: center;
	border: 4rpx solid rgba(255, 255, 255, 0.9);
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
}

.countdown-text {
	font-size: 32rpx;
	font-weight: bold;
	color: #333;
}

.button-container {
	margin-top: 30%;
	width: 100%;
	display: flex;
	justify-content: center;
	padding: 0 60rpx;
}

.enter-btn {
	width: 400rpx;
	height: 88rpx;
	line-height: 88rpx;
	background: rgba(255, 255, 255, 0.7);
	color: #333333;
	font-size: 32rpx;
	font-weight: 500;
	border-radius: 44rpx;
	border: none;
	box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.1);
	transition: all 0.3s;
}

.enter-btn:active {
	transform: scale(0.98);
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
	background: rgba(255, 255, 255, 0.8);
}
</style>
