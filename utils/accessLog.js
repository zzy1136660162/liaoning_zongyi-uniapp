import { API_PATHS, BASE_URL } from './config.js'
import { getAnalyticsSessionId, getSessionToken } from './session.js'

const ACTION_TYPES = new Set(['PAGE_VIEW', 'BUTTON_CLICK', 'BEHAVIOR'])
const ACTION_RESULTS = new Set(['', 'SUCCESS', 'FAILED', 'CANCELLED', 'UNKNOWN'])
const CLIENT_ID_KEY = 'lnzy_client_id'

const getClientId = () => {
  try {
    let id = uni.getStorageSync(CLIENT_ID_KEY)
    if (!id) {
      id = 'lnzy_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
      uni.setStorageSync(CLIENT_ID_KEY, id)
    }
    return id
  } catch (_) {
    return undefined
  }
}

export const getActionFailureResult = error => {
  if (error?.cancelled || error?.code === 'PAYMENT_CANCELLED' || error?.message === '用户取消支付' || /cancel/i.test(error?.errMsg || '')) return 'CANCELLED'
  const code = Number(error?.code || error?.statusCode)
  return code >= 400 && code < 500 && code !== 408 ? 'FAILED' : 'UNKNOWN'
}

/** 页面显式触发；日志失败不影响业务，也不触发认证跳转或接口访问日志。 */
export const logAccess = (options = {}) => {
  try {
    if (!options || typeof options !== 'object' || Array.isArray(options)) return
    const { actionType, moduleCode, accessType, pageType, actionCode, accessTitle, accessDescription,
      pageId = '', actionResult = '', extraData = {} } = options
    if (!ACTION_TYPES.has(actionType) || !ACTION_RESULTS.has(actionResult)) return
    if (![moduleCode, accessType, pageType, actionCode, accessTitle, accessDescription]
      .every(value => typeof value === 'string' && value.trim())) return
    if (!extraData || typeof extraData !== 'object' || Array.isArray(extraData)) return
    const serializedExtra = JSON.stringify(extraData)
    if (serializedExtra.length > 8192) return

    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    const current = pages[pages.length - 1]
    const route = options.requestUri || (current?.route ? '/' + current.route.replace(/^\//, '') : '')
    if (!route.startsWith('/pages/') || /[?#]/.test(route)) return
    const previous = pages.length > 1 ? pages[pages.length - 2]?.route : ''
    const token = getSessionToken()
    let deviceType = 'unknown'
    try { deviceType = uni.getSystemInfoSync().platform || deviceType } catch (_) { /* 设备信息缺失仍记录行为。 */ }

    uni.request({
      url: BASE_URL + API_PATHS.ACCESS_LOG.SAVE,
      method: 'POST',
      timeout: 5000,
      header: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      data: {
        moduleCode, accessType, pageType, pageId: String(pageId ?? ''), actionType, actionCode,
        accessTitle, accessDescription, actionResult, requestUri: route,
        sessionId: getAnalyticsSessionId(), clientId: getClientId(), deviceType,
        referer: options.referer || (previous ? '/' + previous.replace(/^\//, '') : ''),
        extraData: serializedExtra
      },
      fail() {}
    })
  } catch (_) {
    // 日志不重试、不输出业务载荷，避免重复上报及泄露用户信息。
  }
}

export const logPageView = options => logAccess({ ...options, actionType: 'PAGE_VIEW' })
export const logButtonClick = options => logAccess({ ...options, actionType: 'BUTTON_CLICK' })
