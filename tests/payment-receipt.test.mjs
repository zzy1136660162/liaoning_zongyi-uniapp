import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { getPaymentOutcome } from '../utils/order-status.js'
import { isTherapyOrder } from '../utils/therapy.js'
import { loadSetup } from './sfc-harness.mjs'

const order = () => ({ id: 81, orderNo: 'SYNTHETIC-ORDER-81', orderStatus: 1, payStatus: 1,
  paymentFulfillmentStatus: 'READY', paidAmount: '36.60', payableAmount: '36.60', totalAmount: '36.60',
  createdAt: '2026-01-01 10:00:00', payTime: '2026-01-01 10:01:00', logisticsCompany: '测试承运商',
  receiverName: '测试收货人', receiverPhone: '13800000000', province: '测试省', city: '测试市',
  district: '测试区', addressDetail: '测试路1号', shippingPaymentMethod: '运费到付',
  items: [{ id: 1, productId: 11, skuId: 21, productName: '购买商品A', skuSpecText: '规格A', unit: '盒',
    productCategorySnapshot: 2, redeemRequiredSnapshot: 0, price: '12.20', quantity: 2, subtotalAmount: '24.40' },
  { id: 2, productId: 12, skuId: 22, productName: '购买疗法B', skuName: '服务B',
    productCategorySnapshot: 3, redeemRequiredSnapshot: 1, price: '12.20', quantity: 1, subtotalAmount: '12.20' }] })

function createPage(overrides = {}) {
  let load, unload
  const navigation = [], copied = [], consumedOrderIds = [], toasts = []
  const page = loadSetup('pages/order/payment_success.vue', {
    ref: value => ({ value }), onLoad: callback => { load = callback }, onUnload: callback => { unload = callback },
    getSessionGeneration: () => 1, assertCurrentSession() {}, getPaymentOutcome, isTherapyOrder,
    getOrderDetail: async () => order(), dayjs: value => ({ format: () => value }),
    consumeOrderCart: orderId => { consumedOrderIds.push(orderId); return true },
    logPageView() {}, logButtonClick() {},
    uni: { showLoading() {}, hideLoading() {}, showToast: toast => toasts.push(toast),
      redirectTo: value => navigation.push(value), setClipboardData: value => { copied.push(value.data); value.success?.() } },
    ...overrides
  }, ['paymentInfo', 'paymentOutcome', 'applyOrderData', 'formatOrderItemMeta', 'orderItemSubtotal',
    'getProductImageUrl', 'goToOrder', 'goOrderList', 'copyOrderNo'])
  return { page, load, unload, navigation, copied, consumedOrderIds, toasts }
}

test('支付回执展示全部成交商品及配送快照，不采信路由中的金额或地址', async () => {
  const { page, load } = createPage()
  await load({ orderId: '81', amount: '999', orderNo: '伪造路由号', receiverName: '地址簿姓名' })
  const info = page.paymentInfo.value
  assert.equal(info.amount, 36.6)
  assert.equal(info.goodsAmount, 36.6)
  assert.equal(info.itemCount, 3)
  assert.equal(info.items.length, 2)
  assert.equal(info.orderNo, 'SYNTHETIC-ORDER-81')
  assert.equal(info.orderStatusLabel, '待发货')
  assert.equal(info.receiverName, '测试收货人')
  assert.equal(info.receiverPhone, '13800000000')
  assert.equal(info.addressText, '测试省 测试市 测试区 测试路1号')
  assert.equal(info.shippingMethod, '测试承运商')
  assert.equal(info.requiresShipping, true)
  assert.equal(info.hasTherapy, true)
})

test('回执主按钮打开当前已支付订单详情，副按钮打开订单列表', async () => {
  const { page, load, navigation } = createPage()
  await load({ orderId: '81' })
  page.goToOrder(); page.goOrderList()
  assert.deepEqual(navigation.map(value => value.url), ['/pages/order/order-detail?orderId=81', '/pages/order/order_list'])
})

test('待确认使用订单应付金额，异常退款不会展示成功或消费订单购物车快照；成功实付零值仍保留', async () => {
  for (const [payStatus, paymentFulfillmentStatus] of [[0, null], [1, 'PENDING'], [1, 'REFUND_REQUIRED'], [1, 'REFUNDED']]) {
    const { page, consumedOrderIds } = createPage()
    await page.applyOrderData({ ...order(), payStatus, paymentFulfillmentStatus, paidAmount: 0 })
    assert.notEqual(page.paymentOutcome.value.state, 'success')
    assert.equal(page.paymentInfo.value.amount, 36.6)
    assert.equal(page.paymentInfo.value.primaryTip, page.paymentOutcome.value.tip)
    assert.equal(page.paymentInfo.value.secondaryTip, '')
    assert.deepEqual(consumedOrderIds, [])
  }
  const { page } = createPage()
  await page.applyOrderData({ ...order(), paidAmount: 0 })
  assert.equal(page.paymentInfo.value.amount, 0)
})

test('服务端轮询确认成功后只消费当前订单，重复应用成功响应不重复消费', async () => {
  const consumptionAtRead = []
  let reads = 0
  const fixture = createPage({ getOrderDetail: async id => {
    assert.equal(String(id), '81')
    consumptionAtRead.push([...fixture.consumedOrderIds])
    reads++
    return reads === 1 ? { ...order(), payStatus: 1, paymentFulfillmentStatus: 'PENDING' } : order()
  } })
  await fixture.load({ orderId: '81' })
  assert.equal(reads, 2)
  assert.deepEqual(consumptionAtRead, [[], []], '订单尚未确认可履约时不能消费快照')
  assert.equal(fixture.page.paymentOutcome.value.state, 'success')
  assert.deepEqual(fixture.consumedOrderIds, [81])
  await fixture.page.applyOrderData(order())
  await fixture.page.applyOrderData({ ...order(), items: [...order().items] })
  assert.deepEqual(fixture.consumedOrderIds, [81])
})

test('已取消订单即使已收到付款也不消费购物车快照', async () => {
  const { page, consumedOrderIds } = createPage()
  await page.applyOrderData({ ...order(), orderStatus: 4 })
  assert.equal(page.paymentOutcome.value.state, 'canceled')
  assert.deepEqual(consumedOrderIds, [])
})

test('没有订单ID时不编造订单号和成功结果，查看入口回订单列表', async () => {
  let reads = 0
  const { page, load, navigation, copied, consumedOrderIds } = createPage({ getOrderDetail: () => { reads++ } })
  await load({ amount: '999', orderNo: '路由不能充当订单记录' })
  assert.equal(reads, 0)
  assert.equal(page.paymentOutcome.value.state, 'unknown')
  assert.equal(page.paymentInfo.value.hasOrder, false)
  page.copyOrderNo(); page.goToOrder()
  assert.equal(copied.length, 0)
  assert.deepEqual(consumedOrderIds, [])
  assert.equal(navigation[0].url, '/pages/order/order_list')
})

test('仅疗法订单展示无需配送；普通实物无核销提示，当前分类不覆盖购买快照', async () => {
  const { page } = createPage()
  await page.applyOrderData({ ...order(), items: [{ ...order().items[1], productCategory: 2 }] })
  assert.equal(page.paymentInfo.value.requiresShipping, false)
  assert.match(page.paymentInfo.value.shippingFeeText, /无需快递费/)
  await page.applyOrderData({ ...order(), items: [{ ...order().items[0], productCategory: 3 }] })
  assert.equal(page.paymentInfo.value.requiresShipping, true)
  assert.equal(page.paymentInfo.value.hasTherapy, false)
})

test('规格、小计和缺图占位保留真实值，零价商品不能被错误回退', async () => {
  const { page } = createPage()
  assert.equal(page.formatOrderItemMeta(order().items[0]), '规格A / 盒')
  assert.equal(page.orderItemSubtotal(order().items[0]), 24.4)
  assert.equal(page.orderItemSubtotal({ subtotalAmount: 0, price: 10, quantity: 2 }), 0)
  assert.equal(page.orderItemSubtotal({ price: '12.20', quantity: 2 }), 24.4)
  assert.equal(page.getProductImageUrl(''), '/static/images/product-placeholder.jpg')
  await page.applyOrderData({ ...order(), receiverName: null, receiverPhone: null, province: null, city: null, district: null, addressDetail: null })
  assert.equal(page.paymentInfo.value.receiverName, '')
  assert.equal(page.paymentInfo.value.addressText, '')
})

test('完整订单号可复制，页面卸载后延迟订单响应不清购物车或导航', async () => {
  const normal = createPage()
  await normal.page.applyOrderData(order()); normal.page.copyOrderNo()
  assert.deepEqual(normal.copied, ['SYNTHETIC-ORDER-81'])
  let finish
  const pending = new Promise(resolve => { finish = resolve })
  const late = createPage({ getOrderDetail: () => pending })
  const loading = late.load({ orderId: '81' })
  late.unload(); finish(order()); await loading
  late.page.goToOrder(); late.page.copyOrderNo()
  assert.deepEqual(late.navigation, [])
  assert.deepEqual(late.copied, [])
  assert.deepEqual(late.consumedOrderIds, [])
  await late.page.applyOrderData(order())
  assert.deepEqual(late.consumedOrderIds, [], '退页后直接到达的成功处理同样不能消费快照')
})

test('实际回执模板可编译，收货内容及复制、订单入口均连接实际处理函数', async () => {
  const require = createRequire(new URL('../../liaoning_zongyi-admin/ruoyi-ui/package.json', import.meta.url))
  const compiler = require('vue-template-compiler')
  const source = readFileSync(new URL('../pages/order/payment_success.vue', import.meta.url), 'utf8')
  const template = compiler.parseComponent(source).template.content
  assert.deepEqual(compiler.compile(template).errors, [])
  for (const field of ['amount', 'goodsAmount', 'items', 'shippingMethod', 'shippingFeeText',
    'receiverName', 'receiverPhone', 'addressText', 'requiresShipping', 'hasTherapy']) {
    assert.ok(template.includes(`paymentInfo.${field}`), `回执保留动态字段 ${field}`)
  }
  assert.match(template, /paymentOutcome\.title/)
  assert.match(template, /@click\.stop="copyOrderNo"/)
  assert.match(template, /@click="goToOrder"/)
  assert.match(template, /@click="goOrderList"/)
})
