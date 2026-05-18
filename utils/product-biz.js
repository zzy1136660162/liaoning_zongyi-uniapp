export const BIZ_TYPE_HOSPITAL_MEDICAL = 1
export const BIZ_TYPE_HEALTH_GOODS = 2

export const GOODS_MERCHANT_HOSPITAL = 1
export const GOODS_MERCHANT_TECH_SERVICE = 2

export const resolveProductBizType = (product = {}) => {
  return Number(product.bizType || BIZ_TYPE_HOSPITAL_MEDICAL)
}

export const resolveGoodsMerchantType = (product = {}) => {
  if (product.goodsMerchantType != null && product.goodsMerchantType !== '') {
    return Number(product.goodsMerchantType)
  }
  return resolveProductBizType(product) === BIZ_TYPE_HEALTH_GOODS
    ? GOODS_MERCHANT_TECH_SERVICE
    : GOODS_MERCHANT_HOSPITAL
}

export const isHealthGoods = (product = {}) => {
  return resolveProductBizType(product) === BIZ_TYPE_HEALTH_GOODS
}

export const isHospitalMedical = (product = {}) => {
  return resolveProductBizType(product) === BIZ_TYPE_HOSPITAL_MEDICAL
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
    return { valid: true, bizType: BIZ_TYPE_HOSPITAL_MEDICAL, message: '' }
  }

  const firstBizType = resolveProductBizType(products[0])
  const mixed = products.some(product => resolveProductBizType(product) !== firstBizType)
  if (mixed) {
    return {
      valid: false,
      bizType: null,
      message: '暂不支持本院产品和健康产品混合下单'
    }
  }

  return {
    valid: true,
    bizType: firstBizType,
    message: ''
  }
}
