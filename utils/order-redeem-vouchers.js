export const buildItemRedeemVouchers = (item = {}) => {
  const rawVouchers = item.redeemVouchers || item.redeem_vouchers || []
  if (!Array.isArray(rawVouchers) || rawVouchers.length === 0) {
    return []
  }

  return rawVouchers.map((voucher, index) => ({
    id: voucher.id,
    sequenceNo: voucher.sequenceNo || voucher.sequence_no || index + 1,
    redeemStatus: voucher.redeemStatus ?? voucher.redeem_status ?? 0,
    redeemTime: voucher.redeemTime || voucher.redeem_time || '',
    redeemedBy: voucher.redeemedBy || voucher.redeemed_by || '',
    redeemerName: voucher.redeemerName || voucher.redeemer_name || '',
    verifyToken: voucher.verifyToken || voucher.verify_token || '',
    verifyQrBase64: voucher.verifyQrBase64 || voucher.verify_qr_base64 || ''
  }))
}
