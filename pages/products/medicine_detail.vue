<template>
  <view class="page" :class="{ 'page-lock': showManual || showPolicy }">

    <view class="banner-wrapper">
      <swiper class="banner" :indicator-dots="true" :autoplay="productImages.length > 1" :interval="3000" indicator-color="rgba(255,255,255,0.4)" indicator-active-color="#fff" @change="handleBannerChange">
        <swiper-item v-for="(img, idx) in productImages" :key="idx">
          <image class="banner-img" :src="img" mode="aspectFill" />
        </swiper-item>
      </swiper>
      <view class="banner-index">{{ currentIndex }}/{{ productImages.length }}</view>
    </view>
    <view class="split-line"></view>
    <view class="price-box">
      <view class="price-main">
        <view class="price-left">
          <view class="price-tag">商品价格</view>
          <view class="price-info">
            <text class="price-unit">￥</text>
            <text class="price-num">{{ priceInteger }}</text>
            <text class="price-decimal">.{{ priceDecimal }}</text>
          </view>
        </view>
        <view class="price-right">
          <view class="sales-box">
            <text class="sales-icon">🔥</text>
            <text class="sales-count">已售 {{ product.salesVolume || 0 }}</text>
          </view>
        </view>
      </view>
      <view class="trust-badges">
        <view class="trust-item"><image class="trust-icon" src="/static/logotou.png" mode="aspectFit" /><text class="trust-text">医院自营</text></view>
        <view class="trust-item"><text class="trust-icon">🛡️</text><text class="trust-text">正品保证</text></view>
        <view class="trust-item"><text class="trust-icon">💯</text><text class="trust-text">购买无忧</text></view>
        <view class="trust-item"><text class="trust-icon">🚚</text><text class="trust-text">专业物流</text></view>
        <view class="trust-item"><text class="trust-icon">⏰</text><text class="trust-text">24h发货</text></view>
      </view>
    </view>

    <view class="goods-info">
      <view class="goods-name-row">
        <text class="self-developed-tag" v-if="product.bizType === 1">自研</text>
        <text class="new-product-tag" v-if="product.isHospitalStarFormula === 1">院藏王牌制剂</text>
        <text class="star-product-tag" v-if="product.isNewProduct === 1">重磅新品</text>
        <text class="goods-name">{{ product.name }}&nbsp;{{ product.description }}</text>
      </view>
      <view class="goods-sub" v-if="product.subtitle || product.indications">{{ product.indications }}</view>
      <view class="drug-reminder">{{ product.isPrescription === 1 ? '处方药，请在医师指导下购买和使用' : '非处方药，请按说明书或药师指导使用' }}</view>
    </view>

    <view class="policy-overlay" v-if="showPolicy" @click="closePolicyDrawer">
      <view class="policy-drawer" @click.stop>
        <view class="policy-header">
          <text class="policy-title">退换货说明</text>
          <view class="policy-close" @click="closePolicyDrawer">×</view>
        </view>
        <view class="policy-body">
          <view class="policy-section">
            <text class="policy-section-title"><text class="check-icon">✓</text> 不支持七天无理由退换</text>
            <text class="policy-content">药品属于特殊商品，除质量问题外，一经售出通常不支持退换。</text>
          </view>
          <view class="policy-section">
            <text class="policy-section-title"><text class="check-icon">✓</text> 售后保障</text>
            <text class="policy-content">如需了解用药问题，可联系平台药师或医院相关科室咨询。</text>
          </view>
        </view>
        <view class="policy-footer">
          <view class="policy-confirm-btn" @click="closePolicyDrawer">我知道了</view>
        </view>
      </view>
    </view>

    <view class="select-section">
      <view class="select-label">已选</view>
      <view class="select-value">
        <text>{{ selectedSpec }}</text>
        <text class="select-num"> ×{{ quantity }}</text>
      </view>
    </view>

    <view class="drug-manual-card" @click="showManualDrawer">
      <view class="manual-item">
        <view class="manual-item-title">药物组成</view>
        <view class="manual-item-content">{{ product.ingredients || '暂无信息' }}</view>
      </view>
      <view class="manual-divider"></view>
      <view class="manual-item">
        <view class="manual-item-title">用法用量</view>
        <view class="manual-item-content">{{ product.usageDesc || '暂无信息' }}</view>
      </view>
      <view class="manual-arrow">›</view>
    </view>

    <view class="policy-row" @click="showPolicyDrawer">
      <text class="policy-text">不支持七天无理由退换 · 售后服务</text>
      <text class="select-arrow">›</text>
    </view>
    <view class="delivery-row">
      <text class="delivery-label">配送</text>
      <image class="sf-logo" src="https://smf.lntcm.com/static/logo/sf.png" mode="aspectFit" />
      <text class="delivery-text">顺丰配送，时效以实际收货地址为准</text>
    </view>

    <view class="promise-box">
      <view class="promise-item">
        <text class="promise-icon">✓</text>
        <text class="promise-text">医院自研</text>
      </view>
      <view class="promise-item">
        <text class="promise-icon">✓</text>
        <text class="promise-text">正品保障</text>
      </view>
      <view class="promise-item">
        <text class="promise-icon">✓</text>
        <text class="promise-text">专业药师</text>
      </view>
      <view class="promise-item">
        <text class="promise-icon">✓</text>
        <text class="promise-text">顺丰物流</text>
      </view>
      <view class="promise-item">
        <text class="promise-icon">✓</text>
        <text class="promise-text">隐私保护</text>
      </view>
    </view>

    <view class="drawer-overlay" v-if="showManual" @click="closeManualDrawer">
      <view class="drawer-content drawer-green-card" @click.stop>
        <view class="drawer-header">
          <text class="drawer-title">用药说明</text>
          <view class="drawer-close" @click="closeManualDrawer">×</view>
        </view>
        <scroll-view class="drawer-body" scroll-y>
          <view class="drawer-section" v-if="product.ingredients">
            <text class="drawer-label">【成份】</text>
            <text class="drawer-text">{{ product.ingredients }}</text>
          </view>
          <view class="drawer-section" v-if="product.indications">
            <text class="drawer-label">【功能主治】</text>
            <text class="drawer-text">{{ product.indications }}</text>
          </view>
          <view class="drawer-section" v-if="usageText">
            <text class="drawer-label">【用法用量】</text>
            <text class="drawer-text">{{ usageText }}</text>
          </view>
          <view class="drawer-section" v-if="product.adverseReactions">
            <text class="drawer-label">【不良反应】</text>
            <text class="drawer-text">{{ product.adverseReactions }}</text>
          </view>
          <view class="drawer-section" v-if="product.contraindication">
            <text class="drawer-label">【禁忌】</text>
            <text class="drawer-text">{{ product.contraindication }}</text>
          </view>
          <view class="drawer-section" v-if="product.precautions">
            <text class="drawer-label">【注意事项】</text>
            <text class="drawer-text">{{ product.precautions }}</text>
          </view>
          <view class="drawer-section" v-if="product.storageCondition">
            <text class="drawer-label">【贮藏】</text>
            <text class="drawer-text">{{ product.storageCondition }}</text>
          </view>
          <view class="drawer-section" v-if="product.manufacturer">
            <text class="drawer-label">【生产单位】</text>
            <text class="drawer-text">{{ product.manufacturer }}</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <view class="split-line"></view>

    <view class="pharmacist-card">
      <view class="pharmacist-avatar-wrap">
        <image class="pharmacist-avatar" :src="pharmacistAvatar" mode="aspectFill" />
        <view class="online-tag">在线</view>
      </view>
      <view class="pharmacist-detail">
        <view class="pharmacist-name">用药咨询</view>
        <view class="pharmacist-desc">有问题可咨询专业药师</view>
      </view>
      <view class="consult-btn" @click.stop="goConsult">咨询</view>
    </view>
     <view class="split-line"></view>
    <view class="recommend-section" :class="{ 'combo-section': recommendTab === 'combo', 'star-section': recommendTab === 'star' }">
      <view class="recommend-tabs">
        <view class="recommend-tab" :class="{ active: recommendTab === 'combo' }" @click="switchRecommendTab('combo')">用药组合</view>
        <view class="recommend-tab" :class="{ active: recommendTab === 'star' }" @click="switchRecommendTab('star')">明星产品</view>
      </view>
      <view class="recommend-content">
        <scroll-view class="recommend-scroll" scroll-x v-if="recommendTab === 'combo'">
          <view class="recommend-item" v-for="item in comboProducts" :key="item.id" @click="goToDetail(item)">
            <image class="recommend-img" :src="getImageUrl(item.image)" mode="aspectFit" />
            <view class="recommend-info">
              <text class="recommend-name">{{ item.name }}</text>
              <view class="recommend-bottom">
                <text class="recommend-price">￥{{ Number(item.price || 0).toFixed(2) }}</text>
                <view class="recommend-add-btn" :class="{ 'has-quantity': cartQuantities[item.id] > 0 }" @click.stop="flyToCart($event, item)">
                  <text v-if="cartQuantities[item.id]">{{ cartQuantities[item.id] }}</text>
                  <text v-else>+</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
        <scroll-view class="recommend-scroll" scroll-x v-else>
          <view class="recommend-item" v-for="item in starProducts" :key="item.id" @click="goToDetail(item)">
            <image class="recommend-img" :src="getImageUrl(item.image)" mode="aspectFit" />
            <view class="recommend-info">
              <text class="recommend-name">{{ item.name }}</text>
              <view class="recommend-bottom">
                <text class="recommend-price">￥{{ Number(item.price || 0).toFixed(2) }}</text>
                <view class="recommend-add-btn" :class="{ 'has-quantity': cartQuantities[item.id] > 0 }" @click.stop="flyToCart($event, item)">
                  <text v-if="cartQuantities[item.id]">{{ cartQuantities[item.id] }}</text>
                  <text v-else>+</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
      <view class="combo-disclaimer" v-if="recommendTab === 'combo'">*用药组合仅供参考，最终以医嘱为准</view>

      <view class="flying-dot" v-if="flyingDot.show" :style="{ left: flyingDot.x + 'px', top: flyingDot.y + 'px' }"></view>
    </view>

    <view class="split-line"></view>

    <view class="detail-header">
      <view class="detail-tab" :class="{ active: detailTab === 'desc' }" @click="switchDetailTab('desc')">详情</view>
      <view class="detail-tab" :class="{ active: detailTab === 'review' }" @click="switchDetailTab('review')">评价</view>
    </view>

    <view class="detail-body" v-if="detailTab === 'desc'">
      <view class="detail-title">商品详情</view>
      <rich-text v-if="product.intro" class="detail-richtext" :nodes="formatRichText(product.intro)"></rich-text>
      <view v-else class="empty-block">暂无图文详情</view>
      <view class="detail-images" v-if="showDetailImages">
        <image v-for="(img, idx) in productImages" :key="idx" :src="img" mode="widthFix" class="detail-img" />
      </view>

      <!-- <view class="spec-list">
        <view class="spec-title">药品基本信息</view>
        <view class="spec-item" v-for="item in specItems" :key="item.label">
          <text class="spec-label">{{ item.label }}</text>
          <text class="spec-value">{{ item.value }}</text>
        </view>
      </view> -->

      <view class="usage-box" v-if="specItems.length > 0">
        <view class="usage-title">药品基本信息</view>
        <view class="usage-list">
          <view class="usage-item" v-for="item in specItems" :key="item.label">
            <text class="usage-label">{{ item.label }}</text>
            <text class="usage-text">{{ item.value }}</text>
          </view>
        </view>
      </view>

      <view class="usage-box" v-if="usageItems.length > 0">
        <view class="usage-title">用药说明</view>
        <view class="usage-list">
          <view class="usage-item" v-for="item in usageItems" :key="item.label">
            <text class="usage-label">{{ item.label }}</text>
            <text class="usage-text">{{ item.value }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="detail-body" v-if="detailTab === 'review'">
      <view class="empty-block">暂无评价</view>
    </view>

    <view class="reminder-bar">
      <text class="reminder-icon">!</text>
      <text class="reminder-text">请仔细阅读药品说明书或在医师、药师指导下使用。药品包装及说明请以实际收到的商品为准。</text>
    </view>

    <view class="bottom-space"></view>

    <view class="bottom-bar">
      <view class="bottom-left">
        <view class="action-icon-btn" @click="toggleCollect">
          <text class="action-icon">{{ isCollected ? '★' : '☆' }}</text>
          <text class="action-text">{{ isCollected ? '已收藏' : '收藏' }}</text>
        </view>
        <view class="action-icon-btn" @click="goCart">
          <text class="action-icon">🛒</text>
          <text class="action-text">购物车</text>
          <view class="cart-badge" v-if="cartCount > 0">{{ cartCount > 99 ? '99+' : cartCount }}</view>
        </view>
      </view>
      <view class="bottom-right">
        <view class="btn-add-cart" @click="addCart">加入购物车</view>
        <view class="btn-buy" @click="buyNow">立即购买</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { STORAGE_KEY_PRODUCT_QUANTITIES } from '@/utils/storage.js'
import { getProductDetail, mapProductDetail } from '@/api/product.js'
import { getImageUrl } from '@/utils/config.js'
import { saveToCart } from '@/utils/cart.js'
import { logPageView } from '@/api/access-log.js'

const pharmacistAvatar = 'https://smf.lntcm.com/static/logo/zixun.svg'

const createEmptyProduct = () => ({
  id: '',
  name: '',
  subtitle: '',
  price: 0,
  image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png'),
  images: [],
  intro: '',
  salesVolume: 0,
  bizType: 1,
  isPrescription: 0,
  isHospitalStarFormula: 0,
  isNewProduct: 0,
  indications: '',
  ingredients: '',
  commonUsage: '',
  usageDesc: '',
  contraindication: '',
  precautions: '',
  storageCondition: '',
  adverseReactions: '',
  appearanceDesc: '',
  dosageForm: '',
  packageSpec: '',
  specText: '',
  validityPeriod: '',
  originType: 0,
  approvalNumber: '',
  manufacturer: '',
  executionStandard: '',
  warmTips: ''
})

const product = ref(createEmptyProduct())
const quantity = ref(1)
const showManual = ref(false)
const showPolicy = ref(false)
const detailTab = ref('desc')
const currentIndex = ref(1)
const cartCount = ref(0)
const isCollected = ref(false)
const isInitializing = ref(false)
const flyingDot = ref({ show: false, x: 0, y: 0 })
const recommendTab = ref('combo')
const cartQuantities = ref({})
const comboProducts = ref([
  { id: 1, name: '养阴清肺糖浆', price: 29.9, image: 'https://smf.lntcm.com/static/medicine/2S7A5409.JPG' },
  { id: 2, name: '清肺抑火片', price: 35.0, image: 'https://smf.lntcm.com/static/medicine/2S7A5372.JPG' },
  { id: 3, name: '复方甘草片', price: 18.5, image: 'https://smf.lntcm.com/static/medicine/2S7A5373.JPG' },
  { id: 4, name: '川贝枇杷膏', price: 42.0, image: 'https://smf.lntcm.com/static/medicine/2S7A5374.JPG' },
  { id: 5, name: '板蓝根颗粒', price: 22.0, image: 'https://smf.lntcm.com/static/medicine/2S7A5375.JPG' }
])
const starProducts = ref([
  { id: 11, name: '人参养荣丸', price: 68.0, image: 'https://smf.lntcm.com/static/medicine/2S7A5376.JPG' },
  { id: 12, name: '六味地黄丸', price: 45.0, image: 'https://smf.lntcm.com/static/medicine/2S7A5372.JPG' },
  { id: 13, name: '补中益气丸', price: 38.0, image: 'https://smf.lntcm.com/static/medicine/2S7A5373.JPG' },
  { id: 14, name: '逍遥丸', price: 32.0, image: 'https://smf.lntcm.com/static/medicine/2S7A5374.JPG' },
  { id: 15, name: '归脾丸', price: 55.0, image: 'https://smf.lntcm.com/static/medicine/2S7A5375.JPG' }
])

const productImages = computed(() => {
  if (product.value.images && product.value.images.length > 0) {
    return product.value.images
  }
  return product.value.image ? [product.value.image] : [getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')]
})

const showDetailImages = computed(() => !product.value.intro && productImages.value.length > 0)
const usageText = computed(() => product.value.commonUsage || product.value.usageDesc || '')
const selectedSpec = computed(() => product.value.specText || product.value.packageSpec || product.value.unit || '默认规格')
const priceInteger = computed(() => {
  const [integer = '0'] = (Number(product.value.price || 0).toFixed(2)).split('.')
  return integer
})
const priceDecimal = computed(() => {
  const [, decimal = '00'] = (Number(product.value.price || 0).toFixed(2)).split('.')
  return decimal
})
const originTypeText = computed(() => {
  if (product.value.originType === 1) return '国产'
  if (product.value.originType === 2) return '进口'
  return ''
})

const specItems = computed(() => {
  return [
    { label: '药品名称', value: product.value.name },
    { label: '规格', value: product.value.specText },
    { label: '包装', value: product.value.packageSpec },
    { label: '剂型', value: product.value.dosageForm },
    { label: '性状', value: product.value.appearanceDesc },
    { label: '有效期', value: product.value.validityPeriod },
    { label: '产地类型', value: originTypeText.value },
    { label: '批准文号', value: product.value.approvalNumber },
    { label: '生产单位', value: product.value.manufacturer },
    { label: '执行标准', value: product.value.executionStandard },
    { label: '温馨提示', value: product.value.warmTips }
  ].filter(item => item.value)
})

const usageItems = computed(() => {
  return [
    { label: '药物组成', value: product.value.ingredients },
    { label: '功能主治', value: product.value.indications },
    { label: '用法用量', value: usageText.value },
    { label: '不良反应', value: product.value.adverseReactions },
    { label: '禁忌', value: product.value.contraindication },
    { label: '注意事项', value: product.value.precautions },
    { label: '贮藏', value: product.value.storageCondition }
  ].filter(item => item.value)
})

const loadCartCount = () => {
  const productQuantities = uni.getStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES) || {}
  cartCount.value = Object.values(productQuantities).reduce((sum, current) => sum + (Number(current) || 0), 0)
}

const loadQuantityFromStorage = () => {
  if (!product.value.id) return
  try {
    isInitializing.value = true
    const productQuantities = uni.getStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES) || {}
    const savedQuantity = productQuantities[product.value.id]
    quantity.value = savedQuantity && savedQuantity > 0 ? Number(savedQuantity) : 1
  } catch (error) {
    console.error('加载商品数量失败:', error)
  } finally {
    isInitializing.value = false
  }
}

watch(quantity, (value) => {
  if (!product.value.id || isInitializing.value) return
  const nextQuantity = Math.max(1, Number(value) || 1)
  saveToCart(product.value.id, nextQuantity, true)
  loadCartCount()
})

const applyProduct = (source) => {
  const mapped = mapProductDetail(source)
  product.value = {
    ...createEmptyProduct(),
    ...mapped
  }
}

const loadProduct = async (id) => {
  try {
    uni.showLoading({ title: '加载中...' })
    const response = await getProductDetail(id)
    applyProduct(response)
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
  const normalizeRichText = (content) => content
      .replace(/<img([^>]*)style=(['"])(.*?)\2([^>]*)>/gi, (match, before, quote, styleContent, after) => {
        const sanitizedStyle = styleContent
          .replace(/(?:^|;)\s*width\s*:[^;]*/gi, '')
          .replace(/(?:^|;)\s*height\s*:[^;]*/gi, '')
          .trim()
        const nextStyle = `max-width:100%;width:100%;height:auto;display:block;box-sizing:border-box;${sanitizedStyle ? ` ${sanitizedStyle}` : ''}`.trim()
        return `<img${before}style="${nextStyle}"${after}>`
      })
      .replace(/<img((?:(?!style=)[^>])*)>/gi, '<img$1 style="max-width:100%;width:100%;height:auto;display:block;box-sizing:border-box;">')

  if (typeof htmlContent === 'string') {
    return normalizeRichText(
      htmlContent
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
    )
  }
  return normalizeRichText(String(htmlContent))
}

const addCart = () => {
  if (!product.value.id) return
  saveToCart(product.value.id, quantity.value, true)
  loadCartCount()
  uni.showToast({ title: '已加入购物车', icon: 'success' })
}

const buyNow = () => {
  if (!product.value.id) return
  saveToCart(product.value.id, quantity.value, true)
  loadCartCount()
  uni.navigateTo({
    url: `/pages/products/product_notice?id=${product.value.id}`
  })
}

const handleBannerChange = (event) => {
  currentIndex.value = event.detail.current + 1
}

const showManualDrawer = () => {
  showManual.value = true
}
const closeManualDrawer = () => {
  showManual.value = false
}
const showPolicyDrawer = () => {
  showPolicy.value = true
}
const closePolicyDrawer = () => {
  showPolicy.value = false
}
const switchDetailTab = (tab) => {
  detailTab.value = tab
}
const switchRecommendTab = (tab) => {
  recommendTab.value = tab
}
const goBack = () => {
  uni.navigateBack()
}
const handleMore = () => {
  uni.showActionSheet({
    itemList: ['返回商品列表', '查看购物车'],
    success: ({ tapIndex }) => {
      if (tapIndex === 0) {
        uni.navigateTo({ url: '/pages/products/medicine_list' })
      } else if (tapIndex === 1) {
        goCart()
      }
    }
  })
}
const goConsult = () => {
  uni.showToast({
    title: '在线咨询功能建设中',
    icon: 'none'
  })
}
const toggleCollect = () => {
  isCollected.value = !isCollected.value
}
const goCart = () => {
  uni.navigateTo({
    url: '/pages/cart/cart'
  })
}

const addToCart = (item) => {
  const cartData = uni.getStorageSync('cartItems') || []
  const existIndex = cartData.findIndex(i => i.id === item.id)
  let newQty = 1
  if (existIndex > -1) {
    cartData[existIndex].quantity += 1
    newQty = cartData[existIndex].quantity
  } else {
    cartData.push({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      quantity: 1,
      checked: true
    })
  }
  uni.setStorageSync('cartItems', cartData)
  loadCartCount()
  cartQuantities.value[item.id] = newQty
  return newQty
}

const flyToCart = (e, item) => {
  addToCart(item)

  try {
    const query = uni.createSelectorQuery().in(getCurrentInstance())
    query.select('.action-icon-btn').boundingClientRect((target) => {
      query.select('.recommend-add-btn').boundingClientRect((source) => {
        if (target && source) {
          flyingDot.show = true
          const windowWidth = uni.getSystemInfoSync().windowWidth
          flyingDot.x = source.left + 10
          flyingDot.y = source.top + 10

          setTimeout(() => {
            flyingDot.x = 50
            flyingDot.y = window.screen.height - 200
            setTimeout(() => {
              flyingDot.show = false
            }, 400)
          }, 50)
        }
      }).exec()
    }).exec()
  } catch (err) {
    console.log('Animation error:', err)
  }
}

onLoad((options) => {
  logPageView('MEDICINE_DETAIL', options?.id || '')
  product.value = createEmptyProduct()

  if (options.id) {
    loadProduct(options.id)
  } else if (options.product) {
    try {
      const parsed = JSON.parse(decodeURIComponent(options.product))
      applyProduct(parsed)
      if (parsed.id) {
        loadProduct(parsed.id)
      } else {
        loadQuantityFromStorage()
      }
    } catch (error) {
      console.error('解析商品参数失败:', error)
    }
  }

  loadCartCount()
})

const loadRecommendCartQuantities = () => {
  const cartData = uni.getStorageSync('cartItems') || []
  const allProducts = [...comboProducts.value, ...starProducts.value]
  allProducts.forEach(item => {
    const cartItem = cartData.find(i => i.id === item.id)
    if (cartItem) {
      cartQuantities.value[item.id] = cartItem.quantity
    }
  })
}

onShow(() => {
  loadCartCount()
  loadQuantityFromStorage()
  loadRecommendCartQuantities()
})
</script>

<style lang="scss" scoped>
.page {
  background: #fff;
  min-height: 100vh;
  padding-bottom: calc(100rpx + env(safe-area-inset-bottom));
  z-index: -1;
}

.page-lock {
  overflow: hidden;
  height: 100vh;
  touch-action: none;
}

.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 88rpx;
  background: rgba(255, 255, 255, 0.98);
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  z-index: 100;
  border-bottom: 1rpx solid #eee;
}

.header-left, .header-right {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-back {
  font-size: 48rpx;
  color: #333;
  font-weight: bold;
}

.icon-more {
  font-size: 36rpx;
  color: #333;
}

.header-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
}

.banner-wrapper {
  position: relative;
  background: #fff;
}

.banner {
  height: 750rpx;
}

.banner-img {
  width: 100%;
  height: 100%;
}

.banner-index {
  position: absolute;
  right: 24rpx;
  bottom: 24rpx;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  padding: 8rpx 20rpx;
  border-radius: 30rpx;
  font-size: 24rpx;
}

.price-box {
  margin-bottom: 18rpx;
  background:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10rpx,
      rgba(255, 255, 255, 0.03) 10rpx,
      rgba(255, 255, 255, 0.03) 20rpx
    ),
    linear-gradient(90deg, #e63939, #ff4b4b);
  padding: 20rpx 30rpx 16rpx;
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  border-radius: 36rpx 36rpx 0 0;
}

.price-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.price-left {
  display: flex;
  flex-direction: column;
}

.price-tag {
  display: inline-block;
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: 18rpx;
  padding: 4rpx 14rpx;
  border-radius: 20rpx;
  margin-bottom: 8rpx;
  width: fit-content;
  font-weight: bold;
}

.price-info {
  display: flex;
  align-items: baseline;
  color: #fff;
}

.price-unit {
  font-size: 22rpx;
  font-weight: bold;
  color: #fff;
}

.price-num {
  font-size: 44rpx;
  font-weight: bold;
  color: #fff;
}

.price-decimal {
  font-size: 26rpx;
  font-weight: bold;
  color: #fff;
}

.price-right {
  display: flex;
  align-items: center;
}

.sales-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.sales-icon {
  font-size: 24rpx;
  margin-bottom: 4rpx;
}

.sales-count {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.9);
}

.trust-badges {
  display: flex;
  justify-content: flex-start;
  gap: 20rpx;
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx dashed rgba(255, 255, 255, 0.3);
  flex-wrap: wrap;
}

.trust-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.trust-icon {
  font-size: 22rpx;
  width: 28rpx;
  height: 28rpx;
  vertical-align: middle;
}

.trust-text {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.95);
}

.goods-info {
  background: #fff;
  padding: 0 30rpx 2rpx;
}

.goods-name-row {
  display: inline;
  vertical-align: middle;
}

.self-developed-tag,
.new-product-tag,
.star-product-tag,
.goods-name {
  vertical-align: middle;
}

.self-developed-tag,
.new-product-tag,
.star-product-tag {
  font-size: 20rpx;
  padding: 4rpx 10rpx;
  border-radius: 4rpx;
  font-weight: bold;
  flex-shrink: 0;
  margin-right: 12rpx;
  margin-bottom: 8rpx;
  display: inline;
}

.self-developed-tag {
  background: #ff4b4b;
  color: #fff;
}

.new-product-tag {
  background: #4a4a4a;
  color: #d4af37;
}

.star-product-tag {
  background: #00c792;
  color: #fff;
}

.goods-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #222;
  line-height: 1.4;
  word-break: break-all;
}

.goods-sub {
  font-size: 26rpx;
  color: #888;
  margin-top: 8rpx;
}

.drug-reminder {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
}

.policy-row {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 16rpx 30rpx;
}

.policy-row .policy-text {
  flex: 1;
}

.policy-text {
  font-size: 24rpx;
  color: #666;
}

.policy-overlay,
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
}

.policy-drawer,
.drawer-content {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  max-height: 85vh;
  height: auto;
}

.policy-header,
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #eee;
  position: relative;
}

.policy-title,
.drawer-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.policy-close,
.drawer-close {
  position: absolute;
  right: 30rpx;
  top: 30rpx;
  font-size: 48rpx;
  color: #999;
}

.policy-body,
.drawer-body {
  width: 690rpx;
  padding: 30rpx;
  max-height: calc(85vh - 120rpx);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.drawer-body::-webkit-scrollbar {
  display: none;
}


.policy-section {
  margin-bottom: 30rpx;
}

.policy-section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 12rpx;
}

.check-icon {
  color: #ff4b4b;
  margin-right: 8rpx;
}

.policy-content {
  font-size: 26rpx;
  color: #666;
  line-height: 1.7;
}

.policy-footer {
  padding: 20rpx 30rpx 40rpx;
}

.policy-confirm-btn {
  background: linear-gradient(135deg, #ffd000, #ffb800);
  color: #333;
  font-size: 32rpx;
  font-weight: bold;
  text-align: center;
  padding: 24rpx 0;
  border-radius: 44rpx;
}

.select-section {
  background: #fff;
  padding: 20rpx 30rpx;
  display: flex;
  align-items: center;
}

.select-label {
  font-size: 28rpx;
  color: #999;
  margin-right: 20rpx;
}

.select-value {
  flex: 1;
  font-size: 28rpx;
  color: #222;
}

.select-num {
  color: #ff4b4b;
}

.select-arrow {
  font-size: 36rpx;
  color: #999;
}

.promise-box {
  background: #fff;
  padding: 20rpx 30rpx;
  display: flex;
  flex-wrap: wrap;
}

.promise-item {
  display: flex;
  align-items: center;
  margin-right: 30rpx;
  margin-bottom: 12rpx;
}

.promise-icon {
  font-size: 22rpx;
  color: #00c792;
  margin-right: 6rpx;
}

.promise-text {
  font-size: 22rpx;
  color: #666;
}

.delivery-row {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 5rpx 30rpx 30rpx;
}

.delivery-label {
  font-size: 26rpx;
  color: #222;
  margin-right: 16rpx;
}

.delivery-text {
  font-size: 26rpx;
  color: #222;
}

.sf-logo {
  width: 34rpx;
  height: 30rpx;
  margin-right: 12rpx;
}

.drug-manual-card {
  background: #f5f5f5;
  border-radius: 16rpx;
  margin: 20rpx 30rpx;
  padding: 24rpx;
  display: flex;
  align-items: flex-start;
  position: relative;
}

.manual-item {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.manual-item-title {
  font-size: 26rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.manual-item-content {
  font-size: 24rpx;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280rpx;
}

.manual-divider {
  width: 1rpx;
  height: 60rpx;
  background: #ddd;
  margin: 0 24rpx;
}

.manual-arrow {
  font-size: 36rpx;
  color: #999;
  position: absolute;
  right: 24rpx;
}

.drawer-section {
  margin-bottom: 30rpx;
}

.drawer-label {
  font-size: 28rpx;
  color: #333;
  font-weight: bold;
  display: block;
  margin-bottom: 12rpx;
}

.drawer-text {
  font-size: 26rpx;
  color: #666;
  line-height: 1.8;
}

.split-line {
  height: 20rpx;
  background: #f4f4f4;
}

.recommend-section {
  padding: 30rpx 0;
  width: 100%;
}

.recommend-section.combo-section {
  background: linear-gradient(180deg, #c8e6c9, #fff);
}

.recommend-section.star-section {
  background: linear-gradient(180deg, #ffecb3, #fff);
}

.recommend-tabs {
  display: flex;
  justify-content: flex-start;
  gap: 60rpx;
  padding-left: 30rpx;
  margin-bottom: 24rpx;
}

.recommend-tab {
  font-size: 28rpx;
  color: #333;
  padding-bottom: 8rpx;
  position: relative;
}

.recommend-tab.active {
  color: #e63939;
  font-weight: bold;
}

.recommend-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 50rpx;
  height: 4rpx;
  background: #e63939;
  border-radius: 2rpx;
}

.combo-disclaimer {
  font-size: 22rpx;
  color: #999;
  padding: 0 30rpx 16rpx;
  letter-spacing: 1rpx;
}

.recommend-content {
  padding: 20rpx 30rpx;
  border-radius: 16rpx;
  margin: 0;
  width: 100%;
  box-sizing: border-box;
}

.recommend-scroll {
  white-space: nowrap;
  width: 100%;
}

.recommend-item {
  display: inline-block;
  width: 200rpx;
  margin-right: 20rpx;
  vertical-align: top;
}

.recommend-img {
  width: 200rpx;
  height: 200rpx;
  border-radius: 12rpx;
  background: #f5f5f5;
}

.recommend-info {
  padding: 12rpx 0;
}

.recommend-name {
  display: block;
  font-size: 24rpx;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8rpx;
}

.recommend-price {
  font-size: 26rpx;
  color: #e63939;
  font-weight: bold;
}

.recommend-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.recommend-add-btn {
  width: 40rpx;
  height: 40rpx;
  background: linear-gradient(135deg, #e63939, #ff4b4b);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: bold;
  line-height: 1;
}

.recommend-add-btn.has-quantity {
  background: linear-gradient(135deg, #ff4b4b, #ff6b6b);
  font-size: 22rpx;
}

.flying-dot {
  position: fixed;
  width: 20rpx;
  height: 20rpx;
  background: #e63939;
  border-radius: 50%;
  z-index: 9999;
  pointer-events: none;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.pharmacist-card {
  background: linear-gradient(135deg, #f0fdf9, #e6f7f1);
  padding: 28rpx 30rpx;
  display: flex;
  align-items: center;
  border-radius: 20rpx;
  margin: 20rpx 24rpx;
  border: 1rpx solid #d4f0e6;
  box-shadow: 0 4rpx 20rpx rgba(0, 199, 146, 0.08);
}

.pharmacist-avatar-wrap {
  position: relative;
  margin-right: 24rpx;
}

.pharmacist-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  border: 4rpx solid #00c792;
  padding: 4rpx;
  background: #fff;
}

.online-tag {
  position: absolute;
  bottom: 0;
  right: 0;
  background: linear-gradient(135deg, #00c792, #00a676);
  color: #fff;
  font-size: 18rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  font-weight: bold;
  border: 2rpx solid #fff;
}

.pharmacist-detail {
  flex: 1;
}

.pharmacist-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #1a1a1a;
  display: flex;
  align-items: center;
}

.pharmacist-name::before {
  content: '⚕️';
  margin-right: 8rpx;
  font-size: 28rpx;
}

.pharmacist-desc {
  font-size: 24rpx;
  color: #666;
  margin-top: 6rpx;
}

.consult-btn {
  background: linear-gradient(135deg, #00c792, #00a676);
  color: #fff;
  padding: 14rpx 36rpx;
  border-radius: 40rpx;
  font-size: 26rpx;
  font-weight: bold;
  box-shadow: 0 4rpx 16rpx rgba(0, 199, 146, 0.3);
}

.detail-header {
  background: #fff;
  display: flex;
  border-bottom: 1rpx solid #eee;
}

.detail-tab {
  flex: 1;
  text-align: center;
  padding: 28rpx 0;
  font-size: 28rpx;
  color: #666;
  position: relative;
}

.detail-tab.active {
  color: #ff4b4b;
  font-weight: bold;
}

.detail-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 48rpx;
  height: 4rpx;
  background: #ff4b4b;
  border-radius: 2rpx;
}

.detail-body {
  background: #fff;
  padding: 30rpx;
}

.detail-title,
.usage-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #222;
  margin-bottom: 24rpx;
}

.detail-richtext {
  font-size: 28rpx;
  color: #555;
  line-height: 1.8;
  width: 100%;
  overflow: hidden;
  word-break: break-word;
}

.detail-images {
  margin-top: 30rpx;
}

.detail-img {
  width: 100%;
  display: block;
  margin-bottom: 20rpx;
}

.spec-list,
.usage-list {
  background: #f9f9f9;
  border-radius: 12rpx;
  padding: 24rpx;
}

.spec-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  padding: 20rpx 0 16rpx;
  border-bottom: 2rpx solid #eee;
  margin-bottom: 8rpx;
}

.spec-item {
  display: flex;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #eee;
}

.spec-item:last-child {
  border-bottom: none;
}

.spec-label {
  width: 160rpx;
  font-size: 26rpx;
  color: #999;
}

.spec-value {
  flex: 1;
  font-size: 26rpx;
  color: #333;
}

.usage-box {
  margin-top: 30rpx;
}

.usage-item {
  margin-bottom: 20rpx;
}

.usage-item:last-child {
  margin-bottom: 0;
}

.usage-label {
  font-size: 26rpx;
  color: #999;
  display: block;
  margin-bottom: 8rpx;
}

.usage-text {
  font-size: 26rpx;
  color: #333;
  line-height: 1.6;
}

.empty-block {
  font-size: 28rpx;
  color: #999;
  text-align: center;
  padding: 40rpx 0;
}

.reminder-bar {
  background: #fffbe6;
  padding: 20rpx 30rpx;
  display: flex;
  align-items: center;
  margin: 20rpx 0;
}

.reminder-icon {
  width: 32rpx;
  height: 32rpx;
  background: #faad14;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  margin-right: 12rpx;
}

.reminder-text {
  font-size: 24rpx;
  color: #ad6800;
  flex: 1;
  line-height: 1.6;
}

.bottom-space {
  height: 40rpx;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100rpx;
  background: #fff;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 1rpx solid #eee;
  z-index: 100;
}

.bottom-left {
  display: flex;
}

.action-icon-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 40rpx;
}

.action-icon {
  font-size: 40rpx;
}

.action-text {
  font-size: 20rpx;
  color: #666;
  margin-top: 4rpx;
}

.cart-badge {
  position: absolute;
  top: -8rpx;
  right: -16rpx;
  min-width: 32rpx;
  height: 32rpx;
  background: #ff4b4b;
  color: #fff;
  border-radius: 16rpx;
  font-size: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6rpx;
}

.bottom-right {
  display: flex;
  margin-left: auto;
}

.btn-add-cart, .btn-buy {
  padding: 20rpx 36rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: bold;
}

.btn-add-cart {
  background: #ffa940;
  color: #fff;
  margin-right: 16rpx;
}

.btn-buy {
  background: linear-gradient(135deg, #ff4b4b, #ff6b6b);
  color: #fff;
}
</style>
