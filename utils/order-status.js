export const ORDER_STATUS_TEXT = {
  0: '待支付',
  1: '待发货',
  2: '待收货',
  3: '已完成',
  4: '已取消',
  5: '退货中',
  6: '部分退货',
  7: '已退货'
}

export const REFUND_STATUS_TEXT = {
  0: '无退货',
  1: '退货申请中',
  2: '退货审核通过',
  3: '退货中',
  4: '部分退货完成',
  5: '全单退货完成',
  6: '退货失败'
}

export const REDEEM_STATUS_TEXT = {
  0: '待核销',
  1: '已核销',
  2: '已退款/已失效'
}

const ORDER_TYPE_THERAPY = 4
const AFTER_SALE_ORDER_STATUSES = [5, 6, 7]

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const getVoucherList = (order = {}) => {
  const items = order.items || order.goods || order.products || []
  if (!Array.isArray(items)) {
    return []
  }
  return items.flatMap(item => item.redeemVouchers || item.redeem_vouchers || [])
}

export const isAfterSaleOrderStatus = status => AFTER_SALE_ORDER_STATUSES.includes(toNumber(status))

export const isTherapyLikeOrder = (order = {}) => {
  return toNumber(order.orderType ?? order.order_type) === ORDER_TYPE_THERAPY ||
    toNumber(order.redeemStatus ?? order.redeem_status) !== null ||
    getVoucherList(order).length > 0 ||
    Boolean(order.hasRedeemVouchers)
}

export const getRedeemStatusText = (voucherOrOrder = {}) => {
  const status = toNumber(voucherOrOrder.redeemStatus ?? voucherOrOrder.redeem_status)
  return REDEEM_STATUS_TEXT[status] || '未知状态'
}

export const getOrderStatusText = (order = {}) => {
  const status = toNumber(order.orderStatus ?? order.order_status ?? order.status)

  if (isAfterSaleOrderStatus(status)) {
    return order.displayStatusText || order.display_status_text || ORDER_STATUS_TEXT[status] || '未知状态'
  }

  if (order.displayStatusText || order.display_status_text) {
    return order.displayStatusText || order.display_status_text
  }

  if (isTherapyLikeOrder(order)) {
    if (status === 0) {
      return ORDER_STATUS_TEXT[0]
    }
    if (status !== null && status >= 1) {
      return getRedeemStatusText(order)
    }
  }

  return ORDER_STATUS_TEXT[status] || '未知状态'
}

export const canShowRedeemCode = (order = {}, voucher = {}) => {
  const orderStatus = toNumber(order.orderStatus ?? order.order_status ?? order.status)
  const refundStatus = toNumber(order.refundStatus ?? order.refund_status)
  const redeemStatus = toNumber(voucher.redeemStatus ?? voucher.redeem_status)

  return redeemStatus === 0 &&
    !isAfterSaleOrderStatus(orderStatus) &&
    refundStatus !== 5
}
