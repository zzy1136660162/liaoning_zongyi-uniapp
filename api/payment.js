import { getSessionGeneration, getSessionToken, isCurrentSession, sessionChangedError } from '../utils/session.js'
/**
 * 支付模块API
 */

import { post } from '../utils/request.js'
import { ensureWeChatIdentity } from './auth.js'
import { logPaymentDiagnostic } from '../utils/diagnostics.js'
import { waitForSessionRecovery, rejectUnavailableSession } from '../utils/auth-session.js'

const isPaymentSessionCurrent = (session, token) => isCurrentSession(session) && getSessionToken() === token
const assertPaymentSession = (session, token) => {
  if (!isPaymentSessionCurrent(session, token)) throw sessionChangedError()
}

/**
 * 所有页面共用的支付准备入口。
 * Token 认证订单所属商城账号；本次微信 code 由后端核验付款微信身份。
 * 调用者不能提供 openid、金额或认证身份覆盖这两个来源，金额继续由服务端订单计算。
 * 每次重试都重新授权，禁止复用已消费的 code；授权失败或切号时不创建支付尝试。
 */
const prepareWechatPayment = async (orderId, session, token) => {
  const identity = await ensureWeChatIdentity()
  assertPaymentSession(session, token)
  const response = await post(`/api/payment/single/create-by-order/${orderId}`, {
    wechatCode: identity.wechatCode
  }, { needAuth: true, showLoading: true })
  assertPaymentSession(session, token)
  return response
}

/**
 * 创建支付预订单；仅需渠道和订单 ID，付款身份在模块内部取得。
 * @param {String} channel 支付渠道 wechat/alipay
 * @param {Number} orderId 订单ID
 */
export const createPrepay = async (channel, orderId) => {
  if (channel !== 'wechat') {
    throw new Error('暂不支持该支付渠道')
  }
  const session = getSessionGeneration()
  const recovery = waitForSessionRecovery({ retryUnavailable: true })
  if (recovery && !(await recovery)) return rejectUnavailableSession()
  if (!isCurrentSession(session)) throw sessionChangedError()
  return prepareWechatPayment(orderId, session, getSessionToken())
}

/**
 * 微信支付
 * @param {Number} orderId 订单ID
 */
export const wechatPay = async (orderId) => {
  return wechatSinglePay(orderId)
}

/**
 * 主动同步订单支付状态（补偿微信回调延迟或失败）
 * @param {Number} orderId 订单ID
 * @param {String} outTradeNo 商户支付单号
 */
export const syncPaymentByOrder = async (orderId, outTradeNo) => {
  return post(`/api/payment/single/sync-by-order/${orderId}`, { outTradeNo }, {
    needAuth: true,
    showLoading: false
  })
}

/**
 * 微信单笔支付（商品费用+快递费统一支付给主商户）
 * @param {Number} orderId 订单ID
 * 与订单详情、确认页统一使用同一身份协议，不接受页面传入的 openid 或金额。
 * SDK 成功仅代表付款提交，到账及履约仍由服务端查单/签名回调确认。
 */
export const wechatSinglePay = async (orderId) => {
  const session = getSessionGeneration()
  const recovery = waitForSessionRecovery({ retryUnavailable: true })
  if (recovery && !(await recovery)) return rejectUnavailableSession()
  if (!isCurrentSession(session)) throw sessionChangedError()
  const token = getSessionToken()
  try {
    logPaymentDiagnostic('client_pay_prepare', orderId)
    
    const singlePayData = await prepareWechatPayment(orderId, session, token)
    
    logPaymentDiagnostic('client_pay_prepared', orderId)
    
    if (!singlePayData || !singlePayData.payParams) {
      throw new Error('支付参数不完整')
    }
    
    assertPaymentSession(session, token)
    const payParams = singlePayData.payParams
    
    logPaymentDiagnostic('client_pay_invoke', orderId)
    
    // 调起微信支付
    return new Promise((resolve, reject) => {
      uni.requestPayment({
        provider: 'wxpay',
        timeStamp: payParams.timeStamp,
        nonceStr: payParams.nonceStr,
        package: payParams.packageValue,
        signType: payParams.signType || 'RSA',
        paySign: payParams.paySign,
        success: (res) => {
          if (!isPaymentSessionCurrent(session, token)) { reject(sessionChangedError()); return }
          // The client callback is not authoritative proof of server settlement.
          logPaymentDiagnostic('client_pay_submitted', orderId)
          uni.showToast({
            title: '付款已提交',
            icon: 'success'
          })
          resolve({
            success: true,
            outTradeNo: singlePayData.outTradeNo,
            prepayId: singlePayData.prepayId,
            ...res
          })
        },
        fail: (err) => {
          if (!isPaymentSessionCurrent(session, token)) { reject(sessionChangedError()); return }
          logPaymentDiagnostic('client_pay_failed', orderId,
            err.errMsg === 'requestPayment:fail cancel' ? 'user_cancelled' : 'sdk_failure')
          if (err.errMsg === 'requestPayment:fail cancel') {
            uni.showToast({
              title: '已取消支付',
              icon: 'none'
            })
            reject(new Error('用户取消支付'))
          } else {
            uni.showToast({
              title: '支付失败: ' + (err.errMsg || '未知错误'),
              icon: 'none',
              duration: 2000
            })
            reject(err)
          }
        }
      })
    })
  } catch (error) {
    logPaymentDiagnostic('client_pay_failed', orderId,
      error && error.code === 'SESSION_CHANGED' ? 'session_changed' : 'prepare_failed')
    throw error
  }
}
