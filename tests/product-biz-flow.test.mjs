import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveProductFlow, resolveProductFlowType, resolveProductTypeLabel } from '../utils/product-biz.js'

for (const categories of [[1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]]) {
  test(`购买分类组合 ${categories.join('+')} 同单，复诊和配送独立判断`, () => {
    const products = categories.map((productCategory, i) => ({ id: i + 1, productCategory, goodsMerchantType: i % 2 + 1 }))
    const flow = resolveProductFlow(products)
    assert.equal(flow.valid, true)
    assert.equal(flow.requiresConsultation, categories.includes(1))
    assert.equal(flow.requiresShipping, categories.some(category => category !== 3))
    assert.equal(flow.hasTraditionalTherapy, categories.includes(3))
    assert.equal(flow.allTraditionalTherapy, categories.length === 1 && categories[0] === 3)
    assert.equal(flow.flowType, categories.includes(1) ? 'consultation' : 'direct')
    assert.equal('bizType' in flow, false)
  })
}

test('类目名称编码和商户不能覆盖购买分类，未知分类不猜测', () => {
  const product = { productCategory: 2, categoryId: 34, categoryCode: '传统疗法', goodsMerchantType: 1 }
  assert.equal(resolveProductFlowType(product), 'direct')
  assert.equal(resolveProductTypeLabel(product), '健康产品')
  assert.equal(resolveProductFlow([product, { productCategory: 2, goodsMerchantType: 2 }]).valid, true)
  for (const productCategory of [null, undefined, '', 0, 4]) assert.equal(resolveProductFlow([{ productCategory }]).valid, false)
})
