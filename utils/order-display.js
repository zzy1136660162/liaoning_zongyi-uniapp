export const getDisplayOrderNo = (order = {}) => String(order.hisOrderNo || '').trim() || String(order.orderNo || '').trim()

export const getPaidAmountText = (order = {}) => {
  const amount = order.paidAmount
  if (amount !== null && amount !== undefined && amount !== '' && Number.isFinite(Number(amount)) && Number(amount) >= 0) {
    return Number(amount).toFixed(2)
  }
  // 只有明确未付款才可以显示零；历史未知及取消后异常收款不能拿应付金额或零冒充实付。
  return Number(order.payStatus) === 0 && order.payStatus != null && !order.paymentFulfillmentStatus ? '0.00' : '待确认'
}

export const getRefundedAmountText = (order = {}) => Number(order.refundedAmount) > 0
  ? `已退款 ¥${Number(order.refundedAmount).toFixed(2)}` : ''
