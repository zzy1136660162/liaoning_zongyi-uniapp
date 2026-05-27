export const CONSULTATION_MODE_AI = 'ai'
export const CONSULTATION_MODE_MANUAL = 'manual'

export const AI_DOCTOR = {
  id: null,
  name: 'AI药师',
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

if (typeof module !== 'undefined') {
  module.exports = {
    CONSULTATION_MODE_AI,
    CONSULTATION_MODE_MANUAL,
    AI_DOCTOR,
    MANUAL_DOCTORS,
    normalizeConsultationMode,
    getConsultationDoctorByMode
  }
}
