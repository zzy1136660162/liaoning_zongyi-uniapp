/**
 * 复诊咨询与处方模块API
 */

import { get, post } from '@/utils/request.js'
import { API_PATHS } from '@/utils/config.js'

/**
 * 发起复诊咨询
 * @param {Object} data 咨询信息
 * @param {Number} data.doctorId 医生ID
 * @param {Number} data.consultType 咨询类型
 * @param {String} data.symptomDesc 症状描述
 * @param {String} data.historyDesc 既往病史
 */
export const createConsultation = (data) => {
  return post(API_PATHS.CONSULTATION.CREATE, data, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 获取我的复诊咨询列表
 * @param {Number} status 状态筛选（可选）
 */
export const getConsultationList = (status = null) => {
  const params = status !== null ? { status } : {}
  return get(API_PATHS.CONSULTATION.LIST, params, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 获取复诊咨询详情
 * @param {Number} id 咨询ID
 */
export const getConsultationDetail = (id) => {
  return get(API_PATHS.CONSULTATION.DETAIL(id), {}, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 获取咨询对应处方
 * @param {Number} consultationId 咨询ID
 */
export const getPrescriptionByConsultation = (consultationId) => {
  return get(API_PATHS.CONSULTATION.PRESCRIPTION(consultationId), {}, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 获取处方详情
 * @param {Number} id 处方ID
 */
export const getPrescriptionDetail = (id) => {
  return get(API_PATHS.PRESCRIPTION.DETAIL(id), {}, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 获取处方药品列表
 * @param {Number} id 处方ID
 */
export const getPrescriptionItems = (id) => {
  return get(API_PATHS.PRESCRIPTION.ITEMS(id), {}, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 获取我的复诊咨询列表（别名）
 * @param {Number} status 状态筛选（可选）
 */
export const getMyConsultations = getConsultationList
