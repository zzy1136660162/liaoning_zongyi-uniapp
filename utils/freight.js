/** 到付报价只作展示，空值与真实的零元报价分别处理。 */
export const formatFreightEstimate = (amount, source) => {
  if (amount == null || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
    return '运费到付，以快递员实际收取为准'
  }
  const prefix = source === 'SF_TEST' ? '测试预估' : '预计'
  return `${prefix} ¥${Number(amount).toFixed(2)}，到付，不计入本次支付`
}
