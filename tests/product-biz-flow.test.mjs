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

  const therapyProduct = {
    id: 104,
    name: 'traditional therapy',
    categoryCode: '传统疗法',
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

  const therapyWithDirectFlow = resolveProductFlow([therapyProduct, directProduct])
  assert.equal(therapyWithDirectFlow.valid, true)
  assert.equal(therapyWithDirectFlow.flowType, 'direct')
  assert.equal(therapyWithDirectFlow.requiresConsultation, false)
  assert.equal(therapyWithDirectFlow.hasTraditionalTherapy, true)
  assert.equal(therapyWithDirectFlow.allTraditionalTherapy, false)

  const therapyWithConsultationFlow = resolveProductFlow([therapyProduct, consultationProduct])
  assert.equal(therapyWithConsultationFlow.valid, true)
  assert.equal(therapyWithConsultationFlow.flowType, 'consultation')
  assert.equal(therapyWithConsultationFlow.requiresConsultation, true)
  assert.equal(therapyWithConsultationFlow.hasTraditionalTherapy, true)
  assert.equal(therapyWithConsultationFlow.allTraditionalTherapy, false)

  const therapyOnlyFlow = resolveProductFlow([therapyProduct])
  assert.equal(therapyOnlyFlow.valid, true)
  assert.equal(therapyOnlyFlow.flowType, 'direct')
  assert.equal(therapyOnlyFlow.requiresConsultation, false)
  assert.equal(therapyOnlyFlow.hasTraditionalTherapy, true)
  assert.equal(therapyOnlyFlow.allTraditionalTherapy, true)

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
