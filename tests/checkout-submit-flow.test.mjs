import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import * as cart from './cart-api-fixture.mjs'
import * as checkout from '../utils/checkout.js'
import * as submission from '../utils/order-submission.js'
import * as session from '../utils/session.js'
import * as consultation from '../utils/consultation-checkout.js'
import * as storageKeys from '../utils/storage.js'
import { withProductSku } from '../utils/product-sku.js'
import { loadSetup } from './sfc-harness.mjs'

const storage = new Map(), messages = [], navigations = [], redirects = [], channels = new Map(), modals = []
globalThis.uni = {
  getStorageSync: key => structuredClone(storage.get(key)),
  setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
  removeStorageSync: key => storage.delete(key), $emit() {}, showLoading() {}, hideLoading() {},
  showToast: value => messages.push(value), redirectTo: value => redirects.push(value),
  navigateTo: value => {
    navigations.push(value)
    value.success?.({ eventChannel: { on: (event, handler) => channels.set(event, handler) } })
  },
  navigateBack() {}, showModal: modal => modals.push(modal)
}
beforeEach(async () => {
  storage.clear(); messages.length = 0; navigations.length = 0; redirects.length = 0; channels.clear(); modals.length = 0
  session.beginSession('account-A')
})
const product = (extra = {}, stock = 8) => ({ id: 10, productName: '测试商品', productCategory: 2,
  goodsMerchantType: 1, status: 1, delSign: 0, price: 10, stock, available: true, needQuestionnaire: 0,
  skus: [{ id: 11, status: 1, delSign: 0, price: 10, stock, defaultFlag: 1 }], ...extra })
const addToCart = async (quantity = 5) => { const detail = product(); await cart.addCartItem(withProductSku(detail, detail.skus[0]), quantity) }
const deferred = () => {
  let resolve
  const promise = new Promise(finish => { resolve = finish })
  return { promise, resolve }
}
const flush = async () => { for (let index = 0; index < 30; index++) await Promise.resolve() }

async function confirm({ route = {}, readProduct = async () => product(), create, pay } = {}) {
  const hooks = {}, orders = [], payments = []
  const page = loadSetup('pages/order/confirm.vue', {
    ...cart, ...checkout, ...submission, ...session, ...consultation, ...storageKeys,
    ref: value => ({ value }), computed: get => ({ get value() { return get() } }),
    onLoad: callback => { hooks.load = callback }, onShow: callback => { hooks.show = callback },
    onUnload: callback => { hooks.unload = callback }, onMounted() {}, setTimeout: () => 0,
    getProductDetail: id => readProduct(id), getAddressList: async () => [{ id: 8, isDefault: true }],
    getPatientList: async () => [{ id: 7, name: '就诊人甲' }, { id: 9, name: '就诊人乙' }],
    queryFreight: async () => ({ freight: 18 }), ensureWeChatIdentity: () => assert.fail('确认页不能重复获取支付身份'),
    createOrder: async data => { orders.push(structuredClone(data)); return create ? create(data, orders.length) : { id: 100, payableAmount: 30 } },
    wechatSinglePay: async (...args) => {
      payments.push({ orderId: args[0], args })
      return pay ? pay(...args) : { outTradeNo: 'fixture-trade' }
    },
    logButtonClick() {}, logPageView() {},
    console: { debug() {}, log() {}, warn() {}, error() {} }
  }, ['submitOrder', 'loadProducts', 'loadOrderInfo', 'orderInfo', 'selectedPatient', 'selectPatient',
    'patients', 'orderRemark', 'directPurchase', 'selectionEntries', 'selectionIssue', 'submitting', 'canSubmit'])
  hooks.load({ selectedItems: '10:11', ...route })
  await hooks.show()
  page.selectPatient(page.patients.value[0])
  return { ...page, orders, payments, show: hooks.show, unload: hooks.unload }
}

test('确认页显示5件后库存降至2件，实际submit拒绝且不截量或创建订单', async () => {
  await addToCart(5)
  let stock = 8
  const page = await confirm({ readProduct: async () => product({}, stock) })
  assert.equal(page.orderInfo.value.items[0].quantity, 5)
  stock = 2
  await page.submitOrder()
  assert.equal(page.orders.length, 0)
  assert.equal(page.orderInfo.value.items[0].quantity, 5)
  assert.equal(cart.getCartEntries()['10:11'].quantity, 5)
  assert.match(messages.at(-1).title, /库存不足/)
  assert.equal(page.submitting.value, false)
})

test('直接购买3件时真实提交3件，同SKU购物车已有5件保持原样', async () => {
  await addToCart(5)
  const original = cart.getCartEntries()
  const page = await confirm({ route: { buyQuantity: '3' } })
  assert.equal(page.orderInfo.value.items[0].quantity, 3)
  await page.submitOrder()
  assert.equal(page.orders.length, 1)
  assert.equal(page.orders[0].items[0].quantity, 3)
  assert.ok(page.orders[0].requestId)
  assert.deepEqual(page.payments[0].args, [100], '支付入口只接收已创建订单 ID')
  assert.deepEqual(cart.getCartEntries(), original)
})

test('购物车数量在展示后改变，首次提交要求核对，第二次才按新数量创建', async () => {
  await addToCart(5)
  const page = await confirm()
  await cart.setCartItemQuantity('10:11', 3)
  await page.submitOrder()
  assert.equal(page.orders.length, 0)
  assert.equal(page.orderInfo.value.items[0].quantity, 3)
  assert.match(messages.at(-1).title, /购买数量已变化/)
  await page.submitOrder()
  assert.equal(page.orders.length, 1)
  assert.equal(page.orders[0].items[0].quantity, 3)
})

test('提交前商品读取失败时保留原购物车且不创建订单', async () => {
  await addToCart(5)
  let offline = false
  const page = await confirm({ readProduct: async () => { if (offline) throw new Error('fixture offline'); return product() } })
  const original = cart.getCartEntries()
  offline = true
  await page.submitOrder()
  assert.equal(page.orders.length, 0)
  assert.deepEqual(cart.getCartEntries(), original)
  assert.match(page.selectionIssue.value, /暂时无法确认商品信息/)
})

test('商品读取期间切换账号，旧确认页不得创建订单', async () => {
  await addToCart(5)
  const waiting = deferred()
  let delay = false
  const page = await confirm({ readProduct: () => delay ? waiting.promise : Promise.resolve(product()) })
  delay = true
  const pending = page.submitOrder()
  session.beginSession('account-B')
  waiting.resolve(product())
  await pending
  assert.equal(page.orders.length, 0)
  assert.deepEqual(cart.getCartEntries(), {})
  assert.equal(page.submitting.value, false)
})

test('直接购买补答通过EventChannel更新凭据，返回原页保留患者与备注', async () => {
  await addToCart(5)
  let needsQuestionnaire = false
  const page = await confirm({ route: { buyQuantity: '3' }, readProduct: async () => product(
    needsQuestionnaire ? { needQuestionnaire: 1, questionnaireId: 90 } : {}) })
  const original = cart.getCartEntries()
  page.selectPatient(page.patients.value[1])
  page.orderRemark.value = '保留这条备注'
  needsQuestionnaire = true
  await page.submitOrder()
  assert.equal(page.orders.length, 0)
  assert.match(navigations.at(-1).url, /action=repair/)
  assert.match(navigations.at(-1).url, /buyQuantity=3/)
  const answer = channels.get('directPurchaseQuestionnaireAnswered')
  assert.equal(typeof answer, 'function')
  answer({ productId: 10, skuId: 99, questionnaireId: 90, answerId: 91 })
  assert.equal(page.directPurchase.value.answerId, null)
  answer({ productId: 10, skuId: 11, questionnaireId: 90, answerId: 91 })
  await page.show()
  assert.equal(page.selectedPatient.value.id, 9)
  assert.equal(page.orderRemark.value, '保留这条备注')
  assert.deepEqual(page.directPurchase.value, { quantity: 3, questionnaireId: 90, answerId: 91 })
  await page.submitOrder()
  assert.equal(page.orders.length, 1)
  assert.equal(page.orders[0].patientId, 9)
  assert.equal(page.orders[0].remark, '保留这条备注')
  assert.equal(page.orders[0].items[0].quantity, 3)
  assert.equal(page.orders[0].questionnaireAnswerId, 91)
  for (const field of ['questionnaireId', 'answerId', 'isMatch', 'questionnairePassed', 'openid', 'totalAmount']) {
    assert.equal(Object.hasOwn(page.orders[0], field), false)
  }
  assert.deepEqual(cart.getCartEntries(), original)
})

test('普通购物车下单只发送当前目标真实答卷ID，不发送本地通过标志', async () => {
  const detail = product({ needQuestionnaire: 1, questionnaireId: 90 })
  await cart.addCartItem(withProductSku(detail, detail.skus[0]), 2, { questionnaireId: 90, answerId: 91 })
  const page = await confirm({ readProduct: async () => detail })

  await page.submitOrder()

  assert.equal(page.orders.length, 1)
  assert.equal(page.orders[0].questionnaireAnswerId, 91)
  assert.deepEqual(page.orders[0].items, [{ productId: '10', skuId: '11', quantity: 2 }])
  for (const field of ['questionnaireId', 'answerId', 'isMatch', 'questionnairePassed']) {
    assert.equal(Object.hasOwn(page.orders[0], field), false)
  }
})

test('直接购买没有真实答卷ID或商品改绑问卷时不能用布尔通过标志下单', async () => {
  for (const route of [{ buyQuantity: '1' }, { buyQuantity: '1', buyQuestionnaireId: '89', buyAnswerId: '91' }]) {
    const page = await confirm({ route, readProduct: async () => product({ needQuestionnaire: 1, questionnaireId: 90 }) })
    page.directPurchase.value.isMatch = true
    page.directPurchase.value.questionnairePassed = true

    await page.submitOrder()

    assert.equal(page.orders.length, 0)
    assert.equal(page.payments.length, 0)
    assert.match(navigations.at(-1).url, /action=repair/)
  }
})

for (const mode of ['cart', 'direct']) {
  test(`${mode}下单40910后强制补答，新答卷只更新凭据并保留原患者备注和购买数量`, async () => {
    const detail = product({ needQuestionnaire: 1, questionnaireId: 90 })
    if (mode === 'cart') await cart.addCartItem(withProductSku(detail, detail.skus[0]), 2,
      { questionnaireId: 90, answerId: 91 })
    const page = await confirm({ readProduct: async () => detail,
      route: mode === 'direct' ? { buyQuantity: '2', buyQuestionnaireId: '90', buyAnswerId: '91' } : {},
      create: async (_data, call) => {
        if (call === 1) throw Object.assign(new Error('问卷规则已更新，请重新填写'), { code: checkout.QUESTIONNAIRE_RECHECK_REQUIRED })
        return { id: 101, payableAmount: 20 }
      } })
    page.selectPatient(page.patients.value[1])
    page.orderRemark.value = '保留本次备注'

    await page.submitOrder()

    assert.equal(page.orders.length, 1)
    assert.equal(page.payments.length, 0)
    assert.equal(messages.at(-1).title, '问卷规则已更新，请重新填写')
    assert.match(navigations.at(-1).url, /action=repair/)
    assert.match(navigations.at(-1).url, /buyQuantity=2/)
    if (mode === 'cart') assert.equal(cart.getCartEntries()['10:11'].answerId, 91,
      '接口仍返回旧凭据时，也必须进入独立补答，不能立即返回或重新加购')
    else assert.equal(page.directPurchase.value.answerId, null)
    await channels.get('directPurchaseQuestionnaireAnswered')({ productId: 10, skuId: 11, questionnaireId: 90, answerId: 92 })
    await page.show()
    assert.equal(page.selectedPatient.value.id, 9)
    assert.equal(page.orderRemark.value, '保留本次备注')
    await page.submitOrder()

    assert.equal(page.orders.length, 2)
    assert.equal(page.orders[0].questionnaireAnswerId, 91)
    assert.equal(page.orders[1].questionnaireAnswerId, 92)
    assert.notEqual(page.orders[1].requestId, page.orders[0].requestId)
    assert.equal(page.orders[1].items[0].quantity, 2)
    assert.equal(page.orders[1].patientId, 9)
    assert.equal(page.orders[1].remark, '保留本次备注')
    assert.deepEqual(page.payments[0].args, [101])
    if (mode === 'cart') {
      const line = cart.getCartEntries()['10:11']
      assert.equal(line.quantity, 2)
      assert.equal(line.selected, true)
      assert.equal(line.answerId, 92)
    } else assert.deepEqual(cart.getCartEntries(), {})
  })
}

test('普通400或409、快照存储失败和未知创建错误不能被误当作问卷补答', async () => {
  for (const code of [400, 409, 500, undefined]) {
    const page = await confirm({ route: { buyQuantity: '2', buyQuestionnaireId: '90', buyAnswerId: '91' },
      readProduct: async () => product({ needQuestionnaire: 1, questionnaireId: 90 }),
      create: async () => { throw Object.assign(new Error('fixture create failed'), { code }) } })
    await page.submitOrder()
    assert.equal(navigations.length, 0)
    assert.equal(page.directPurchase.value.answerId, 91)
    assert.equal(page.payments.length, 0)
  }
})

test('创建成功后支付抛40910仍保留原订单，不清问卷或引导重新创建', async () => {
  const page = await confirm({ route: { buyQuantity: '2', buyQuestionnaireId: '90', buyAnswerId: '91' },
    readProduct: async () => product({ needQuestionnaire: 1, questionnaireId: 90 }),
    pay: async () => { throw Object.assign(new Error('fixture payment failed'), { code: checkout.QUESTIONNAIRE_RECHECK_REQUIRED }) } })
  await page.submitOrder()
  assert.equal(page.orders.length, 1)
  assert.equal(navigations.length, 0)
  assert.equal(page.directPurchase.value.answerId, 91)
  assert.equal(storage.get(storageKeys.STORAGE_KEY_ORDER_SUBMISSION).orderId, 100)
  assert.equal(modals.at(-1).title, '支付失败')
})

test('切换账号后旧创建请求迟到40910不能清答卷、提示补答或导航', async () => {
  let rejectCreate
  const page = await confirm({ route: { buyQuantity: '2', buyQuestionnaireId: '90', buyAnswerId: '91' },
    readProduct: async () => product({ needQuestionnaire: 1, questionnaireId: 90 }),
    create: () => new Promise((_resolve, reject) => { rejectCreate = reject }) })
  const pending = page.submitOrder()
  await flush()
  assert.equal(typeof rejectCreate, 'function')
  session.beginSession('account-B')
  rejectCreate(Object.assign(new Error('旧账号需补答'), { code: checkout.QUESTIONNAIRE_RECHECK_REQUIRED }))
  await pending
  assert.equal(page.directPurchase.value.answerId, 91)
  assert.equal(messages.length, 0)
  assert.equal(navigations.length, 0)
  assert.equal(page.payments.length, 0)
})

test('弱网丢失创建响应后再次提交相同内容，实际payload沿用requestId', async () => {
  const detail = product({ needQuestionnaire: 1, questionnaireId: 90 })
  await cart.addCartItem(withProductSku(detail, detail.skus[0]), 5, { questionnaireId: 90, answerId: 91 })
  const page = await confirm({ readProduct: async () => detail, create: async (_data, call) => {
    if (call === 1) throw new Error('fixture response lost')
    return { id: 100, payableAmount: 50 }
  } })
  await page.submitOrder()
  assert.equal(page.orders.length, 1)
  assert.match(messages.at(-1).title, /response lost/)
  await page.submitOrder()
  assert.equal(page.orders.length, 2)
  assert.deepEqual(page.orders[1], page.orders[0])
  assert.equal(page.orders[0].questionnaireAnswerId, 91)
  assert.ok(page.orders[0].requestId)
  assert.equal(cart.getCartEntries()['10:11'].quantity, 5)
})

test('订单创建后微信code获取失败保留原订单与幂等标识，可进入原订单续付', async () => {
  await addToCart(2)
  const original = cart.getCartEntries()
  const page = await confirm({ pay: async () => { throw new Error('微信授权码获取失败，请重试') } })

  await page.submitOrder()

  assert.equal(page.orders.length, 1)
  assert.deepEqual(page.payments[0].args, [100])
  assert.equal(storage.get(storageKeys.STORAGE_KEY_ORDER_SUBMISSION).orderId, 100)
  assert.equal(storage.get(storageKeys.STORAGE_KEY_ORDER_SUBMISSION).requestId, page.orders[0].requestId)
  assert.ok(storage.get(storageKeys.STORAGE_KEY_ORDER_CART_SNAPSHOTS)[100])
  assert.equal(modals.at(-1).title, '支付失败')
  assert.equal(modals.at(-1).content, '微信授权码获取失败，请重试')
  modals.at(-1).success()
  assert.equal(redirects.at(-1).url, '/pages/order/order-detail?orderId=100')
  assert.equal(page.orders.length, 1)
  assert.deepEqual(cart.getCartEntries(), original)
})

for (const message of ['用户取消支付', '微信授权码获取失败，请重试']) {
  test(`${message}弹窗显示后卸载确认页，同会话迟到回调不能跳转`, async () => {
    const page = await confirm({ route: { buyQuantity: '2' },
      pay: async () => { throw new Error(message) } })
    await page.submitOrder()
    const modal = modals.at(-1)
    assert.equal(modal.title, message === '用户取消支付' ? '支付已取消' : '支付失败')
    assert.equal(page.orders.length, 1)
    page.unload()
    modal.success()
    assert.equal(redirects.length, 0)
    assert.equal(storage.get(storageKeys.STORAGE_KEY_ORDER_SUBMISSION).orderId, 100, '卸载不丢弃已创建订单')
  })
}

test('重放订单已取消时不支付且释放旧请求，再提交相同内容使用新requestId', async () => {
  await addToCart(5)
  const original = cart.getCartEntries()
  const page = await confirm({ create: async (_data, call) => {
    if (call === 1) throw new Error('fixture response lost')
    return call === 2 ? { id: 100, orderStatus: 4, payStatus: 0 }
      : { id: 101, orderStatus: 0, payStatus: 0, payableAmount: 50 }
  } })
  await page.submitOrder()
  await page.submitOrder()
  assert.equal(page.orders.length, 2)
  assert.equal(page.orders[1].requestId, page.orders[0].requestId)
  assert.equal(page.payments.length, 0)
  assert.equal(messages.at(-1).title, '原订单已取消，请重新提交')
  assert.equal(storage.has(storageKeys.STORAGE_KEY_ORDER_SUBMISSION), false)
  assert.equal(storage.get(storageKeys.STORAGE_KEY_ORDER_CART_SNAPSHOTS)?.[100], undefined)
  assert.deepEqual(cart.getCartEntries(), original)
  await page.submitOrder()
  assert.equal(page.orders.length, 3)
  assert.notEqual(page.orders[2].requestId, page.orders[0].requestId)
  assert.equal(page.payments.length, 1)
  assert.equal(page.payments[0].orderId, 101)
})

test('重放已付款订单跳付款结果且保留receipt清理快照，同页重复点击不再创建，新页面可再次购买', async () => {
  await addToCart(5)
  const original = cart.getCartEntries()
  const page = await confirm({ create: async (_data, call) => {
    if (call === 1) throw new Error('fixture response lost')
    return { id: 100, orderStatus: 1, payStatus: 1, payableAmount: 50 }
  } })
  await page.submitOrder()
  await page.submitOrder()
  assert.equal(page.orders.length, 2)
  assert.equal(page.orders[1].requestId, page.orders[0].requestId)
  assert.equal(page.payments.length, 0)
  assert.equal(redirects.at(-1).url, '/pages/order/payment_success?orderId=100')
  assert.equal(storage.has(storageKeys.STORAGE_KEY_ORDER_SUBMISSION), false)
  assert.ok(storage.get(storageKeys.STORAGE_KEY_ORDER_CART_SNAPSHOTS)?.[100])
  assert.deepEqual(cart.getCartEntries(), original)
  await page.submitOrder()
  assert.equal(page.orders.length, 2)
  assert.equal(page.payments.length, 0)
  assert.equal(redirects.at(-1).url, '/pages/order/payment_success?orderId=100')
  const nextPage = await confirm({ create: async () => ({ id: 101, orderStatus: 0, payStatus: 0, payableAmount: 50 }) })
  await nextPage.submitOrder()
  assert.equal(nextPage.orders.length, 1)
  assert.notEqual(nextPage.orders[0].requestId, page.orders[0].requestId)
  assert.equal(nextPage.payments.length, 1)
  assert.equal(nextPage.payments[0].orderId, 101)
})
