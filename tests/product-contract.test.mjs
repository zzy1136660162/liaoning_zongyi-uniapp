import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { inventoryFields, inventoryStock } from '../utils/inventory.js'
import { formatRichText } from '../utils/product-rich-text.js'
import { resolveProductFlowType, resolveGoodsMerchantType } from '../utils/product-biz.js'
import { isSelfDevelopedProduct } from '../utils/product-display.js'
import { resolvePurchaseQuantityLimit } from '../utils/purchase-quantity.js'
import { resolveProductSku, withProductSku } from '../utils/product-sku.js'
import { loadSetup } from './sfc-harness.mjs'

const source = readFileSync(new URL('../api/product.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '').replace(/^export /gm, '')
const { mapProductDetail } = Function('inventoryFields', 'inventoryStock', 'getImageUrl',
  `${source}\nreturn { mapProductDetail }`
)(inventoryFields, inventoryStock, value => value || '')

test('商品接口按当前 camelCase 字段映射，保留库存、规格与限购规则', () => {
  const mapped = mapProductDetail({
    id: 1, productName: '当前商品', coverImage: '/cover.jpg', galleryImages: '["/gallery.jpg"]',
    status: 1, delSign: 0, goodsMerchantType: 1, productCategory: 1,
    stock: 10, isSelfDeveloped: 0,
    skus: [{ id: 2, productId: 1, skuName: '当前规格', imageUrl: '/sku.jpg', price: 5, stock: null, status: 1, delSign: 0 }],
    limitInfo: { enabled: true, remainingQuantity: 0, text: '已达限购额度' }
  })
  assert.equal(mapped.name, '当前商品')
  assert.equal(mapped.image, '/cover.jpg')
  assert.deepEqual(mapped.images, ['/gallery.jpg'])
  assert.equal(mapped.skus[0].image, '/sku.jpg')
  assert.equal(mapped.skus[0].stock, null)
  assert.equal(mapped.skus[0].delSign, 0)
  assert.equal(resolvePurchaseQuantityLimit(mapped), 0)
  assert.equal(isSelfDevelopedProduct(mapped), false)
})

test('旧商品字段和旧规格列表不再作为当前数据使用', () => {
  const mapped = mapProductDetail({ id: 1, product_name: '旧名称', name: '旧视图名称',
    cover_image: '/old.jpg', image: '/old-view.jpg', productImage: '/old-product.jpg',
    skuList: [{ id: 2 }], limit_info: { enabled: true, remaining_quantity: 0 },
    is_self_developed: 1 })
  assert.equal(mapped.name, '')
  assert.equal(mapped.image, '')
  assert.deepEqual(mapped.skus, [])
  assert.deepEqual(mapped.images, [])
  assert.equal(mapped.limitInfo.enabled, false)
  assert.equal(isSelfDevelopedProduct({ is_self_developed: 1 }), false)
  assert.equal(resolveProductFlowType({ goodsMerchantType: 2 }), 'direct')
  assert.equal(resolveGoodsMerchantType({ productCategory: 2, goodsMerchantType: 1 }), 1)
})

test('商品图集解析后台逗号路径，兼容 JSON 数组并在空图集时回退主图', () => {
  for (const [galleryImages, expected] of [
    ['/one.jpg,/two.jpg', ['/one.jpg', '/two.jpg']],
    [' /one.jpg , , /two.jpg, ', ['/one.jpg', '/two.jpg']],
    ['/single.jpg', ['/single.jpg']],
    ['https://example.com/one.jpg,/profile/two.jpg', ['https://example.com/one.jpg', '/profile/two.jpg']],
    ['/one%2Ctwo.jpg', ['/one%2Ctwo.jpg']],
    ['[" /one.jpg ", "", null, 42, {}, "/two.jpg"]', ['/one.jpg', '/two.jpg']],
    ['[]', ['/cover.jpg']],
    ['["/broken.jpg"', ['/cover.jpg']],
    [' , , ', ['/cover.jpg']],
    ['', ['/cover.jpg']],
    [null, ['/cover.jpg']]
  ]) {
    assert.deepEqual(mapProductDetail({ galleryImages, coverImage: '/cover.jpg' }).images, expected, String(galleryImages))
  }
  assert.deepEqual(mapProductDetail({ galleryImages: ' , ' }).images, [])
})

for (const name of ['medicine_detail', 'therapy_detail']) {
  test(`${name}: 后台逗号图集进入实际详情轮播`, () => {
    const page = loadSetup(`pages/products/${name}.vue`, {
      ref: value => ({ value }), computed: getter => ({ get value() { return getter() } }),
      getCurrentInstance: () => ({}), onLoad() {}, onShow() {}, onMounted() {}, onUnmounted() {},
      getImageUrl: value => value
    }, ['product', 'productImages'])
    page.product.value = mapProductDetail({ coverImage: '/cover.jpg', galleryImages: '/one.jpg,/two.jpg' })
    assert.deepEqual(page.productImages.value, ['/one.jpg', '/two.jpg'])
  })
}

test('详情只接受商品 id，不从路由中的旧商品对象恢复身份', async () => {
  for (const name of ['medicine_detail', 'therapy_detail']) {
    let load, show, calls = 0
    loadSetup(`pages/products/${name}.vue`, {
      ref: value => ({ value }), computed: getter => ({ get value() { return getter() } }), getCurrentInstance: () => ({}),
      onLoad: callback => { load = callback }, onShow: callback => { show = callback }, onMounted() {}, onUnmounted() {},
      onSessionChanged: () => () => {}, getSessionGeneration: () => 1, getCartTotalQuantity: () => 0,
      getImageUrl: value => value, getProductDetail: async () => { calls++ }, logPageView() {}
    }, ['product'])
    load({ product: encodeURIComponent(JSON.stringify({ id: 1 })) })
    await show()
    assert.equal(calls, 0)
  }
})

test('共享商品富文本保留文字，统一图片宽度并处理空内容', () => {
  assert.equal(formatRichText(null), '')
  const html = formatRichText('&lt;p&gt;说明&lt;/p&gt;<img src="/one.jpg" style="width:900px;height:300px;color:red"><img src="/two.jpg">')
  assert.match(html, /<p>说明<\/p>/)
  assert.doesNotMatch(html, /width:900px|height:300px/)
  assert.equal((html.match(/max-width:100%/g) || []).length, 2)
  assert.match(html, /color:red/)
})

test('没有真实规格时仅展示商品，不把主表价格和库存作为可售规格', () => {
  const product = { id: 1, price: 50, stock: 20, available: true, skus: [] }
  assert.throws(() => resolveProductSku(product), /未配置可售规格/)
  const sale = withProductSku(product, null)
  assert.equal(sale.available, false)
  assert.equal(sale.stock, 0)
  assert.equal(sale.inventoryReason, 'SKU_SELECTION_REQUIRED')
})

test('真实 SKU 缺少售价或库存时不可售，不回退到父商品聚合字段', () => {
  const product = { id: 1, price: 99, stock: 100, available: true }
  for (const sku of [{ id: 2, stock: 5 }, { id: 2, price: 5 }, { id: 2, price: null, stock: 5 }]) {
    const sale = withProductSku(product, sku)
    assert.equal(sale.available, false)
    assert.equal(sale.stock, 0)
    assert.equal(resolvePurchaseQuantityLimit(sale), 0)
  }
  const freeUnlimited = withProductSku(product, { id: 2, price: 0, stock: null })
  assert.equal(freeUnlimited.price, 0)
  assert.equal(freeUnlimited.stock, null)
  assert.equal(resolvePurchaseQuantityLimit(freeUnlimited), null)
  const mapped = mapProductDetail({ ...product, skus: [{ id: 2, stock: 5 }] })
  assert.equal(mapped.skus[0].price, undefined)
  assert.equal(withProductSku(mapped, mapped.skus[0]).available, false)
})


test('商品接口只发购买分类 productCategory；目录 categoryId 可与购买分类独立筛选', async () => {
  const calls = []
  const api = Function('get', 'post', 'API_PATHS', 'inventoryFields', 'inventoryStock', 'getImageUrl',
    `${source}\nreturn { getCategoryList, getCategoryProducts, mapProductListItem }`
  )((url, data) => { calls.push({ url, data }); return Promise.resolve([]) },
    (url, data) => { calls.push({ url, data }); return Promise.resolve({ records: [] }) },
    { CATEGORY: { LIST: '/categories', PRODUCTS: '/products' } }, inventoryFields, inventoryStock, value => value)
  await api.getCategoryList(3)
  await api.getCategoryProducts(812, 2, 20, 2, 'price', 'asc', '关键词')
  assert.deepEqual(calls[0].data, { productCategory: 3 })
  assert.equal(calls[1].data.productCategory, 2)
  assert.equal(calls[1].data.categoryId, 812)
  assert.equal(calls[1].data.keyword, '关键词')
  assert.equal('bizType' in calls[1].data, false)
  assert.equal('bizType' in api.mapProductListItem({ id: 1, productCategory: 3, bizType: 1 }), false)
})
