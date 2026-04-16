/**
 * 访问日志工具
 * 用于记录页面访问和关键操作
 */

import { post } from './request.js'
import { API_PATHS, TOKEN_KEY } from './config.js'
import { getStoredWeChatSessionKey } from '@/api/auth.js'

// 获取设备信息
const getDeviceInfo = () => {
  try {
    const systemInfo = uni.getSystemInfoSync()
    return {
      deviceType: systemInfo.platform || 'unknown',
      screenWidth: systemInfo.screenWidth,
      screenHeight: systemInfo.screenHeight,
      system: systemInfo.system,
      version: systemInfo.version
    }
  } catch (e) {
    console.error('获取设备信息失败:', e)
    return { deviceType: 'unknown' }
  }
}

// 生成或获取本地持久化的 clientId，用于标识客户端/设备
const CLIENT_ID_STORAGE_KEY = 'lnzy_client_id'

const getOrCreateClientId = () => {
  try {
    let clientId = uni.getStorageSync(CLIENT_ID_STORAGE_KEY)
    if (!clientId) {
      // 简单生成一个随机ID，形如: lnzy_xxx
      clientId = 'lnzy_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
      uni.setStorageSync(CLIENT_ID_STORAGE_KEY, clientId)
    }
    return clientId
  } catch (e) {
    console.error('生成/读取 clientId 失败:', e)
    return undefined
  }
}

// 获取当前页面路径
const getCurrentPage = () => {
  try {
    const pages = getCurrentPages()
    if (pages && pages.length > 0) {
      const currentPage = pages[pages.length - 1]
      return currentPage.route || ''
    }
  } catch (e) {
    console.error('获取当前页面失败:', e)
  }
  return ''
}

// 获取来源页面
const getReferer = () => {
  try {
    const pages = getCurrentPages()
    if (pages && pages.length > 1) {
      const prevPage = pages[pages.length - 2]
      return prevPage.route || ''
    }
  } catch (e) {
    console.error('获取来源页面失败:', e)
  }
  return ''
}

/**
 * 记录访问日志
 * @param {Object} options 日志选项
 * @param {String} options.actionType 操作类型：PAGE_VIEW页面访问 BUTTON_CLICK按钮点击
 * @param {String} options.pageType 页面类型：HOME/ORDER_LIST/PRODUCT_DETAIL等
 * @param {String} options.pageId 页面主键ID，如商品ID/订单ID等
 * @param {String} options.buttonName 按钮名称（按钮点击时使用）
 * @param {Object} options.extraData 扩展信息
 */
export const logAccess = async (options = {}) => {
  try {
    const {
      actionType = 'PAGE_VIEW',
      pageType = '',
      pageId = '',
      buttonName = '',
      extraData = {}
    } = options

    // 获取设备信息
    const deviceInfo = getDeviceInfo()
    const currentPage = getCurrentPage()
    const referer = getReferer()

    // 构建日志数据
    const logData = {
      actionType: actionType,
      pageType: pageType || currentPage.split('/').pop().replace('.vue', '').toUpperCase(),
      pageId: pageId || '',
      // 使用小程序 sessionKey 作为会话ID，便于服务端追踪
      sessionId: getStoredWeChatSessionKey() || undefined,
      // 使用本地持久化的 clientId 作为客户端标识
      clientId: getOrCreateClientId(),
      requestUri: '/' + currentPage,
      deviceType: deviceInfo.deviceType,
      referer: referer ? '/' + referer : '',
      extraData: JSON.stringify({
        ...extraData,
        buttonName: buttonName,
        screenWidth: deviceInfo.screenWidth,
        screenHeight: deviceInfo.screenHeight,
        system: deviceInfo.system,
        version: deviceInfo.version
      })
    }

    // 异步发送日志，不阻塞主流程
    // 携带 token 但不强制校验（needAuth:false 避免 401 打断业务）
    post(API_PATHS.ACCESS_LOG.SAVE, logData, {
      needAuth: false, // 不强制校验，未登录也允许
      showLoading: false, // 不显示加载提示
      header: buildAuthHeaderIfExists()
    }).catch(err => {
      // 静默失败，不影响业务
      console.error('记录访问日志失败:', err)
    })
  } catch (e) {
    // 静默失败，不影响业务
    console.error('记录访问日志异常:', e)
  }
}

// 如果本地有 token，则附加到 header，未登录则返回空头
const buildAuthHeaderIfExists = () => {
  try {
    const token = uni.getStorageSync(TOKEN_KEY)
    if (token) {
      return { Authorization: `Bearer ${token}` }
    }
  } catch (e) {
    console.error('读取 token 失败:', e)
  }
  return {}
}

/**
 * 记录页面访问
 * @param {String} pageType 页面类型
 * @param {String} pageId 页面ID（可选）
 * @param {Object} extraData 扩展信息（可选）
 */
export const logPageView = (pageType, pageId = '', extraData = {}) => {
  logAccess({
    actionType: 'PAGE_VIEW',
    pageType: pageType,
    pageId: pageId,
    extraData: extraData
  })
}

/**
 * 记录按钮点击
 * @param {String} buttonName 按钮名称
 * @param {String} pageType 页面类型
 * @param {String} pageId 页面ID（可选）
 * @param {Object} extraData 扩展信息（可选）
 */
export const logButtonClick = (buttonName, pageType = '', pageId = '', extraData = {}) => {
  logAccess({
    actionType: 'BUTTON_CLICK',
    pageType: pageType,
    pageId: pageId,
    buttonName: buttonName,
    extraData: extraData
  })
}

