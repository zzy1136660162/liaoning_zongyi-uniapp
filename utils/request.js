/**
 * HTTP请求封装
 * 统一处理请求和响应
 */

import { BASE_URL, TIMEOUT } from './config.js'
import { createTraceId, logRequestDiagnostic } from './diagnostics.js'
import { handleAuthenticationFailure } from './auth-failure.js'
import { endSession, getSessionGeneration, isCurrentSession, sessionChangedError, getSessionToken } from './session.js'

/**
 * 获取存储的Token
 */
export const getToken = getSessionToken

/**
 * 清除Token
 */
export const clearToken = () => {
  endSession()
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
 * @param {Boolean} options.returnResponse 是否保留分页等顶层响应字段，默认false
 * @returns {Promise}
 */
export const request = (options = {}) => {
  const session = getSessionGeneration()
  return new Promise((resolve, reject) => {
    const {
      url,
      method = 'GET',
      data = {},
      header = {},
      needAuth = true,
      showLoading = true,
      authRedirect = true,
      silent = false,
      returnResponse = false
    } = options

    const startTime = Date.now()
    const traceId = createTraceId()

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
      ...header,
      'X-Request-Id': traceId,
      'X-Product-Contract': 'category-v1'
    }

    // 如果需要认证，添加Token
    if (needAuth) {
      const token = getToken()
      if (token) {
        requestHeader['Authorization'] = `Bearer ${token}`
      }
    }

    const sentToken = (requestHeader.Authorization || '').replace(/^Bearer\s+/i, '')

    // 发送请求
    uni.request({
      url: BASE_URL + url,
      method: method.toUpperCase(),
      data: data,
      header: requestHeader,
      timeout: TIMEOUT,
      success: (res) => {
        logRequestDiagnostic({ traceId, url, method: method.toUpperCase(),
          httpStatus: res.statusCode, businessCode: res.data && res.data.code,
          durationMs: Date.now() - startTime, stale: !isCurrentSession(session) })
        if (!isCurrentSession(session)) {
          reject(sessionChangedError())
          return
        }
        // 隐藏加载提示
        if (showLoading) {
          uni.hideLoading()
        }

        const { statusCode, data: responseData } = res

        if (statusCode === 401 || Number(responseData?.code) === 401) {
          reject(handleAuthenticationFailure({ generation: session, token: sentToken, required: needAuth,
            redirect: authRedirect, message: responseData?.message }))
          return
        }

        // HTTP状态码检查
        if (statusCode !== 200) {
          if (!silent) uni.showToast({
            title: `请求失败(${statusCode})`,
            icon: 'none',
            duration: 2000
          })
          reject(res)
          return
        }

        // 业务状态码检查
        if (responseData.code === 200) {
          // 普通接口返回 data；分页接口可显式保留顶层元数据。
          resolve(returnResponse ? responseData : responseData.data)
        } else {
          // 其他业务错误
          // uni.showToast({
          //   title: responseData.message || '请求失败',
          //   icon: 'none',
          //   duration: 2000
          // })
          reject(responseData)
        }
      },
      fail: (err) => {
        logRequestDiagnostic({ traceId, url, method: method.toUpperCase(), httpStatus: 0,
          durationMs: Date.now() - startTime, stale: !isCurrentSession(session),
          reason: typeof err.errMsg === 'string' && err.errMsg.includes('timeout') ? 'timeout' : 'network_failure' })
        if (!isCurrentSession(session)) {
          reject(sessionChangedError())
          return
        }
        // 隐藏加载提示
        if (showLoading) {
          uni.hideLoading()
        }


        let errorMessage = '网络请求失败'
        if (err.errMsg) {
          if (err.errMsg.includes('timeout')) {
            errorMessage = '请求超时，请检查网络'
          } else if (err.errMsg.includes('fail')) {
            errorMessage = '网络连接失败'
          }
        }
        // uni.showToast({
        //   title: errorMessage,
        //   icon: 'none',
        //   duration: 2000
        // })

        reject(err)
      }
    })
  })
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
