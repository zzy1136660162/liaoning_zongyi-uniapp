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

      <button class="start-btn" :disabled="continuing" :loading="continuing" @click="startQuestionnaire">继续</button>
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
  getCartProductInfo,
  getCartEntries,
  prepareCheckout,
  resolveCartCompatibility
} from '@/utils/cart.js'
import { logPageView } from '@/api/access-log.js'
import { resolveQuestionnaireState, getQuestionnaireStateMessage } from '@/utils/questionnaire-state.js'
import { loadCartProducts } from '@/utils/cart-products.js'

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
      action: 'cart',
      selectedItems: '',
      pageActive: true,
      continuing: false,
      returnTimer: null
    }
  },
  onLoad(options) {
    this.productId = options.id || ''
    this.skuId = options.skuId || ''
    this.requestedQuantity = Math.max(1, Number(options.quantity) || 1)
    this.action = options.action || 'cart'
    this.selectedItems = decodeURIComponent(options.selectedItems || '')
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
    this.pageActive = false
    this.productRequestSeq += 1
    if (this.returnTimer) clearTimeout(this.returnTimer)
  },
  methods: {
    getImageUrl,
    isNoticeCurrent() {
      return this.pageActive && isCurrentSession(this.sessionGeneration)
    },
    resolveSelectedProduct(detail = this.productDetail) {
      return detail ? withProductSku(detail, resolveProductSku(detail, this.skuId)) : null
    },
    getCartKey(detail = this.productDetail) {
      return buildCartItemKey(detail?.productId || detail?.id || this.productId, detail?.skuId || this.skuId || null)
    },
    getSelectedQuantity() {
      return Math.max(1, Number(this.requestedQuantity) || 1)
    },
    goQuestionnaire(product, action = this.action) {
      const productId = product.productId || product.id
      const skuParam = product.skuId ? `&skuId=${encodeURIComponent(product.skuId)}` : ''
      const selectedParam = this.selectedItems ? `&selectedItems=${encodeURIComponent(this.selectedItems)}` : ''
      uni.navigateTo({ url: `/pages/products/product_questionnaire?id=${encodeURIComponent(productId)}&quantity=${this.getSelectedQuantity()}&action=${action}${skuParam}${selectedParam}` })
    },
    async loadProductDetail(productId) {
      const requestSeq = ++this.productRequestSeq
      this.productDetail = null
      try {
        const detail = await getProductDetail(productId)
        if (!this.isNoticeCurrent() || requestSeq !== this.productRequestSeq) return
        if (detail) {
          this.productDetail = detail
          this.productName = detail.productName || ''
          this.noticeText = detail.contraindication || ''
          this.suitableCrowd = detail.suitableCrowd || ''
          this.usageDesc = detail.usageDesc || ''
          return
        }
      } catch (error) {
        if (!this.isNoticeCurrent() || requestSeq !== this.productRequestSeq) return
        console.warn('loadProductDetail failed:', error)
      }
      if (!this.noticeText) {
        this.noticeText = '暂无商品说明，请在医生或药师指导下购买和使用。'
      }
    },
    async ensureCartCompatible(detail) {
      const target = detail || this.productDetail || await getProductDetail(this.productId)
      if (!target || !this.isNoticeCurrent()) {
        return false
      }
      const saleProduct = this.resolveSelectedProduct(target)
      const flow = resolveCartCompatibility(saleProduct)
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
    async goCheckout(detail) {
      if (!this.isNoticeCurrent()) return false
      const saleProduct = this.resolveSelectedProduct(detail)
      const cartKey = this.getCartKey(saleProduct)
      const selectedKeys = this.action === 'checkout' ? this.selectedItems.split(',').filter(Boolean) : [cartKey]
      const products = this.action === 'checkout'
        ? await loadCartProducts(selectedKeys, getCartEntries(), getProductDetail)
        : [{ ...saleProduct, id: cartKey, cartKey, productId: saleProduct.productId || saleProduct.id }]
      if (!this.isNoticeCurrent()) return false
      const checkout = prepareCheckout(selectedKeys, [{
        id: 'notice_checkout',
        products
      }])
      if (!checkout.valid) {
        if (checkout.questionnaireCheck?.state === 'required') {
          this.goQuestionnaire(checkout.questionnaireCheck.item, 'checkout')
          return false
        }
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
      if (this.continuing || !this.isNoticeCurrent()) return
      if (!this.productId) {
        uni.showToast({
          title: '缺少商品信息',
          icon: 'none'
        })
        return
      }

      this.continuing = true
      uni.showLoading({ title: '校验中...' })
      try {
        const detail = await getProductDetail(this.productId)
        if (!this.isNoticeCurrent()) return
        if (!(await this.ensureCartCompatible(detail))) {
          return
        }
        if (!this.isNoticeCurrent()) return

        const selectedQuantity = this.getSelectedQuantity()
        const saleProduct = this.resolveSelectedProduct(detail)
        const state = resolveQuestionnaireState(saleProduct, getCartProductInfo(this.productId, saleProduct.skuId))
        if (this.action !== 'cart' && state === 'unavailable') throw new Error(getQuestionnaireStateMessage(state))
        // 加购不答题；立即购买/整组结算/补答只进入当前绑定的问卷。
        if (this.action !== 'cart' && state === 'required') {
          this.goQuestionnaire(saleProduct)
          return
        }

        if (!this.isNoticeCurrent()) return
        if (this.action === 'repair') {
          uni.navigateBack({ delta: 1 })
          return
        }
        if (this.action === 'checkout') {
          await this.goCheckout(saleProduct)
          return
        }
        const success = addCartItem(saleProduct, selectedQuantity)
        if (!success) {
          uni.showToast({
            title: '加入购物车失败',
            icon: 'none'
          })
          return
        }

        if (this.action === 'buy') {
          await this.goCheckout(saleProduct)
          return
        }

        uni.showToast({
          title: '已加入购物车',
          icon: 'success'
        })

        this.returnTimer = setTimeout(() => {
          if (!this.isNoticeCurrent()) return
          uni.navigateBack({
            delta: 1,
            success: () => {
              uni.$emit('refreshProductsList')
            }
          })
        }, 1200)
      } catch (error) {
        if (!this.isNoticeCurrent()) return
        console.error('startQuestionnaire failed:', error)
        uni.showToast({
          title: error.message || '请求失败，请稍后重试',
          icon: 'none'
        })
      } finally {
        if (!this.returnTimer) this.continuing = false
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
