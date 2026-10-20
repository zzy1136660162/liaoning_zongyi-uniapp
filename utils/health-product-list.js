// 两种健康商城布局共用加载规则；页面保留布局、搜索交互和购物车展示。
// 请求方法由页面注入，避免共享逻辑依赖页面状态或另存一份商品缓存。
export const createHealthProductListMethods = ({ getCategoryList, getCategoryProducts, mapProductListItem }) => ({
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
        total: 0,
        records: []
      })
    }
    return this.productPageState[key]
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

    // 分类切换、搜索与回页刷新共用序号，旧响应不能覆盖最新筛选结果。
    const requestSeq = ++this.requestSeq
    const nextPage = reset ? 1 : state.pageNum + 1
    const apiCategoryId = categoryKey === 'all' ? null : categoryId
    state.loading = true

    try {
      const productPage = await getCategoryProducts(
        apiCategoryId,
        nextPage,
        PRODUCT_PAGE_SIZE,
        PRODUCT_CATEGORY_HEALTH,
        null,
        null,
        this.getSearchKeyword()
      )
      if (requestSeq !== this.requestSeq) {
        return
      }
      const productList = productPage.records || []
      const mapped = productList.map(item => mapProductListItem(item))
      const total = Number(productPage.total || 0)
      const currentRecords = reset ? [] : (state.records || [])
      // 翻页只追加尚未出现的商品，保持后端排序和原有滚动位置。
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
  async loadProducts() {
    // 分类切换、搜索与回页刷新共用序号，旧响应不能覆盖最新筛选结果。
    const requestSeq = ++this.requestSeq
    try {
      uni.showLoading({ title: '加载中...' })
      const categoryList = await getCategoryList(PRODUCT_CATEGORY_HEALTH)
      if (requestSeq !== this.requestSeq) return
      this.categoryList = Array.isArray(categoryList) ? categoryList : []
      this.categories = [
      { id: 'all', name: '全部分类', products: [] },
      ...this.categoryList.map(cat => ({ id: cat.id, name: cat.name, products: [] }))
      ]
      this.productPageState = {}
      if (!this.categories.some(category => this.getCategoryKey(category.id) === this.getCategoryKey(this.currentCategoryId))) {
        this.currentCategoryId = 'all'
      }
      await this.fetchProductPage(this.currentCategoryId, { reset: true })
      this.loadVerifiedProductsFromStorage()
    } catch (error) {
      console.error('loadProducts failed:', error)
      uni.showToast({ title: '加载商品失败', icon: 'none' })
    } finally {
      uni.hideLoading()
    }
  },
  async loadAllProducts() {
    await this.fetchProductPage('all', { reset: true })
  },
  async loadCategoryProducts(categoryId) {
    await this.fetchProductPage(categoryId, { reset: true })
  },
})
import { PRODUCT_CATEGORY_HEALTH } from './product-biz.js'

const PRODUCT_PAGE_SIZE = 20
