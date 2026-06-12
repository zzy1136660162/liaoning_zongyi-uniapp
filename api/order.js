/**
 * 订单模块API
 */

import { get, post } from '@/utils/request.js'
import { API_PATHS } from '@/utils/config.js'

/**
 * 处方一键下单
 * @param {Object} data 订单信息
 * @param {Number} data.prescriptionId 处方ID
 * @param {Number} data.addressId 收货地址ID
 * @param {String} data.remark 订单备注
 */
export const createOrderFromPrescription = (data) => {
  return post(API_PATHS.ORDER.FROM_PRESCRIPTION, data, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 创建普通订单
 * @param {Object} data 订单信息
 * @param {Number} data.addressId 收货地址ID
 * @param {String} data.remark 订单备注
 * @param {Number} data.shippingFee 快递费（元）
 * @param {Array} data.items 商品列表
 * @param {Number} data.items[].productId 商品ID
 * @param {Number} data.items[].quantity 数量
 */
export const createOrder = (data) => {
  return post(API_PATHS.ORDER.CREATE, data, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 获取订单列表
 * @param {Number} orderStatus 订单状态筛选（可选）
 */
export const getOrderList = (orderStatus = null) => {
  const params = orderStatus !== null ? { orderStatus } : {}
  return get(API_PATHS.ORDER.LIST, params, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 获取订单详情
 * @param {Number} id 订单ID
 */
export const getOrderDetail = (id, options = {}) => {
  return get(API_PATHS.ORDER.DETAIL(id), {}, {
    needAuth: true,
    showLoading: true,
    ...options
  })
}

/**
 * 取消订单
 * @param {Number} id 订单ID
 * @param {String} reason 取消原因
 */
export const cancelOrder = (id, reason = '') => {
  return post(API_PATHS.ORDER.CANCEL(id), { reason }, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 获取我的订单列表
 * @param {Number} orderStatus 订单状态筛选（可选）
 */
export const getMyOrders = (orderStatus = null) => {
  return getOrderList(orderStatus)
}

/**
 * 确认收货
 * @param {Number} id 订单ID
 */
export const confirmReceipt = (id) => {
  return post(API_PATHS.ORDER.CONFIRM_RECEIPT(id), {}, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 通过处方ID查询订单信息
 * @param {Number|String} prescriptionId 处方ID
 */
export const getOrderByPrescriptionId = (prescriptionId) => {
  return get(API_PATHS.ORDER.BY_PRESCRIPTION(prescriptionId), {}, {
    needAuth: true,
    showLoading: false // 查询订单状态不需要显示loading
  })
}

/**
 * 传统疗法订单扫码核销
 * @param {Object} data
 * @param {String} data.verifyToken 加密核销令牌
 * @param {String} [data.redeemedBy] 核销操作员
 */
export const redeemOrder = (data) => {
  return post(API_PATHS.ORDER.REDEEM, data, {
    needAuth: false,
    showLoading: true
  })
}