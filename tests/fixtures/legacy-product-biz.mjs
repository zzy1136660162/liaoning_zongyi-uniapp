/** 冻结于2026-10-21重构前的旧客户端分流代码；仅测试后端边界响应兼容，禁止业务代码引用。 */
const isTraditionalTherapyProduct = product => product?.categoryCode === '传统疗法'
export const BIZ_TYPE_HOSPITAL_MEDICAL = 1
export const BIZ_TYPE_HEALTH_GOODS = 2

export const GOODS_MERCHANT_HOSPITAL = 1
export const GOODS_MERCHANT_TECH_SERVICE = 2

export const PRODUCT_CATEGORY_NORMAL_GOODS = 2

export const PRODUCT_FLOW_DIRECT = 'direct'
export const PRODUCT_FLOW_CONSULTATION = 'consultation'
export const PRODUCT_FLOW_MIXED = 'mixed'


export const resolveProductBizType = (product = {}) => {
  return Number(product.bizType)
}


export const resolveProductFlowType = (product = {}) => {
  const productCategory = product.productCategory !== undefined && product.productCategory !== null && product.productCategory !== ''
    ? Number(product.productCategory)
    : null
  const bizType = resolveProductBizType(product)

  // 疗法、普通商品和健康商品直购；其余本院制剂进入复诊流程。
  if (isTraditionalTherapyProduct(product)) {
    return PRODUCT_FLOW_DIRECT
  }

  if (productCategory === PRODUCT_CATEGORY_NORMAL_GOODS || bizType === BIZ_TYPE_HEALTH_GOODS) {
    return PRODUCT_FLOW_DIRECT
  }

  return PRODUCT_FLOW_CONSULTATION
}


export const resolveGoodsMerchantType = (product = {}) => {
  // 商户由商品配置决定，不能用购买流程反推收款方。
  return Number(product.goodsMerchantType)
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

  // 疗法允许搭配直购或复诊；收款商户一致性只比较实际参与商品款支付的商品。
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
