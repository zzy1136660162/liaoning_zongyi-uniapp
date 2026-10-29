import { getWeChatLoginCode, requestAuth, authError } from './auth-transport.js'
import { logSessionDiagnostic } from './diagnostics.js'
import { acceptRecoveredSession, endSession, getSessionGeneration, getSessionToken,
  getLoginRequiredReason, isExplicitlyLoggedOut, isCurrentSession, isCurrentOrRenewedCredential,
  onSessionChanged, sessionChangedError } from './session.js'

const recoverable = new Set(['TOKEN_EXPIRED', 'SESSION_MISSING'])
const listeners = new Set()
let state = { status: 'unchecked', reason: '' }
let operation = null
let manualLogin = null
let navigatedGeneration = null

const publish = next => {
  state = next
  logSessionDiagnostic(next.status, next.reason, getSessionGeneration())
  listeners.forEach(listener => {
    try { listener(state) } catch (_) { /* 页面已卸载或展示失败不能中断会话结果。 */ }
  })
}
export const getAccountSessionState = () => ({ ...state })
export const onAccountSessionState = listener => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const unavailable = () => Object.assign(new Error('登录校验暂不可用，请点击重试'), { code: 'AUTH_UNAVAILABLE' })
const isOwned = task => operation === task && !task.signal.aborted && isCurrentSession(task.generation)
const assertOwned = task => { if (!isOwned(task)) throw sessionChangedError() }

export const cancelAccountRecovery = () => {
  if (operation) {
    const old = operation
    operation = null
    old.cancel(sessionChangedError())
    publish({ status: 'unchecked', reason: '' })
  }
}
// 微信授权可能触发 App.onShow；手动登录期间不允许重新启动自动恢复。
export const beginManualAccountLogin = () => {
  cancelAccountRecovery()
  const ticket = {}
  manualLogin = ticket
  return () => { if (manualLogin === ticket) manualLogin = null }
}
export const confirmManualAccountSession = token => {
  if (!token || getSessionToken() !== token) throw sessionChangedError()
  publish({ status: 'authenticated', reason: '' })
}
onSessionChanged(() => {
  cancelAccountRecovery()
  manualLogin = null
  navigatedGeneration = null
  publish({ status: 'unchecked', reason: '' })
})

export const accountReturnPath = explicit => {
  if (typeof explicit === 'string' && /^\/pages\/[\w/-]+(?:\?.*)?$/.test(explicit)
      && !/^\/pages\/(register|login)\//.test(explicit)) return explicit
  const page = typeof getCurrentPages === 'function' ? getCurrentPages().slice(-1)[0] : null
  if (!page?.route || /^pages\/(register|login)\//.test(page.route)) return '/pages/products/medicine_list'
  const query = Object.entries(page.options || {}).filter(([key]) => !/token|password|authorization/i.test(key))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')
  return `/${page.route}${query ? '?' + query : ''}`
}
export const navigateToAccountLogin = (redirect, message) => {
  if (operation) return
  const current = typeof getCurrentPages === 'function' ? getCurrentPages().slice(-1)[0] : null
  if (/^pages\/(register|login)\//.test(current?.route || '') || navigatedGeneration === getSessionGeneration()) return
  navigatedGeneration = getSessionGeneration()
  if (message) uni.showToast({ title: message, icon: 'none' })
  uni.reLaunch({ url: `/pages/login/login?redirect=${encodeURIComponent(accountReturnPath(redirect))}`,
    fail: () => { navigatedGeneration = null } })
}

const failAuthentication = error => {
  const reason = error.authReason || 'LOGIN_REQUIRED'
  if (getSessionToken()) endSession({ explicit: false, reason })
  publish({ status: 'guest', reason, error })
  return error
}

// 全应用同一时刻只有一个恢复操作；超时、退出或切号使所有迟到回调失效。
export const restoreAccountSession = ({ reason = '', retry = false } = {}) => {
  if (manualLogin) return Promise.resolve(false)
  if (operation) return operation.promise
  if (isExplicitlyLoggedOut() || getLoginRequiredReason()) return Promise.resolve(false)
  if (!reason && !retry && state.status === 'authenticated' && getSessionToken()) return Promise.resolve(true)
  if (!reason && !retry && state.status === 'guest') return Promise.resolve(false)
  const callbacks = []
  const task = { generation: getSessionGeneration(), token: getSessionToken(),
    signal: { aborted: false, reason: null, onCancel: callback => callbacks.push(callback) } }
  let cancelReject
  const cancellation = new Promise((_, reject) => { cancelReject = reject })
  task.cancel = error => {
    if (task.signal.aborted) return
    task.signal.aborted = true; task.signal.reason = error
    cancelReject(error)
    callbacks.forEach(callback => callback())
  }
  operation = task
  const timer = setTimeout(() => task.cancel(unavailable()), 10000)
  const work = async () => {
    let failureReason = reason
    if (task.token && !failureReason) {
      try {
        const current = await requestAuth('/api/auth/session', { token: task.token, signal: task.signal })
        assertOwned(task)
        if (!/^[1-9]\d*$/.test(String(current?.userId))) throw unavailable()
        return true
      } catch (error) {
        assertOwned(task)
        if (error.code !== 401) throw error
        if (!recoverable.has(error.authReason)) throw error
        failureReason = error.authReason
      }
    }
    if (failureReason && !recoverable.has(failureReason)) throw authError({ data: { authReason: failureReason } })
    publish({ status: 'recovering', reason: failureReason })
    const code = await getWeChatLoginCode()
    assertOwned(task)
    const result = await requestAuth('/api/auth/recover', { method: 'POST', data: { code }, token: task.token, signal: task.signal })
    assertOwned(task)
    acceptRecoveredSession(result, task.generation, task.token)
    return true
  }
  task.promise = Promise.race([Promise.resolve().then(work), cancellation]).then(result => {
    assertOwned(task)
    operation = null
    publish({ status: 'authenticated', reason: '' })
    return result
  }).catch(error => {
    if (operation !== task || !isCurrentSession(task.generation)) throw sessionChangedError()
    operation = null
    if (error.code === 401) {
      failAuthentication(error)
      return false
    }
    publish({ status: 'unavailable', reason: '', error })
    throw error
  }).finally(() => clearTimeout(timer))
  publish({ status: reason || !task.token ? 'recovering' : 'checking', reason })
  return task.promise
}

// 只等待已有恢复，不给每个普通请求额外增加一次身份查询。
export const waitForSessionRecovery = ({ retryUnavailable = false } = {}) => {
  if (operation) return operation.promise
  return retryUnavailable && state.status === 'unavailable' ? restoreAccountSession({ retry: true }) : null
}

// 恢复失败可能已结束旧会话；仍在等待的受保护页面要得到明确的登录入口。
export const rejectUnavailableSession = (redirect = true) => {
  if (state.status !== 'guest') throw sessionChangedError()
  if (redirect) navigateToAccountLogin(undefined, state.error?.message)
  throw state.error || authError()
}

export const requireAccountSession = async redirect => {
  const generation = getSessionGeneration()
  try {
    if (operation) await operation.promise
    else if (state.status === 'unavailable') await restoreAccountSession({ retry: true })
    if (getSessionToken() && state.status !== 'guest' && state.status !== 'unavailable') return isCurrentSession(generation)
    navigateToAccountLogin(redirect, state.error?.message)
  } catch (error) {
    if (error.code !== 'SESSION_CHANGED') uni.showToast({ title: error.message || '登录校验暂不可用，请重试', icon: 'none' })
  }
  return false
}

// 返回 recovered 时，仅请求层明确允许的读取可重试；写操作必须交还页面确认。
export const recoverAuthenticationFailure = async ({ generation, token, required, redirect = true, message, authReason, allowRecovery = true }) => {
  const error = Object.assign(new Error(message || '请重新登录'), { code: 401, authReason, invalidated: false })
  if (!required || !isCurrentSession(generation)) throw error
  if (token !== getSessionToken()) {
    if (token && isCurrentOrRenewedCredential(generation, token)) return true
    throw sessionChangedError()
  }
  if (allowRecovery && token && recoverable.has(authReason)) {
    const restored = await restoreAccountSession({ reason: authReason })
    if (restored) return true
  } else if (operation) {
    if (await operation.promise) return true
  } else {
    error.invalidated = Boolean(token)
    failAuthentication(error)
  }
  error.sessionGeneration = getSessionGeneration()
  if (redirect) navigateToAccountLogin(undefined, state.error?.message || error.message)
  throw state.error || error
}
