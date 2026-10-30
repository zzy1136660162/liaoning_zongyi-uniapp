<template>
  <view
    class="product-container"
    :style="{ '--intro-safe-top': `${introSafeTop}px` }"
  >
    <view class="top-banner">
      <image
        class="top-banner-img"
        src="https://smf.lntcm.com/static/img/yiyuan1.jpg"
        mode="widthFix"
        @load="measureBannerGap"
      />
    </view>
    <view
      id="mall-content"
      class="mall-content"
      :class="{
        'following-finger': isFollowFinger,
        'no-transition': noTransition
      }"
      :style="mallContentStyle"
    >
      <view
        class="hospital-intro"
        @touchstart="onPullStart"
        @touchmove="onPullMove"
        @touchend="onPullEnd"
        @touchcancel="onPullEnd"
      >
        <view class="logo-wrap">
          <image
            class="hospital-logo"
            src="https://smf.lntcm.com/static/shop/logo.png"
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
            便捷配方 · 权威认证 · 品质保障 · 放心开方
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
            @click="submitSearch"
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
            @click="switchCategory(category.id)"
          >
            <view
              class="category-item"
              :class="{ active: currentCategoryId === category.id }"
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
                hover-class="product-item--hover"
                hover-stay-time="80"
                @click="goToDetail(product)"
              >
                <view class="image-wrapper">
                  <image
                    class="product-image"
                    :src="getProductImageUrl(product.image)"
                    mode="aspectFill"
                    @error="handleProductImageError(product.image)"
                  />
                  <view
                    v-if="product.isNewProduct === 1"
                    class="hot-badge"
                  >
                    新
                  </view>
                </view>
                <view class="product-info">
                  <text class="product-name">
                    <text
                      v-if="product.productCategory === 3"
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
                    <view class="product-summary">
                      <text
                        v-if="product.specText || product.unit"
                        class="product-unit"
                      >
                        {{ product.specText || product.unit }}
                      </text>
                      <text class="product-sales">已售 {{ product.salesVolume ?? 0 }}</text>
                    </view>
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
                        @click.stop
                      >
                        <uni-number-box
                          :key="`${product.id}-${quantityRenderVersion}`"
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
                          ￥{{ Number(product.price || 0).toFixed(2) }}起
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

    </view>

    <TabBar
      :current="currentTab"
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
import { getCategoryList, getCategoryProducts, getProductDetail, mapProductDetail, mapProductListItem } from '@/api/product.js'
import {
  addCartItem,
  getCartEntries,
  loadCartItems,
  setCartItemQuantity,
  changeCartItemQuantity,
  refreshCart,
  resolveCartCompatibility
} from '@/utils/cart.js'
import { getImageUrl } from '@/utils/config.js'
import { useProductImages } from '@/utils/product-image.js'
import { isTraditionalTherapyProduct } from '@/utils/therapy.js'
import { buildListCartCategories, getProductCartLines } from '@/utils/product-list-cart.js'
import { isPurchaseAvailable } from '@/utils/purchase-quantity.js'
import { resolveProductSku, withProductSku } from '@/utils/product-sku.js'
import { requireAccountSession } from '@/utils/auth-session.js'
import TabBar from '@/components/TabBar/TabBar.vue'
import { buildCategoryTree, normalizeCategoryId } from '@/utils/category-tree.js'
import { subscribeCartUpdated } from '@/utils/cart-events.js'
import { logPageView, logButtonClick, logAccess, getActionFailureResult } from '@/utils/accessLog.js'
import { getSessionGeneration, isCurrentSession } from '@/utils/session.js'
import {
  getColdShippingLabel,
  getExternalUseLabel,
  isSelfDevelopedProduct
} from '@/utils/product-display.js'


const PAGE_LOG = {
  pageId: '', moduleCode: 'MALL', accessType: '商城', pageType: 'MEDICINE_LIST',
  requestUri: '/pages/products/medicine_list', actionCode: 'VIEW_MEDICINE_LIST',
  accessTitle: '访问制剂商品列表', accessDescription: '用户浏览制剂商品及分类'
}

const PRODUCT_CATEGORY_FILTER = null // null=全部购买分类，目录 categoryId 只作展示筛选
const PRODUCT_PAGE_SIZE = 20

export default {
  setup: useProductImages,
  components: { TabBar },
  data() {
    const shouldPlayIntro = !getApp().globalData.mallIntroPlayed
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
      quantityRenderVersion: 0,
      currentTab: 'home',
      productPageState: {},
      categoryList: [],
      isScrolled: false,
      sortType: '',
      sortOrder: 'desc',
      shouldPlayIntro,
      // 首图上划等待列表渲染完成后再播放
      pendingIntro: shouldPlayIntro,
      introFallbackTimer: null,
      // 列表是否已加载过，返回页面时不重复请求
      productsLoaded: false,
      imageCollapsed: !shouldPlayIntro,
      introSafeTop: 0,
      // 布局是否已折叠（折叠后 margin 收缩，文档高度同步变化）
      layoutCollapsed: !shouldPlayIntro,
      // 折叠动画的视觉位移，只走 transform，避免触发布局重排
      visualOffset: 0,
      noTransition: false,
      settleTimer: null,
      unsubscribeCartUpdated: null,
      searchTimer: null,
      requestSeq: 0,
      pullStartY: null,
      collapseTimer: null,
      pullCurrentY: null,
      isFollowFinger: false,
      // 展开态用于抵消 banner 底部空白，使内容正好从图片下沿开始
      bannerGapPx: 0,
      // 折叠态相对展开态的位移量（px）
      collapseRangePx: 0
    }
  },
  computed: {
    mallContentStyle() {
      // margin 只在折叠布局切换时变化，动画期间恒定；位移全部交给 transform，走合成层不重排。
      const baseMargin = -this.bannerGapPx - (this.layoutCollapsed ? this.collapseRangePx : 0)
      return {
        marginTop: `${baseMargin}px`,
        transform: `translateY(${this.visualOffset}px)`
      }
    },
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
    }
  },
  onLoad() {
    this.updateIntroSafeTop()
    // 折叠位移量 440rpx，换算为 px 与手指位移统一单位
    this.collapseRangePx = uni.upx2px(440)
    // 首次进入即消费标记，动画中途离开也不重播。
    getApp().globalData.mallIntroPlayed = true
    this.currentTab = 'home'
    uni.$on('refreshProductsList', this.updateCartView)
    this.unsubscribeCartUpdated = subscribeCartUpdated(() => {
      this.updateCartView()
    })
  },
  onReady() {
    this.measureBannerGap()
    if (this.pendingIntro) {
      // 兜底：列表加载异常或超时也要正常播放首图上划
      this.introFallbackTimer = setTimeout(() => {
        this.introFallbackTimer = null
        this.playIntroCollapse()
      }, 4500)
    }
  },
  async onShow() {
    logPageView({ ...PAGE_LOG, extraData: { categoryId: this.currentCategoryId, subCategoryId: this.currentSubCategoryId } })
    // 返回页面复用已有列表，不重复请求，保留页面高度与滚动位置
    if (!this.productsLoaded) this.loadProducts()
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
  onHide() {
    this.stopIntro()
  },
  onUnload() {
    this.stopIntro()
    this.clearSettleTimer()
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
    getImageUrl,
    getExternalUseLabel,
    getColdShippingLabel,
    isSelfDevelopedProduct,
    updateIntroSafeTop() {
      // #ifdef MP-WEIXIN
      try {
        const info = uni.getWindowInfo?.() || uni.getSystemInfoSync?.() || {}
        this.introSafeTop = (info.statusBarHeight || 24) + 44 + 8
      } catch {
        this.introSafeTop = 76
      }
      try {
        const menu = uni.getMenuButtonBoundingClientRect?.()
        if (Number.isFinite(menu?.bottom) && menu.bottom > 0) {
          this.introSafeTop = menu.bottom + 8
        }
      } catch {
        // 胶囊信息不可用时保留状态栏与导航高度的回退值。
      }
      // #endif
    },
    measureBannerGap() {
      const query = uni.createSelectorQuery().in(this)
      query.select('.top-banner').boundingClientRect()
      query.select('.top-banner-img').boundingClientRect()
      query.exec((res) => {
        const banner = res && res[0]
        const image = res && res[1]
        if (!banner || !image) return
        // banner 底部与图片底部的差值即多余空白，展开态需要抵消掉，使内容正好从图片下沿开始
        const gap = Math.max(0, (banner.top + banner.height) - (image.top + image.height))
        if (Math.abs(gap - this.bannerGapPx) > 0.5) {
          this.bannerGapPx = gap
        }
      })
    },
    clearSettleTimer() {
      if (this.settleTimer) {
        clearTimeout(this.settleTimer)
        this.settleTimer = null
      }
    },
    // 折叠：先 transform 上移（合成层动画），结束后再把位移换成布局收缩，避免动画期间重排
    runCollapse() {
      if (this.layoutCollapsed) return
      this.clearSettleTimer()
      this.imageCollapsed = true
      this.visualOffset = -this.collapseRangePx
      this.settleTimer = setTimeout(() => {
        this.settleTimer = null
        this.settleLayout(true)
      }, 1500)
    },
    // 展开：先 transform 下移，结束后恢复展开布局
    runExpand() {
      if (!this.layoutCollapsed) return
      this.clearSettleTimer()
      this.imageCollapsed = false
      this.visualOffset = this.collapseRangePx
      this.settleTimer = setTimeout(() => {
        this.settleTimer = null
        this.settleLayout(false)
      }, 1500)
    },
    // 位移归零与布局切换在同一帧完成，视觉位置不变；期间临时关闭过渡避免反向动画
    settleLayout(collapsed) {
      this.noTransition = true
      this.layoutCollapsed = collapsed
      this.imageCollapsed = collapsed
      this.visualOffset = 0
      setTimeout(() => {
        this.noTransition = false
      }, 32)
    },
    playIntroCollapse() {
      if (!this.pendingIntro) return
      this.pendingIntro = false
      if (this.introFallbackTimer) {
        clearTimeout(this.introFallbackTimer)
        this.introFallbackTimer = null
      }
      // 列表已渲染，再停留一段时间让首屏稳定，然后开始上划
      this.scheduleImageCollapse(1800)
    },
    scheduleImageCollapse(delay = 1800) {
      clearTimeout(this.collapseTimer)
      this.collapseTimer = setTimeout(() => {
        this.collapseTimer = null
        this.runCollapse()
      }, delay)
    },
    stopIntro() {
      clearTimeout(this.collapseTimer)
      this.collapseTimer = null
      if (this.introFallbackTimer) {
        clearTimeout(this.introFallbackTimer)
        this.introFallbackTimer = null
      }
      this.pendingIntro = false
      this.shouldPlayIntro = false
      this.pullStartY = null
      this.pullCurrentY = null
      // 离开时若正在跟手，回到当前折叠位置；不改折叠布局，返回后保留页面高度
      this.isFollowFinger = false
      this.visualOffset = 0
    },
    onPullStart(e) {
      this.pullStartY = null
      this.isFollowFinger = false
      this.pullCurrentY = null
      // 折叠动画进行中或已展开时不允许下拉，避免与动画抢占位移
      if (this.settleTimer || !this.layoutCollapsed) return
      // 如果触摸目标是 .internet-hospital-toggle 或其子元素，不启动下拉
      const target = e.target || e.currentTarget
      if (target) {
        const targetClass = target.className || ''
        if (typeof targetClass === 'string' && (
          targetClass.includes('internet-hospital-toggle') ||
          targetClass.includes('toggle-text') ||
          targetClass.includes('flow-text-animate') ||
          targetClass.includes('uni-icons')
        )) {
          return
        }
      }
      this.pullStartY = e.touches[0].clientY
    },
    onPullMove(e) {
      if (this.pullStartY === null) return
      const currentY = e.touches[0].clientY
      const distance = currentY - this.pullStartY

      // 下拉距离太小时不触发
      if (distance <= 7.5 && !this.isFollowFinger) return

      // 开始跟随手指
      if (!this.isFollowFinger) {
        this.isFollowFinger = true
        clearTimeout(this.collapseTimer)
        this.collapseTimer = null
      }

      // 直接写 transform 位移，上限 collapseRangePx，最多露出图片底部
      this.visualOffset = Math.max(0, Math.min(distance, this.collapseRangePx))
    },
    onPullEnd() {
      this.pullStartY = null
      this.pullCurrentY = null
      if (!this.isFollowFinger) return
      this.isFollowFinger = false

      if (this.visualOffset > this.collapseRangePx * 0.5) {
        // 过半则继续展开到底，动画结束后再切布局
        this.runExpand()
        this.scheduleImageCollapse(3000)
      } else {
        // 未过半，回弹收起
        this.visualOffset = 0
      }
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
      logButtonClick({ ...PAGE_LOG, actionCode: 'SORT_PRODUCTS', accessTitle: '调整商品排序', accessDescription: '用户调整制剂商品列表的排序方式', extraData: { sortType: this.sortType, sortOrder: this.sortOrder } })
      this.reloadCurrentCategoryProducts()
    },
    getSearchKeyword() {
      return (this.searchKeyword || '').trim()
    },
    submitSearch() {
      logButtonClick({ ...PAGE_LOG, actionCode: 'SEARCH_PRODUCTS', accessTitle: '搜索商品', accessDescription: '用户点击搜索按钮检索当前商品列表', extraData: { categoryId: this.currentCategoryId, hasKeyword: Boolean(this.getSearchKeyword()) } })
      this.handleSearch()
    },
    handleSearch() {
      if (this.getSearchKeyword() && this.currentCategoryId !== 'all') {
        this.currentCategoryId = 'all'
        this.currentSubCategoryId = 'all'
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
          total: 0,
          records: []
        })
      }
      return this.productPageState[key]
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
        total: 0,
        records: []
      })
    },
    async fetchProductPage(categoryId, { reset = false } = {}) {
      const categoryKey = this.getCategoryKey(categoryId)
      let state = this.getPageState(categoryId)
      if (!reset && (state.loading || !state.hasMore)) {
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
          PRODUCT_CATEGORY_FILTER,
          this.mapSortField(),
          this.sortType ? this.sortOrder : null,
          this.getSearchKeyword()
        )
        if (requestSeq !== this.requestSeq) {
          return
        }
        const productList = productPage.records || []
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
        this.updateCartView()
      } catch (error) {
        uni.showToast({ title: '刷新商品失败', icon: 'none' })
      }
    },
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
    async handleLoadMore() {
      const state = this.getPageState(this.currentCategoryId)
      if (!state.hasMore || state.loading) {
        return
      }
      try {
        await this.fetchProductPage(this.currentCategoryId, { reset: false })
        this.updateCartView()
      } catch (error) {
        console.error('handleLoadMore failed:', error)
      }
    },
    async loadProducts() {
      const requestSeq = ++this.requestSeq
      try {
        uni.showLoading({ title: '加载中...' })
        const categoryList = await getCategoryList(PRODUCT_CATEGORY_FILTER)
        if (requestSeq !== this.requestSeq) return
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
        if (!this.categories.some(category => this.getCategoryKey(category.id) === this.getCategoryKey(this.currentCategoryId))) {
          this.currentCategoryId = 'all'
        }
        this.syncCurrentSubCategory()
        await this.fetchProductPage(this.currentCategoryId, { reset: true })
        this.updateCartView()
        this.productsLoaded = true
      } catch (error) {
        console.error('loadProducts failed:', error)
        uni.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        uni.hideLoading()
        // 等列表数据渲染到视图后再播放首图上划
        if (this.pendingIntro) {
          this.$nextTick(() => this.playIntroCollapse())
        }
      }
    },
    async loadAllProducts() {
      await this.fetchProductPage('all', { reset: true })
    },
    async loadCategoryProducts(categoryId) {
      await this.fetchProductPage(categoryId, { reset: true })
    },
    updateCartView() {
      this.verifiedProducts = getCartEntries()
      this.cartItems = loadCartItems(buildListCartCategories(this.categories, this.verifiedProducts))
    },
    async switchCategory(categoryId) {
      if (String(this.currentCategoryId) !== String(categoryId)) logButtonClick({ ...PAGE_LOG, actionCode: 'CHANGE_PRODUCT_CATEGORY', accessTitle: '切换商品分类', accessDescription: '用户切换商品列表的展示分类', extraData: { categoryId } })
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
        await this.loadAllProducts()
        this.syncCurrentSubCategory()
        this.updateCartView()
        return
      }
      await this.loadCategoryProducts(categoryId)
      this.syncCurrentSubCategory()
      this.updateCartView()
    },
    async switchSubCategory(subCategoryId) {
      if (String(this.currentSubCategoryId) !== String(subCategoryId)) logButtonClick({ ...PAGE_LOG, actionCode: 'CHANGE_PRODUCT_SUBCATEGORY', accessTitle: '切换商品子分类', accessDescription: '用户切换制剂商品列表的子分类', extraData: { categoryId: this.currentCategoryId, subCategoryId } })
      this.currentSubCategoryId = normalizeCategoryId(subCategoryId)
      try {
        await this.fetchProductPage(this.currentCategoryId, { reset: true })
        this.updateCartView()
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
      logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_PRODUCT_DETAIL', accessTitle: '查看商品详情', accessDescription: '用户从商品列表进入对应的制剂或传统疗法详情', extraData: { productId: product.id, categoryId: this.currentCategoryId } })
      const page = isTraditionalTherapyProduct(product) ? 'therapy_detail' : 'medicine_detail'
      uni.navigateTo({
        url: `/pages/products/${page}?id=${product.id}`
      })
    },
    buildListRedirect() {
      return '/pages/products/medicine_list'
    },
    ensureLogin() {
      return requireAccountSession(this.buildListRedirect())
    },
    ensureCartCompatible(product) {
      const result = resolveCartCompatibility(product)
      if (!result.valid) {
        uni.showToast({
          title: result.message,
          icon: 'none'
        })
        return false
      }
      return true
    },
    async handleAddToCart(product) {
      const session = getSessionGeneration()
      const actionLog = { ...PAGE_LOG, actionCode: 'ADD_CART', accessTitle: '加入购物车', accessDescription: '用户从商品列表选择真实可售规格并保存到购物车', extraData: { productId: product?.id } }
      logButtonClick(actionLog)
      let productLoaded = false
      if (!product?.id || !(await this.ensureLogin())) {
        logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED', extraData: { ...actionLog.extraData, reason: 'LOGIN_OR_PRODUCT_REQUIRED' } })
        return
      }
      try {
        // 快捷加购重读当前商品，默认选择真实可售规格，不使用列表汇总价和汇总库存。
        const detail = mapProductDetail(await getProductDetail(product.id))
        if (!isCurrentSession(session)) return
        productLoaded = true
        product = withProductSku(detail, resolveProductSku(detail))
        if (!isPurchaseAvailable(product)) throw new Error('商品已售罄或限购额度已用完')
        if (!this.ensureCartCompatible(product)) {
          if (isCurrentSession(session)) logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED', extraData: { ...actionLog.extraData, reason: 'CART_INCOMPATIBLE' } })
          return
        }
        // 加购仅保存当前规格和数量，问卷在结算所选商品时统一检查一次。
        const success = await addCartItem(product, 1)
        if (!success) throw new Error('加入购物车失败')
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
      // 多个规格的汇总数量不能直接增减，进入购物车明确选择需要调整的规格。
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
      if (!lines.length) return this.handleAddToCart(product)
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
    async onNumberBoxChange(product, value) {
      const line = this.getQuantityCartLine(product)
      if (!line) { this.quantityRenderVersion += 1; return }
      try {
        await setCartItemQuantity(line.cartKey, value)
        this.updateCartView()
      } catch (error) {
        this.quantityRenderVersion += 1
        if (error.code !== 'SESSION_CHANGED') uni.showToast({ title: error.message || '修改数量失败', icon: 'none' })
      }
    },
    showCart() {
      logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_CART', accessTitle: '查看购物车', accessDescription: '用户从商品列表进入购物车' })
      uni.navigateTo({ url: '/pages/cart/cart' })
    },
    goToHistory() {
      logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_ORDER_LIST', accessTitle: '查看历史订单', accessDescription: '用户从商品列表进入历史订单列表' })
      uni.navigateTo({ url: '/pages/order/order_list' })
    },
    handleTabChange(tab) {
      this.currentTab = tab
    },
    switchToHorizontalLayout() {
      logButtonClick({ ...PAGE_LOG, actionCode: 'CHANGE_LIST_LAYOUT', accessTitle: '切换商品列表布局', accessDescription: '用户切换商城商品列表的展示布局', extraData: { targetLayout: 'horizontal' } })
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
}

.category-nav {
  width: 180rpx;
  padding-bottom: 20rpx;
  background: #fcfcfc;
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

.product-items,
.category-group:last-child {
  padding-bottom: 150rpx;
  padding-bottom: calc(150rpx + env(safe-area-inset-bottom));
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

.product-item--hover {
  background-color: #f2f2f2;
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
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 120rpx;
}

.product-name {
  display: -webkit-box;
  font-size: 28rpx;
  font-weight: 500;
  color: #333333;
  margin-bottom: 8rpx;
  line-height: 1.4;
  word-wrap: break-word;
  word-break: break-all;
  overflow: hidden;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
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

.product-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  min-width: 0;
}

.product-unit {
  min-width: 0;
  font-size: 22rpx;
  color: #999999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-sales {
  flex-shrink: 0;
  margin-left: auto;
  font-size: 22rpx;
  color: #999999;
  white-space: nowrap;
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
  min-height: calc(340rpx + var(--intro-safe-top, 0px));
  overflow: hidden;
}

.top-banner-img {
  width: 100%;
  display: block;
}

/* 折叠位移只走 transform，由合成层完成，动画期间不触发页面重排 */
#mall-content {
  transition: transform 1.5s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  backface-visibility: hidden;
}

/* 跟手与布局校正期间不补间，避免和手指位移、布局切换打架 */
#mall-content.following-finger,
#mall-content.no-transition {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  #mall-content {
    transition-duration: 1ms;
  }
}

.hospital-intro {
  border-top-left-radius: 36rpx;
  border-top-right-radius: 36rpx;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
  background: linear-gradient(135deg, #fafafa, #fff);
  padding: 30rpx 30rpx 15rpx 30rpx;
  position: relative;
  z-index: 10;
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
  /* background: #fff; */
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
