import test from 'node:test'
import assert from 'node:assert/strict'
import { isTraditionalTherapyProduct } from '../utils/therapy.js'
import { resolveProductFlow } from '../utils/product-biz.js'

test('server-resolved therapy ancestry works with any leaf category id', () => {
  const product = { categoryId: 812, categoryCode: '传统疗法', bizType: 1 }
  assert.equal(isTraditionalTherapyProduct(product), true)
  assert.equal(resolveProductFlow([product]).allTraditionalTherapy, true)
  assert.equal(isTraditionalTherapyProduct({ category_id: 812, category_code: '传统疗法' }), true)
})

test('explicit ordinary classification overrides old hardcoded root id', () => {
  const product = { categoryId: 34, categoryCode: 'GOODS', productCategory: 2, bizType: 1 }
  assert.equal(isTraditionalTherapyProduct(product), false)
  assert.equal(resolveProductFlow([product]).allTraditionalTherapy, false)
})

test('legacy root fallback only applies without a resolved business code', () => {
  assert.equal(isTraditionalTherapyProduct({ categoryId: 34 }), true)
  assert.equal(isTraditionalTherapyProduct({ categoryId: 812 }), false)
  assert.equal(isTraditionalTherapyProduct({ categoryCode: ' 传统疗法 ' }), true)
})
