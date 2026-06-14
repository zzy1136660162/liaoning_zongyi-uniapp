import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const orderDetailPage = read('pages/order/order-detail.vue')
const paymentSuccessPage = read('pages/order/payment_success.vue')

assert.match(orderDetailPage, /displayPrescriptionNo/)
assert.match(orderDetailPage, /\{\s*label:\s*['"]处方单号['"][^}]*displayPrescriptionNo/s)
assert.doesNotMatch(orderDetailPage, /\{\s*label:\s*['"]临床诊断['"]/)
assert.doesNotMatch(orderDetailPage, /\{\s*label:\s*['"]开方医院['"]/)
assert.doesNotMatch(orderDetailPage, /class="doctor-department"[\s\S]{0,160}order\.hospital/)

assert.match(paymentSuccessPage, /getCurrentCheckoutProductIds/)
assert.match(paymentSuccessPage, /resolveOrderItemProductId/)
assert.match(paymentSuccessPage, /product_id/)
assert.match(paymentSuccessPage, /goodsId/)
assert.match(paymentSuccessPage, /clearPaidCartItems/)
