import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatFreightEstimate } from '../utils/freight.js'
import { withProductSku } from '../utils/product-sku.js'

test('到付报价区分真实零值、缺失值及测试报价', () => {
  assert.match(formatFreightEstimate(12, 'SF_PROD'), /预计 ¥12.00.*到付.*不计入/)
  assert.match(formatFreightEstimate(12, 'SF_TEST'), /测试预估/)
  assert.match(formatFreightEstimate(0), /¥0.00/)
  for (const value of [null, undefined, '', NaN, -1]) {
    assert.equal(formatFreightEstimate(value), '运费到付，以快递员实际收取为准')
  }
})

test('规格重量优先，未维护规格重量时沿用商品重量', () => {
  const product = { id: 1, weight: 0.2 }
  const sku = { id: 2, price: 10, stock: 10, weight: 0.5 }
  assert.equal(withProductSku(product, sku).weight, 0.5)
  assert.equal(withProductSku(product, { ...sku, weight: null }).weight, 0.2)
})
