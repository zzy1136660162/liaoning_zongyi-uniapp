/**
 * 支付模块API
 */

import { post, get } from '@/utils/request.js'
import { API_PATHS } from '@/utils/config.js'
import { getStoredWeChatOpenId } from '@/api/auth.js'

/**
 * 创建支付预订单
 * @param {String} channel 支付渠道 wechat/alipay
 * @param {Number} orderId 订单ID
 */
export const createPrepay = (channel, orderId) => {
  return post(API_PATHS.PAYMENT.PREPAY(channel), null, {
    needAuth: true,
    showLoading: true,
    header: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: { orderId }
  })
}

/**
 * 微信支付
 * @param {Number} orderId 订单ID
 */
export const wechatPay = async (orderId) => {
  try {
    // 创建支付预订单
    const prepayRes = await createPrepay('wechat', orderId)
    
    if (prepayRes.code !== 200) {
      throw new Error(prepayRes.message || '创建支付失败')
    }
    
    const prepayData = prepayRes.data
    
    // 调起微信支付
    return new Promise((resolve, reject) => {
      uni.requestPayment({
        provider: 'wxpay',
        timeStamp: prepayData.timestamp,
        nonceStr: prepayData.nonceStr,
        package: prepayData.package,
        signType: 'MD5',
        paySign: prepayData.paySign,
        success: (res) => {
          uni.showToast({
            title: '支付成功',
            icon: 'success'
          })
          resolve(res)
        },
        fail: (err) => {
          if (err.errMsg === 'requestPayment:fail cancel') {
            uni.showToast({
              title: '已取消支付',
              icon: 'none'
            })
          } else {
            uni.showToast({
              title: '支付失败',
              icon: 'none'
            })
          }
          reject(err)
        }
      })
    })
  } catch (error) {
    console.error('微信支付失败:', error)
    throw error
  }
}

/**
 * 微信合单支付（商品+快递分账）
 * @param {Number} orderId 订单ID
 * @param {Object} paymentData 支付数据（可选）
 */
export const wechatCombinePay = async (orderId, paymentData = {}) => {
  try {
    console.log('创建合单支付订单:', orderId, paymentData)
    
    // 调用后端创建合单支付订单
    const response = await post('/api/payment/combine/create-by-order/' + orderId, paymentData, {
      needAuth: true,
      showLoading: true,
      loadingTitle: '正在创建支付订单...'
    })
    
    console.log('合单支付创建响应:', response)
    
    if (response.code !== 200) {
      throw new Error(response.message || '创建合单支付失败')
    }
    
    const combinePayData = response.data
    
    if (!combinePayData || !combinePayData.payParams) {
      throw new Error('支付参数不完整')
    }
    
    const payParams = combinePayData.payParams
    
    console.log('调起微信支付:', payParams)
    
    // 调起微信支付
    return new Promise((resolve, reject) => {
      uni.requestPayment({
        provider: 'wxpay',
        timeStamp: payParams.timeStamp,
        nonceStr: payParams.nonceStr,
        package: payParams.package,
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
            combineOutTradeNo: combinePayData.combineOutTradeNo,
            prepayId: combinePayData.prepayId,
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
    console.error('微信合单支付失败:', error)
    throw error
  }
}

/**
 * 查询合单支付订单状态
 * @param {String} combineOutTradeNo 合单商户订单号
 */
export const queryCombinePayOrder = async (combineOutTradeNo) => {
  try {
    const response = await get(`/api/payment/combine/query/${combineOutTradeNo}`, null, {
      needAuth: false
    })
    
    if (response.code !== 200) {
      throw new Error(response.message || '查询订单失败')
    }
    
    return response.data
  } catch (error) {
    console.error('查询合单支付订单失败:', error)
    throw error
  }
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