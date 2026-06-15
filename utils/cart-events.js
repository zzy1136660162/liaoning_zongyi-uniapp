/**
 * 购物车全局事件：角标与列表跨页刷新
 */

export const CART_UPDATED_EVENT = 'cartUpdated'

export const CART_RELOAD_SOURCE = 'reload'

export const shouldReloadCartFromServer = (event = {}) => {
  return event?.reload === true || event?.source === CART_RELOAD_SOURCE
}

export const shouldSkipRecentCartRefresh = (now, lastRefreshAt, minIntervalMs) => {
  const current = Number(now)
  const last = Number(lastRefreshAt)
  const interval = Number(minIntervalMs)

  if (!Number.isFinite(current) || !Number.isFinite(last) || !Number.isFinite(interval)) {
    return false
  }
  if (last <= 0 || interval <= 0) {
    return false
  }
  return current - last < interval
}

/**
 * 订阅购物车变更事件
 * @param {Function} handler
 * @returns {Function} 取消订阅
 */
export const subscribeCartUpdated = (handler) => {
  if (typeof handler !== 'function') {
    return () => {}
  }

  uni.$on(CART_UPDATED_EVENT, handler)
  return () => {
    uni.$off(CART_UPDATED_EVENT, handler)
  }
}
