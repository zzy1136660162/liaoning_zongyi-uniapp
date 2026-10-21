import { splitCartItemKey } from './cart-key.js'

const requiredId = value => {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('购物车关联ID无效，请重新选择商品')
  return id
}

/** 上传只取真实行键和用户操作字段，商品名称/价格/库存由后台重新核定。 */
export const buildCartSyncPayload = (cartKey, entry = {}) => {
  const { productId, skuId } = splitCartItemKey(cartKey)
  const payload = {
    productId: requiredId(productId),
    skuId: requiredId(skuId),
    quantity: entry.quantity,
    checked: entry.selected !== false ? 1 : 0
  }
  // 省略表示未提供新凭据；服务端按当前绑定核验旧答卷，不能靠省略字段清空旧答案。
  if (Number.isSafeInteger(Number(entry.questionnaireId)) && Number(entry.questionnaireId) > 0) {
    payload.questionnaireId = requiredId(entry.questionnaireId)
    if (Number.isSafeInteger(Number(entry.answerId)) && Number(entry.answerId) > 0) payload.answerId = requiredId(entry.answerId)
  }
  return payload
}
