import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { resolveProductSku, withProductSku } from '../utils/product-sku.js'
import { isPurchaseAvailable } from '../utils/purchase-quantity.js'
import { normalizePurchaseQuantity, resolvePurchaseQuantityLimit } from '../utils/purchase-quantity.js'
import { loadSetup } from './sfc-harness.mjs'
import { checkoutEntries, parseDirectPurchase } from '../utils/checkout.js'

const storage = new Map(), navigation = [], messages = []
globalThis.uni = { getStorageSync: k => storage.get(k), setStorageSync: (k, v) => storage.set(k, v), removeStorageSync: k => storage.delete(k),
  $emit() {}, navigateTo: value => navigation.push(value), showToast: value => messages.push(value), showLoading() {}, hideLoading() {} }
const cart = await import('../utils/cart.js')
const base = () => ({ id: '101', productName: '传统疗法服务', name: '传统疗法服务', categoryCode: '仅展示目录', goodsMerchantType: 1, productCategory: 3, status: 1,
  inventoryMode: 'HIS_AVAILABILITY', inventoryStatus: 'AVAILABLE', available: true, stock: null, price: 10, needQuestionnaire: 0,
  skus: [
    { id: '10', skuName: '基础款', price: 10, status: 1, defaultFlag: 1, stock: null, inventoryMode: 'HIS_AVAILABILITY', inventoryStatus: 'AVAILABLE', available: true },
    { id: '11', skuName: '加强款', price: 20, status: 1, stock: null, inventoryMode: 'HIS_AVAILABILITY', inventoryStatus: 'AVAILABLE', available: true }
  ] })
beforeEach(() => { storage.clear(); navigation.length = 0; messages.length = 0 })
function therapy() {
  return loadSetup('pages/products/therapy_detail.vue', {
    ref: value => ({ value }), computed: getter => ({ get value() { return getter() } }), getCurrentInstance: () => ({}), onLoad() {}, onShow() {},
    getImageUrl: value => value, mapProductDetail: value => value, getToken: () => 'fixture', logPageView() {},
    ...cart, isPurchaseAvailable, normalizePurchaseQuantity, resolvePurchaseQuantityLimit,
     STORAGE_KEY_CURRENT_CONSULTATION_ID: 'consultation'
  }, ['product', 'applyProduct', 'quantity', 'selectedSkuId', 'saleProduct', 'selectSku', 'addCart', 'buyNow', 'canPurchase', 'priceInteger'])
}

test('explicit selected SKU is retained; missing or disabled SKU never becomes another SKU', () => {
  const product = base()
  assert.equal(resolveProductSku(product, '11').skuName, '加强款')
  assert.throws(() => resolveProductSku(product, '999'), /失效/)
  product.skus[1].status = 0; assert.throws(() => resolveProductSku(product, '11'), /失效/)
  product.skus[0].available = false; product.skus[0].inventoryStatus = 'UNAVAILABLE'
  assert.equal(isPurchaseAvailable(withProductSku(product, product.skus[0])), false)
})

test('SKU inventory is fail-closed and preserves null HIS stock independently of other SKUs', () => {
  const product = base(), sku = product.skus[1]
  assert.equal(withProductSku(product, sku).stock, null)
  assert.equal(isPurchaseAvailable(withProductSku(product, { ...sku, inventoryStatus: undefined })), false)
  assert.equal(isPurchaseAvailable(withProductSku(product, { ...sku, available: false })), false)
  assert.equal(isPurchaseAvailable(withProductSku({ ...product, inventoryStatus: 'UNAVAILABLE' }, sku)), false)
  assert.equal(withProductSku(product, { ...sku, status: 0 }).stock, 0)
})

test('traditional therapy selection changes price and saves two independent cart lines', async () => {
  const page = therapy(); page.applyProduct(base())
  assert.equal(page.selectedSkuId.value, '10')
  page.quantity.value = 2; await page.addCart()
  page.selectSku(page.product.value.skus[1]); page.quantity.value = 3
  assert.equal(page.priceInteger.value, '20'); await page.addCart()
  assert.equal(cart.getCartEntries()['101:10'].quantity, 2)
  assert.equal(cart.getCartEntries()['101:11'].quantity, 3)
  assert.equal(cart.getCartEntries()['101:11'].skuName, '加强款')
  assert.equal(page.saleProduct.value.stock, null)
})

test('questionnaire route and direct checkout retain the actual SKU', async () => {
  const page = therapy(); const product = base(); product.needQuestionnaire = 1; product.questionnaireId = 90; page.applyProduct(product)
  page.selectSku(product.skus[1]); page.quantity.value = 2; await page.buyNow()
  assert.match(navigation.at(-1).url, /product_notice.*skuId=11/)
  assert.match(navigation.at(-1).url, /quantity=2/)
  product.needQuestionnaire = 0; page.applyProduct(product); await page.buyNow()
  assert.match(navigation.at(-1).url, /confirm\?selectedItems=101:11/)
  const options = Object.fromEntries(new URL(navigation.at(-1).url, 'https://fixture.invalid').searchParams)
  const entries = cart.loadCartItems([{ products: [page.saleProduct.value] }], false,
    { entries: checkoutEntries(['101:11'], parseDirectPurchase(options)), preserveQuantity: true })
  assert.equal(cart.buildOrderItems(entries, ['101:11'])[0].skuId, '11')
  assert.deepEqual(cart.getCartEntries(), {})
})

test('one available SKU does not allow buying an unavailable or expired selected SKU', async () => {
  const page = therapy(); const product = base(); product.skus[1].available = false; product.skus[1].inventoryStatus = 'UNAVAILABLE'; product.skus[1].stock = 0
  page.applyProduct(product); page.selectSku(product.skus[1]); assert.equal(page.selectedSkuId.value, '10')
  page.selectedSkuId.value = '11'; assert.equal(page.canPurchase.value, false); await page.addCart(); assert.deepEqual(cart.getCartEntries(), {})
  page.selectedSkuId.value = '999'; assert.equal(page.canPurchase.value, false); await page.buyNow(); assert.equal(navigation.length, 0)
})

test('local SKU quantity and parent purchase limits remain effective', () => {
  const product = { id: 1, stock: 9, price: 10, limitInfo: { enabled: true, remainingQuantity: 2 }, skus: [{ id: 3, stock: 4, price: 8, status: 1 }] }
  const sale = withProductSku(product, resolveProductSku(product))
  assert.equal(sale.stock, 4); assert.equal(sale.price, 8); assert.equal(resolvePurchaseQuantityLimit(sale), 2)
})

test('filtered disabled SKU response disables therapy purchase instead of using parent stock', async () => {
  const page = therapy()
  page.applyProduct({ ...base(), inventoryMode: 'LOCAL_COUNT', inventoryStatus: 'UNAVAILABLE',
    inventoryReason: 'SKU_DISABLED', available: false, stock: 0, skus: [] })

  assert.equal(page.canPurchase.value, false)
  await page.addCart()
  await page.buyNow()

  assert.deepEqual(cart.getCartEntries(), {})
  assert.equal(navigation.length, 0)
})

function confirmation(product, selected = ['101:11']) {
  let requests = 0
  const page = loadSetup('pages/order/confirm.vue', {
    ref: value => ({ value }), computed: getter => ({ get value() { return getter() } }), onLoad() {}, onShow() {}, onMounted() {},
    getSessionGeneration: () => 1, isCurrentSession: () => true, assertCurrentSession() {}, ...cart,
    getProductDetail: async () => { requests++; return product },
    resolveProductFlow: () => ({ valid: true, requiresConsultation: false, allTraditionalTherapy: true }),
    ORDER_TYPE_THERAPY: 4
  }, ['loadProducts', 'categories', 'selectedProductIds', 'selectionIssue'])
  page.selectedProductIds.value = selected
  return { ...page, requests: () => requests }
}

test('confirmation always queries chosen SKU price and inventory on every load', async () => {
  const product = base(); product.skus[1] = { ...product.skus[1], available: false, inventoryStatus: 'UNAVAILABLE', stock: 0 }
  cart.addCartItem(withProductSku(base(), base().skus[1]), 1)
  const page = confirmation(product)
  await page.loadProducts(); assert.equal(page.requests(), 1)
  await page.loadProducts(); assert.equal(page.requests(), 2)
  const selected = page.categories.value[0].products[0]
  assert.equal(selected.skuId, '11'); assert.equal(selected.price, 20); assert.equal(selected.stock, 0)
  assert.equal(selected.inventoryMode, 'HIS_AVAILABILITY'); assert.equal(selected.inventoryStatus, 'UNAVAILABLE')
  assert.equal(cart.validateCheckoutStock(['101:11'], page.categories.value).valid, false)
})

test('confirmation retains an invalid selected SKU as unavailable, preventing partial or substitute checkout', async () => {
  cart.addCartItem(withProductSku(base(), base().skus[1]), 1)
  const product = base(); product.skus = [product.skus[0]]
  const page = confirmation(product); await page.loadProducts(true)
  assert.equal(page.categories.value[0].products[0].skuId, '11')
  assert.equal(page.categories.value[0].products[0].available, false)
  assert.match(page.selectionIssue.value, /重新选择/)
  assert.equal(cart.validateCheckoutStock(['101:11'], page.categories.value).valid, false)
})

test('购物车缺失真实 SKU 时不能静默选择多规格中的任一项', async () => {
  const product = base()
  cart.replaceCartData({ 101: { productId: '101', quantity: 1, available: true, stock: null } })
  const page = confirmation(product, ['101']); await page.loadProducts(true)
  assert.match(page.selectionIssue.value, /重新选择/)
  assert.equal(cart.validateCheckoutStock(['101'], page.categories.value).valid, false)
})

test('商品仅有一条真实 SKU 时也不为缺少 skuId 的购物车条目猜配', async () => {
  const product = base(); product.skus = [product.skus[0]]
  assert.equal(cart.addCartItem(product, 2), false)
  cart.replaceCartData({ 101: { productId: '101', quantity: 2, available: true, stock: null } })
  const page = confirmation(product, ['101']); await page.loadProducts(true)
  assert.match(page.selectionIssue.value, /重新选择/)
  assert.equal(cart.validateCheckoutStock(['101'], page.categories.value).valid, false)
  assert.equal(page.categories.value[0].products[0].skuId, null)
})

test('medicine detail retains explicit SKU through refresh and does not substitute a removed selection', () => {
  const page = loadSetup('pages/products/medicine_detail.vue', {
    ref: value => ({ value }), computed: getter => ({ get value() { return getter() } }), getCurrentInstance: () => ({}),
    onLoad() {}, onShow() {}, onMounted() {}, onUnmounted() {}, getImageUrl: value => value, mapProductDetail: value => value,
    ...cart, isPurchaseAvailable, normalizePurchaseQuantity, resolvePurchaseQuantityLimit
  }, ['applyProduct', 'selectedSkuId', 'selectedSku', 'withSelectedSku', 'product'])
  page.selectedSkuId.value = '11'; page.applyProduct(base())
  assert.equal(page.withSelectedSku().skuId, '11'); assert.equal(page.withSelectedSku().price, 20)
  const product = base(); product.skus = [product.skus[0]]; page.applyProduct(product)
  assert.equal(page.selectedSkuId.value, '11'); assert.equal(page.selectedSku.value, null)
  assert.equal(isPurchaseAvailable(page.withSelectedSku()), false)
})
