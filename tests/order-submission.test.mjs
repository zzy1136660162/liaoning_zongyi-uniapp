import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import * as cart from '../utils/cart.js'
import * as submission from '../utils/order-submission.js'
import { beginSession, endSession } from '../utils/session.js'
import { STORAGE_KEY_ORDER_SUBMISSION, STORAGE_KEY_ORDER_CART_SNAPSHOTS } from '../utils/storage.js'

const storage = new Map()
globalThis.uni = {
  getStorageSync: key => structuredClone(storage.get(key)),
  setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
  removeStorageSync: key => storage.delete(key), $emit() {}, hideLoading() {}
}
beforeEach(() => { storage.clear(); beginSession('account-A') })
const product = (id = 10) => ({ id, productId: id, skuId: 1, productCategory: 2,
  price: 10, stock: 8, available: true })
const payload = () => ({ patientId: 7, addressId: 8, items: [{ productId: 10, skuId: 1, quantity: 2 }], remark: '' })
const snapshot = () => Object.fromEntries(Object.entries(cart.getCartEntries()).map(([key, entry]) =>
  [key, { revision: entry.revision, quantity: entry.quantity, timestamp: entry.timestamp }]))

test('相同内容及购物车版本重试沿用requestId，参数或行版本变化生成新请求', () => {
  cart.addCartItem(product(), 2)
  const data = payload(), selected = snapshot()
  const first = submission.getOrderSubmission('goods', data, selected)
  assert.equal(submission.getOrderSubmission('goods', structuredClone(data), structuredClone(selected)).requestId, first.requestId)
  const edited = submission.getOrderSubmission('goods', { ...data, remark: '修改备注' }, selected)
  assert.notEqual(edited.requestId, first.requestId)
  const differentKind = submission.getOrderSubmission('prescription', data, selected)
  assert.notEqual(differentKind.requestId, edited.requestId)
  const beforeEdit = submission.getOrderSubmission('goods', data, selected)
  cart.setCartItemQuantity('10:1', 3)
  cart.setCartItemQuantity('10:1', 2)
  assert.notEqual(submission.getOrderSubmission('goods', data, snapshot()).requestId, beforeEdit.requestId)
})

test('服务端行ID及版本ACK补齐只更新清理快照，不改变同次购买的requestId', () => {
  cart.addCartItem(product(), 2)
  const original = snapshot()
  const first = submission.getOrderSubmission('goods', payload(), original)
  const acknowledged = { '10:1': { ...original['10:1'], serverCartItemId: 501, serverCartVersion: 'server-v1' } }
  const confirmed = submission.getOrderSubmission('goods', payload(), acknowledged)
  assert.equal(confirmed.requestId, first.requestId)
  assert.deepEqual(confirmed.cartSnapshot, acknowledged)
  assert.deepEqual(storage.get(STORAGE_KEY_ORDER_SUBMISSION).cartSnapshot, acknowledged)
  const newerAck = { '10:1': { ...acknowledged['10:1'], serverCartVersion: 'server-v2' } }
  const refreshed = submission.getOrderSubmission('goods', payload(), newerAck)
  assert.equal(refreshed.requestId, first.requestId)
  submission.rememberCreatedOrder(90, refreshed)
  assert.deepEqual(storage.get(STORAGE_KEY_ORDER_CART_SNAPSHOTS)[90], newerAck)
})

test('已付款释放提交标识但保留订单快照，receipt确认后仍可清理原行', () => {
  cart.addCartItem(product(), 2)
  const original = cart.getCartEntries()
  const attempt = submission.getOrderSubmission('goods', payload(), snapshot())
  submission.rememberCreatedOrder(91, attempt)
  submission.releaseOrderSubmission(999)
  assert.equal(storage.get(STORAGE_KEY_ORDER_SUBMISSION).requestId, attempt.requestId)
  submission.releaseOrderSubmission(91)
  assert.equal(storage.has(STORAGE_KEY_ORDER_SUBMISSION), false)
  assert.deepEqual(storage.get(STORAGE_KEY_ORDER_CART_SNAPSHOTS)[91], attempt.cartSnapshot)
  assert.deepEqual(cart.getCartEntries(), original)
  assert.notEqual(submission.getOrderSubmission('goods', payload(), snapshot()).requestId, attempt.requestId)
  assert.equal(submission.consumeOrderCart(91), true)
  assert.deepEqual(cart.getCartEntries(), {})
  assert.deepEqual(storage.get(STORAGE_KEY_ORDER_CART_SNAPSHOTS), {})
})

test('记住订单后付款只删除原购物车版本，不删除随后编辑或重新加购的同SKU', () => {
  cart.addCartItem(product(), 2)
  cart.addCartItem(product(20), 1)
  const attempt = submission.getOrderSubmission('goods', payload(), snapshot())
  submission.rememberCreatedOrder(100, attempt)
  assert.deepEqual(storage.get(STORAGE_KEY_ORDER_CART_SNAPSHOTS)[100], attempt.cartSnapshot)
  cart.setCartItemQuantity('10:1', 3)
  assert.equal(submission.consumeOrderCart(100), true)
  assert.deepEqual(Object.keys(cart.getCartEntries()), ['10:1'])
  assert.equal(cart.getCartEntries()['10:1'].quantity, 3)
  assert.equal(storage.has(STORAGE_KEY_ORDER_SUBMISSION), false)
  assert.deepEqual(storage.get(STORAGE_KEY_ORDER_CART_SNAPSHOTS), {})

  const readded = submission.getOrderSubmission('goods', payload(), snapshot())
  submission.rememberCreatedOrder(101, readded)
  cart.removeFromCart('10:1')
  cart.addCartItem(product(), 3)
  submission.consumeOrderCart(101)
  assert.equal(cart.getCartEntries()['10:1'].quantity, 3)
})

test('旧单及直接购买无购物车快照，付款不清理当前购物车', () => {
  cart.addCartItem(product(), 5)
  const before = cart.getCartEntries()
  assert.equal(submission.consumeOrderCart('legacy-order'), true)
  assert.deepEqual(cart.getCartEntries(), before)
  const direct = submission.getOrderSubmission('goods', payload(), null)
  submission.rememberCreatedOrder(200, direct)
  assert.equal(submission.consumeOrderCart(200), true)
  assert.deepEqual(cart.getCartEntries(), before)
})

test('取消或付清订单清掉本次请求，下次相同购买可以生成新requestId', () => {
  for (const [orderId, complete] of [[300, submission.forgetOrderSubmission], [301, submission.consumeOrderCart]]) {
    const attempt = submission.getOrderSubmission('goods', payload(), null)
    submission.rememberCreatedOrder(orderId, attempt)
    assert.equal(submission.getOrderSubmission('goods', payload(), null).requestId, attempt.requestId)
    complete(orderId)
    assert.notEqual(submission.getOrderSubmission('goods', payload(), null).requestId, attempt.requestId)
  }
})

test('结束旧单不能清除后来开始的提交，账号切换及退出清理请求和订单购物车快照', () => {
  cart.addCartItem(product(), 2)
  const original = submission.getOrderSubmission('goods', payload(), snapshot())
  submission.rememberCreatedOrder(400, original)
  const later = submission.getOrderSubmission('goods', { ...payload(), remark: '后来提交' }, snapshot())
  submission.forgetOrderSubmission(400)
  assert.equal(storage.get(STORAGE_KEY_ORDER_SUBMISSION).requestId, later.requestId)
  submission.rememberCreatedOrder(401, later)
  beginSession('account-B')
  assert.equal(storage.has(STORAGE_KEY_ORDER_SUBMISSION), false)
  assert.equal(storage.has(STORAGE_KEY_ORDER_CART_SNAPSHOTS), false)
  assert.deepEqual(cart.getCartEntries(), {})
  const nextAccount = submission.getOrderSubmission('goods', payload())
  submission.rememberCreatedOrder(402, nextAccount)
  endSession()
  assert.equal(storage.has(STORAGE_KEY_ORDER_SUBMISSION), false)
  assert.equal(storage.has(STORAGE_KEY_ORDER_CART_SNAPSHOTS), false)
})
