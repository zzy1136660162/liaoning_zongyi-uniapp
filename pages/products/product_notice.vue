<template>
	<view class="notice-container">
		<!-- Banner区域 -->
		<view class="banner-section">
			<image class="banner-image" :src="getImageUrl('/profile/liaoning_zongyi/banner_bg.png')" mode="widthFix"></image>
		</view>
		
		<!-- 内容区域 -->
		<view class="content-section">
			<view class="product-title">{{ productName || '药方注意事项' }}</view>
			
			<view class="notice-text">
				<text class="notice-content">{{ noticeText }}</text>
			</view>

			<view class="extra-block" v-if="suitableCrowd">
				<view class="block-title">适用人群</view>
				<text class="block-content">{{ suitableCrowd }}</text>
			</view>

			<view class="extra-block" v-if="usageDesc">
				<view class="block-title">用法用量</view>
				<text class="block-content">{{ usageDesc }}</text>
			</view>
			
			<!-- 开始按钮 -->
			<button class="start-btn" @click="startQuestionnaire">开始</button>
		</view>
	</view>
</template>

<script>
import { getProductDetail } from '@/api/product.js'
import { getQuestionnaireByProductId } from '@/api/questionnaire.js'
import { getImageUrl } from '@/utils/config.js'
import { getCartProductQuantity, saveToCart } from '@/utils/cart.js'
import { STORAGE_KEY_VERIFIED_PRODUCTS } from '@/utils/storage.js'
import { isHealthGoods, resolveProductFlow } from '@/utils/product-biz.js'
import { logPageView } from '@/api/access-log.js'

export default {
	data() {
		return {
			productId: '',
			productName: '',
		noticeText: '',
		suitableCrowd: '',
		usageDesc: '',
		productDetail: null
		}
	},
	onLoad(options) {
		this.productId = options.id || ''
		this.productName = options.name ? decodeURIComponent(options.name) : ''
		if (!this.productId) {
			console.warn('未获取到产品ID，无法加载注意事项')
			return
		}
		this.loadProductDetail(this.productId)

		// 记录页面访问日志
		logPageView('产品公告', '用户进入产品公告页面')
	},
	methods: {
		getImageUrl,
		getSelectedQuantity() {
			return getCartProductQuantity(this.productId, 1)
		},
		async loadProductDetail(productId) {
			// 只通过后端接口查询商品详情
			try {
				const detail = await getProductDetail(productId)
				if (detail) {
					this.productDetail = detail
					this.productName = detail.productName || detail.name || this.productName
					this.noticeText = detail.contraindication || detail.noticeText || this.noticeText
					this.suitableCrowd = detail.suitableCrowd || ''
					this.usageDesc = detail.usageDesc || ''
					return
				}
			} catch (err) {
				console.warn('从后端获取商品详情失败', err)
			}
			// 接口不可用时给出兜底文案
			if (!this.noticeText) {
				this.noticeText = '当前药方暂无详细说明，请咨询医师后再使用。'
			}
		},
		async ensureCartCompatible() {
			const currentProduct = this.productDetail || await getProductDetail(this.productId)
			if (!currentProduct) {
				return false
			}

			const verifiedProducts = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
			const existingIds = Object.keys(verifiedProducts)
				.filter(id => verifiedProducts[id] && String(id) !== String(this.productId))
			if (existingIds.length === 0) {
				return true
			}

			const existingProducts = []
			for (const productId of existingIds) {
				try {
					const detail = await getProductDetail(productId)
					if (detail) {
						existingProducts.push(detail)
					}
				} catch (error) {
					console.warn('检查购物车商品失败:', productId, error)
				}
			}

			const flow = resolveProductFlow([currentProduct, ...existingProducts])
			if (!flow.valid) {
				uni.showToast({
					title: flow.message,
					icon: 'none'
				})
				return false
			}
			return true
		},
		async startQuestionnaire() {
			if (!this.productId) {
				uni.showToast({
					title: '商品ID不能为空',
					icon: 'none'
				})
				return
			}
			
			uni.showLoading({ title: '检查中...' })
			
			try {
				const canAdd = await this.ensureCartCompatible()
				if (!canAdd) {
					return
				}

				const detail = this.productDetail || await getProductDetail(this.productId)
				this.productDetail = detail
				if (detail && isHealthGoods(detail)) {
					const success = saveToCart(this.productId, this.getSelectedQuantity())
					if (!success) {
						uni.showToast({
							title: '添加到购物车失败',
							icon: 'none'
						})
						return
					}

					uni.showToast({
						title: '已添加到购物车',
						icon: 'success'
					})

					setTimeout(() => {
						uni.navigateBack({
							delta: 1,
							success: () => {
								uni.$emit('refreshProductsList')
							}
						})
					}, 1500)
					return
				}

				// 尝试获取问卷，判断是否需要问卷
				const response = await getQuestionnaireByProductId(this.productId)
				const questionnaire = response.data || response
				
				// 检查是否有有效的问卷数据
				const hasQuestionnaire = questionnaire && 
					questionnaire.questionnaireId && 
					questionnaire.questions && 
					questionnaire.questions.length > 0
				
				if (hasQuestionnaire) {
					// 有问卷，跳转到答题页面
					uni.navigateTo({
						url: `/pages/products/product_questionnaire?id=${this.productId}`
					})
				} else {
					// 没有问卷，直接添加到购物车
					const success = saveToCart(this.productId, this.getSelectedQuantity())
					
					if (success) {
						uni.showToast({
							title: '已添加到购物车',
							icon: 'success'
						})
						
						// 返回上一页（跳过问卷页面）
						setTimeout(() => {
							uni.navigateBack({
								delta: 1,
								success: () => {
									// 通知列表页刷新
									uni.$emit('refreshProductsList')
								}
							})
						}, 1500)
					} else {
						uni.showToast({
							title: '添加到购物车失败',
							icon: 'none'
						})
					}
				}
			} catch (error) {
				console.log('检查问卷失败，视为无问卷，直接添加到购物车:', error)
				
				// API调用失败（可能是没有问卷），直接添加到购物车
				const success = saveToCart(this.productId, this.getSelectedQuantity())
				
				if (success) {
					uni.showToast({
						title: '已添加到购物车',
						icon: 'success'
					})
					
					// 返回上一页
					setTimeout(() => {
						uni.navigateBack({
							delta: 1,
							success: () => {
								// 通知列表页刷新
								uni.$emit('refreshProductsList')
							}
						})
					}, 1500)
				} else {
					uni.showToast({
						title: '添加到购物车失败',
						icon: 'none'
					})
				}
			} finally {
				uni.hideLoading()
			}
		}
	}
}
</script>

<style scoped>
.notice-container {
	width: 100%;
	min-height: 100vh;
	background-color: #ffffff;
}

.banner-section {
	width: 100%;
	overflow: hidden;
}

.banner-image {
	width: 100%;
	height: auto;
	display: block;
}

.content-section {
	padding: 40rpx 30rpx;
}

.product-title {
	font-size: 36rpx;
	font-weight: 600;
	color: #333333;
	margin-bottom: 30rpx;
	text-align: center;
}

.notice-text {
	background-color: #f9f9f9;
	border-radius: 16rpx;
	padding: 30rpx;
	margin-bottom: 40rpx;
}

.notice-content {
	font-size: 28rpx;
	color: #666666;
	line-height: 1.8;
	white-space: pre-line;
	display: block;
}

.extra-block {
	margin-top: 24rpx;
	background: #f9f9f9;
	border-radius: 16rpx;
	padding: 20rpx 24rpx;
}

.block-title {
	font-size: 30rpx;
	font-weight: 600;
	color: #333;
	margin-bottom: 12rpx;
}

.block-content {
	font-size: 28rpx;
	color: #555;
	line-height: 1.7;
	white-space: pre-line;
	display: block;
}

.start-btn {
	width: 100%;
	height: 88rpx;
	background: linear-gradient(135deg, #FFB6C1 0%, #FFC0CB 100%);
	color: dark;
	font-size: 32rpx;
	font-weight: 500;
	border-radius: 44rpx;
	border: none;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-top: 40rpx;
}
</style>

