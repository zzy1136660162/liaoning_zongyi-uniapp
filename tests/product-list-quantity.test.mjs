import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { readFileSync } from 'node:fs'
import * as cart from './cart-api-fixture.mjs'
import { inventoryFields, inventoryStock } from '../utils/inventory.js'
import { loadOptions, loadSetup } from './sfc-harness.mjs'
import { isPurchaseAvailable, normalizePurchaseQuantity, resolvePurchaseQuantityLimit } from '../utils/purchase-quantity.js'
import { buildListCartCategories } from '../utils/product-list-cart.js'

const storage = new Map(), navigations = [], messages = []
globalThis.uni = {
  getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key), $emit() {}, showLoading() {}, hideLoading() {},
  navigateTo: value => navigations.push(value), showToast: value => messages.push(value)
}
beforeEach(async () => { storage.clear(); navigations.length = 0; messages.length = 0 })
const source = readFileSync(new URL('../api/product.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '').replace(/^export /gm, '')
const { mapProductDetail } = Function('inventoryFields', 'inventoryStock', 'getImageUrl',
  `${source}\nreturn { mapProductDetail }`
)(inventoryFields, inventoryStock, value => value || '')
const detail = () => ({ id: 10, productName: '当前商品', price: 999, stock: 999, status: 1,
  productCategory: 2, goodsMerchantType: 2, needQuestionnaire: 0,
  skus: [{ id: 11, price: 5, stock: 6, status: 1, defaultFlag: 1 }, { id: 12, price: 8, stock: 9, status: 1 }] })

function list(name, product = detail()) {
  const definition = loadOptions(`pages/products/${name}.vue`, {
    ...cart, getToken: () => 'fixture', getProductDetail: async () => product, mapProductDetail,
    getApp: () => ({ globalData: { mallIntroPlayed: true } }),
    TabBar: {}, getImageUrl: value => value,
    getExternalUseLabel() {}, getColdShippingLabel() {}, isSelfDevelopedProduct() {}
  })
  return { ...definition.data(), ...definition.methods, categories: [], verifiedProducts: cart.getCartEntries(),
    ensureLogin: () => true, ensureCartCompatible: () => true,
    updateCartView: definition.methods.updateCartView }
}

test('列表结算投影保留当前商品范围，并使用实际 SKU 价格与库存', async () => {
  const categories = [{ id: 1, products: [{ id: 10, price: 999, stock: 999 }] }]
  const entries = {
    '10:11': { productId: 10, skuId: 11, quantity: 2, price: 5, stock: 6 },
    '20:21': { productId: 20, skuId: 21, quantity: 4, price: 8, stock: 9 }
  }
  const products = buildListCartCategories(categories, entries)[0].products
  assert.deepEqual(products.map(product => product.id), ['10:11'])
  assert.equal(products[0].price, 5)
  assert.equal(products[0].stock, 6)
  assert.equal(categories[0].products[0].stock, 999)
})

for (const name of ['medicine_list', 'priducts_list', 'priducts_list2']) {
  test(`${name}: 首次快捷加购重读详情并落真实默认 SKU，不使用列表汇总价格`, async () => {
    const page = list(name)
    await (page.handleAddToCart || page.goToNotice).call(page, { id: 10, price: 9999, stock: 9999 })
    const entry = cart.getCartEntries()['10:11']
    assert.equal(entry.skuId, '11')
    assert.equal(entry.price, 5)
    assert.equal(entry.stock, 6)
    assert.equal(entry.quantity, 1)
    assert.equal(cart.getCartEntries()['10'], undefined)
  })

  test(`${name}: 单个已加购 SKU 直接增减，其他商品不受影响`, async () => {
    cart.replaceCartData({
      '10:11': { productId: 10, skuId: 11, quantity: 2, stock: 6, available: true },
      '20:21': { productId: 20, skuId: 21, quantity: 4, stock: 9, available: true }
    })
    const page = list(name)
    await page.increaseQuantity({ id: 10 })
    assert.equal(cart.getCartEntries()['10:11'].quantity, 3)
    await page.decreaseQuantity({ id: 10 })
    assert.equal(cart.getCartEntries()['10:11'].quantity, 2)
    assert.equal(cart.getCartEntries()['20:21'].quantity, 4)
    assert.equal(navigations.length, 0)
  })

  test(`${name}: 多个已加购 SKU 显示总量，点击加减只进购物车且不改任意规格`, async () => {
    cart.replaceCartData({
      '10:11': { productId: 10, skuId: 11, quantity: 2, stock: 6, available: true },
      '10:12': { productId: 10, skuId: 12, quantity: 3, stock: 9, available: true }
    })
    const page = list(name), before = structuredClone(cart.getCartEntries())
    assert.equal(page.getProductQuantity(10), 5)
    await page.increaseQuantity({ id: 10 })
    await page.decreaseQuantity({ id: 10 })
    if (page.onNumberBoxChange) await page.onNumberBoxChange({ id: 10 }, 6)
    assert.deepEqual(cart.getCartEntries(), before)
    assert.ok(navigations.length >= 2)
    assert.ok(navigations.every(item => item.url === '/pages/cart/cart'))
  })

  test(`${name}: 无真实规格或当前已售罄时不能快捷加购`, async () => {
    for (const product of [{ ...detail(), skus: [] }, { ...detail(), available: false }]) {
      const page = list(name, product)
      await (page.handleAddToCart || page.goToNotice).call(page, { id: 10 })
      assert.deepEqual(cart.getCartEntries(), {})
    }
  })
}

for (const name of ['medicine_detail', 'therapy_detail']) {
  const recommendation = (fetchProduct = async () => detail()) => loadSetup(`pages/products/${name}.vue`, {
    ...cart, ref: value => ({ value }), computed: getter => ({ get value() { return getter() } }),
    getCurrentInstance: () => ({}), onLoad() {}, onShow() {}, onMounted() {}, onUnmounted() {},
    getToken: () => 'fixture', getImageUrl: value => value, getSessionGeneration: () => 1, isCurrentSession: () => true,
    getProductDetail: fetchProduct, mapProductDetail, isPurchaseAvailable, normalizePurchaseQuantity,
    resolvePurchaseQuantityLimit,  console: { log() {}, info() {}, warn() {}, error() {} }
  }, ['flyToCart', 'handlePurchaseAction'])

  test(`${name}: 缺少问卷配置仍可加购，但立即购买会阻断，已绑定时只在购买答题`, async () => {
    const page = recommendation(), current = { ...detail(), id: 10, productId: 10, skuId: 11,
      price: 5, stock: 6, available: true, needQuestionnaire: 1, questionnaireId: null }
    await page.handlePurchaseAction('cart', current, 2)
    assert.equal(cart.getCartProductInfo(10, 11).quantity, 2)
    assert.equal(navigations.length, 0)
    await page.handlePurchaseAction('buy', current, 2)
    assert.equal(navigations.length, 0)
    assert.match(messages.at(-1).title, /问卷暂不可用/)
    await page.handlePurchaseAction('buy', { ...current, questionnaireId: 90 }, 2)
    assert.match(navigations.at(-1).url, /product_notice\?id=10/)
    assert.match(navigations.at(-1).url, /action=buy/)
    assert.match(navigations.at(-1).url, /skuId=11/)
  })

  test(`${name}: 推荐商品快捷加购读取真实 SKU，已有单规格只递增该规格`, async () => {
    const page = recommendation()
    await page.flyToCart({}, { id: 10, price: 999 })
    assert.equal(cart.getCartEntries()['10:11'].price, 5)
    assert.equal(cart.getCartEntries()['10:11'].quantity, 1)
    await page.flyToCart({}, { id: 10, price: 999 })
    assert.equal(cart.getCartEntries()['10:11'].quantity, 2)
  })

  test(`${name}: 推荐商品已有多个规格时进入购物车，不把总量写入默认规格`, async () => {
    cart.replaceCartData({
      '10:11': { productId: 10, skuId: 11, quantity: 2, stock: 6, available: true },
      '10:12': { productId: 10, skuId: 12, quantity: 3, stock: 9, available: true }
    })
    const before = structuredClone(cart.getCartEntries())
    await recommendation().flyToCart({}, { id: 10 })
    assert.deepEqual(cart.getCartEntries(), before)
    assert.equal(navigations.at(-1).url, '/pages/cart/cart')
  })

  test(`${name}: 连续两次推荐加购按返回时最新数量累加，不丢失一次点击`, async () => {
    cart.replaceCartData({ '10:11': { productId: 10, skuId: 11, quantity: 1, stock: 6, price: 5, available: true } })
    const pending = [], page = recommendation(() => new Promise(resolve => pending.push(resolve)))
    const first = page.flyToCart({}, { id: 10 }), second = page.flyToCart({}, { id: 10 })
    await Promise.resolve(); await Promise.resolve()
    pending[1](detail()); await second
    pending[0](detail()); await first
    assert.equal(cart.getCartEntries()['10:11'].quantity, 3)
  })

  test(`${name}: 推荐详情读取期间新增另一规格，返回后进入购物车且不改任意数量`, async () => {
    cart.replaceCartData({ '10:11': { productId: 10, skuId: 11, quantity: 2, stock: 6, available: true } })
    let finish
    const request = recommendation(() => new Promise(resolve => { finish = resolve })).flyToCart({}, { id: 10 })
    await Promise.resolve(); await Promise.resolve()
    cart.replaceCartData({
      '10:11': { productId: 10, skuId: 11, quantity: 2, stock: 6, available: true },
      '10:12': { productId: 10, skuId: 12, quantity: 3, stock: 9, available: true }
    })
    const before = structuredClone(cart.getCartEntries())
    await Promise.resolve(); await Promise.resolve()
    finish(detail()); await request
    assert.deepEqual(cart.getCartEntries(), before)
    assert.equal(navigations.at(-1).url, '/pages/cart/cart')
  })
}
