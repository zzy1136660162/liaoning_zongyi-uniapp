import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import * as cart from './cart-api-fixture.mjs'
import { checkoutEntries, directPurchaseQuery, parseDirectPurchase } from '../utils/checkout.js'
import { loadOptions } from './sfc-harness.mjs'

const storage = new Map(), navigations = [], messages = [], events = []
globalThis.uni = {
  getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key), $emit: (...args) => events.push(args),
  navigateTo: value => navigations.push(value), showToast: value => messages.push(value)
}
beforeEach(async () => { storage.clear(); navigations.length = 0; messages.length = 0; events.length = 0 })
const product = (id = 10, extra = {}) => ({ id, productId: id, skuId: 1, name: `商品${id}`, price: 10,
  stock: 8, available: true, goodsMerchantType: 1, productCategory: 2, ...extra })
const categories = products => [{ products: products.map(item => ({ ...item, id: `${item.productId}:${item.skuId}` })) }]
const flush = async () => { for (let index = 0; index < 30; index++) await Promise.resolve() }

test('直接购买路由严格解析数量及问卷凭据，不从购物车补数量或答案', async () => {
  await cart.addCartItem(product(10, { needQuestionnaire: 1, questionnaireId: 90 }), 7,
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

test('提交投影保留原数量，库存下降时阻断，购物车投影不反写服务端确认数量', async () => {
  await cart.addCartItem(product(), 5)
  const entries = checkoutEntries(['10:1'], null), before = structuredClone(entries)
  const latest = categories([product(10, { stock: 2 })])
  assert.equal(cart.loadCartItems(latest, false, { entries, preserveQuantity: true })[0].quantity, 5)
  const checkout = cart.prepareCheckout(['10:1'], latest, { entries })
  assert.equal(checkout.valid, false)
  assert.equal(checkout.stockCheck.reason, 'stock_shortage')
  assert.deepEqual(entries, before)
  assert.deepEqual(cart.getCartEntries(), before)
  assert.equal(cart.loadCartItems(latest)[0].quantity, 5)
})

test('独立立即购买可完成商品及问卷校验，投影不创建购物车条目', async () => {
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

test('旧订单只删除快照仍匹配的行，保留重新加购、改量和其他商品', async () => {
  await cart.addCartItem(product(10), 2)
  await cart.addCartItem(product(20), 1)
  const original = structuredClone(cart.getCartEntries())
  await cart.setCartItemQuantity('10:1', 3)
  await cart.setCartItemQuantity('10:1', 2)
  assert.equal(await cart.removePurchasedCartItems({ '10:1': original['10:1'] }), true)
  assert.equal(cart.getCartEntries()['10:1'].quantity, 2)
  await cart.removeFromCart('10:1')
  await cart.addCartItem(product(10), 2)
  await cart.removePurchasedCartItems({ '10:1': original['10:1'] })
  assert.equal(cart.getCartEntries()['10:1'].quantity, 2)
  const current = cart.getCartEntries()
  await cart.removePurchasedCartItems({ '10:1': current['10:1'] })
  assert.deepEqual(Object.keys(cart.getCartEntries()), ['20:1'])
})

test('正常后台刷新保留下单行身份；后台数量变化和旧行升级有稳定身份', async () => {
  cart.replaceCartData({ '10:1': { ...product(), quantity: 2, selected: true, timestamp: 123 } })
  const original = cart.getCartEntries()['10:1']
  assert.ok(original.revision)
  assert.equal(cart.getCartEntries()['10:1'].revision, original.revision)
  cart.replaceCartData({ '10:1': { ...original, revision: undefined, timestamp: 456, price: 99 } })
  assert.equal(cart.getCartEntries()['10:1'].revision, original.revision)
  assert.equal(cart.getCartEntries()['10:1'].timestamp, 123)
  await cart.removePurchasedCartItems({ '10:1': original })
  assert.deepEqual(cart.getCartEntries(), {})
  await cart.addCartItem(product(), 2)
  const beforeChange = cart.getCartEntries()['10:1']
  await cart.setCartItemQuantity('10:1', 3)
  assert.notEqual(cart.getCartEntries()['10:1'].revision, beforeChange.revision)
  await cart.removePurchasedCartItems({ '10:1': beforeChange })
  assert.equal(cart.getCartEntries()['10:1'].quantity, 3)
})

for (const name of ['priducts_list', 'priducts_list2']) {
  test(`${name} 金额与结算只含已勾选可售行，空选不跳转`, async () => {
    const products = [product(10), product(20), product(30, { available: false, stock: 0 })]
    for (const item of products.filter(item => item.available)) await cart.addCartItem(item, 2)
    cart.replaceCartData({ ...cart.getCartEntries(), '30:1': { ...products[2], quantity: 2, selected: false } })
    await cart.updateProductSelection('10:1', false)
    let profileRequests = 0
    const definition = loadOptions(`pages/products/${name}.vue`, { ...cart,
      STORAGE_KEY_CURRENT_CONSULTATION_ID: 'current_consultation_id',
      fetchAccountProfile: async () => { profileRequests++; return { id: 7, userName: '' } },
      getToken: () => 'fixture', TabBar: {}, getImageUrl: value => value })
    const page = { ...definition.data(), ...definition.methods,
      categories: [{ products }], cartItems: cart.loadCartItems(categories(products)) }
    for (const [key, getter] of Object.entries(definition.computed)) {
      Object.defineProperty(page, key, { get: () => getter.call(page) })
    }
    assert.equal(page.totalPrice, 20)
    await page.handleSubmit()
    assert.equal(profileRequests, 1)
    assert.equal(navigations.at(-1).url, '/pages/order/confirm?selectedItems=20:1')
    await cart.updateProductSelection('20:1', false)
    page.cartItems = cart.loadCartItems(categories(products))
    assert.equal(page.totalPrice, 0)
    const count = navigations.length
    await page.handleSubmit()
    assert.equal(navigations.length, count)
    assert.equal(messages.at(-1).title, '请先选择商品')
  })
}

for (const name of ['cart/cart', 'products/priducts_list', 'products/priducts_list2']) {
  test(`${name} 结算只确认接口账户，资料失败不导航，换号后的迟到结果不跳转`, async () => {
    await cart.addCartItem(product(), 2)
    let generation = 1
    let profileRequest
    const definition = loadOptions(`pages/${name}.vue`, { ...cart,
      STORAGE_KEY_CURRENT_CONSULTATION_ID: 'current_consultation_id',
      getToken: () => 'fixture', TabBar: {}, getImageUrl: value => value,
      getSessionGeneration: () => generation, isCurrentSession: session => session === generation,
      fetchAccountProfile: () => new Promise((resolve, reject) => { profileRequest = { resolve, reject } }) })
    const page = { ...definition.data(), ...definition.methods,
      categories: name === 'cart/cart' ? categories([product()]) : [{ products: [product()] }],
      cartItems: cart.loadCartItems(categories([product()])), selectedItems: ['10:1'] }
    for (const [key, getter] of Object.entries(definition.computed)) {
      Object.defineProperty(page, key, { get: () => getter.call(page) })
    }
    const submit = () => name === 'cart/cart' ? page.goToCheckout() : page.handleSubmit()
    const failure = submit()
    await flush()
    assert.ok(profileRequest)
    assert.equal(navigations.length, 0)
    profileRequest.reject(new Error('账户资料暂不可用'))
    await failure
    assert.equal(navigations.length, 0)
    assert.equal(messages.at(-1).title, '账户资料暂不可用')

    profileRequest = null
    const stale = submit()
    await flush()
    assert.ok(profileRequest)
    generation++
    profileRequest.resolve({ id: 7, userName: '' })
    await stale
    assert.equal(navigations.length, 0)

    profileRequest = null
    const valid = submit()
    await flush()
    assert.ok(profileRequest)
    profileRequest.resolve({ id: 8, userName: '' })
    await valid
    assert.equal(navigations.at(-1).url, '/pages/order/confirm?selectedItems=10:1')
    assert.equal(storage.has('user_register_info'), false)
  })
}
