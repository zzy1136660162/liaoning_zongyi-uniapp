import assert from 'node:assert/strict'
import { hasMixedTherapyAndNormalRefundItems, resolveRefundType } from '../utils/refund.js'

const normal = { id: 1, quantity: 1, redeemVouchers: [] }
const therapy = { id: 2, quantity: 1, redeemVouchers: [{ redeemStatus: 0 }] }

assert.equal(resolveRefundType([normal, therapy], [normal, therapy]), 1)
assert.equal(resolveRefundType([normal, therapy], [therapy]), 2)
assert.equal(resolveRefundType([normal], [{ ...normal, quantity: 0 }]), 2)
assert.equal(hasMixedTherapyAndNormalRefundItems([normal, therapy]), true)
assert.equal(hasMixedTherapyAndNormalRefundItems([therapy]), false)
assert.equal(hasMixedTherapyAndNormalRefundItems([normal]), false)

console.log('refund-apply-type test passed')
