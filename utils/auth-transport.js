import { BASE_URL } from './config.js'
import { createTraceId, logRequestDiagnostic } from './diagnostics.js'

// 登录恢复使用独立传输，不能再次进入业务请求的登录等待队列。
export const authError = (body = {}, status = 401) => Object.assign(
  new Error(body?.message || (status === 401 ? '请重新登录' : '登录校验暂不可用，请重试')),
  { code: Number(body?.code) || status, authReason: body?.data?.authReason || '' }
)

export const requestAuth = (path, { token = '', data = {}, method = 'GET', signal } = {}) => new Promise((resolve, reject) => {
  const traceId = createTraceId()
  const start = Date.now()
  if (signal?.aborted) { reject(signal.reason); return }
  const task = uni.request({
    url: BASE_URL + path, method, data, timeout: 10000,
    header: { 'Content-Type': 'application/json', 'X-Request-Id': traceId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    success: res => {
      logRequestDiagnostic({ traceId, url: path, method, httpStatus: res.statusCode,
        businessCode: res.data?.code, durationMs: Date.now() - start })
      if (signal?.aborted) { reject(signal.reason); return }
      if (res.statusCode === 200 && res.data?.code === 200) resolve(res.data.data)
      else reject(authError(res.data, res.statusCode === 200 ? 503 : res.statusCode))
    },
    fail: () => reject(signal?.reason || Object.assign(new Error('登录校验网络异常，请重试'), { code: 'AUTH_UNAVAILABLE' }))
  })
  signal?.onCancel(() => { task?.abort?.(); reject(signal.reason) })
})

export const getWeChatLoginCode = () => new Promise((resolve, reject) => {
  uni.login({ provider: 'weixin', timeout: 10000,
    success: result => result.code ? resolve(result.code) : reject(new Error('微信登录未返回授权码')),
    fail: () => reject(Object.assign(new Error('微信登录暂不可用，请重试'), { code: 'AUTH_UNAVAILABLE' }))
  })
})
