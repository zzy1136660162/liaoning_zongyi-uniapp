import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AI_DOCTOR, resolveConsultationDoctorName } from '../utils/consultation-mode.js'

test('问诊医师展示保留当前camelCase和仍在使用的历史文案回退', () => {
  assert.equal(resolveConsultationDoctorName(null), '')
  assert.equal(resolveConsultationDoctorName({ doctorId: null, doctorName: '不应作为人工医师' }), AI_DOCTOR.name)
  assert.equal(resolveConsultationDoctorName({ doctorId: 100, doctorName: '真实医师' }), '真实医师')
  assert.equal(resolveConsultationDoctorName({ doctorId: 100, historyDesc: '人工接诊医生：历史医师' }), '历史医师')
  assert.equal(resolveConsultationDoctorName({ doctorId: 100, historyDesc: 'AI药师接诊' }), AI_DOCTOR.name)
  assert.equal(resolveConsultationDoctorName({ doctorId: 100, historyDesc: '实时医生接诊' }), '')
})
