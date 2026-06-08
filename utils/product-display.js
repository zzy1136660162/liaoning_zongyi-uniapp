/** 快递/配送方式：与后台 coldShippingType 一致 */
export const COLD_SHIPPING_NORMAL = 0
export const COLD_SHIPPING_COLD_CHAIN = 1
export const COLD_SHIPPING_SELF_PICKUP = 2

export const getColdShippingLabel = (type) => {
  const value = Number(type)
  if (value === COLD_SHIPPING_COLD_CHAIN) return '精温专递'
  if (value === COLD_SHIPPING_SELF_PICKUP) return '自提'
  return '普通快递'
}

export const getDeliverySummary = (type) => {
  const value = Number(type)
  if (value === COLD_SHIPPING_SELF_PICKUP) {
    return '到店自提，请按预约时间到院体验'
  }
  if (value === COLD_SHIPPING_COLD_CHAIN) {
    return '精温专递配送，时效以实际收货地址为准'
  }
  return '顺丰配送，时效以实际收货地址为准'
}

export const shouldShowSfLogo = (type) => {
  return Number(type) !== COLD_SHIPPING_SELF_PICKUP
}

export const getExternalUseLabel = (isExternal) => {
  return Number(isExternal) === 1 ? '外用' : '非外用'
}

export const isSelfDevelopedProduct = (product) => {
  if (!product) return false
  const flag = product.isSelfDeveloped ?? product.is_self_developed
  if (flag === undefined || flag === null || flag === '') {
    return Number(product.bizType) === 1
  }
  return Number(flag) === 1
}
