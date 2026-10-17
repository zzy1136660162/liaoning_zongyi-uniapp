import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { inventoryFields, inventoryStock } from '../utils/inventory.js'
import { isPurchaseAvailable, resolvePurchaseQuantityLimit } from '../utils/purchase-quantity.js'

const storage = new Map()
globalThis.uni = { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key), $emit() {} }
const cart = await import('../utils/cart.js')
const available = { id: 1, inventoryMode: 'HIS_AVAILABILITY', inventoryStatus: 'AVAILABLE', available: true, stock: null, inventoryCheckedAt: '2020-01-01T00:00:00', name: 'fixture', price: 10 }
const moduleCode = (path, mocks, names) => {
  const code = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace(/^export /gm, '')
  return Function(...Object.keys(mocks), `${code}\nreturn { ${names.join(',')} }`)(...Object.values(mocks))
}

test('HIS old successful availability has no quantity cap or expiry; purchase limits still apply', () => {
  assert.equal(inventoryStock(null, 0), null)
  assert.equal(isPurchaseAvailable(available), true)
  assert.equal(resolvePurchaseQuantityLimit(available), null)
  assert.equal(resolvePurchaseQuantityLimit({ ...available, limitInfo: { enabled: true, remainingQuantity: 2 } }), 2)
  assert.equal(isPurchaseAvailable({ ...available, inventoryStatus: 'UNAVAILABLE', stock: 0 }), false)
  assert.equal(isPurchaseAvailable({ ...available, available: false }), false)
  assert.equal(isPurchaseAvailable({ ...available, inventoryStatus: undefined }), false)
})

test('product and SKU mappings preserve null stock and disabled SKU status', () => {
  const { mapProductDetail } = moduleCode('api/product.js', { inventoryFields, inventoryStock, getImageUrl: x => x || '' }, ['mapProductDetail'])
  const mapped = mapProductDetail({ ...available, skus: [{ ...available, id: 11, status: 0 }] })
  assert.equal(mapped.stock, null)
  assert.equal(mapped.skus[0].stock, null)
  assert.equal(mapped.skus[0].status, 0)
  assert.equal(mapped.skus[0].inventoryStatus, 'AVAILABLE')
})

test('cart recovers from old zero to HIS availability and saves metadata-only updates', () => {
  storage.clear()
  cart.replaceCartData({ '1:11': { productId: 1, skuId: 11, verified: true, selected: false, quantity: 3, stock: 0, available: false, inventoryMode: 'HIS_AVAILABILITY', inventoryStatus: 'UNAVAILABLE' } })
  const products = [{ ...available, id: '1:11', productId: 1, skuId: 11 }]
  let items = cart.loadCartItems([{ products }])
  assert.equal(items[0].stock, null)
  assert.equal(items[0].available, true)
  cart.updateProductSelection('1:11', true)
  assert.equal(cart.prepareCheckout(['1:11'], [{ products }]).valid, true)
  products[0].inventoryCheckedAt = '2026-10-14T00:00:00'
  items = cart.loadCartItems([{ products }])
  assert.equal(cart.getCartEntries()['1:11'].inventoryCheckedAt, products[0].inventoryCheckedAt)
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

test('login merge preserves rejected local SKU as unselected unavailable without affecting ordinary replacement', async () => {
  let entries = { '1:12': { productId: '1', skuId: '12', quantity: 2, verified: true, selected: true, stock: 7 } }
  const { syncCartOnLogin, applyServerCartToLocal } = moduleCode('utils/cart-sync.js', {
    inventoryFields, onSessionChanged() {}, getSessionGeneration: () => 1, isCurrentSession: () => true,
    getToken: () => 'fixture', getCartEntries: () => entries, replaceCartData: value => { entries = value },
    buildCartItemKey: cart.buildCartItemKey, buildCartSyncPayload: () => ({}), syncCart: async () => [{ ...available, productId: 1, skuId: 11, quantity: 1, checked: 1 }]
  }, ['syncCartOnLogin', 'applyServerCartToLocal'])
  await syncCartOnLogin()
  assert.equal(entries['1:12'].selected, false); assert.equal(entries['1:12'].available, false)
  assert.equal(entries['1:11'].stock, null); assert.equal(entries['1:11'].available, true)
  applyServerCartToLocal([]); assert.deepEqual(entries, {})
})
