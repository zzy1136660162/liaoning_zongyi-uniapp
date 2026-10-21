import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'
import * as cart from './cart-api-fixture.mjs'

const storage = new Map(), emitted = []
globalThis.uni = { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key), $emit: (event, payload) => emitted.push({ event, payload }) }
beforeEach(async () => { storage.clear(); emitted.length = 0 })
const product = (id, extra = {}) => ({ id, productId: id, skuId: 1, name: `商品${id}`, price: 10, goodsMerchantType: 1, productCategory: 2, isPrescription: 0, stock: 8, available: true, ...extra })
const categories = products => [{ products: products.map(value => ({ ...value, id: `${value.productId}:${value.skuId}` })) }]

test('购物车按真实商品规格保存，缺失规格拒绝，旧布尔条目和数量副本不再构造商品', async () => {
  await assert.rejects(cart.addCartItem({ id: 10, stock: 8 }, 1), /规格/)
  storage.set('cart_items', { 10: true })
  storage.set('verifiedProducts', { '30:1': { productId: 30, skuId: 1, quantity: 2 } })
  storage.set('productQuantities', { 20: 9 })
  assert.deepEqual(cart.getCartEntries(), {})
  assert.equal(await cart.addCartItem(product(10), 2), true)
  assert.equal(cart.getCartProductInfo(10, 1).quantity, 2)
  assert.equal(storage.get('productQuantities')[20], 9, '不再读写旧数量副本')
  assert.ok(emitted.some(value => value.event === 'cartUpdated'))
})

test('缺货取消选择，全选不会选中缺货；超库存接口拒绝且保留原数量，金额只计已选商品', async () => {
  await cart.addCartItem(product(10), 2)
  cart.replaceCartData({ ...cart.getCartEntries(), '20:1': { ...product(20, { available: false, stock: 0 }), quantity: 1, selected: false } })
  await cart.updateMultipleSelections({ '10:1': true, '20:1': true })
  const values = categories([product(10), product(20, { available: false, stock: 0 })])
  let items = cart.loadCartItems(values)
  assert.deepEqual(cart.getSelectedProductIds(), ['10:1'])
  assert.equal(items.find(item => item.id === '20:1').selected, false)
  assert.equal(cart.calculateTotalPrice(items), 20)
  await assert.rejects(cart.setCartItemQuantity('10:1', 99), value => /库存/.test(value.message))
  items = cart.loadCartItems(values)
  assert.equal(items.find(item => item.id === '10:1').quantity, 2)
  assert.equal(cart.calculateTotalPrice(items), 20)
})

test('同商品不同规格独立计价和选择，增减不改变加入顺序', async () => {
  await cart.addCartItem(product(10), 2)
  await cart.addCartItem(product(10, { skuId: 2, price: 18 }), 3)
  const values = categories([product(10), product(10, { skuId: 2, price: 18 })])
  assert.equal(cart.calculateTotalPrice(cart.loadCartItems(values)), 74)
  await cart.updateProductSelection('10:1', false)
  await cart.setCartItemQuantity('10:2', 2)
  const items = cart.loadCartItems(values)
  assert.deepEqual(items.map(item => item.id), ['10:1', '10:2'])
  assert.equal(cart.calculateTotalPrice(items), 36)
})

test('问卷通过态只属于当前问卷，换绑清除答案而保留所选数量', async () => {
  await cart.addCartItem(product(10, { needQuestionnaire: 1, questionnaireId: 90 }), 2,
    { questionnaireId: 90, answerId: 91, questionnairePassed: true })
  assert.equal(cart.getCartProductInfo(10, 1).questionnairePassed, true)
  const [item] = cart.loadCartItems(categories([product(10, { needQuestionnaire: 1, questionnaireId: 92 })]))
  assert.equal(item.questionnairePassed, false)
  assert.equal(item.answerId, null)
  assert.equal(item.quantity, 2)
})

test('提交前库存校验拒绝超量及失效规格，不静默替换成同商品其他规格', async () => {
  await cart.addCartItem(product(10), 5)
  assert.equal(cart.validateCheckoutStock(['10:1'], categories([product(10, { stock: 2 })])).reason, 'stock_shortage')
  assert.equal(cart.validateCheckoutStock(['10:1'], categories([product(10, { skuId: 2 })])).reason, 'product_missing')
})
