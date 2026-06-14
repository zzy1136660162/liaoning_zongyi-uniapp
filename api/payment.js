/**
 * 支付模块API
 */

import { post } from '@/utils/request.js'

/**
 * 创建支付预订单
 * @param {String} channel 支付渠道 wechat/alipay
 * @param {Number} orderId 订单ID
 */
export const createPrepay = (channel, orderId) => {
  if (channel !== 'wechat') {
    return Promise.reject(new Error('暂不支持该支付渠道'))
  }
  return post(`/api/payment/single/create-by-order/${orderId}`, {}, {
    needAuth: true,
    showLoading: true
  })
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
 * @param {Object} paymentData 支付数据（可选，包含openid、totalAmount等）
 */
export const wechatSinglePay = async (orderId, paymentData = {}) => {
  try {
    console.log('创建单笔支付订单:', orderId, paymentData)
    
    // 调用后端创建单笔支付订单
    // request.js 已统一处理 code，成功时直接返回 data
    const singlePayData = await post('/api/payment/single/create-by-order/' + orderId, paymentData, {
      needAuth: true,
      showLoading: true,
      loadingTitle: '正在创建支付订单...'
    })
    
    console.log('单笔支付创建响应:', singlePayData)
    
    if (!singlePayData || !singlePayData.payParams) {
      throw new Error('支付参数不完整')
    }
    
    const payParams = singlePayData.payParams
    
    console.log('调起微信支付:', payParams)
    
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
          console.log('支付成功:', res)
          uni.showToast({
            title: '支付成功',
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
          console.error('支付失败:', err)
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
    console.error('微信单笔支付失败:', error)
    throw error
  }
}
