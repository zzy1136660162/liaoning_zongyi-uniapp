import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { resolveQuestionnaireState, resolveCheckoutQuestionnaire } from '../utils/questionnaire-state.js'
import { buildListCartCategories } from '../utils/product-list-cart.js'
import { buildCartSyncPayload } from '../utils/cart-sync-payload.js'
import * as cart from './cart-api-fixture.mjs'
import { loadOptions } from './sfc-harness.mjs'

const storage = new Map(), navigation = [], messages = []
globalThis.uni = { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key), $emit() {}, navigateTo: value => navigation.push(value),
  navigateBack: value => navigation.push(value), showToast: value => messages.push(value), showLoading() {}, hideLoading() {} }
beforeEach(async () => { storage.clear(); navigation.length = 0; messages.length = 0 })
const product = (id, extra = {}) => ({ id, productId: id, skuId: 11, stock: 9, price: 5, available: true,
  productCategory: 2, needQuestionnaire: 1, questionnaireId: 90, ...extra })
const categories = values => [{ products: values.map(value => ({ ...value, id: `${value.productId}:${value.skuId}` })) }]

test('问卷四态区分无需、缺配置、待答与当前答案，旧布尔值不能放行', async () => {
  const current = product(10)
  assert.equal(resolveQuestionnaireState({ needQuestionnaire: 0 }), 'not_required')
  for (const id of [null, undefined, '', ' ', 0, '0', -1, 'bad']) {
    assert.equal(resolveQuestionnaireState({ ...current, questionnaireId: id }), 'unavailable')
  }
  assert.equal(resolveQuestionnaireState(current, { questionnairePassed: true }), 'required')
  assert.equal(resolveQuestionnaireState(current, { questionnaireId: 91, answerId: 1 }), 'required')
  assert.equal(resolveQuestionnaireState(current, { questionnaireId: '90', answerId: 0 }), 'required')
  assert.equal(resolveQuestionnaireState(current, { questionnaireId: '90', answerId: 1, questionnairePassed: false }), 'passed')
})

test('三类混合只取所选需要问卷的最小商品ID，与数组顺序和展示类目无关', async () => {
  const values = [product(30, { productCategory: 3 }), product(20, { productCategory: 1 }),
    product(10, { productCategory: 2 }), product(1, { needQuestionnaire: 0 })]
  assert.equal(resolveCheckoutQuestionnaire(values).item.productId, 10)
  assert.equal(resolveCheckoutQuestionnaire([...values].reverse()).item.productId, 10)
  assert.equal(resolveCheckoutQuestionnaire(values.filter(item => item.productId !== 10)).item.productId, 20)
  assert.equal(resolveCheckoutQuestionnaire([product(1, { needQuestionnaire: 0 })]).valid, true)
})

test('唯一目标通过后其他商品未答不阻断，最小目标配置缺失不会跳过改答其他商品', async () => {
  const other = product(20, { questionnaireId: null })
  assert.equal(resolveCheckoutQuestionnaire([other, product(10, { answerId: 91 })]).valid, true)
  const result = resolveCheckoutQuestionnaire([product(10, { questionnaireId: null }), product(20, { answerId: 91 })])
  assert.equal(result.valid, false)
  assert.equal(result.state, 'unavailable')
  assert.equal(result.item.productId, 10)
})

test('最小商品的任一已选规格已有当前答卷即可复用，未选规格和旧问卷不参与', async () => {
  const pending = product(10), passed = product(10, { skuId: 12, answerId: 91 })
  assert.equal(resolveCheckoutQuestionnaire([pending, product(20), passed]).item.skuId, 12)
  assert.equal(resolveCheckoutQuestionnaire([pending, passed]).valid, true)
  assert.equal(resolveCheckoutQuestionnaire([pending, { ...passed, questionnaireId: null }]).valid, false)
  assert.equal(resolveCheckoutQuestionnaire([pending, { ...passed, questionnaireId: 89 }]).valid, false)
  assert.equal(resolveCheckoutQuestionnaire([pending]).valid, false)
  assert.equal(resolveCheckoutQuestionnaire([pending, product(10, { skuId: 13 })]).item.skuId, 11)
})

test('加购允许暂未答题或缺配置，结算只拦固定目标，补答只改凭据并保留数量勾选', async () => {
  const target = product(10), other = product(20, { questionnaireId: null })
  assert.equal(await cart.addCartItem(target, 2), true)
  assert.equal(await cart.addCartItem(other, 3), true)
  await cart.updateProductSelection('10:11', false)
  const values = categories([target, other])
  const before = cart.getCartProductInfo(10, 11)
  let check = cart.prepareCheckout(['10:11', '20:11'], values)
  assert.equal(check.questionnaireCheck.item.productId, '10')
  assert.equal(check.questionnaireCheck.state, 'required')
  await cart.setCartItemQuantity('10:11', 5)
  assert.equal(await cart.updateCartQuestionnaire(target, { questionnaireId: 90, answerId: 91 }), true)
  const after = cart.getCartProductInfo(10, 11)
  assert.equal(after.quantity, 5)
  assert.equal(after.selected, false)
  assert.equal(after.timestamp, before.timestamp)
  check = cart.prepareCheckout(['10:11', '20:11'], values)
  assert.equal(check.valid, true)
  assert.equal(cart.getCartProductInfo(20, 11).questionnairePassed, false)
})

test('补答不复活已删除行、不覆盖另一规格，也不接受旧问卷结果', async () => {
  const target = product(10)
  await cart.addCartItem(target, 2)
  await cart.addCartItem({ ...target, skuId: 12 }, 3)
  assert.equal(await cart.updateCartQuestionnaire(target, { questionnaireId: 89, answerId: 91 }), false)
  await cart.removeFromCart('10:11')
  assert.equal(await cart.updateCartQuestionnaire(target, { questionnaireId: 90, answerId: 91 }), false)
  assert.equal(cart.getCartProductInfo(10, 11), null)
  assert.equal(cart.getCartProductInfo(10, 12).quantity, 3)
})

test('列表当前问卷配置覆盖旧行绑定，真实规格库存价格仍取原行', async () => {
  const current = product(10, { questionnaireId: 92, stock: 999, price: 999 })
  const entry = { ...product(10), quantity: 2, questionnaireId: 90, answerId: 91 }
  const values = buildListCartCategories([{ products: [current] }], { '10:11': entry })
  assert.equal(values[0].products[0].questionnaireId, 92)
  assert.equal(values[0].products[0].answerId, null)
  assert.equal(values[0].products[0].stock, 9)
  assert.equal(values[0].products[0].price, 5)
})

test('缺配置加购同步不上传非法问卷ID，不影响商品规格和数量', async () => {
  assert.deepEqual(buildCartSyncPayload('10:11', { quantity: 2, questionnaireId: 0, answerId: 91 }),
    { productId: 10, skuId: 11, quantity: 2, checked: 1 })
})

test('购物车结算携带全部所选规格进入唯一目标须知，保持原选择和数量', async () => {
  const products = [product(20), product(10)]
  for (const item of products) await cart.addCartItem(item, 2)
  const definition = loadOptions('pages/cart/cart.vue', { ...cart, TabBar: {}, getToken: () => 'fixture',
    getImageUrl: value => value, STORAGE_KEY_CURRENT_CONSULTATION_ID: 'consultation' })
  const page = { ...definition.data(), ...definition.methods, categories: categories(products), selectedItems: ['20:11', '10:11'],
    cartItems: cart.loadCartItems(categories(products)), isItemSelectable: () => true }
  const before = structuredClone(cart.getCartEntries())
  await page.goToCheckout()
  const url = navigation.at(-1).url
  assert.match(url, /product_notice\?id=10/)
  assert.match(url, /action=checkout/)
  assert.match(url, /selectedItems=20%3A11%2C10%3A11/)
  assert.deepEqual(cart.getCartEntries(), before)
})

const noticeDetail = id => ({ ...product(Number(id)), skus: [{ id: 11, price: 5, stock: 9, status: 1 }] })
const createNotice = (options, overrides = {}) => {
  const definition = loadOptions('pages/products/product_notice.vue', { ...cart, getImageUrl: value => value,
    getProductDetail: async id => noticeDetail(id), logPageView() {},
    STORAGE_KEY_CURRENT_CONSULTATION_ID: 'consultation', ...overrides })
  const page = { ...definition.data(), ...definition.methods }
  definition.onLoad.call(page, { id: '10', skuId: '11', ...options })
  return { definition, page }
}

test('须知页整组结算将所选规格透传到问卷，补答不改变任何购物车数量', async () => {
  const { definition, page } = createNotice({ action: 'checkout', selectedItems: '20%3A11%2C10%3A11' })
  try {
    await page.startQuestionnaire()
    assert.match(navigation.at(-1).url, /product_questionnaire\?id=10/)
    assert.match(navigation.at(-1).url, /action=checkout/)
    assert.match(navigation.at(-1).url, /selectedItems=20%3A11%2C10%3A11/)
    assert.deepEqual(cart.getCartEntries(), {})
  } finally { definition.onUnload.call(page) }
})

test('须知连续点击只查一次，同账号退页后的响应不加购也不跳转', async () => {
  let finish, calls = 0
  const waiting = new Promise(resolve => { finish = resolve })
  const { definition, page } = createNotice({ action: 'buy', buyQuantity: '1' }, { getProductDetail: () => { calls++; return waiting } })
  const first = page.startQuestionnaire()
  await page.startQuestionnaire()
  assert.equal(calls, 1)
  definition.onUnload.call(page)
  finish(noticeDetail(10))
  await first
  assert.deepEqual(cart.getCartEntries(), {})
  assert.equal(navigation.length, 0)
})

test('须知等待期间目标已答，整组结算重查后继续全部商品，不再要求其余商品逐份答题', async () => {
  await cart.addCartItem(product(10), 2, { questionnaireId: 90, answerId: 91 })
  await cart.addCartItem(product(20), 3)
  const { definition, page } = createNotice({ action: 'checkout', selectedItems: '20:11,10:11' })
  try {
    await page.startQuestionnaire()
    assert.equal(navigation.at(-1).url, '/pages/order/confirm?selectedItems=20:11,10:11')
    assert.equal(cart.getCartProductInfo(10, 11).quantity, 2)
    assert.equal(cart.getCartProductInfo(20, 11).quantity, 3)
  } finally { definition.onUnload.call(page) }
})
