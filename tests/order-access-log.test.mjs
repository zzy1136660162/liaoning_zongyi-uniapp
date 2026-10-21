import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadOptions, loadSetup } from './sfc-harness.mjs'
import { getActionFailureResult } from '../utils/accessLog.js'

const quiet = { debug() {}, info() {}, warn() {}, error() {} }
const pendingOrder = () => ({ id: 81, orderStatus: 0, payStatus: 0, orderType: 1, payableAmount: 12, items: [] })
const logger = (events) => ({
  logPageView: data => events.push({ kind: 'PAGE_VIEW', ...data }),
  logButtonClick: data => events.push({ kind: 'BUTTON_CLICK', ...data }),
  logAccess: data => events.push({ kind: data.actionType, ...data })
})
const assertMetadata = (events) => {
  for (const event of events) {
    for (const field of ['moduleCode', 'accessType', 'pageType', 'actionCode', 'accessTitle', 'accessDescription']) {
      assert.ok(typeof event[field] === 'string' && event[field].length > 0, `${event.actionCode}: ${field}`)
    }
    assert.ok(event.requestUri.startsWith('/pages/'))
  }
}

function createList(overrides = {}) {
  const events = [], modals = [], navigation = []
  let load, show
  const state = loadSetup('pages/order/order_list.vue', {
    ref: value => ({ value }), onLoad: callback => { load = callback },
    onShow: callback => { show = callback }, onMounted() {}, onUnmounted() {},
    getSessionGeneration: () => 1, isCurrentSession: value => value === 1,
    onSessionChanged: () => () => {},
    getOrderPage: async () => ({ rows: [], total: 0, pageNum: 1, hasMore: false }),
    cancelOrder: async () => {}, confirmReceipt: async () => {}, getActionFailureResult,
    ...logger(events), console: quiet,
    uni: { showLoading() {}, hideLoading() {}, showToast() {},
      showModal: options => modals.push(options), navigateTo: options => navigation.push(options) },
    ...overrides
  }, ['activeTab', 'handlePayOrder', 'handleCancelOrder', 'handleConfirmReceipt'])
  return { state, load, show, events, modals, navigation }
}

test('订单页快速返回分别记页面访问，去支付只记一个按钮且列表ID保持空', async () => {
  const { state, load, show, events, navigation } = createList()
  load({ status: 'pending' })
  show(); show()
  const views = events.filter(event => event.kind === 'PAGE_VIEW')
  assert.equal(views.length, 2)
  assert.ok(views.every(event => event.pageId === '' && event.extraData.statusFilter === 'pending'))
  state.handlePayOrder(pendingOrder())
  const buttons = events.filter(event => event.kind === 'BUTTON_CLICK')
  assert.deepEqual(buttons.map(event => event.actionCode), ['ORDER_PAY_OPEN'])
  assert.equal(buttons[0].pageId, '')
  assert.equal(buttons[0].extraData.orderId, 81)
  assert.equal(navigation[0].url, '/pages/order/order-detail?orderId=81')
  assertMetadata(events)
})

test('取消订单区分弹窗取消、明确拒绝与网络结果未知，不记录原始错误', async () => {
  for (const [error, expected] of [[null, 'CANCELLED'], [{ code: 409, message: 'PRIVATE-BODY' }, 'FAILED'], [{ errMsg: 'request:fail timeout PRIVATE-BODY' }, 'UNKNOWN']]) {
    const { state, events, modals } = createList({ cancelOrder: async () => { throw error } })
    await state.handleCancelOrder(81)
    await modals[0].success({ confirm: !!error })
    const results = events.filter(event => event.actionCode === 'ORDER_CANCEL_RESULT')
    assert.equal(results.length, 1)
    assert.equal(results[0].actionResult, expected)
    assert.equal(JSON.stringify(events).includes('PRIVATE-BODY'), false)
    assertMetadata(events)
  }
})

function createLogistics(overrides = {}) {
  const events = [], submissions = []
  let generation = 1
  const definition = loadOptions('pages/order/refund_logistics.vue', {
    getSessionGeneration: () => generation, isCurrentSession: value => value === generation,
    getActionFailureResult, ...logger(events), console: quiet, setTimeout() {},
    submitReturnLogistics: async (id, data) => submissions.push({ id, data }),
    uni: { showLoading() {}, hideLoading() {}, showToast() {}, redirectTo() {} }, ...overrides
  })
  const state = { ...definition.data(), ...definition.methods,
    refundApplicationId: 31, refundDetail: { status: 1, paymentRefundStatus: 'PENDING' },
    form: { logisticsCompany: '顺丰速运', logisticsNo: 'PRIVATE-TRACKING-NUMBER', returnTime: '2026-01-01' } }
  for (const [key, getter] of Object.entries(definition.computed || {})) Object.defineProperty(state, key, { get: () => getter.call(state) })
  return { state, events, submissions, changeSession: () => { generation++ } }
}

test('历史物流入口仅查看退款进度，不再提交物流或记录私密单号', () => {
  const { state, events, submissions } = createLogistics()
  state.viewRefundDetail()
  assert.equal(submissions.length, 0)
  assert.equal(events.find(event => event.actionCode === 'REFUND_DETAIL_OPEN').kind, 'BUTTON_CLICK')
  assert.equal(JSON.stringify(events).includes('PRIVATE-TRACKING-NUMBER'), false)
  assert.ok(events.every(event => event.pageId === 31))
  assertMetadata(events)
})

test('账号变化后历史物流入口不读取前账号退款记录', () => {
  const navigation = []
  const { state, events, changeSession } = createLogistics({ uni: { redirectTo: target => navigation.push(target) } })
  changeSession()
  state.viewRefundDetail()
  assert.deepEqual(navigation, [])
  assert.deepEqual(events, [])
})

test('支付SDK提交成功只记待确认，明确用户取消独立记录且不带支付参数', async () => {
  for (const cancelled of [false, true]) {
    const events = []
    const definition = loadOptions('pages/order/order-detail.vue', {
      getSessionGeneration: () => 1, isCurrentSession: value => value === 1, assertCurrentSession() {},
      getOrderDetail: async () => pendingOrder(), getActionFailureResult,
      wechatSinglePay: async () => { if (cancelled) throw new Error('用户取消支付'); return { outTradeNo: 'PRIVATE-TRADE-NUMBER' } },
      ...logger(events), console: quiet,
      uni: { showToast() {}, redirectTo() {} }
    })
    const state = { ...definition.data(), ...definition.methods, order: pendingOrder(), orderLoaded: true }
    for (const [key, getter] of Object.entries(definition.computed)) Object.defineProperty(state, key, { get: () => getter.call(state) })
    await state.handlePayOrder()
    const result = events.find(event => event.actionCode === 'ORDER_PAYMENT_CLIENT_RESULT')
    assert.equal(result.actionResult, cancelled ? 'CANCELLED' : 'UNKNOWN')
    assert.equal(JSON.stringify(events).includes('PRIVATE-TRADE-NUMBER'), false)
    assertMetadata(events)
  }
})
