import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import * as cart from './cart-api-fixture.mjs'
import { cartApiFixture as api, installCartApi } from './cart-api-fixture.mjs'
import { shouldReloadCartFromServer, subscribeCartUpdated } from '../utils/cart-events.js'
import { loadOptions } from './sfc-harness.mjs'

const storage = new Map(), listeners = new Set(), pages = [], frames = [], messages = []
let mutationTime
const product = (productId, skuId = 1) => ({ productId, skuId, productName: `测试商品${productId}`,
  price: 5, stock: 20, available: true, productCategory: 2, goodsMerchantType: 1 })
const initialKeys = ['10:1', '10:2', '20:1']
const entries = () => Object.fromEntries(initialKeys.map((key, index) => {
  const [productId, skuId] = key.split(':').map(Number)
  return [key, { ...product(productId, skuId), quantity: index + 1, selected: false,
    timestamp: Date.parse(`2026-10-21T00:00:0${index + 1}Z`), serverCartItemId: String(700 + index), serverCartVersion: '0' }]
}))

beforeEach(() => {
  storage.clear(); listeners.clear(); pages.length = 0; frames.length = 0; messages.length = 0; mutationTime = 10
  globalThis.uni = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key), showToast: message => messages.push(message),
    $on: (_event, handler) => listeners.add(handler), $off: (_event, handler) => listeners.delete(handler),
    $emit: (event, payload) => {
      if (event !== 'cartUpdated') return
      listeners.forEach(handler => handler(payload))
      pages.forEach(({ state }) => frames.push(state.cartItems.map(item => item.id)))
    }
  }
  installCartApi()
  cart.replaceCartData(entries())
  // 真接口每次写入都会改变 updatedAt，固定时间的接口桩会掩盖中间重排。
  api.onRequest = (options, execute) => {
    const success = options.success
    options.success = response => {
      if (['PUT', 'POST'].includes(options.method) && response.data?.data?.id) {
        response.data.data.updatedAt = new Date(Date.UTC(2026, 9, 21, 0, 0, mutationTime++)).toISOString()
      }
      success(response)
    }
    execute()
  }
})

afterEach(() => pages.forEach(({ definition, state }) => definition.onUnload.call(state)))

const createPage = () => {
  const definition = loadOptions('pages/cart/cart.vue', {
    ...cart, TabBar: {}, shouldReloadCartFromServer, subscribeCartUpdated,
    console: { log() {}, info() {}, error() {} }
  })
  const state = { ...definition.data(), ...definition.methods }
  for (const [key, getter] of Object.entries(definition.computed)) {
    Object.defineProperty(state, key, { get: () => getter.call(state) })
  }
  pages.push({ definition, state })
  definition.onLoad.call(state)
  state.loadCartData()
  return state
}

const assertStableFrames = () => {
  assert.ok(frames.length > 0)
  frames.forEach((keys, index) => assert.deepEqual(keys, initialKeys, `第 ${index + 1} 次回包不能改变商品位置`))
}

test('全选及取消全选的每次逐条回包均保持列表顺序，并更新金额和服务端版本', async () => {
  const state = createPage()
  const before = cart.getCartEntries()

  await state.toggleSelectAll()

  assertStableFrames()
  assert.equal(state.isAllSelected, true)
  assert.deepEqual(state.selectedItems, initialKeys)
  assert.equal(state.selectedTotalPrice, 30)
  assert.equal(state.selectionSaving, false)
  for (const key of initialKeys) {
    const current = cart.getCartEntries()[key]
    assert.equal(current.serverCartVersion, '1')
    assert.notEqual(current.revision, before[key].revision)
  }

  await state.toggleSelectAll()

  assertStableFrames()
  assert.deepEqual(state.selectedItems, [])
  assert.equal(state.selectedTotalPrice, 0)
  assert.equal(state.isAllSelected, false)
})

test('单选和增减数量更新商品信息，不让被操作的行移动到末尾', async () => {
  const state = createPage()
  await state.toggleItemSelection('10:1')
  await state.increaseQuantity(state.cartItems[0])
  assert.equal(state.cartItems[0].quantity, 2)
  assert.equal(state.selectedTotalPrice, 10)
  await state.decreaseQuantity(state.cartItems[0])
  assertStableFrames()
  assert.equal(state.cartItems[0].quantity, 1)
  assert.equal(state.selectedTotalPrice, 5)
})

test('全选部分失败保留已确认的勾选结果和列表位置，允许再次重试', async () => {
  const state = createPage()
  const respond = api.onRequest
  let writes = 0
  api.onRequest = (options, execute) => {
    if (options.method === 'PUT' && ++writes === 2) options.fail({ errMsg: 'request:fail timeout' })
    else respond(options, execute)
  }

  await state.toggleSelectAll()

  assertStableFrames()
  assert.deepEqual(state.selectedItems, ['10:1'])
  assert.equal(state.isAllSelected, false)
  assert.equal(state.selectionSaving, false)
  assert.ok(messages.length > 0)

  await state.toggleSelectAll()

  assertStableFrames()
  assert.deepEqual(state.selectedItems, initialKeys)
})

test('后台刷新保留同一服务端行的位置，同规格删后重加的新行使用新位置', async () => {
  const state = createPage()
  const before = cart.getCartEntries()
  const fresh = Object.fromEntries(initialKeys.toReversed().map((key, index) => [key, {
    ...before[key], serverCartVersion: '2', selected: true,
    updatedAt: new Date(Date.UTC(2026, 9, 21, 0, 1, index)).toISOString()
  }]))
  api.seed(fresh)
  await cart.refreshCart()
  assertStableFrames()
  assert.equal(state.selectedTotalPrice, 30)

  api.seed({ ...fresh, '10:1': { ...fresh['10:1'], serverCartItemId: '900', serverCartVersion: '0',
    updatedAt: '2026-10-21T01:00:00Z' } })
  await cart.refreshCart()
  assert.deepEqual(state.cartItems.map(item => item.id), ['10:2', '20:1', '10:1'])
  assert.equal(cart.getCartEntries()['10:1'].serverCartItemId, '900')
})

test('商品排序时间相同且接口倒序返回时，刷新和全选仍保持稳定位置', async () => {
  const sameTime = Date.parse('2026-10-21T00:00:01Z')
  const sameTimeEntries = Object.fromEntries(Object.entries(entries()).map(([key, entry]) => [key, { ...entry, timestamp: sameTime }]))
  cart.replaceCartData({})
  cart.replaceCartData(sameTimeEntries)
  const state = createPage()
  assert.deepEqual(state.cartItems.map(item => item.id), initialKeys)
  api.seed(Object.fromEntries(initialKeys.toReversed().map(key => [key, {
    ...sameTimeEntries[key], updatedAt: '2026-10-21T00:01:00Z'
  }])))

  await cart.refreshCart()
  await state.toggleSelectAll()

  assertStableFrames()
  assert.equal(state.isAllSelected, true)
})
