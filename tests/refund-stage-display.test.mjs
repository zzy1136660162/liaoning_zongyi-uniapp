import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { getPaymentRefundStatusText, getRefundStageText } from '../utils/refund.js'
import { getImageUrl } from '../utils/config.js'
import { loadOptions, loadSetup, PRODUCT_PLACEHOLDER } from './sfc-harness.mjs'

const returned = { returnLogisticsCompany: '测试物流', returnLogisticsNo: 'TEST-123' }
const stages = [
  [{ status: 0, paymentRefundStatus: 'PENDING' }, '申请已提交，等待审核'],
  [{ status: 0, paymentRefundStatus: 'FAILED' }, '申请已提交，等待审核'],
  [{ status: 2, paymentRefundStatus: 'FAILED' }, '申请未通过审核'],
  [{ status: 5, paymentRefundStatus: 'FAILED' }, '申请已关闭'],
  [{ status: 1, refundScene: 'FORMULATION_RETURN', paymentRefundStatus: 'PENDING' }, '请线下联系客服处理退款'],
  [{ status: 1, ...returned }, '请线下联系客服处理退款'],
  [{ status: 1, ...returned, returnReceivedAt: '2026-10-21T12:00:00' }, '请线下联系客服处理退款'],
  [{ status: 1, returnLogisticsCompany: '测试物流' }, '请线下联系客服处理退款'],
  [{ status: 3, ...returned }, '请线下联系客服处理退款'],
  [{ status: 3, returnReceivedAt: '2026-10-21T12:00:00' }, '请线下联系客服处理退款'],
  [{ status: 4 }, '退款成功'],
  [{ status: 3, paymentRefundStatus: 'FAILED' }, '退款失败，请联系客服'],
  ...['THERAPY_UNREDEEMED', 'THERAPY_REDEEMED', 'FORMULATION_PRE_SHIP', 'ADMIN_PHYSICAL']
    .flatMap(refundScene => [1, 3].map(status => [{ status, refundScene }, '等待执行退款'])),
  ...[['PROCESSING', '退款处理中'], ['UNKNOWN', '退款结果确认中'], ['SUCCESS', '退款完成']]
    .map(([paymentRefundStatus, text]) => [{ status: 3, paymentRefundStatus }, text])
]

const pageOptions = path => loadOptions(path, { getRefundStageText, getPaymentRefundStatusText, getImageUrl })

test('退款阶段按完整对象解释物流、场景和渠道状态，关闭及拒绝不误报渠道失败', () => {
  for (const [detail, expected] of stages) assert.equal(getRefundStageText(detail), expected, JSON.stringify(detail))
})

test('退款列表与最新详情页复用同一阶段解释，不保留重复的数字进度文案', () => {
  for (const path of ['pages/order/refund_list.vue', 'pages/order/refund_detail.vue']) {
    const options = pageOptions(path)
    for (const [detail, expected] of stages) assert.equal(options.methods.getRefundStageText(detail), expected, path)
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
    assert.match(source, /getRefundStageText\((?:item|detail)\)/)
    assert.doesNotMatch(source, /getProgressText|getStatusDesc/)
  }
})

test('退款完成说明覆盖历史等待或错误提示，兼容旧退款记录', () => {
  const options = pageOptions('pages/order/refund_detail.vue')
  for (const state of [{ status: 4, paymentRefundStatus: 'SUCCESS' }, { status: 3, paymentRefundStatus: 'SUCCESS' }, { status: 4 }]) {
    for (const refundLastError of ['等待支付渠道最终结果', '退款结果待查询确认', '支付渠道确认退款未成功', null, undefined]) {
      const detail = { ...state, refundLastError }
      assert.equal(options.computed.statusNotice.call({ detail }), '退款已完成，请查看原支付账户的到账记录。')
      assert.equal(detail.refundLastError, refundLastError, '展示转换不修改接口数据')
    }
  }
  const source = readFileSync(new URL('../pages/order/refund_detail.vue', import.meta.url), 'utf8')
  assert.match(source, /v-if="statusNotice"/)
  assert.match(source, /\{\{ statusNotice \}\}/)
  assert.doesNotMatch(source, /\{\{ detail\.refundLastError \}\}/)
})

test('处理中、待确认和失败退款保留原提示，不提前宣告完成', () => {
  const options = pageOptions('pages/order/refund_detail.vue')
  for (const state of [
    { status: 3, paymentRefundStatus: 'PROCESSING' },
    { status: 3, paymentRefundStatus: 'UNKNOWN' },
    { status: 4, paymentRefundStatus: 'PROCESSING' },
    { status: 4, paymentRefundStatus: 'UNKNOWN' },
    { status: 5, paymentRefundStatus: 'FAILED' },
    { status: 0, paymentRefundStatus: 'PENDING' },
    { status: 2 }
  ]) {
    const detail = { ...state, refundLastError: '当前阶段提示' }
    assert.equal(options.computed.statusNotice.call({ detail }), '当前阶段提示')
    assert.equal(options.computed.statusNotice.call({ detail: state }), '')
  }
  assert.equal(options.computed.statusNotice.call({ detail: {} }), '')
})

test('刷新为退款成功后，即使接口保留旧提示也立即显示完成说明', async () => {
  let response = { status: 3, paymentRefundStatus: 'PROCESSING', refundLastError: '等待支付渠道最终结果' }
  const options = loadOptions('pages/order/refund_detail.vue', {
    getRefundDetail: async () => structuredClone(response), isCurrentSession: () => true,
    uni: { showLoading() {}, hideLoading() {} }
  })
  const page = { ...options.data(), ...options.methods }
  await page.loadDetail()
  assert.equal(options.computed.statusNotice.call(page), '等待支付渠道最终结果')
  response = { ...response, status: 4, paymentRefundStatus: 'SUCCESS' }
  await page.loadDetail()
  assert.equal(page.getRefundStageText(page.detail), '退款完成')
  assert.equal(options.computed.statusNotice.call(page), '退款已完成，请查看原支付账户的到账记录。')
})

test('退款详情保留历史物流信息，不再提供患者填写物流的入口', () => {
  const source = readFileSync(new URL('../pages/order/refund_detail.vue', import.meta.url), 'utf8')
  assert.match(source, /detail\.returnLogisticsCompany/)
  assert.doesNotMatch(source, /refund_logistics|showLogisticsDialog|寄回商品后/)
})

test('最新退款详情保持原商品数据并复用真实 JPG 占位及图片失败回退', async () => {
  const detail = { status: 3, items: [
    { id: 1, productName: '缺图商品', price: 3, quantity: 2 },
    { id: 2, productName: '空图商品', productImage: null },
    { id: 3, productImage: '/profile/broken.jpg' },
    { id: 4, productImage: 'https://example.com/good.jpg' }
  ] }
  const options = loadOptions('pages/order/refund_detail.vue', {
    getRefundStageText, getPaymentRefundStatusText, getImageUrl,
    getRefundDetail: async () => structuredClone(detail), isCurrentSession: () => true,
    uni: { showLoading() {}, hideLoading() {} }
  })
  const page = { ...options.data(), ...options.methods, ...options.setup() }
  await page.loadDetail()
  assert.deepEqual(page.detail, detail)
  assert.equal(page.getProductImageUrl(page.detail.items[0].productImage), PRODUCT_PLACEHOLDER)
  assert.equal(page.getProductImageUrl(page.detail.items[1].productImage), PRODUCT_PLACEHOLDER)
  page.handleProductImageError(page.detail.items[2].productImage)
  assert.equal(page.getProductImageUrl(page.detail.items[2].productImage), PRODUCT_PLACEHOLDER)
  assert.equal(page.getProductImageUrl(page.detail.items[3].productImage), 'https://example.com/good.jpg')
  const source = readFileSync(new URL('../pages/order/refund_detail.vue', import.meta.url), 'utf8')
  assert.match(source, /:src="getProductImageUrl\(item.productImage\)"/)
  assert.match(source, /@error="handleProductImageError\(item.productImage\)"/)
  assert.doesNotMatch(source, /product-placeholder\.png/)
})

test('订单列表点击退款记录后按申请ID加载详情，商品图片与订单列表一致', async () => {
  let targetUrl
  const list = loadSetup('pages/order/order_list.vue', {
    ref: value => ({ value }), onUnmounted() {},
    uni: { navigateTo: ({ url }) => { targetUrl = url } }
  }, ['viewRefundApplication', 'getProductImageUrl'])
  list.viewRefundApplication(501)
  assert.equal(targetUrl, '/pages/order/refund_detail?refundApplicationId=501')
  const response = { id: 501, status: 4, items: [
    { id: 101, productId: 11, productImage: '/profile/product-a.jpg', productName: '商品甲' },
    { id: 102, productId: 12, productImage: 'https://example.com/product-b.png', productName: '商品乙' },
    { id: 103, productId: 13, productImage: null, productName: '缺图商品' }
  ] }
  const requests = []
  const options = loadOptions('pages/order/refund_detail.vue', {
    getRefundDetail: async id => { requests.push(id); return structuredClone(response) },
    isCurrentSession: () => true, uni: { showLoading() {}, hideLoading() {} }
  })
  const page = { ...options.data(), ...options.methods, ...options.setup() }
  options.onLoad.call(page, Object.fromEntries(new URLSearchParams(targetUrl.split('?')[1])))
  await page.loadDetail()
  assert.deepEqual(requests, ['501'])
  for (const item of page.detail.items.slice(0, 2)) {
    assert.equal(page.getProductImageUrl(item.productImage), list.getProductImageUrl(item.productImage))
    assert.notEqual(page.getProductImageUrl(item.productImage), PRODUCT_PLACEHOLDER)
  }
  assert.equal(page.getProductImageUrl(page.detail.items[2].productImage), PRODUCT_PLACEHOLDER)
  page.handleProductImageError(page.detail.items[0].productImage)
  assert.equal(page.getProductImageUrl(page.detail.items[0].productImage), PRODUCT_PLACEHOLDER)
  assert.equal(page.getProductImageUrl(page.detail.items[1].productImage), 'https://example.com/product-b.png')
})
