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

export const getRefundStageText = (detail = {}) => {
  if (['PROCESSING', 'UNKNOWN', 'SUCCESS'].includes(detail.paymentRefundStatus)) return getPaymentRefundStatusText(detail.paymentRefundStatus)
  if (detail.status === 4) return '退款成功'
  if (detail.status === 0) return '申请已提交，等待审核'
  if (detail.status === 2) return '申请未通过审核'
  if (detail.status === 5) return '申请已关闭'
  if (detail.paymentRefundStatus === 'FAILED') return getPaymentRefundStatusText('FAILED')
  const needsReturn = !String(detail.refundScene || '').startsWith('THERAPY_') && !['FORMULATION_PRE_SHIP', 'ADMIN_PHYSICAL'].includes(detail.refundScene)
  if (needsReturn && (detail.status === 1 || detail.status === 3)) return '请线下联系客服处理退款'
  return '等待执行退款'
}

export const hasTherapyVoucher = (item = {}) => {
  const vouchers = item.redeemVouchers || item.redeem_vouchers || []
  return Array.isArray(vouchers) && vouchers.length > 0
}

/** 按购买时的核销资格分组；历史订单缺快照时才使用真实券和旧订单类型。 */
export const isTherapyRefundItem = (item = {}, order = {}) => {
  if (item.redeemRequiredSnapshot != null) return Number(item.redeemRequiredSnapshot) === 1
  const category = Number(item.productCategorySnapshot)
  if ([1, 2, 3].includes(category)) return category === 3
  return hasTherapyVoucher(item) || Number(order.orderType) === 4
}

/** 可退数量由服务端扣除已用、退款冻结和已退款数量，页面只负责展示。 */
export const canOrderApplyRefund = (order = {}) => {
  const status = Number(order.orderStatus ?? order.status)
  const fulfillment = order.paymentFulfillmentStatus
  return Boolean(order.id) && Number(order.payStatus) === 1 && ![0, 4, 7].includes(status) &&
    (!fulfillment || fulfillment === 'READY') &&
    (order.items || []).some(item => Number(item.refundableQuantity || 0) > 0 &&
      (isTherapyRefundItem(item, order) || status === 1))
}

export const shouldContactForPhysicalRefund = (order = {}) => {
  const status = Number(order.orderStatus ?? order.status)
  return Number(order.payStatus) === 1 && [2, 3].includes(status) &&
    (order.items || []).some(item => !isTherapyRefundItem(item, order) &&
      Number(item.quantity || 0) > Number(item.refundCompletedQuantity || 0))
}

export const getOrderItemRefundText = (item = {}) => {
  const unit = isTherapyRefundItem(item) ? '次' : '件'
  const completed = Number(item.refundCompletedQuantity || 0)
  const frozen = Number(item.refundFrozenQuantity || 0)
  return [
    completed > 0 ? `已退款 ${completed} ${unit}` : '',
    frozen > 0 ? `退款中 ${frozen} ${unit}` : ''
  ].filter(Boolean).join('，')
}

export const hasMixedTherapyAndNormalRefundItems = (items = [], order = {}) => {
  const list = Array.isArray(items) ? items : []
  const hasTherapy = list.some(item => isTherapyRefundItem(item, order))
  const hasNormal = list.some(item => !isTherapyRefundItem(item, order))
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
