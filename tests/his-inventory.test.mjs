import { normalizeCartId as normalizeId } from '../utils/cart-key.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { inventoryFields, inventoryStock } from '../utils/inventory.js'
import { isPurchaseAvailable, resolvePurchaseQuantityLimit } from '../utils/purchase-quantity.js'

const storage = new Map()
globalThis.uni = { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key), $emit() {} }
const cart = await import('./cart-api-fixture.mjs')
const available = { id: 1, productCategory: 2, inventoryMode: 'HIS_AVAILABILITY', inventoryStatus: 'AVAILABLE', available: true, stock: null, inventoryCheckedAt: '2020-01-01T00:00:00', name: 'fixture', price: 10 }
const moduleCode = (path, mocks, names) => {
  const code = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace(/^export /gm, '')
  return Function(...Object.keys(mocks), `${code}\nreturn { ${names.join(',')} }`)(...Object.values(mocks))
}

test('HIS old successful availability has no quantity cap or expiry; purchase limits still apply', async () => {
  assert.equal(inventoryStock(null, 0), null)
  assert.equal(isPurchaseAvailable(available), true)
  assert.equal(resolvePurchaseQuantityLimit(available), null)
  assert.equal(resolvePurchaseQuantityLimit({ ...available, limitInfo: { enabled: true, remainingQuantity: 2 } }), 2)
  assert.equal(isPurchaseAvailable({ ...available, inventoryStatus: 'UNAVAILABLE', stock: 0 }), false)
  assert.equal(isPurchaseAvailable({ ...available, available: false }), false)
  assert.equal(isPurchaseAvailable({ ...available, inventoryStatus: undefined }), false)
})

test('product and SKU mappings preserve null stock and disabled SKU status', async () => {
  const { mapProductDetail } = moduleCode('api/product.js', { inventoryFields, inventoryStock, getImageUrl: x => x || '' }, ['mapProductDetail'])
  const mapped = mapProductDetail({ ...available, skus: [{ ...available, id: 11, status: 0 }] })
  assert.equal(mapped.stock, null)
  assert.equal(mapped.skus[0].stock, null)
  assert.equal(mapped.skus[0].status, 0)
  assert.equal(mapped.skus[0].inventoryStatus, 'AVAILABLE')
})

test('服务端HIS可售刷新恢复购物车，商品投影不持久化派生状态', async () => {
  storage.clear()
  cart.replaceCartData({ '1:11': { productId: 1, skuId: 11, selected: false, quantity: 3, stock: 0, available: false, inventoryMode: 'HIS_AVAILABILITY', inventoryStatus: 'UNAVAILABLE' } })
  const product = { ...available, productId: 1, skuId: 11, quantity: 3, selected: false }
  cart.cartApiFixture.seed({ '1:11': product })
  await cart.refreshCart()
  const products = [{ ...product, id: '1:11' }]
  let items = cart.loadCartItems([{ products }])
  assert.equal(items[0].stock, null)
  assert.equal(items[0].available, true)
  await cart.updateProductSelection('1:11', true)
  assert.equal(cart.prepareCheckout(['1:11'], [{ products }]).valid, true)
  products[0].inventoryCheckedAt = '2026-10-14T00:00:00'
  items = cart.loadCartItems([{ products }])
  assert.equal(items[0].inventoryCheckedAt, products[0].inventoryCheckedAt)
  assert.equal(cart.getCartEntries()['1:11'].inventoryCheckedAt, available.inventoryCheckedAt)
  assert.equal(items[0].quantity, 3)
  assert.equal(cart.prepareCheckout(['1:11'], [{ products: [available] }]).valid, false, 'explicit missing SKU never falls back to product availability')
})

test('successful order response is independent of slow or failed HIS hint in both order entry points', async () => {
  const paths = { ORDER: { CREATE: '/create', FROM_PRESCRIPTION: '/prescription' } }
  const calls = []
  const { createOrder, createOrderFromPrescription } = moduleCode('api/order.js', {
    API_PATHS: paths, post: (path, payload, options) => {
      calls.push({ path, payload, options })
      return path.endsWith('his-inventory-sync') ? new Promise(() => {}) : Promise.resolve({ id: 7 })
    }
  }, ['createOrder', 'createOrderFromPrescription'])
  for (const create of [createOrder, createOrderFromPrescription]) assert.equal((await create({})).id, 7)
  const hints = calls.filter(c => c.path.endsWith('his-inventory-sync'))
  assert.equal(hints.length, 2)
  for (const hint of hints) { assert.equal(hint.options.silent, true); assert.deepEqual(hint.payload, {}); assert.equal(hint.options.authRedirect, false) }
})

test('重新加载购物车只取服务端可售结果，不合并旧本地或被拒绝的规格', async () => {
  storage.set('cart_items', { '1:12': { productId: 1, skuId: 12, quantity: 2 } })
  cart.cartApiFixture.seed({ '1:11': { ...available, productId: 1, skuId: 11, quantity: 1 } })
  await cart.refreshCart()
  const entries = cart.getCartEntries()
  assert.deepEqual(Object.keys(entries), ['1:11'])
  assert.equal(entries['1:11'].stock, null)
  assert.equal(entries['1:11'].available, true)
  assert.ok(cart.cartApiFixture.requests.every(request => request.method === 'GET'))
})

test('旧本地缺SKU条目不会经同步或默认规格写回后台', async () => {
  storage.set('cart_items', { '1': { productId: 1, quantity: 2 } })
  cart.cartApiFixture.seed({})
  await cart.refreshCart()
  assert.deepEqual(cart.getCartEntries(), {})
  assert.ok(cart.cartApiFixture.requests.every(request => request.method === 'GET'))
})
