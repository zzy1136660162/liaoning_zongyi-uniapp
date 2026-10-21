import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canOrderApplyRefund, shouldContactForPhysicalRefund, getRefundStageText } from '../utils/refund.js'
import { loadOptions, loadSetup } from './sfc-harness.mjs'

const item = category => ({ id: category, quantity: 2, productCategorySnapshot: category,
  redeemRequiredSnapshot: category === 3 ? 1 : 0, refundableQuantity: 1, refundCompletedQuantity: 1 })
const order = (category, status = 1) => ({ id: 9, orderStatus: status, payStatus: 1,
  paymentFulfillmentStatus: 'READY', refundApplicationId: 10, refundStatus: 4, items: [item(category)] })

for (const category of [1, 2]) {
  test(`${category === 1 ? '制剂' : '健康产品'}未发货可继续退余量，发货及完成后只能联系客服`, () => {
    assert.equal(canOrderApplyRefund(order(category)), true)
    assert.equal(shouldContactForPhysicalRefund(order(category)), false)
    for (const status of [2, 3]) {
      assert.equal(canOrderApplyRefund(order(category, status)), false)
      assert.equal(shouldContactForPhysicalRefund(order(category, status)), true)
    }
    for (const orderStatus of [0, 4, 7]) assert.equal(canOrderApplyRefund({ ...order(category), orderStatus }), false)
    for (const paymentFulfillmentStatus of ['PENDING', 'REFUND_REQUIRED', 'REFUNDED']) {
      assert.equal(canOrderApplyRefund({ ...order(category), paymentFulfillmentStatus }), false)
    }
    assert.equal(canOrderApplyRefund({ ...order(category), payStatus: 0 }), false)
    assert.equal(canOrderApplyRefund({ ...order(category), items: [{ ...item(category), refundableQuantity: 0 }] }), false)
  })
}

test('混合单发货后只保留有可退次数的疗法入口，同时提示实物联系客服', () => {
  const mixed = { ...order(1, 2), items: [item(1), item(3)] }
  assert.equal(canOrderApplyRefund(mixed), true)
  assert.equal(shouldContactForPhysicalRefund(mixed), true)
  mixed.items[1].refundableQuantity = 0
  assert.equal(canOrderApplyRefund(mixed), false)
  assert.equal(shouldContactForPhysicalRefund(order(3, 2)), false)
  assert.equal(shouldContactForPhysicalRefund({ ...order(1, 2), items: [{ ...item(1), refundCompletedQuantity: 2 }] }), false)
})

test('列表和详情按相同政策隐藏已发货实物退款，展示线下联系提示', () => {
  const list = loadSetup('pages/order/order_list.vue', {
    ref: value => ({ value }), onLoad() {}, onShow() {}, onUnmounted() {}, onSessionChanged: () => () => {}
  }, ['mapOrderListItem', 'canOrderApplyRefund', 'shouldContactForPhysicalRefund'])
  const detail = loadOptions('pages/order/order-detail.vue', {})
  const mapped = list.mapOrderListItem(order(2, 2))
  assert.equal(list.canOrderApplyRefund(mapped), false)
  assert.equal(list.shouldContactForPhysicalRefund(mapped), true)
  assert.equal(detail.computed.canApplyRefund.call({ order: mapped, allCartItems: mapped.items }), false)
  assert.equal(detail.computed.showOfflineRefundNotice.call({ order: mapped, allCartItems: mapped.items }), true)
})

test('后台线下退款展示实际渠道状态，不要求患者补物流', () => {
  assert.equal(getRefundStageText({ refundScene: 'ADMIN_PHYSICAL', status: 3 }), '等待执行退款')
  assert.equal(getRefundStageText({ refundScene: 'ADMIN_PHYSICAL', status: 3, paymentRefundStatus: 'PROCESSING' }), '退款处理中')
  assert.equal(getRefundStageText({ refundScene: 'ADMIN_PHYSICAL', status: 4, paymentRefundStatus: 'SUCCESS' }), '退款完成')
  assert.equal(getRefundStageText({ refundScene: 'FORMULATION_RETURN', status: 1 }), '请线下联系客服处理退款')
})

test('旧退货物流路由仅提示联系客服，查看进度保留申请ID且不请求业务接口', () => {
  const targets = []
  const options = loadOptions('pages/order/refund_logistics.vue', {
    getSessionGeneration: () => 1, isCurrentSession: () => true,
    uni: { redirectTo: target => targets.push(target.url) },
    getRefundDetail: () => assert.fail('旧物流页不应请求详情'),
    submitReturnLogistics: () => assert.fail('旧物流页不应提交物流')
  })
  const state = { ...options.data(), ...options.methods }
  options.onLoad.call(state, { refundApplicationId: 99 })
  state.viewRefundDetail()
  assert.deepEqual(targets, ['/pages/order/refund_detail?refundApplicationId=99'])
})
