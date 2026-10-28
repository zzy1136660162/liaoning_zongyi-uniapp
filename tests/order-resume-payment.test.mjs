import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { canPayOrder, getOrderStatusText } from '../utils/order-status.js'
import { buildItemRedeemVouchers } from '../utils/order-redeem-vouchers.js'
import { loadOptions, loadSetup } from './sfc-harness.mjs'

// 与真实业务接口的待付款疗法订单字段一致，不包含身份或支付凭证。
const pendingOrder = () => ({
  id: 205, orderNo: 'fixture-order', orderType: 4, orderStatus: 0, payStatus: 0,
  paymentFulfillmentStatus: null, refundStatus: null, payableAmount: 0.01,
  items: [{ id: 1, productId: 82, skuId: 66, productName: '测试商品', price: 0.01, quantity: 1 }]
})

const createDetail = (extra = {}) => {
  const calls = { pay: [], redirects: [], toasts: [], modals: [] }
  let generation = 1
  const options = loadOptions('pages/order/order-detail.vue', {
    canPayOrder, getOrderStatusText, buildItemRedeemVouchers,
    getSessionGeneration: () => generation,
    isCurrentSession: value => value === generation,
    assertCurrentSession: value => { if (value !== generation) throw Object.assign(new Error('changed'), { code: 'SESSION_CHANGED' }) },
    getOrderDetail: async () => pendingOrder(),
    wechatSinglePay: async id => { calls.pay.push(id); return { outTradeNo: 'fixture-trade' } },
    logButtonClick() {}, getImageUrl: value => value,
    uni: { showLoading() {}, hideLoading() {}, showToast: value => calls.toasts.push(value), showModal: value => calls.modals.push(value), redirectTo: value => calls.redirects.push(value) },
    console: { debug() {}, error() {}, warn() {} },
    ...extra
  })
  const page = { ...options.data(), ...options.methods }
  page.needsProductEnrichment = () => false
  page.needsPrescriptionEnrichment = () => false
  for (const [name, getter] of Object.entries(options.computed)) Object.defineProperty(page, name, { get: () => getter.call(page) })
  return { page, calls, options, changeSession: () => { generation++ } }
}

test('待付款疗法/普通订单及字符串状态均可续付，缺失状态不能推断为待付款', () => {
  assert.equal(canPayOrder(pendingOrder()), true)
  assert.equal(canPayOrder({ id: 1, status: '0', pay_status: '0', order_type: 1 }), true)
  for (const order of [{}, { id: 1 }, { ...pendingOrder(), payStatus: null }, { ...pendingOrder(), id: null }]) {
    assert.equal(canPayOrder(order), false)
  }
})

test('已付款、取消、退款及付款确认中的订单不提供续付入口', () => {
  for (const extra of [
    { payStatus: 1 }, { orderStatus: 4 }, { orderStatus: 1 }, { orderStatus: 5 },
    { refundStatus: 1 }, { refundApplicationId: 7 },
    ...['PENDING', 'READY', 'REFUND_REQUIRED', 'REFUNDED'].map(paymentFulfillmentStatus => ({ paymentFulfillmentStatus }))
  ]) assert.equal(canPayOrder({ ...pendingOrder(), ...extra }), false)
})

test('详情页真实接口加载后显示支付按钮，续付原订单并进入服务端确认页面', async () => {
  const { page, calls } = createDetail()
  assert.equal(page.canPay, false)
  await page.loadOrderDetail(205)
  assert.equal(page.canPay, true)
  await page.handlePayOrder()
  assert.deepEqual(calls.pay, [205])
  assert.equal(calls.redirects.length, 1)
  const url = new URL(calls.redirects[0].url, 'https://fixture.test')
  assert.equal(url.pathname, '/pages/order/payment_success')
  assert.equal(url.searchParams.get('orderId'), '205')
  assert.equal(url.searchParams.get('outTradeNo'), 'fixture-trade')
  assert.equal(page.paying, false)
  const template = readFileSync(new URL('../pages/order/order-detail.vue', import.meta.url), 'utf8').split('<script>')[0]
  assert.match(template, /v-if="canPay"[\s\S]*?@tap="handlePayOrder"/)
})

test('支付前状态已变更会刷新详情，不再调起支付', async () => {
  let detail = pendingOrder()
  const { page, calls } = createDetail({ getOrderDetail: async () => detail })
  await page.loadOrderDetail(205)
  detail = { ...pendingOrder(), payStatus: 1, orderStatus: 1, paymentFulfillmentStatus: 'READY' }
  await page.handlePayOrder()
  assert.deepEqual(calls.pay, [])
  assert.equal(page.canPay, false)
  assert.deepEqual(calls.redirects, [])
})

test('重复点击只发起一次支付，取消付款后允许重试且不进入成功页', async () => {
  let rejectPayment, count = 0
  const { page, calls } = createDetail({ wechatSinglePay: () => {
    count++
    return new Promise((resolve, reject) => { rejectPayment = reject })
  } })
  await page.loadOrderDetail(205)
  const first = page.handlePayOrder()
  await Promise.resolve()
  await page.handlePayOrder()
  assert.equal(count, 1)
  rejectPayment(new Error('用户取消支付'))
  await first
  assert.equal(page.paying, false)
  assert.equal(page.canPay, true)
  assert.deepEqual(calls.redirects, [])
})

test('续付前置校验失败完整显示顺丰错误，不跳转支付成功页', async () => {
  const message = 'B9999：下运单失败；BSP下运单失败:收方地址不详细，请填写更为详细的地址后重新下单'
  const { page, calls } = createDetail({ wechatSinglePay: async () => { throw { code: 500, message } } })
  await page.loadOrderDetail(205)
  await page.handlePayOrder()
  assert.equal(calls.modals.length, 1)
  assert.equal(calls.modals[0].content, message)
  assert.equal(calls.modals[0].showCancel, false)
  assert.deepEqual(calls.redirects, [])
  assert.equal(page.paying, false)
})

test('支付期间账号变化或页面关闭后不继续付款或跳转', async () => {
  for (const invalidate of ['session', 'unload']) {
    let resolveDetail
    const { page } = createDetail()
    await page.loadOrderDetail(205)
    // 用第二个页面实例注入延迟读取，仍执行页面本身的方法。
    const delayed = createDetail({ getOrderDetail: () => new Promise(resolve => { resolveDetail = resolve }) })
    delayed.page.order = { ...page.order }
    delayed.page.orderLoaded = true
    const pending = delayed.page.handlePayOrder()
    if (invalidate === 'session') delayed.changeSession()
    else delayed.options.onUnload.call(delayed.page)
    resolveDetail(pendingOrder())
    await pending
    assert.deepEqual(delayed.calls.pay, [])
    assert.deepEqual(delayed.calls.redirects, [])
  }
})

test('列表的去支付跳转同一订单详情，已付款订单不会跳转', () => {
  const navigations = []
  const list = loadSetup('pages/order/order_list.vue', {
    ref: value => ({ value }), onLoad() {}, onUnmounted() {}, onShow() {},
    canPayOrder, logButtonClick() {},
    uni: { navigateTo: options => navigations.push(options) }
  }, ['handlePayOrder', 'mapOrderListItem'])
  list.handlePayOrder(list.mapOrderListItem(pendingOrder()))
  list.handlePayOrder(list.mapOrderListItem({ ...pendingOrder(), payStatus: 1 }))
  assert.equal(navigations.length, 1)
  assert.equal(navigations[0].url, '/pages/order/order-detail?orderId=205')
  const template = readFileSync(new URL('../pages/order/order_list.vue', import.meta.url), 'utf8').split('<script setup>')[0].replace(/<!--[\s\S]*?-->/g, '')
  assert.match(template, /v-if="canPayOrder\(order\)"[\s\S]*?@click.stop="handlePayOrder\(order\)"/)
})
