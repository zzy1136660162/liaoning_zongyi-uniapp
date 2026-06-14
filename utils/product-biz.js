import { isTraditionalTherapyProduct } from './therapy.js'

export const BIZ_TYPE_HOSPITAL_MEDICAL = 1
export const BIZ_TYPE_HEALTH_GOODS = 2

export const GOODS_MERCHANT_HOSPITAL = 1
export const GOODS_MERCHANT_TECH_SERVICE = 2

export const PRODUCT_CATEGORY_FORMULA = 1
export const PRODUCT_CATEGORY_NORMAL_GOODS = 2

export const PRODUCT_FLOW_DIRECT = 'direct'
export const PRODUCT_FLOW_CONSULTATION = 'consultation'
export const PRODUCT_FLOW_MIXED = 'mixed'

export const resolveProductBizType = (product = {}) => {
  return Number(product.bizType || BIZ_TYPE_HOSPITAL_MEDICAL)
}

export const resolveProductFlowType = (product = {}) => {
  const productCategory = product.productCategory !== undefined && product.productCategory !== null && product.productCategory !== ''
    ? Number(product.productCategory)
    : null
  const isPrescription = product.isPrescription !== undefined && product.isPrescription !== null && product.isPrescription !== ''
    ? Number(product.isPrescription)
    : null
  const goodsMerchantType = product.goodsMerchantType !== undefined && product.goodsMerchantType !== null && product.goodsMerchantType !== ''
    ? Number(product.goodsMerchantType)
    : null
  const bizType = resolveProductBizType(product)

  if (isTraditionalTherapyProduct(product)) {
    return PRODUCT_FLOW_DIRECT
  }

  if (productCategory === PRODUCT_CATEGORY_NORMAL_GOODS || bizType === BIZ_TYPE_HEALTH_GOODS) {
    return PRODUCT_FLOW_DIRECT
  }

  if (productCategory === null && isPrescription === null && goodsMerchantType === GOODS_MERCHANT_TECH_SERVICE) {
    return PRODUCT_FLOW_DIRECT
  }

  if (
    productCategory === PRODUCT_CATEGORY_FORMULA ||
    isPrescription === 1 ||
    bizType === BIZ_TYPE_HOSPITAL_MEDICAL
  ) {
    return PRODUCT_FLOW_CONSULTATION
  }

  return PRODUCT_FLOW_CONSULTATION
}

export const resolveGoodsMerchantType = (product = {}) => {
  if (product.goodsMerchantType != null && product.goodsMerchantType !== '') {
    return Number(product.goodsMerchantType)
  }

  return resolveProductFlowType(product) === PRODUCT_FLOW_DIRECT
    ? GOODS_MERCHANT_TECH_SERVICE
    : GOODS_MERCHANT_HOSPITAL
}

export const isHealthGoods = (product = {}) => {
  return resolveProductFlowType(product) === PRODUCT_FLOW_DIRECT
}

export const isHospitalMedical = (product = {}) => {
  return resolveProductFlowType(product) === PRODUCT_FLOW_CONSULTATION
}

export const hasBoundQuestionnaire = (product = {}) => {
  if (Number(product.needQuestionnaire) !== 1) {
    return false
  }

  const questionnaireId = product.questionnaireId
  if (questionnaireId === undefined || questionnaireId === null) {
    return false
  }

  const normalizedId = String(questionnaireId).trim()
  return normalizedId !== '' && normalizedId !== '0'
}

export const resolveProductTypeLabel = (product = {}) => {
  if (isTraditionalTherapyProduct(product)) {
    return '传统疗法'
  }
  return isHealthGoods(product) ? '健康产品' : '中药'
}

export const resolveBizTypeLabel = (bizType) => {
  return Number(bizType) === BIZ_TYPE_HEALTH_GOODS ? '健康产品' : '本院产品'
}

export const resolveProductFlow = (products = []) => {
  if (!Array.isArray(products) || products.length === 0) {
    return {
      valid: true,
      bizType: BIZ_TYPE_HOSPITAL_MEDICAL,
      goodsMerchantType: GOODS_MERCHANT_HOSPITAL,
      flowType: PRODUCT_FLOW_CONSULTATION,
      requiresConsultation: true,
      hasTraditionalTherapy: false,
      allTraditionalTherapy: false,
      message: ''
    }
  }

  const hasTraditionalTherapy = products.some(product => isTraditionalTherapyProduct(product))
  const allTraditionalTherapy = hasTraditionalTherapy && products.every(product => isTraditionalTherapyProduct(product))
  const hasConsultationProducts = products.some(product => resolveProductFlowType(product) === PRODUCT_FLOW_CONSULTATION)
  const hasNonTherapyDirectProducts = products.some(product =>
    !isTraditionalTherapyProduct(product) && resolveProductFlowType(product) === PRODUCT_FLOW_DIRECT
  )

  if (hasConsultationProducts && hasNonTherapyDirectProducts) {
    return {
      valid: false,
      bizType: null,
      goodsMerchantType: null,
      flowType: PRODUCT_FLOW_MIXED,
      requiresConsultation: null,
      hasTraditionalTherapy,
      allTraditionalTherapy,
      message: '直购商品不能和复诊商品一起结算'
    }
  }

  const paymentProducts = products.filter(product => !isTraditionalTherapyProduct(product))
  const primaryProducts = paymentProducts.length > 0 ? paymentProducts : products
  const firstBizType = resolveProductBizType(primaryProducts[0])
  const firstGoodsMerchantType = resolveGoodsMerchantType(primaryProducts[0])
  const mixedPaymentType = primaryProducts.some(product =>
    resolveProductBizType(product) !== firstBizType ||
    resolveGoodsMerchantType(product) !== firstGoodsMerchantType
  )
  const flowType = hasConsultationProducts ? PRODUCT_FLOW_CONSULTATION : PRODUCT_FLOW_DIRECT

  if (mixedPaymentType) {
    return {
      valid: false,
      bizType: null,
      goodsMerchantType: null,
      flowType,
      requiresConsultation: null,
      hasTraditionalTherapy,
      allTraditionalTherapy,
      message: '暂不支持不同支付类型商品混合下单'
    }
  }

  return {
    valid: true,
    bizType: firstBizType,
    goodsMerchantType: firstGoodsMerchantType,
    flowType,
    requiresConsultation: flowType === PRODUCT_FLOW_CONSULTATION,
    hasTraditionalTherapy,
    allTraditionalTherapy,
    message: ''
  }
}
