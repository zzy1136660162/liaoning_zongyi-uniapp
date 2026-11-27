export const CONSULTATION_MODE_AI = 'ai'
export const CONSULTATION_MODE_MANUAL = 'manual'

export const AI_DOCTOR = {
  id: null,
  name: 'AI在线医生',
  avatar: '/profile/liaoning_zongyi/zaixian_mingyi_logo.png'
}

/** 从咨询记录读取展示用医师姓名，保留历史人工接诊记录的姓名回退。 */
export const resolveConsultationDoctorName = (consultation) => {
  if (!consultation) {
    return ''
  }

  const doctorId = consultation.doctorId
  if (doctorId === null || doctorId === undefined || String(doctorId).trim() === '') {
    return AI_DOCTOR.name
  }

  const doctorName = consultation.doctorName
  if (doctorName) {
    return doctorName
  }
  const history = consultation.historyDesc || ''
  if (history.includes('AI')) {
    return AI_DOCTOR.name
  }
  if (history.includes('人工接诊医生：')) {
    const match = history.match(/人工接诊医生：(.+)/)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  return ''
}
