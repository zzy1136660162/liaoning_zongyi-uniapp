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
import { getWeChatLoginCode, getUserProfile, loginByWeChatCode } from '@/api/auth.js'
import { STORAGE_KEY_USER_REGISTER, STORAGE_KEY_USER_INFO, STORAGE_KEY_USER_LOGIN_STATUS } from '@/utils/storage.js'
import { getToken, saveToken } from '@/utils/request.js'
import { getImageUrl } from '@/utils/config.js'
import { syncCartOnLogin } from '@/utils/cart-sync.js'
import { assertCurrentSession, getSessionGeneration, isExplicitlyLoggedOut } from '@/utils/session.js'

export default {
	data() {
		return {
			bgImage: getImageUrl('/profile/liaoning_zongyi/index_bg.jpg?v=0.01'),
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
		async loadUserInfoByOpenid() {
			try {
				if (isExplicitlyLoggedOut()) return
				let session = getSessionGeneration()
				if (!getToken()) {
					const code = await getWeChatLoginCode()
					assertCurrentSession(session)
					const result = await loginByWeChatCode(code)
					assertCurrentSession(session)
					saveToken(result.token)
					session = getSessionGeneration()
					if (result.wechatOpenid) uni.setStorageSync('wechat_openid', result.wechatOpenid)
					syncCartOnLogin()
				}
				const profile = await getUserProfile()
				assertCurrentSession(session)
				uni.setStorageSync(STORAGE_KEY_USER_INFO, { ...profile, userId: profile.id })
				uni.setStorageSync(STORAGE_KEY_USER_REGISTER, {
					realName: profile.userName || '', idType: profile.idType || '身份证',
					idNumber: profile.idCardNo || '', phone: profile.phone || '', verifyCode: ''
				})
				uni.setStorageSync(STORAGE_KEY_USER_LOGIN_STATUS, true)
			} catch (error) {
				// 未注册或登录态变化时保留访客流程，由用户主动登录。
				if (error?.code !== 'SESSION_CHANGED') console.warn('event=ui_index_index stage=load_user_info_by_openid result=warning reason=operation_incomplete')
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
