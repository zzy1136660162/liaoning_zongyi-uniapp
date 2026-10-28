import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import * as cart from './cart-api-fixture.mjs'
import { cartApiFixture as api, installCartApi } from './cart-api-fixture.mjs'
import { beginSession } from '../utils/session.js'

const storage = new Map(), reads = [], writes = []
const product = (id = 10, skuId = 1) => ({ id, productId: id, skuId, productName: `商品${id}`,
  price: 5, stock: 20, available: true, productCategory: 2, goodsMerchantType: 1 })
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
beforeEach(() => {
  storage.clear(); reads.length = 0; writes.length = 0
  globalThis.uni = { getStorageSync: key => { reads.push(key); return storage.get(key) },
    setStorageSync: (key, value) => { writes.push(key); storage.set(key, value) },
    removeStorageSync: key => storage.delete(key), $emit() {}, showToast() {} }
  installCartApi()
})

test('加购等待接口成功再更新内存，不读写本地购物车，版本0保留', async () => {
  storage.set('cart_items', { '99:1': { ...product(99), quantity: 9 } })
  let complete
  api.onRequest = (_options, execute) => { complete = execute }
  const pending = cart.addCartItem(product(), 1)
  await flush()
  assert.equal(api.requests.length, 1)
  assert.equal(api.requests[0].method, 'POST')
  assert.equal(cart.getCartProductQuantity(10, 0), 0)
  complete(); await pending
  assert.equal(cart.getCartProductQuantity(10, 0), 1)
  assert.equal(cart.getCartEntries()['10:1'].serverCartVersion, '0')
  assert.equal(reads.includes('cart_items'), false)
  assert.equal(writes.includes('cart_items'), false)
})

test('连续加购按最新确认数量累加，每次点击均保留', async () => {
  let complete, held = false
  api.onRequest = (_options, execute) => { if (!held) { held = true; complete = execute } else execute() }
  const first = cart.addCartItem(product(), 1), second = cart.addCartItem(product(), 1)
  await flush(); assert.equal(api.requests.length, 1)
  complete(); await Promise.all([first, second])
  assert.deepEqual(api.requests.map(item => item.data.quantity), [1, 2])
  assert.equal(cart.getCartProductQuantity(10, 0), 2)
})

test('连续增减不丢数量，减至零精确删除当前SKU', async () => {
  cart.replaceCartData({ '10:1': { ...product(), quantity: 1 }, '10:2': { ...product(10, 2), quantity: 3 } })
  await Promise.all([cart.changeCartItemQuantity('10:1', 1), cart.changeCartItemQuantity('10:1', 1)])
  assert.equal(cart.getCartEntries()['10:1'].quantity, 3)
  await Promise.all([cart.changeCartItemQuantity('10:1', -1), cart.changeCartItemQuantity('10:1', -1), cart.changeCartItemQuantity('10:1', -1)])
  assert.equal(cart.getCartEntries()['10:1'], undefined)
  assert.equal(cart.getCartEntries()['10:2'].quantity, 3)
  const deletion = api.requests.find(item => item.path === '/api/cart/items/remove')
  assert.deepEqual(deletion.data.items, [{ id: '700', cartVersion: '4' }])
  assert.equal(api.requests.at(-1).method, 'GET')
})

test('旧GET与后续加购串行，旧快照不能覆盖加购结果', async () => {
  let complete, held = false
  api.onRequest = (options, execute) => {
    if (!held && options.method === 'GET') {
      held = true; const snapshot = api.rows
      complete = () => options.success({ statusCode: 200, data: { code: 200, data: snapshot } })
    } else execute()
  }
  const reading = cart.refreshCart(), adding = cart.addCartItem(product(), 1)
  await flush(); assert.equal(api.requests.length, 1)
  complete(); await Promise.all([reading, adding])
  assert.deepEqual(api.requests.map(item => item.method), ['GET', 'POST'])
  assert.equal(cart.getCartProductQuantity(10, 0), 1)
})

test('写入失败保持已确认数量，下次操作先重新查询', async () => {
  cart.replaceCartData({ '10:1': { ...product(), quantity: 1 } })
  api.failNext = { errMsg: 'request:fail timeout' }
  await assert.rejects(cart.changeCartItemQuantity('10:1', 1))
  assert.equal(cart.getCartProductQuantity(10, 0), 1)
  await cart.changeCartItemQuantity('10:1', 1)
  assert.deepEqual(api.requests.map(item => item.method), ['PUT', 'GET', 'PUT'])
  assert.equal(cart.getCartProductQuantity(10, 0), 2)
})

test('服务端写成功但回包丢失时，后续加减先GET真实数量', async () => {
  cart.replaceCartData({ '10:1': { ...product(), quantity: 1 } })
  let lost = false
  api.onRequest = (options, execute) => {
    if (!lost && options.method === 'PUT') { lost = true; options.success = () => options.fail({ errMsg: 'request:fail timeout' }) }
    execute()
  }
  await assert.rejects(cart.changeCartItemQuantity('10:1', 1))
  assert.equal(cart.getCartProductQuantity(10, 0), 1)
  assert.equal(api.rows[0].quantity, 2)
  await cart.changeCartItemQuantity('10:1', 1)
  assert.equal(cart.getCartProductQuantity(10, 0), 3)
})

test('切换账号后旧回包和旧队列不能写入新账号', async () => {
  let held
  api.onRequest = (options, execute) => { if (options.method === 'POST') held = options; else execute() }
  const old = cart.addCartItem(product(), 1)
  const rejected = assert.rejects(old, error => error.code === 'SESSION_CHANGED')
  const queued = cart.addCartItem(product(), 1)
  const queuedRejected = assert.rejects(queued, error => error.code === 'SESSION_CHANGED')
  await flush(); beginSession('fixture-other-account')
  api.seed({ '20:1': { ...product(20), quantity: 4 } })
  await cart.refreshCart()
  held.success({ statusCode: 200, data: { code: 200, data: { ...product(), id: 700, quantity: 1, checked: 1, cartVersion: 0 } } })
  await Promise.all([rejected, queuedRejected])
  assert.deepEqual(Object.keys(cart.getCartEntries()), ['20:1'])
  assert.equal(api.requests.filter(item => item.method === 'POST').length, 1)
})

test('失效行取消勾选省略quantity，删除失败保留原行', async () => {
  cart.replaceCartData({ '10:1': { ...product(), quantity: 2, available: false, stock: 0 } })
  await cart.updateProductSelection('10:1', false)
  assert.deepEqual(api.requests[0].data, { skuId: '1', checked: 0 })
  api.failNext = { errMsg: 'request:fail' }
  await assert.rejects(cart.removeFromCart('10:1'))
  assert.equal(cart.getCartProductQuantity(10, 0), 2)
})

test('畸形接口回包不能替换已确认数据', async () => {
  cart.replaceCartData({ '10:1': { ...product(), quantity: 2 } })
  api.onRequest = options => options.success({ statusCode: 200, data: { code: 200, data: [{ productId: 10, quantity: 99 }] } })
  await assert.rejects(cart.refreshCart(), /响应不完整/)
  assert.equal(cart.getCartProductQuantity(10, 0), 2)
})


test('非法服务端行身份或版本不能被当作加购成功', async () => {
  for (const identity of [{ id: 0, cartVersion: 0 }, { id: 700, cartVersion: -1 }]) {
    api.onRequest = options => options.success({ statusCode: 200,
      data: { code: 200, data: { ...product(), ...identity, quantity: 1, checked: 1 } } })
    await assert.rejects(cart.addCartItem(product(), 1), /响应不完整/)
    assert.equal(cart.getCartProductQuantity(10, 0), 0)
  }
})
