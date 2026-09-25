import { getSessionGeneration, isCurrentSession, sessionChangedError } from '../utils/session.js'
import { API_PATHS, BASE_URL, TIMEOUT, TOKEN_KEY } from '../utils/config.js'

const getUploadToken = () => {
  try {
    return uni.getStorageSync(TOKEN_KEY) || ''
  } catch (error) {
    console.warn('event=common_upload stage=credential result=failed reason=storage_error')
    return ''
  }
}

export const parseUploadResponse = (res = {}) => {
  if (res.statusCode !== 200) {
    throw new Error(`上传失败(${res.statusCode || 0})`)
  }

  const responseData = typeof res.data === 'string'
    ? JSON.parse(res.data || '{}')
    : (res.data || {})

  if (responseData.code !== 200) {
    throw new Error(responseData.message || '上传失败')
  }

  const data = responseData.data || {}
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
    const token = getUploadToken()
    const header = {
      ...(options.header || {})
    }
    if (token) {
      header.Authorization = `Bearer ${token}`
    }

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
