/**
 * 认证模块API
 */

import { get, post } from '../utils/request.js'
import { API_PATHS } from '../utils/config.js'
import { assertCurrentSession, getSessionGeneration, getSessionToken, sessionChangedError } from '../utils/session.js'
import { getWeChatLoginCode } from '../utils/auth-transport.js'
export { getWeChatLoginCode } from '../utils/auth-transport.js'
import { 
  STORAGE_KEY_WECHAT_OPENID, 
  STORAGE_KEY_WECHAT_UNIONID
} from '../utils/storage.js'

/**
 * 发送短信验证码
 * @param {String} phone 手机号
 */
export const sendSmsCode = (phone) => {
  return post(API_PATHS.AUTH.SEND_SMS, null, {
    needAuth: false,
    showLoading: true,
    header: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: { phone }
  }).then(() => {
      uni.showToast({
        title: '验证码已发送',
        icon: 'success'
      })
    return true
  })
}

/**
 * 手机号验证码登录/注册
 * @param {Object} params
 * @param {String} params.phone 手机号
 * @param {String} params.code 验证码
 */
export const login = (params) => {
  return post(API_PATHS.AUTH.LOGIN, params, {
    needAuth: false,
    showLoading: true
  })
}

/**
 * 获取当前登录用户资料的 HTTP 协议层；业务页面统一调用 utils/account.js。
 * 禁止把注册表单或本地资料作为该接口的兜底结果。
 */
export const getUserProfile = ({ authRedirect = true } = {}) => {
  return get(API_PATHS.AUTH.USER_PROFILE, {}, {
    needAuth: true,
    authRedirect,
    showLoading: false
  })
}

/**
 * 退出登录
 */
export { logout } from './logout.js'

const assertIdentitySession = (session, token) => {
  assertCurrentSession(session)
  if (getSessionToken() !== token) throw sessionChangedError()
}

/**
 * 获取本次微信接口确认的 openid/unionid，供标识展示等场景使用。
 * Token 决定商城账号，微信 code 由服务端向微信验证，两者不能相互替代。
 * 标识缓存只是可丢弃的便利数据；缓存写入失败不能丢弃本次成功取得的身份。
 * code 已在此接口消费，不能再把它传给支付接口重复交换。
 * @returns {Promise<{openid: string, unionid?: string}>} 本次服务端验证的微信标识。
 */
export const getWeChatOpenId = async () => {
  const session = getSessionGeneration()
  const token = getSessionToken()
  const code = await getWeChatLoginCode()
  assertIdentitySession(session, token)
  const identity = await get('/api/wechat/auth/jscode2session', { code }, { needAuth: false, showLoading: false })
  assertIdentitySession(session, token)
  if (typeof identity?.openid !== 'string' || !identity.openid.trim()) throw new Error('未获取到微信身份，请重试')
  for (const [key, value] of [[STORAGE_KEY_WECHAT_OPENID, identity.openid], [STORAGE_KEY_WECHAT_UNIONID, identity.unionid]]) {
    if (!value) continue
    try { uni.setStorageSync(key, value) }
    catch (_) {
      // 缓存和诊断均为尽力处理，不能把本次成功的微信身份交换改成失败。
      try { console.warn('event=wechat_identity stage=identity_cache result=failed reason=storage_error') }
      catch (_) { /* 诊断渠道不可用时，仍返回本次已核验的身份。 */ }
    }
  }
  return { openid: identity.openid, unionid: identity.unionid }
}

/**
 * 获取微信用户信息
 * @returns {Promise} 返回用户信息
 */
export const getWeChatUserInfo = () => {
  return new Promise((resolve, reject) => {
    uni.getUserInfo({
      provider: 'weixin',
      success: (infoRes) => {
        console.debug('event=wechat_profile stage=user_info result=received')
        resolve(infoRes.userInfo)
      },
      fail: () => {
        console.warn('event=wechat_profile stage=user_info result=failed reason=provider_error')
        reject(new Error('获取用户信息失败'))
      }
    })
  })
}

/**
 * 获取微信用户信息（使用 getUserProfile，需要用户授权）
 * @returns {Promise} 返回用户信息
 */
export const getWeChatUserProfile = () => {
  return new Promise((resolve, reject) => {
    uni.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.debug('event=wechat_profile stage=user_profile result=received')
        resolve(res.userInfo)
      },
      fail: () => {
        console.warn('event=wechat_profile stage=user_profile result=failed reason=authorization_failed')
        reject(new Error('用户拒绝授权'))
      }
    })
  })
}

/**
 * 从本地存储获取微信 openid
 * @returns {String|null} openid 或 null
 */
export const getStoredWeChatOpenId = () => {
  try {
    return uni.getStorageSync(STORAGE_KEY_WECHAT_OPENID) || null
  } catch (e) {
    console.warn('event=wechat_identity stage=local_identity result=failed reason=storage_error')
    return null
  }
}

/**
 * 从本地存储获取微信 unionid
 * @returns {String|null} unionid 或 null
 */
export const getStoredWeChatUnionId = () => {
  try {
    return uni.getStorageSync(STORAGE_KEY_WECHAT_UNIONID) || null
  } catch (e) {
    console.warn('event=wechat_identity stage=local_union result=failed reason=storage_error')
    return null
  }
}

/**
 * 为一次支付取得新的、尚未消费的微信授权码。
 * 不读取本地 openid，也不预先调用 jscode2session：支付接口会验证此 code，
 * 并与 Token 所属账户的微信绑定核对，避免缓存过时或调用者伪造付款人。
 * 这里不建立/切换商城会话，不修改账户绑定；授权失败或期间切号立即停止支付。
 * @returns {Promise<{wechatCode: string}>} 只交给本次受 Token 保护的支付创建请求。
 */
export const ensureWeChatIdentity = async () => {
  const session = getSessionGeneration()
  const token = getSessionToken()
  if (!token) throw new Error('请先登录后支付')
  const wechatCode = await getWeChatLoginCode()
  assertIdentitySession(session, token)
  return { wechatCode }
}

/**
 * 清除本地存储的微信信息
 */
export const clearStoredWeChatInfo = () => {
  try {
    uni.removeStorageSync(STORAGE_KEY_WECHAT_OPENID)
    uni.removeStorageSync(STORAGE_KEY_WECHAT_UNIONID)
    console.info('event=wechat_identity stage=local_clear result=success')
  } catch (e) {
    console.warn('event=wechat_identity stage=local_clear result=failed reason=storage_error')
  }
}
