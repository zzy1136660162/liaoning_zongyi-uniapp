import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import * as cart from '../utils/cart.js'
import { checkoutEntries, directPurchaseQuery, parseDirectPurchase } from '../utils/checkout.js'
import { loadOptions } from './sfc-harness.mjs'

const storage = new Map(), navigations = [], messages = [], events = []
globalThis.uni = {
  getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key), $emit: (...args) => events.push(args),
  navigateTo: value => navigations.push(value), showToast: value => messages.push(value)
}
beforeEach(() => { storage.clear(); navigations.length = 0; messages.length = 0; events.length = 0 })
const product = (id = 10, extra = {}) => ({ id, productId: id, skuId: 1, name: `商品${id}`, price: 10,
  stock: 8, available: true, goodsMerchantType: 1, productCategory: 2, ...extra })
const categories = products => [{ products: products.map(item => ({ ...item, id: `${item.productId}:${item.skuId}` })) }]

test('直接购买路由严格解析数量及问卷凭据，不从购物车补数量或答案', () => {
  cart.addCartItem(product(10, { needQuestionnaire: 1, questionnaireId: 90 }), 7,
    { questionnaireId: 90, answerId: 91 })
  const before = structuredClone(cart.getCartEntries())
  const purchase = parseDirectPurchase({ buyQuantity: '2', buyQuestionnaireId: '90', buyAnswerId: '92' })
  assert.deepEqual(purchase, { quantity: 2, questionnaireId: 90, answerId: 92 })
  assert.equal(directPurchaseQuery(purchase), '&buyQuantity=2&buyQuestionnaireId=90&buyAnswerId=92')
  assert.deepEqual(checkoutEntries(['10:1'], purchase)['10:1'], {
    productId: '10', skuId: '1', quantity: 2, selected: true, stock: null, available: true,
    questionnaireId: 90, answerId: 92
  })
  const independent = checkoutEntries(['10:1'], parseDirectPurchase({ buyQuantity: '1' }))['10:1']
  assert.equal(independent.answerId, null)
  assert.equal(independent.questionnaireId, null)
  assert.deepEqual(cart.getCartEntries(), before)
  assert.deepEqual(checkoutEntries(['10:1'], null), before)
  assert.equal(parseDirectPurchase({}), null)
  assert.equal(directPurchaseQuery(null), '')
  for (const quantity of ['', '0', '-1', '1.5', 'NaN', 'Infinity', '1x', '1e2', '9007199254740992', null]) {
    assert.throws(() => parseDirectPurchase({ buyQuantity: quantity }), /购买数量无效/)
  }
  assert.throws(() => parseDirectPurchase({ buyQuantity: 1, buyAnswerId: 9 }), /问卷信息无效/)
  assert.throws(() => parseDirectPurchase({ buyQuantity: 1, buyQuestionnaireId: 0 }), /问卷信息无效/)
  for (const keys of [[], ['10'], ['10:0'], ['01:1'], ['10:1:2'], ['10:1', '20:1']]) {
    assert.throws(() => checkoutEntries(keys, purchase), /购买商品规格无效/)
  }
})

test('提交投影保留原数量，库存下降时阻断，购物车展示仍可修正数量', () => {
  cart.addCartItem(product(), 5)
  const entries = checkoutEntries(['10:1'], null), before = structuredClone(entries)
  const latest = categories([product(10, { stock: 2 })])
  assert.equal(cart.loadCartItems(latest, false, { entries, preserveQuantity: true })[0].quantity, 5)
  const checkout = cart.prepareCheckout(['10:1'], latest, { entries })
  assert.equal(checkout.valid, false)
  assert.equal(checkout.stockCheck.reason, 'stock_shortage')
  assert.deepEqual(entries, before)
  assert.deepEqual(cart.getCartEntries(), before)
  assert.equal(cart.loadCartItems(latest)[0].quantity, 2)
})

test('独立立即购买可完成商品及问卷校验，投影不创建购物车条目', () => {
  cart.setCheckoutProductIds(['20:1'])
  const purchase = parseDirectPurchase({ buyQuantity: 3, buyQuestionnaireId: 90, buyAnswerId: 91 })
  const entries = checkoutEntries(['10:1'], purchase), before = structuredClone(entries)
  const latest = categories([product(10, { needQuestionnaire: 1, questionnaireId: 90 })])
  const checkout = cart.prepareCheckout(['10:1'], latest, { entries })
  assert.equal(checkout.valid, true)
  assert.equal(checkout.items[0].quantity, 3)
  assert.equal(checkout.items[0].answerId, 91)
  assert.deepEqual(entries, before)
  assert.deepEqual(cart.getCartEntries(), {})
  assert.deepEqual(cart.getCheckoutProductIds(), ['20:1'])
  assert.equal(events.length, 0)
})

test('旧订单只删除快照仍匹配的行，保留重新加购、改量和其他商品', () => {
  cart.addCartItem(product(10), 2)
  cart.addCartItem(product(20), 1)
  const original = structuredClone(cart.getCartEntries())
  cart.setCartItemQuantity('10:1', 3)
  cart.setCartItemQuantity('10:1', 2)
  assert.equal(cart.removePurchasedCartItems({ '10:1': original['10:1'] }), true)
  assert.equal(cart.getCartEntries()['10:1'].quantity, 2)
  cart.removeFromCart('10:1')
  cart.addCartItem(product(10), 2)
  cart.removePurchasedCartItems({ '10:1': original['10:1'] })
  assert.equal(cart.getCartEntries()['10:1'].quantity, 2)
  const current = cart.getCartEntries()
  cart.removePurchasedCartItems({ '10:1': current['10:1'] })
  assert.deepEqual(Object.keys(cart.getCartEntries()), ['20:1'])
})

test('正常后台刷新保留下单行身份；后台数量变化和旧行升级有稳定身份', () => {
  storage.set('cart_items', { '10:1': { ...product(), quantity: 2, selected: true, timestamp: 123 } })
  const original = cart.getCartEntries()['10:1']
  assert.ok(original.revision)
  assert.equal(cart.getCartEntries()['10:1'].revision, original.revision)
  cart.replaceCartData({ '10:1': { ...original, revision: undefined, timestamp: 456, price: 99 } })
  assert.equal(cart.getCartEntries()['10:1'].revision, original.revision)
  assert.equal(cart.getCartEntries()['10:1'].timestamp, 123)
  cart.removePurchasedCartItems({ '10:1': original })
  assert.deepEqual(cart.getCartEntries(), {})
  cart.addCartItem(product(), 2)
  const beforeChange = cart.getCartEntries()['10:1']
  cart.replaceCartData({ '10:1': { ...beforeChange, quantity: 3 } })
  assert.notEqual(cart.getCartEntries()['10:1'].revision, beforeChange.revision)
  cart.removePurchasedCartItems({ '10:1': beforeChange })
  assert.equal(cart.getCartEntries()['10:1'].quantity, 3)
})

for (const name of ['priducts_list', 'priducts_list2']) {
  test(`${name} 金额与结算只含已勾选可售行，空选不跳转`, () => {
    const products = [product(10), product(20), product(30, { available: false, stock: 0 })]
    for (const item of products) cart.addCartItem(item, 2)
    cart.updateProductSelection('10:1', false)
    storage.set('user_register_info', { realName: '测试' })
    const definition = loadOptions(`pages/products/${name}.vue`, { ...cart,
      STORAGE_KEY_USER_REGISTER: 'user_register_info', STORAGE_KEY_CURRENT_CONSULTATION_ID: 'current_consultation_id',
      getToken: () => 'fixture', TabBar: {}, getImageUrl: value => value })
    const page = { ...definition.data(), ...definition.methods,
      categories: [{ products }], cartItems: cart.loadCartItems(categories(products)) }
    for (const [key, getter] of Object.entries(definition.computed)) {
      Object.defineProperty(page, key, { get: () => getter.call(page) })
    }
    assert.equal(page.totalPrice, 20)
    page.handleSubmit()
    assert.equal(navigations.at(-1).url, '/pages/order/confirm?selectedItems=20:1')
    cart.updateProductSelection('20:1', false)
    page.cartItems = cart.loadCartItems(categories(products))
    assert.equal(page.totalPrice, 0)
    const count = navigations.length
    page.handleSubmit()
    assert.equal(navigations.length, count)
    assert.equal(messages.at(-1).title, '请先选择商品')
  })
}
