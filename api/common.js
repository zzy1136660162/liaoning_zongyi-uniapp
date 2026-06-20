import { API_PATHS, BASE_URL, TIMEOUT, TOKEN_KEY } from '../utils/config.js'

const getUploadToken = () => {
  try {
    return uni.getStorageSync(TOKEN_KEY) || ''
  } catch (error) {
    console.warn('category=COMMON_UPLOAD action=get_token result=failed reason=storage_error message=%s', error?.message || error)
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

    console.info('category=COMMON_UPLOAD action=upload_start result=pending url=%s filePath=%s', url, filePath)
    uni.uploadFile({
      url: BASE_URL + url,
      filePath,
      name: options.name || 'file',
      formData: options.formData || {},
      header,
      timeout: options.timeout || TIMEOUT,
      success: (res) => {
        const durationMs = Date.now() - startTime
        try {
          const data = parseUploadResponse(res)
          console.info('category=COMMON_UPLOAD action=upload_complete result=success url=%s durationMs=%s fileUrl=%s', url, durationMs, data.url)
          resolve(data)
        } catch (error) {
          console.warn('category=COMMON_UPLOAD action=upload_complete result=failed url=%s durationMs=%s reason=parse_error message=%s', url, durationMs, error?.message || error)
          reject(error)
        }
      },
      fail: (error) => {
        const durationMs = Date.now() - startTime
        console.warn('category=COMMON_UPLOAD action=upload_complete result=failed url=%s durationMs=%s reason=request_error message=%s', url, durationMs, error?.errMsg || error?.message || error)
        reject(error)
      }
    })
  })
}
