<template>
  <view class="product-container">
    <view class="top-banner">
      <image
        class="top-banner-img"
        src="https://smf.lntcm.com/static/img/yiyuan1.jpg"
        mode="widthFix"
      />
    </view>
    <view
      class="hospital-intro"
      :class="{ collapsed: imageCollapsed }"
    >
      <view class="logo-wrap">
        <image
          class="hospital-logo"
          src="https://shop.lntcm.com/assets_files/upload/2026/01/26/logotou.png"
          mode="aspectFit"
        />
        <view class="logo-badge">
          互联网医院
        </view>
      </view>
      <view class="hospital-info">
        <view class="hospital-name-row">
          <text class="hospital-name">
            辽宁中医药大学附属医院互联网医院
          </text>
          <!-- <text class="verify-icon">✓</text> -->
        </view>
        <view class="hospital-desc">
          便捷配方 · 权威认证 · 品质保障 · 放心购买
        </view>
        <view
          class="internet-hospital-toggle"
          @click="showInternetHospital = !showInternetHospital"
        >
          <text class="toggle-text flow-text-animate">
            便捷配方操作流程
          </text>
          <uni-icons
            :type="showInternetHospital ? 'up' : 'down'"
            size="12"
            color="#ff6b35"
          />
        </view>
        <!-- <view class="hospital-tags">
          <text class="journey-title">
            流程
          </text>
          <view class="journey-strip">
            <template
              v-for="(step, index) in flowSteps"
              :key="step"
            >
              <view
                class="journey-step"
                :class="{ featured: index === 2 }"
              >
                <text class="journey-step-index">
                  {{ index + 1 }}
                </text>
                <text class="journey-step-text">
                  {{ step }}
                </text>
              </view>
              <text
                v-if="index < flowSteps.length - 1"
                class="journey-arrow"
              >
                {{ '>' }}
              </text>
            </template>
          </view>
        </view> -->
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
    </view>
    <view
      v-show="showInternetHospital"
      class="flow-wrapper"
    >
      <view class="flow-steps">
        <view class="flow-card">
          <view class="flow-header">
            <uni-icons
              type="info"
              size="14"
              color="#4A90E2"
            />
            <text class="flow-title">
              便捷配方操作流程
            </text>
          </view>
          <view class="flow-content">
            <view class="flow-step">
              <view class="step-num">
                1
              </view>
              <text class="step-text">
                选择制剂
              </text>
            </view>
            <view class="flow-line" />
            <view class="flow-step">
              <view class="step-num">
                2
              </view>
              <text class="step-text">
                完善信息
              </text>
            </view>
            <view class="flow-line" />
            <view class="flow-step">
              <view class="step-num">
                3
              </view>
              <text class="step-text">
                医生开方
              </text>
            </view>
            <view class="flow-line" />
            <view class="flow-step">
              <view class="step-num">
                4
              </view>
              <text class="step-text">
                购买制剂
              </text>
            </view>
          </view>
        </view>
      </view>
    </view>
    <view class="intro-divider" />
    <view class="search-section">
      <view class="search-bar">
        <uni-icons
          type="search"
          size="18"
          color="#999999"
        />
        <input
          v-model="searchKeyword"
          class="search-input"
          placeholder="搜索院内制剂"
          @input="handleSearch"
        >
        <button
          class="search-btn"
          @click="handleSearch"
        >
          搜索
        </button>
      </view>
    </view>

    <view class="main-content">
      <scroll-view
        class="category-nav"
        scroll-y
      >
        <view
          v-for="category in categories"
          :key="category.id"
          class="category-group"
        >
          <view
            class="category-item"
            :class="{ active: currentCategoryId === category.id }"
            @click="switchCategory(category.id)"
          >
            <text class="category-name">
              {{ category.name }}
            </text>
          </view>
          <view
            v-if="currentCategoryId === category.id && category.children && category.children.length > 0 && !isCategoryCollapsed(category.id)"
            class="sub-category-inline"
          >
            <view
              v-for="subCategory in getInlineSubCategories(category)"
              :key="subCategory.id"
              class="sub-category-inline-item"
              :class="{ active: currentSubCategoryId === subCategory.id }"
              @click.stop="switchSubCategory(subCategory.id)"
            >
              <text class="sub-category-inline-name">
                {{ subCategory.name }}
              </text>
            </view>
          </view>
        </view>
      </scroll-view>

      <view class="product-list-wrapper">
        <view class="product-list-header">
          <view class="header-left">
            <view
              class="prescription-title"
              @click="switchToHorizontalLayout"
            >
              <text class="prescription-text">
                制剂方
              </text>
            </view>
            <view class="sort-section">
              <view
                class="sort-btn"
                :class="{ active: sortType === '' }"
                @click="toggleSort('')"
              >
                <text class="sort-text">
                  综合
                </text>
              </view>
              <view
                class="sort-btn"
                :class="{ active: sortType === 'sales' }"
                @click="toggleSort('sales')"
              >
                <text class="sort-text">
                  销量
                </text>
                <text
                  class="sort-arrow"
                  :class="{ desc: sortType === 'sales' && sortOrder === 'desc' }"
                >
                  ↓
                </text>
              </view>
              <view
                class="sort-btn"
                :class="{ active: sortType === 'price' }"
                @click="toggleSort('price')"
              >
                <text class="sort-text">
                  价格
                </text>
                <text
                  class="sort-arrow"
                  :class="{ desc: sortType === 'price' && sortOrder === 'desc' }"
                >
                  ↓
                </text>
              </view>
              <!-- <view
                class="sort-btn"
                :class="{ active: sortType === 'stock' }"
                @click="toggleSort('stock')"
              >
                <text class="sort-text">
                  库存
                </text>
                <text
                  class="sort-arrow"
                  :class="{ desc: sortType === 'stock' && sortOrder === 'desc' }"
                >
                  ↓
                </text>
              </view> -->
            </view>
          </view>
          <!-- <view class="history-order" @click="goToHistory">
            <uni-icons type="list" size="18" color="#666666"></uni-icons>
            <text class="history-text">历史订单</text>
          </view> -->
        </view>

        <scroll-view
          class="product-list"
          scroll-y
          lower-threshold="120"
          @scrolltolower="handleLoadMore"
        >
          <view class="product-items">
            <view
              v-for="product in filteredProducts"
              :key="product.id"
              class="product-item"
            >
              <view class="image-wrapper">
                <image
                  class="product-image"
                  :src="getImageUrl(product.image)"
                  mode="aspectFill"
                  @click="goToDetail(product)"
                />
                <view
                  v-if="product.isNewProduct === 1"
                  class="hot-badge"
                >
                  新
                </view>
              </view>
              <view class="product-info">
                <text
                  class="product-name"
                  @click="goToDetail(product)"
                >
                  <text
                    v-if="product.categoryId === 34"
                    class="therapy-tag"
                  >
                    传统疗法
                  </text>
                  <text
                    v-if="product.isSelfDeveloped === 1"
                    class="self-tag"
                  >
                    自研
                  </text>
                  <text
                    v-if="product.isHospitalStarFormula === 1"
                    class="self-tag2"
                  >
                    院藏王牌制剂
                  </text>
                  <text
                    v-if="product.isNewProduct === 1"
                    class="self-tag3"
                  >
                    重磅新品
                  </text>
                  {{ product.name }}
                </text>
                <text
                  v-if="product.description"
                  class="product-desc"
                >
                  {{ product.description }}
                </text>
                <!-- <view class="product-meta-tags">
                  <text class="meta-tag">
                    {{ getExternalUseLabel(product.isExternal) }}
                  </text>
                  <text class="meta-tag">
                    {{ getColdShippingLabel(product.coldShippingType) }}
                  </text>
                </view> -->
                <view class="product-footer">
                  <!-- <text class="product-unit">{{ product.specText || product.unit || '' }}</text> -->
                  <view class="product-price-row">
                    <!-- 售罄状态 -->
                    <view
                      v-if="product.stock === 0"
                      class="sold-out-tag"
                    >
                      售罄
                    </view>
                    <!-- 有库存且已添加数量 -->
                    <view
                      v-else-if="getProductQuantity(product.id) > 0"
                      class="quantity-selector"
                    >
                      <uni-number-box
                        :value="getProductQuantity(product.id)"
                        :min="0"
                        :max="999"
                        :step="1"
                        @change="(val) => onNumberBoxChange(product, val)"
                      />
                    </view>
                    <!-- 有库存且未添加 -->
                    <template v-else>
                      <text class="product-price">
                        ￥{{ Number(product.price || 0).toFixed(2) }}
                      </text>
                      <view
                        class="add-btn"
                        @click.stop="handleAddToCart(product)"
                      >
                        +
                      </view>
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

    <TabBar
      :current="currentTab"
      :cart-count="cartCount"
      @change="handleTabChange"
    />

    <view
      v-if="showFlyBall"
      class="fly-ball"
      :style="{
        left: flyBallStyle.left + 'px',
        top: flyBallStyle.top + 'px',
        transform: `translate(-50%, -50%) scale(${flyBallStyle.scale})`
      }"
    />
  </view>
</template>

<script>
import { STORAGE_KEY_CURRENT_CONSULTATION_ID, STORAGE_KEY_USER_REGISTER } from '@/utils/storage.js'
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
import { buildCategoryTree, normalizeCategoryId } from '@/utils/category-tree.js'
import { subscribeCartUpdated } from '@/utils/cart-events.js'
import {
  getColdShippingLabel,
  getExternalUseLabel,
  isSelfDevelopedProduct
} from '@/utils/product-display.js'

const PRODUCT_BIZ_TYPE_FILTER = null // null=全部, 1=医院制剂, 2=健康产品
const PRODUCT_PAGE_SIZE = 20
const PRODUCT_LIST_TTL = 5 * 60 * 1000

export default {
  components: { TabBar },
  data() {
    return {
      showInternetHospital: false,
      searchKeyword: '',
      currentCategoryId: 'all',
      currentSubCategoryId: '',
      collapsedCategoryIds: [],
      categories: [],
      categoryTree: [],
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
      productPageState: {},
      categoryList: [],
      isScrolled: false,
      sortType: '',
      sortOrder: 'desc',
      imageCollapsed: false,
      unsubscribeCartUpdated: null,
      searchTimer: null,
      requestSeq: 0
    }
  },
  computed: {
    currentCategory() {
      return this.categories.find(cat => cat.id === this.currentCategoryId) || null
    },
    activeSubCategories() {
      return this.currentCategory?.children || []
    },
    filteredProducts() {
      const category = this.currentCategory
      if (!category) return []

      let products = category.products || []
      const currentSubCategoryId = normalizeCategoryId(this.currentSubCategoryId)
      if (!this.getSearchKeyword() && currentSubCategoryId && !this.isAllSubCategoryId(currentSubCategoryId)) {
        products = products.filter(product => normalizeCategoryId(product.categoryId) === currentSubCategoryId)
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
    this.unsubscribeCartUpdated = subscribeCartUpdated(() => {
      this.loadVerifiedProductsFromStorage('cartUpdated')
    })
    this.loadProducts()
    setTimeout(() => {
      this.imageCollapsed = true
    }, 2000)
  },
  onShow() {
    this.loadVerifiedProductsFromStorage()
  },
  onPullDownRefresh() {
    this.handleRefreshProducts()
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
    getExternalUseLabel,
    getColdShippingLabel,
    isSelfDevelopedProduct,
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
      this.reloadCurrentCategoryProducts()
    },
    getSearchKeyword() {
      return (this.searchKeyword || '').trim()
    },
    handleSearch() {
      if (this.searchTimer) {
        clearTimeout(this.searchTimer)
      }
      this.searchTimer = setTimeout(async () => {
        this.searchTimer = null
        if (this.getPageState(this.currentCategoryId).loading) {
          this.handleSearch()
          return
        }
        await this.reloadCurrentCategoryProducts()
      }, 300)
    },
    getCategoryKey(categoryId) {
      return normalizeCategoryId(categoryId || 'all')
    },
    getQueryCategoryId(categoryId) {
      const categoryKey = this.getCategoryKey(categoryId)
      const currentKey = this.getCategoryKey(this.currentCategoryId)
      const subCategoryId = normalizeCategoryId(this.currentSubCategoryId)
      if (
        categoryKey === currentKey &&
        subCategoryId &&
        !this.isAllSubCategoryId(subCategoryId)
      ) {
        return subCategoryId
      }
      return categoryId
    },
    getProductQuerySignature() {
      return [
        this.getSearchKeyword(),
        this.mapSortField() || '',
        this.sortType ? this.sortOrder : ''
      ].join('|')
    },
    getPageStateKey(categoryId) {
      const categoryKey = this.getCategoryKey(categoryId)
      const queryCategoryId = this.getQueryCategoryId(categoryId)
      return `${categoryKey}:query:${this.getCategoryKey(queryCategoryId)}:${this.getProductQuerySignature()}`
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
    mapSortField() {
      if (this.sortType === 'sales') return 'sales'
      if (this.sortType === 'price') return 'price'
      if (this.sortType === 'stock') return 'stock'
      return null
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
    async fetchProductPage(categoryId, { reset = false } = {}) {
      const categoryKey = this.getCategoryKey(categoryId)
      let state = this.getPageState(categoryId)
      if (state.loading) {
        return
      }
      if (!reset && !state.hasMore) {
        return
      }

      if (reset) {
        this.resetCategoryProducts(categoryId)
        state = this.getPageState(categoryId)
      }

      const requestSeq = ++this.requestSeq
      const nextPage = reset ? 1 : state.pageNum + 1
      const queryCategoryId = this.getQueryCategoryId(categoryId)
      const apiCategoryId = this.getCategoryKey(queryCategoryId) === 'all' ? null : queryCategoryId
      state.loading = true

      try {
        const productPage = await getCategoryProducts(
          apiCategoryId,
          nextPage,
          PRODUCT_PAGE_SIZE,
          PRODUCT_BIZ_TYPE_FILTER,
          this.mapSortField(),
          this.sortType ? this.sortOrder : null,
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
    async reloadCurrentCategoryProducts() {
      try {
        await this.fetchProductPage(this.currentCategoryId, { reset: true })
        this.loadVerifiedProductsFromStorage('reloadProducts')
      } catch (error) {
        uni.showToast({ title: '刷新商品失败', icon: 'none' })
      }
    },
    async handleRefreshProducts() {
      try {
        await this.fetchProductPage(this.currentCategoryId, { reset: true })
        this.loadVerifiedProductsFromStorage('pullRefresh')
      } catch (error) {
        uni.showToast({ title: '刷新失败', icon: 'none' })
      } finally {
        uni.stopPullDownRefresh()
      }
    },
    async handleLoadMore() {
      const state = this.getPageState(this.currentCategoryId)
      if (!state.hasMore || state.loading) {
        return
      }
      try {
        await this.fetchProductPage(this.currentCategoryId, { reset: false })
        this.loadVerifiedProductsFromStorage('loadMore')
      } catch (error) {
        console.error('handleLoadMore failed:', error)
      }
    },
    async loadProducts() {
      try {
        uni.showLoading({ title: '加载中...' })
        const categoryList = await getCategoryList(PRODUCT_BIZ_TYPE_FILTER)
        this.categoryList = Array.isArray(categoryList) ? categoryList : []
        this.categoryTree = buildCategoryTree(this.categoryList)
        this.categories = [
          { id: 'all', name: '全部分类', products: [], children: [] },
          ...this.categoryTree.map(cat => ({
            id: normalizeCategoryId(cat.id),
            name: cat.name,
            parentId: normalizeCategoryId(cat.parentId),
            products: [],
            children: (cat.children || []).map(child => ({
              ...child,
              id: normalizeCategoryId(child.id),
              parentId: normalizeCategoryId(child.parentId)
            }))
          }))
        ]
        this.productPageState = {}
        this.loadedCategories = {}
        this.requestSeq += 1
        await this.loadAllProducts(true)
        this.syncCurrentSubCategory()
        this.loadVerifiedProductsFromStorage('loadProducts')
      } catch (error) {
        console.error('loadProducts failed:', error)
        uni.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        uni.hideLoading()
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
      const normalizedCategoryId = normalizeCategoryId(categoryId)
      const isCurrentCategory = this.currentCategoryId === normalizedCategoryId
      if (isCurrentCategory && this.hasInlineSubCategories(normalizedCategoryId)) {
        if (this.isCategoryCollapsed(normalizedCategoryId)) {
          this.expandCategory(normalizedCategoryId)
        } else {
          this.collapseCategory(normalizedCategoryId)
        }
        return
      }

      this.currentCategoryId = categoryId
      this.currentSubCategoryId = ''
      this.expandCategory(normalizedCategoryId)
      if (categoryId === 'all') {
        await this.loadAllProducts(false)
        this.syncCurrentSubCategory()
        this.loadVerifiedProductsFromStorage('switchCategory:all')
        return
      }
      await this.loadCategoryProducts(categoryId)
      this.syncCurrentSubCategory()
      this.loadVerifiedProductsFromStorage(`switchCategory:${categoryId}`)
    },
    async switchSubCategory(subCategoryId) {
      this.currentSubCategoryId = normalizeCategoryId(subCategoryId)
      try {
        await this.fetchProductPage(this.currentCategoryId, { reset: true })
        this.loadVerifiedProductsFromStorage(`switchSubCategory:${subCategoryId}`)
      } catch (error) {
        console.error('switchSubCategory failed:', error)
      }
    },
    buildAllSubCategoryId(categoryId) {
      return `all:${normalizeCategoryId(categoryId)}`
    },
    isAllSubCategoryId(subCategoryId) {
      return normalizeCategoryId(subCategoryId).startsWith('all:')
    },
    hasInlineSubCategories(categoryId) {
      const category = this.categories.find(cat => cat.id === normalizeCategoryId(categoryId))
      return !!(category && Array.isArray(category.children) && category.children.length > 0)
    },
    isCategoryCollapsed(categoryId) {
      return this.collapsedCategoryIds.includes(normalizeCategoryId(categoryId))
    },
    expandCategory(categoryId) {
      const normalizedCategoryId = normalizeCategoryId(categoryId)
      this.collapsedCategoryIds = this.collapsedCategoryIds.filter(id => id !== normalizedCategoryId)
    },
    collapseCategory(categoryId) {
      const normalizedCategoryId = normalizeCategoryId(categoryId)
      if (this.collapsedCategoryIds.includes(normalizedCategoryId)) {
        return
      }
      this.collapsedCategoryIds = [...this.collapsedCategoryIds, normalizedCategoryId]
    },
    getInlineSubCategories(category) {
      const categoryId = normalizeCategoryId(category?.id)
      const children = Array.isArray(category?.children) ? category.children : []
      return [
        {
          id: this.buildAllSubCategoryId(categoryId),
          name: '全部分类'
        },
        ...children
      ]
    },
    syncCurrentSubCategory() {
      const category = this.categories.find(cat => cat.id === this.currentCategoryId)
      if (!category || !Array.isArray(category.children) || category.children.length === 0) {
        this.currentSubCategoryId = ''
        return
      }
      this.expandCategory(category.id)
      const currentId = normalizeCategoryId(this.currentSubCategoryId)
      const inlineSubCategories = this.getInlineSubCategories(category)
      const exists = inlineSubCategories.some(child => normalizeCategoryId(child.id) === currentId)
      this.currentSubCategoryId = exists ? currentId : this.buildAllSubCategoryId(category.id)
    },
    goToDetail(product) {
      const isTherapy = product?.categoryCode === '传统疗法'
      const page = isTherapy ? 'therapy_detail' : 'medicine_detail'
      uni.navigateTo({
        url: `/pages/products/${page}?id=${product.id}`
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
    onNumberBoxChange(product, val) {
      const current = this.getProductQuantity(product.id)
      if (val > current) {
        this.increaseQuantity(product)
      } else if (val < current) {
        if (val <= 0) {
          removeFromCart(product.id)
          this.loadVerifiedProductsFromStorage()
        } else {
          setCartItemQuantity(product.id, val)
          this.loadVerifiedProductsFromStorage()
        }
      }
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

        if (!checkout.requiresConsultation) {
          uni.removeStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID)
          const therapyParam = checkout.allTraditionalTherapy ? '&therapy=1' : ''
          uni.navigateTo({
            url: `/pages/order/confirm?selectedItems=${checkout.productIds.join(',')}${therapyParam}`
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

.category-group {
  position: relative;
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

.sub-category-inline {
  padding: 6rpx 0 14rpx 0;
  background: linear-gradient(180deg, rgba(245,249,255,0.92), rgba(255,255,255,0.98));
}

.sub-category-inline-item {
  position: relative;
  padding: 16rpx 14rpx 16rpx 34rpx;
  margin: 0 10rpx 6rpx 18rpx;
  border-radius: 16rpx;
}

.sub-category-inline-item::before {
  content: '';
  position: absolute;
  left: 18rpx;
  top: 50%;
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #bfd3ea;
  transform: translateY(-50%);
}

.sub-category-inline-item.active {
  background: rgba(74,144,226,0.1);
}

.sub-category-inline-item.active::before {
  background: #4a90e2;
  box-shadow: 0 0 0 6rpx rgba(74,144,226,0.12);
}

.sub-category-inline-name {
  font-size: 22rpx;
  color: #7b8da3;
  line-height: 1.4;
}

.sub-category-inline-item.active .sub-category-inline-name {
  color: #2d5f9a;
  font-weight: 700;
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
  padding: 20rpx 20rpx 16rpx 0rpx;
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

.therapy-tag {
  display: inline;
  background: linear-gradient(135deg, #4a90e2, #67c6ff);
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  font-weight: bold;
  margin-right: 8rpx;
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

.product-meta-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-bottom: 10rpx;
}

.meta-tag {
  font-size: 20rpx;
  color: #64748b;
  background: #f1f5f9;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
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

.sold-out-tag {
  font-size: 24rpx;
  color: #999;
  background: #f5f5f5;
  padding: 8rpx 24rpx;
  border-radius: 8rpx;
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
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  line-height: 1.5;
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
  padding: 30rpx 30rpx 15rpx 30rpx;
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
.internet-hospital-toggle {
  /* display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx; */
  background: #fff;
}
.toggle-text {
  font-size: 22rpx;
  color: #333;
  font-weight: 500;
}
.flow-text-animate {
  background: linear-gradient(90deg, #ff6b35, #ff9f6b, #ff6b35, #ff9f6b);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: flowGradient 3s linear infinite;
}
@keyframes flowGradient {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
.flow-wrapper {
  width: 100%;
  background: #fff;
  position: relative;
  z-index: 10;
}
.flow-steps {
  width: 100%;
  padding: 16rpx 30rpx;
  box-sizing: border-box;
  position: relative;
  z-index: 10;
}
.flow-card {
  background: linear-gradient(135deg, #f0f7ff, #e8f4ff);
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(74, 144, 226, 0.1);
}
.flow-header {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}
.flow-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #4A90E2;
  margin-left: 8rpx;
}
.flow-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.flow-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}
.step-num {
  width: 40rpx;
  height: 40rpx;
  background: linear-gradient(135deg, #4A90E2, #67b2ff);
  border-radius: 50%;
  color: #fff;
  font-size: 22rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8rpx;
}
.step-text {
  font-size: 22rpx;
  color: #333;
}
.flow-line {
  flex: 1;
  height: 2rpx;
  background: linear-gradient(90deg, #4A90E2, #67b2ff);
  opacity: 0.4;
  margin: 0 8rpx;
  margin-bottom: 24rpx;
}

.hospital-tags {
  display: flex;
  flex-direction: column;
  margin-bottom: 12rpx;
}

.journey-title {
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1;
  color: #8e644e;
  letter-spacing: 2rpx;
}

.journey-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  row-gap: 8rpx;
  column-gap: 8rpx;
  padding: 8rpx 0;
}

.journey-step {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  min-height: 40rpx;
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(244,248,255,0.95);
  color: #6f8296;
}

.journey-step.featured {
  background: rgba(74,144,226,0.12);
  color: #2f6fb2;
}

.journey-step-index {
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16rpx;
  font-weight: 700;
  background: rgba(74,144,226,0.1);
  color: #4a90e2;
}

.journey-step.featured .journey-step-index {
  background: rgba(74,144,226,0.14);
  color: #2f6fb2;
}

.journey-step-text {
  font-size: 20rpx;
  font-weight: 500;
}

.journey-arrow {
  font-size: 20rpx;
  font-weight: 700;
  color: #a7b6c5;
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
