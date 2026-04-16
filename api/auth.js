/**
 * 认证模块API
 */

import { get, post } from '@/utils/request.js'
import { API_PATHS } from '@/utils/config.js'
import { 
  STORAGE_KEY_WECHAT_OPENID, 
  STORAGE_KEY_WECHAT_UNIONID, 
  STORAGE_KEY_WECHAT_SESSION_KEY 
} from '@/utils/storage.js'

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

/**
 * 通过微信 openid 查询用户信息
 * @param {String} openid 微信 openid
 */
export const getUserByOpenid = (openid) => {
  return get(API_PATHS.AUTH.USER_BY_OPENID, { openid }, {
    needAuth: false,
    showLoading: false
  })
}

/**
 * 通过 openid 自动登录（无需验证码）
 * @param {String} openid 微信 openid
 */
export const loginByOpenid = (openid) => {
  return post(API_PATHS.AUTH.LOGIN_BY_OPENID, null, {
    needAuth: false,
    showLoading: false,
    header: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: { openid }
  })
}

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
 * @returns {Promise} 返回 { openid, sessionKey, unionid }
 */
export const getWeChatOpenId = () => {
  return new Promise((resolve, reject) => {
    // 调用微信登录获取 code
    uni.login({
      provider: 'weixin',
      success: async (loginRes) => {
        console.log('微信登录成功，code:', loginRes.code)
        
        try {
          // 调用后端接口，用 code 换取 openid（request 已经自动处理 code 和 data）
          const wechatData = await get('/api/wechat/auth/jscode2session', { code: loginRes.code }, {
            needAuth: false,
            showLoading: false
          })
          console.log('获取微信信息成功:', wechatData)

          // ✅ 保存微信信息到本地存储
          try {
            // 保存 openid（必有）
            if (wechatData.openid) {
              uni.setStorageSync(STORAGE_KEY_WECHAT_OPENID, wechatData.openid)
              console.log('✅ 已保存 openid 到本地存储')
            }
            
            // 保存 unionid（可能为空）
            if (wechatData.unionid) {
              uni.setStorageSync(STORAGE_KEY_WECHAT_UNIONID, wechatData.unionid)
              console.log('✅ 已保存 unionid 到本地存储')
            } else {
              console.log('⚠️ unionid 为空，未保存')
            }
            
            // 保存 sessionKey（用于后续解密）
            if (wechatData.sessionKey) {
              uni.setStorageSync(STORAGE_KEY_WECHAT_SESSION_KEY, wechatData.sessionKey)
              console.log('✅ 已保存 sessionKey 到本地存储')
            }
          } catch (storageError) {
            console.error('❌ 保存微信信息到本地存储失败:', storageError)
            // 不影响主流程，继续执行
          }
          
          resolve(wechatData)
        } catch (error) {
          console.error('获取openid异常:', error)
          reject(error)
        }
      },
      fail: (err) => {
        console.error('微信登录失败:', err)
        reject(new Error('微信登录失败'))
      }
    })
  })
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
        console.log('获取用户信息成功:', infoRes)
        resolve(infoRes.userInfo)
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err)
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
        console.log('获取用户信息成功:', res)
        resolve(res.userInfo)
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err)
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
    console.error('获取本地存储的 openid 失败:', e)
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
    console.error('获取本地存储的 unionid 失败:', e)
    return null
  }
}

/**
 * 从本地存储获取微信 sessionKey
 * @returns {String|null} sessionKey 或 null
 */
export const getStoredWeChatSessionKey = () => {
  try {
    return uni.getStorageSync(STORAGE_KEY_WECHAT_SESSION_KEY) || null
  } catch (e) {
    console.error('获取本地存储的 sessionKey 失败:', e)
    return null
  }
}

/**
 * 清除本地存储的微信信息
 */
export const clearStoredWeChatInfo = () => {
  try {
    uni.removeStorageSync(STORAGE_KEY_WECHAT_OPENID)
    uni.removeStorageSync(STORAGE_KEY_WECHAT_UNIONID)
    uni.removeStorageSync(STORAGE_KEY_WECHAT_SESSION_KEY)
    console.log('✅ 已清除本地存储的微信信息')
  } catch (e) {
    console.error('清除本地存储的微信信息失败:', e)
  }
}
