import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import * as cart from './cart-api-fixture.mjs'
import { cartApiFixture as api, installCartApi } from './cart-api-fixture.mjs'
import { shouldReloadCartFromServer, subscribeCartUpdated } from '../utils/cart-events.js'
import { loadOptions } from './sfc-harness.mjs'

const storage = new Map(), listeners = new Set(), pages = [], frames = [], messages = [], modals = []
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
  storage.clear(); listeners.clear(); pages.length = 0; frames.length = 0; messages.length = 0; modals.length = 0; mutationTime = 10
  globalThis.uni = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key), showToast: message => messages.push(message),
    showModal: options => modals.push(options),
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

const createPage = (mocks = {}) => {
  const definition = loadOptions('pages/cart/cart.vue', {
    ...cart, TabBar: {}, shouldReloadCartFromServer, subscribeCartUpdated,
    console: { log() {}, info() {}, error() {} }, ...mocks
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

test('清空选中按规格批量删除，保留未选规格并同步金额和购物车数量', async () => {
  const state = createPage()
  await state.toggleItemSelection('10:1')
  await state.toggleItemSelection('20:1')

  state.removeSelectedItems()
  assert.match(modals[0].content, /2 项商品/)
  assert.deepEqual(state.cartItems.map(item => item.id), initialKeys, '确认前保留商品')
  await modals[0].success({ confirm: true })

  const deletion = api.requests.find(request => request.path === '/api/cart/items/remove')
  assert.equal(deletion.method, 'POST')
  assert.deepEqual(deletion.data.items.map(item => item.id), ['700', '702'])
  assert.deepEqual(state.cartItems.map(item => item.id), ['10:2'])
  assert.deepEqual(api.rows.map(item => `${item.productId}:${item.skuId}`), ['10:2'])
  assert.deepEqual(state.selectedItems, [])
  assert.equal(state.selectedTotalPrice, 0)
  assert.equal(state.cartCount, 2)
  assert.equal(cart.getCartTotalQuantity(), 2, '角标使用的完整购物车数量同步更新')
  assert.equal(state.removingSelected, false)
  assert.equal(messages.at(-1).title, '清空成功')
})

test('全选后清空进入空购物车状态，刷新接口后仍为空', async () => {
  const state = createPage()
  await state.toggleSelectAll()
  state.removeSelectedItems()
  await modals[0].success({ confirm: true })
  await state.loadCartFromServer()
  assert.deepEqual(state.cartItems, [])
  assert.equal(state.cartCount, 0)
  assert.equal(state.isAllSelected, false)
  assert.equal(cart.getCartTotalQuantity(), 0)
})

test('没有选中或勾选保存期间不发起清空，取消确认与弹窗失败均允许再次操作', async () => {
  const state = createPage()
  state.removeSelectedItems()
  assert.equal(modals.length, 0)
  assert.equal(messages.at(-1).title, '请选择要清空的商品')
  await state.toggleItemSelection('10:1')
  state.selectionSaving = true
  state.removeSelectedItems()
  assert.equal(modals.length, 0)
  state.selectionSaving = false
  state.removeSelectedItems()
  state.removeSelectedItems()
  assert.equal(modals.length, 1, '连续点击只弹出一次确认')
  await modals[0].success({ confirm: false })
  assert.equal(state.removingSelected, false)
  assert.deepEqual(state.selectedItems, ['10:1'])
  state.removeSelectedItems()
  modals[1].fail({ errMsg: 'showModal:fail' })
  assert.equal(state.removingSelected, false)
  assert.equal(api.requests.filter(request => request.path === '/api/cart/items/remove').length, 0)
  assert.deepEqual(state.cartItems.map(item => item.id), initialKeys)
})

test('删除等待期间阻止重复提交和结算，失败保留选择与商品并可重试', async () => {
  const state = createPage()
  await state.toggleItemSelection('10:1')
  let held
  api.onRequest = (options, execute) => {
    if (options.url.endsWith('/api/cart/items/remove')) held = options
    else execute()
  }
  state.removeSelectedItems()
  const pending = modals[0].success({ confirm: true })
  await new Promise(setImmediate)
  assert.ok(held)
  state.removeSelectedItems()
  await state.toggleSelectAll()
  await state.toggleItemSelection('10:2')
  await state.goToCheckout()
  assert.equal(modals.length, 1)
  assert.deepEqual(state.selectedItems, ['10:1'])
  assert.deepEqual(state.cartItems.map(item => item.id), initialKeys)
  held.fail({ errMsg: 'request:fail timeout' })
  await pending
  assert.equal(state.removingSelected, false)
  assert.deepEqual(state.selectedItems, ['10:1'])
  assert.deepEqual(state.cartItems.map(item => item.id), initialKeys)
  assert.equal(api.rows.length, 3)
  assert.ok(!messages.some(message => message.title === '清空成功'))

  api.onRequest = null
  state.removeSelectedItems()
  await modals[1].success({ confirm: true })
  assert.deepEqual(state.cartItems.map(item => item.id), ['10:2', '20:1'])
  assert.equal(state.removingSelected, false)
})

test('确认期间其他设备改变勾选和版本，拒绝旧确认并刷新最新状态', async () => {
  const state = createPage()
  await state.toggleItemSelection('10:1')
  state.removeSelectedItems()
  await cart.updateProductSelection('10:1', false)
  await cart.updateProductSelection('10:2', true)
  await modals[0].success({ confirm: true })
  assert.deepEqual(state.cartItems.map(item => item.id), initialKeys)
  assert.deepEqual(state.selectedItems, ['10:2'])
  assert.equal(state.selectedTotalPrice, 10)
  assert.match(messages.at(-1).title, /已变化/)
})

test('确认弹窗期间切换账号，旧确认不能删除新账号商品', async () => {
  let active = true
  const state = createPage({ getSessionGeneration: () => 1, isCurrentSession: () => active })
  await state.toggleItemSelection('10:1')
  state.removeSelectedItems()
  active = false
  await modals[0].success({ confirm: true })
  assert.equal(api.requests.filter(request => request.path === '/api/cart/items/remove').length, 0)
  assert.equal(state.removingSelected, false)
  assert.deepEqual(state.cartItems.map(item => item.id), initialKeys)
  assert.ok(!messages.some(message => message.title === '清空成功'))
})

const withInvalidRow = () => {
  cart.replaceCartData({ ...entries(), '10': { ...entries()['10:1'], skuId: null,
    available: false, stock: 0, inventoryReason: 'SKU_REQUIRED', serverCartItemId: '800', serverCartVersion: '0' } })
  return createPage()
}

test('历史缺规格行可以单独删除，同商品有效规格保持可结算且刷新后不恢复旧行', async () => {
  const state = withInvalidRow()
  await state.toggleItemSelection('10:1')
  const invalid = state.cartItems.find(item => item.id === '10')
  assert.match(state.getUnavailableText(invalid), /未选择规格/)
  await state.toggleItemSelection('10')
  assert.deepEqual(state.selectedItems, ['10:1'])
  assert.equal(state.selectedTotalPrice, 5)
  state.removeItem('10')
  assert.equal(state.removingSelected, true)
  state.removeItem('10')
  assert.equal(modals.length, 1)
  await modals[0].success({ confirm: true })
  const request = api.requests.find(item => item.path === '/api/cart/items/remove')
  assert.deepEqual(request.data.items, [{ id: '800', cartVersion: '0' }])
  assert.deepEqual(state.cartItems.map(item => item.id), initialKeys)
  assert.equal(state.selectedTotalPrice, 5)
  assert.equal(state.removingSelected, false)
  await state.loadCartFromServer()
  assert.deepEqual(state.cartItems.map(item => item.id), initialKeys)
})

test('全部不可购买时仍可逐项删除进入空购物车，未删除前不可结算', async () => {
  cart.replaceCartData({ '10': { ...entries()['10:1'], skuId: null, available: false, stock: 0, inventoryReason: 'SKU_REQUIRED' } })
  const state = createPage()
  assert.equal(state.isAllSelected, false)
  assert.equal(state.selectedItems.length, 0)
  await state.goToCheckout()
  assert.equal(messages.at(-1).title, '请选择要结算的商品')
  state.removeItem('10')
  await modals[0].success({ confirm: true })
  assert.deepEqual(state.cartItems, [])
  assert.equal(cart.getCartTotalQuantity(), 0)
})

test('单行删除支持取消、弹窗失败和接口失败重试，不提前移除失效行', async () => {
  const state = withInvalidRow()
  state.removeItem('10')
  await modals[0].success({ confirm: false })
  assert.ok(cart.getCartEntries()['10'])
  state.removeItem('10')
  modals[1].fail({ message: '弹窗失败' })
  assert.equal(state.removingSelected, false)
  state.removeItem('10')
  api.failNext = { errMsg: 'request:fail timeout' }
  await modals[2].success({ confirm: true })
  assert.ok(cart.getCartEntries()['10'])
  assert.equal(state.removingSelected, false)
  assert.ok(!messages.some(message => message.title === '删除成功'))
  state.removeItem('10')
  await modals[3].success({ confirm: true })
  assert.equal(cart.getCartEntries()['10'], undefined)
})

test('弹窗打开后同规格删后重加，旧确认不删除新行', async () => {
  const state = createPage()
  state.removeItem('10:1')
  const fresh = cart.getCartEntries()
  api.seed({ ...fresh, '10:1': { ...fresh['10:1'], serverCartItemId: '999', serverCartVersion: '0' } })
  await state.loadCartFromServer()
  await modals[0].success({ confirm: true })
  assert.equal(cart.getCartEntries()['10:1'].serverCartItemId, '999')
  assert.equal(api.rows.length, 3)
})

test('缺少行身份的删除快照不能降级为商品删除，空数组也不能全清空', async () => {
  withInvalidRow()
  await assert.rejects(cart.removeFromCart(['10'], { '10': { skuId: null } }), /已变化/)
  await cart.removeFromCart([])
  assert.equal(api.requests.filter(item => item.path === '/api/cart/items/remove' || item.method === 'DELETE').length, 0)
  assert.equal(api.rows.length, 4)
})

test('不同不可购买原因显示对应提示，兼容旧服务端缺规格原因', () => {
  const state = createPage()
  for (const [item, expected] of [
    [{ inventoryReason: 'PRODUCT_DISABLED', skuId: null }, /已下架/],
    [{ inventoryReason: 'PRODUCT_MISSING', skuId: 1 }, /商品已失效/],
    [{ inventoryReason: 'SKU_DISABLED', skuId: null }, /未选择规格/],
    [{ inventoryReason: 'SKU_DISABLED', skuId: 1 }, /规格已失效/],
    [{ inventoryReason: 'LOCAL_SHORTAGE', skuId: 1 }, /库存不足/],
    [{ inventoryMode: 'HIS_AVAILABILITY', skuId: 1 }, /医院库存/],
    [{ inventoryReason: 'UNKNOWN', skuId: 1 }, /暂不可购买/]
  ]) assert.match(state.getUnavailableText(item), expected)
})
