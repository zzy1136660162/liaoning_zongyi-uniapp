import { getUserProfile } from '../api/auth.js'
import { STORAGE_KEY_WECHAT_OPENID } from './storage.js'
import { beginSession, getSessionGeneration, getSessionToken, isCurrentSession,
  onSessionChanged, sessionChangedError } from './session.js'

/**
 * 账户资料的唯一业务入口。
 * 正式资料只取 /api/user/profile，沿用 id/userName/idCardNo 等服务端字段。
 * 不保存、恢复或兜底读取本地资料；注册表单也不能作为账户资料或注册状态。
 * 这里只合并同一会话、同一跳转策略下尚未完成的请求，请求完成后再次调用仍会访问接口。
 */
const profileRequests = new Map()
onSessionChanged(() => profileRequests.clear())

/**
 * @typedef {Object} AccountProfile 正式账户接口 DTO，禁止与注册表单字段混用。
 * @property {number|string} id 当前认证账号 ID
 * @property {string|null} [userName] 正式姓名
 * @property {string|null} [phone] 正式手机号
 * @property {string|null} [idType] 证件类型
 * @property {string|null} [idCardNo] 证件号码
 * @property {string|null} [avatarUrl] 头像地址
 * @property {number|null} [gender] 性别
 * @property {string|null} [birthday] 出生日期
 */

/** @returns {Promise<Readonly<AccountProfile>>} 接口失败直接抛错，由调用页面展示重试。 */
export const fetchAccountProfile = ({ authRedirect = true } = {}) => {
  const session = getSessionGeneration()
  const token = getSessionToken()
  const pending = profileRequests.get(authRedirect)
  if (pending && pending.session === session && pending.token === token) return pending.promise

  const operation = { session, token }
  operation.promise = getUserProfile({ authRedirect }).then(profile => {
    if (!isCurrentSession(session) || getSessionToken() !== token) throw sessionChangedError()
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)
        || !['string', 'number'].includes(typeof profile.id)
        || !/^[1-9]\d*$/.test(String(profile.id))
        || (typeof profile.id === 'number' && !Number.isSafeInteger(profile.id))) {
      throw new Error('账户资料返回异常，请稍后重试')
    }
    return Object.freeze(profile)
  }).finally(() => {
    // 旧会话请求结束时，不得删除新会话正在等待的请求。
    if (profileRequests.get(authRedirect) === operation) profileRequests.delete(authRedirect)
  })
  profileRequests.set(authRedirect, operation)
  return operation.promise
}

/**
 * 登录成功只建立认证会话，不保存登录响应中的姓名、证件或页面输入。
 * 页面需要正式资料时调用 fetchAccountProfile；资料加载失败不必重新消费短信验证码。
 * 微信身份单独用于支付，不能拿 OpenID 或本地姓名代替登录认证。
 */
export const establishAccountSession = loginResponse => {
  if (typeof loginResponse?.token !== 'string' || !loginResponse.token.trim()) {
    throw new Error('登录未返回有效凭证')
  }
  try {
    beginSession(loginResponse.token)
  } catch (_) {
    throw Object.assign(new Error('登录凭证保存失败，请重试'), {
      code: 'SESSION_STORAGE_FAILED', sessionGeneration: getSessionGeneration()
    })
  }
  if (loginResponse.wechatOpenid) {
    try { uni.setStorageSync(STORAGE_KEY_WECHAT_OPENID, loginResponse.wechatOpenid) }
    catch (_) {
      // 支付身份可通过微信接口重新获取，保存失败不能把已建立的登录误判为失败。
      console.warn('event=account_session stage=wechat_identity result=failed reason=storage_error')
    }
  }
  return getSessionGeneration()
}
