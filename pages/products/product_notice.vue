<template>
  <view class="notice-container">
    <view class="banner-section">
      <image
        class="banner-image"
        :src="getImageUrl('/profile/liaoning_zongyi/banner_bg.png')"
        mode="widthFix"
      ></image>
    </view>

    <view class="content-section">
      <view class="product-title">{{ productName || '用药须知' }}</view>

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

      <button class="start-btn" @click="startQuestionnaire">继续</button>
    </view>
  </view>
</template>

<script>
import { resolveProductSku, withProductSku } from '@/utils/product-sku.js'
import { getSessionGeneration, isCurrentSession } from '@/utils/session.js'
import { STORAGE_KEY_CURRENT_CONSULTATION_ID } from '@/utils/storage.js'
import { getProductDetail } from '@/api/product.js'
import { getImageUrl } from '@/utils/config.js'
import {
  addCartItem,
  buildCartItemKey,
  getCartProductQuantity,
  prepareCheckout,
  resolveCartCompatibility
} from '@/utils/cart.js'
import { logPageView } from '@/api/access-log.js'
import { hasBoundQuestionnaire } from '@/utils/product-biz.js'

export default {
  data() {
    return {
      sessionGeneration: getSessionGeneration(),
      productId: '',
      skuId: '',
      productName: '',
      noticeText: '',
      suitableCrowd: '',
      usageDesc: '',
      productDetail: null,
      productRequestSeq: 0,
      requestedQuantity: 1,
      action: 'cart'
    }
  },
  onLoad(options) {
    this.productId = options.id || ''
    this.skuId = options.skuId || ''
    this.requestedQuantity = Math.max(1, Number(options.quantity) || 1)
    this.action = options.action || 'cart'
    if (!this.productId) {
      console.warn('missing productId on notice page')
      return
    }
    logPageView('PRODUCT_NOTICE', this.productId)
  },
  onShow() {
    if (this.productId) this.loadProductDetail(this.productId)
  },
  onUnload() {
    this.productRequestSeq += 1
  },
  methods: {
    getImageUrl,
    resolveSelectedProduct(detail = this.productDetail) {
      return detail ? withProductSku(detail, resolveProductSku(detail, this.skuId)) : null
    },
    getCartKey(detail = this.productDetail) {
      return buildCartItemKey(detail?.productId || detail?.id || this.productId, detail?.skuId || this.skuId || null)
    },
    getSelectedQuantity() {
      return Math.max(1, Number(this.requestedQuantity) || getCartProductQuantity(this.productId, 1, this.skuId) || 1)
    },
    async loadProductDetail(productId) {
      const requestSeq = ++this.productRequestSeq
      this.productDetail = null
      try {
        const detail = await getProductDetail(productId)
        if (!isCurrentSession(this.sessionGeneration) || requestSeq !== this.productRequestSeq) return
        if (detail) {
          this.productDetail = detail
          this.productName = detail.productName || ''
          this.noticeText = detail.contraindication || ''
          this.suitableCrowd = detail.suitableCrowd || ''
          this.usageDesc = detail.usageDesc || ''
          return
        }
      } catch (error) {
        if (!isCurrentSession(this.sessionGeneration) || requestSeq !== this.productRequestSeq) return
        console.warn('loadProductDetail failed:', error)
      }
      if (!this.noticeText) {
        this.noticeText = '暂无商品说明，请在医生或药师指导下购买和使用。'
      }
    },
    async ensureCartCompatible(detail) {
      const target = detail || this.productDetail || await getProductDetail(this.productId)
      if (!target) {
        return false
      }
      const saleProduct = this.resolveSelectedProduct(target)
      const flow = resolveCartCompatibility(saleProduct, {
        ignoreCartKey: this.getCartKey(saleProduct)
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
    goCheckout(detail) {
      if (!isCurrentSession(this.sessionGeneration)) return false
      const saleProduct = this.resolveSelectedProduct(detail)
      const cartKey = this.getCartKey(saleProduct)
      const checkout = prepareCheckout([cartKey], [{
        id: 'notice_checkout',
        products: [{
          ...saleProduct,
          id: cartKey,
          cartKey,
          productId: saleProduct.productId || saleProduct.id
        }]
      }])
      if (!checkout.valid) {
        uni.showToast({
          title: checkout.message,
          icon: 'none'
        })
        return false
      }

      const selectedItems = checkout.productIds.join(',')
      if (!checkout.requiresConsultation) {
        uni.removeStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID)
        uni.navigateTo({
          url: `/pages/order/confirm?selectedItems=${selectedItems}`
        })
        return true
      }

      uni.navigateTo({
        url: `/pages/dispense/apply?selectedItems=${selectedItems}`
      })
      return true
    },
    async startQuestionnaire() {
      if (!this.productId) {
        uni.showToast({
          title: '缺少商品信息',
          icon: 'none'
        })
        return
      }

      uni.showLoading({ title: '校验中...' })
      try {
        const detail = await getProductDetail(this.productId)
        if (!(await this.ensureCartCompatible(detail))) {
          return
        }

        const selectedQuantity = this.getSelectedQuantity()
        // 问卷绑定以当前商品配置为准，不探测旧接口结构或猜测绑定关系。
        const shouldGoQuestionnaire = hasBoundQuestionnaire(detail)

        if (shouldGoQuestionnaire) {
          const skuParam = this.skuId ? `&skuId=${encodeURIComponent(this.skuId)}` : ''
          uni.navigateTo({
            url: `/pages/products/product_questionnaire?id=${this.productId}&quantity=${selectedQuantity}&action=${this.action}${skuParam}`
          })
          return
        }

        const saleProduct = this.resolveSelectedProduct(detail)
        if (!isCurrentSession(this.sessionGeneration)) return
        const success = addCartItem(saleProduct, selectedQuantity, {
          questionnairePassed: !hasBoundQuestionnaire(detail)
        })
        if (!success) {
          uni.showToast({
            title: '加入购物车失败',
            icon: 'none'
          })
          return
        }

        if (this.action === 'buy') {
          this.goCheckout(saleProduct)
          return
        }

        uni.showToast({
          title: '已加入购物车',
          icon: 'success'
        })

        setTimeout(() => {
          if (!isCurrentSession(this.sessionGeneration)) return
          uni.navigateBack({
            delta: 1,
            success: () => {
              uni.$emit('refreshProductsList')
            }
          })
        }, 1200)
      } catch (error) {
        if (!isCurrentSession(this.sessionGeneration)) return
        console.error('startQuestionnaire failed:', error)
        uni.showToast({
          title: error.message || '请求失败，请稍后重试',
          icon: 'none'
        })
      } finally {
        if (isCurrentSession(this.sessionGeneration)) uni.hideLoading()
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
