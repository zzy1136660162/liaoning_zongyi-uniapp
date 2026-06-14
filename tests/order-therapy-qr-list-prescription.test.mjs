import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const orderDetailPage = read('pages/order/order-detail.vue')
const orderListPage = read('pages/order/order_list.vue')
const prescriptionDetailPage = read('pages/prescription/detail.vue')

assert.match(orderDetailPage, /redeemVouchers/)
assert.match(orderDetailPage, /therapy-voucher-card/)
assert.match(orderDetailPage, /verifyQrBase64/)
assert.match(orderDetailPage, /formatRedeemStatus/)
assert.match(orderDetailPage, /buildRedeemVouchers/)

assert.match(orderListPage, /ORDER_LIST_PREVIEW_LIMIT/)
assert.match(orderListPage, /visibleOrderItems/)
assert.match(orderListPage, /remainingOrderItemCount/)
assert.match(orderListPage, /order-product-meta/)
assert.match(orderListPage, /redeemSummaryText/)
assert.match(orderListPage, /查看详情/)
assert.doesNotMatch(orderListPage, /class="therapy-qr-image"/)

assert.match(prescriptionDetailPage, /resolvePrescriptionDoctorName/)
assert.match(prescriptionDetailPage, /resolvePrescriptionDate/)
assert.match(prescriptionDetailPage, /doctor_name/)
assert.match(prescriptionDetailPage, /createTime/)
assert.match(prescriptionDetailPage, /formatNullableDate/)
assert.doesNotMatch(prescriptionDetailPage, /\{\{\s*formatDate\(detail\.date\)\s*\}\}/)
