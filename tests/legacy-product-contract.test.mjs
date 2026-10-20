import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveProductBizType, resolveProductFlow } from './fixtures/legacy-product-biz.mjs'

// 与 API ProductContractAdapterTest 使用的旧无 header 响应树一致，保留旧端真实 Number/混合判断。
const responses = [
  { id: 1, productCategory: 1, bizType: 1, goodsMerchantType: 1, categoryCode: null },
  { id: 2, productCategory: 2, bizType: 2, goodsMerchantType: 2, categoryCode: null },
  { id: 3, productCategory: 3, bizType: 1, goodsMerchantType: 1, categoryCode: '传统疗法' }
]
for (const product of responses) {
  test(`旧客户端 ${product.productCategory} 类商品不因新字段迁移产生NaN或错误复诊`, () => {
    const parsed = resolveProductBizType(product)
    assert.equal(Number.isFinite(parsed), true)
    const flow = resolveProductFlow([product, { ...product, id: product.id + 10 }])
    assert.equal(flow.valid, true)
    assert.equal(flow.requiresConsultation, product.productCategory === 1)
    assert.equal(flow.allTraditionalTherapy, product.productCategory === 3)
  })
}

test('旧客户端自身混购限制继续存在，新混购体验需发布新小程序', () => {
  assert.equal(resolveProductFlow(responses.slice(0, 2)).valid, false)
  const missingLegacyField = { ...responses[0] }; delete missingLegacyField.bizType
  assert.equal(Number.isNaN(resolveProductBizType(missingLegacyField)), true)
  assert.equal(resolveProductFlow([missingLegacyField, { ...missingLegacyField, id: 10 }]).valid, false)
})
