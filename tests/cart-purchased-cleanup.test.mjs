import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import * as cart from './cart-api-fixture.mjs'
import { cartApiFixture as api, installCartApi } from './cart-api-fixture.mjs'
import * as realCart from '../utils/cart.js'
import { beginSession } from '../utils/session.js'
import { cleanupPurchasedCartItems } from '../api/cart.js'
import { consumeOrderCart, getOrderSubmission, rememberCreatedOrder } from '../utils/order-submission.js'

const storage = new Map()
const product = { id: 10, productId: 10, skuId: 1, price: 5, stock: 20, productCategory: 2, goodsMerchantType: 1 }
beforeEach(() => {
  storage.clear()
  globalThis.uni = { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key), $emit() {}, showToast() {} }
  installCartApi()
})
const snapshot = () => structuredClone(cart.getCartEntries())

test('付款按服务端ID和版本0条件清理，再GET刷新', async () => {
  await cart.addCartItem(product, 2)
  await cart.removePurchasedCartItems(snapshot())
  assert.deepEqual(api.requests.find(item => item.path.endsWith('purchased-cleanup')).data.items, [{ id: '700', cartVersion: '0' }])
  assert.deepEqual(cart.getCartEntries(), {})
  assert.equal(api.requests.at(-1).method, 'GET')
})

test('旧付款保留后来改量或删除重加的行', async () => {
  await cart.addCartItem(product, 2)
  const purchased = snapshot()
  await cart.setCartItemQuantity('10:1', 3)
  await cart.removePurchasedCartItems(purchased)
  assert.equal(cart.getCartProductQuantity(10, 0), 3)
  await cart.removeFromCart('10:1'); await cart.addCartItem(product, 4)
  await cart.removePurchasedCartItems(purchased)
  assert.equal(cart.getCartProductQuantity(10, 0), 4)
})

test('重启后内存为空仍按订单快照清理后台', async () => {
  await cart.addCartItem(product, 2)
  const purchased = snapshot()
  realCart.replaceCartData({})
  assert.equal(api.rows.length, 1)
  await cart.removePurchasedCartItems(purchased)
  assert.deepEqual(api.rows, [])
  assert.deepEqual(cart.getCartEntries(), {})
})

test('无快照或缺少服务端身份的旧订单不按SKU猜测删除', async () => {
  await cart.addCartItem(product, 2)
  const count = api.requests.length
  await cart.removePurchasedCartItems({ '10:1': { quantity: 2, revision: 'legacy' } })
  await consumeOrderCart('direct-purchase')
  assert.equal(api.requests.length, count)
  assert.equal(cart.getCartProductQuantity(10, 0), 2)
})

test('清理失败保留订单快照，重试成功后再忘记', async () => {
  await cart.addCartItem(product, 2)
  rememberCreatedOrder(91, getOrderSubmission('goods', { items: [] }, snapshot()))
  api.failNext = { errMsg: 'request:fail timeout' }
  await assert.rejects(consumeOrderCart(91))
  assert.ok(storage.get('order_cart_snapshots')[91])
  assert.equal(cart.getCartProductQuantity(10, 0), 2)
  await consumeOrderCart(91)
  assert.equal(storage.get('order_cart_snapshots')[91], undefined)
  assert.deepEqual(cart.getCartEntries(), {})
})


test('内存重建后相同服务端版本沿用下单请求标识，改量后生成新标识', async () => {
  await cart.addCartItem(product, 2)
  const data = { items: [{ productId: 10, skuId: 1, quantity: 2 }] }
  const first = getOrderSubmission('goods', data, snapshot())
  realCart.replaceCartData({})
  await cart.refreshCart()
  assert.equal(getOrderSubmission('goods', data, snapshot()).requestId, first.requestId)
  await cart.setCartItemQuantity('10:1', 3)
  assert.notEqual(getOrderSubmission('goods', data, snapshot()).requestId, first.requestId)
})

test('批量清理途中切换账号，不再以新账号发送剩余批次', async () => {
  let switchAccount = true
  api.onRequest = (options, execute) => {
    if (switchAccount && options.url.includes('purchased-cleanup')) {
      switchAccount = false
      execute()
      beginSession('fixture-new-account')
    } else execute()
  }
  const items = Array.from({ length: 201 }, (_, index) => ({ id: index + 1, cartVersion: 0 }))
  await assert.rejects(cleanupPurchasedCartItems(items), error => error.code === 'SESSION_CHANGED')
  assert.equal(api.requests.filter(item => item.path.endsWith('purchased-cleanup')).length, 1)
})
