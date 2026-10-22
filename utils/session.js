import * as storage from './storage.js'

const LOGOUT_KEY = 'explicit_logout'
let generation = 0
let analyticsId = ''
const listeners = new Set()

export const getSessionToken = () => {
  try { return uni.getStorageSync(storage.STORAGE_KEY_TOKEN) || '' }
  catch (_) { return '' }
}

// 切换账号只清理账号归属数据；协议同意等设备偏好不跨账号清除。
export const ACCOUNT_STORAGE_KEYS = [
  storage.STORAGE_KEY_TOKEN, storage.STORAGE_KEY_WECHAT_OPENID, storage.STORAGE_KEY_WECHAT_UNIONID,
  storage.STORAGE_KEY_CART_ITEMS,
  storage.STORAGE_KEY_CURRENT_CONSULTATION_ID, storage.STORAGE_KEY_CHECKOUT_PRODUCT_IDS,
  storage.STORAGE_KEY_AI_CHAT_ID, storage.STORAGE_KEY_AI_CHAT_MESSAGES,
  'prescription_orders', storage.STORAGE_KEY_SELECTED_PRESCRIPTIONS,
  storage.STORAGE_KEY_ORDER_SUBMISSION, storage.STORAGE_KEY_ORDER_CART_SNAPSHOTS,
  // 仅清理旧版残留，不再作为资料、订单或地址数据源。
  'user_info', 'user_register_info', 'user_login_status', 'current_order',
  'shipping_addresses', 'default_address_id', 'temp_selected_address'
]

export const getSessionGeneration = () => generation
export const isCurrentSession = value => value === generation
export const sessionChangedError = () => Object.assign(new Error('登录状态已变更，请重新进入页面'), { code: 'SESSION_CHANGED' })
export const assertCurrentSession = value => {
  if (!isCurrentSession(value)) throw sessionChangedError()
}
export const onSessionChanged = callback => {
  listeners.add(callback)
  return () => listeners.delete(callback)
}
const advanceSession = () => {
  generation += 1
  analyticsId = ''
  listeners.forEach(callback => callback())
}

export const isExplicitlyLoggedOut = () => uni.getStorageSync(LOGOUT_KEY) === true

const clearUserStorage = () => {
  ACCOUNT_STORAGE_KEYS.forEach(key => uni.removeStorageSync(key))
}

// 用户数据在账号边界清理，不把上一账号购物车合并到新账号。
export const endSession = ({ explicit = true } = {}) => {
  advanceSession()
  clearUserStorage()
  uni.setStorageSync(LOGOUT_KEY, explicit)
  uni.hideLoading?.()
  uni.$emit?.('cartUpdated')
}

export const beginSession = token => {
  if (!token) throw new Error('登录未返回有效凭证')
  const previousToken = getSessionToken()
  advanceSession()
  if (previousToken !== token) clearUserStorage()
  uni.setStorageSync(storage.STORAGE_KEY_TOKEN, token)
  uni.setStorageSync(LOGOUT_KEY, false)
}

export const getAnalyticsSessionId = () => {
  if (!analyticsId) analyticsId = `visit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
  return analyticsId
}
