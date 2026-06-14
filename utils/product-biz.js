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
  const bizType = resolveProductBizType(product)

  if (productCategory === PRODUCT_CATEGORY_NORMAL_GOODS || bizType === BIZ_TYPE_HEALTH_GOODS) {
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
      flowType: PRODUCT_FLOW_CONSULTATION,
      requiresConsultation: true,
      message: ''
    }
  }

  const firstBizType = resolveProductBizType(products[0])
  const firstFlowType = resolveProductFlowType(products[0])
  const mixed = products.some(product => resolveProductFlowType(product) !== firstFlowType)
  if (mixed) {
    return {
      valid: false,
      bizType: null,
      flowType: PRODUCT_FLOW_MIXED,
      requiresConsultation: null,
      message: '直购商品不能和复诊商品一起结算'
    }
  }

  const firstGoodsMerchantType = resolveGoodsMerchantType(products[0])
  const mixedPaymentType = products.some(product =>
    resolveProductBizType(product) !== firstBizType ||
    resolveGoodsMerchantType(product) !== firstGoodsMerchantType
  )
  if (mixedPaymentType) {
    return {
      valid: false,
      bizType: null,
      flowType: firstFlowType,
      requiresConsultation: null,
      message: '暂不支持不同支付类型商品混合下单'
    }
  }

  return {
    valid: true,
    bizType: firstBizType,
    flowType: firstFlowType,
    requiresConsultation: firstFlowType === PRODUCT_FLOW_CONSULTATION,
    message: ''
  }
}
