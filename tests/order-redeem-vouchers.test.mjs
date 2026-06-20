import assert from 'node:assert/strict'
import { buildItemRedeemVouchers } from '../utils/order-redeem-vouchers.js'

const normalItemVouchers = buildItemRedeemVouchers(
  { id: 245, productName: '测试制剂' },
  {
    verifyQrBase64: 'data:image/png;base64,ORDER_LEVEL_QR',
    verifyToken: 'ORDER_LEVEL_TOKEN',
    redeemStatus: 0
  },
  0
)

assert.deepEqual(normalItemVouchers, [])

const therapyItemVouchers = buildItemRedeemVouchers({
  id: 246,
  productName: '测试商品',
  redeem_vouchers: [{
    id: 21,
    sequence_no: 1,
    redeem_status: 0,
    verify_token: 'ITEM_TOKEN',
    verify_qr_base64: 'data:image/png;base64,ITEM_QR'
  }]
})

assert.equal(therapyItemVouchers.length, 1)
assert.equal(therapyItemVouchers[0].id, 21)
assert.equal(therapyItemVouchers[0].sequenceNo, 1)
assert.equal(therapyItemVouchers[0].verifyToken, 'ITEM_TOKEN')
assert.equal(therapyItemVouchers[0].verifyQrBase64, 'data:image/png;base64,ITEM_QR')
