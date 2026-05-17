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
import { addCartItem, getCartProductQuantity, resolveCartCompatibility } from '@/utils/cart.js'
import { logPageView } from '@/api/access-log.js'

export default {
  data() {
    return {
      productId: '',
      productName: '',
      noticeText: '',
      suitableCrowd: '',
      usageDesc: '',
      productDetail: null,
      requestedQuantity: 1,
      action: 'cart'
    }
  },
  onLoad(options) {
    this.productId = options.id || ''
    this.productName = options.name ? decodeURIComponent(options.name) : ''
    this.requestedQuantity = Math.max(1, Number(options.quantity) || 1)
    this.action = options.action || 'cart'
    if (!this.productId) {
      console.warn('missing productId on notice page')
      return
    }
    this.loadProductDetail(this.productId)
    logPageView('PRODUCT_NOTICE', this.productId)
  },
  methods: {
    getImageUrl,
    getSelectedQuantity() {
      return Math.max(1, Number(this.requestedQuantity) || getCartProductQuantity(this.productId, 1) || 1)
    },
    async loadProductDetail(productId) {
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
      } catch (error) {
        console.warn('loadProductDetail failed:', error)
      }
      if (!this.noticeText) {
        this.noticeText = '当前商品暂无详细说明，请咨询医生或药师后再使用。'
      }
    },
    async ensureCartCompatible(detail) {
      const target = detail || this.productDetail || await getProductDetail(this.productId)
      if (!target) {
        return false
      }
      const flow = resolveCartCompatibility(target, {
        ignoreProductId: this.productId
      })
      if (!flow.valid) {
        uni.showToast({
          title: flow.message,
          icon: 'none'
        })
        return false
      }
      this.productDetail = target
      return true
    },
    async startQuestionnaire() {
      if (!this.productId) {
        uni.showToast({
          title: '商品信息缺失',
          icon: 'none'
        })
        return
      }

      uni.showLoading({ title: '检查中...' })
      try {
        const detail = this.productDetail || await getProductDetail(this.productId)
        if (!(await this.ensureCartCompatible(detail))) {
          return
        }

        const selectedQuantity = this.getSelectedQuantity()
        let shouldGoQuestionnaire = Number(detail?.needQuestionnaire) === 1 || !!detail?.questionnaireId

        if (!shouldGoQuestionnaire) {
          try {
            const response = await getQuestionnaireByProductId(this.productId)
            const questionnaire = response.data || response
            shouldGoQuestionnaire = !!(
              questionnaire &&
              questionnaire.questionnaireId &&
              Array.isArray(questionnaire.questions) &&
              questionnaire.questions.length > 0
            )
          } catch (error) {
            shouldGoQuestionnaire = false
          }
        }

        if (shouldGoQuestionnaire) {
          uni.navigateTo({
            url: `/pages/products/product_questionnaire?id=${this.productId}&quantity=${selectedQuantity}&action=${this.action}`
          })
          return
        }

        const success = addCartItem(detail, selectedQuantity, {
          questionnairePassed: Number(detail?.needQuestionnaire) !== 1
        })
        if (!success) {
          uni.showToast({
            title: '加入购物车失败',
            icon: 'none'
          })
          return
        }

        uni.showToast({
          title: '已加入购物车',
          icon: 'success'
        })

        setTimeout(() => {
          uni.navigateBack({
            delta: 1,
            success: () => {
              uni.$emit('refreshProductsList')
            }
          })
        }, 1200)
      } catch (error) {
        console.error('startQuestionnaire failed:', error)
        uni.showToast({
          title: error.message || '处理失败，请重试',
          icon: 'none'
        })
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

