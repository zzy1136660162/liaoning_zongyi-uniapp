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
  
  
		<!-- 主要内容区域 -->
		<view class="main-content">
			<!-- 左侧分类导航 -->
			<scroll-view class="category-nav" scroll-y>
				<view
					class="category-item"
					v-for="(category, index) in categories"
					:key="category.id"
					:class="{ active: currentCategoryId === category.id }"
					@click="switchCategory(category.id)"
				>
					<text class="category-name">{{ category.name }}</text>
				</view>
			</scroll-view>

			<!-- 右侧产品列表 -->
			<view class="product-list-wrapper">
				<view class="product-list-header">
					<view class="prescription-title"  @click="switchToHorizontalLayout">
						<text class="prescription-text">药方</text>
						<image class="prescription-icon" :src="getImageUrl('/profile/liaoning_zongyi/list_icon1.png')"  mode="aspectFit"></image>
					</view>
					<view class="history-order" @click="goToHistory">
						<uni-icons type="list" size="18" color="#666666"></uni-icons>
						<text class="history-text">历史订单</text>
					</view>
				</view>
				<scroll-view class="product-list" scroll-y>
					<view class="product-items">
					<view
						class="product-item"
						v-for="(product, productIndex) in filteredProducts"
						:key="product.id"
					>
						<image class="product-image" :src="getImageUrl(product.image)" mode="aspectFill" @click="goToDetail(product)"></image>
						<view class="product-info">
							<text class="product-name" @click="goToDetail(product)">{{ product.name }}</text>
							<text class="product-desc" v-if="product.description">{{ product.description }}</text>
							<view class="product-footer">
								<text class="product-unit">{{ product.unit }}</text>
								<view class="product-price-row">
									<!-- 如果产品已通过验证，显示数量选择器 -->
									<view v-if="isProductVerified(product.id)" class="quantity-selector">
										<button class="quantity-btn" @click="decreaseQuantity(product)">-</button>
										<text class="quantity-text">{{ getProductQuantity(product.id) }}</text>
										<button class="quantity-btn" @click="increaseQuantity(product)">+</button>
									</view>
									<!-- 否则显示价格和选择按钮 -->
									<template v-else>
										<text class="product-price">¥{{ product.price.toFixed(2) }}</text>
										<button
											class="select-btn"
											:id="`select-btn-${product.id}`"
											@click="goToNotice(product)"
										>选择</button>
									</template>
								</view>
							</view>
						</view>
					</view>
					</view>
				</scroll-view>
			</view>
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
	STORAGE_KEY_VERIFIED_PRODUCTS,
	STORAGE_KEY_PRODUCT_QUANTITIES,
	STORAGE_KEY_SELECTED_PRODUCTS,
	STORAGE_KEY_USER_REGISTER
  } from '@/utils/storage.js'
  import { getCategoryList, getCategoryProducts } from '@/api/product.js'
  import { loadCartItems, calculateTotalPrice, calculateTotalQuantity } from '@/utils/cart.js'
  import { getImageUrl } from '@/utils/config.js'
  import { getToken } from '@/utils/request.js'
  import TabBar from '@/components/TabBar/TabBar.vue'
  
  export default {
	components: {
	  TabBar
	},
	data() {
	  return {
		searchKeyword: '',
		currentCategoryId: 'all', // 默认选中"全部"
		categories: [],
		allProducts: [],
		cartItems: [],
		productsData: null,
		showFlyBall: false,
		flyBallStyle: {
		  left: 0,
		  top: 0,
		  scale: 1
		},
		verifiedProducts: {}, // 存储已通过验证的产品ID
		productQuantities: {}, // 存储产品的数量
		currentTab: 'cart', // 当前选中的 tab，商品列表页默认显示购物车
		loadedCategories: {}, // 记录已加载的分类ID，避免重复加载 {categoryId: true}
		categoryList: [] // 存储分类列表（不含商品）
	  }
	},
	computed: {
	  filteredProducts() {
		// 获取当前分类的商品列表
		const category = this.categories.find(cat => cat.id === this.currentCategoryId)
		if (!category) return []
  
		let products = category.products || []
  
		// 搜索过滤
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
	  // 设置当前 tab 为首页（商品列表页就是首页）
	  this.currentTab = 'home'
  
	  // 添加全局事件监听器
	  uni.$on('refreshProductsList', () => {
		// 强制重新加载验证产品数据和购物车
		console.log('接收到刷新购物车事件')
		this.loadVerifiedProductsFromStorage()
	  })
	  this.loadProducts()
	},
	onShow() {
	  // 页面显示时，重新加载已验证的产品数据
	  this.loadVerifiedProductsFromStorage()
	},
	onUnload() {
	  // 移除事件监听器，避免内存泄漏
	  uni.$off('refreshProductsList')
	},
	methods: {
	  getImageUrl,
	  async loadProducts() {
		// 初始化：加载分类列表，并自动加载"全部"分类的商品
		try {
		  uni.showLoading({ title: '加载中...' })
  
		  // 1. 获取分类列表
		  const categoryList = await getCategoryList()
		  console.log('从后端API获取分类列表:', categoryList)
		  this.categoryList = categoryList
  
		  // 2. 初始化分类数据结构（不含商品，所有分类的商品列表都为空）
		  this.categories = [
			{
			  id: 'all',
			  name: '全部分类',
			  products: [] // 初始为空，下面会自动加载
			},
			...categoryList.map(cat => ({
			  id: cat.id,
			  name: cat.name,
			  products: [] // 初始为空，按需加载
			}))
		  ]
  
		  // 3. 自动加载"全部"分类的商品（初始化时显示）
		  await this.loadAllProducts()
		  // 标记"全部"分类已加载
		  this.$set(this.loadedCategories, 'all', true)
  
		  uni.hideLoading()
		  // 分类列表和商品加载完成后，加载已验证的产品
		  this.loadVerifiedProductsFromStorage()
  
		} catch (error) {
		  console.error('❌ 加载分类列表失败:', error)
		  uni.hideLoading()
		  uni.showToast({ title: '加载失败，使用本地数据', icon: 'none' })
		  // 如果请求失败，使用本地数据作为后备
		  this.loadLocalData()
		  this.loadVerifiedProductsFromStorage()
		}
	  },
	  // 加载"全部"分类的商品（只请求一次，不传 categoryId）
	  async loadAllProducts() {
		try {
		  // 调用API，不传 categoryId，查询所有分类的商品
		  const productPage = await getCategoryProducts(null, 1, 100)
		  const productList = productPage.records || productPage.list || []
  
		  // 转换字段名以匹配前端
		  const allProducts = productList.map(p => ({
			id: p.id,
			name: p.productName,
			description: p.subTitle,
			image: getImageUrl(p.coverImage),
			price: p.price,
			unit: p.unit || '份',
			notice: p.usageDesc,
			categoryId: p.categoryId // 记录所属分类
		  }))
  
		  // 更新"全部"分类的商品列表
		  const allCategory = this.categories.find(cat => cat.id === 'all')
		  if (allCategory) {
			allCategory.products = allProducts
		  }
  
		  console.log('全部商品加载完成，共', allProducts.length, '个商品')
		} catch (error) {
		  console.error('加载全部商品失败:', error)
		  uni.showToast({
			title: '加载商品失败',
			icon: 'none',
			duration: 2000
		  })
		}
	  },
	  // 加载指定分类的商品
	  async loadCategoryProducts(categoryId) {
		// 如果已加载过，直接返回
		if (this.loadedCategories[categoryId]) {
		  return
		}
  
		try {
		  uni.showLoading({ title: '加载中...' })
  
		  const productPage = await getCategoryProducts(categoryId, 1, 100)
		  const productList = productPage.records || productPage.list || []
  
		  // 转换字段名以匹配前端
		  const products = productList.map(p => ({
			id: p.id,
			name: p.productName,
			description: p.subTitle,
			image: getImageUrl(p.coverImage),
			price: p.price,
			unit: p.unit || '份',
			notice: p.usageDesc,
			categoryId: categoryId
		  }))
  
		  // 更新对应分类的商品列表
		  const category = this.categories.find(cat => cat.id === categoryId)
		  if (category) {
			category.products = products
			// 标记为已加载
			this.$set(this.loadedCategories, categoryId, true)
			console.log(`分类${categoryId}的商品加载完成，共${products.length}个商品`)
		  }
  
		  uni.hideLoading()
		} catch (error) {
		  console.error(`加载分类${categoryId}商品失败:`, error)
		  uni.hideLoading()
		  uni.showToast({
			title: '加载商品失败',
			icon: 'none',
			duration: 2000
		  })
		}
	  },
	  loadVerifiedProductsFromStorage() {
		// 从 uniStorage 读取已验证的产品和数量
		try {
		  const verifiedProducts = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
		  const productQuantities = uni.getStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES) || {}
  
		  // 更新数据
		  this.verifiedProducts = verifiedProducts
		  this.productQuantities = productQuantities
  
		  // 使用cart.js工具函数更新购物车
		  this.cartItems = loadCartItems(this.categories)
  
		  console.log('已验证产品已加载:', Object.keys(verifiedProducts).length)
		  console.log('购物车项目数量:', this.cartItems.length)
		} catch (e) {
		  console.error('加载已验证产品失败:', e)
		}
	  },
	  async switchCategory(categoryId) {
		// 先切换分类
		this.currentCategoryId = categoryId
  
		// 如果切换到"全部"分类
		if (categoryId === 'all') {
		  // 如果"全部"分类还未加载，则加载
		  if (!this.loadedCategories[categoryId]) {
			await this.loadAllProducts()
			// 标记"全部"分类已加载
			this.$set(this.loadedCategories, 'all', true)
			// 加载完成后，更新购物车数据
			this.loadVerifiedProductsFromStorage()
		  }
		  return
		}
  
		// 切换到具体分类，检查是否需要加载
		if (!this.loadedCategories[categoryId]) {
		  await this.loadCategoryProducts(categoryId)
		  // 加载完成后，更新购物车数据
		  this.loadVerifiedProductsFromStorage()
		}
	  },
	  handleSearch() {
		// 搜索功能已在computed中实现
	  },
	  goToDetail(product) {
		// 跳转到详情页面，传递产品信息
		// 将产品信息序列化后传递
		const productData = encodeURIComponent(JSON.stringify({
		  id: product.id,
		  name: product.name,
		  price: product.price,
		  image: getImageUrl(product.image),
		  description: product.description,
		  unit: product.unit
		}))
		uni.navigateTo({
		  url: `/pages/products/priducts_detail?product=${productData}`
		})
	  },
	  goToNotice(product) {
		// 未登录先跳转登录
		const token = getToken()
		console.log('token', token);
  
		if (!token) {
		  uni.navigateTo({
			url: '/pages/register/register?redirect=/pages/products/priducts_list'
		  })
		  return
		}
		// 跳转到注意页面
		uni.navigateTo({
		  url: `/pages/products/product_notice?id=${product.id}`
		})
	  },
	  setProductVerified(productId, verified) {
		// 设置产品验证状态
		if (verified) {
		  // 使用新的数据格式
		  const productData = {
			verified: true,
			selected: true, // 默认为选中状态
			quantity: 1, // 初始化数量为1
			timestamp: Date.now()
		  }
		  this.$set(this.verifiedProducts, productId, productData)
		  // 同步更新旧格式以保持兼容性
		  this.$set(this.productQuantities, productId, 1)

		  // 保存到 uniStorage
		  this.saveVerifiedProductsToStorage()
		  // 添加到购物车
		  this.addToCartAfterVerified(productId)
		}
	  },
	  saveVerifiedProductsToStorage() {
		// 保存已验证产品和数量到 uniStorage
		try {
			console.log('this.verifiedProducts', this.verifiedProducts);
			console.log('this.productQuantities', this.productQuantities);
		  uni.setStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS, this.verifiedProducts)
		  uni.setStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES, this.productQuantities)
		} catch (e) {
		  console.error('保存已验证产品失败:', e)
		}
	  },
	  isProductVerified(productId) {
		const productData = this.verifiedProducts[productId]
		// 支持新旧两种数据格式
		if (typeof productData === 'object' && productData !== null) {
			// 新格式：检查 verified 字段
			return productData.verified === true
		} else {
			// 旧格式：直接检查布尔值
			return productData === true
		}
	  },
	  getProductQuantity(productId) {
		const productData = this.verifiedProducts[productId]
		// 支持新旧两种数据格式
		if (typeof productData === 'object' && productData !== null) {
			// 新格式：从对象中获取数量
			return productData.quantity || 0
		} else {
			// 旧格式：从单独的 productQuantities 中获取
			return this.productQuantities[productId] || 0
		}
	  },
	  increaseQuantity(product) {
		const productData = this.verifiedProducts[product.id]

		if (typeof productData === 'object' && productData !== null) {
			// 新格式：直接修改数量
			productData.quantity = (productData.quantity || 1) + 1
			productData.timestamp = Date.now()
			// 同步更新旧格式以保持兼容性
			this.$set(this.productQuantities, product.id, productData.quantity)
		} else {
			// 旧格式：兼容处理
			const current = Number(this.productQuantities[product.id] || 0)
			const newQty = current + 1
			this.$set(this.productQuantities, product.id, newQty)
		}

		// 保存到 uniStorage
		this.saveVerifiedProductsToStorage()
		// 使用cart.js工具函数重新加载购物车，确保数据一致性
		this.cartItems = loadCartItems(this.categories)
		console.log('增加数量后购物车项目:', this.cartItems.length)
	  },
	  decreaseQuantity(product) {
		const productData = this.verifiedProducts[product.id]

		if (typeof productData === 'object' && productData !== null) {
			// 新格式：直接修改数量
			const current = productData.quantity || 1

			if (current <= 1) {
				// 数量从1减到0，移除产品验证状态
				delete this.verifiedProducts[product.id]
				this.verifiedProducts = { ...this.verifiedProducts }
				// 同步删除旧格式数据
				if (this.productQuantities.hasOwnProperty(product.id)) {
					delete this.productQuantities[product.id]
					this.productQuantities = { ...this.productQuantities }
				}
			} else {
				productData.quantity = current - 1
				productData.timestamp = Date.now()
				// 同步更新旧格式以保持兼容性
				this.$set(this.productQuantities, product.id, productData.quantity)
			}
		} else {
			// 旧格式：兼容处理
			const current = Number(this.productQuantities[product.id] || 0)

			if (current <= 0) return

			if (current > 1) {
				const newQty = current - 1
				this.$set(this.productQuantities, product.id, newQty)
			} else { // current === 1
				// 数量从1减到0，移除产品验证状态
				if (this.verifiedProducts.hasOwnProperty(product.id)) {
					delete this.verifiedProducts[product.id]
					this.verifiedProducts = { ...this.verifiedProducts }
				}
				if (this.productQuantities.hasOwnProperty(product.id)) {
					delete this.productQuantities[product.id]
					this.productQuantities = { ...this.productQuantities }
				}
			}
		}

		// 保存到 uniStorage
		this.saveVerifiedProductsToStorage()
		// 使用cart.js工具函数重新加载购物车
		this.cartItems = loadCartItems(this.categories)
	  },
	  // updateCartItem方法已由loadCartItems替代
	  // removeFromCart方法已由loadCartItems替代
	  addToCartAfterVerified(productId) {
		// 找到产品并设置验证状态
		let product = null
		for (let category of this.categories) {
		  product = category.products.find(p => p.id === productId)
		  if (product) break
		}

		if (product) {
		  // 使用新的数据格式设置验证状态
		  const productData = {
			verified: true,
			selected: true,
			quantity: 1,
			timestamp: Date.now()
		  }
		  this.$set(this.verifiedProducts, productId, productData)
		  // 同步更新旧格式以保持兼容性
		  this.$set(this.productQuantities, productId, 1)

		  // 保存到 uniStorage
		  this.saveVerifiedProductsToStorage()
		  // 使用cart.js工具函数重新加载购物车
		  this.cartItems = loadCartItems(this.categories)
		}
	  },
	  directAddToCart(product) {
		// 直接添加到购物车时，也需要设置验证状态
		const existingData = this.verifiedProducts[product.id]

		if (typeof existingData === 'object' && existingData !== null) {
			// 新格式：增加数量
			existingData.quantity = (existingData.quantity || 1) + 1
			existingData.timestamp = Date.now()
			// 同步更新旧格式以保持兼容性
			this.$set(this.productQuantities, product.id, existingData.quantity)
		} else {
			// 旧格式或不存在：创建新数据
			const productData = {
				verified: true,
				selected: true,
				quantity: 1,
				timestamp: Date.now()
			}
			this.$set(this.verifiedProducts, product.id, productData)
			// 同步更新旧格式以保持兼容性
			this.$set(this.productQuantities, product.id, 1)
		}

		// 保存到 uniStorage
		this.saveVerifiedProductsToStorage()
		// 使用cart.js工具函数重新加载购物车
		this.cartItems = loadCartItems(this.categories)

		uni.showToast({
		  title: '已添加到购物车',
		  icon: 'success',
		  duration: 1500
		})
	  },
	  showCart() {
		// 显示购物车详情（可以后续扩展）
		uni.showToast({
		  title: `购物车中有${this.cartCount}件商品`,
		  icon: 'none'
		})
	  },
	  handleSubmit() {
		// 未登录则先去登录
		const token = getToken()
  
		console.log(' getToken()', getToken());
		console.log(!token);
  
		if (!token) {
		  uni.navigateTo({
			url: '/pages/register/register?redirect=/pages/products/priducts_list'
		  })
		  return
		}
		if (this.cartItems.length === 0) {
		  uni.showToast({
			title: '请先选择商品',
			icon: 'none'
		  })
		  return
		}
  
		// 检查是否已注册
		try {
		  const userRegisterInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
		  if (!userRegisterInfo || !userRegisterInfo.realName) {
			// 未注册，跳转到注册页面，传递 redirect 参数
			uni.navigateTo({
			  url: '/pages/register/register?redirect=/pages/products/priducts_list'
			})
			return
		  }
		  this.saveVerifiedProductsToStorage()
		  // 已注册，跳转到申请页面
		  uni.navigateTo({
			url: '/pages/dispense/apply'
		  })
		} catch (e) {
		  console.error('检查注册状态失败:', e)
		  // 出错时也跳转到注册页面，传递 redirect 参数
		  uni.navigateTo({
			url: '/pages/register/register?redirect=/pages/products/priducts_list'
		  })
		}
	  },
	  goToHistory() {
		// 跳转到历史订单页面
		uni.navigateTo({
		  url: '/pages/order/order_list'
		})
	  },
	  goBack() {
		uni.navigateBack()
	  },
	  handleTabChange(tab) {
		this.currentTab = tab
	  },
	  switchToHorizontalLayout() {
		// 跳转到横向分类布局页面
		uni.navigateTo({
		  url: '/pages/products/priducts_list'
		})
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
  
  /* 左侧分类导航 */

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
  
  /* Tab Bar 样式已移至组件中 */
  </style>
  