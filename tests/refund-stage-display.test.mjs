import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { getPaymentRefundStatusText, getRefundStageText } from '../utils/refund.js'
import { getImageUrl } from '../utils/config.js'
import { loadOptions, PRODUCT_PLACEHOLDER } from './sfc-harness.mjs'

const returned = { returnLogisticsCompany: '测试物流', returnLogisticsNo: 'TEST-123' }
const stages = [
  [{ status: 0, paymentRefundStatus: 'PENDING' }, '申请已提交，等待审核'],
  [{ status: 0, paymentRefundStatus: 'FAILED' }, '申请已提交，等待审核'],
  [{ status: 2, paymentRefundStatus: 'FAILED' }, '申请未通过审核'],
  [{ status: 5, paymentRefundStatus: 'FAILED' }, '申请已关闭'],
  [{ status: 1, refundScene: 'FORMULATION_RETURN', paymentRefundStatus: 'PENDING' }, '待填写退货物流'],
  [{ status: 1, ...returned }, '等待商家收货处理'],
  [{ status: 1, ...returned, returnReceivedAt: '2026-10-21T12:00:00' }, '等待执行退款'],
  [{ status: 1, returnLogisticsCompany: '测试物流' }, '待填写退货物流'],
  [{ status: 3, ...returned }, '等待商家收货处理'],
  [{ status: 3, returnReceivedAt: '2026-10-21T12:00:00' }, '等待执行退款'],
  [{ status: 4 }, '退款成功'],
  [{ status: 3, paymentRefundStatus: 'FAILED' }, '退款失败，请联系客服'],
  ...['THERAPY_UNREDEEMED', 'THERAPY_REDEEMED', 'FORMULATION_PRE_SHIP']
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

test('详情仅在可填写且缺少完整物流时展示寄回按钮', () => {
  const { showActionButton } = pageOptions('pages/order/refund_detail.vue').computed
  const shown = detail => showActionButton.call({ detail })
  assert.equal(shown({ status: 1, paymentRefundStatus: 'PENDING' }), true)
  assert.equal(shown({ status: 1 }), true, '兼容历史缺渠道状态的申请')
  assert.equal(shown({ status: 1, ...returned }), false)
  for (const paymentRefundStatus of ['FAILED', 'PROCESSING', 'UNKNOWN', 'SUCCESS']) {
    assert.equal(shown({ status: 1, paymentRefundStatus }), false)
  }
  for (const refundScene of ['THERAPY_UNREDEEMED', 'THERAPY_REDEEMED', 'FORMULATION_PRE_SHIP']) {
    assert.equal(shown({ status: 1, refundScene }), false)
  }
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
