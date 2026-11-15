import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { getPaymentOutcome } from '../utils/order-status.js'
import { isTherapyOrder } from '../utils/therapy.js'
import { loadSetup } from './sfc-harness.mjs'

beforeEach(t => t.mock.timers.enable({ apis: ['setTimeout'] }))
afterEach(t => t.mock.timers.reset())

const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const order = (fulfillment = 'PENDING', amount = '36.60') => ({
  id: 81, orderNo: 'SYNTHETIC-81', orderStatus: fulfillment === 'READY' ? 1 : 0,
  payStatus: 1, paymentFulfillmentStatus: fulfillment,
  paidAmount: amount, payableAmount: amount, totalAmount: amount, items: []
})

const createPage = (overrides = {}) => {
  let load, show, hide, unload
  const consumed = [], syncs = [], navigations = []
  const page = loadSetup('pages/order/payment_success.vue', {
    ref: value => ({ value }),
    onLoad: callback => { load = callback }, onShow: callback => { show = callback },
    onHide: callback => { hide = callback }, onUnload: callback => { unload = callback },
    getSessionGeneration: () => 1, assertCurrentSession() {}, isCurrentSession: () => true,
    getPaymentOutcome, isTherapyOrder,
    getOrderDetail: async () => order('READY'),
    syncPaymentByOrder: async (...args) => { syncs.push(args); return true },
    consumeOrderCart: async id => { consumed.push(id); return true },
    dayjs: value => ({ format: () => value }),
    uni: { redirectTo: route => navigations.push(route), setClipboardData() {}, showToast() {} },
    logPageView() {}, logButtonClick() {}, logAccess() {},
    console: { debug() {}, warn() {}, error() {} },
    ...overrides
  }, ['paymentInfo', 'paymentOutcome', 'loading', 'syncing', 'canRefresh', 'queryMessage',
    'refreshOrderInfo', 'goToOrder', 'applyOrderData'])
  return { page, load, show, hide, unload, consumed, syncs, navigations }
}

const finishPolling = async t => {
  await flush()
  for (let i = 0; i < 11; i++) {
    t.mock.timers.tick(1500)
    await flush()
  }
}

test('首次订单读取成功即展示金额，轮询和连续点击不会重复启动查询', async () => {
  let reads = 0
  const next = deferred()
  const fixture = createPage({ getOrderDetail: async () => ++reads === 1 ? order() : next.promise })
  const loading = fixture.load({ orderId: '81' })
  fixture.show()
  await flush()
  assert.equal(reads, 2)
  assert.equal(fixture.page.paymentInfo.value.hasOrder, true)
  assert.equal(fixture.page.paymentInfo.value.amount, 36.6)
  assert.equal(fixture.page.loading.value, false)
  assert.equal(fixture.page.syncing.value, true)
  assert.equal(fixture.page.paymentOutcome.value.state, 'pending')
  await Promise.all([fixture.page.refreshOrderInfo(), fixture.page.refreshOrderInfo()])
  assert.equal(reads, 2)
  next.resolve(order('READY'))
  await loading
  assert.equal(fixture.page.syncing.value, false)
  assert.equal(fixture.page.paymentOutcome.value.state, 'success')
  assert.deepEqual(fixture.consumed, [81])
})

test('有限轮询结束说明仍需等待，重新查询只读取状态而不重放支付补偿', async t => {
  let reads = 0, ready = false
  const fixture = createPage({ getOrderDetail: async () => { reads++; return order(ready ? 'READY' : 'PENDING') } })
  const initial = fixture.load({ orderId: '81', outTradeNo: 'SYNTHETIC-PAY-81' })
  await finishPolling(t)
  await initial
  assert.equal(reads, 14)
  assert.deepEqual(fixture.syncs, [['81', 'SYNTHETIC-PAY-81']])
  assert.equal(fixture.page.syncing.value, false)
  assert.equal(fixture.page.canRefresh.value, true)
  assert.equal(fixture.page.paymentOutcome.value.state, 'pending')
  assert.match(fixture.page.queryMessage.value, /请勿重复付款.*重新查询/)
  assert.deepEqual(fixture.consumed, [])

  const refresh = fixture.page.refreshOrderInfo()
  await finishPolling(t)
  await refresh
  assert.equal(reads, 27)
  assert.equal(fixture.syncs.length, 1, '手动刷新不重放首次补偿')
  ready = true
  await fixture.page.refreshOrderInfo()
  assert.equal(fixture.page.paymentOutcome.value.state, 'success')
  assert.equal(fixture.page.queryMessage.value, '')
  assert.deepEqual(fixture.consumed, [81])
})

test('隐藏后返回重新读取，旧响应及旧查询清理不能覆盖最新结果', async () => {
  const old = deferred(), fresh = deferred()
  let reads = 0
  const fixture = createPage({ getOrderDetail: () => ++reads === 1 ? old.promise : fresh.promise })
  const initial = fixture.load({ orderId: '81', outTradeNo: 'SYNTHETIC-PAY-81' })
  fixture.show()
  fixture.hide()
  const returning = fixture.show()
  assert.equal(reads, 2)
  old.resolve(order('PENDING', '1.00'))
  await initial
  assert.equal(fixture.page.paymentInfo.value.hasOrder, false)
  assert.equal(fixture.page.syncing.value, true, '旧请求结束不关闭返回后的查询状态')
  fresh.resolve(order('READY', '75.60'))
  await returning
  assert.equal(fixture.page.paymentInfo.value.amount, 75.6)
  assert.equal(fixture.page.paymentOutcome.value.state, 'success')
  assert.equal(fixture.page.syncing.value, false)
  assert.deepEqual(fixture.syncs, [])
  assert.deepEqual(fixture.consumed, [81])
})

test('离页取消轮询等待，迟到回执不更新页面、不继续查询或导航', async t => {
  let reads = 0
  const fixture = createPage({ getOrderDetail: async () => { reads++; return order() } })
  const initial = fixture.load({ orderId: '81', outTradeNo: 'SYNTHETIC-PAY-81' })
  await flush()
  assert.equal(reads, 2)
  fixture.unload()
  await initial
  t.mock.timers.tick(30000)
  await flush()
  fixture.show()
  fixture.page.goToOrder()
  await fixture.page.applyOrderData(order('READY', '99.00'))
  assert.equal(reads, 2)
  assert.equal(fixture.page.paymentInfo.value.amount, 36.6)
  assert.equal(fixture.page.paymentOutcome.value.state, 'pending')
  assert.deepEqual(fixture.syncs, [])
  assert.deepEqual(fixture.consumed, [])
  assert.deepEqual(fixture.navigations, [])
})

test('会话切换后旧请求不展示账户数据、不继续补偿或接受刷新', async () => {
  let current = true, reads = 0
  const response = deferred()
  const fixture = createPage({
    isCurrentSession: () => current,
    assertCurrentSession: () => { if (!current) throw Object.assign(new Error('fixture-session-changed'), { code: 'SESSION_CHANGED' }) },
    getOrderDetail: () => { reads++; return response.promise }
  })
  const initial = fixture.load({ orderId: '81', outTradeNo: 'SYNTHETIC-PAY-81' })
  current = false
  response.resolve(order('READY'))
  await initial
  await fixture.page.refreshOrderInfo()
  fixture.page.goToOrder()
  assert.equal(reads, 1)
  assert.equal(fixture.page.paymentInfo.value.hasOrder, false)
  assert.deepEqual(fixture.syncs, [])
  assert.deepEqual(fixture.consumed, [])
  assert.deepEqual(fixture.navigations, [])
})

test('读取失败保留上次订单与金额，并能明确重试；首次失败也可恢复', async () => {
  let fail = false
  const fixture = createPage({ getOrderDetail: async () => {
    if (fail) throw new Error('fixture-network-failed')
    return order('READY')
  } })
  await fixture.load({ orderId: '81' })
  fail = true
  await fixture.page.refreshOrderInfo()
  assert.equal(fixture.page.paymentInfo.value.amount, 36.6)
  assert.equal(fixture.page.paymentOutcome.value.state, 'success')
  assert.match(fixture.page.queryMessage.value, /已保留上次查询结果/)
  assert.equal(fixture.page.syncing.value, false)

  const firstFailed = createPage({ getOrderDetail: async () => {
    if (fail) throw new Error('fixture-network-failed')
    return order('READY')
  } })
  await firstFailed.load({ orderId: '81' })
  assert.equal(firstFailed.page.canRefresh.value, true)
  assert.equal(firstFailed.page.paymentInfo.value.hasOrder, false)
  assert.equal(firstFailed.page.loading.value, false)
  assert.equal(firstFailed.page.paymentOutcome.value.state, 'unknown')
  assert.match(firstFailed.page.queryMessage.value, /读取失败.*重新查询/)
  fail = false
  await firstFailed.page.refreshOrderInfo()
  assert.equal(firstFailed.page.paymentOutcome.value.state, 'success')
  assert.equal(firstFailed.page.queryMessage.value, '')
})

test('退款与异常终态沿用服务端判断，不伪装成功或继续轮询', async () => {
  for (const state of ['REFUND_REQUIRED', 'REFUNDED']) {
    let reads = 0
    const fixture = createPage({ getOrderDetail: async () => { reads++; return order(state) } })
    await fixture.load({ orderId: '81', outTradeNo: 'SYNTHETIC-PAY-81' })
    assert.equal(reads, 1)
    assert.notEqual(fixture.page.paymentOutcome.value.state, 'success')
    assert.equal(fixture.page.paymentOutcome.value.terminal, true)
    assert.deepEqual(fixture.syncs, [])
    assert.deepEqual(fixture.consumed, [])
  }
})

test('实际模板的金额不等待整轮查询，重试按钮禁用重复操作并连接查询入口', () => {
  const source = readFileSync(new URL('../pages/order/payment_success.vue', import.meta.url), 'utf8')
  assert.match(source, /v-if="paymentInfo\.hasOrder"\s+class="amount-main"/)
  assert.match(source, /:disabled="syncing"\s+@click="refreshOrderInfo"/)
  assert.match(source, /canRefresh && \(!paymentOutcome\.terminal \|\| paymentOutcome\.manualRefresh \|\| queryMessage\)/)
})

test('真实已付但医院拒绝或结果未知时显示待完成及原因，不自动轮询、补发或清理购物车', async t => {
  for (const status of ['FAILED', 'UNKNOWN', 'RUNNING', 'PENDING']) {
    let reads = 0, hospitalReads = 0
    const fixture = createPage({
      getOrderDetail: async () => { reads++; return order('READY') },
      getPaymentStatusByOrder: async id => { hospitalReads++; assert.equal(String(id), '81');
        return { orderId: 81, lifecycleStatus: 'PAID', hisPaymentStatus: status, hisMessage: '医院收款登记暂未完成，请联系后台。' } }
    })
    await fixture.load({ orderId: '81', outTradeNo: 'SYNTHETIC-PAY-81' })
    assert.equal(fixture.page.paymentOutcome.value.state, 'hospital_pending')
    assert.equal(fixture.page.paymentOutcome.value.title, '已付款，医院处理待完成')
    assert.match(fixture.page.paymentInfo.value.primaryTip, /医院收款登记暂未完成.*请勿重复付款/)
    assert.equal(fixture.page.paymentInfo.value.amount, 36.6)
    assert.equal(fixture.page.paymentInfo.value.orderStatusLabel, '医院处理待完成')
    assert.equal(fixture.page.paymentOutcome.value.manualRefresh, true)
    assert.equal(fixture.page.canRefresh.value, true)
    t.mock.timers.tick(30000); await flush()
    assert.equal(reads, 1); assert.equal(hospitalReads, 1)
    assert.deepEqual(fixture.syncs, []); assert.deepEqual(fixture.consumed, [])
    fixture.unload()
  }
})

test('读取医院状态期间先展示实付金额和待确认，手动只读刷新成功后才确认履约', async () => {
  const pendingStatus = deferred()
  let reads = 0, hospitalReads = 0
  const fixture = createPage({
    getOrderDetail: async () => { reads++; return { ...order('READY'), hisOrderNo: 'SYNTHETIC-HIS-81' } },
    getPaymentStatusByOrder: () => ++hospitalReads === 1 ? pendingStatus.promise
      : Promise.resolve({ orderId: 81, hisPaymentStatus: 'SUCCESS' })
  })
  const loading = fixture.load({ orderId: '81' })
  await flush()
  assert.equal(fixture.page.paymentInfo.value.hasOrder, true)
  assert.equal(fixture.page.paymentInfo.value.amount, 36.6)
  assert.equal(fixture.page.paymentOutcome.value.title, '已付款，医院处理状态待确认')
  assert.deepEqual(fixture.consumed, [])
  pendingStatus.resolve({ orderId: 81, hisPaymentStatus: 'FAILED', hisMessage: '医院暂无法登记收款' })
  await loading
  assert.equal(fixture.page.paymentOutcome.value.state, 'hospital_pending')
  await fixture.page.refreshOrderInfo()
  assert.equal(fixture.page.paymentOutcome.value.state, 'success')
  assert.equal(reads, 2); assert.equal(hospitalReads, 2)
  assert.deepEqual(fixture.syncs, []); assert.deepEqual(fixture.consumed, [81])
})

test('医院状态查询失败或返回其他订单时保留已付款待确认，不展示错误订单信息', async () => {
  for (const otherOrder of [false, true]) {
    const fixture = createPage({
      getOrderDetail: async () => ({ ...order('READY'), hisOrderNo: 'SYNTHETIC-HIS-81' }),
      getPaymentStatusByOrder: async () => {
        if (!otherOrder) throw new Error('PRIVATE-TRANSPORT-ERROR')
        return { orderId: 999, hisPaymentStatus: 'SUCCESS', hisMessage: 'PRIVATE-OTHER-ORDER' }
      }
    })
    await fixture.load({ orderId: '81' })
    assert.equal(fixture.page.paymentOutcome.value.title, '已付款，医院处理状态待确认')
    assert.equal(fixture.page.paymentInfo.value.amount, 36.6)
    assert.match(fixture.page.paymentInfo.value.primaryTip, /暂无法读取.*请勿重复付款/)
    assert.equal(fixture.page.paymentInfo.value.primaryTip.includes('PRIVATE-'), false)
    assert.deepEqual(fixture.consumed, [])
  }
})

test('纯商城SKIPPED和缺新增字段的旧支付响应保持既有成功展示', async () => {
  for (const summary of [{ orderId: 81, hisPaymentStatus: 'SKIPPED' }, { orderId: 81, lifecycleStatus: 'PAID' }]) {
    const fixture = createPage({ getPaymentStatusByOrder: async () => summary })
    await fixture.load({ orderId: '81' })
    assert.equal(fixture.page.paymentOutcome.value.state, 'success')
    assert.deepEqual(fixture.consumed, [81])
  }
})
