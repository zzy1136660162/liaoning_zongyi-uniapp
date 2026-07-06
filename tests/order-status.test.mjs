import assert from 'node:assert/strict'
import {
  getOrderStatusText,
  getRedeemStatusText,
  canShowRedeemCode
} from '../utils/order-status.js'

assert.equal(getOrderStatusText({ orderStatus: 7, orderType: 4, redeemStatus: 0 }), '已退货')
assert.equal(getOrderStatusText({ orderStatus: 6, orderType: 4, redeemStatus: 0 }), '部分退货')
assert.equal(getOrderStatusText({ orderStatus: 1, orderType: 4, redeemStatus: 0 }), '待核销')
assert.equal(getOrderStatusText({ orderStatus: 1, orderType: 1 }), '待发货')

assert.equal(getRedeemStatusText({ redeemStatus: 0 }), '待核销')
assert.equal(getRedeemStatusText({ redeemStatus: 1 }), '已核销')
assert.equal(getRedeemStatusText({ redeemStatus: 2 }), '已退款/已失效')

assert.equal(
  canShowRedeemCode({ orderStatus: 7, refundStatus: 5 }, { redeemStatus: 0, verifyCode: 'HX001' }),
  false
)
assert.equal(
  canShowRedeemCode({ orderStatus: 1, refundStatus: 0 }, { redeemStatus: 2, verifyCode: 'HX001' }),
  false
)
assert.equal(
  canShowRedeemCode({ orderStatus: 1, refundStatus: 0 }, { redeemStatus: 0, verifyCode: 'HX001' }),
  true
)
