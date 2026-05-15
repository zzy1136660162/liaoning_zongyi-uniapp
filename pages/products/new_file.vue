<template>
  <view class="page">
    <image class="banner" :src="product.image" mode="widthFix" />

    <view class="box">
      <view class="title">{{ product.name }}</view>
      <view class="price-row">
        <text class="price">￥{{ formattedPrice }}</text>
        <view class="counter"></view>
      </view>
    </view>

    <view class="content" v-if="product.intro">
      <rich-text :nodes="formatRichText(product.intro)" class="rich-text-content"></rich-text>
    </view>

    <view class="content" v-else>
      <view class="section" v-if="product.indications">
        <view class="section-title">功能主治</view>
        <view class="p">{{ product.indications }}</view>
      </view>
      <view class="section" v-if="product.ingredients">
        <view class="section-title">成份</view>
        <view class="p">{{ product.ingredients }}</view>
      </view>
      <view class="section" v-if="usageText">
        <view class="section-title">用法用量</view>
        <view class="p">{{ usageText }}</view>
      </view>
      <view class="section" v-if="product.contraindication">
        <view class="section-title">禁忌</view>
        <view class="p">{{ product.contraindication }}</view>
      </view>
      <view class="section" v-if="product.precautions">
        <view class="section-title">注意事项</view>
        <view class="p">{{ product.precautions }}</view>
      </view>
      <view class="section" v-if="product.storageCondition">
        <view class="section-title">贮藏条件</view>
        <view class="p">{{ product.storageCondition }}</view>
      </view>
      <view class="section" v-if="!hasSummary">
        <view class="section-title">商品说明</view>
        <view class="p">暂无详细介绍。</view>
      </view>
    </view>

    <view class="customer-service-btn" @click="handleCustomerService">
      <text class="icon">客服</text>
      <text class="text">咨询</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { STORAGE_KEY_PRODUCT_QUANTITIES } from '@/utils/storage.js'
import { getProductDetail, mapProductDetail } from '@/api/product.js'
import { getImageUrl } from '@/utils/config.js'
import { logPageView } from '@/api/access-log.js'

const createEmptyProduct = () => ({
  id: '',
  name: '',
  price: 0,
  image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png'),
  intro: '',
  indications: '',
  ingredients: '',
  commonUsage: '',
  usageDesc: '',
  contraindication: '',
  precautions: '',
  storageCondition: ''
})

const product = ref(createEmptyProduct())
const count = ref(1)
const isInitializing = ref(false)

const usageText = computed(() => product.value.commonUsage || product.value.usageDesc || '')
const hasSummary = computed(() =>
  Boolean(
    product.value.indications ||
    product.value.ingredients ||
    usageText.value ||
    product.value.contraindication ||
    product.value.precautions ||
    product.value.storageCondition
  )
)

const formattedPrice = computed(() => {
  const price = parseFloat(product.value.price) || 0
  return price.toFixed(2)
})

const loadQuantityFromStorage = () => {
  if (!product.value.id) return
  try {
    isInitializing.value = true
    const productQuantities = uni.getStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES) || {}
    const savedQuantity = productQuantities[product.value.id]
    count.value = savedQuantity && savedQuantity > 0 ? savedQuantity : 1
  } catch (e) {
    console.error('加载商品数量失败:', e)
  } finally {
    isInitializing.value = false
  }
}

const saveQuantityToStorage = () => {
  if (!product.value.id || isInitializing.value) return
  try {
    const productQuantities = uni.getStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES) || {}
    productQuantities[product.value.id] = count.value
    uni.setStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES, productQuantities)
  } catch (e) {
    console.error('保存商品数量失败:', e)
  }
}

watch(count, saveQuantityToStorage)

const applyProduct = (source) => {
  const mapped = mapProductDetail(source)
  product.value = {
    ...createEmptyProduct(),
    ...mapped
  }
}

const loadProductDetail = async (id) => {
  try {
    uni.showLoading({ title: '加载中...' })
    const productData = await getProductDetail(id)
    applyProduct(productData)
    loadQuantityFromStorage()
  } catch (error) {
    console.error('加载商品详情失败:', error)
    uni.showToast({
      title: error.message || '加载失败',
      icon: 'none'
    })
  } finally {
    uni.hideLoading()
  }
}

const formatRichText = (htmlContent) => {
  if (!htmlContent) return ''
  if (typeof htmlContent === 'string') {
    return htmlContent
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  }
  return String(htmlContent)
}

onLoad((options) => {
  logPageView('MEDICINE_SIMPLE_DETAIL', '用户进入简版商品详情页', options.id || '')
  product.value = createEmptyProduct()

  if (options.id) {
    loadProductDetail(options.id)
    return
  }

  if (options.product) {
    try {
      const parsed = JSON.parse(decodeURIComponent(options.product))
      applyProduct(parsed)
      if (parsed.id) {
        loadProductDetail(parsed.id)
      } else {
        loadQuantityFromStorage()
      }
    } catch (error) {
      console.error('解析商品参数失败:', error)
    }
  }
})

onShow(() => {
  loadQuantityFromStorage()
})

const handleCustomerService = () => {
  uni.showActionSheet({
    itemList: ['在线咨询', '电话咨询'],
    success: (res) => {
      if (res.tapIndex === 0) {
        uni.showToast({
          title: '在线客服功能建设中',
          icon: 'none'
        })
      } else if (res.tapIndex === 1) {
        uni.makePhoneCall({
          phoneNumber: '024-82961387',
          fail: (err) => {
            console.error('拨打电话失败:', err)
            uni.showToast({
              title: '拨打电话失败',
              icon: 'none'
            })
          }
        })
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.page {
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}

.banner {
  width: 100%;
}

.box {
  padding: 30rpx;
  background: #fff;
  margin-top: 20rpx;
}

.title {
  font-size: 34rpx;
  font-weight: bold;
}

.price-row {
  margin-top: 20rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price {
  color: #e64340;
  font-size: 32rpx;
  font-weight: bold;
}

.counter {
  display: flex;
  align-items: center;
}

.content {
  padding: 30rpx;
  background: #fff;
  margin-top: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  margin-bottom: 20rpx;
}

.p {
  font-size: 28rpx;
  line-height: 1.6;
  margin-bottom: 20rpx;
  color: #555;
}

.rich-text-content {
  font-size: 28rpx;
  line-height: 1.6;
  color: #555;
}

.rich-text-content p {
  margin-bottom: 20rpx;
}

.rich-text-content h1,
.rich-text-content h2,
.rich-text-content h3,
.rich-text-content h4,
.rich-text-content h5,
.rich-text-content h6 {
  font-weight: bold;
  margin: 30rpx 0 10rpx 0;
  color: #333;
}

.rich-text-content h1 {
  font-size: 32rpx;
}

.rich-text-content h2 {
  font-size: 30rpx;
}

.rich-text-content h3,
.rich-text-content h4,
.rich-text-content h5,
.rich-text-content h6 {
  font-size: 28rpx;
}

.rich-text-content ul,
.rich-text-content ol {
  margin: 20rpx 0;
  padding-left: 30rpx;
}

.rich-text-content li {
  margin-bottom: 10rpx;
  line-height: 1.6;
}

.rich-text-content img {
  max-width: 100%;
  height: auto;
  margin: 20rpx 0;
  border-radius: 8rpx;
}

.rich-text-content blockquote {
  border-left: 4rpx solid #2a82e4;
  padding-left: 20rpx;
  margin: 20rpx 0;
  color: #666;
  font-style: italic;
}

.customer-service-btn {
  position: fixed;
  right: 30rpx;
  bottom: calc(140rpx + env(safe-area-inset-bottom));
  width: 80rpx;
  height: 80rpx;
  background: linear-gradient(135deg, #2a82e4 0%, #1e6bc7 100%);
  border-radius: 50rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-shadow: 0 4rpx 20rpx rgba(42, 130, 228, 0.4);
  z-index: 200;
}

.customer-service-btn .icon {
  font-size: 22rpx;
  color: #fff;
  line-height: 1;
  margin-bottom: 4rpx;
}

.customer-service-btn .text {
  font-size: 22rpx;
  color: #fff;
  line-height: 1;
}
</style>
