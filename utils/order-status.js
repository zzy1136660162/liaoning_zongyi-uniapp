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
  2: '已退款/已失效',
  3: '退款处理中'
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
  const fulfillment = order.paymentFulfillmentStatus ?? order.payment_fulfillment_status

  if (status === 4) {
    if (fulfillment === 'REFUND_REQUIRED') return '已取消，付款待退款'
    if (fulfillment === 'REFUNDED') return '已取消，付款已退款'
    if (fulfillment === 'PENDING') return '已取消，付款确认中'
    return ORDER_STATUS_TEXT[4]
  }
  if (fulfillment === 'PENDING') return '已付款，订单处理中'
  if (fulfillment === 'REFUND_REQUIRED') return '付款异常，待退款'
  if (fulfillment === 'REFUNDED') return '异常付款已退款'

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
  const payStatus = toNumber(order.payStatus ?? order.pay_status)
  const fulfillment = order.paymentFulfillmentStatus ?? order.payment_fulfillment_status
  const redeemStatus = toNumber(voucher.redeemStatus ?? voucher.redeem_status)

  return redeemStatus === 0 &&
    orderStatus !== 0 && orderStatus !== 4 &&
    (payStatus === null || payStatus === 1) &&
    (!fulfillment || fulfillment === 'READY')
}

// 支付回调成功与订单可履约是两个阶段，只有服务端确认后显示成功。
export const getPaymentOutcome = (order = {}) => {
  const status = toNumber(order.orderStatus ?? order.order_status ?? order.status)
  const paid = toNumber(order.payStatus ?? order.pay_status) === 1
  const fulfillment = order.paymentFulfillmentStatus ?? order.payment_fulfillment_status
  if (fulfillment === 'REFUNDED') return { state: 'refunded', title: '付款已退款', tip: '本次异常付款已退款，请查看订单详情。', terminal: true }
  if (fulfillment === 'REFUND_REQUIRED') return { state: 'refund', title: '付款待退款', tip: '付款已收到，但订单无法继续履约，正在处理退款。', terminal: true }
  if (status === 4) return { state: 'canceled', title: '订单已取消', tip: paid ? '订单已取消，付款状态请以订单详情和退款记录为准。' : '订单已取消，如已扣款请等待付款确认。', terminal: true }
  if (paid && (!fulfillment || fulfillment === 'READY')) return { state: 'success', title: '支付成功', tip: '订单已提交，我们将尽快为您处理。', terminal: true }
  return { state: 'pending', title: paid ? '已付款，订单处理中' : '待支付确认', tip: '正在确认付款和订单状态，请稍后在订单详情查看结果。', terminal: false }
}
