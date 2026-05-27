const assert = require('assert')

const {
  CONSULTATION_MODE_AI,
  CONSULTATION_MODE_MANUAL,
  MANUAL_DOCTORS,
  normalizeConsultationMode,
  getConsultationDoctorByMode
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
  assert.strictEqual(aiDoctor.name, 'AI药师')
  assert.strictEqual(aiDoctor.mode, CONSULTATION_MODE_AI)

  console.log('consultation-mode test passed')
} finally {
  Math.random = originalRandom
}
