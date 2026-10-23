import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { loadOptions, loadSetup } from './sfc-harness.mjs'
import { isTherapyOrder, hasTherapyEntitlement } from '../utils/therapy.js'
import { getOrderStatusText, getRedeemStatusText, canShowRedeemCode } from '../utils/order-status.js'
import { buildItemRedeemVouchers } from '../utils/order-redeem-vouchers.js'

const createPages = (order = {}) => {
  const calls = { copies: [], toasts: [], navigation: [] }
  const uni = {
    setClipboardData: options => calls.copies.push(options),
    showToast: options => calls.toasts.push(options),
    navigateTo: options => calls.navigation.push(options),
    showLoading() {}, hideLoading() {}
  }
  const list = loadSetup('pages/order/order_list.vue', {
    ref: value => ({ value }), onLoad() {}, onUnmounted() {}, onShow() {},
    hasTherapyEntitlement, isTherapyOrder, getRedeemStatusText, uni
  }, ['copyOrderNo', 'hasRedeemEntitlement', 'redeemSummaryText', 'mapOrderListItem'])
  const definition = loadOptions('pages/order/order-detail.vue', {
    getOrderDetail: async () => order, getOrderStatusText, canShowRedeemCode,
    buildItemRedeemVouchers, hasTherapyEntitlement, isTherapyOrder,
    getImageUrl: value => value, uni,
    console: { debug() {}, warn() {}, error() {} }
  })
  const detail = { ...definition.data(), ...definition.methods }
  detail.needsProductEnrichment = () => false
  detail.needsPrescriptionEnrichment = () => false
  for (const [name, getter] of Object.entries(definition.computed)) {
    Object.defineProperty(detail, name, { get: () => getter.call(detail) })
  }
  return { list, detail, calls }
}

test('列表和详情复制完整订单号，保留前导零且不触发导航', () => {
  const { list, detail, calls } = createPages()
  const orderNo = '0000123456789012345678901234567890'
  list.copyOrderNo(orderNo)
  detail.order.orderNo = orderNo
  detail.copyOrderNo()
  assert.deepEqual(calls.copies.map(copy => copy.data), [orderNo, orderNo])
  assert.deepEqual(calls.navigation, [])
  assert.deepEqual(calls.toasts, [], '复制成功使用平台默认提示，不叠加成功弹窗')
  for (const [path, handler] of [
    ['pages/order/order_list.vue', 'copyOrderNo(order.orderNo)'],
    ['pages/order/order-detail.vue', 'copyOrderNo']
  ]) {
    const template = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').split('<script')[0]
    assert.ok(template.includes(`@click.stop="${handler}"`), '复制入口阻止冒泡到订单卡片')
  }
})

test('空订单号不写剪贴板，复制失败明确提示且不进入订单', () => {
  const { list, detail, calls } = createPages()
  for (const value of [null, undefined, '', '   ']) {
    list.copyOrderNo(value)
    detail.order.orderNo = value
    detail.copyOrderNo()
  }
  assert.equal(calls.copies.length, 0)
  list.copyOrderNo('订单A')
  detail.order.orderNo = '订单B'
  detail.copyOrderNo()
  calls.copies.forEach(copy => copy.fail())
  assert.deepEqual(calls.toasts.map(toast => toast.title), ['复制失败，请重试', '复制失败，请重试'])
  assert.deepEqual(calls.navigation, [])
})

test('纯实物没有购买核销资格和真实券时，不显示默认待核销摘要', () => {
  const { list } = createPages()
  for (const extra of [
    {}, { redeemStatus: 0 }, { orderType: 4, redeemStatus: 0, verifyQrBase64: 'ORDER_LEVEL_QR' }
  ]) {
    const order = list.mapOrderListItem({ ...extra, items: [
      { id: 1, productCategorySnapshot: 1, redeemRequiredSnapshot: 0 },
      { id: 2, productCategorySnapshot: 2, redeemRequiredSnapshot: 0 }
    ] })
    assert.equal(list.hasRedeemEntitlement(order), false)
    assert.equal(list.redeemSummaryText(order), '')
  }
  const template = readFileSync(new URL('../pages/order/order_list.vue', import.meta.url), 'utf8').split('<script')[0]
  assert.match(template, /v-if="redeemSummaryText\(order\)"\s+class="order-redeem-summary"/)
})

test('购买资格快照和历史真实券均可保留权益，当前商品改类不抹掉核销摘要', () => {
  const { list } = createPages()
  const purchasedEntitlement = list.mapOrderListItem({ orderType: 1, orderStatus: 1, payStatus: 1, redeemStatus: 0, items: [
    { id: 1, productCategory: 2, productCategorySnapshot: 3, redeemRequiredSnapshot: 1 }
  ] })
  assert.equal(list.hasRedeemEntitlement(purchasedEntitlement), true)
  assert.equal(list.redeemSummaryText(purchasedEntitlement), '到店核销：待核销')
  const historicalVoucher = list.mapOrderListItem({ orderType: 1, orderStatus: 1, payStatus: 1, items: [
    { id: 2, productCategorySnapshot: null, redeemRequiredSnapshot: null,
      redeemVouchers: [{ id: 1, redeemStatus: 0 }, { id: 2, redeemStatus: 1 },
        { id: 3, redeemStatus: 2 }, { id: 4, redeemStatus: 3 }] }
  ] })
  assert.equal(list.hasRedeemEntitlement(historicalVoucher), true)
  assert.equal(list.redeemSummaryText(historicalVoucher), '到店核销：可用 1，已核销 1，退款中 1，已退废 1')
})

test('混合订单仅汇总真实核销券，实物默认核销状态不增加券数', () => {
  const { list } = createPages()
  const order = list.mapOrderListItem({ redeemStatus: 0, orderType: 1, orderStatus: 1, payStatus: 1, items: [
    { id: 1, productCategorySnapshot: 1, redeemRequiredSnapshot: 0 },
    { id: 2, productCategorySnapshot: 2, redeemRequiredSnapshot: 0 },
    { id: 3, productCategorySnapshot: 3, redeemRequiredSnapshot: 1, redeemVouchers: [{ id: 7, redeemStatus: '0' }] }
  ] })
  assert.equal(list.hasRedeemEntitlement(order), true)
  assert.equal(list.redeemSummaryText(order), '到店核销：可用 1，已核销 0，退款中 0，已退废 0')
})

test('待支付、已取消和未确认支付履约的订单不显示核销摘要，即使残留可用券', () => {
  const { list } = createPages()
  const blockedOrders = [
    { orderStatus: 0, payStatus: 0 },
    { orderStatus: '0', payStatus: '1' },
    { orderStatus: 4, payStatus: 0 },
    { orderStatus: '4', payStatus: '1' },
    ...[undefined, null, '', 0, 2, 3].map(payStatus => ({ orderStatus: 1, payStatus })),
    ...[undefined, null, '', 99].map(orderStatus => ({ orderStatus, payStatus: 1 })),
    ...['PENDING', 'REFUND_REQUIRED', 'REFUNDED'].map(paymentFulfillmentStatus =>
      ({ orderStatus: 1, payStatus: 1, paymentFulfillmentStatus }))
  ]
  for (const state of blockedOrders) {
    for (const redeemVouchers of [[], [{ id: 1, redeemStatus: 0 }]]) {
      const order = list.mapOrderListItem({ ...state, redeemStatus: 0, items: [
        { id: 1, productCategorySnapshot: 3, redeemRequiredSnapshot: 1, redeemVouchers }
      ] })
      assert.equal(list.hasRedeemEntitlement(order), true, '购买资格与当前能否核销分开判断')
      assert.equal(list.redeemSummaryText(order), '', JSON.stringify(state))
    }
  }
})

test('已支付订单和部分退款订单按真实券汇总，冻结、失效券不会计为可用', () => {
  const { list } = createPages()
  for (const orderStatus of [1, 2, 3, 5, 6, 7, '1']) {
    for (const paymentFulfillmentStatus of [undefined, null, 'READY']) {
      const order = list.mapOrderListItem({ orderStatus, payStatus: '1', paymentFulfillmentStatus, items: [
        { id: 1, productCategorySnapshot: 3, redeemRequiredSnapshot: 1, redeemVouchers: [
          { id: 1, redeemStatus: '0' }, { id: 2, redeemStatus: 1 },
          { id: 3, redeemStatus: 2 }, { id: 4, redeemStatus: 3 }
        ] }
      ] })
      assert.equal(list.redeemSummaryText(order), '到店核销：可用 1，已核销 1，退款中 1，已退废 1')
    }
  }
})

test('没有逐张券的历史订单按明确核销状态展示，失效和未知状态不兜底为待核销', () => {
  const { list } = createPages()
  for (const [redeemStatus, expected] of [
    [0, '待核销'], ['0', '待核销'], [1, '已核销'],
    [2, '已退款/已失效'], [3, '退款处理中'], [null, '未知状态'], [undefined, '未知状态']
  ]) {
    const order = list.mapOrderListItem({ orderStatus: 1, payStatus: 1, redeemStatus, items: [
      { id: 1, productCategorySnapshot: 3, redeemRequiredSnapshot: 1 }
    ] })
    assert.equal(list.redeemSummaryText(order), `到店核销：${expected}`)
  }
})

test('详情页不给普通实物伪造整单核销券，历史真实券仍可展示', async () => {
  const order = {
    id: 7, orderNo: 'fixture-order', orderStatus: 1, payStatus: 1,
    paymentFulfillmentStatus: 'READY', redeemStatus: 0, verifyQrBase64: 'ORDER_LEVEL_QR',
    items: [
      { id: 1, productId: 10, productCategorySnapshot: 1, redeemRequiredSnapshot: 0, quantity: 1 },
      { id: 2, productId: 20, productCategorySnapshot: null, quantity: 1,
        redeemVouchers: [{ id: 8, redeemStatus: 0, verifyCode: 'fixture-code' }] }
    ]
  }
  const { detail } = createPages(order)
  await detail.loadOrderDetail(7)
  assert.deepEqual(detail.displayCartItems[0].redeemVouchers, [])
  assert.equal(detail.displayCartItems[1].redeemVouchers.length, 1)
  assert.equal(detail.displayCartItems[1].redeemVouchers[0].id, 8)
  assert.equal(detail.canShowVoucherCode(detail.displayCartItems[1].redeemVouchers[0]), true)
  assert.equal(detail.canShowVoucherCode({ redeemStatus: 2, verifyCode: 'refunded-code' }), false)
})
