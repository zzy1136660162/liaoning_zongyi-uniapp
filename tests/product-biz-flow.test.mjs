import assert from 'node:assert/strict'

const main = async () => {
  const {
    GOODS_MERCHANT_TECH_SERVICE,
    resolveGoodsMerchantType,
    resolveProductFlow
  } = await import('../utils/product-biz.js')

  const directProduct = {
    id: 101,
    name: 'direct goods',
    productCategory: 2,
    bizType: 1
  }

  const consultationProduct = {
    id: 102,
    name: 'hospital formula',
    productCategory: 1,
    bizType: 1
  }

  const directFlow = resolveProductFlow([directProduct])
  assert.equal(directFlow.valid, true)
  assert.equal(directFlow.bizType, 1)
  assert.equal(directFlow.flowType, 'direct')
  assert.equal(directFlow.requiresConsultation, false)

  const consultationFlow = resolveProductFlow([consultationProduct])
  assert.equal(consultationFlow.valid, true)
  assert.equal(consultationFlow.bizType, 1)
  assert.equal(consultationFlow.flowType, 'consultation')
  assert.equal(consultationFlow.requiresConsultation, true)

  const mixedFlow = resolveProductFlow([directProduct, consultationProduct])
  assert.equal(mixedFlow.valid, false)
  assert.equal(mixedFlow.flowType, 'mixed')
  assert.equal(mixedFlow.requiresConsultation, null)
  assert.match(mixedFlow.message, /混合|直购|复诊|consultation|direct/i)

  const healthProduct = {
    id: 103,
    name: 'health goods',
    productCategory: 2,
    bizType: 2
  }
  const mixedDirectPaymentFlow = resolveProductFlow([directProduct, healthProduct])
  assert.equal(mixedDirectPaymentFlow.valid, false)
  assert.equal(mixedDirectPaymentFlow.requiresConsultation, null)
  assert.match(mixedDirectPaymentFlow.message, /不同|支付|payment|商户|业务/i)

  assert.equal(resolveGoodsMerchantType(directProduct), GOODS_MERCHANT_TECH_SERVICE)
}

main()
