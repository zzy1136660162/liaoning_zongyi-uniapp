import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadOptions, loadSetup } from './sfc-harness.mjs'
import { buildCategoryTree, normalizeCategoryId } from '../utils/category-tree.js'
import { withProductSku } from '../utils/product-sku.js'

globalThis.uni = { showLoading() {}, hideLoading() {}, showToast() {} }
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

for (const file of ['medicine_list.vue', 'priducts_list.vue', 'priducts_list2.vue']) {
  const createList = (getProducts, getCategories) => {
    const calls = [], categoryCalls = []
    const definition = loadOptions(`pages/products/${file}`, {
      getApp: () => ({ globalData: { mallIntroPlayed: false } }),
      TabBar: {}, getImageUrl: value => value, getExternalUseLabel() {}, getColdShippingLabel() {}, isSelfDevelopedProduct() {},
      buildCategoryTree, normalizeCategoryId,
      getCartEntries: () => ({}), loadCartItems: () => [],
      getCategoryList: async (...args) => { categoryCalls.push(args); return getCategories ? getCategories() : [{ id: '7', name: '分类' }] },
      getCategoryProducts: async (...args) => {
        calls.push(args)
        return getProducts ? getProducts(...args) : { records: [{ id: calls.length }], total: 3 }
      },
      mapProductListItem: value => value
    })
    const vm = { ...definition.data(), ...definition.methods, $set: (object, key, value) => { object[key] = value } }
    Object.entries(definition.computed).forEach(([key, getter]) => Object.defineProperty(vm, key, { get: () => getter.call(vm) }))
    return { vm, definition, calls, categoryCalls }
  }

  test(`${file}: 每次展示重取分类及当前筛选第一页，分页继续工作`, async () => {
    const { vm, definition, calls, categoryCalls } = createList()
    vm.currentCategoryId = '7'; vm.searchKeyword = '关键词'
    definition.onShow.call(vm); await flush()
    assert.equal(categoryCalls.length, 1)
    assert.deepEqual(calls[0].slice(0, 3), ['7', 1, 20])
    assert.equal(calls[0][6], '关键词')
    await vm.handleLoadMore()
    assert.equal(calls[1][1], 2)
    definition.onShow.call(vm); await flush()
    assert.equal(categoryCalls.length, 2)
    assert.equal(calls[2][1], 1)
    assert.equal(vm.currentCategoryId, '7')
    assert.deepEqual(vm.getPageState('7').records.map(item => item.id), [3])
    await vm.switchCategory('all'); await vm.switchCategory('7')
    assert.equal(calls.length, 5)
    assert.equal(calls.at(-1)[1], 1)
  })

  test(`${file}: 删除分类退回全部，刷新期间旧请求不覆盖新数据`, async () => {
    let resolveOld
    const { vm, calls } = createList((category, page) => calls.length === 1
      ? new Promise(resolve => { resolveOld = resolve })
      : { records: [{ id: 'new' }], total: 1 }, () => [])
    vm.currentCategoryId = 'deleted'
    const old = vm.loadProducts(); await flush()
    assert.equal(vm.currentCategoryId, 'all')
    await vm.loadProducts()
    resolveOld({ records: [{ id: 'old' }], total: 1 }); await old
    assert.deepEqual(vm.getPageState('all').records.map(item => item.id), ['new'])
  })
}

test('SKU 切换只改变售价，划线价始终来自商品主表，主表清空后不回退 SKU', () => {
  assert.equal(withProductSku({ id: 1, originalPrice: 100 }, { id: 2, price: 5, originalPrice: 10 }).originalPrice, 100)
  assert.equal(withProductSku({ id: 1, originalPrice: null }, { id: 2, price: 5, originalPrice: 10 }).originalPrice, 0)
})

test('推荐首页只在 onShow 请求，重新进入会读新数据', async () => {
  let show, calls = 0
  const page = loadSetup('pages/products/medicine_index.vue', {
    ref: value => ({ value }), onMounted() {}, onUnmounted() {}, onShow: callback => { show = callback },
    getCategoryProducts: async () => ({ records: [{ id: ++calls }] }), mapProductListItem: value => value,
    getCartTotalQuantity: () => 0
  }, ['featuredProducts'])
  assert.equal(calls, 0)
  show(); await flush(); show(); await flush()
  assert.equal(calls, 2)
  assert.equal(page.featuredProducts.value[0].id, 2)
})

test('推荐首页再次进入不会被旧请求阻挡，旧响应不能覆盖新结果', async () => {
  let show
  const pending = []
  const page = loadSetup('pages/products/medicine_index.vue', {
    ref: value => ({ value }), onMounted() {}, onUnmounted() {}, onShow: callback => { show = callback },
    getCategoryProducts: () => new Promise(resolve => pending.push(resolve)), mapProductListItem: value => value,
    getCartTotalQuantity: () => 0
  }, ['featuredProducts', 'loading'])
  show(); show()
  assert.equal(pending.length, 2)
  pending[1]({ records: [{ id: 'new' }] }); await flush()
  pending[0]({ records: [{ id: 'old' }] }); await flush()
  assert.equal(page.featuredProducts.value[0].id, 'new')
  assert.equal(page.loading.value, false)
})

for (const file of ['product_notice.vue', 'product_questionnaire.vue']) {
  test(`${file}: 失效规格禁止退回商品汇总库存，划线价使用主表`, () => {
    const definition = loadOptions(`pages/products/${file}`, { getImageUrl: value => value })
    const detail = { id: 1, originalPrice: 100, stock: 50, skus: [{ id: 2, price: 5, originalPrice: 10, stock: 3, status: 1 }] }
    const vm = { skuId: '2', productDetail: detail }
    const sale = definition.methods.resolveSelectedProduct.call(vm)
    assert.equal(sale.price, 5)
    assert.equal(sale.originalPrice, 100)
    assert.equal(sale.stock, 3)
    detail.skus = []
    assert.throws(() => definition.methods.resolveSelectedProduct.call(vm), /规格已失效/)
  })
}
