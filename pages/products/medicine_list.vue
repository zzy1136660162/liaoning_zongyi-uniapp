<template>
  <view class="product-container">
    <view class="banner-section">
      <image class="banner-image" :src="getImageUrl('/profile/liaoning_zongyi/banner_bg.png')" mode="widthFix"></image>
    </view>

    <view class="search-section">
      <view class="search-bar">
        <uni-icons type="search" size="18" color="#999999"></uni-icons>
        <input class="search-input" placeholder="搜索" v-model="searchKeyword" @input="handleSearch" />
        <button class="search-btn" @click="handleSearch">搜索</button>
      </view>
    </view>

    <view class="main-content">
      <scroll-view class="category-nav" scroll-y>
        <view
          class="category-item"
          v-for="category in categories"
          :key="category.id"
          :class="{ active: currentCategoryId === category.id }"
          @click="switchCategory(category.id)"
        >
          <text class="category-name">{{ category.name }}</text>
        </view>
      </scroll-view>

      <view class="product-list-wrapper">
        <view class="product-list-header">
          <view class="prescription-title" @click="switchToHorizontalLayout">
            <text class="prescription-text">药方</text>
            <image class="prescription-icon" :src="getImageUrl('/profile/liaoning_zongyi/list_icon1.png')" mode="aspectFit"></image>
          </view>
          <view class="history-order" @click="goToHistory">
            <uni-icons type="list" size="18" color="#666666"></uni-icons>
            <text class="history-text">历史订单</text>
          </view>
        </view>

        <scroll-view class="product-list" scroll-y>
          <view class="product-items">
            <view class="product-item" v-for="product in filteredProducts" :key="product.id">
              <view class="image-wrapper">
                <image class="product-image" :src="getImageUrl(product.image)" mode="aspectFill" @click="goToDetail(product)"></image>
                <view class="hot-badge" v-if="product.isNewProduct === 1">新</view>
              </view>
              <view class="product-info">
                <text class="product-name" @click="goToDetail(product)">
                  <text class="self-tag" v-if="product.bizType === 1">自研</text>
                  <text class="self-tag2" v-if="product.isHospitalStarFormula === 1">院藏王牌制剂</text>
                  <text class="self-tag3" v-if="product.isNewProduct === 1">重磅新品</text>
                  {{ product.name }}
                </text>
                <text class="product-desc" v-if="product.description">{{ product.description }}</text>
                <view class="product-footer">
                  <text class="product-unit">{{ product.specText || product.unit || '' }}</text>
                  <view class="product-price-row">
                    <view v-if="isProductVerified(product.id)" class="quantity-selector">
                      <button class="quantity-btn" @click="decreaseQuantity(product)">-</button>
                      <text class="quantity-text">{{ getProductQuantity(product.id) }}</text>
                      <button class="quantity-btn" @click="increaseQuantity(product)">+</button>
                    </view>
                    <template v-else>
                      <text class="product-price">￥{{ Number(product.price || 0).toFixed(2) }}</text>
                      <view class="add-btn" @click="goToNotice(product)">+</view>
                    </template>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <view class="cart-bar">
      <view class="cart-icon-wrapper" @click="showCart" id="cart-icon-target">
        <view class="cart-icon">
          <uni-icons type="cart" size="30" color="#ffffff"></uni-icons>
        </view>
        <view class="cart-badge" v-if="cartCount > 0">{{ cartCount }}</view>
      </view>
      <view class="cart-info">
        <text class="cart-total">￥ {{ totalPrice.toFixed(2) }}</text>
        <text class="cart-tip">不含复诊费，实际金额以结算为准</text>
      </view>
      <button class="submit-btn" @click="handleSubmit">提交</button>
    </view>

    <TabBar :current="currentTab" :cartCount="cartCount" @change="handleTabChange" />

    <view
      class="fly-ball"
      v-if="showFlyBall"
      :style="{
        left: flyBallStyle.left + 'px',
        top: flyBallStyle.top + 'px',
        transform: `translate(-50%, -50%) scale(${flyBallStyle.scale})`
      }"
    ></view>
  </view>
</template>

<script>
import {
  STORAGE_KEY_VERIFIED_PRODUCTS,
  STORAGE_KEY_PRODUCT_QUANTITIES,
  STORAGE_KEY_USER_REGISTER
} from '@/utils/storage.js'
import { getCategoryList, getCategoryProducts, mapProductListItem } from '@/api/product.js'
import { loadCartItems, calculateTotalPrice, calculateTotalQuantity } from '@/utils/cart.js'
import { getImageUrl } from '@/utils/config.js'
import { getToken } from '@/utils/request.js'
import TabBar from '@/components/TabBar/TabBar.vue'

export default {
  components: { TabBar },
  data() {
    return {
      searchKeyword: '',
      currentCategoryId: 'all',
      categories: [],
      cartItems: [],
      showFlyBall: false,
      flyBallStyle: {
        left: 0,
        top: 0,
        scale: 1
      },
      verifiedProducts: {},
      productQuantities: {},
      currentTab: 'home',
      loadedCategories: {},
      categoryList: []
    }
  },
  computed: {
    filteredProducts() {
      const category = this.categories.find(cat => cat.id === this.currentCategoryId)
      if (!category) return []

      let products = category.products || []
      if (this.searchKeyword.trim()) {
        const keyword = this.searchKeyword.trim().toLowerCase()
        products = products.filter(product =>
          product.name.toLowerCase().includes(keyword) ||
          (product.description && product.description.toLowerCase().includes(keyword))
        )
      }
      return products
    },
    cartCount() {
      return calculateTotalQuantity(this.cartItems)
    },
    totalPrice() {
      return calculateTotalPrice(this.cartItems)
    }
  },
  onLoad() {
    this.currentTab = 'home'
    uni.$on('refreshProductsList', this.loadVerifiedProductsFromStorage)
    this.loadProducts()
  },
  onShow() {
    this.loadVerifiedProductsFromStorage()
  },
  onUnload() {
    uni.$off('refreshProductsList', this.loadVerifiedProductsFromStorage)
  },
  methods: {
    getImageUrl,
    handleSearch() {},
    async loadProducts() {
      try {
        uni.showLoading({ title: '加载中...' })
        const categoryList = await getCategoryList()
        this.categoryList = categoryList
        this.categories = [
          { id: 'all', name: '全部分类', products: [] },
          ...categoryList.map(cat => ({ id: cat.id, name: cat.name, products: [] }))
        ]
        await this.loadAllProducts()
        this.$set(this.loadedCategories, 'all', true)
        this.loadVerifiedProductsFromStorage()
      } catch (error) {
        console.error('加载商品分类失败:', error)
        uni.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
    async loadAllProducts() {
      const productPage = await getCategoryProducts(null, 1, 100)
      const productList = productPage.records || productPage.list || []
      const allProducts = productList.map(item => mapProductListItem(item))
      const allCategory = this.categories.find(cat => cat.id === 'all')
      if (allCategory) {
        allCategory.products = allProducts
      }
    },
    async loadCategoryProducts(categoryId) {
      if (this.loadedCategories[categoryId]) return
      const productPage = await getCategoryProducts(categoryId, 1, 100)
      const productList = productPage.records || productPage.list || []
      const products = productList.map(item => mapProductListItem(item))
      const category = this.categories.find(cat => cat.id === categoryId)
      if (category) {
        category.products = products
        this.$set(this.loadedCategories, categoryId, true)
      }
    },
    loadVerifiedProductsFromStorage() {
      try {
        this.verifiedProducts = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
        this.productQuantities = uni.getStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES) || {}
        this.cartItems = loadCartItems(this.categories)
      } catch (error) {
        console.error('加载购物车失败:', error)
      }
    },
    async switchCategory(categoryId) {
      this.currentCategoryId = categoryId
      if (categoryId === 'all') {
        if (!this.loadedCategories.all) {
          await this.loadAllProducts()
          this.$set(this.loadedCategories, 'all', true)
        }
        this.loadVerifiedProductsFromStorage()
        return
      }
      await this.loadCategoryProducts(categoryId)
      this.loadVerifiedProductsFromStorage()
    },
    goToDetail(product) {
      uni.navigateTo({
        url: `/pages/products/medicine_detail?id=${product.id}`
      })
    },
    goToNotice(product) {
      const token = getToken()
      if (!token) {
        uni.navigateTo({
          url: '/pages/register/register?redirect=/pages/products/medicine_list'
        })
        return
      }
      uni.navigateTo({
        url: `/pages/products/product_notice?id=${product.id}`
      })
    },
    saveVerifiedProductsToStorage() {
      uni.setStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS, this.verifiedProducts)
      uni.setStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES, this.productQuantities)
    },
    isProductVerified(productId) {
      const productData = this.verifiedProducts[productId]
      if (typeof productData === 'object' && productData !== null) {
        return productData.verified === true
      }
      return productData === true
    },
    getProductQuantity(productId) {
      const productData = this.verifiedProducts[productId]
      if (typeof productData === 'object' && productData !== null) {
        return productData.quantity || 0
      }
      return this.productQuantities[productId] || 0
    },
    increaseQuantity(product) {
      const productData = this.verifiedProducts[product.id]
      if (typeof productData === 'object' && productData !== null) {
        productData.quantity = (productData.quantity || 1) + 1
      } else {
        this.verifiedProducts = {
          ...this.verifiedProducts,
          [product.id]: {
          verified: true,
          selected: true,
          quantity: (this.productQuantities[product.id] || 0) + 1,
          timestamp: Date.now()
          }
        }
      }
      this.productQuantities = {
        ...this.productQuantities,
        [product.id]: this.getProductQuantity(product.id)
      }
      this.saveVerifiedProductsToStorage()
      this.cartItems = loadCartItems(this.categories)
    },
    decreaseQuantity(product) {
      const current = this.getProductQuantity(product.id)
      if (current <= 1) {
        const { [product.id]: _, ...remainingVerifiedProducts } = this.verifiedProducts
        const { [product.id]: __, ...remainingProductQuantities } = this.productQuantities
        this.verifiedProducts = remainingVerifiedProducts
        this.productQuantities = remainingProductQuantities
      } else {
        const productData = this.verifiedProducts[product.id]
        if (typeof productData === 'object' && productData !== null) {
          productData.quantity = current - 1
        }
        this.productQuantities = {
          ...this.productQuantities,
          [product.id]: current - 1
        }
      }
      this.saveVerifiedProductsToStorage()
      this.cartItems = loadCartItems(this.categories)
    },
    showCart() {
      uni.showToast({
        title: `购物车中有${this.cartCount}件商品`,
        icon: 'none'
      })
    },
    handleSubmit() {
      const token = getToken()
      if (!token) {
        uni.navigateTo({
          url: '/pages/register/register?redirect=/pages/products/medicine_list'
        })
        return
      }
      if (this.cartItems.length === 0) {
        uni.showToast({ title: '请先选择商品', icon: 'none' })
        return
      }

      try {
        const userRegisterInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
        if (!userRegisterInfo || !userRegisterInfo.realName) {
          uni.navigateTo({
            url: '/pages/register/register?redirect=/pages/products/medicine_list'
          })
          return
        }
        this.saveVerifiedProductsToStorage()
        uni.navigateTo({ url: '/pages/dispense/apply' })
      } catch (error) {
        console.error('检查注册状态失败:', error)
        uni.navigateTo({
          url: '/pages/register/register?redirect=/pages/products/medicine_list'
        })
      }
    },
    goToHistory() {
      uni.navigateTo({ url: '/pages/order/order_list' })
    },
    handleTabChange(tab) {
      this.currentTab = tab
    },
    switchToHorizontalLayout() {
      uni.navigateTo({ url: '/pages/products/priducts_list' })
    }
  }
}
</script>

<style scoped>
.product-container {
  width: 100%;
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: calc(env(safe-area-inset-bottom));
}

.banner-section {
  width: 100%;
  margin-bottom: 20rpx;
  overflow: hidden;
}

.banner-image {
  width: 100%;
  height: auto;
  display: block;
}

.search-section {
  padding: 20rpx 30rpx;
  background-color: #ffffff;
}

.search-bar {
  display: flex;
  align-items: center;
  background-color: #f5f5f5;
  border-radius: 50rpx;
  padding: 10rpx 10rpx 10rpx 30rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333333;
  padding-right: 10rpx;
}

.search-btn {
  background-color: #4A90E2;
  color: #ffffff;
  font-size: 26rpx;
  padding: 0rpx 24rpx;
  border-radius: 40rpx;
  border: none;
  margin-left: 10rpx;
  flex-shrink: 0;
}

.main-content {
  display: flex;
  height: calc(100vh - 400rpx);
  overflow: scroll;
  padding-bottom: 200rpx;
}

.category-nav {
  width: 200rpx;
  background-color: #ffffff;
  border-right: 1rpx solid #e5e5e5;
}

.category-item {
  padding: 30rpx 20rpx;
  text-align: center;
  border-left: 4rpx solid transparent;
  transition: all 0.3s;
}

.category-item.active {
  background-color: #f0f8ff;
  border-left-color: #4A90E2;
}

.category-item.active .category-name {
  color: #4A90E2;
  font-weight: 500;
}

.category-name {
  font-size: 28rpx;
  color: #666666;
}

.product-list-wrapper {
  padding: 20rpx;
  flex: 1;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
}

.product-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 20rpx 16rpx 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.prescription-title {
  display: flex;
  align-items: center;
}

.prescription-icon {
  width: 32rpx;
  height: 32rpx;
  margin-left: 8rpx;
  flex-shrink: 0;
}

.prescription-text {
  font-size: 32rpx;
  font-weight: 600;
  background: #333;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  position: relative;
  padding-left: 12rpx;
}

.prescription-text::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 6rpx;
  height: 24rpx;
  background: linear-gradient(135deg, #4A90E2 0%, #6BB3FF 100%);
  border-radius: 3rpx;
}

.history-order {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 16rpx;
  border-radius: 30rpx;
}

.history-text {
  font-size: 26rpx;
  color: #666666;
}

.product-list {
  overflow: scroll;
  flex: 1;
}

.product-items {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.product-item {
  width: 100%;
  background-color: #ffffff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: row;
  box-sizing: border-box;
  padding: 20rpx;
  gap: 20rpx;
}

.product-image {
  width: 200rpx;
  height: 200rpx;
  flex-shrink: 0;
  background-color: #f5f5f5;
  border-radius: 12rpx;
}

.image-wrapper {
  position: relative;
}

.hot-badge {
  position: absolute;
  top: 0;
  right: 0;
  background-color: #ff4b4b;
  color: #ffffff;
  font-size: 20rpx;
  font-weight: bold;
  padding: 4rpx 10rpx;
  border-radius: 0 12rpx 0 12rpx;
}

.product-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 120rpx;
}

.product-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333333;
  margin-bottom: 8rpx;
  line-height: 1.4;
  word-wrap: break-word;
  word-break: break-all;
}

.self-tag,
.self-tag2,
.self-tag3 {
  display: inline-block;
  color: #fff;
  font-size: 20rpx;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
  margin-right: 8rpx;
  vertical-align: middle;
}

.self-tag {
  background: #ff4b4b;
}

.self-tag2 {
  background: #333;
  color: #d4af37;
}

.self-tag3 {
  background: #00c792;
}

.product-desc {
  font-size: 22rpx;
  color: #999999;
  margin-bottom: 12rpx;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.product-footer {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: auto;
}

.product-unit {
  font-size: 22rpx;
  color: #999999;
}

.product-price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
}

.product-price {
  font-size: 30rpx;
  font-weight: bold;
  color: #ff6b6b;
}

.add-btn {
  width: 44rpx;
  height: 44rpx;
  background-color: #ff4b4b;
  color: #ffffff;
  font-size: 40rpx;
  font-weight: 300;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  line-height: 1;
}

.quantity-selector {
  display: flex;
  align-items: center;
  gap: 16rpx;
  justify-content: flex-end;
  flex: 1;
}

.quantity-btn {
  width: 44rpx;
  height: 44rpx;
  background-color: #4A90E2;
  color: #ffffff;
  font-size: 26rpx;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
}

.quantity-text {
  font-size: 26rpx;
  color: #333333;
  min-width: 36rpx;
  text-align: center;
}

.cart-bar {
  position: fixed;
  bottom: calc(100rpx + env(safe-area-inset-bottom));
  left: 0;
  right: 0;
  height: 120rpx;
  background-color: #ffffff;
  border-top: 1rpx solid #e5e5e5;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  z-index: 100;
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
  box-sizing: border-box;
}

.cart-icon-wrapper {
  position: relative;
  width: 80rpx;
  height: 80rpx;
  margin-right: 20rpx;
}

.cart-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background-color: #4A90E2;
  color: #ffffff;
  font-size: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.cart-badge {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  background-color: #ff6b6b;
  color: #ffffff;
  font-size: 20rpx;
  min-width: 32rpx;
  height: 32rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8rpx;
}

.cart-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.cart-total {
  font-size: 36rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 4rpx;
}

.cart-tip {
  font-size: 20rpx;
  color: #999999;
}

.submit-btn {
  background-color: #4A90E2;
  color: #ffffff;
  font-size: 32rpx;
  padding: 4rpx 60rpx;
  border-radius: 60rpx;
  border: none;
  font-weight: 500;
}

.fly-ball {
  position: fixed;
  width: 30rpx;
  height: 30rpx;
  background-color: #ff6b6b;
  border-radius: 50%;
  z-index: 9999;
  pointer-events: none;
  transition: all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  box-shadow: 0 4rpx 12rpx rgba(255, 107, 107, 0.5);
}
</style>
