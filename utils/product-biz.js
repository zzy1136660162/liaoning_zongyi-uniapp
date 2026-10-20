/** 购买分类是商品唯一业务分类；categoryId/categoryCode 仅用于展示目录。 */
export const PRODUCT_CATEGORY_FORMULA = 1
export const PRODUCT_CATEGORY_HEALTH = 2
export const PRODUCT_CATEGORY_THERAPY = 3

export const GOODS_MERCHANT_HOSPITAL = 1
export const GOODS_MERCHANT_TECH_SERVICE = 2
export const PRODUCT_FLOW_DIRECT = 'direct'
export const PRODUCT_FLOW_CONSULTATION = 'consultation'

export const resolveProductFlowType = (product = {}) => Number(product.productCategory) === PRODUCT_CATEGORY_FORMULA
  ? PRODUCT_FLOW_CONSULTATION : PRODUCT_FLOW_DIRECT

// 商户是商品配置数据，允许不同商户商品一起结算，不从购买分类反推商户。
export const resolveGoodsMerchantType = (product = {}) => Number(product.goodsMerchantType)
export const isHealthGoods = (product = {}) => Number(product.productCategory) === PRODUCT_CATEGORY_HEALTH
export const isHospitalMedical = (product = {}) => Number(product.productCategory) === PRODUCT_CATEGORY_FORMULA

export const hasBoundQuestionnaire = (product = {}) => {
  if (Number(product.needQuestionnaire) !== 1 || product.questionnaireId == null) return false
  const id = String(product.questionnaireId).trim()
  return id !== '' && id !== '0'
}

export const resolveProductTypeLabel = (product = {}) => ({
  1: '制剂', 2: '健康产品', 3: '传统疗法'
})[Number(product.productCategory)] || '分类待确认'

/** 三类可同单：仅制剂需要复诊；任一实物需要配送；纯疗法到店核销。 */
export const resolveProductFlow = (products = []) => {
  const items = Array.isArray(products) ? products : []
  const valid = items.every(product => [1, 2, 3].includes(Number(product.productCategory)))
  const requiresConsultation = items.some(isHospitalMedical)
  const requiresShipping = items.some(product => [1, 2].includes(Number(product.productCategory)))
  const hasTraditionalTherapy = items.some(product => Number(product.productCategory) === PRODUCT_CATEGORY_THERAPY)
  return {
    valid,
    flowType: requiresConsultation ? PRODUCT_FLOW_CONSULTATION : PRODUCT_FLOW_DIRECT,
    requiresConsultation,
    requiresShipping,
    hasTraditionalTherapy,
    allTraditionalTherapy: items.length > 0 && items.every(product => Number(product.productCategory) === PRODUCT_CATEGORY_THERAPY),
    message: valid ? '' : '商品购买分类未配置，请重新加载或联系医院'
  }
}
