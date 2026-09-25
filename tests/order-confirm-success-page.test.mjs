import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const confirmPage = read('pages/order/confirm.vue')
const paymentSuccessPage = read('pages/order/payment_success.vue')
const springbootPom = read('../liaoning_zongyi-springboot/pom.xml')

assert.match(confirmPage, /const requiresShipping = computed/)
assert.match(confirmPage, /requiresShipping\.value/)
assert.match(confirmPage, /flow\.allTraditionalTherapy/)
assert.match(confirmPage, /therapyRouteRequested/)
assert.match(confirmPage, /resolveTherapyOrderFlag/)
assert.doesNotMatch(confirmPage, /isTherapyOrder\.value\s*=\s*flow\.allTraditionalTherapy/)
assert.match(confirmPage, /orderInfo\.value\.cost\.shippingFee\s*=\s*0/)
// 运费规则由业务分支决定，不把诊断日志文案当成业务契约。
assert.match(confirmPage, /if\s*\(!requiresShipping\.value\)\s*\{[\s\S]*?orderInfo\.value\.cost\.shippingFee\s*=\s*0[\s\S]*?return/)

assert.match(paymentSuccessPage, /订单状态/)
assert.match(paymentSuccessPage, /下单时间/)
assert.match(paymentSuccessPage, /商品金额/)
assert.match(paymentSuccessPage, /商品数量/)
assert.match(paymentSuccessPage, /运费说明/)
assert.match(paymentSuccessPage, /orderStatusLabel/)
assert.match(paymentSuccessPage, /shippingFeeText/)

assert.match(springbootPom, /<groupId>com\.google\.zxing<\/groupId>/)
assert.match(springbootPom, /<artifactId>core<\/artifactId>/)
assert.match(springbootPom, /<artifactId>javase<\/artifactId>/)
