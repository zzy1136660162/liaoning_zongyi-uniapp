/**
 * 快递模块API
 */

import { post } from '@/utils/request.js'

/**
 * 查询运费
 * @param {Object} params 查询参数
 * @param {String} params.expressType 快递类型（1-顺丰特快，2-顺丰标快）
 * @param {String} params.parcelWeight 包裹重量（kg）
 * @param {String} params.destProvince 收件人省份
 * @param {String} params.destCity 收件人城市
 * @param {String} params.destDistrict 收件人区县
 * @param {String} params.destAddress 收件人详细地址
 */
export const queryFreight = async (params) => {
  try {
    console.log('查询运费:', params)
    
    const response = await post('/api/express/query-freight', params, {
      needAuth: true,
      showLoading: false
    })
    
    console.log('运费查询结果:', response)
    return response
  } catch (error) {
    console.error('查询运费失败:', error)
    throw error
  }
}

/**
 * 创建快递订单
 * @param {Object} params 订单参数
 * @param {Number} params.orderId 业务订单ID
 * @param {String} params.merchantOrderNo 商户订单号
 * @param {String} params.expressType 快递类型
 * @param {String} params.parcelWeight 包裹重量
 * @param {String} params.receiverName 收件人姓名
 * @param {String} params.receiverPhone 收件人电话
 * @param {String} params.destProvince 收件人省份
 * @param {String} params.destCity 收件人城市
 * @param {String} params.destDistrict 收件人区县
 * @param {String} params.destAddress 收件人详细地址
 */
export const createExpressOrder = async (params) => {
  try {
    console.log('创建快递订单:', params)
    
    const response = await post('/api/express/create-order', params, {
      needAuth: true,
      showLoading: true,
      loadingTitle: '正在创建快递订单...'
    })
    
    console.log('快递订单创建结果:', response)
    return response
  } catch (error) {
    console.error('创建快递订单失败:', error)
    throw error
  }
}

