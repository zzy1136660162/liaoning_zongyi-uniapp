import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getDisplayOrderNo, getPaidAmountText, getRefundedAmountText } from '../utils/order-display.js'
import { getOrderStatusText } from '../utils/order-status.js'

test('医院单号优先、空号回退商城且不覆盖支付关联号', () => {
  const order = { orderNo: 'OD-7', hisOrderNo: ' 00001234567890123456789 ' }
  assert.equal(getDisplayOrderNo(order), '00001234567890123456789')
  assert.equal(order.orderNo, 'OD-7')
  for (const hisOrderNo of [null, undefined, '', '  ']) assert.equal(getDisplayOrderNo({ ...order, hisOrderNo }), 'OD-7')
})

test('实付不用应付款替代，取消后的已扣款和成功退款独立展示', () => {
  assert.equal(getPaidAmountText({ orderStatus: 4, payStatus: 0, payableAmount: 86.74, paidAmount: 0 }), '0.00')
  assert.equal(getPaidAmountText({ orderStatus: 4, payStatus: 1, paidAmount: 86.74, paymentFulfillmentStatus: 'REFUND_REQUIRED' }), '86.74')
  assert.equal(getPaidAmountText({ payStatus: 1, payableAmount: 99 }), '待确认')
  assert.equal(getPaidAmountText({ payStatus: null }), '待确认')
  assert.equal(getPaidAmountText({ payStatus: 0 }), '0.00')
  assert.equal(getRefundedAmountText({ refundedAmount: 12.3 }), '已退款 ¥12.30')
  assert.equal(getRefundedAmountText({ refundedAmount: null }), '')
})

test('完成交易展示已收货或已使用，关闭与可使用权益区分', () => {
  assert.equal(getOrderStatusText({ orderStatus: 3, displayStatusText: '已完成', items: [{ productCategorySnapshot: 1 }] }), '已收货')
  assert.equal(getOrderStatusText({ orderStatus: 3, orderType: 4, redeemStatus: 1, displayStatusText: '已核销' }), '已使用')
  assert.equal(getOrderStatusText({ orderStatus: 3, displayStatusText: '待核销', items: [{ productCategorySnapshot: 1 }, { productCategorySnapshot: 3 }] }), '待使用')
  assert.equal(getOrderStatusText({ orderStatus: 3, displayStatusText: '退款处理中', items: [{ productCategorySnapshot: 1 }, { productCategorySnapshot: 3 }] }), '退款处理中')
  assert.equal(getOrderStatusText({ orderStatus: 4 }), '已关闭')
  assert.equal(getOrderStatusText({ orderStatus: 7, displayStatusText: '已退货' }), '已关闭')
  assert.equal(getOrderStatusText({ orderStatus: 0, displayStatusText: '待支付' }), '待付款')
})
