import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadSetup, loadOptions } from './sfc-harness.mjs'
import { requireConsultationPatient, parseConsultationContext } from '../utils/consultation-checkout.js'
import { QUESTIONNAIRE_RECHECK_REQUIRED } from '../utils/checkout.js'

const harness = (overrides = {}) => {
  let onLoad, onShow, onUnload
  const orders = [], payments = [], writes = [], routes = [], questionnaireRoutes = [], channels = new Map()
  const mocks = {
    ref: value => ({ value }), computed: get => ({ get value() { return get() } }),
    onLoad: callback => { onLoad = callback }, onShow: callback => { onShow = callback },
    onUnload: callback => { onUnload = callback }, onMounted() {},
    getSessionGeneration: () => 1, isCurrentSession: () => true, assertCurrentSession() {},
    parseConsultationContext, requireConsultationPatient,
    getPrescriptionDetail: async () => ({ id: 7, consultationId: 30, patientId: 8, status: 1, expired: false }),
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
    ensureWeChatIdentity: () => assert.fail('确认页不能重复获取支付身份'),
    wechatSinglePay: async (...args) => { payments.push({ id: args[0], args }); return {} },
    getCartEntries: () => { throw new Error('处方入口不读购物车') },
    buildOrderInfo: items => ({ items, prescriptions: [], deliveryInfo: {}, cost: {
      medicineCost: items.reduce((sum, item) => sum + item.price * item.quantity, 0), shippingFee: 0 } }),
    logButtonClick() {}, logPageView() {}, ORDER_TYPE_THERAPY: 4,
    console: { debug() {}, error() {}, warn() {} },
    uni: { getStorageSync: () => null, setStorageSync: (key, value) => writes.push({ key, value }), removeStorageSync() {},
      showLoading() {}, hideLoading() {}, showToast() {}, redirectTo: route => routes.push(route.url),
      navigateTo: route => {
        questionnaireRoutes.push(route.url)
        route.success?.({ eventChannel: { on: (event, callback) => channels.set(event, callback) } })
      } },
    ...overrides
  }
  const page = loadSetup('pages/order/confirm.vue', mocks, ['loadProducts', 'loadOrderInfo', 'loadCheckoutPatients',
    'loadAddresses', 'submitOrder', 'selectPatient', 'selectedPatient', 'orderInfo', 'selectionIssue', 'categories',
    'prescriptionQuestionnaireAnswer', 'directPurchase', 'orderRemark'])
  onLoad({ prescriptionId: '7' })
  return { page, orders, payments, writes, routes, questionnaireRoutes, channels, show: () => onShow(), unload: () => onUnload() }
}

// 运行真实须知页与答题页，验证处方补答沿独立答卷通道回到原确认页，不借用购物车。
const completePrescriptionQuestionnaire = async (checkout, getProductDetail, answerId = 501) => {
  const parseRoute = url => Object.fromEntries(new URL(url, 'https://fixture.invalid').searchParams)
  let questionnaireRoute
  const answerChannels = new Map(), submitted = [], returns = []
  const boundary = {
    getSessionGeneration: () => 1, isCurrentSession: value => value === 1,
    onSessionChanged: () => () => {}, getProductDetail,
    resolveCartCompatibility: () => ({ valid: true }),
    getCartProductInfo: () => assert.fail('处方补答不能读取购物车凭据'),
    getCartEntries: () => assert.fail('处方补答不能读取购物车'),
    addCartItem: () => assert.fail('处方补答不能加购'),
    updateCartQuestionnaire: () => assert.fail('处方补答不能修改购物车'),
    uni: { showLoading() {}, hideLoading() {}, showToast() {},
      navigateBack: options => returns.push(options),
      navigateTo: route => {
        questionnaireRoute = route.url
        route.success?.({ eventChannel: { on: (event, callback) => answerChannels.set(event, callback) } })
      } }
  }
  const noticeDefinition = loadOptions('pages/products/product_notice.vue', boundary)
  const notice = { ...noticeDefinition.data(), ...noticeDefinition.methods,
    getOpenerEventChannel: () => ({ emit: (event, value) => checkout.channels.get(event)?.(value) }) }
  noticeDefinition.onLoad.call(notice, parseRoute(checkout.questionnaireRoutes.at(-1)))
  await notice.startQuestionnaire()
  const definition = loadOptions('pages/products/product_questionnaire.vue', { ...boundary,
    fetchAccountProfile: async () => ({ id: 7 }),
    restoreQuestionnaireDraft: (_account, _product, _questionnaire, questions) => questions,
    clearQuestionnaireDraft() {},
    getQuestionnaireByProductId: async productId => ({ questionnaireId: Number(productId) * 10,
      questions: [{ questionId: 1, questionType: 1, isRequired: 1,
        options: [{ optionId: 2, optionText: '是' }] }] }),
    submitQuestionnaire: async input => { submitted.push(input); return { answerId, isMatch: true } }
  })
  const questionnaire = { ...definition.data(), ...definition.methods,
    getOpenerEventChannel: () => ({ emit: (event, value) => answerChannels.get(event)?.(value) }) }
  definition.onLoad.call(questionnaire, parseRoute(questionnaireRoute))
  await questionnaire.loadQuestionnaire()
  questionnaire.selectAnswer(0, 2)
  await questionnaire.submitAnswer()
  definition.onUnload.call(questionnaire)
  noticeDefinition.onUnload.call(notice)
  assert.deepEqual(submitted, [{ productId: '20', questionnaireId: 200, answers: [{ questionId: 1, optionId: 2 }] }])
  assert.deepEqual(returns, [{ delta: 2 }])
}

const questionnaireProduct = id => ({ id, productCategory: 1, status: 1, delSign: 0,
  productName: '处方问卷商品', available: true, stock: 10, needQuestionnaire: 1, questionnaireId: id * 10,
  skus: [{ id: 1, status: 1, delSign: 0, defaultFlag: 1, price: 12, stock: 10 }] })

test('处方按实时商品最小ID补答，经须知与问卷返回原页后仍按处方数量和原患者备注创建', async () => {
  let productIds = [30, 20]
  const getProductDetail = async id => questionnaireProduct(Number(id))
  const checkout = harness({ getProductDetail,
    getPrescriptionItems: async () => productIds.map(productId => ({ id: productId + 100, productId, days: 7 })) })
  await checkout.show()
  checkout.page.orderRemark.value = '保留原处方备注'

  await checkout.page.submitOrder()

  assert.equal(checkout.orders.length, 0)
  assert.match(checkout.questionnaireRoutes[0], /product_notice\?id=20&/)
  assert.match(checkout.questionnaireRoutes[0], /action=repair/)
  assert.match(checkout.questionnaireRoutes[0], /buyQuantity=1/)
  await completePrescriptionQuestionnaire(checkout, getProductDetail)
  productIds = [20, 30]
  await checkout.show()
  assert.equal(checkout.page.selectedPatient.value.id, 8)
  assert.equal(checkout.page.orderRemark.value, '保留原处方备注')
  assert.equal(checkout.page.directPurchase.value, null)
  assert.deepEqual(checkout.page.orderInfo.value.items.map(item => item.quantity), [1, 1])

  await checkout.page.submitOrder()

  assert.equal(checkout.orders.length, 1)
  assert.equal(checkout.orders[0].prescriptionId, 7)
  assert.equal(checkout.orders[0].questionnaireAnswerId, 501)
  assert.equal(checkout.orders[0].remark, '保留原处方备注')
  assert.deepEqual(checkout.payments[0].args, [42])
})

test('处方补答拒绝其他商品或旧问卷回调，切号或卸载后的迟到答卷不能回填或创建订单', async () => {
  for (const boundary of ['session', 'unload']) {
    let generation = 1
    const checkout = harness({ getProductDetail: async id => questionnaireProduct(Number(id)),
      getSessionGeneration: () => generation, isCurrentSession: value => value === generation,
      assertCurrentSession: value => { if (value !== generation) throw Object.assign(new Error('stale'), { code: 'SESSION_CHANGED' }) } })
    await checkout.show()
    await checkout.page.submitOrder()
    const answer = checkout.channels.get('directPurchaseQuestionnaireAnswered')
    answer({ productId: 30, skuId: 1, questionnaireId: 200, answerId: 501 })
    answer({ productId: 20, skuId: 1, questionnaireId: 199, answerId: 501 })
    assert.equal(checkout.page.prescriptionQuestionnaireAnswer.value, null)
    if (boundary === 'session') generation++
    else checkout.unload()
    answer({ productId: 20, skuId: 1, questionnaireId: 200, answerId: 501 })
    assert.equal(checkout.page.prescriptionQuestionnaireAnswer.value, null)
    await checkout.page.submitOrder()
    assert.equal(checkout.orders.length, 0)
    assert.equal(checkout.payments.length, 0)
  }
})

test('处方下单40910清除本页旧凭据，再补答后仍创建原处方订单', async () => {
  const requests = []
  const getProductDetail = async id => questionnaireProduct(Number(id))
  const checkout = harness({ getProductDetail, createOrderFromPrescription: async input => {
    requests.push(input)
    if (requests.length === 1) throw Object.assign(new Error('答卷已失效，请重新填写'), { code: QUESTIONNAIRE_RECHECK_REQUIRED })
    return { id: 42, payableAmount: 18 }
  } })
  await checkout.show()
  checkout.page.orderRemark.value = '原处方备注'
  await checkout.page.submitOrder()
  await completePrescriptionQuestionnaire(checkout, getProductDetail)
  await checkout.show()

  await checkout.page.submitOrder()

  assert.equal(requests.length, 1)
  assert.equal(requests[0].questionnaireAnswerId, 501)
  assert.equal(checkout.page.prescriptionQuestionnaireAnswer.value, null)
  assert.equal(checkout.payments.length, 0)
  await completePrescriptionQuestionnaire(checkout, getProductDetail, 502)
  await checkout.show()
  await checkout.page.submitOrder()
  assert.equal(requests.length, 2)
  assert.equal(requests[1].questionnaireAnswerId, 502)
  assert.equal(requests[1].prescriptionId, 7)
  assert.equal(requests[1].remark, '原处方备注')
  assert.equal(checkout.page.selectedPatient.value.id, 8)
  assert.equal(checkout.page.directPurchase.value, null)
  assert.equal(checkout.page.orderInfo.value.items[0].quantity, 1)
  assert.deepEqual(checkout.payments[0].args, [42])
})

test('真实处方固定原患者，按每条明细一件和默认真实SKU展示，支付只用后台金额', async () => {
  const { page, orders, payments, writes } = harness()
  await page.loadProducts(); page.loadOrderInfo(); await page.loadCheckoutPatients(); await page.loadAddresses()
  assert.equal(page.selectedPatient.value.id, 8)
  page.selectPatient({ id: 9, name: '另一位患者' })
  assert.equal(page.selectedPatient.value.id, 8)
  assert.equal(page.orderInfo.value.items[0].quantity, 1, '疗程days不能当购买数量')
  assert.equal(page.orderInfo.value.items[0].skuId, 1)
  assert.equal(page.orderInfo.value.total, 12)
  await page.submitOrder()
  assert.deepEqual(orders.map(({ prescriptionId, addressId, remark }) => ({ prescriptionId, addressId, remark })),
    [{ prescriptionId: 7, addressId: 10, remark: '' }])
  if ('requestId' in orders[0]) assert.match(orders[0].requestId, /^\S+$/)
  assert.equal(page.orderInfo.value.total, 18, '创建成功后展示后台成交金额')
  assert.deepEqual(payments[0].args, [42], '支付身份和金额由统一支付入口及后台核定')
  assert.deepEqual(writes, [], '处方确认与提交不写本地订单草稿或地址缓存')
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

test('过期或未明确确认有效的处方不能创建新订单', async () => {
  for (const expired of [true, undefined, null, 'false']) {
    const { page, orders, payments, routes } = harness({
      getPrescriptionDetail: async () => ({ id: 7, consultationId: 30, patientId: 8, status: 1, expired })
    })
    await page.submitOrder()
    assert.equal(orders.length, 0)
    assert.equal(payments.length, 0)
    assert.equal(routes.length, 0)
    assert.deepEqual(page.categories.value, [])
    assert.match(page.selectionIssue.value, /过期|有效性/)
  }
})

test('处方后来过期仍先续付原订单，不重新读取商品或创建新单', async () => {
  let prescriptionReads = 0
  const { page, orders, payments, routes } = harness({
    getOrderByPrescriptionId: async () => ({ id: 42, payStatus: 0, orderStatus: 0 }),
    getPrescriptionDetail: async () => {
      prescriptionReads++
      return { id: 7, consultationId: 30, patientId: 8, status: 1, expired: true }
    },
    getProductDetail: async () => { throw new Error('旧订单续付不依赖当前商品') }
  })
  await page.submitOrder()
  assert.equal(prescriptionReads, 0)
  assert.equal(orders.length, 0)
  assert.equal(payments.length, 0)
  assert.deepEqual(routes, ['/pages/order/order-detail?orderId=42'])
})

test('原订单支付状态未知、存在履约异常或退款申请时不开放续付', async () => {
  for (const existing of [{ id: 42, orderStatus: 0 },
    { id: 42, payStatus: 0, orderStatus: 0, paymentFulfillmentStatus: 'PENDING' },
    { id: 42, payStatus: 0, orderStatus: 0, refundApplicationId: 9 }]) {
    const { page, orders, payments, routes } = harness({ getOrderByPrescriptionId: async () => existing })
    await page.submitOrder()
    assert.equal(orders.length, 0)
    assert.equal(payments.length, 0)
    assert.deepEqual(routes, [])
  }
})

test('已有处方订单状态查询失败时停止提交，不继续查处方或创建订单', async () => {
  let prescriptionReads = 0
  const { page, orders, payments, routes } = harness({
    getOrderByPrescriptionId: async () => { throw new Error('fixture order unavailable') },
    getPrescriptionDetail: async () => { prescriptionReads++; return {} }
  })
  await page.submitOrder()
  assert.equal(prescriptionReads, 0)
  assert.equal(orders.length, 0)
  assert.equal(payments.length, 0)
  assert.deepEqual(routes, [])
})

test('处方已加载但订单查询尚未完成时不开放购药入口', async () => {
  let finish
  const definition = loadOptions('pages/prescription/detail.vue', {
    getSessionGeneration: () => 1, isCurrentSession: () => true, AI_DOCTOR: { name: 'fixture' }, getImageUrl: value => value,
    getOrderByPrescriptionId: () => new Promise(resolve => { finish = resolve })
  })
  const page = { ...definition.data(), ...definition.methods, prescriptionLoaded: true, prescription: { status: 1, expired: false } }
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
  const page = { ...definition.data(), ...definition.methods, prescriptionLoaded: true, orderStatusLoaded: true,
    prescription: { status: 1, expired: false } }
  Object.defineProperty(page, 'canBuyMedicine', { get: () => definition.computed.canBuyMedicine.call(page) })
  page.pageOptions.prescriptionId = 7
  page.orderStatus.order = { id: 42, payStatus: 0, orderStatus: 0 }
  page.prescription.expired = true
  page.goBuy()
  page.prescription.expired = false
  page.orderStatus.order = null
  page.goBuy()
  page.orderStatusLoaded = false
  page.goBuy()
  assert.deepEqual(routes, ['/pages/order/order-detail?orderId=42', '/pages/order/confirm?prescriptionId=7'])
})
