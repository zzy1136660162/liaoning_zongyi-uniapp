import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { beforeEach, afterEach, test } from 'node:test'
import * as cart from '../utils/cart.js'
import { subscribeCartUpdated } from '../utils/cart-events.js'
import { beginSession, endSession } from '../utils/session.js'
import { STORAGE_KEY_CART_ITEMS } from '../utils/storage.js'
import { loadOptions } from './sfc-harness.mjs'

const storage = new Map(), listeners = new Map()
let components, navigations
globalThis.uni = {
  getStorageSync: key => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
  removeStorageSync: key => storage.delete(key),
  $on(name, handler) {
    if (!listeners.has(name)) listeners.set(name, new Set())
    listeners.get(name).add(handler)
  },
  $off: (name, handler) => listeners.get(name)?.delete(handler),
  $emit: (name, payload) => [...(listeners.get(name) || [])].forEach(handler => handler(payload)),
  showToast() {}, hideLoading() {},
  navigateTo: options => navigations.push(options)
}
const quiet = { log() {}, warn() {}, error() {} }
const createTabBar = (mount = true) => {
  const hooks = {}
  const definition = loadOptions('components/TabBar/TabBar.vue', {
    ref: value => ({ value }),
    onMounted: callback => { hooks.mount = callback },
    onUnmounted: callback => { hooks.unmount = callback },
    onPageShow: callback => { hooks.show = callback },
    getCartTotalQuantity: cart.getCartTotalQuantity, subscribeCartUpdated
  })
  const state = definition.setup()
  const component = { ...hooks, state }
  components.push(component)
  if (mount) component.mount()
  return component
}
const entry = (productId, quantity, extra = {}) => ({
  productId, skuId: 1, quantity, verified: true, selected: true, stock: 100, available: true, ...extra
})
const count = component => component.state.cartCount.value

beforeEach(() => {
  storage.clear(); listeners.clear(); components = []; navigations = []
})
afterEach(() => components.forEach(component => component.unmount()))

test('7 个页面共用自动角标，按完整购物车的 SKU 数量求和，不受当前列表和勾选影响', () => {
  const pages = ['products/medicine_list', 'products/medicine_index', 'products/priducts_list',
    'products/priducts_list2', 'cart/cart', 'order/order_list', 'user/profile']
  cart.replaceCartData({ '10:1': entry(10, 2, { skuId: 1 }),
    '10:2': entry(10, 3, { skuId: 2 }), '20': entry(20, 1, { selected: false }) })
  for (const path of pages) {
    const source = readFileSync(new URL(`../pages/${path}.vue`, import.meta.url), 'utf8')
    const tab = source.match(/<TabBar\b[^>]*\/>/s)?.[0]
    assert.ok(tab, path)
    assert.doesNotMatch(tab, /:cart(?:-count|Count)=/, path)
    assert.equal(count(createTabBar()), 6, path)
  }
  cart.setCartItemQuantity('10:1', 4)
  components.forEach(component => assert.equal(count(component), 8))
  cart.removeFromCart('10:2')
  components.forEach(component => assert.equal(count(component), 5))
  cart.clearCart()
  components.forEach(component => assert.equal(count(component), 0))
})

test('medicine_list 实际加购和增减数量即时更新角标，其他分类和 SKU 不会漏算', async () => {
  cart.replaceCartData({ '20:2': entry(20, 4, { skuId: 2 }) })
  const tab = createTabBar()
  const definition = loadOptions('pages/products/medicine_list.vue', {
    ...cart, subscribeCartUpdated, console: quiet,
    getProductDetail: async () => ({ ...product, skus: [{ id: 1, price: 5, stock: 20, status: 1, defaultFlag: 1 }] }),
    mapProductDetail: value => value,
    getApp: () => ({ globalData: { mallIntroPlayed: true } }), TabBar: {},
    getImageUrl: value => value, getExternalUseLabel() {}, getColdShippingLabel() {}, isSelfDevelopedProduct() {}
  })
  const product = { id: 10, skuId: 1, price: 5, stock: 20, available: true, needQuestionnaire: 0 }
  const page = { ...definition.data(), ...definition.methods,
    categories: [{ id: 'current', products: [product] }],
    ensureLogin: () => true, ensureCartCompatible: () => true,
    debugProductQuantityState() {}, $nextTick: callback => callback()
  }
  definition.onLoad.call(page)
  try {
    await page.handleAddToCart(product)
    assert.equal(cart.getCartProductQuantity(10), 1)
    assert.equal(count(tab), 5)
    assert.equal(cart.calculateTotalQuantity(page.cartItems), 1)
    page.increaseQuantity(product)
    assert.equal(count(tab), 6)
    page.decreaseQuantity(product)
    assert.equal(count(tab), 5)
    page.decreaseQuantity(product)
    assert.equal(count(tab), 4)
    page.ensureLogin = () => false
    await page.handleAddToCart(product)
    assert.equal(count(tab), 4)
  } finally { definition.onUnload.call(page) }
})

test('需要问卷的商品先加购并刷新数量，答题留到结算统一检查', async () => {
  const tab = createTabBar()
  const definition = loadOptions('pages/products/medicine_list.vue', {
    ...cart, console: quiet, getApp: () => ({ globalData: { mallIntroPlayed: true } }),
    getProductDetail: async () => ({ ...product, skus: [{ id: 1, price: 5, stock: 20, status: 1, defaultFlag: 1 }] }),
    mapProductDetail: value => value,
    TabBar: {}, getImageUrl() {}, getExternalUseLabel() {}, getColdShippingLabel() {}, isSelfDevelopedProduct() {}
  })
  const product = { id: 10, skuId: 1, price: 5, stock: 20, available: true, needQuestionnaire: 1, questionnaireId: 7 }
  const page = { ...definition.data(), ...definition.methods, ensureLogin: () => true, ensureCartCompatible: () => true }
  await page.handleAddToCart(product)
  assert.equal(navigations.length, 0)
  assert.equal(count(tab), 1)
  assert.equal(cart.getCartProductInfo(10, 1).questionnairePassed, false)
  cart.addCartItem(product, 2, { questionnaireId: 7, questionnairePassed: true, answerId: 9 })
  assert.equal(count(tab), 2)
})

test('挂载及返回页面重读最新存储，服务器替换、清空与退出登录均刷新', () => {
  const tab = createTabBar(false)
  cart.addCartItem({ id: 10, skuId: 1, stock: 100 }, 3)
  tab.mount()
  assert.equal(count(tab), 3)
  storage.set(STORAGE_KEY_CART_ITEMS, { '20': entry(20, 4) })
  tab.show()
  assert.equal(count(tab), 4)
  cart.replaceCartData({ '30': entry(30, 101, { stock: 200 }) })
  assert.equal(count(tab), 101)
  endSession()
  assert.equal(count(tab), 0)
  beginSession('fixture-A')
  cart.addCartItem({ id: 10, skuId: 1, stock: 100 }, 2)
  beginSession('fixture-B')
  tab.show()
  assert.equal(count(tab), 0)
})

test('库存修正数量会同步角标，元数据刷新不循环发事件或远程同步', () => {
  cart.replaceCartData({ '10': entry(10, 5) })
  const tab = createTabBar()
  const categories = [{ products: [{ id: '10:1', productId: 10, skuId: 1, stock: 2, available: true, price: 5 }] }]
  let events = 0, remoteSyncs = 0
  const stop = subscribeCartUpdated(() => {
    events++
    cart.loadCartItems(categories)
  })
  uni.$on('cartRemoteSync', () => { remoteSyncs++ })
  cart.loadCartItems(categories)
  assert.equal(count(tab), 2)
  assert.equal(events, 1)
  assert.equal(remoteSyncs, 0)
  cart.loadCartItems([{ products: [{ id: '10:1', productId: 10, skuId: 1, stock: 2, available: true, price: 6, needQuestionnaire: 1, questionnaireId: 9 }] }])
  assert.equal(events, 1)
  assert.equal(count(tab), 2)
  stop()
})

test('反复显示不重复订阅，卸载只解除自身订阅，其他页面仍正常更新', () => {
  const first = createTabBar(), second = createTabBar()
  for (let i = 0; i < 5; i++) first.show()
  assert.equal(listeners.get('cartUpdated').size, 2)
  first.unmount()
  cart.addCartItem({ id: 10, skuId: 1, stock: 100 }, 3)
  assert.equal(count(first), 0)
  assert.equal(count(second), 3)
  assert.equal(listeners.get('cartUpdated').size, 1)
})
