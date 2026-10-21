export const CONSULTATION_MODE_AI = 'ai'
export const CONSULTATION_MODE_MANUAL = 'manual'

export const AI_DOCTOR = {
  id: null,
  name: 'AI在线医生',
  avatar: '/profile/liaoning_zongyi/zaixian_mingyi_logo.png',
  mode: CONSULTATION_MODE_AI
}

export const MANUAL_DOCTORS = [
  {
    id: 100,
    name: '刘悦',
    avatar: '/profile/liaoning_zongyi/zaixian_mingyi_logo.png',
    mode: CONSULTATION_MODE_MANUAL
  },
  {
    id: 101,
    name: '王天娇',
    avatar: '/profile/liaoning_zongyi/zaixian_mingyi_logo.png',
    mode: CONSULTATION_MODE_MANUAL
  },
  {
    id: 102,
    name: '张兵',
    avatar: '/profile/liaoning_zongyi/zaixian_mingyi_logo.png',
    mode: CONSULTATION_MODE_MANUAL
  }
]

export const normalizeConsultationMode = (mode) => {
  return mode === CONSULTATION_MODE_MANUAL ? CONSULTATION_MODE_MANUAL : CONSULTATION_MODE_AI
}

const pickRandomManualDoctor = () => {
  const index = Math.floor(Math.random() * MANUAL_DOCTORS.length)
  return MANUAL_DOCTORS[index]
}

export const getConsultationDoctorByMode = (mode) => {
  const normalizedMode = normalizeConsultationMode(mode)
  if (normalizedMode === CONSULTATION_MODE_MANUAL) {
    return pickRandomManualDoctor()
  }
  return AI_DOCTOR
}

export const resolveConsultationDoctor = (options = {}) => {
  if (normalizeConsultationMode(options.consultationMode) === CONSULTATION_MODE_AI) return AI_DOCTOR
  const doctor = MANUAL_DOCTORS.find(item => String(item.id) === String(options.doctorId))
  if (!doctor) throw new Error('问诊未完成，请重试')
  return doctor
}

/** 从咨询记录解析展示用医师姓名（与 consultation 页一致） */
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
