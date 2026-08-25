<template>
  <view class="page">
    <view class="hero">
      <view class="hero-card">
        <view class="hero-top">
          <image
            class="hero-logo"
            src="https://shop.lntcm.com/assets_files/upload/2026/01/26/logotou.png"
            mode="aspectFit"
          />
          <view class="hero-badge">官方商城</view>
        </view>
        <view class="hero-title">辽宁中医药大学附属医院互联网商城</view>
        <view class="hero-subtitle">本院产品、健康产品与问卷购药流程统一收口到标准商品链路。</view>
        <view class="hero-tags">
          <text class="hero-tag">院内自营</text>
          <text class="hero-tag">正品保障</text>
          <text class="hero-tag">药师服务</text>
          <text class="hero-tag">顺丰配送</text>
        </view>
        <view class="hero-actions">
          <button class="hero-btn primary" @click="goMedicineList">进入主列表</button>
          <button class="hero-btn secondary" @click="goHealthList">健康商城</button>
        </view>
      </view>
    </view>

    <view class="search-panel" @click="goMedicineList">
      <uni-icons type="search" size="18" color="#999999"></uni-icons>
      <text class="search-placeholder">搜索商品、功效或适用人群</text>
      <text class="search-action">去搜索</text>
    </view>

    <view class="section">
      <view class="section-title">快捷入口</view>
      <view class="shortcut-grid">
        <view class="shortcut-item" @click="goMedicineList">
          <view class="shortcut-icon blue">中药</view>
          <text class="shortcut-name">本院产品</text>
          <text class="shortcut-desc">主商品列表</text>
        </view>
        <view class="shortcut-item" @click="goHealthList">
          <view class="shortcut-icon green">健康</view>
          <text class="shortcut-name">健康商城</text>
          <text class="shortcut-desc">横向分类</text>
        </view>
        <view class="shortcut-item" @click="goHealthListAlt">
          <view class="shortcut-icon orange">分类</view>
          <text class="shortcut-name">分类样式</text>
          <text class="shortcut-desc">纵向分类</text>
        </view>
        <view class="shortcut-item" @click="goCart">
          <view class="shortcut-icon red">购物</view>
          <text class="shortcut-name">购物车</text>
          <text class="shortcut-desc">查看已选商品</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-header">
        <view class="section-title">推荐商品</view>
        <text class="section-link" @click="goMedicineList">查看全部</text>
      </view>
      <view v-if="loading" class="status-state">推荐商品加载中...</view>
      <view v-else-if="loadError" class="status-state error-state">
        <text>推荐商品加载失败，请稍后重试</text>
        <button class="retry-button" @click="loadFeaturedProducts">重新加载</button>
      </view>
      <view v-else-if="featuredProducts.length === 0" class="status-state">暂无推荐商品</view>
      <view v-else class="product-grid">
        <view
          v-for="item in featuredProducts"
          :key="item.id"
          class="product-card"
          @click="goDetail(item)"
        >
          <image class="product-image" :src="getImageUrl(item.image)" mode="aspectFill" />
          <view class="product-body">
            <view class="product-tags">
              <text class="tag primary" v-if="item.bizType === 1">本院产品</text>
              <text class="tag secondary" v-if="item.isHospitalStarFormula === 1">院藏名方</text>
              <text class="tag warning" v-if="item.isNewProduct === 1">新品</text>
            </view>
            <text class="product-name">{{ item.name }}</text>
            <text class="product-desc">{{ item.description || '院内推荐商品' }}</text>
            <view class="product-bottom">
              <text class="product-price">￥{{ Number(item.price || 0).toFixed(2) }}</text>
              <text class="product-sales">已售 {{ item.salesVolume || 0 }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="bottom-space"></view>
    <TabBar current="home" :cartCount="cartCount" @change="handleTabChange" />
  </view>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getCategoryProducts, mapProductListItem } from '@/api/product.js'
import { getImageUrl } from '@/utils/config.js'
import { getCartTotalQuantity } from '@/utils/cart.js'
import { subscribeCartUpdated } from '@/utils/cart-events.js'
import TabBar from '@/components/TabBar/TabBar.vue'

const HOSPITAL_BIZ_TYPE = 1

const featuredProducts = ref([])
const cartCount = ref(0)
const loading = ref(false)
const loadError = ref(false)

const loadFeaturedProducts = async () => {
  if (loading.value) {
    return
  }

  loadError.value = false
  loading.value = true
  try {
    const productPage = await getCategoryProducts(null, 1, 8, HOSPITAL_BIZ_TYPE)
    const productList = productPage.records || productPage.list || []
    featuredProducts.value = productList.map(item => mapProductListItem(item))
  } catch (error) {
    loadError.value = true
    console.error('loadFeaturedProducts failed:', error)
    uni.showToast({
      title: '加载推荐商品失败',
      icon: 'none'
    })
  } finally {
    loading.value = false
  }
}

const loadCartCount = () => {
  cartCount.value = getCartTotalQuantity()
}

const goMedicineList = () => {
  uni.navigateTo({ url: '/pages/products/medicine_list' })
}

const goHealthList = () => {
  uni.navigateTo({ url: '/pages/products/priducts_list' })
}

const goHealthListAlt = () => {
  uni.navigateTo({ url: '/pages/products/priducts_list2' })
}

const goCart = () => {
  uni.navigateTo({ url: '/pages/cart/cart' })
}

const goDetail = (item) => {
  if (!item?.id) {
    return
  }

  uni.navigateTo({
    url: `/pages/products/medicine_detail?id=${item.id}`
  })
}

const handleTabChange = () => {}

let unsubscribeCartUpdated = null

onMounted(() => {
  unsubscribeCartUpdated = subscribeCartUpdated(() => {
    loadCartCount()
  })
})

onUnmounted(() => {
  if (unsubscribeCartUpdated) {
    unsubscribeCartUpdated()
    unsubscribeCartUpdated = null
  }
})

onLoad(() => {
  loadFeaturedProducts()
})

onShow(() => {
  loadCartCount()
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fb;
  padding: 28rpx 24rpx 0;
}

.hero {
  margin-bottom: 24rpx;
}

.hero-card {
  padding: 32rpx 28rpx;
  border-radius: 24rpx;
  background: linear-gradient(145deg, #ffffff 0%, #eef6ff 100%);
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06);
}

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.hero-logo {
  width: 128rpx;
  height: 128rpx;
}

.hero-badge {
  height: 48rpx;
  line-height: 48rpx;
  padding: 0 20rpx;
  background: rgba(22, 163, 74, 0.1);
  color: #15803d;
  border-radius: 24rpx;
  font-size: 24rpx;
  font-weight: 600;
}

.hero-title {
  font-size: 38rpx;
  line-height: 1.4;
  font-weight: 700;
  color: #0f172a;
}

.hero-subtitle {
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: #475569;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 24rpx;
}

.hero-tag {
  padding: 8rpx 16rpx;
  background: #f1f5f9;
  border-radius: 18rpx;
  font-size: 22rpx;
  color: #334155;
}

.hero-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 28rpx;
}

.hero-btn {
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 28rpx;
  margin: 0;
  border: none;
}

.hero-btn::after {
  border: none;
}

.hero-btn.primary {
  background: #1890ff;
  color: #ffffff;
}

.hero-btn.secondary {
  background: #eff6ff;
  color: #2563eb;
}

.search-panel {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 0 24rpx;
  height: 88rpx;
  background: #ffffff;
  border-radius: 20rpx;
  box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.04);
}

.search-placeholder {
  flex: 1;
  font-size: 26rpx;
  color: #94a3b8;
}

.search-action {
  font-size: 24rpx;
  color: #2563eb;
}

.section {
  margin-top: 24rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.section-link {
  font-size: 24rpx;
  color: #2563eb;
}

.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}

.shortcut-item {
  padding: 24rpx;
  border-radius: 20rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.04);
}

.shortcut-icon {
  width: 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 700;
  color: #ffffff;
}

.shortcut-icon.blue {
  background: #2563eb;
}

.shortcut-icon.green {
  background: #16a34a;
}

.shortcut-icon.orange {
  background: #ea580c;
}

.shortcut-icon.red {
  background: #dc2626;
}

.shortcut-name {
  display: block;
  margin-top: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #0f172a;
}

.shortcut-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #64748b;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}

.product-card {
  overflow: hidden;
  border-radius: 20rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.04);
}

.product-image {
  width: 100%;
  height: 240rpx;
  background: #f8fafc;
}

.product-body {
  padding: 18rpx;
}

.product-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  min-height: 36rpx;
}

.tag {
  padding: 4rpx 10rpx;
  border-radius: 14rpx;
  font-size: 20rpx;
  line-height: 1.4;
}

.tag.primary {
  background: #eff6ff;
  color: #2563eb;
}

.tag.secondary {
  background: #ecfccb;
  color: #4d7c0f;
}

.tag.warning {
  background: #fff7ed;
  color: #c2410c;
}

.product-name {
  display: -webkit-box;
  margin-top: 12rpx;
  font-size: 28rpx;
  line-height: 1.5;
  font-weight: 600;
  color: #0f172a;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-desc {
  display: -webkit-box;
  margin-top: 8rpx;
  min-height: 66rpx;
  font-size: 24rpx;
  line-height: 1.4;
  color: #64748b;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18rpx;
}

.product-price {
  font-size: 30rpx;
  font-weight: 700;
  color: #dc2626;
}

.product-sales {
  font-size: 22rpx;
  color: #94a3b8;
}

.status-state {
  padding: 40rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: #94a3b8;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  color: #64748b;
}

.retry-button {
  min-width: 176rpx;
  height: 64rpx;
  margin: 0;
  padding: 0 28rpx;
  border: none;
  border-radius: 32rpx;
  background: #2563eb;
  color: #ffffff;
  font-size: 24rpx;
  line-height: 64rpx;
}

.retry-button::after {
  border: none;
}

.bottom-space {
  height: calc(140rpx + env(safe-area-inset-bottom));
}
</style>
