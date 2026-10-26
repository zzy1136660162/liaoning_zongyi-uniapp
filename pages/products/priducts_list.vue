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
        <button class="search-btn" @click="submitSearch">搜索</button>
      </view>
    </view>

    <view class="product-list-header">
      <view class="prescription-title" @click="switchToVerticalLayout">
        <text class="prescription-text">药方</text>
<!--        <image
          class="prescription-icon"
          :src="getImageUrl('/profile/liaoning_zongyi/list_icon2.png')"
          mode="aspectFit"
        ></image>-->
      </view>
      <view class="history-order" @click="goToHistory">
        <uni-icons type="list" size="18" color="#666666"></uni-icons>
        <text class="history-text">订单记录</text>
      </view>
    </view>

    <view class="category-tabs-wrapper">
      <scroll-view class="category-tabs" scroll-x>
        <view class="category-tabs-content">
          <view
            v-for="category in categories"
            :key="category.id"
            class="category-tab-item"
            :class="{ active: currentCategoryId === category.id }"
            @click="switchCategory(category.id)"
          >
            <text class="category-tab-name">{{ category.name }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="product-list-wrapper">
      <scroll-view class="product-list" scroll-y lower-threshold="120" @scrolltolower="handleLoadMore">
        <view class="product-items">
          <view v-for="product in filteredProducts" :key="product.id" class="product-item">
            <view class="image-wrapper" @click="goToDetail(product)">
              <image class="product-image" :src="getProductImageUrl(product.image)" mode="aspectFill" @error="handleProductImageError(product.image)"></image>
              <view class="hot-badge" v-if="product.isNewProduct === 1">新品</view>
            </view>
            <view class="product-info">
              <text class="product-name" @click="goToDetail(product)">
                <text class="self-tag" v-if="product.productCategory === 2">健康</text>
                <text class="self-tag2" v-if="product.isHospitalStarFormula === 1">院藏推荐</text>
                <text class="self-tag3" v-if="product.isPrescription === 1">处方</text>
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
                    <text class="product-price">￥{{ Number(product.price || 0).toFixed(2) }}起</text>
                    <view class="add-btn" :id="`select-btn-${product.id}`" @click="goToNotice(product)">+</view>
                  </template>
                </view>
              </view>
            </view>
          </view>
          <view v-if="filteredProducts.length === 0" class="empty-state">暂无符合条件的商品</view>
        </view>
      </scroll-view>
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

    <TabBar :current="currentTab" @change="handleTabChange" />

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
  STORAGE_KEY_CURRENT_CONSULTATION_ID
} from '@/utils/storage.js'
import { fetchAccountProfile } from '@/utils/account.js'
import { createHealthProductListMethods } from '@/utils/health-product-list.js'
import { getCategoryList, getCategoryProducts, getProductDetail, mapProductDetail, mapProductListItem } from '@/api/product.js'
import {
  addCartItem,
  calculateTotalPrice,
  calculateTotalQuantity,
  getCartEntries,
  loadCartItems,
  prepareCheckout,
  resolveCartCompatibility,
  changeCartItemQuantity,
  refreshCart
} from '@/utils/cart.js'
import { getImageUrl } from '@/utils/config.js'
import { useProductImages } from '@/utils/product-image.js'
import { buildListCartCategories, getProductCartLines } from '@/utils/product-list-cart.js'
import { isPurchaseAvailable } from '@/utils/purchase-quantity.js'
import { resolveProductSku, withProductSku } from '@/utils/product-sku.js'
import { requireAccountSession } from '@/utils/auth-session.js'
import { buildQuestionnaireNoticeUrl } from '@/utils/questionnaire-state.js'
import TabBar from '@/components/TabBar/TabBar.vue'
import { subscribeCartUpdated } from '@/utils/cart-events.js'
import { isTraditionalTherapyProduct } from '@/utils/therapy.js'
import { logPageView, logButtonClick, logAccess, getActionFailureResult } from '@/utils/accessLog.js'
import { getSessionGeneration, isCurrentSession } from '@/utils/session.js'



const PAGE_LOG = {
  pageId: '', moduleCode: 'MALL', accessType: '商城', pageType: 'HEALTH_PRODUCT_LIST',
  requestUri: '/pages/products/priducts_list', actionCode: 'VIEW_HEALTH_PRODUCT_LIST',
  accessTitle: '访问健康商城横向列表', accessDescription: '用户通过横向分类浏览健康商品'
}

export default {
  setup: useProductImages,
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
    selectedCartItems() {
      return this.cartItems.filter(item => item.selected !== false && isPurchaseAvailable(item))
    },
    totalPrice() {
      return calculateTotalPrice(this.selectedCartItems)
    }
  },
  onLoad() {
    this.currentTab = 'home'
    uni.$on('refreshProductsList', this.updateCartView)
    this.unsubscribeCartUpdated = subscribeCartUpdated(() => {
      this.updateCartView()
    })
  },
  async onShow() {
    logPageView({ ...PAGE_LOG, extraData: { layout: 'horizontal', categoryId: this.currentCategoryId } })
    this.loadProducts()
    try {
      await refreshCart()
      this.updateCartView()
    } catch (error) {
      if (error.code !== 'SESSION_CHANGED') uni.showToast({ title: error.message || '购物车加载失败', icon: 'none' })
    }
  },
  onPullDownRefresh() {
    this.handleRefreshProducts()
  },
  onUnload() {
    uni.$off('refreshProductsList', this.updateCartView)
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
    ...createHealthProductListMethods({ getCategoryList, getCategoryProducts, mapProductListItem }),
    getImageUrl,
    async handleRefreshProducts() {
      try {
        await this.fetchProductPage(this.currentCategoryId, { reset: true })
        this.updateCartView()
      } catch (error) {
        uni.showToast({ title: '刷新失败', icon: 'none' })
      } finally {
        uni.stopPullDownRefresh()
      }
    },
    updateCartView() {
      try {
        this.verifiedProducts = getCartEntries()
        this.cartItems = loadCartItems(buildListCartCategories(this.categories, this.verifiedProducts))
      } catch (error) {
        console.error('updateCartView failed:', error)
      }
    },
    async switchCategory(categoryId) {
      if (String(this.currentCategoryId) !== String(categoryId)) logButtonClick({ ...PAGE_LOG, actionCode: 'CHANGE_PRODUCT_CATEGORY', accessTitle: '切换商品分类', accessDescription: '用户切换商品列表的展示分类', extraData: { categoryId } })
      this.currentCategoryId = categoryId
      if (categoryId === 'all') {
        await this.loadAllProducts()
        this.updateCartView()
        return
      }
      await this.loadCategoryProducts(categoryId)
      this.updateCartView()
    },
    submitSearch() {
      logButtonClick({ ...PAGE_LOG, actionCode: 'SEARCH_PRODUCTS', accessTitle: '搜索商品', accessDescription: '用户点击搜索按钮检索当前商品列表', extraData: { categoryId: this.currentCategoryId, hasKeyword: Boolean(this.getSearchKeyword()) } })
      this.handleSearch()
    },
    handleSearch(e) {
      if (e && e.detail) {
        this.searchKeyword = e.detail.value || ''
      }
      if (this.getSearchKeyword() && this.currentCategoryId !== 'all') {
        this.currentCategoryId = 'all'
      }
      if (this.searchTimer) {
        clearTimeout(this.searchTimer)
      }
      this.searchTimer = setTimeout(async () => {
        this.searchTimer = null
        if (this.getPageState(this.currentCategoryId).loading) {
          this.handleSearch()
          return
        }
        try {
          await this.fetchProductPage(this.currentCategoryId, { reset: true })
          this.updateCartView()
        } catch (error) {
          console.error('handleSearch failed:', error)
        }
      }, 300)
    },
    goToDetail(product) {
      logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_PRODUCT_DETAIL', accessTitle: '查看商品详情', accessDescription: '用户从商品列表进入对应的制剂或传统疗法详情', extraData: { productId: product.id, categoryId: this.currentCategoryId } })
      const page = isTraditionalTherapyProduct(product) ? 'therapy_detail' : 'medicine_detail'
      console.info('category=PRODUCT_NAVIGATION action=go_detail result=pending from=PRODUCT_LIST targetPage=%s productId=%s', page, product.id)
      uni.navigateTo({
        url: `/pages/products/${page}?id=${product.id}`
      })
    },
    async goToNotice(product) {
      const session = getSessionGeneration()
      const actionLog = { ...PAGE_LOG, actionCode: 'ADD_CART', accessTitle: '加入购物车', accessDescription: '用户从商品列表选择真实可售规格并保存到购物车', extraData: { productId: product?.id } }
      logButtonClick(actionLog)
      let productLoaded = false
      if (!(await requireAccountSession('/pages/products/priducts_list'))) {
        logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED', extraData: { ...actionLog.extraData, reason: 'LOGIN_REQUIRED' } })
        return
      }
      try {
        // 快捷加购和详情页使用同一真实 SKU 选择规则，问卷也绑定本次规格。
        const detail = mapProductDetail(await getProductDetail(product.id))
        if (!isCurrentSession(session)) return
        productLoaded = true
        product = withProductSku(detail, resolveProductSku(detail))
        if (!isPurchaseAvailable(product)) throw new Error('商品已售罄或限购额度已用完')
        const flow = resolveCartCompatibility(product)
        if (!flow.valid) {
          if (isCurrentSession(session)) logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED', extraData: { ...actionLog.extraData, reason: 'CART_INCOMPATIBLE' } })
          uni.showToast({ title: flow.message, icon: 'none' })
          return
        }
        // 健康商品也先加购，结算只检查所选商品中固定的一份问卷。
        if (!(await addCartItem(product, 1))) throw new Error('加入购物车失败')
        this.updateCartView()
        if (isCurrentSession(session)) logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'SUCCESS', extraData: { ...actionLog.extraData, skuId: product.skuId } })
        uni.showToast({ title: '已加入购物车', icon: 'success' })
      } catch (error) {
        if (isCurrentSession(session)) logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: productLoaded ? 'FAILED' : getActionFailureResult(error), extraData: { ...actionLog.extraData, reason: productLoaded ? 'LOCAL_CART_REJECTED' : 'PRODUCT_LOOKUP_UNAVAILABLE' } })
        uni.showToast({ title: error.message || '加入购物车失败', icon: 'none' })
      }
    },
    isProductVerified(productId) {
      return getProductCartLines(this.verifiedProducts, productId).length > 0
    },
    getProductQuantity(productId) {
      return getProductCartLines(this.verifiedProducts, productId).reduce((total, line) => total + Number(line.quantity || 0), 0)
    },
    getQuantityCartLine(product) {
      const lines = getProductCartLines(getCartEntries(), product.id)
      // 列表展示商品总量，多规格必须到购物车逐行调整，避免误改其他规格。
      if (lines.length > 1) {
        this.showCart()
        return null
      }
      if (lines[0] && !lines[0].skuId) {
        this.goToDetail(product)
        return null
      }
      return lines[0] || null
    },
    async increaseQuantity(product) {
      const lines = getProductCartLines(getCartEntries(), product.id)
      if (!lines.length) return this.goToNotice(product)
      const line = this.getQuantityCartLine(product)
      if (!line) return
      try {
        await changeCartItemQuantity(line.cartKey, 1)
        this.updateCartView()
      } catch (error) {
        if (error.code !== 'SESSION_CHANGED') uni.showToast({ title: error.message || '修改数量失败', icon: 'none' })
      }
    },
    async decreaseQuantity(product) {
      const line = this.getQuantityCartLine(product)
      if (!line) return
      try {
        await changeCartItemQuantity(line.cartKey, -1)
        this.updateCartView()
      } catch (error) {
        if (error.code !== 'SESSION_CHANGED') uni.showToast({ title: error.message || '修改数量失败', icon: 'none' })
      }
    },
    showCart() {
      logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_CART', accessTitle: '查看购物车', accessDescription: '用户从商品列表进入购物车' })
      uni.navigateTo({ url: '/pages/cart/cart' })
    },
    async handleSubmit() {
      const session = getSessionGeneration()
      const actionLog = { ...PAGE_LOG, actionCode: 'START_CHECKOUT', accessTitle: '发起商品结算', accessDescription: '用户按列表中选中的商品发起问卷、复诊或订单确认流程', extraData: { selectedCount: this.selectedCartItems.length } }
      logButtonClick(actionLog)
      if (!(await requireAccountSession('/pages/products/priducts_list'))) {
        logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED', extraData: { ...actionLog.extraData, reason: 'LOGIN_REQUIRED' } })
        return
      }
      if (this.selectedCartItems.length === 0) {
        logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED', extraData: { ...actionLog.extraData, reason: 'NO_SELECTION' } })
        uni.showToast({ title: '请先选择商品', icon: 'none' })
        return
      }

      try {
        await refreshCart()
        this.updateCartView()
        // 正式账户资料来自接口，页面表单和姓名不能代表注册状态。
        await fetchAccountProfile()
        if (!isCurrentSession(session)) return

        const selectedIds = this.selectedCartItems.map(item => String(item.id))
        const checkout = prepareCheckout(selectedIds, buildListCartCategories(this.categories, getCartEntries()))
        if (!checkout.valid) {
          if (checkout.questionnaireCheck?.state === 'required') {
            uni.navigateTo({ url: buildQuestionnaireNoticeUrl(checkout.questionnaireCheck.item,
              { action: 'checkout', selectedItems: checkout.productIds }) })
            return
          }
          logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED', extraData: { ...actionLog.extraData, reason: 'CHECKOUT_REJECTED' } })
          uni.showToast({
            title: checkout.message,
            icon: 'none'
          })
          return
        }

        if (!checkout.requiresConsultation) {
          uni.removeStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID)
          uni.navigateTo({
            url: `/pages/order/confirm?selectedItems=${checkout.productIds.join(',')}`
          })
          return
        }

        uni.navigateTo({
          url: `/pages/dispense/apply?selectedItems=${checkout.productIds.join(',')}`
        })
      } catch (error) {
        if (error.code !== 'SESSION_CHANGED') uni.showToast({ title: error.message || '结算准备失败', icon: 'none' })
      }
    },
    goToHistory() {
      logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_ORDER_LIST', accessTitle: '查看历史订单', accessDescription: '用户从商品列表进入历史订单列表' })
      uni.navigateTo({ url: '/pages/order/order_list' })
    },
    handleTabChange(tab) {
      this.currentTab = tab
    },
    switchToVerticalLayout() {
      logButtonClick({ ...PAGE_LOG, actionCode: 'CHANGE_LIST_LAYOUT', accessTitle: '切换商品列表布局', accessDescription: '用户切换商城商品列表的展示布局', extraData: { targetLayout: 'vertical' } })
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

  /* 妯悜鍒嗙被Tabs */
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
  /* Tab Bar 鏍峰紡宸茬Щ鑷崇粍浠朵腑 */
  </style>
