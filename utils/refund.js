const normalizeId = value => String(value ?? '')

export const createRefundRequestId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
  const random = Math.floor(Math.random() * 16)
  return (char === 'x' ? random : (random & 3) | 8).toString(16)
})

export const getPaymentRefundStatusText = status => ({
  PENDING: '退款待处理',
  PROCESSING: '退款处理中',
  UNKNOWN: '退款结果确认中',
  SUCCESS: '退款完成',
  FAILED: '退款失败，请联系客服'
}[status] || '')

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
