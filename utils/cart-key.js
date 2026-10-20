/** 购物车行按商品+真实规格区分；解析缺规格旧键仅用于显示失效/重选，不允许据此加购。 */
export const normalizeCartId = value => value === undefined || value === null ? '' : String(value).trim()

export const splitCartItemKey = value => {
  const key = normalizeCartId(value)
  const separator = key.indexOf(':')
  return separator < 0
    ? { productId: key, skuId: '' }
    : { productId: key.slice(0, separator), skuId: key.slice(separator + 1) }
}

export const buildCartItemKey = (productId, skuId = null) => {
  const product = normalizeCartId(productId)
  const sku = normalizeCartId(skuId)
  return product ? (sku ? `${product}:${sku}` : product) : ''
}
