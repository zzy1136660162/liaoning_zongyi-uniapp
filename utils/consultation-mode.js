export const CONSULTATION_MODE_AI = 'ai'
export const CONSULTATION_MODE_MANUAL = 'manual'

export const AI_DOCTOR = {
  id: null,
  name: '在线医生',
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

/** 从咨询记录解析展示用医师姓名（与 consultation 页一致） */
export const resolveConsultationDoctorName = (consultation) => {
  if (!consultation) {
    return ''
  }
  if (consultation.doctorName) {
    return consultation.doctorName
  }
  const history = consultation.historyDesc || ''
  if (history.includes('AI') || history.includes('AI药师')) {
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

if (typeof module !== 'undefined') {
  module.exports = {
    CONSULTATION_MODE_AI,
    CONSULTATION_MODE_MANUAL,
    AI_DOCTOR,
    MANUAL_DOCTORS,
    normalizeConsultationMode,
    getConsultationDoctorByMode,
    resolveConsultationDoctorName
  }
}
