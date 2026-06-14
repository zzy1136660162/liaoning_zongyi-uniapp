<template>
  <view class="product-container">
    <view class="banner-section">
      <image
        class="banner-image"
        :src="getImageUrl('/profile/liaoning_zongyi/banner_bg.png')"
        mode="widthFix"
      ></image>
    </view>

    <view class="search-section">
      <view class="search-bar">
        <uni-icons type="search" size="18" color="#999999"></uni-icons>
        <input v-model="searchKeyword" class="search-input" placeholder="搜索健康产品" @input="handleSearch" />
        <button class="search-btn" @click="handleSearch">搜索</button>
      </view>
    </view>

    <view class="main-content">
      <scroll-view class="category-nav" scroll-y>
        <view
          v-for="category in categories"
          :key="category.id"
          class="category-item"
          :class="{ active: currentCategoryId === category.id }"
          @click="switchCategory(category.id)"
        >
          <text class="category-name">{{ category.name }}</text>
        </view>
      </scroll-view>

      <view class="product-list-wrapper">
        <view class="product-list-header">
          <view class="prescription-title" @click="switchToHorizontalLayout">
            <text class="prescription-text">切换横向分类样式</text>
            <image
              class="prescription-icon"
              :src="getImageUrl('/profile/liaoning_zongyi/list_icon1.png')"
              mode="aspectFit"
            ></image>
          </view>
          <view class="history-order" @click="goToHistory">
            <uni-icons type="list" size="18" color="#666666"></uni-icons>
            <text class="history-text">订单记录</text>
          </view>
        </view>
        <scroll-view class="product-list" scroll-y lower-threshold="120" @scrolltolower="handleLoadMore">
          <view class="product-items">
            <view v-for="product in filteredProducts" :key="product.id" class="product-item">
              <image
                class="product-image"
                :src="getImageUrl(product.image)"
                mode="aspectFill"
                @click="goToDetail(product)"
              ></image>
              <view class="product-info">
                <text class="product-name" @click="goToDetail(product)">
                  <text class="self-tag" v-if="product.bizType === 2">健康</text>
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
                      <button class="select-btn" :id="`select-btn-${product.id}`" @click="goToNotice(product)">选择</button>
                    </template>
                  </view>
                </view>
              </view>
            </view>
            <view v-if="filteredProducts.length === 0" class="empty-state">暂无符合条件的商品</view>
          </view>
        </scroll-view>
      </view>
    </view>

    <view class="cart-bar">
      <view class="cart-icon-wrapper" id="cart-icon-target" @click="showCart">
        <view class="cart-icon">
          <uni-icons type="cart" size="30" color="#ffffff"></uni-icons>
        </view>
        <view class="cart-badge" v-if="cartCount > 0">{{ cartCount }}</view>
      </view>
      <view class="cart-info">
        <text class="cart-total">￥ {{ totalPrice.toFixed(2) }}</text>
        <text class="cart-tip">健康产品将统一进入确认订单流程</text>
      </view>
      <button class="submit-btn" @click="handleSubmit">去结算</button>
    </view>

    <TabBar :current="currentTab" :cartCount="cartCount" @change="handleTabChange" />

    <view
      v-if="showFlyBall"
      class="fly-ball"
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
  STORAGE_KEY_CURRENT_CONSULTATION_ID,
  STORAGE_KEY_USER_REGISTER
} from '@/utils/storage.js'
import { getCategoryList, getCategoryProducts, mapProductListItem } from '@/api/product.js'
import {
  addCartItem,
  calculateTotalPrice,
  calculateTotalQuantity,
  getCartEntries,
  getCartProductQuantity,
  loadCartItems,
  prepareCheckout,
  removeFromCart,
  resolveCartCompatibility,
  setCartItemQuantity
} from '@/utils/cart.js'
import { getImageUrl } from '@/utils/config.js'
import { getToken } from '@/utils/request.js'
import { hasBoundQuestionnaire } from '@/utils/product-biz.js'
import TabBar from '@/components/TabBar/TabBar.vue'
import { subscribeCartUpdated } from '@/utils/cart-events.js'

const HEALTH_BIZ_TYPE = 2
const PRODUCT_PAGE_SIZE = 20
const PRODUCT_LIST_TTL = 5 * 60 * 1000

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
      currentTab: 'home',
      loadedCategories: {},
      productPageState: {},
      categoryList: [],
      unsubscribeCartUpdated: null,
      searchTimer: null,
      requestSeq: 0
    }
  },
  computed: {
    filteredProducts() {
      const category = this.categories.find(cat => cat.id === this.currentCategoryId)
      if (!category) return []

      return category.products || []
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
    this.unsubscribeCartUpdated = subscribeCartUpdated(() => {
      this.loadVerifiedProductsFromStorage()
    })
    this.loadProducts()
  },
  onShow() {
    this.loadVerifiedProductsFromStorage()
  },
  onUnload() {
    uni.$off('refreshProductsList', this.loadVerifiedProductsFromStorage)
    if (this.unsubscribeCartUpdated) {
      this.unsubscribeCartUpdated()
      this.unsubscribeCartUpdated = null
    }
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
      this.searchTimer = null
    }
  },
  methods: {
    getImageUrl,
    getSearchKeyword() {
      return (this.searchKeyword || '').trim()
    },
    getCategoryKey(categoryId) {
      return String(categoryId || 'all')
    },
    getProductQuerySignature() {
      return this.getSearchKeyword()
    },
    getPageStateKey(categoryId) {
      return `${this.getCategoryKey(categoryId)}:${this.getProductQuerySignature()}`
    },
    getPageState(categoryId) {
      const key = this.getPageStateKey(categoryId)
      if (!this.productPageState[key]) {
        this.$set(this.productPageState, key, {
          pageNum: 0,
          hasMore: true,
          loading: false,
          loadedAt: 0,
          total: 0,
          records: []
        })
      }
      return this.productPageState[key]
    },
    syncCategoryProductsFromState(categoryId) {
      const categoryKey = this.getCategoryKey(categoryId)
      const category = this.categories.find(cat => this.getCategoryKey(cat.id) === categoryKey)
      if (category) {
        category.products = [...(this.getPageState(categoryId).records || [])]
      }
    },
    isCategoryStale(categoryId) {
      const state = this.getPageState(categoryId)
      if (!state.loadedAt) {
        return true
      }
      return Date.now() - state.loadedAt > PRODUCT_LIST_TTL
    },
    isCategoryFullyLoaded(categoryId) {
      return this.loadedCategories[this.getPageStateKey(categoryId)] === true
    },
    resetCategoryProducts(categoryId) {
      const categoryKey = this.getCategoryKey(categoryId)
      const stateKey = this.getPageStateKey(categoryId)
      const category = this.categories.find(cat => this.getCategoryKey(cat.id) === categoryKey)
      if (category) {
        category.products = []
      }
      this.$set(this.productPageState, stateKey, {
        pageNum: 0,
        hasMore: true,
        loading: false,
        loadedAt: 0,
        total: 0,
        records: []
      })
      delete this.loadedCategories[stateKey]
    },
    async loadProducts() {
      try {
        uni.showLoading({ title: '加载中...' })
        const categoryList = await getCategoryList(HEALTH_BIZ_TYPE)
        this.categoryList = Array.isArray(categoryList) ? categoryList : []
        this.categories = [
          { id: 'all', name: '全部分类', products: [] },
          ...this.categoryList.map(cat => ({ id: cat.id, name: cat.name, products: [] }))
        ]
        this.productPageState = {}
        this.loadedCategories = {}
        this.requestSeq += 1
        await this.loadAllProducts(true)
        this.loadVerifiedProductsFromStorage()
      } catch (error) {
        console.error('loadProducts failed:', error)
        uni.showToast({ title: '加载商品失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
    async fetchProductPage(categoryId, { reset = false } = {}) {
      const categoryKey = this.getCategoryKey(categoryId)
      let state = this.getPageState(categoryId)
      if (state.loading || (!reset && !state.hasMore)) {
        return
      }
      if (reset) {
        this.resetCategoryProducts(categoryId)
        state = this.getPageState(categoryId)
      }

      const requestSeq = ++this.requestSeq
      const nextPage = reset ? 1 : state.pageNum + 1
      const apiCategoryId = categoryKey === 'all' ? null : categoryId
      state.loading = true
      try {
        const productPage = await getCategoryProducts(
          apiCategoryId,
          nextPage,
          PRODUCT_PAGE_SIZE,
          HEALTH_BIZ_TYPE,
          null,
          null,
          this.getSearchKeyword()
        )
        if (requestSeq !== this.requestSeq) {
          return
        }
        const productList = productPage.records || productPage.list || []
        const mapped = productList.map(item => mapProductListItem(item))
        const total = Number(productPage.total || 0)
        const currentRecords = reset ? [] : (state.records || [])
        const existingIds = new Set(currentRecords.map(product => String(product.id)))
        const nextRecords = reset
          ? mapped
          : [
            ...currentRecords,
            ...mapped.filter(product => !existingIds.has(String(product.id)))
          ]
        const category = this.categories.find(cat => this.getCategoryKey(cat.id) === categoryKey)
        if (category) {
          category.products = nextRecords
        }
        state.records = nextRecords
        state.pageNum = nextPage
        state.total = total
        const loadedCount = state.records.length
        state.hasMore = total > 0 ? loadedCount < total : mapped.length >= PRODUCT_PAGE_SIZE
        state.loadedAt = Date.now()
        if (!state.hasMore) {
          this.$set(this.loadedCategories, this.getPageStateKey(categoryId), true)
        }
      } catch (error) {
        console.error('fetchProductPage failed:', error)
        throw error
      } finally {
        state.loading = false
      }
    },
    async handleLoadMore() {
      const state = this.getPageState(this.currentCategoryId)
      if (!state.hasMore || state.loading) {
        return
      }
      try {
        await this.fetchProductPage(this.currentCategoryId, { reset: false })
        this.loadVerifiedProductsFromStorage()
      } catch (error) {
        console.error('handleLoadMore failed:', error)
      }
    },
    async loadAllProducts(reset = false) {
      if (!reset && this.getPageState('all').loadedAt && !this.isCategoryStale('all')) {
        this.syncCategoryProductsFromState('all')
        return
      }
      await this.fetchProductPage('all', { reset: reset || this.isCategoryStale('all') })
    },
    async loadCategoryProducts(categoryId, reset = false) {
      if (!reset && this.getPageState(categoryId).loadedAt && !this.isCategoryStale(categoryId)) {
        this.syncCategoryProductsFromState(categoryId)
        return
      }
      await this.fetchProductPage(categoryId, { reset: reset || this.isCategoryStale(categoryId) })
    },
    loadVerifiedProductsFromStorage() {
      try {
        this.verifiedProducts = getCartEntries()
        this.cartItems = loadCartItems(this.categories)
      } catch (error) {
        console.error('loadVerifiedProductsFromStorage failed:', error)
      }
    },
    async switchCategory(categoryId) {
      this.currentCategoryId = categoryId
      if (categoryId === 'all') {
        await this.loadAllProducts(false)
        this.loadVerifiedProductsFromStorage()
        return
      }
      await this.loadCategoryProducts(categoryId)
      this.loadVerifiedProductsFromStorage()
    },
    handleSearch() {
      if (this.searchTimer) {
        clearTimeout(this.searchTimer)
      }
      this.searchTimer = setTimeout(async () => {
        this.searchTimer = null
        try {
          if (this.currentCategoryId === 'all') {
            await this.loadAllProducts(true)
          } else {
            await this.loadCategoryProducts(this.currentCategoryId, true)
          }
          this.loadVerifiedProductsFromStorage()
        } catch (error) {
          console.error('handleSearch failed:', error)
        }
      }, 300)
    },
    goToDetail(product) {
      uni.navigateTo({
        url: `/pages/products/medicine_detail?id=${product.id}`
      })
    },
    goToNotice(product) {
      if (!getToken()) {
        uni.navigateTo({
          url: '/pages/register/register?redirect=/pages/products/priducts_list2'
        })
        return
      }

      const flow = resolveCartCompatibility(product, {
        ignoreProductId: product?.id
      })
      if (!flow.valid) {
        uni.showToast({
          title: flow.message,
          icon: 'none'
        })
        return
      }

      if (!hasBoundQuestionnaire(product)) {
        const success = addCartItem(product, 1, {
          questionnairePassed: true
        })
        if (!success) {
          uni.showToast({
            title: '加入购物车失败',
            icon: 'none'
          })
          return
        }
        this.loadVerifiedProductsFromStorage()
        uni.showToast({
          title: '已加入购物车',
          icon: 'success'
        })
        return
      }

      uni.navigateTo({
        url: `/pages/products/product_notice?id=${product.id}&quantity=1&action=cart`
      })
    },
    isProductVerified(productId) {
      return !!this.verifiedProducts[String(productId)]
    },
    getProductQuantity(productId) {
      return getCartProductQuantity(productId, 0)
    },
    increaseQuantity(product) {
      const nextQuantity = this.getProductQuantity(product.id) + 1
      setCartItemQuantity(product.id, nextQuantity)
      this.loadVerifiedProductsFromStorage()
    },
    decreaseQuantity(product) {
      const current = this.getProductQuantity(product.id)
      if (current <= 1) {
        removeFromCart(product.id)
      } else {
        setCartItemQuantity(product.id, current - 1)
      }
      this.loadVerifiedProductsFromStorage()
    },
    showCart() {
      uni.navigateTo({ url: '/pages/cart/cart' })
    },
    handleSubmit() {
      if (!getToken()) {
        uni.navigateTo({
          url: '/pages/register/register?redirect=/pages/products/priducts_list2'
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
            url: '/pages/register/register?redirect=/pages/products/priducts_list2'
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

        uni.removeStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID)
        uni.navigateTo({
          url: `/pages/order/confirm?selectedItems=${checkout.productIds.join(',')}`
        })
      } catch (error) {
        console.error('handleSubmit failed:', error)
        uni.navigateTo({
          url: '/pages/register/register?redirect=/pages/products/priducts_list2'
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
	padding-bottom: calc( env(safe-area-inset-bottom));
  }
  
  .nav-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 88rpx;
	padding: 0 30rpx;
	background-color: #ffffff;
	border-bottom: 1rpx solid #e5e5e5;
  }
  
  .nav-left,
  .nav-right {
	width: 60rpx;
	height: 60rpx;
	display: flex;
	align-items: center;
	justify-content: center;
  }
  
  .nav-icon {
	font-size: 36rpx;
	color: #333333;
  }
  
  .nav-title {
	font-size: 36rpx;
	font-weight: 500;
	color: #333333;
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
  
  .banner-content {
	display: flex;
	justify-content: space-between;
	align-items: center;
  }
  
  .hospital-info {
	flex: 1;
  }
  
  .hospital-name {
	display: block;
	font-size: 32rpx;
	font-weight: bold;
	color: #333333;
	margin-bottom: 10rpx;
  }
  
  .hospital-subtitle {
	display: block;
	font-size: 28rpx;
	color: #666666;
  }
  
  .banner-right {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
  }
  
  .doctor-illustration {
	position: relative;
	margin-bottom: 20rpx;
  }
  
  .doctor-img {
	width: 120rpx;
	height: 120rpx;
  }
  
  .recommend-tag {
	position: absolute;
	top: -20rpx;
	right: -20rpx;
	background-color: #ffd700;
	color: #333333;
	font-size: 20rpx;
	padding: 8rpx 16rpx;
	border-radius: 20rpx;
	white-space: nowrap;
  }
  
  .consult-btn {
	background-color: #4A90E2;
	color: #ffffff;
	font-size: 24rpx;
	padding: 12rpx 24rpx;
	border-radius: 30rpx;
	border: none;
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
	position: relative;
  }
  
  .search-bar uni-icons {
	margin-right: 20rpx;
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
  
  /* 宸︿晶鍒嗙被瀵艰埅 */

  /*height: calc(100vh - env(safe-area-inset-bottom) - 100rpx - 120rpx);*/
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
	text-shadow: 0 2rpx 4rpx rgba(74, 144, 226, 0.2);
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
	box-shadow: 0 2rpx 8rpx rgba(74, 144, 226, 0.3);
  }
  
  .history-order {
	display: flex;
	align-items: center;
	gap: 8rpx;
	padding: 8rpx 16rpx;
	border-radius: 30rpx;
	transition: all 0.3s;
  }
  
  .history-order:active {
	background-color: #f5f5f5;
  }
  
  .history-text {
	font-size: 26rpx;
	color: #666666;
  }
  
  .product-list {
    overflow: scroll;
	flex: 1;
  }
  
  .product-header {
	display: flex;
	justify-content: flex-end;
	margin-bottom: 20rpx;
  }
  
  .history-btn {
	background-color: #ffffff;
	color: #666666;
	font-size: 26rpx;
	padding: 10rpx 20rpx;
	border: 1rpx solid #e5e5e5;
	border-radius: 20rpx;
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
	cursor: pointer;
	border-radius: 12rpx;
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
	cursor: pointer;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
	line-height: 1.4;
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
  
  .select-btn {
	margin: 0;
	background-color: #4A90E2;
	color: #ffffff;
	font-size: 24rpx;
	padding: 0rpx 24rpx;
	border-radius: 40rpx;
	border: none;
	flex-shrink: 0;
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
  
  /* Tab Bar 鏍峰紡宸茬Щ鑷崇粍浠朵腑 */
  </style>
