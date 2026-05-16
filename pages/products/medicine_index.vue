<template>
  <view class="page">
    <!-- 商城介绍 -->
    <view class="hospital-intro">
      <view class="logo-wrap">
        <image class="hospital-logo" src="/static/logotou.png" mode="aspectFit" />
        <view class="logo-badge">自营</view>
      </view>
      <view class="hospital-info">
        <view class="hospital-name-row">
          <text class="hospital-name">辽宁中医药大学附属医院云商城</text>
          <text class="verify-icon">✓</text>
        </view>
        <view class="hospital-tags">
          <text class="tag">医院自营</text>
          <text class="tag-sep">|</text>
          <text class="tag">正品保证</text>
          <text class="tag-sep">|</text>
          <text class="tag">月售9999+</text>
          <text class="tag-sep">|</text>
          <text class="tag">顺丰物流</text>
        </view>
      </view>
      <text class="arrow-icon">›</text>
    </view>
    <view class="intro-divider"></view>

    <!-- 顶部搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">🔍</text>
        <input class="search-input" placeholder="搜索药品、科室、医生" />
        <view class="search-btn">搜索</view>
      </view>
    </view>

    <!-- 导航栏 -->
    <view class="nav-section">
      <view class="nav-grid">
        <view class="nav-item" v-for="(nav, index) in navList" :key="index" @click="goToNav(nav)">
          <view class="nav-icon" :style="{ background: nav.bgColor }">
            <text>{{ nav.icon }}</text>
          </view>
          <text class="nav-text">{{ nav.name }}</text>
        </view>
      </view>
    </view>

    <!-- 四个推荐模块 -->
    <view class="module-section">
      <view class="module-grid">
        <view class="module-item" v-for="(mod, index) in moduleList" :key="index" @click="goModule(mod)">
          <view class="module-icon" :style="{ background: mod.bgColor }">
            <text>{{ mod.icon }}</text>
          </view>
          <view class="module-info">
            <view class="module-title">{{ mod.name }}</view>
            <view class="module-desc">{{ mod.desc }}</view>
          </view>
        </view>
      </view>
    </view>
    <view class="split-line"></view>

    <!-- 商品瀑布流 -->
    <view class="waterfall-section">
      <view class="section-header">
        <view class="section-title">
          <text class="title-icon">💊</text>
          <text class="title-text">精选商品</text>
        </view>
      </view>
      <view class="waterfall-container">
        <view class="waterfall-left">
          <view class="waterfall-item" v-for="item in leftProducts" :key="item.id" @click="goDetail(item)">
            <image class="waterfall-image" :src="item.image" mode="widthFix" />
            <view class="waterfall-info">
              <view class="waterfall-name">{{ item.name }}</view>
              <view class="waterfall-desc">{{ item.spec }}</view>
              <view class="waterfall-bottom">
                <view class="waterfall-price">¥{{ item.price }}</view>
                <view class="waterfall-sales">已售{{ item.sales }}+</view>
              </view>
            </view>
          </view>
        </view>
        <view class="waterfall-right">
          <view class="waterfall-item" v-for="item in rightProducts" :key="item.id" @click="goDetail(item)">
            <image class="waterfall-image" :src="item.image" mode="widthFix" />
            <view class="waterfall-info">
              <view class="waterfall-name">{{ item.name }}</view>
              <view class="waterfall-desc">{{ item.spec }}</view>
              <view class="waterfall-bottom">
                <view class="waterfall-price">¥{{ item.price }}</view>
                <view class="waterfall-sales">已售{{ item.sales }}+</view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部占位 -->
    <view class="bottom-space"></view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { getImageUrl } from '@/utils/config.js'

const navList = ref([
  { name: '养生好茶', icon: '🍵', bgColor: '#e8f5e9', url: '' },
  { name: '健康专栏', icon: '📖', bgColor: '#e3f2fd', url: '' },
  { name: '家庭常备药', icon: '💊', bgColor: '#fff3e0', url: '' },
  { name: '看病买药', icon: '🩺', bgColor: '#fce4ec', url: '' },
  { name: '医疗养护', icon: '🏥', bgColor: '#f3e5f5', url: '' }
])

const moduleList = ref([
  { name: '限时特惠', desc: '精选特价药品', icon: '⏰', bgColor: '#ffebee' },
  { name: '新品上市', desc: '最新药品上架', icon: '🆕', bgColor: '#e3f2fd' },
  { name: '热销榜单', desc: '畅销药品推荐', icon: '🔥', bgColor: '#fff3e0' },
  { name: '中医特色', desc: '传统中医良方', icon: '🌿', bgColor: '#e8f5e9' }
])

const tcmProducts = ref([
  {
    id: 1,
    name: '人参养胃汤',
    spec: '10袋/盒',
    price: '68.00',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png'),
    hot: true
  },
  {
    id: 2,
    name: '枸杞菊花茶',
    spec: '20包/盒',
    price: '35.00',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_zhou1.png'),
    hot: false
  },
  {
    id: 3,
    name: '当归补血颗粒',
    spec: '12袋/盒',
    price: '58.00',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png'),
    hot: true
  },
  {
    id: 4,
    name: '川贝清肺糖浆',
    spec: '120ml/瓶',
    price: '42.00',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_zhou1.png'),
    hot: false
  },
  {
    id: 5,
    name: '金银花露',
    spec: '250ml/瓶',
    price: '28.00',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png'),
    hot: false
  }
])

const allProducts = ref([
  {
    id: 1,
    name: '人参养胃汤',
    spec: '10袋/盒',
    price: '68.00',
    sales: 2560,
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')
  },
  {
    id: 2,
    name: '枸杞菊花茶',
    spec: '20包/盒',
    price: '35.00',
    sales: 1890,
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_zhou1.png')
  },
  {
    id: 3,
    name: '当归补血颗粒',
    spec: '12袋/盒',
    price: '58.00',
    sales: 3200,
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')
  },
  {
    id: 4,
    name: '川贝清肺糖浆',
    spec: '120ml/瓶',
    price: '42.00',
    sales: 1580,
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_zhou1.png')
  },
  {
    id: 5,
    name: '金银花露',
    spec: '250ml/瓶',
    price: '28.00',
    sales: 4100,
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')
  },
  {
    id: 6,
    name: '复方感冒灵颗粒',
    spec: '10g×9袋',
    price: '16.80',
    sales: 5800,
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')
  },
  {
    id: 7,
    name: '板蓝根颗粒',
    spec: '10g×20袋',
    price: '22.50',
    sales: 8900,
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_zhou1.png')
  },
  {
    id: 8,
    name: '维生素C泡腾片',
    spec: '10片/盒',
    price: '18.50',
    sales: 2300,
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')
  }
])

const leftProducts = computed(() => {
  return allProducts.value.filter((_, index) => index % 2 === 0)
})

const rightProducts = computed(() => {
  return allProducts.value.filter((_, index) => index % 2 === 1)
})

const goToNav = (nav) => {
  uni.showToast({ title: nav.name, icon: 'none' })
}

const goMore = (type) => {
  uni.showToast({ title: '查看更多', icon: 'none' })
}

const goModule = (mod) => {
  uni.showToast({ title: mod.name, icon: 'none' })
}

const goDetail = (item) => {
  uni.navigateTo({
    url: `/pages/products/medicine_detail?id=${item.id}`
  })
}

const addToCart = (item) => {
  let cart = uni.getStorageSync('medicine_cart') || []
  const existIdx = cart.findIndex(c => c.id === item.id)
  
  if (existIdx > -1) {
    cart[existIdx].quantity += 1
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: parseFloat(item.price),
      sku: item.spec,
      quantity: 1,
      image: item.image
    })
  }
  
  uni.setStorageSync('medicine_cart', cart)
  uni.showToast({ title: '已加入购物车', icon: 'success' })
}
</script>

<style lang="scss" scoped>
.page {
  background: #f5f5f5;
  min-height: 100vh;
}

.hospital-intro {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 24rpx 30rpx;
}

.logo-wrap {
  position: relative;
  margin-right: 20rpx;
}

.hospital-logo {
  width: 100rpx;
  height: 100rpx;
  border-radius: 12rpx;
  background: transparent;
}

.logo-badge {
  position: absolute;
  bottom: -8rpx;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #ff6b6b, #ff4b4b);
  color: #fff;
  font-size: 16rpx;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
  white-space: nowrap;
}

.hospital-info {
  flex: 1;
}

.hospital-name-row {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}

.hospital-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.verify-icon {
  color: #52c41a;
  font-size: 24rpx;
  margin-left: 8rpx;
}

.self-badge {
  background: linear-gradient(135deg, #ff6b6b, #ff4b4b);
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 10rpx;
  border-radius: 4rpx;
  margin-right: 12rpx;
}

.hospital-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8rpx;
}

.tag {
  font-size: 22rpx;
  color: #666;
}

.tag-sep {
  color: #ddd;
  font-size: 20rpx;
}

.arrow-icon {
  font-size: 36rpx;
  color: #ccc;
  margin-left: 12rpx;
}

.tag {
  font-size: 22rpx;
  color: #666;
}

.intro-divider {
  height: 16rpx;
  background: #f5f5f5;
}

.search-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #fff;
  padding: 20rpx 30rpx;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  background: #f5f5f5;
  border-radius: 40rpx;
  padding: 12rpx 20rpx;
}

.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
  color: #999;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.search-btn {
  background: linear-gradient(135deg, #ff6b6b, #ff4b4b);
  color: #fff;
  font-size: 26rpx;
  padding: 12rpx 28rpx;
  border-radius: 30rpx;
  margin-left: 12rpx;
}

.nav-section {
  background: #fff;
  padding: 30rpx 20rpx;
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 20rpx;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.nav-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  margin-bottom: 12rpx;
}

.nav-text {
  font-size: 22rpx;
  color: #333;
  white-space: nowrap;
}

.banner-section {
  background: #fff;
  padding: 0 30rpx 30rpx;
}

.module-section {
  background: #fff;
  padding: 24rpx 30rpx;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.module-item {
  display: flex;
  align-items: center;
  background: #fafafa;
  border-radius: 12rpx;
  padding: 20rpx;
}

.module-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  margin-right: 16rpx;
}

.module-info {
  flex: 1;
}

.module-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
}

.module-desc {
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
}

.recommend-section {
  background: #fff;
  padding: 24rpx 30rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section-title {
  display: flex;
  align-items: center;
}

.title-icon {
  font-size: 32rpx;
  margin-right: 10rpx;
}

.title-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.section-more {
  display: flex;
  align-items: center;
  font-size: 24rpx;
  color: #999;
}

.more-arrow {
  font-size: 28rpx;
  margin-left: 4rpx;
}

.recommend-scroll {
  white-space: nowrap;
}

.recommend-list {
  display: inline-flex;
}

.recommend-item {
  width: 200rpx;
  margin-right: 16rpx;
  display: inline-block;
  vertical-align: top;
  background: #fff;
  border-radius: 12rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
}

.recommend-item:last-child {
  margin-right: 0;
}

.item-image-wrap {
  position: relative;
  width: 200rpx;
  height: 160rpx;
}

.item-image {
  width: 100%;
  height: 100%;
  background: #f5f5f5;
}

.hot-tag {
  position: absolute;
  top: 0;
  right: 0;
  background: #ff4b4b;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 10rpx;
  border-radius: 0 12rpx 0 12rpx;
}

.item-info {
  padding: 16rpx;
}

.item-name {
  font-size: 26rpx;
  color: #333;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-desc {
  font-size: 22rpx;
  color: #999;
  margin-top: 6rpx;
}

.item-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12rpx;
}

.item-price {
  font-size: 28rpx;
  color: #ff4b4b;
  font-weight: bold;
}

.item-add-btn {
  width: 44rpx;
  height: 44rpx;
  background: #ff4b4b;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  font-weight: bold;
  line-height: 1;
}

.split-line {
  height: 20rpx;
  background: #f5f5f5;
}

.waterfall-section {
  background: linear-gradient(to bottom, #f5f0e8 0rpx, #f5f0e8 200rpx, #fff 300rpx);
  padding: 24rpx 20rpx;
}

.waterfall-container {
  display: flex;
  padding: 0 10rpx;
}

.waterfall-left {
  flex: 1;
  padding: 0 10rpx;
}

.waterfall-right {
  flex: 1;
  padding: 0 10rpx;
}

.waterfall-item {
  background: #fff;
  border-radius: 12rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
}

.waterfall-image {
  width: 100%;
  display: block;
  background: #f5f5f5;
}

.waterfall-info {
  padding: 16rpx;
}

.waterfall-name {
  font-size: 26rpx;
  color: #333;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.waterfall-desc {
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
}

.waterfall-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12rpx;
}

.waterfall-price {
  font-size: 28rpx;
  color: #ff4b4b;
  font-weight: bold;
}

.waterfall-sales {
  font-size: 20rpx;
  color: #999;
}

.bottom-space {
  height: 120rpx;
}
</style>
