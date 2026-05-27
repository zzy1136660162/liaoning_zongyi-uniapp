<template>
	<view class="notice-container">
		<image class="bg-image" :src="bgImage" mode="aspectFill"></image>
		<view class="content-wrapper">
			<view class="notice-card">
					<view class="title">院内制剂（特色便民）告知书</view>
				
				<scroll-view 
					class="notice-list" 
					scroll-y
				>
						<view class="notice-item" v-for="(item, index) in noticeList" :key="index">
							<text class="item-number">{{ index + 1 }}.</text>
							<text class="item-text">{{ item }}</text>
						</view>
					</scroll-view>
				
				<view class="button-group">
					<button 
						class="btn btn-primary" 
						:class="{ active: canConfirm }" 
						:disabled="!canConfirm"
						@click="handleConfirm"
					>
						{{ confirmButtonText }}
					</button>
					<button class="btn btn-secondary" >我不是复诊,仅浏览</button>
					<!-- @click="handleBrowse" -->
				</view>
				
				<view class="checkbox-wrapper" @click="toggleCheckbox">
					<view class="checkbox" :class="{ checked: isChecked }">
						<text class="checkbox-icon" v-if="isChecked">✓</text>
					</view>
						<text class="checkbox-text">我已仔细阅读告知书详细内容，并充分知晓风险</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import { getImageUrl } from '@/utils/config.js'
import { logPageView } from '@/api/access-log.js'
export default {
	data() {
		return {
			bgImage: getImageUrl('/profile/liaoning_zongyi/gaozhishu_bg.jpg'),
			isChecked: false,
			countdown: 3, // 倒计时秒数
			countdownTimer: null, // 倒计时定时器
			isCountdownFinished: false, // 倒计时是否完成
				noticeList: [
					'院内制剂（特色便民）是为复诊患者提供的便民线上自费医疗（包括亚健康及稳定的慢性病患者）;',
					'病情为急、危、重症、病情不稳定、慢性病未控制者；孕妇、中药过敏史患者；初诊患者等，不推荐使用，请到医院就诊;',
					'如需复诊续方也可通过互联网医院【咨询复诊】发起问诊;',
					'院内制剂药品仅支持顺丰配送（辽宁省内），可通过公众号【药品配送】查看订单及物流信息，邮费到付;',
					'互联网医院服务电话：15502605457。\n顺丰电话：15041291828'
				]
			}
		},
	computed: {
		// 是否可以确认（倒计时完成 + 勾选确认）
		canConfirm() {
			return this.isCountdownFinished && this.isChecked
		},
		// 按钮文字
			confirmButtonText() {
				if (!this.isCountdownFinished) {
					return `我是复诊，我已阅知 (${this.countdown}s)`
				}
				return '我是复诊，我已阅知'
			}
		},
	onLoad() {
		// 页面加载时开始倒计时
		this.startCountdown()

		// 记录页面访问日志
		logPageView('公告页面', '用户进入公告页面')
	},
	onUnload() {
		// 页面卸载时清除定时器
		if (this.countdownTimer) {
			clearInterval(this.countdownTimer)
			this.countdownTimer = null
		}
	},
	methods: {
		// 开始倒计时
		startCountdown() {
			this.countdown = 3
			this.isCountdownFinished = false
			
			this.countdownTimer = setInterval(() => {
				this.countdown--
				if (this.countdown <= 0) {
					this.isCountdownFinished = true
					clearInterval(this.countdownTimer)
					this.countdownTimer = null
				}
			}, 1000)
		},
		toggleCheckbox() {
			this.isChecked = !this.isChecked
		},
		handleConfirm() {
			if (!this.canConfirm) {
				if (!this.isCountdownFinished) {
					uni.showToast({
						title: '请等待倒计时结束',
						icon: 'none'
					})
				} else if (!this.isChecked) {
					uni.showToast({
						title: '请先阅读并勾选确认',
						icon: 'none'
					})
				}
				return
			}
			// 跳转到产品列表页面
			uni.redirectTo({
				url: '/pages/products/medicine_list'
			})
		},
		handleBrowse() {
			// 仅浏览，跳转到产品列表页面
			uni.redirectTo({
				url: '/pages/products/medicine_list'
			})
		}
	}
}
</script>

<style scoped>
.notice-container {
	width: 100%;
	min-height: 100vh;
	position: relative;
	overflow: hidden;
}

.bg-image {
	width: 100%;
	height: 100%;
	position: fixed;
	top: 0;
	left: 0;
	z-index: 0;
}

.content-wrapper {
	position: relative;
	z-index: 1;
	width: 100%;
	min-height: 100vh;
	padding: 40rpx 30rpx;
	box-sizing: border-box;
}

.notice-card {
	background-color: #ffffff;
	border-radius: 24rpx;
	padding: 20rpx 40rpx 20rpx;
	box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
	margin-top: 32%;
}

.title {
	font-size: 40rpx;
	font-weight: bold;
	color: #333333;
	text-align: center;
	margin-bottom: 50rpx;
	line-height: 1.5;
}

.notice-list {
	height: 350px;
	max-height: 350px;
	margin-bottom: 40rpx;
}

.notice-item {
	display: flex;
	margin-bottom: 1rpx;
	line-height: 1.8;
}

.item-number {
	font-size: 28rpx;
	color: #333333;
	font-weight: 500;
	margin-right: 10rpx;
	flex-shrink: 0;
}

	.item-text {
		font-size: 28rpx;
		color: #666666;
		flex: 1;
		line-height: 1.8;
		white-space: pre-line;
	}

.button-group {
	display: flex;
	flex-direction: column;
	gap: 24rpx;
	margin-bottom: 10rpx;
}

.btn {
	width: 100%;
	height: 88rpx;
	line-height: 88rpx;
	border-radius: 44rpx;
	font-size: 30rpx;
	border: none;
	transition: all 0.3s;
}

.btn-primary {
	background-color: #999999;
	color: #ffffff;
}

.btn-primary[disabled] {
	background-color: #999999;
	color: #ffffff;
	opacity: 0.6;
}

.btn-primary.active {
	background-color: #87CEEB;
	color: #ffffff;
}

.btn-primary:active {
	background-color: #888888;
	transform: scale(0.98);
}

.btn-primary.active:active {
	background-color: #6BB6D6;
	transform: scale(0.98);
}

.btn-secondary {
	background-color: #ffffff;
	color: #666666;
	border: 2rpx solid #e0e0e0;
}

.btn-secondary:active {
	background-color: #f5f5f5;
	transform: scale(0.98);
}

.checkbox-wrapper {
	display: flex;
	align-items: flex-start;
	padding: 20rpx 0;
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
	background-color: #4A90E2;
	border-color: #4A90E2;
}

.checkbox-icon {
	color: #ffffff;
	font-size: 20rpx;
	font-weight: bold;
}

.checkbox-text {
	font-size: 26rpx;
	color: #666666;
	line-height: 1.6;
	flex: 1;
}
</style>
