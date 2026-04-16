import request from '@/utils/request.js'

// 防止短时间内重复记录的缓存（与API日志系统共享）
const LOG_CACHE = new Map()
const CACHE_DURATION = 1000 // 1秒内相同日志不重复记录

/**
 * 记录用户行为日志
 * @param {Object} data - 日志数据
 * @param {string} data.logType - 日志类型：PAGE_VIEW 或 BUTTON_CLICK
 * @param {string} data.accessType - 访问类型/模块，如"产品列表"、"产品详情"、"下单页面"
 * @param {string} data.accessTitle - 访问标题，如"用户进入产品列表页面"、"用户点击下单按钮"
 * @param {string} data.pageId - 页面相关ID，如商品ID、订单ID
 */
export function saveBehaviorLog(data) {
  // 生成缓存键，防止短时间内重复记录
  const cacheKey = `${data.logType}_${data.accessType}_${data.accessTitle}_${data.pageId || ''}`
  const now = Date.now()

  // 检查是否在缓存期内有相同记录
  if (LOG_CACHE.has(cacheKey)) {
    const lastLogTime = LOG_CACHE.get(cacheKey)
    if (now - lastLogTime < CACHE_DURATION) {
      console.log('行为日志记录被跳过（重复）:', cacheKey)
      return Promise.resolve() // 返回已解决的Promise，避免影响调用方
    }
  }

  // 更新缓存时间
  LOG_CACHE.set(cacheKey, now)

  // 清理过期缓存（可选，防止内存泄漏）
  if (LOG_CACHE.size > 100) {
    const entries = Array.from(LOG_CACHE.entries())
    const expiredKeys = entries
      .filter(([_, time]) => now - time > CACHE_DURATION * 10)
      .map(([key, _]) => key)

    expiredKeys.forEach(key => LOG_CACHE.delete(key))
  }

  // 将行为日志数据转换为统一的AccessLog格式
  const accessLogData = {
    actionType: data.logType === 'PAGE_VIEW' ? 'PAGE_VIEW' : 'BUTTON_CLICK',
    accessType: data.accessType,
    accessTitle: data.accessTitle,
    pageId: data.pageId || '',
    pageType: data.accessType, // 保持兼容性
    // 将额外信息存储在extraData中
    extraData: JSON.stringify({
      logType: data.logType
    })
  }

  return request({
    url: '/api/access-log',
    method: 'post',
    data: accessLogData,
    // 行为日志不需要认证，允许未登录用户记录
    needAuth: false
  })
}

/**
 * 记录页面访问日志
 * @param {string} accessType - 访问类型/模块
 * @param {string} accessTitle - 访问标题
 * @param {string} pageId - 页面ID
 */
export function logPageView(accessType, accessTitle, pageId = null) {
  return saveBehaviorLog({
    logType: 'PAGE_VIEW',
    accessType: accessType,
    accessTitle: accessTitle,
    pageId: pageId
  })
}

/**
 * 记录按钮点击日志
 * @param {string} accessType - 访问类型/模块
 * @param {string} accessTitle - 访问标题
 * @param {string} pageId - 页面ID
 */
export function logButtonClick(accessType, accessTitle, pageId = null) {
  return saveBehaviorLog({
    logType: 'BUTTON_CLICK',
    accessType: accessType,
    accessTitle: accessTitle,
    pageId: pageId
  })
}
