import { getCartEntries, splitCartItemKey } from './cart.js'

const positiveInteger = (value, message) => {
  const number = Number(value)
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(number) || number <= 0) throw new Error(message)
  return number
}

export const parseDirectPurchase = (options = {}) => {
  if (!Object.prototype.hasOwnProperty.call(options, 'buyQuantity')) return null
  const quantity = positiveInteger(options.buyQuantity, '购买数量无效，请重新选择')
  const questionnaireId = options.buyQuestionnaireId === undefined ? null
    : positiveInteger(options.buyQuestionnaireId, '问卷信息无效，请重新选择商品')
  const answerId = options.buyAnswerId === undefined ? null
    : positiveInteger(options.buyAnswerId, '问卷答案无效，请重新填写')
  if (answerId && !questionnaireId) throw new Error('问卷信息无效，请重新选择商品')
  return { quantity, questionnaireId, answerId }
}

export const directPurchaseQuery = purchase => {
  if (!purchase) return ''
  let query = `&buyQuantity=${purchase.quantity}`
  if (purchase.questionnaireId) query += `&buyQuestionnaireId=${purchase.questionnaireId}`
  if (purchase.answerId) query += `&buyAnswerId=${purchase.answerId}`
  return query
}

/** 立即购买使用独立的结算条目，绝不读取同 SKU 的购物车数量或问卷凭据。 */
export const checkoutEntries = (keys, purchase) => {
  if (!purchase) return getCartEntries()
  if (!Array.isArray(keys) || keys.length !== 1 || !/^[1-9]\d*:[1-9]\d*$/.test(String(keys[0]))) {
    throw new Error('购买商品规格无效，请重新选择')
  }
  const key = String(keys[0]), { productId, skuId } = splitCartItemKey(key)
  positiveInteger(productId, '购买商品无效，请重新选择')
  positiveInteger(skuId, '购买商品规格无效，请重新选择')
  const quantity = positiveInteger(purchase.quantity, '购买数量无效，请重新选择')
  return { [key]: { productId, skuId, quantity, selected: true, stock: null, available: true,
    questionnaireId: purchase.questionnaireId ?? null, answerId: purchase.answerId ?? null } }
}
