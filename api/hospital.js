/**
 * 医院医生模块API
 */

import { get } from '@/utils/request.js'
import { API_PATHS } from '@/utils/config.js'

/**
 * 获取医院列表
 */
export const getHospitalList = () => {
  return get(API_PATHS.HOSPITAL.LIST, {}, {
    needAuth: false,
    showLoading: true
  })
}

/**
 * 获取医院下医生列表
 * @param {String} hospitalName 医院名称
 */
export const getDoctorsByHospital = (hospitalName) => {
  return get(API_PATHS.HOSPITAL.DOCTORS(hospitalName), {}, {
    needAuth: false,
    showLoading: true
  })
}

/**
 * 获取医生详情
 * @param {Number} id 医生ID
 */
export const getDoctorDetail = (id) => {
  return get(API_PATHS.DOCTOR.DETAIL(id), {}, {
    needAuth: false,
    showLoading: true
  })
}

/**
 * 通过医生门诊号获取医生详情（后端需提供该接口）
 * @param {String|Number} outpatientNo 医生门诊号
 */
export const getDoctorByOutpatientNo = (outpatientNo) => {
  return get(API_PATHS.DOCTOR.BY_OUTPATIENT(outpatientNo), {}, {
    needAuth: false,
    showLoading: true
  })
}