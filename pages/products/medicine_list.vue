<template>
  <view class="product-container">
    <view class="top-banner">
      <image class="top-banner-img" src="https://smf.lntcm.com/static/img/yiyuan.jpg" mode="widthFix" />
  </view>
    <view class="hospital-intro" :class="{ collapsed: imageCollapsed }">
      <view class="logo-wrap">
        <image class="hospital-logo" src="https://shop.lntcm.com/assets_files/upload/2026/01/26/logotou.png" mode="aspectFit" />
        <view class="logo-badge">官方旗舰店</view>
      </view>
      <view class="hospital-info">
        <view class="hospital-name-row">
          <view class="hospital-badge">医院自营</view>
          <text class="hospital-name">辽宁中医药大学附属医院云商城</text>
          <!-- <text class="verify-icon">✓</text> -->
        </view>
        <view class="hospital-desc">权威认证 · 品质保障 · 放心购药</view>
        <view class="hospital-tags">
          <view class="tag-item">
            <text class="tag-icon">🛡️</text>
            <text class="tag-text">正品保证</text>
          </view>
          <view class="tag-item">
            <text class="tag-icon">⏰</text>
            <text class="tag-text">24h发货</text>
          </view>
          <view class="tag-item">
            <text class="tag-icon">📋</text>
            <text class="tag-text">在线开方</text>
          </view>
          <view class="tag-item">
            <text class="tag-icon">🚚</text>
            <text class="tag-text">专业包装</text>
          </view>
        </view>
        <!-- <view class="hospital-stats">
          <view class="stat-item">
            <text class="stat-value">9999+</text>
            <text class="stat-label">月销量</text>
          </view>
          <view class="stat-divider"></view>
          <view class="stat-item">
            <text class="stat-value">4.9</text>
            <text class="stat-label">综合评分</text>
          </view>
          <view class="stat-divider"></view>
          <view class="stat-item">
            <text class="stat-value">100%</text>
            <text class="stat-label">好评率</text>
          </view>
        </view> -->
      </view>
      <text class="arrow-icon">›</text>
    </view>
    <view class="intro-divider"></view>

    <view class="search-section">
      <view class="search-bar">
        <uni-icons type="search" size="18" color="#999999"></uni-icons>
        <input class="search-input" placeholder="搜索院内药品" v-model="searchKeyword" @input="handleSearch" />
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
          <view class="header-left">
            <view class="prescription-title" @click="switchToHorizontalLayout">
              <text class="prescription-text">药方</text>
            </view>
            <view class="sort-section">
              <view class="sort-btn" :class="{ active: sortType === '' }" @click="toggleSort('')">
                <text class="sort-text">综合</text>
              </view>
              <view class="sort-btn" :class="{ active: sortType === 'sales' }" @click="toggleSort('sales')">
                <text class="sort-text">销量</text>
                <text class="sort-arrow" :class="{ desc: sortType === 'sales' && sortOrder === 'desc' }">↓</text>
              </view>
              <view class="sort-btn" :class="{ active: sortType === 'price' }" @click="toggleSort('price')">
                <text class="sort-text">价格</text>
                <text class="sort-arrow" :class="{ desc: sortType === 'price' && sortOrder === 'desc' }">↓</text>
              </view>
            </view>
          </view>
          <!-- <view class="history-order" @click="goToHistory">
            <uni-icons type="list" size="18" color="#666666"></uni-icons>
            <text class="history-text">历史订单</text>
          </view> -->
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
                  <!-- <text class="product-unit">{{ product.specText || product.unit || '' }}</text> -->
                  <view class="product-price-row">
                    <view v-if="showQuantitySelector(product.id)" class="quantity-selector">
                      <button class="quantity-btn" :class="{ disabled: getDisplayQuantity(product.id) === 0 }" @click.stop="decreaseQuantity(product)">-</button>
                      <text class="quantity-text">{{ getDisplayQuantity(product.id) }}</text>
                      <button class="quantity-btn" @click.stop="increaseQuantity(product)">+</button>
                    </view>
                    <template v-else>
                      <text class="product-price">￥{{ Number(product.price || 0).toFixed(2) }}</text>
                      <view class="add-btn" @click.stop="handleAddToCart(product)">+</view>
                    </template>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- <view class="cart-bar">
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
    </view> -->

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
import { STORAGE_KEY_USER_REGISTER } from '@/utils/storage.js'
import { getCategoryList, getCategoryProducts, mapProductListItem } from '@/api/product.js'
import {
  addCartItem,
  getCartEntries,
  getCartProductInfo,
  getCartProductQuantity,
  loadCartItems,
  calculateTotalPrice,
  calculateTotalQuantity,
  setCartItemQuantity,
  removeFromCart,
  prepareCheckout,
  resolveCartCompatibility
} from '@/utils/cart.js'
import { getImageUrl } from '@/utils/config.js'
import { getToken } from '@/utils/request.js'
import TabBar from '@/components/TabBar/TabBar.vue'

const PRODUCT_BIZ_TYPE_FILTER = null // null=全部, 1=医院制剂, 2=健康产品

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
      zeroQuantityProducts: {},
      currentTab: 'home',
      loadedCategories: {},
      categoryList: [],
      isScrolled: false,
      sortType: '',
      sortOrder: 'desc',
      imageCollapsed: false
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
      if (this.sortType) {
        products = [...products].sort((a, b) => {
          if (this.sortType === 'sales') {
            const aSales = a.salesVolume || 0
            const bSales = b.salesVolume || 0
            return this.sortOrder === 'desc' ? bSales - aSales : aSales - bSales
          }
          if (this.sortType === 'price') {
            const aPrice = a.price || 0
            const bPrice = b.price || 0
            return this.sortOrder === 'desc' ? bPrice - aPrice : aPrice - bPrice
          }
          return 0
        })
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
    setTimeout(() => {
      this.imageCollapsed = true
    }, 2000)
  },
  onShow() {
    this.loadVerifiedProductsFromStorage()
  },
  onUnload() {
    uni.$off('refreshProductsList', this.loadVerifiedProductsFromStorage)
  },
  methods: {
    getImageUrl,
    removeZeroQuantityMarker(productId) {
      const normalizedId = String(productId)
      if (!this.zeroQuantityProducts[normalizedId]) {
        return
      }
      const nextZeroQuantityProducts = { ...this.zeroQuantityProducts }
      delete nextZeroQuantityProducts[normalizedId]
      this.zeroQuantityProducts = nextZeroQuantityProducts
    },
    setZeroQuantityMarker(productId) {
      const normalizedId = String(productId)
      this.zeroQuantityProducts = {
        ...this.zeroQuantityProducts,
        [normalizedId]: true
      }
    },
    debugProductQuantityState(productId, source = 'unknown') {
      const normalizedId = String(productId)
      const storageEntry = getCartProductInfo(normalizedId)
      const storageQuantity = getCartProductQuantity(normalizedId, 0)
      const zeroTracked = !!this.zeroQuantityProducts[normalizedId]
      const verified = !!this.verifiedProducts[normalizedId]
      const selectorVisible = storageQuantity > 0 || zeroTracked

      console.log('[medicine_list][quantity-debug]', {
        source,
        productId: normalizedId,
        storageQuantity,
        zeroTracked,
        verified,
        selectorVisible,
        storageEntry,
        zeroQuantityKeys: Object.keys(this.zeroQuantityProducts),
        verifiedKeys: Object.keys(this.verifiedProducts),
        cartItems: this.cartItems.map(item => ({
          id: String(item.id),
          quantity: item.quantity
        }))
      })
    },
    toggleSort(type) {
      if (type === '') {
        this.sortType = ''
        this.sortOrder = 'desc'
      } else if (this.sortType === type) {
        this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc'
      } else {
        this.sortType = type
        this.sortOrder = 'desc'
      }
    },
    handleSearch() {},
    async loadProducts() {
      try {
        uni.showLoading({ title: '加载中...' })
        const categoryList = await getCategoryList(PRODUCT_BIZ_TYPE_FILTER)
        this.categoryList = Array.isArray(categoryList) ? categoryList : []
        this.categories = [
          { id: 'all', name: '全部分类', products: [] },
          ...this.categoryList.map(cat => ({ id: cat.id, name: cat.name, products: [] }))
        ]
        await this.loadAllProducts()
        this.loadedCategories.all = true
        this.loadVerifiedProductsFromStorage('loadProducts')
      } catch (error) {
        console.error('loadProducts failed:', error)
        uni.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
    async loadAllProducts() {
      const productPage = await getCategoryProducts(null, 1, 100, PRODUCT_BIZ_TYPE_FILTER)
      const productList = productPage.records || productPage.list || []
      const allProducts = productList.map(item => mapProductListItem(item))
      const allCategory = this.categories.find(cat => cat.id === 'all')
      if (allCategory) {
        allCategory.products = allProducts
      }
    },
    async loadCategoryProducts(categoryId) {
      if (this.loadedCategories[categoryId]) return
      const productPage = await getCategoryProducts(categoryId, 1, 100, PRODUCT_BIZ_TYPE_FILTER)
      const productList = productPage.records || productPage.list || []
      const products = productList.map(item => mapProductListItem(item))
      const category = this.categories.find(cat => cat.id === categoryId)
      if (category) {
        category.products = products
        this.loadedCategories[categoryId] = true
      }
    },
    loadVerifiedProductsFromStorage(source = 'unknown', focusProductId = '') {
      try {
        this.verifiedProducts = getCartEntries()
        const nextZeroQuantityProducts = { ...this.zeroQuantityProducts }
        Object.keys(nextZeroQuantityProducts).forEach((productId) => {
          if (this.verifiedProducts[String(productId)]) {
            delete nextZeroQuantityProducts[String(productId)]
          }
        })
        this.zeroQuantityProducts = nextZeroQuantityProducts
        this.cartItems = loadCartItems(this.categories)
        console.log('[medicine_list] loadVerifiedProductsFromStorage', {
          source,
          verifiedKeys: Object.keys(this.verifiedProducts),
          zeroQuantityKeys: Object.keys(this.zeroQuantityProducts),
          cartItemIds: this.cartItems.map(item => String(item.id))
        })
        if (focusProductId) {
          this.debugProductQuantityState(focusProductId, `${source}:after-load`)
        }
      } catch (error) {
        console.error('loadVerifiedProductsFromStorage failed:', error)
      }
    },
    async switchCategory(categoryId) {
      this.currentCategoryId = categoryId
      if (categoryId === 'all') {
        if (!this.loadedCategories.all) {
          await this.loadAllProducts()
          this.loadedCategories.all = true
        }
        this.loadVerifiedProductsFromStorage('switchCategory:all')
        return
      }
      await this.loadCategoryProducts(categoryId)
      this.loadVerifiedProductsFromStorage(`switchCategory:${categoryId}`)
    },
    goToDetail(product) {
      uni.navigateTo({
        url: `/pages/products/medicine_detail?id=${product.id}`
      })
    },
    buildListRedirect() {
      return '/pages/products/medicine_list'
    },
    ensureLogin() {
      if (getToken()) {
        return true
      }
      uni.navigateTo({
        url: `/pages/register/register?redirect=${encodeURIComponent(this.buildListRedirect())}`
      })
      return false
    },
    ensureCartCompatible(product) {
      const result = resolveCartCompatibility(product, {
        ignoreProductId: product?.id
      })
      if (!result.valid) {
        uni.showToast({
          title: result.message,
          icon: 'none'
        })
        return false
      }
      return true
    },
    hasQuestionnairePassed(productId) {
      const entry = getCartProductInfo(productId)
      return !!(entry && entry.questionnairePassed)
    },
    showQuantitySelector(productId) {
      const normalizedId = String(productId)
      return this.getProductQuantity(productId) > 0 || !!this.zeroQuantityProducts[normalizedId]
    },
    getDisplayQuantity(productId) {
      return Math.max(0, this.getProductQuantity(productId))
    },
    handleAddToCart(product) {
      if (!product?.id) {
        return
      }
      if (!this.ensureLogin()) {
        return
      }
      if (!this.ensureCartCompatible(product)) {
        return
      }

      const nextQuantity = Math.max(1, this.getProductQuantity(product.id) || 1)
      const alreadyPassed = this.hasQuestionnairePassed(product.id)
      if (Number(product.needQuestionnaire) === 1 && !alreadyPassed) {
        uni.navigateTo({
          url: `/pages/products/product_notice?id=${product.id}&quantity=${nextQuantity}&action=cart`
        })
        return
      }

      const success = addCartItem(product, nextQuantity, {
        questionnairePassed: Number(product.needQuestionnaire) !== 1 || alreadyPassed
      })
      if (!success) {
        uni.showToast({
          title: '加入购物车失败',
          icon: 'none'
        })
        return
      }

      this.removeZeroQuantityMarker(product.id)
      this.loadVerifiedProductsFromStorage('handleAddToCart', product.id)
      this.$nextTick(() => {
        this.debugProductQuantityState(product.id, 'handleAddToCart:nextTick')
      })
      uni.showToast({
        title: '已加入购物车',
        icon: 'success'
      })
    },
    isProductVerified(productId) {
      return !!this.verifiedProducts[String(productId)]
    },
    getProductQuantity(productId) {
      return getCartProductQuantity(productId, 0)
    },
    increaseQuantity(product) {
      const current = this.getProductQuantity(product.id)
      console.log('[medicine_list] increaseQuantity:start', {
        productId: String(product.id),
        current,
        zeroTracked: !!this.zeroQuantityProducts[String(product.id)]
      })
      if (current <= 0) {
        this.debugProductQuantityState(product.id, 'increaseQuantity:before-handleAddToCart')
        this.handleAddToCart(product)
        return
      }
      const nextQuantity = current + 1
      setCartItemQuantity(product.id, nextQuantity)
      this.removeZeroQuantityMarker(product.id)
      this.loadVerifiedProductsFromStorage('increaseQuantity', product.id)
      this.$nextTick(() => {
        this.debugProductQuantityState(product.id, 'increaseQuantity:nextTick')
      })
    },
    decreaseQuantity(product) {
      const current = this.getProductQuantity(product.id)
      console.log('[medicine_list] decreaseQuantity:start', {
        productId: String(product.id),
        current,
        zeroTracked: !!this.zeroQuantityProducts[String(product.id)]
      })
      if (current <= 0) {
        this.debugProductQuantityState(product.id, 'decreaseQuantity:blocked-at-zero')
        return
      }

      const nextQuantity = Math.max(current - 1, 0)
      if (nextQuantity === 0) {
        removeFromCart(product.id)
        this.setZeroQuantityMarker(product.id)
        console.log('[medicine_list] decreaseQuantity:removed-from-cart', {
          productId: String(product.id),
          nextQuantity,
          zeroQuantityKeys: Object.keys(this.zeroQuantityProducts)
        })
      } else {
        setCartItemQuantity(product.id, nextQuantity)
      }
      this.loadVerifiedProductsFromStorage('decreaseQuantity', product.id)
      this.$nextTick(() => {
        this.debugProductQuantityState(product.id, 'decreaseQuantity:nextTick')
      })
    },
    showCart() {
      uni.navigateTo({ url: '/pages/cart/cart' })
    },
    handleSubmit() {
      if (!getToken()) {
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

        const selectedIds = this.cartItems.map(item => String(item.id))
        const checkout = prepareCheckout(selectedIds, this.categories)
        if (!checkout.valid) {
          uni.showToast({
            title: checkout.message,
            icon: 'none'
          })
          return
        }

        uni.navigateTo({
          url: `/pages/dispense/apply?selectedItems=${checkout.productIds.join(',')}`
        })
      } catch (error) {
        console.error('handleSubmit failed:', error)
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
::-webkit-scrollbar {
  display: none;
}
scroll-view ::-webkit-scrollbar {
  display: none;
}
.product-container {
  width: 100%;
  background-color: #f5f5f5;
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
  position: sticky;
  top: 0;
  z-index: 100;
}

.search-bar {
  display: flex;
  align-items: center;
  background-color: #f5f5f5;
  border-radius: 50rpx;
  padding: 6rpx 10rpx 6rpx 30rpx;
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
  height: calc(100vh - 500rpx);
  overflow: scroll;
  padding-bottom: 150rpx;
}

.category-nav {
  width: 200rpx;
  background-color: #ffffff;
  border-right: 1rpx solid #e5e5e5;
  padding-bottom: 20rpx;
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

.header-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.sort-section {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 4rpx;
  padding: 6rpx 14rpx;
  border-radius: 20rpx;
  background: #f5f5f5;
  transition: all 0.2s ease;
}

.sort-btn.active {
  background: linear-gradient(135deg, #4A90E2 0%, #67B26F 100%);
}

.sort-text {
  font-size: 24rpx;
  color: #666666;
}

.sort-btn.active .sort-text {
  color: #ffffff;
}

.sort-arrow {
  font-size: 20rpx;
  color: #999999;
  transition: all 0.2s ease;
}

.sort-btn.active .sort-arrow {
  color: #ffffff;
}

.sort-arrow.desc {
  transform: rotate(180deg);
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

.quantity-btn.disabled {
  background-color: #d9d9d9;
  color: #ffffff;
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

.top-banner {
  width: 100%;
  overflow: hidden;
}

.top-banner-img {
  width: 100%;
  display: block;
}

.hospital-intro {
  display: flex;
  align-items: flex-start;
  background: linear-gradient(135deg, #fafafa, #fff);
  padding: 30rpx 30rpx 10rpx 30rpx;
  position: relative;
  margin-top: -40rpx;
  z-index: 10;
  transition: margin-top 1.5s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.hospital-intro.collapsed {
  margin-top: -400rpx;
}

.logo-wrap {
  position: relative;
  margin-right: 24rpx;
  flex-shrink: 0;
}

.hospital-logo {
  width: 110rpx;
  height: 110rpx;
  border-radius: 16rpx;
  background: transparent;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.08);
}

.logo-badge {
  position: absolute;
  bottom: -10rpx;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #e63939, #ff4b4b);
  color: #fff;
  font-size: 18rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  white-space: nowrap;
  font-weight: bold;
}

.hospital-info {
  flex: 1;
}

.hospital-name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 8rpx;
}

.hospital-badge {
  background: linear-gradient(135deg, #52c41a, #73d13d);
  color: #fff;
  font-size: 18rpx;
  padding: 4rpx 10rpx;
  border-radius: 4rpx;
  margin-right: 12rpx;
  font-weight: bold;
}

.hospital-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.verify-icon {
  color: #52c41a;
  font-size: 26rpx;
  margin-left: 8rpx;
}

.hospital-desc {
  font-size: 22rpx;
  color: #999;
  margin-bottom: 12rpx;
  letter-spacing: 1rpx;
}

.hospital-tags {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.tag-item {
  display: flex;
  align-items: center;
  background: #f5f5f5;
  padding: 4rpx 10rpx;
  border-radius: 20rpx;
  flex-shrink: 0;
}

.tag-icon {
  font-size: 18rpx;
  margin-right: 4rpx;
}

.tag-text {
  font-size: 18rpx;
  color: #666;
}

.hospital-stats {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #fff8e1, #fff);
  padding: 12rpx 16rpx;
  border-radius: 8rpx;
  border: 1rpx solid #ffe58f;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 28rpx;
  font-weight: bold;
  color: #e63939;
}

.stat-label {
  font-size: 18rpx;
  color: #999;
  margin-top: 2rpx;
}

.stat-divider {
  width: 1rpx;
  height: 40rpx;
  background: #ffe58f;
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
  font-size: 40rpx;
  color: #ccc;
  margin-left: 12rpx;
  align-self: center;
}

.intro-divider {
  height: 16rpx;
  background: #f5f5f5;
}
</style>
