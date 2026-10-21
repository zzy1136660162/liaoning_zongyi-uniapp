import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import * as cart from './cart-api-fixture.mjs'
import * as checkout from '../utils/checkout.js'
import * as quantity from '../utils/purchase-quantity.js'
import { loadSetup, loadOptions } from './sfc-harness.mjs'

const storage = new Map(), navigations = [], messages = []
beforeEach(async () => {
  storage.clear(); navigations.length = 0; messages.length = 0
  globalThis.uni = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key), $emit() {}, showLoading() {}, hideLoading() {},
    showToast: value => messages.push(value), navigateTo: value => navigations.push(value),
    navigateBack: value => navigations.push(value)
  }
})
const product = (extra = {}) => ({ id: 101, productName: '测试商品', name: '测试商品', status: 1,
  goodsMerchantType: 1, productCategory: 2, needQuestionnaire: 0, stock: 20, available: true,
  skus: [{ id: 11, price: 10, stock: 20, status: 1, defaultFlag: 1 },
    { id: 12, price: 20, stock: 10, status: 1 }], ...extra })
const seedCart = async () => await cart.addCartItem({ ...product(), skuId: 11, price: 10 }, 5)
const parseUrl = url => Object.fromEntries(new URL(url, 'https://fixture.invalid').searchParams)

function detail(name) {
  let mounted, cartUpdated
  const page = loadSetup(`pages/products/${name}.vue`, {
    ...cart, ...checkout, ...quantity,
    ref: value => ({ value }), computed: get => ({ get value() { return get() } }),
    getCurrentInstance: () => ({}), onLoad() {}, onShow() {}, onUnload() {}, onUnmounted() {},
    onMounted: callback => { mounted = callback },
    subscribeCartUpdated: callback => { cartUpdated = callback; return () => {} },
    getImageUrl: value => value, mapProductDetail: value => value, getToken: () => 'fixture',
    STORAGE_KEY_CURRENT_CONSULTATION_ID: 'fixture_consultation'
  }, ['product', 'quantity', 'selectedSkuId', 'applyProduct', 'addCart', 'buyNow',
    'selectSku', 'increaseQuantity', 'decreaseQuantity', 'canIncreaseQuantity'])
  mounted?.()
  return { ...page, notifyCart: () => cartUpdated?.() }
}

for (const name of ['medicine_detail', 'therapy_detail']) {
  test(`${name}: 购买数量独立于购物车，重复主按钮按本次所选数量累加`, async () => {
    await seedCart()
    const page = detail(name)
    page.applyProduct(product())
    assert.equal(page.quantity.value, 1)
    await page.increaseQuantity()
    await page.addCart(); await page.addCart()
    assert.equal(cart.getCartProductInfo(101, 11).quantity, 9)
    assert.equal(page.quantity.value, 2)
    page.notifyCart()
    assert.equal(page.quantity.value, 2)
    page.selectSku(product().skus[1])
    assert.equal(page.quantity.value, 1)
    await page.addCart()
    assert.equal(cart.getCartProductInfo(101, 12).quantity, 1)
    assert.equal(cart.getCartProductInfo(101, 11).quantity, 9)
  })

  test(`${name}: 加购总量超过库存或限购时不偷偷截断，草稿步进不超上限`, async () => {
    await seedCart()
    const page = detail(name)
    page.applyProduct(product({ limitInfo: { enabled: true, remainingQuantity: 6 } }))
    page.quantity.value = 2
    await page.addCart()
    assert.equal(cart.getCartProductInfo(101, 11).quantity, 5)
    page.quantity.value = 6
    assert.equal(page.canIncreaseQuantity.value, false)
    await page.increaseQuantity()
    assert.equal(page.quantity.value, 6)
    await page.decreaseQuantity()
    assert.equal(page.quantity.value, 5)
  })

  test(`${name}: 直接购买独立数量及SKU，确认/复诊路由不写原购物车`, async () => {
    await seedCart()
    const page = detail(name)
    for (const productCategory of [2, 1]) {
      page.applyProduct(product({ productCategory }))
      page.selectSku(product().skus[1]); page.quantity.value = 2
      const before = structuredClone(cart.getCartEntries())
      await page.buyNow()
      const navigation = navigations.at(-1).url
      assert.ok(navigation.startsWith(productCategory === 1 ? '/pages/dispense/apply?' : '/pages/order/confirm?'))
      assert.equal(parseUrl(navigation).selectedItems, '101:12')
      assert.equal(parseUrl(navigation).buyQuantity, '2')
      assert.deepEqual(cart.getCartEntries(), before)
    }
  })

  test(`${name}: 直接购买显式复用同SKU当前有效答卷，仍不继承购物车数量`, async () => {
    await cart.addCartItem({ ...product({ needQuestionnaire: 1, questionnaireId: 8 }), skuId: 11 }, 5,
      { questionnaireId: 8, answerId: 99 })
    const before = structuredClone(cart.getCartEntries()), page = detail(name)
    page.applyProduct(product({ needQuestionnaire: 1, questionnaireId: 8 }))
    page.quantity.value = 2
    await page.buyNow()
    const navigation = navigations.at(-1).url, options = parseUrl(navigation)
    assert.ok(navigation.startsWith('/pages/order/confirm?'))
    assert.equal(options.selectedItems, '101:11')
    assert.deepEqual(checkout.parseDirectPurchase(options), { quantity: 2, questionnaireId: 8, answerId: 99 })
    assert.deepEqual(cart.getCartEntries(), before)
  })

  test(`${name}: 问卷已换绑时不复制购物车旧答卷，按本次数量重新答题`, async () => {
    await cart.addCartItem({ ...product({ needQuestionnaire: 1, questionnaireId: 8 }), skuId: 11 }, 5,
      { questionnaireId: 8, answerId: 99 })
    const before = structuredClone(cart.getCartEntries()), page = detail(name)
    page.applyProduct(product({ needQuestionnaire: 1, questionnaireId: 9 }))
    page.quantity.value = 2
    await page.buyNow()
    const navigation = navigations.at(-1).url, options = parseUrl(navigation)
    assert.ok(navigation.startsWith('/pages/products/product_notice?'))
    assert.equal(options.id, '101'); assert.equal(options.skuId, '11')
    assert.equal(options.action, 'buy'); assert.equal(options.buyQuantity, '2')
    assert.equal(options.buyAnswerId, undefined)
    assert.deepEqual(cart.getCartEntries(), before)
  })
}

function notice(options, current = product()) {
  const definition = loadOptions('pages/products/product_notice.vue', {
    ...cart, ...checkout, getSessionGeneration: () => 1, isCurrentSession: () => true,
    getImageUrl: value => value, getProductDetail: async () => current, logPageView() {},
    STORAGE_KEY_CURRENT_CONSULTATION_ID: 'fixture_consultation'
  })
  const page = { ...definition.data(), ...definition.methods }
  definition.onLoad.call(page, { id: '101', skuId: '11', action: 'buy', buyQuantity: '2', ...options })
  return page
}

test('须知直接购买不加购，当前有效问卷凭据与数量透传确认页', async () => {
  await seedCart()
  const before = structuredClone(cart.getCartEntries())
  await notice({ buyQuestionnaireId: '8', buyAnswerId: '30' }, product({ needQuestionnaire: 1, questionnaireId: 8 })).startQuestionnaire()
  const options = parseUrl(navigations.at(-1).url)
  assert.equal(options.selectedItems, '101:11')
  assert.deepEqual(checkout.parseDirectPurchase(options), { quantity: 2, questionnaireId: 8, answerId: 30 })
  assert.deepEqual(cart.getCartEntries(), before)
})

function questionnaire(options, opener, current = product({ needQuestionnaire: 1, questionnaireId: 8 })) {
  const definition = loadOptions('pages/products/product_questionnaire.vue', {
    ...cart, ...checkout, getSessionGeneration: () => 1, isCurrentSession: () => true,
    onSessionChanged: () => () => {},
    restoreQuestionnaireDraft: (account, id, questionnaireId, questions) => questions,
    clearQuestionnaireDraft() {}, logPageView() {}, getProductDetail: async () => current,
    getQuestionnaireByProductId: async () => ({ questionnaireId: 8, questions: [{ questionId: 7,
      questionType: 1, isRequired: 1, options: [{ optionId: 10, optionText: '是' }] }] }),
    submitQuestionnaire: async () => ({ isMatch: true, answerId: 30 }),
    STORAGE_KEY_CURRENT_CONSULTATION_ID: 'fixture_consultation'
  })
  const page = { ...definition.data(), ...definition.methods, getOpenerEventChannel: () => opener }
  definition.onLoad.call(page, { id: '101', skuId: '11', action: 'buy', buyQuantity: '2', ...options })
  return page
}

test('立即购买问卷通过后带新凭据继续结算，不覆盖已有购物车', async () => {
  await seedCart()
  const before = structuredClone(cart.getCartEntries()), page = questionnaire()
  await page.loadQuestionnaire(); page.selectAnswer(0, 10); await page.submitAnswer()
  const options = parseUrl(navigations.at(-1).url)
  assert.equal(options.selectedItems, '101:11')
  assert.deepEqual(checkout.parseDirectPurchase(options), { quantity: 2, questionnaireId: 8, answerId: 30 })
  assert.deepEqual(cart.getCartEntries(), before)
})

test('直接购买补答经页面EventChannel返回原确认页，购物车保持不变', async () => {
  await seedCart()
  const before = structuredClone(cart.getCartEntries()), events = []
  const page = notice({ action: 'repair' }, product({ needQuestionnaire: 1, questionnaireId: 8 }))
  page.getOpenerEventChannel = () => ({ emit: (...args) => events.push(args) })
  await page.startQuestionnaire()
  let relay
  navigations.at(-1).success({ eventChannel: { on: (name, callback) => { assert.equal(name, 'directPurchaseQuestionnaireAnswered'); relay = callback } } })
  const answerPage = questionnaire(parseUrl(navigations.at(-1).url), { emit: (name, answer) => relay(answer) })
  await answerPage.loadQuestionnaire(); answerPage.selectAnswer(0, 10); await answerPage.submitAnswer()
  assert.deepEqual(events, [['directPurchaseQuestionnaireAnswered',
    { productId: 101, skuId: 11, quantity: 2, questionnaireId: 8, answerId: 30 }]])
  assert.equal(navigations.at(-1).delta, 2)
  assert.deepEqual(cart.getCartEntries(), before)
})

for (const name of ['product_notice', 'product_questionnaire']) {
  test(`${name}: 缺失或非法的直接购买数量不能退回购物车模式`, async () => {
    await seedCart()
    const before = structuredClone(cart.getCartEntries())
    const definition = loadOptions(`pages/products/${name}.vue`, {
      ...cart, ...checkout, getSessionGeneration: () => 1, isCurrentSession: () => true,
      onSessionChanged: () => () => {}, logPageView() {}, getImageUrl: value => value
    })
    for (const options of [{}, { buyQuantity: '0' }, { buyQuantity: '1.5' }, { buyQuantity: 'bad' }]) {
      const page = { ...definition.data(), ...definition.methods }
      definition.onLoad.call(page, { id: '101', skuId: '11', action: 'buy', ...options })
      assert.equal(page.pageActive, false)
      assert.match(messages.at(-1).title, /购买/)
    }
    assert.deepEqual(cart.getCartEntries(), before)
  })
}
