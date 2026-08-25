import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const quantityHelperUrl = new URL('../utils/purchase-quantity.js', import.meta.url)
const quantityHelperPath = fileURLToPath(quantityHelperUrl)

assert.equal(
  existsSync(quantityHelperPath),
  true,
  '传统疗法详情页需要统一的购买数量边界工具'
)

const {
  isPurchaseAvailable,
  normalizePurchaseQuantity,
  resolvePurchaseQuantityLimit
} = await import(quantityHelperUrl)

assert.equal(resolvePurchaseQuantityLimit({ stock: 5 }), 5)
assert.equal(resolvePurchaseQuantityLimit({ stock: 10, limitInfo: { enabled: true, remainingQuantity: 3 } }), 3)
assert.equal(resolvePurchaseQuantityLimit({ stock: 10, limitInfo: { enabled: false, remainingQuantity: 0 } }), 10)
assert.equal(resolvePurchaseQuantityLimit({ stock: 10, limitInfo: { enabled: true, remainingQuantity: 0 } }), 0)
assert.equal(resolvePurchaseQuantityLimit({}), null)

assert.equal(normalizePurchaseQuantity({ stock: 5 }, 0), 1)
assert.equal(normalizePurchaseQuantity({ stock: 5 }, 3.8), 3)
assert.equal(normalizePurchaseQuantity({ stock: 5 }, 99), 5)
assert.equal(normalizePurchaseQuantity({ stock: 0 }, 4), 1)
assert.equal(normalizePurchaseQuantity({ stock: 10, limitInfo: { enabled: true, remainingQuantity: 2 } }, 4), 2)
assert.equal(isPurchaseAvailable({ stock: 1 }), true)
assert.equal(isPurchaseAvailable({ stock: 0 }), false)
assert.equal(isPurchaseAvailable({ stock: 10, limitInfo: { enabled: true, remainingQuantity: 0 } }), false)

const therapyDetailPage = readFileSync(
  new URL('../pages/products/therapy_detail.vue', import.meta.url),
  'utf8'
)
const therapyDetailTemplate = therapyDetailPage.slice(0, therapyDetailPage.indexOf('<script'))
const therapyDetailScript = therapyDetailPage.slice(therapyDetailPage.indexOf('<script'))

assert.match(therapyDetailTemplate, /class="quantity-stepper"/)
assert.match(therapyDetailTemplate, /@click="decreaseQuantity"/)
assert.match(therapyDetailTemplate, /@click="increaseQuantity"/)
assert.match(therapyDetailTemplate, /:disabled="!canDecreaseQuantity"/)
assert.match(therapyDetailTemplate, /:disabled="!canIncreaseQuantity"/)
assert.match(therapyDetailTemplate, /:class="\{ disabled: !canPurchase \}"/)

assert.match(therapyDetailScript, /const maxPurchaseQuantity = computed/)
assert.match(therapyDetailScript, /const decreaseQuantity = \(\) =>/)
assert.match(therapyDetailScript, /const increaseQuantity = \(\) =>/)
assert.match(therapyDetailScript, /normalizePurchaseQuantity\(product\.value, quantity\.value/)
assert.match(therapyDetailScript, /handlePurchaseAction\('cart', product\.value, quantity\.value\)/)
assert.match(therapyDetailScript, /handlePurchaseAction\('buy', product\.value, quantity\.value\)/)
assert.match(therapyDetailScript, /navigateToNotice\(targetProduct, requestedQuantity, mode\)/)
assert.match(therapyDetailScript, /addCartItem\(targetProduct, requestedQuantity/)

const storage = new Map()
globalThis.uni = {
  getStorageSync(key) {
    return storage.get(key)
  },
  setStorageSync(key, value) {
    storage.set(key, value)
  },
  removeStorageSync(key) {
    storage.delete(key)
  },
  $emit() {}
}

const cart = await import('../utils/cart.js')
const therapyProduct = {
  id: '8801',
  name: '传统疗法数量测试',
  categoryCode: '传统疗法',
  bizType: 1,
  price: 20,
  stock: 5,
  available: true
}
const selectedQuantity = normalizePurchaseQuantity(therapyProduct, 3)

assert.equal(cart.addCartItem(therapyProduct, selectedQuantity), true)
assert.equal(cart.getCartProductInfo(therapyProduct.id).quantity, 3)

const categories = [{
  id: 'therapy_checkout',
  products: [therapyProduct]
}]
const checkout = cart.prepareCheckout([therapyProduct.id], categories)
assert.equal(checkout.valid, true)
assert.equal(checkout.allTraditionalTherapy, true)

const orderItems = cart.buildOrderItems(
  cart.loadCartItems(categories),
  checkout.productIds
)
assert.equal(orderItems.length, 1)
assert.equal(orderItems[0].quantity, 3)
assert.equal(orderItems[0].price, 60)
