/** 传统疗法分类编码（与后台 lnzy_category.category_code 一致） */
export const CATEGORY_CODE_TRADITIONAL_THERAPY = '传统疗法'

/** 传统疗法订单类型 */
export const ORDER_TYPE_THERAPY = 4
export const CATEGORY_ID_TRADITIONAL_THERAPY = 34

export const isTraditionalTherapyProduct = (product) => {
  const code = product?.categoryCode || product?.category_code
  const categoryId = product?.categoryId ?? product?.category_id
  return code === CATEGORY_CODE_TRADITIONAL_THERAPY ||
    Number(categoryId) === CATEGORY_ID_TRADITIONAL_THERAPY
}

export const isTherapyOrder = (order) => {
  const orderType = order?.orderType ?? order?.order_type
  return Number(orderType) === ORDER_TYPE_THERAPY
}
