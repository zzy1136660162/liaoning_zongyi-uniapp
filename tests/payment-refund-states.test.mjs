import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPaymentOutcome, getOrderStatusText, getRedeemStatusText, canShowRedeemCode } from '../utils/order-status.js'
import { createRefundRequestId, getPaymentRefundStatusText, hasMixedTherapyAndNormalRefundItems, resolveRefundType } from '../utils/refund.js'
import { loadSetup, loadOptions } from './sfc-harness.mjs'

test('部分退款期间其余可用券保留，冻结/核销/退废券不能展示二维码', () => {
  for (const orderStatus of [1, 5, 6, 7]) {
    const order = { orderStatus, payStatus: 1, paymentFulfillmentStatus: 'READY' }
    assert.equal(canShowRedeemCode(order, { redeemStatus: 0 }), true)
    for (const redeemStatus of [1, 2, 3]) assert.equal(canShowRedeemCode(order, { redeemStatus }), false)
  }
  assert.equal(getRedeemStatusText({ redeemStatus: 3 }), '退款处理中')
})

test('已取消终态、付款处理中及异常退款不显示履约成功或核销码', () => {
  for (const paymentFulfillmentStatus of ['PENDING', 'REFUND_REQUIRED', 'REFUNDED']) {
    const order = { payStatus: 1, orderStatus: 1, paymentFulfillmentStatus }
    assert.notEqual(getPaymentOutcome(order).state, 'success')
    assert.notEqual(getOrderStatusText(order), '待发货')
    assert.equal(canShowRedeemCode(order, { redeemStatus: 0 }), false)
    const canceled = { ...order, orderStatus: 4 }
    assert.match(getOrderStatusText(canceled), /已取消/)
    assert.equal(canShowRedeemCode(canceled, { redeemStatus: 0 }), false)
  }
  assert.equal(getPaymentOutcome({ orderStatus: 4, payStatus: 0 }).state, 'canceled')
  assert.equal(getPaymentOutcome({ orderStatus: 1, payStatus: 0 }).state, 'pending')
  assert.equal(getPaymentOutcome({ orderStatus: 1, payStatus: 1 }).state, 'success')
  assert.equal(getPaymentOutcome({ orderStatus: 1, payStatus: 1, paymentFulfillmentStatus: 'READY' }).state, 'success')
})

test('支付页面只在服务端确认可履约后清理当前已付订单商品及SKU', () => {
  const removed = []
  const mocks = {
    ref: value => ({ value }), onLoad() {}, onUnload() {}, getSessionGeneration: () => 0, assertCurrentSession() {},
    getPaymentOutcome, ORDER_TYPE_THERAPY: 4,
    dayjs: value => ({ format: () => String(value) }),
    buildCartItemKey: (id, sku) => sku ? `${id}:${sku}` : String(id),
    removeFromCart: ids => { removed.push(ids); return true }, uni: { $emit() {} }
  }
  const page = loadSetup('pages/order/payment_success.vue', mocks, ['applyOrderData', 'paymentOutcome'])
  assert.equal(page.paymentOutcome.value.state, 'pending')
  const order = { orderStatus: 1, payStatus: 1, items: [{ productId: 11, skuId: 21, quantity: 2 }] }
  page.applyOrderData({ ...order, paymentFulfillmentStatus: 'PENDING' })
  assert.deepEqual(removed, [])
  page.applyOrderData({ ...order, paymentFulfillmentStatus: 'REFUND_REQUIRED' })
  assert.deepEqual(removed, [])
  page.applyOrderData({ ...order, paymentFulfillmentStatus: 'READY' })
  assert.deepEqual(removed, [['11:21']])
  assert.equal(page.paymentOutcome.value.state, 'success')
})

test('退款渠道处理中、结果未知及失败不会被标成已到账', () => {
  assert.equal(getPaymentRefundStatusText('UNKNOWN'), '退款结果确认中')
  assert.equal(getPaymentRefundStatusText('PROCESSING'), '退款处理中')
  assert.equal(getPaymentRefundStatusText('SUCCESS'), '退款完成')
  assert.notEqual(getPaymentRefundStatusText('FAILED'), '退款完成')
  const ids = new Set(Array.from({ length: 50 }, createRefundRequestId))
  assert.equal(ids.size, 50)
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('同一退款表单在网络失败重试时沿用requestId，成功后阻止重复提交', async () => {
  const submitted = []
  const options = loadOptions('pages/order/refund_apply.vue', {
    createRefundRequestId, resolveRefundType, hasMixedTherapyAndNormalRefundItems,
    getSessionGeneration: () => 0, assertCurrentSession() {}, isCurrentSession: () => true,
    logButtonClick() {}, setTimeout() {},
    console: { error() {} },
    uni: { showToast() {}, showLoading() {}, hideLoading() {} },
    applyRefund: async data => {
      submitted.push(data)
      if (submitted.length === 1) throw new Error('network-response-lost')
    }
  })
  const page = { ...options.data(), ...options.methods }
  page.orderId = 9
  page.allProducts = [{ id: 10, price: 3, quantity: 2, selectedQuantity: 1 }]
  page.form.refundReason = 'fixture'
  for (const [name, getter] of Object.entries(options.computed)) Object.defineProperty(page, name, { get: () => getter.call(page) })
  await page.submitRefund()
  assert.equal(page.submitted, false)
  await page.submitRefund()
  assert.equal(submitted.length, 2)
  assert.equal(submitted[0].requestId, submitted[1].requestId)
  assert.equal(submitted[1].refundType, 2)
  assert.equal(page.submitted, true)
  await page.submitRefund()
  assert.equal(submitted.length, 2)
})
