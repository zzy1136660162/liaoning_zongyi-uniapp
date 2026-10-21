import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { getOrderItemRefundText } from '../utils/refund.js'
import { loadOptions, loadSetup } from './sfc-harness.mjs'
import * as doctors from '../utils/consultation-mode.js'
import * as context from '../utils/consultation-checkout.js'
import * as vouchers from '../utils/order-redeem-vouchers.js'
import * as status from '../utils/order-status.js'
import * as therapy from '../utils/therapy.js'

test('成功退款与退款中分别展示，不能将有效申请占用当作成功退款', () => {
  assert.equal(getOrderItemRefundText({ refundedQuantity: 1 }), '')
  assert.equal(getOrderItemRefundText({ refundFrozenQuantity: 1 }), '退款中 1 件')
  assert.equal(getOrderItemRefundText({ refundCompletedQuantity: 1 }), '已退款 1 件')
  assert.equal(getOrderItemRefundText({ refundCompletedQuantity: 1, refundFrozenQuantity: 2 }), '已退款 1 件，退款中 2 件')
  assert.equal(getOrderItemRefundText({ refundCompletedQuantity: 0, refundFrozenQuantity: 0 }), '')
})

test('疗法按次展示，购买快照明确为实物时不被券误判', () => {
  assert.equal(getOrderItemRefundText({ redeemRequiredSnapshot: 1, refundCompletedQuantity: 2 }), '已退款 2 次')
  assert.equal(getOrderItemRefundText({ productCategorySnapshot: 3, refundFrozenQuantity: 1 }), '退款中 1 次')
  assert.equal(getOrderItemRefundText({ redeemRequiredSnapshot: 0, redeemVouchers: [{}], refundCompletedQuantity: 1 }), '已退款 1 件')
  assert.equal(getOrderItemRefundText({ productCategorySnapshot: 1, redeemVouchers: [{}], refundCompletedQuantity: 1 }), '已退款 1 件')
})

const product = { id: 20, productId: 30, productName: '测试制剂', price: 0.01, quantity: 2,
  subtotalAmount: 0.02, productCategorySnapshot: 1, redeemRequiredSnapshot: 0,
  refundedQuantity: 1, refundCompletedQuantity: 1, refundFrozenQuantity: 0, redeemVouchers: [] }

test('订单列表保留购买数量和原金额，同时接通每条商品的退款统计', () => {
  const { mapOrderListItem } = loadSetup('pages/order/order_list.vue', {
    ref: value => ({ value }), onLoad() {}, onShow() {}, onUnmounted() {},
    onSessionChanged: () => () => {}
  }, ['mapOrderListItem'])
  const mapped = mapOrderListItem({ id: 10, payableAmount: 0.03,
    items: [product, { ...product, id: 21, refundCompletedQuantity: 0, refundFrozenQuantity: 1 }] })
  assert.equal(mapped.payableAmount, 0.03)
  assert.deepEqual(mapped.items.map(item => item.quantity), [2, 2])
  assert.deepEqual(mapped.items.map(item => item.subtotalAmount), [0.02, 0.02])
  assert.deepEqual(mapped.items.map(getOrderItemRefundText), ['已退款 1 件', '退款中 1 件'])
})

test('订单详情刷新后从退款中切换为已退款，原购买数量和金额保持不变', async () => {
  let completed = false
  const options = loadOptions('pages/order/order-detail.vue', {
    ...doctors, ...context, ...vouchers, ...status, ...therapy,
    getSessionGeneration: () => 1, isCurrentSession: () => true, getImageUrl: value => value,
    console: { debug() {}, warn() {}, error() {} },
    uni: { showLoading() {}, hideLoading() {}, showToast() {} },
    getOrderDetail: async () => ({ id: 10, orderStatus: 1, orderType: 1, payStatus: 1, payableAmount: 0.03,
      items: [{ ...product, refundCompletedQuantity: completed ? 1 : 0, refundFrozenQuantity: completed ? 0 : 1 }] })
  })
  const state = { ...options.data(), ...options.methods }
  state.order.diagnosis = '已加载诊断'
  state.order.doctorName = '已加载医生'
  for (const [name, getter] of Object.entries(options.computed)) Object.defineProperty(state, name, { get: () => getter.call(state) })
  await state.loadOrderDetail(10)
  assert.equal(state.getOrderItemRefundText(state.displayCartItems[0]), '退款中 1 件')
  completed = true
  await state.loadOrderDetail(10)
  assert.equal(state.getOrderItemRefundText(state.displayCartItems[0]), '已退款 1 件')
  assert.equal(state.displayCartItems[0].quantity, 2)
  assert.equal(state.displayCartItems[0].price, 0.01)
})

test('列表和详情的商品区均展示共享退款摘要', () => {
  for (const file of ['order_list.vue', 'order-detail.vue']) {
    const source = readFileSync(new URL(`../pages/order/${file}`, import.meta.url), 'utf8')
    assert.match(source.split('</template>')[0], /getOrderItemRefundText\(item\)/)
  }
})
