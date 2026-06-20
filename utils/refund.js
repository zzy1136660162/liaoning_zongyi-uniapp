const normalizeId = value => String(value ?? '')

export const hasTherapyVoucher = (item = {}) => {
  const vouchers = item.redeemVouchers || item.redeem_vouchers || []
  return Array.isArray(vouchers) && vouchers.length > 0
}

export const hasMixedTherapyAndNormalRefundItems = (items = []) => {
  const list = Array.isArray(items) ? items : []
  const hasTherapy = list.some(hasTherapyVoucher)
  const hasNormal = list.some(item => !hasTherapyVoucher(item))
  return hasTherapy && hasNormal
}

export const resolveRefundType = (allProducts = [], selectedProducts = []) => {
  const all = Array.isArray(allProducts) ? allProducts : []
  const selected = Array.isArray(selectedProducts) ? selectedProducts : []
  if (!all.length || !selected.length) {
    return 2
  }

  const selectedMap = new Map(selected.map(item => [
    normalizeId(item.id),
    Number(item.quantity || 0)
  ]))
  const coversAll = all.every(item =>
    selectedMap.get(normalizeId(item.id)) === Number(item.quantity || 0)
  )
  return coversAll ? 1 : 2
}
