import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const cartPage = read('pages/cart/cart.vue')
const healthListPage = read('pages/products/priducts_list.vue')

assert.match(cartPage, /isItemSelectable\(item\)/)
assert.match(cartPage, /isQuantityAtStockLimit\(item\)/)
assert.match(cartPage, /checkout\.requiresConsultation/)
assert.match(cartPage, /logPageView\('CART'\)/)
assert.match(cartPage, /productCategory:\s*productDetail\.productCategory/)
assert.match(cartPage, /isPrescription:\s*productDetail\.isPrescription/)

assert.match(healthListPage, /handleSearch\(e\)/)
assert.match(healthListPage, /this\.getSearchKeyword\(\)\s*&&\s*this\.currentCategoryId !== 'all'/)
assert.match(healthListPage, /this\.getSearchKeyword\(\)\s*\)/)
assert.match(healthListPage, /requestSeq/)
assert.doesNotMatch(healthListPage, /handleSearch\(\)\s*\{\}/)
