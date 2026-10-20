import test from 'node:test'
import assert from 'node:assert/strict'
import { loadSetup } from './sfc-harness.mjs'
import { isPurchaseAvailable, normalizePurchaseQuantity, resolvePurchaseQuantityLimit } from '../utils/purchase-quantity.js'

const paths = ['medicine_detail', 'therapy_detail', 'priducts_detail']
const product = price => ({ id: '101', name: '后台商品', price, status: 1, stock: 20, available: true,
  unit: '盒', skus: [{ id: '11', skuName: '一盒', price, stock: 20, status: 1, defaultFlag: 1 },
    { id: '12', skuName: '两盒', price: price * 2, stock: 20, status: 1 }] })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

function detail(name) {
  const hooks = {}, requests = [], listeners = new Set()
  let session = 1
  const state = { response: product(20), transport: null }
  globalThis.uni = { getStorageSync: () => ({}), setStorageSync() {}, showLoading() {}, hideLoading() {}, showToast() {} }
  const quantityName = name === 'priducts_detail' ? 'count' : 'quantity'
  const page = loadSetup(`pages/products/${name}.vue`, {
    ref: value => ({ value }), computed: getter => ({ get value() { return getter() } }), watch() {}, getCurrentInstance: () => ({}),
    onLoad: callback => { hooks.load = callback }, onShow: callback => { hooks.show = callback }, onUnload: callback => { hooks.unload = callback },
    onMounted() {}, onUnmounted() {}, getImageUrl: value => value, mapProductDetail: value => value, logPageView() {},
    getSessionGeneration: () => session, isCurrentSession: value => value === session,
    onSessionChanged: callback => { listeners.add(callback); return () => listeners.delete(callback) },
    getProductDetail: async id => { requests.push(id); return state.transport ? state.transport(id) : state.response },
    getCartProductQuantity: () => 1, getCartTotalQuantity: () => 0,
    isPurchaseAvailable, normalizePurchaseQuantity, resolvePurchaseQuantityLimit, BIZ_TYPE_HEALTH_GOODS: 2,
    STORAGE_KEY_PRODUCT_QUANTITIES: 'quantities'
  }, ['product', quantityName, ...(name === 'priducts_detail' ? [] : ['selectedSkuId'])])
  return { ...page, quantity: page[quantityName], hooks, state, requests, listeners,
    switchAccount() { session++; listeners.forEach(callback => callback()) } }
}

for (const name of paths) {
  test(`${name}: 首次只请求一次，每次返回重新加载，忽略路由商品快照并保留数量`, async () => {
    const page = detail(name)
    page.hooks.load({ skuId: '11', product: encodeURIComponent(JSON.stringify({ id: '101', price: 999, name: '旧快照' })) })
    assert.equal(page.requests.length, 0)
    assert.notEqual(page.product.value.price, 999)
    await page.hooks.show()
    assert.deepEqual(page.requests, ['101'])
    assert.equal(page.product.value.price, 20)
    page.quantity.value = 3
    page.state.response = product(25)
    await page.hooks.show()
    assert.deepEqual(page.requests, ['101', '101'])
    assert.equal(page.product.value.price, 25)
    assert.equal(page.quantity.value, 3)
    if (page.selectedSkuId) assert.equal(page.selectedSkuId.value, '11')
    page.hooks.unload()
    assert.equal(page.listeners.size, 0)
  })

  test(`${name}: 旧请求和旧账号响应不能覆盖详情，卸载释放账号订阅`, async () => {
    const page = detail(name)
    page.hooks.load({ id: '101' })
    const first = deferred(), second = deferred()
    let index = 0
    page.state.transport = () => [first, second][index++].promise
    const oldLoad = page.hooks.show(), latestLoad = page.hooks.show()
    second.resolve(product(30)); await latestLoad
    first.resolve(product(10)); await oldLoad
    assert.equal(page.product.value.price, 30)

    const accountRequest = deferred()
    page.state.transport = () => accountRequest.promise
    const pending = page.hooks.show()
    page.switchAccount()
    accountRequest.resolve(product(99)); await pending
    assert.equal(page.product.value.id, '')
    page.state.transport = null
    page.state.response = product(40)
    await page.hooks.show()
    assert.equal(page.product.value.price, 40)
    assert.equal(page.quantity.value, 1)
    page.hooks.unload()
    assert.equal(page.listeners.size, 0)
  })
}

test('已选SKU刷新后失效时不自动替换成其他规格', async () => {
  for (const name of ['medicine_detail', 'therapy_detail']) {
    const page = detail(name)
    page.hooks.load({ id: '101', skuId: '11' })
    await page.hooks.show()
    page.state.response = { ...product(30), skus: [product(30).skus[1]] }
    await page.hooks.show()
    assert.equal(page.selectedSkuId.value, '11')
    page.hooks.unload()
  }
})
