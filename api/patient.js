/**
 * 就诊人模块API
 */

import { get, post, put, del } from '@/utils/request.js'
import { API_PATHS } from '@/utils/config.js'

/**
 * 获取就诊人列表
 */
export const getPatientList = () => {
  return get(API_PATHS.PATIENT.LIST, {}, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 新增就诊人
 * @param {Object} data 就诊人信息
 * @param {String} data.name 姓名
 * @param {String} data.gender 性别
 * @param {Number} data.age 年龄
 * @param {String} data.idType 证件类型
 * @param {String} data.idNumber 证件号码
 */
export const addPatient = (data) => {
  return post(API_PATHS.PATIENT.ADD, data, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 编辑就诊人
 * @param {Number} id 就诊人ID
 * @param {Object} data 就诊人信息
 */
export const updatePatient = (id, data) => {
  return put(API_PATHS.PATIENT.UPDATE(id), data, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 删除就诊人（逻辑删除）
 * @param {Number} id 就诊人ID
 */
export const deletePatient = (id) => {
  return del(API_PATHS.PATIENT.DELETE(id), {}, {
    needAuth: true,
    showLoading: true
  })
}
