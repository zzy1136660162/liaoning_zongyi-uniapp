import * as storage from './storage.js'

const LOGOUT_KEY = 'explicit_logout'
let generation = 0
let analyticsId = ''
const listeners = new Set()

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
  Object.entries(storage).forEach(([name, key]) => {
    if (name.startsWith('STORAGE_KEY_')) uni.removeStorageSync(key)
  })
  ;['auth_token', 'user_token', 'user_id', 'temp_selected_address', 'wechat_session_key'].forEach(key => uni.removeStorageSync(key))
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
  const previousToken = uni.getStorageSync(storage.STORAGE_KEY_TOKEN) || uni.getStorageSync('auth_token')
  advanceSession()
  if (previousToken && previousToken !== token) clearUserStorage()
  uni.removeStorageSync('auth_token')
  uni.removeStorageSync('wechat_session_key')
  uni.setStorageSync(storage.STORAGE_KEY_TOKEN, token)
  uni.setStorageSync(LOGOUT_KEY, false)
}

export const getAnalyticsSessionId = () => {
  if (!analyticsId) analyticsId = `visit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
  return analyticsId
}
