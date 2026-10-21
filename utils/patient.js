export const ID_TYPE_OPTIONS = [
  '身份证', '护照', '港澳通行证', '台胞证', '军官证', '士兵证', '户口簿', '出生医学证明', '外国人居留证'
]

const CHINESE_ID_PATTERN = /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dX]$/

export const deriveBirthDateFromId = (idNumber = '') => {
  const number = String(idNumber || '').trim().toUpperCase()
  if (!CHINESE_ID_PATTERN.test(number)) return ''

  const year = Number(number.slice(6, 10))
  const month = Number(number.slice(10, 12))
  const day = Number(number.slice(12, 14))
  const birthDate = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1
      || birthDate.getDate() !== day || birthDate > today) return ''

  return `${number.slice(6, 10)}-${number.slice(10, 12)}-${number.slice(12, 14)}`
}

/**
 * 根据身份证号推导性别
 * @param {string} idNumber
 * @returns {'男' | '女' | '未知'}
 */
export const deriveGenderFromId = (idNumber = '') => {
  const number = String(idNumber || '').trim().toUpperCase()
  if (!CHINESE_ID_PATTERN.test(number)) return '未知'
  return Number(number.charAt(16)) % 2 === 0 ? '女' : '男'
}

/**
 * 根据身份证号推导年龄
 * @param {string} idNumber
 * @returns {number}
 */
export const deriveAgeFromId = (idNumber = '') => {
  const birthDateText = deriveBirthDateFromId(idNumber)
  if (!birthDateText) return 0

  const birthDate = new Date(`${birthDateText}T00:00:00`)
  const now = new Date()
  let age = now.getFullYear() - birthDate.getFullYear()
  const birthdayPassed = now.getMonth() > birthDate.getMonth()
    || (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate())
  if (!birthdayPassed) age -= 1
  return age
}

export const getPatientProfileNotice = (patient) => {
  if (patient?.profileComplete !== false) return ''
  return patient.profileIncompleteReason?.trim() || '请完善就诊人资料后再下单'
}

export const patientHisSyncNotice = (status) => {
  if (status === 'INCOMPLETE') return '就诊人资料待完善，请前往就诊人管理补全后下单。'
  if (!status || status === 'SUCCESS' || status === 'DISABLED' || status === 'NOT_REQUESTED') return ''
  return '资料已保存，医院信息待同步，可在就诊人管理核对。'
}

