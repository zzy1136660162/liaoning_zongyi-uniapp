/**
 * 收货地址模块API
 */

import { get, post, put, del } from '@/utils/request.js'
import { API_PATHS } from '@/utils/config.js'

/**
 * 获取收货地址列表
 */
export const getAddressList = () => {
  return get(API_PATHS.ADDRESS.LIST, {}, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 获取单个收货地址详情
 * @param {Number|String} id 地址ID
 */
export const getAddressDetail = (id) => {
  return get(API_PATHS.ADDRESS.DETAIL(id), {}, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 新增收货地址
 * @param {Object} data 地址信息
 * @param {String} data.receiverName 收货人姓名
 * @param {String} data.receiverPhone 收货人电话
 * @param {String} data.province 省份
 * @param {String} data.city 城市
 * @param {String} data.district 区县
 * @param {String} data.addressDetail 详细地址
 * @param {Number} data.isDefault 是否默认 1是 0否
 */
export const addAddress = (data) => {
  return post(API_PATHS.ADDRESS.ADD, data, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 编辑收货地址
 * @param {Number} id 地址ID
 * @param {Object} data 地址信息
 */
export const updateAddress = (id, data) => {
  return put(API_PATHS.ADDRESS.UPDATE(id), data, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 删除收货地址（逻辑删除）
 * @param {Number} id 地址ID
 */
export const deleteAddress = (id) => {
  return del(API_PATHS.ADDRESS.DELETE(id), {}, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 设置默认收货地址
 * @param {Number} id 地址ID
 */
export const setDefaultAddress = (id) => {
  return post(API_PATHS.ADDRESS.SET_DEFAULT(id), {}, {
    needAuth: true,
    showLoading: true
  })
}
