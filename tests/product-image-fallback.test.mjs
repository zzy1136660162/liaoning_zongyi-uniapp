import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import test from 'node:test'
import { IMAGE_BASE_URL, getImageUrl } from '../utils/config.js'
import { withProductSku } from '../utils/product-sku.js'
import { getExternalUseLabel, getColdShippingLabel, isSelfDevelopedProduct } from '../utils/product-display.js'
import { loadOptions, loadSetup, PRODUCT_PLACEHOLDER, useProductImages } from './sfc-harness.mjs'

test('missing images use the bundled asset without changing the global URL helper', () => {
  const images = useProductImages()
  for (const value of [undefined, null, '', '   ', 0, false]) {
    assert.equal(images.getProductImageUrl(value), PRODUCT_PLACEHOLDER)
  }
  assert.equal(getImageUrl(null), '')
  assert.equal(getImageUrl('   '), '')
  const asset = new URL(`..${PRODUCT_PLACEHOLDER}`, import.meta.url)
  assert.ok(statSync(asset).size > 0)
  assert.deepEqual([...readFileSync(asset).subarray(0, 3)], [0xff, 0xd8, 0xff])
})

test('local, absolute and relative product images retain their expected URL', () => {
  const images = useProductImages()
  assert.equal(images.getProductImageUrl(' /static/images/example.jpg '), '/static/images/example.jpg')
  assert.equal(images.getProductImageUrl(' https://example.com/product.jpg '), 'https://example.com/product.jpg')
  assert.equal(images.getProductImageUrl('//example.com/product.jpg'), '//example.com/product.jpg')
  assert.equal(images.getProductImageUrl('/profile/product.jpg'), `${IMAGE_BASE_URL}/profile/product.jpg`)
  assert.equal(images.getProductImageUrl('profile/product.jpg'), `${IMAGE_BASE_URL}/profile/product.jpg`)
  assert.equal(images.getProductImageUrl(PRODUCT_PLACEHOLDER), PRODUCT_PLACEHOLDER)
})

test('failed URLs fall back consistently while other images and new URLs still load', () => {
  const images = useProductImages()
  images.handleProductImageError(' /profile/broken.jpg ')
  assert.equal(images.getProductImageUrl('/profile/broken.jpg'), PRODUCT_PLACEHOLDER)
  assert.equal(images.getProductImageUrl(`${IMAGE_BASE_URL}/profile/broken.jpg`), PRODUCT_PLACEHOLDER)
  assert.equal(images.getProductImageUrl('/profile/other.jpg'), `${IMAGE_BASE_URL}/profile/other.jpg`)
  assert.equal(images.getProductImageUrl('/profile/broken.jpg?v=2'), `${IMAGE_BASE_URL}/profile/broken.jpg?v=2`)
  for (let attempt = 0; attempt < 3; attempt++) {
    images.handleProductImageError('/profile/broken.jpg')
    images.handleProductImageError(PRODUCT_PLACEHOLDER)
    images.handleProductImageError(null)
  }
  assert.equal(images.getProductImageUrl(PRODUCT_PLACEHOLDER), PRODUCT_PLACEHOLDER)
  assert.equal(images.getProductImageUrl('/profile/other.jpg'), `${IMAGE_BASE_URL}/profile/other.jpg`)
})

test('image failures are isolated between page instances', () => {
  const first = useProductImages(), second = useProductImages()
  first.handleProductImageError('https://example.com/product.jpg')
  assert.equal(first.getProductImageUrl('https://example.com/product.jpg'), PRODUCT_PLACEHOLDER)
  assert.equal(second.getProductImageUrl('https://example.com/product.jpg'), 'https://example.com/product.jpg')
})

test('a SKU without its own image still inherits the parent product image', () => {
  const images = useProductImages()
  const product = { id: 1, image: '/profile/parent.jpg' }
  assert.equal(images.getProductImageUrl(withProductSku(product, { id: 2, image: '', imageUrl: '' }).image), `${IMAGE_BASE_URL}/profile/parent.jpg`)
  assert.equal(images.getProductImageUrl(withProductSku(product, { id: 2, image: '/profile/sku.jpg' }).image), `${IMAGE_BASE_URL}/profile/sku.jpg`)
})

const detail = name => loadSetup(`pages/products/${name}.vue`, {
  ref: value => ({ value }), computed: getter => ({ get value() { return getter() } }),
  getCurrentInstance: () => ({}), onLoad() {}, onShow() {}, onMounted() {}, onUnmounted() {}, getImageUrl
}, ['product', 'productImages', 'getProductImageUrl', 'handleProductImageError', ...(name === 'medicine_detail' ? ['selectedSkuId'] : [])])

for (const name of ['medicine_detail', 'therapy_detail']) {
  test(`${name}: missing cover, gallery selection and failed banner use the same fallback`, () => {
    const page = detail(name)
    assert.equal(page.product.value.image, '')
    assert.deepEqual(page.productImages.value.map(page.getProductImageUrl), [PRODUCT_PLACEHOLDER])
    page.product.value = { image: '/profile/cover.jpg', images: ['/profile/gallery.jpg'], skus: [] }
    assert.deepEqual(page.productImages.value.map(page.getProductImageUrl), [`${IMAGE_BASE_URL}/profile/gallery.jpg`])
    page.handleProductImageError('/profile/gallery.jpg')
    assert.deepEqual(page.productImages.value.map(page.getProductImageUrl), [PRODUCT_PLACEHOLDER])
    page.product.value.images = []
    assert.deepEqual(page.productImages.value.map(page.getProductImageUrl), [`${IMAGE_BASE_URL}/profile/cover.jpg`])
  })
}

test('medicine detail keeps selected SKU image ahead of gallery and parent cover', () => {
  const page = detail('medicine_detail')
  page.product.value = { id: 1, image: '/profile/cover.jpg', images: ['/profile/gallery.jpg'],
    skus: [{ id: 2, image: '/profile/sku.jpg', status: 1 }, { id: 3, image: '', status: 1 }] }
  page.selectedSkuId.value = 2
  assert.deepEqual(page.productImages.value.map(page.getProductImageUrl), [`${IMAGE_BASE_URL}/profile/sku.jpg`])
  page.selectedSkuId.value = 3
  assert.deepEqual(page.productImages.value.map(page.getProductImageUrl), [`${IMAGE_BASE_URL}/profile/gallery.jpg`])
})

for (const name of ['medicine_list', 'priducts_list', 'priducts_list2']) {
  test(`${name}: Options setup exposes working image fallback methods`, () => {
    const page = loadOptions(`pages/products/${name}.vue`, { TabBar: {}, getImageUrl, getExternalUseLabel, getColdShippingLabel, isSelfDevelopedProduct })
    const images = page.setup()
    assert.equal(images.getProductImageUrl(null), PRODUCT_PLACEHOLDER)
    images.handleProductImageError('/profile/broken.jpg')
    assert.equal(images.getProductImageUrl('/profile/broken.jpg'), PRODUCT_PLACEHOLDER)
  })
}

test('registered product pages bind failures to the original displayed image source', () => {
  for (const name of ['medicine_index', 'medicine_list', 'priducts_list', 'priducts_list2', 'medicine_detail', 'therapy_detail', 'priducts_detail']) {
    const source = readFileSync(new URL(`../pages/products/${name}.vue`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /zhongyi_gaoyao1\.png/, name)
    const imageTags = source.match(/<image\b[^>]*>/g) || []
    const productImages = imageTags.filter(tag => /class="(?:product-image|recommend-img|banner-img|detail-img|banner)"/.test(tag))
    assert.ok(productImages.length, name)
    for (const image of productImages) {
      const argument = image.match(/:src="getProductImageUrl\(([^)]+)\)"/)?.[1]
      assert.ok(argument, `${name}: ${image}`)
      assert.ok(image.includes(`@error="handleProductImageError(${argument})"`), `${name}: missing matching error handler`)
    }
  }
})
