const toQuantityLimit = (value) => {
  if (value === undefined || value === null || value === '') {
    return null
  }
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return null
  }
  return Math.max(0, Math.floor(number))
}

const isLimitEnabled = (limitInfo = {}) => {
  return limitInfo.enabled === true
}

export const resolvePurchaseQuantityLimit = (product = {}) => {
  if (product.available === false || (product.inventoryMode === 'HIS_AVAILABILITY'
    && (product.inventoryStatus !== 'AVAILABLE' || product.available !== true))) return 0
  const limits = []
  const stock = toQuantityLimit(product.stock)
  if (stock !== null) {
    limits.push(stock)
  }

  const limitInfo = product.limitInfo || {}
  if (isLimitEnabled(limitInfo)) {
    const remainingQuantity = toQuantityLimit(limitInfo.remainingQuantity)
    if (remainingQuantity !== null) {
      limits.push(remainingQuantity)
    }
  }

  return limits.length > 0 ? Math.min(...limits) : null
}

export const normalizePurchaseQuantity = (product = {}, quantity = 1) => {
  const numericQuantity = Number(quantity)
  const normalized = Number.isFinite(numericQuantity)
    ? Math.max(1, Math.floor(numericQuantity))
    : 1
  const maxQuantity = resolvePurchaseQuantityLimit(product)

  if (maxQuantity === null) {
    return normalized
  }
  if (maxQuantity < 1) {
    return 1
  }
  return Math.min(normalized, maxQuantity)
}

export const isPurchaseAvailable = (product = {}) => {
  const maxQuantity = resolvePurchaseQuantityLimit(product)
  return maxQuantity === null || maxQuantity > 0
}
