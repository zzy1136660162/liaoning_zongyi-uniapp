export const ID_TYPE_OPTIONS = [
  '身份证', '护照', '港澳通行证', '台胞证', '军官证', '士兵证', '户口簿', '出生医学证明', '外国人居留证'
]

/**
 * 根据身份证号推导性别
 * @param {string} idNumber
 * @returns {'男' | '女' | '未知'}
 */
export const deriveGenderFromId = (idNumber = '') => {
  if (/^\d{17}[\dXx]$/.test(idNumber)) {
    const genderCode = parseInt(idNumber.charAt(16), 10)
    if (!isNaN(genderCode)) {
      return genderCode % 2 === 0 ? '女' : '男'
    }
  }
  return '未知'
}

/**
 * 根据身份证号推导年龄
 * @param {string} idNumber
 * @returns {number}
 */
export const deriveAgeFromId = (idNumber = '') => {
  if (/^\d{17}[\dXx]$/.test(idNumber)) {
    const year = parseInt(idNumber.substring(6, 10), 10)
    const month = parseInt(idNumber.substring(10, 12), 10) - 1
    const day = parseInt(idNumber.substring(12, 14), 10)
    const birthDate = new Date(year, month, day)
    if (!isNaN(birthDate.getTime())) {
      const now = new Date()
      let age = now.getFullYear() - birthDate.getFullYear()
      const birthdayPassed =
        now.getMonth() > birthDate.getMonth() ||
        (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate())
      if (!birthdayPassed) {
        age -= 1
      }
      return Math.max(age, 0)
    }
  }
  return 0
}

export const patientHisSyncNotice = (status) => {
  if (!status || status === 'SUCCESS' || status === 'DISABLED') return ''
  return '资料已保存，医院信息待同步，可在就诊人管理核对。'
}

