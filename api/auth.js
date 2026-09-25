/**
 * 认证模块API
 */

import { get, post } from '../utils/request.js'
import { API_PATHS } from '../utils/config.js'
import { assertCurrentSession, getSessionGeneration } from '../utils/session.js'
import { 
  STORAGE_KEY_WECHAT_OPENID, 
  STORAGE_KEY_WECHAT_UNIONID, 
  STORAGE_KEY_WECHAT_SESSION_KEY,
  STORAGE_KEY_USER_INFO
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
 * 获取当前登录用户信息
 */
export const getUserProfile = () => {
  return get(API_PATHS.AUTH.USER_PROFILE, {}, {
    needAuth: true,
    showLoading: false
  })
}

/** 使用本次 uni.login 的一次性 code 登录；不能使用本地 openid 作为凭证。 */
export const loginByWeChatCode = (code) => post(API_PATHS.AUTH.LOGIN_BY_OPENID, { code }, {
  needAuth: false,
  showLoading: false,
  header: { 'Content-Type': 'application/x-www-form-urlencoded' }
})

export const getWeChatLoginCode = () => new Promise((resolve, reject) => {
  uni.login({
    provider: 'weixin',
    success: result => result.code ? resolve(result.code) : reject(new Error('微信登录未返回授权码')),
    fail: () => reject(new Error('微信登录失败，请重试'))
  })
})

/**
 * 退出登录
 */
export const logout = () => {
  return post(API_PATHS.AUTH.LOGOUT, {}, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 获取微信 openid 和 unionid
 * @returns {Promise} 返回 { openid, unionid }
 */
export const getWeChatOpenId = async () => {
  const session = getSessionGeneration()
  const code = await getWeChatLoginCode()
  assertCurrentSession(session)
  const identity = await get('/api/wechat/auth/jscode2session', { code }, { needAuth: false, showLoading: false })
  assertCurrentSession(session)
  uni.removeStorageSync(STORAGE_KEY_WECHAT_SESSION_KEY)
  if (identity.openid) uni.setStorageSync(STORAGE_KEY_WECHAT_OPENID, identity.openid)
  if (identity.unionid) uni.setStorageSync(STORAGE_KEY_WECHAT_UNIONID, identity.unionid)
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
    const storedOpenid = uni.getStorageSync(STORAGE_KEY_WECHAT_OPENID)
    if (storedOpenid) {
      return storedOpenid
    }

    const storedUserInfo = uni.getStorageSync(STORAGE_KEY_USER_INFO)
    const userInfoOpenid = storedUserInfo && storedUserInfo.openid
    if (userInfoOpenid) {
      uni.setStorageSync(STORAGE_KEY_WECHAT_OPENID, userInfoOpenid)
      return userInfoOpenid
    }

    return null
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
 * 确保本地存在可用的微信身份信息
 * @returns {Promise<{openid: string, unionid?: string}>}
 */
export const ensureWeChatIdentity = async () => {
  const storedOpenid = getStoredWeChatOpenId()
  if (storedOpenid) {
    return {
      openid: storedOpenid,
      unionid: getStoredWeChatUnionId()
    }
  }

  const wechatData = await getWeChatOpenId()
  if (!wechatData || !wechatData.openid) {
    throw new Error('未获取到微信支付信息，请稍后重试')
  }

  return wechatData
}

/**
 * 清除本地存储的微信信息
 */
export const clearStoredWeChatInfo = () => {
  try {
    uni.removeStorageSync(STORAGE_KEY_WECHAT_OPENID)
    uni.removeStorageSync(STORAGE_KEY_WECHAT_UNIONID)
    uni.removeStorageSync(STORAGE_KEY_WECHAT_SESSION_KEY)
    console.info('event=wechat_identity stage=local_clear result=success')
  } catch (e) {
    console.warn('event=wechat_identity stage=local_clear result=failed reason=storage_error')
  }
}
