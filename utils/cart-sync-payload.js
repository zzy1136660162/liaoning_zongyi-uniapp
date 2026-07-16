const normalizeId = (value) => {
  if (value === undefined || value === null || value === '') {
    return ''
  }
  return String(value).trim()
}

const splitCartItemKey = (cartKey) => {
  const key = normalizeId(cartKey)
  if (!key) {
    return { productId: '', skuId: '' }
  }
  const separatorIndex = key.indexOf(':')
  if (separatorIndex < 0) {
    return { productId: key, skuId: '' }
  }
  return {
    productId: key.slice(0, separatorIndex),
    skuId: key.slice(separatorIndex + 1)
  }
}

const toNullableNumber = (value) => {
  const normalized = normalizeId(value)
  if (!normalized) {
    return null
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : normalized
}

const hasValue = (value) => value !== undefined && value !== null && value !== ''

const toServerChecked = (selected) => (selected ? 1 : 0)

export const buildCartSyncPayload = (cartKey, entry = {}) => {
  const split = splitCartItemKey(cartKey)
  const productId = entry.productId || split.productId
  const skuId = entry.skuId || split.skuId
  const payload = {
    productId: Number(productId),
    skuId: toNullableNumber(skuId),
    quantity: entry.quantity || 1,
    checked: toServerChecked(entry.selected !== false)
  }

  if (hasValue(entry.questionnaireId)) {
    payload.questionnaireId = toNullableNumber(entry.questionnaireId)
  }
  if (hasValue(entry.answerId)) {
    payload.answerId = toNullableNumber(entry.answerId)
  }

  return payload
}
