<template>
	<view class="product-container">
  
  
	  <!-- Banner区域 -->
	  <view class="banner-section">
		<image class="banner-image" :src="getImageUrl('/profile/liaoning_zongyi/banner_bg.png')" mode="widthFix"></image>
	  </view>
  
	  <!-- 搜索栏 -->
	  <view class="search-section">
		<view class="search-bar">
		  <uni-icons type="search" size="18" color="#999999"></uni-icons>
		  <input class="search-input" placeholder="搜索" v-model="searchKeyword" @input="handleSearch" />
		  <button class="search-btn" @click="handleSearch">搜索</button>
		</view>
	  </view>
	  <!-- 列表头部 -->
	  <view class="product-list-header">
		<view class="prescription-title" @click="switchToVerticalLayout">
		  <text class="prescription-text" >药方</text>
		  <image class="prescription-icon" :src="getImageUrl('/profile/liaoning_zongyi/list_icon2.png')" mode="aspectFit"></image>
		</view>
		<view class="history-order" @click="goToHistory">
		  <uni-icons type="list" size="18" color="#666666"></uni-icons>
		  <text class="history-text">历史订单</text>
		</view>
	  </view>
  
	  <!-- 横向分类Tabs -->
	  <view class="category-tabs-wrapper">
		<scroll-view class="category-tabs" scroll-x>
		  <view class="category-tabs-content">
			<view
				class="category-tab-item"
				v-for="(category, index) in categories"
				:key="category.id"
				:class="{ active: currentCategoryId === category.id }"
				@click="switchCategory(category.id)"
			>
			  <text class="category-tab-name">{{ category.name }}</text>
			</view>
		  </view>
		</scroll-view>
	  </view>
  
	  <!-- 产品列表区域 -->
	  <view class="product-list-wrapper">
		<scroll-view class="product-list" scroll-y>
		  <view class="product-items">
			<view
				class="product-item"
				v-for="product in filteredProducts"
				:key="product.id"
			>
			  <view class="image-wrapper" @click="goToDetail(product)">
				<image class="product-image" :src="getImageUrl(product.image)" mode="aspectFill"></image>
				<view class="hot-badge" v-if="product.isNewProduct === 1">新品</view>
			  </view>
			  <view class="product-info">
				<text class="product-name" @click="goToDetail(product)">
				  <text class="self-tag" v-if="product.bizType === 1">自研</text>
				  <text class="self-tag2" v-if="product.isHospitalStarFormula === 1">院藏王牌制剂</text>
				  <text class="self-tag3" v-if="product.isPrescription === 1">处方</text>
				  {{ product.name }}
				</text>
				<text class="product-desc" v-if="product.description">{{ product.description }}</text>
				<view class="product-footer">
				  <text class="product-unit">{{ product.specText || product.unit || '' }}</text>
				  <view class="product-price-row">
					<!-- 如果产品已通过验证，显示数量选择器 -->
					<view v-if="isProductVerified(product.id)" class="quantity-selector">
					  <button class="quantity-btn" @click="decreaseQuantity(product)">-</button>
					  <text class="quantity-text">{{ getProductQuantity(product.id) }}</text>
					  <button class="quantity-btn" @click="increaseQuantity(product)">+</button>
					</view>
					<!-- 否则显示价格和选择按钮 -->
					<template v-else>
					  <text class="product-price">¥{{ Number(product.price || 0).toFixed(2) }}</text>
					  <view
						  class="add-btn"
						  :id="`select-btn-${product.id}`"
						  @click="goToNotice(product)"
					  >+</view>
					</template>
				  </view>
				</view>
			  </view>
			</view>
		  </view>
		</scroll-view>
	  </view>
  
	  <!-- 底部购物车栏 -->
	  <view class="cart-bar">
		<view class="cart-icon-wrapper" @click="showCart" id="cart-icon-target">
		  <view class="cart-icon">
			<uni-icons type="cart" size="30" color="#ffffff"></uni-icons>
		  </view>
		  <view class="cart-badge" v-if="cartCount > 0">{{ cartCount }}</view>
		</view>
		<view class="cart-info">
		  <text class="cart-total">¥ {{ totalPrice.toFixed(2) }}</text>
		  <text class="cart-tip">不含复诊费,实际金额以结算为准</text>
		</view>
		<button class="submit-btn" @click="handleSubmit">提&nbsp;交</button>
	  </view>
  
	  <!-- Tab Bar 导航栏 -->
	  <TabBar :current="currentTab" :cartCount="cartCount" @change="handleTabChange" />
  
	  <!-- 动画小球 -->
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
  STORAGE_KEY_CURRENT_CONSULTATION_ID,
  STORAGE_KEY_USER_REGISTER
} from '@/utils/storage.js'
import { getCategoryList, getCategoryProducts, mapProductListItem } from '@/api/product.js'
import {
  getCartEntries,
  getCartProductQuantity,
  loadCartItems,
  calculateTotalPrice,
  calculateTotalQuantity,
  setCartItemQuantity,
  removeFromCart,
  prepareCheckout
} from '@/utils/cart.js'
import { getImageUrl } from '@/utils/config.js'
import { getToken } from '@/utils/request.js'
import TabBar from '@/components/TabBar/TabBar.vue'

const HEALTH_BIZ_TYPE = 2

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
    async loadProducts() {
      try {
        uni.showLoading({ title: '加载中...' })
        const categoryList = await getCategoryList(HEALTH_BIZ_TYPE)
        this.categoryList = Array.isArray(categoryList) ? categoryList : []
        this.categories = [
          { id: 'all', name: '全部分类', products: [] },
          ...this.categoryList.map(cat => ({ id: cat.id, name: cat.name, products: [] }))
        ]
        await this.loadAllProducts()
        this.$set(this.loadedCategories, 'all', true)
        this.loadVerifiedProductsFromStorage()
      } catch (error) {
        console.error('loadProducts failed:', error)
        uni.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
    async loadAllProducts() {
      const productPage = await getCategoryProducts(null, 1, 100, HEALTH_BIZ_TYPE)
      const productList = productPage.records || productPage.list || []
      const allProducts = productList.map(item => mapProductListItem(item))
      const allCategory = this.categories.find(cat => cat.id === 'all')
      if (allCategory) {
        allCategory.products = allProducts
      }
    },
    async loadCategoryProducts(categoryId) {
      if (this.loadedCategories[categoryId]) return
      const productPage = await getCategoryProducts(categoryId, 1, 100, HEALTH_BIZ_TYPE)
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
        this.verifiedProducts = getCartEntries()
        this.cartItems = loadCartItems(this.categories)
      } catch (error) {
        console.error('loadVerifiedProductsFromStorage failed:', error)
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
    handleSearch() {},
    goToDetail(product) {
      uni.navigateTo({
        url: `/pages/products/medicine_detail?id=${product.id}`
      })
    },
    goToNotice(product) {
      if (!getToken()) {
        uni.navigateTo({
          url: '/pages/register/register?redirect=/pages/products/priducts_list'
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
          url: '/pages/register/register?redirect=/pages/products/priducts_list'
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
            url: '/pages/register/register?redirect=/pages/products/priducts_list'
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
          url: '/pages/register/register?redirect=/pages/products/priducts_list'
        })
      }
    },
    goToHistory() {
      uni.navigateTo({ url: '/pages/order/order_list' })
    },
    goBack() {
      uni.navigateBack()
    },
    handleTabChange(tab) {
      this.currentTab = tab
    },
    switchToVerticalLayout() {
      uni.navigateTo({ url: '/pages/products/medicine_list' })
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
  
  /* 横向分类Tabs */
  .category-tabs-wrapper {
	background-color: #ffffff;
	border-bottom: 1rpx solid #e5e5e5;
  }
  
  .category-tabs {
	white-space: nowrap;
	width: 100%;
  }
  
  .category-tabs-content {
	display: flex;
	padding: 0 20rpx;
  }
  
  .category-tab-item {
	padding: 24rpx 32rpx;
	margin-right: 20rpx;
	position: relative;
	transition: all 0.3s;
	flex-shrink: 0;
  }
  
  .category-tab-item.active {
	color: #4A90E2;
  }
  
  .category-tab-item.active::after {
	content: '';
	position: absolute;
	bottom: 0;
	left: 50%;
	transform: translateX(-50%);
	width: 60%;
	height: 4rpx;
	background-color: #4A90E2;
	border-radius: 2rpx;
  }
  
  .category-tab-name {
	font-size: 28rpx;
	color: #666666;
	transition: all 0.3s;
  }
  
  .category-tab-item.active .category-tab-name {
	color: #4A90E2;
	font-weight: 600;
  }
  
  .product-list-wrapper {
	padding: 20rpx;
	padding-bottom: calc(240rpx + env(safe-area-inset-bottom));
	flex: 1;
	background-color: #f5f5f5;
	display: flex;
	flex-direction: column;
	min-height: calc(100vh - 500rpx);
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

  .image-wrapper {
	position: relative;
	flex-shrink: 0;
  }
  
  .product-image {
	width: 200rpx;
	height: 200rpx;
	background-color: #f5f5f5;
	border-radius: 12rpx;
	cursor: pointer;
	display: block;
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
	min-height: 200rpx;
	min-width: 0;
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

  .self-tag,
  .self-tag2,
  .self-tag3 {
	display: inline-block;
	color: #ffffff;
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
	background: #333333;
	color: #d4af37;
  }

  .self-tag3 {
	background: #00a884;
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
	align-items: center;
	justify-content: center;
	line-height: 1;
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
  /* Tab Bar 样式已移至组件中 */
  </style>
