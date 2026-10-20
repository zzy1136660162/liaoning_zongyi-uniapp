import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadSetup, loadOptions } from './sfc-harness.mjs'
import { requireConsultationPatient, parseConsultationContext } from '../utils/consultation-checkout.js'

const harness = (overrides = {}) => {
  let onLoad
  const orders = [], payments = [], writes = [], routes = []
  const mocks = {
    ref: value => ({ value }), computed: get => ({ get value() { return get() } }),
    onLoad: callback => { onLoad = callback }, onShow() {}, onMounted() {},
    getSessionGeneration: () => 1, isCurrentSession: () => true, assertCurrentSession() {},
    parseConsultationContext, requireConsultationPatient,
    getPrescriptionDetail: async () => ({ id: 7, consultationId: 30, patientId: 8, status: 1 }),
    getPrescriptionItems: async () => [{ id: 70, productId: 20, days: 7 }],
    getOrderByPrescriptionId: async () => null,
    getConsultationDetail: async () => ({ id: 30, patientId: 8 }),
    getProductDetail: async () => ({ id: 20, productCategory: 1, status: 1, delSign: 0, productName: '真实处方商品', available: true, stock: 10,
      skus: [{ id: 2, status: 1, delSign: 0, defaultFlag: 0, price: 20, stock: 10 },
        { id: 1, status: 1, delSign: 0, defaultFlag: 1, price: 12, stock: 10 }] }),
    getPatientList: async () => [{ id: 8, name: '处方患者' }, { id: 9, name: '另一位患者' }],
    getAddressList: async () => [{ id: 10, isDefault: true }], queryFreight: async () => ({ freight: 0 }),
    createOrderFromPrescription: async input => { orders.push(input); return { id: 42, orderNo: 'fixture-order', payableAmount: 18 } },
    createOrder: async () => { throw new Error('处方不能走普通购物车下单') },
    ensureWeChatIdentity: async () => ({ openid: 'fixture-openid' }),
    wechatSinglePay: async (id, input) => { payments.push({ id, ...input }); return {} },
    getCartEntries: () => { throw new Error('处方入口不读购物车') },
    buildOrderInfo: items => ({ items, prescriptions: [], deliveryInfo: {}, cost: {
      medicineCost: items.reduce((sum, item) => sum + item.price * item.quantity, 0), shippingFee: 0 } }),
    logButtonClick() {}, logPageView() {}, ORDER_TYPE_THERAPY: 4,
    STORAGE_KEY_CURRENT_ORDER: 'current_order', STORAGE_KEY_DEFAULT_ADDRESS_ID: 'default_address',
    console: { debug() {}, error() {}, warn() {} },
    uni: { getStorageSync: () => null, setStorageSync: (key, value) => writes.push({ key, value }), removeStorageSync() {},
      showLoading() {}, hideLoading() {}, showToast() {}, redirectTo: route => routes.push(route.url) },
    ...overrides
  }
  const page = loadSetup('pages/order/confirm.vue', mocks, ['loadProducts', 'loadOrderInfo', 'loadCheckoutPatients',
    'loadAddresses', 'submitOrder', 'selectPatient', 'selectedPatient', 'orderInfo', 'selectionIssue', 'categories'])
  onLoad({ prescriptionId: '7' })
  return { page, orders, payments, writes, routes }
}

test('真实处方固定原患者，按每条明细一件和默认真实SKU展示，支付只用后台金额', async () => {
  const { page, orders, payments, writes } = harness()
  await page.loadProducts(); page.loadOrderInfo(); await page.loadCheckoutPatients(); await page.loadAddresses()
  assert.equal(page.selectedPatient.value.id, 8)
  page.selectPatient({ detail: { value: '1' } })
  assert.equal(page.selectedPatient.value.id, 8)
  assert.equal(page.orderInfo.value.items[0].quantity, 1, '疗程days不能当购买数量')
  assert.equal(page.orderInfo.value.items[0].skuId, 1)
  assert.equal(page.orderInfo.value.total, 12)
  await page.submitOrder()
  assert.deepEqual(orders, [{ prescriptionId: 7, addressId: 10, remark: '' }])
  assert.equal(payments[0].totalAmount, 18)
  assert.ok(writes.every(write => ['current_order', 'default_address'].includes(write.key)), '不写虚拟购物车或旧数量键')
})

test('默认SKU不存在或商品读取失败时禁止下单和支付，不恢复旧商品快照', async () => {
  for (const getProductDetail of [async () => ({ id: 20, skus: [] }), async () => { throw new Error('fixture offline') }]) {
    const { page, orders, payments } = harness({ getProductDetail })
    await page.submitOrder()
    assert.equal(orders.length, 0)
    assert.equal(payments.length, 0)
    assert.ok(page.selectionIssue.value)
    assert.equal(page.orderInfo.value.items.length, 0)
  }
})

test('处方患者或问诊关联不匹配拒绝下单', async () => {
  const { page, orders } = harness({ getConsultationDetail: async () => ({ id: 30, patientId: 9 }) })
  await page.submitOrder()
  assert.equal(orders.length, 0)
  assert.match(page.selectionIssue.value, /就诊人不一致/)
})

test('处方已加载但订单查询尚未完成时不开放购药入口', async () => {
  let finish
  const definition = loadOptions('pages/prescription/detail.vue', {
    getSessionGeneration: () => 1, isCurrentSession: () => true, AI_DOCTOR: { name: 'fixture' }, getImageUrl: value => value,
    getOrderByPrescriptionId: () => new Promise(resolve => { finish = resolve })
  })
  const page = { ...definition.data(), ...definition.methods, prescriptionLoaded: true, prescriptionStatus: 1 }
  page.pageOptions.prescriptionId = 7
  const pending = page.loadOrderStatus()
  assert.equal(definition.computed.canBuyMedicine.call(page), false)
  finish({ id: 42, prescriptionId: 7, orderStatus: 1, payStatus: 1 })
  await pending
  assert.equal(definition.computed.canBuyMedicine.call(page), false)
})

test('待付处方续付已有订单，已付款也不重复创建', async () => {
  for (const order of [{ id: 42, payStatus: 0, orderStatus: 0 }, { id: 42, payStatus: 1, orderStatus: 1 }]) {
    const { page, orders, payments, routes } = harness({ getOrderByPrescriptionId: async () => order })
    await page.submitOrder()
    assert.equal(orders.length, 0)
    assert.equal(payments.length, 0)
    assert.deepEqual(routes, order.payStatus === 0 ? ['/pages/order/order-detail?orderId=42'] : [])
  }
})

test('处方详情已有待付订单只进原单，无订单才进真实处方确认入口', () => {
  const routes = []
  const definition = loadOptions('pages/prescription/detail.vue', {
    getSessionGeneration: () => 1, isCurrentSession: () => true, AI_DOCTOR: { name: 'fixture' }, getImageUrl: value => value,
    uni: { navigateTo: route => routes.push(route.url) }
  })
  const page = { ...definition.data(), ...definition.methods, prescriptionLoaded: true, orderStatusLoaded: true, prescriptionStatus: 1 }
  Object.defineProperty(page, 'canBuyMedicine', { get: () => definition.computed.canBuyMedicine.call(page) })
  page.pageOptions.prescriptionId = 7
  page.orderStatus.order = { id: 42, payStatus: 0, orderStatus: 0 }
  page.goBuy()
  page.orderStatus.order = null
  page.goBuy()
  page.orderStatusLoaded = false
  page.goBuy()
  assert.deepEqual(routes, ['/pages/order/order-detail?orderId=42', '/pages/order/confirm?prescriptionId=7'])
})
