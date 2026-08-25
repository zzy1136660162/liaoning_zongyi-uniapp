const assert = require('assert')

const {
  CONSULTATION_MODE_AI,
  CONSULTATION_MODE_MANUAL,
  AI_DOCTOR,
  MANUAL_DOCTORS,
  normalizeConsultationMode,
  getConsultationDoctorByMode,
  resolveConsultationDoctorName
} = require('../utils/consultation-mode.js')

const originalRandom = Math.random

try {
  assert.strictEqual(normalizeConsultationMode(), CONSULTATION_MODE_AI)
  assert.strictEqual(normalizeConsultationMode('manual'), CONSULTATION_MODE_MANUAL)
  assert.strictEqual(normalizeConsultationMode('unknown'), CONSULTATION_MODE_AI)

  Math.random = () => 0
  const manualDoctor = getConsultationDoctorByMode(CONSULTATION_MODE_MANUAL)
  assert.deepStrictEqual(manualDoctor, MANUAL_DOCTORS[0])

  const aiDoctor = getConsultationDoctorByMode(CONSULTATION_MODE_AI)
  assert.strictEqual(aiDoctor, AI_DOCTOR)
  assert.strictEqual(aiDoctor.id, null)
  assert.strictEqual(aiDoctor.name, 'AI在线医生')
  assert.strictEqual(aiDoctor.mode, CONSULTATION_MODE_AI)

  assert.strictEqual(
    resolveConsultationDoctorName({
      doctorId: null,
      doctorName: '张三',
      historyDesc: '实时医生接诊'
    }),
    'AI在线医生'
  )
  assert.strictEqual(
    resolveConsultationDoctorName({
      doctorId: 100,
      doctorName: '刘悦'
    }),
    '刘悦'
  )
  assert.strictEqual(
    resolveConsultationDoctorName({
      doctor_id: null,
      doctor_name: '张三'
    }),
    'AI在线医生'
  )

  console.log('consultation-mode test passed')
} finally {
  Math.random = originalRandom
}
