import { AI_DOCTOR } from './consultation-mode.js'

// 处方一键下单要求已审核；普通购物车保留自身的待审核结算政策。
export const canCreatePrescriptionOrder = prescription =>
  prescription?.status === 1 && prescription.expired === false

export const getPrescriptionStatusText = prescription => {
  if (!prescription) return '正在加载处方'
  if (prescription.status === 2) return '已作废'
  if (prescription.expired === true) return '已过期'
  return ({ 0: '待审核', 1: '已审核' })[prescription.status] || '未知状态'
}

export const resolvePrescriptionDoctorName = (prescription = {}) =>
  prescription?.doctorId ? prescription.doctorName || '医师资料暂不可用' : AI_DOCTOR.name
