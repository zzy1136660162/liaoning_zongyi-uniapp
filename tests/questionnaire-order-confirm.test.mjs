import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadSetup } from './sfc-harness.mjs'

const createPage = (questionnaireId = 8, passed = false, overrides = {}) => {
  const navigations = [], toasts = [], orders = []
  let unload
  const keys = ['9:2', '3:2', '5:2']
  const page = loadSetup('pages/order/confirm.vue', {
    ref: value => ({ value }), computed: get => ({ get value() { return get() } }),
    onLoad: callback => callback({ selectedItems: keys.join(',') }), onShow() {}, onMounted() {},
    onUnload: callback => { unload = callback },
    getSessionGeneration: () => 1, isCurrentSession: () => true, assertCurrentSession() {},
    parseConsultationContext: () => null,
    getCurrentCheckoutProductIds: () => keys, setCheckoutProductIds() {},
    getCartEntries: () => Object.fromEntries(keys.map(key => [key, { quantity: 1, revision: 'fixture', timestamp: 1 }])),
    getProductDetail: async () => ({}),
    loadCartProducts: async () => [9, 3, 5].map(productId => ({ id: `${productId}:2`, productId, skuId: 2,
      quantity: 1, productCategory: 2, needQuestionnaire: 1, questionnaireId: productId === 3 ? questionnaireId : 99,
      ...(productId === 3 && passed ? { answerId: 30 } : {}) })),
    loadCartItems: categories => categories.flatMap(category => category.products),
    buildOrderInfo: items => ({ items, cost: { shippingFee: 0 }, total: 30 }),
    getAddressList: async () => [{ id: 10, isDefault: true }], getPatientList: async () => [{ id: 7 }],
    queryFreight: async () => ({}), validateCheckoutStock: () => ({ valid: true }),
    ensureWeChatIdentity: async () => ({ openid: 'fixture-openid' }),
    createOrder: async order => { orders.push(order); return { id: 1 } }, wechatSinglePay: async () => ({}),
    logButtonClick() {}, STORAGE_KEY_CURRENT_ORDER: 'fixture-order', STORAGE_KEY_DEFAULT_ADDRESS_ID: 'fixture-address',
    uni: {
      getStorageSync() {}, setStorageSync() {}, removeStorageSync() {}, showLoading() {}, hideLoading() {},
      showToast: toast => toasts.push(toast), navigateTo: navigation => navigations.push(navigation), redirectTo() {}
    }, ...overrides
  }, ['submitOrder', 'checkoutContext', 'selectedPatient', 'orderRemark', 'selectedProductIds'])
  return { page, navigations, toasts, orders, unload: () => unload() }
}

test('确认页以最小商品 ID 补答后返回原页，保留整组选中、复诊、患者和备注', async () => {
  const { page, navigations, orders } = createPage()
  page.checkoutContext.value = { consultationId: 11, patientId: 7 }
  page.selectedPatient.value = { id: 7 }
  page.orderRemark.value = '原备注'
  await page.submitOrder()
  const url = new URL(navigations[0].url, 'https://fixture.invalid')
  assert.equal(url.searchParams.get('id'), '3')
  assert.equal(url.searchParams.get('action'), 'repair')
  assert.deepEqual(page.selectedProductIds.value, ['9:2', '3:2', '5:2'])
  assert.deepEqual(page.checkoutContext.value, { consultationId: 11, patientId: 7 })
  assert.equal(page.selectedPatient.value.id, 7)
  assert.equal(page.orderRemark.value, '原备注')
  assert.equal(orders.length, 0)
})

test('最小目标问卷配置缺失时提示，不能跳过它验证其他商品', async () => {
  const { page, navigations, toasts, orders } = createPage(null)
  await page.submitOrder()
  assert.equal(navigations.length, 0)
  assert.match(toasts.at(-1).title, /问卷暂不可用/)
  assert.equal(orders.length, 0)
})

test('最小目标已有当前有效答卷时，其余商品无需逐件答题即可整组下单', async () => {
  const { page, navigations, orders } = createPage(8, true)
  await page.submitOrder()
  assert.equal(navigations.length, 0)
  assert.deepEqual(orders[0].items.map(item => item.productId), [9, 3, 5])
})

test('确认页同账号退出后，延迟商品响应不触发问卷或创建订单', async () => {
  let finish
  const pending = new Promise(resolve => { finish = resolve })
  const { page, navigations, orders, unload } = createPage(8, false, { loadCartProducts: () => pending })
  const submission = page.submitOrder()
  unload()
  finish([{ id: '3:2', productId: 3, skuId: 2, productCategory: 2, needQuestionnaire: 1, questionnaireId: 8 }])
  await submission
  assert.equal(navigations.length, 0)
  assert.equal(orders.length, 0)
})
