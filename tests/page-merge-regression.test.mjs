import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const cartPage = read('pages/cart/cart.vue')
const healthListPage = read('pages/products/priducts_list.vue')
const healthListMethods = read('utils/health-product-list.js')

assert.match(cartPage, /isItemSelectable\(item\)/)
assert.match(cartPage, /isQuantityAtStockLimit\(item\)/)
assert.match(cartPage, /checkout\.requiresConsultation/)
assert.match(cartPage, /logPageView\(\{/)
assert.match(cartPage, /refreshCart/)
assert.doesNotMatch(cartPage, /loadLocalCartFallback/)


assert.match(healthListPage, /handleSearch\(e\)/)
assert.match(healthListPage, /this\.getSearchKeyword\(\)\s*&&\s*this\.currentCategoryId !== 'all'/)
assert.match(healthListMethods, /this\.getSearchKeyword\(\)\s*\)/)
assert.match(healthListPage, /createHealthProductListMethods/)
assert.match(healthListMethods, /requestSeq/)
assert.doesNotMatch(healthListPage, /handleSearch\(\)\s*\{\}/)
