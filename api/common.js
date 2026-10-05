import { getSessionGeneration, isCurrentSession, sessionChangedError, getSessionToken } from '../utils/session.js'
import { handleAuthenticationFailure } from '../utils/auth-failure.js'
import { API_PATHS, BASE_URL, TIMEOUT } from '../utils/config.js'

export const parseUploadResponse = (res = {}) => {
  if (res.statusCode !== 200) {
    throw Object.assign(new Error(`上传失败(${res.statusCode || 0})`), { code: res.statusCode })
  }

  const responseData = typeof res.data === 'string'
    ? JSON.parse(res.data || '{}')
    : (res.data || {})

  if (responseData.code !== 200) {
    throw Object.assign(new Error(responseData.message || '上传失败'), { code: responseData.code })
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

  return new Promise((resolve, reject) => {
    const required = options.needAuth !== false
    const token = required ? getSessionToken() : ''
    const header = {
      ...(options.header || {})
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
      success: (res) => {
        if (!isCurrentSession(session)) { reject(sessionChangedError()); return }
        const durationMs = Date.now() - startTime
        try {
          const data = parseUploadResponse(res)
          console.info('event=common_upload stage=response result=success durationMs=%s', durationMs)
          resolve(data)
        } catch (error) {
          if (Number(error.code) === 401) error = handleAuthenticationFailure({ generation: session, token: sentToken, required, redirect: options.authRedirect !== false })
          console.warn('event=common_upload stage=response result=failed reason=parse_error durationMs=%s', durationMs)
          reject(error)
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
}
