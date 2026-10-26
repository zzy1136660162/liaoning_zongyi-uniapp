import { getSessionGeneration, isCurrentSession, sessionChangedError, getSessionToken } from '../utils/session.js'
import { recoverAuthenticationFailure, waitForSessionRecovery, rejectUnavailableSession } from '../utils/auth-session.js'
import { API_PATHS, BASE_URL, TIMEOUT } from '../utils/config.js'

export const parseUploadResponse = (res = {}) => {
  const responseData = typeof res.data === 'string'
    ? JSON.parse(res.data || '{}')
    : (res.data || {})

  if (res.statusCode !== 200) {
    throw Object.assign(new Error(`上传失败(${res.statusCode || 0})`), {
      code: res.statusCode, authReason: responseData.data?.authReason
    })
  }

  if (responseData.code !== 200) {
    throw Object.assign(new Error(responseData.message || '上传失败'), { code: responseData.code, authReason: responseData.data?.authReason })
  }

  const data = typeof responseData.data === 'string' ? { url: responseData.data } : (responseData.data || {})
  if (!data.url) {
    throw new Error('上传成功但未返回文件地址')
  }

  return data
}

export const uploadFile = (filePath, options = {}) => {
  const session = getSessionGeneration()
  const startTime = Date.now()
  const url = options.url || API_PATHS.COMMON.UPLOAD

  const execute = () => new Promise((resolve, reject) => {
    const required = options.needAuth !== false
    const token = required ? getSessionToken() : ''
    const header = {
      ...(options.header || {}),
      'X-Product-Contract': 'category-v1'
    }
    if (token) {
      header.Authorization = `Bearer ${token}`
    }

    const sentToken = (header.Authorization || '').replace(/^Bearer\s+/i, '')
    console.info('event=common_upload stage=request result=pending')
    uni.uploadFile({
      url: BASE_URL + url,
      filePath,
      name: options.name || 'file',
      formData: options.formData || {},
      header,
      timeout: options.timeout || TIMEOUT,
      success: async (res) => {
        if (!isCurrentSession(session)) { reject(sessionChangedError()); return }
        const durationMs = Date.now() - startTime
        try {
          const data = parseUploadResponse(res)
          console.info('event=common_upload stage=response result=success durationMs=%s', durationMs)
          resolve(data)
        } catch (error) {
          console.warn('event=common_upload stage=response result=failed reason=parse_error durationMs=%s', durationMs)
          if (Number(error.code) !== 401) { reject(error); return }
          try {
            await recoverAuthenticationFailure({ generation: session, token: sentToken, required,
              redirect: options.authRedirect !== false, authReason: error.authReason, message: error.message })
            reject(Object.assign(new Error('登录已恢复，请重新确认上传'), { code: 'AUTH_RETRY_REQUIRED' }))
          } catch (failure) { reject(failure) }
        }
      },
      fail: (error) => {
        if (!isCurrentSession(session)) { reject(sessionChangedError()); return }
        const durationMs = Date.now() - startTime
        console.warn('event=common_upload stage=request result=failed reason=request_error durationMs=%s', durationMs)
        reject(error)
      }
    })
  })
  const pending = options.needAuth !== false ? waitForSessionRecovery({ retryUnavailable: true }) : null
  if (!pending) return execute()
  return pending.then(ready => {
    if (!ready) return rejectUnavailableSession(options.authRedirect !== false)
    if (!isCurrentSession(session)) throw sessionChangedError()
    return execute()
  })
}
