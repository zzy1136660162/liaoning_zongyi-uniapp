import { removePurchasedCartItems } from './cart.js'
import { STORAGE_KEY_ORDER_SUBMISSION, STORAGE_KEY_ORDER_CART_SNAPSHOTS } from './storage.js'
import { getSessionGeneration, assertCurrentSession } from './session.js'

const cartConsumptions = new Map()

/** 请求结果不确定时沿用同一个标识；内容或购物车版本改变后才开始新的提交。 */
export const getOrderSubmission = (kind, data, cartSnapshot = null) => {
  const cartIntent = cartSnapshot && Object.fromEntries(Object.entries(cartSnapshot).map(([key, entry]) =>
    [key, entry.serverCartItemId && entry.serverCartVersion != null
      ? { id: entry.serverCartItemId, version: entry.serverCartVersion, quantity: entry.quantity }
      : { revision: entry.revision, quantity: entry.quantity, timestamp: entry.timestamp }]))
  // 报价刷新不改变购买意图，支付取消或网络重试仍复用原订单。
  const orderIntent = { ...data }
  delete orderIntent.freightQuoteId
  const fingerprint = JSON.stringify({ kind, data: orderIntent, cartSnapshot: cartIntent })
  const previous = uni.getStorageSync(STORAGE_KEY_ORDER_SUBMISSION)
  if (previous?.fingerprint === fingerprint) {
    const attempt = { ...previous, cartSnapshot }
    uni.setStorageSync(STORAGE_KEY_ORDER_SUBMISSION, attempt)
    return attempt
  }
  const attempt = { fingerprint, requestId: `order_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
    cartSnapshot }
  uni.setStorageSync(STORAGE_KEY_ORDER_SUBMISSION, attempt)
  return attempt
}

export const rememberCreatedOrder = (orderId, attempt) => {
  if (!orderId) throw new Error('订单创建失败，请重试')
  const previous = uni.getStorageSync(STORAGE_KEY_ORDER_SUBMISSION)
  if (previous?.requestId === attempt.requestId) {
    uni.setStorageSync(STORAGE_KEY_ORDER_SUBMISSION, { ...attempt, orderId })
  }
  if (attempt.cartSnapshot && Object.keys(attempt.cartSnapshot).length) {
    const snapshots = uni.getStorageSync(STORAGE_KEY_ORDER_CART_SNAPSHOTS) || {}
    uni.setStorageSync(STORAGE_KEY_ORDER_CART_SNAPSHOTS, { ...snapshots, [orderId]: attempt.cartSnapshot })
  }
}

export const releaseOrderSubmission = orderId => {
  const previous = uni.getStorageSync(STORAGE_KEY_ORDER_SUBMISSION)
  if (String(previous?.orderId) === String(orderId)) uni.removeStorageSync(STORAGE_KEY_ORDER_SUBMISSION)
}

export const forgetOrderSubmission = orderId => {
  releaseOrderSubmission(orderId)
  const snapshots = uni.getStorageSync(STORAGE_KEY_ORDER_CART_SNAPSHOTS) || {}
  delete snapshots[orderId]
  uni.setStorageSync(STORAGE_KEY_ORDER_CART_SNAPSHOTS, snapshots)
}

/** 旧订单及独立购买没有购物车快照，不得按商品规格猜测清理当前购物车。 */
export const consumeOrderCart = orderId => {
  const session = getSessionGeneration()
  const key = `${session}:${orderId}`
  if (cartConsumptions.has(key)) return cartConsumptions.get(key)
  const consumption = (async () => {
    const snapshots = uni.getStorageSync(STORAGE_KEY_ORDER_CART_SNAPSHOTS) || {}
    const snapshot = snapshots[orderId]
    if (snapshot && !await removePurchasedCartItems(snapshot)) return false
    assertCurrentSession(session)
    forgetOrderSubmission(orderId)
    return true
  })().finally(() => cartConsumptions.delete(key))
  cartConsumptions.set(key, consumption)
  return consumption
}

/** 返回购物车时补清理本机下单快照，只认服务端已收款；失败保留快照，下次返回重试。 */
export const recoverPaidOrderCarts = async readOrder => {
  const session = getSessionGeneration()
  const orderIds = Object.keys(uni.getStorageSync(STORAGE_KEY_ORDER_CART_SNAPSHOTS) || {})
  let complete = true
  for (const orderId of orderIds) {
    assertCurrentSession(session)
    try {
      const order = await readOrder(orderId)
      assertCurrentSession(session)
      if (String(order?.id) !== String(orderId)) throw new Error('订单信息与购物车记录不匹配')
      if (Number(order.payStatus ?? order.pay_status) === 1 && !await consumeOrderCart(orderId)) complete = false
    } catch (error) {
      assertCurrentSession(session)
      if (error?.code === 'SESSION_CHANGED') throw error
      complete = false
    }
  }
  return complete
}
