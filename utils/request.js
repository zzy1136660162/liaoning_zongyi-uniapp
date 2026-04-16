/**
 * HTTP请求封装
 * 统一处理请求和响应
 */

import { BASE_URL, TIMEOUT, TOKEN_KEY } from './config.js'
import { getStoredWeChatSessionKey } from '@/api/auth.js'

/**
 * 获取存储的Token
 */
export const getToken = () => {
  try {
    return uni.getStorageSync(TOKEN_KEY) || ''
  } catch (e) {
    console.error('获取Token失败:', e)
    return ''
  }
}

/**
 * 保存Token到本地存储
 */
export const saveToken = (token) => {
  try {
    uni.setStorageSync(TOKEN_KEY, token)
  } catch (e) {
    console.error('保存Token失败:', e)
  }
}

/**
 * 清除Token
 */
export const clearToken = () => {
  try {
    uni.removeStorageSync(TOKEN_KEY)
  } catch (e) {
    console.error('清除Token失败:', e)
  }
}

/**
 * HTTP请求封装
 * @param {Object} options 请求配置
 * @param {String} options.url 请求路径（不含baseURL）
 * @param {String} options.method 请求方法，默认GET
 * @param {Object} options.data 请求参数
 * @param {Object} options.header 请求头
 * @param {Boolean} options.needAuth 是否需要认证，默认true
 * @param {Boolean} options.showLoading 是否显示加载提示，默认true
 * @returns {Promise}
 */
export const request = (options = {}) => {
  return new Promise((resolve, reject) => {
    const {
      url,
      method = 'GET',
      data = {},
      header = {},
      needAuth = true,
      showLoading = true
    } = options

    const startTime = Date.now()

    // 显示加载提示
    if (showLoading) {
      uni.showLoading({
        title: '加载中...',
        mask: true
      })
    }

    // 构建请求头
    const requestHeader = {
      'Content-Type': 'application/json',
      ...header
    }

    // 如果需要认证，添加Token
    if (needAuth) {
      const token = getToken()
      if (token) {
        requestHeader['Authorization'] = `Bearer ${token}`
      }
    }

    // 发送请求
    uni.request({
      url: BASE_URL + url,
      method: method.toUpperCase(),
      data: data,
      header: requestHeader,
      timeout: TIMEOUT,
      success: (res) => {
        const durationMs = Date.now() - startTime
        // 隐藏加载提示
        if (showLoading) {
          uni.hideLoading()
        }

        const { statusCode, data: responseData } = res

        // HTTP状态码检查
        if (statusCode !== 200) {
          uni.showToast({
            title: `请求失败(${statusCode})`,
            icon: 'none',
            duration: 2000
          })
          logApiAccess(url, method, statusCode, durationMs)
          reject(res)
          return
        }

        // 业务状态码检查
        if (responseData.code === 200) {
          // ✅ 统一返回 data 字段，页面层无需再取 .data
          logApiAccess(url, method, statusCode, durationMs)
          resolve(responseData.data)
        } else if (responseData.code === 401) {
          // Token过期或未登录
          clearToken()
          uni.showToast({
            title: '登录已过期，请重新登录',
            icon: 'none',
            duration: 2000
          })
          // 跳转到登录页
          setTimeout(() => {
            uni.reLaunch({
              url: '/pages/register/register'
            })
          }, 2000)
          logApiAccess(url, method, statusCode, durationMs)
          reject(responseData)
        } else {
          // 其他业务错误
          // uni.showToast({
          //   title: responseData.message || '请求失败',
          //   icon: 'none',
          //   duration: 2000
          // })
            console.log(responseData.message )
          logApiAccess(url, method, statusCode, durationMs)
          reject(responseData)
        }
      },
      fail: (err) => {
        const durationMs = Date.now() - startTime
        // 隐藏加载提示
        if (showLoading) {
          uni.hideLoading()
        }

        console.error('请求失败:', err)
        
        let errorMessage = '网络请求失败'
        if (err.errMsg) {
          if (err.errMsg.includes('timeout')) {
            errorMessage = '请求超时，请检查网络'
          } else if (err.errMsg.includes('fail')) {
            errorMessage = '网络连接失败'
          }
        }
          console.log(errorMessage)
        // uni.showToast({
        //   title: errorMessage,
        //   icon: 'none',
        //   duration: 2000
        // })
        
        logApiAccess(url, method, 0, durationMs)
        reject(err)
      }
    })
  })
}

const CLIENT_ID_STORAGE_KEY = 'lnzy_client_id'

const getOrCreateClientIdForRequest = () => {
  try {
    let clientId = uni.getStorageSync(CLIENT_ID_STORAGE_KEY)
    if (!clientId) {
      clientId = 'lnzy_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
      uni.setStorageSync(CLIENT_ID_STORAGE_KEY, clientId)
    }
    return clientId
  } catch (e) {
    console.error('生成/读取 clientId 失败:', e)
    return undefined
  }
}

const isCategoryProductsApi = (url) => {
  if (!url) return false
  if (!url.startsWith('/')) {
    url = '/' + url
  }
  const prefix = '/api/categories/'
  const suffix = '/products'
  if (!url.startsWith(prefix) || !url.endsWith(suffix)) {
    return false
  }
  const middle = url.substring(prefix.length, url.length - suffix.length)
  if (!middle) return false
  return !Number.isNaN(Number(middle))
}

// API日志去重缓存
const API_LOG_CACHE = new Map()
const API_LOG_CACHE_DURATION = 5000 // 5秒内相同API调用不重复记录

const logApiAccess = (url, method, statusCode, durationMs) => {
  if (isCategoryProductsApi(url)) {
    return
  }

  // 生成去重键：基于用户会话 + URL + 方法，确保同一用户在会话期间不重复记录
  const sessionId = getStoredWeChatSessionKey ? getStoredWeChatSessionKey() : 'anonymous'
  const cacheKey = `${sessionId}_${method.toUpperCase()}_${url}`
  const now = Date.now()

  // 检查是否在缓存期内有相同记录
  if (API_LOG_CACHE.has(cacheKey)) {
    const lastLogTime = API_LOG_CACHE.get(cacheKey)
    if (now - lastLogTime < API_LOG_CACHE_DURATION) {
      console.log('API日志记录被跳过（重复）:', cacheKey)
      return
    }
  }

  // 更新缓存时间
  API_LOG_CACHE.set(cacheKey, now)

  // 清理过期缓存（可选，防止内存泄漏）
  if (API_LOG_CACHE.size > 100) {
    const entries = Array.from(API_LOG_CACHE.entries())
    const expiredKeys = entries
      .filter(([_, time]) => now - time > API_LOG_CACHE_DURATION * 5)
      .map(([key, _]) => key)

    expiredKeys.forEach(key => API_LOG_CACHE.delete(key))
  }

  try {
    const token = getToken()
    const header = {
      'Content-Type': 'application/json'
    }
    if (token) {
      header['Authorization'] = `Bearer ${token}`
    }

    const sessionId = getStoredWeChatSessionKey ? getStoredWeChatSessionKey() : undefined
    const clientId = getOrCreateClientIdForRequest()

    const data = {
      actionType: 'API_CALL',
      pageType: '',
      pageId: '',
      sessionId,
      clientId,
      requestUri: url,
      httpMethod: method.toUpperCase(),
      httpStatus: statusCode,
      durationMs
    }

    uni.request({
      url: BASE_URL + '/api/access-log',
      method: 'POST',
      data,
      header
    })
  } catch (e) {
    console.error('记录接口访问日志失败:', e)
  }
}

/**
 * GET请求
 */
export const get = (url, params = {}, options = {}) => {
  return request({
    url,
    method: 'GET',
    data: params,
    ...options
  })
}

/**
 * POST请求
 */
export const post = (url, data = {}, options = {}) => {
  return request({
    url,
    method: 'POST',
    data,
    ...options
  })
}

/**
 * PUT请求
 */
export const put = (url, data = {}, options = {}) => {
  return request({
    url,
    method: 'PUT',
    data,
    ...options
  })
}

/**
 * DELETE请求
 */
export const del = (url, data = {}, options = {}) => {
  return request({
    url,
    method: 'DELETE',
    data,
    ...options
  })
}

export default request
