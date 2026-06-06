/**
 * 访问日志 API（兼容层，统一委托 utils/accessLog.js）
 */

import { logPageView as coreLogPageView, logButtonClick as coreLogButtonClick } from '@/utils/accessLog.js'

/**
 * @deprecated 请优先使用 utils/accessLog.js；保留三参数签名兼容旧页面
 */
export function logPageView(accessType, accessTitle, pageId = null) {
  const normalizedPageId = pageId === null || pageId === undefined ? '' : String(pageId)
  return coreLogPageView(accessType, normalizedPageId, {
    accessTitle: accessTitle || accessType,
    legacyApi: true
  })
}

/**
 * @deprecated 请优先使用 utils/accessLog.js
 */
export function logButtonClick(accessType, accessTitle, pageId = null) {
  const normalizedPageId = pageId === null || pageId === undefined ? '' : String(pageId)
  return coreLogButtonClick(accessTitle || accessType, accessType, normalizedPageId, {
    legacyApi: true
  })
}

export { logPageView as defaultLogPageView }
