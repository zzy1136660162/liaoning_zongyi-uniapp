/** 当前商品只使用购买分类，目录名称、编码和主键均不决定购买或核销流程。 */
export const isTraditionalTherapyProduct = product => Number(product?.productCategory) === 3

/** 配送类型优先使用下单快照；老单可沿已存订单类型保留原履约方式，不回填未知商品分类。 */
export const isTherapyOrder = (order = {}) => {
  const items = Array.isArray(order.items) ? order.items : []
  // 新快照含实物时，即使旧订单类型字段冲突，也必须展示实物配送。
  if (items.some(item => [1, 2].includes(Number(item.productCategorySnapshot)))) return false
  if (items.length > 0 && items.every(item => Number(item.productCategorySnapshot) === 3)) return true
  return Number(order.orderType) === ORDER_TYPE_THERAPY
}

export const hasTherapyEntitlement = (order = {}) => (order.items || []).some(item =>
  Number(item.redeemRequiredSnapshot) === 1 || (Array.isArray(item.redeemVouchers) && item.redeemVouchers.length > 0))

// 后端仍保留订单类型字段；新订单分类和配送要求由商品明细核定。
export const ORDER_TYPE_THERAPY = 4
