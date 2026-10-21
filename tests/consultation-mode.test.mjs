import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CONSULTATION_MODE_AI,
  CONSULTATION_MODE_MANUAL,
  AI_DOCTOR,
  MANUAL_DOCTORS,
  normalizeConsultationMode,
  getConsultationDoctorByMode,
  resolveConsultationDoctor,
  resolveConsultationDoctorName
} from '../utils/consultation-mode.js'

test('接诊模式沿用原AI默认值，人工分配仍只随机选择一次', t => {
  assert.equal(normalizeConsultationMode(), CONSULTATION_MODE_AI)
  assert.equal(normalizeConsultationMode('manual'), CONSULTATION_MODE_MANUAL)
  assert.equal(normalizeConsultationMode('unknown'), CONSULTATION_MODE_AI)
  let randoms = 0
  t.mock.method(Math, 'random', () => { randoms++; return 0 })
  assert.equal(getConsultationDoctorByMode(CONSULTATION_MODE_MANUAL), MANUAL_DOCTORS[0])
  assert.equal(getConsultationDoctorByMode(CONSULTATION_MODE_AI), AI_DOCTOR)
  assert.equal(resolveConsultationDoctor({ consultationMode: 'manual', doctorId: '100' }), MANUAL_DOCTORS[0])
  assert.equal(randoms, 1, '接收端不能重新分配人工医生')
})

test('AI模式忽略路由中附带的人工ID及姓名头像', () => {
  for (const options of [{}, { consultationMode: 'unknown' }, {
    consultationMode: 'ai', doctorId: '100', doctorName: '%', doctorAvatar: '%E0%A4%A'
  }]) assert.equal(resolveConsultationDoctor(options), AI_DOCTOR)
  assert.equal(resolveConsultationDoctor({ consultationMode: 'ai' }).id, null)
})

test('人工模式只按现有池ID解析，同一医生的ID姓名头像不会被路由覆盖', () => {
  for (const doctor of MANUAL_DOCTORS) {
    for (const doctorId of [doctor.id, String(doctor.id)]) {
      assert.equal(resolveConsultationDoctor({ consultationMode: 'manual', doctorId,
        doctorName: '不匹配的路由姓名', doctorAvatar: '%' }), doctor)
    }
  }
  for (const doctorId of [undefined, null, '', 0, -1, 'unknown', '999', '100.0', '1e2', ' 100 ']) {
    assert.throws(() => resolveConsultationDoctor({ consultationMode: 'manual', doctorId }), /问诊未完成，请重试/)
  }
})

test('问诊医师展示保留当前camelCase和仍在使用的历史文案回退', () => {
  assert.equal(resolveConsultationDoctorName(null), '')
  assert.equal(resolveConsultationDoctorName({ doctorId: null, doctorName: '不应作为人工医师' }), AI_DOCTOR.name)
  assert.equal(resolveConsultationDoctorName({ doctorId: 100, doctorName: '真实医师' }), '真实医师')
  assert.equal(resolveConsultationDoctorName({ doctorId: 100, historyDesc: '人工接诊医生：历史医师' }), '历史医师')
  assert.equal(resolveConsultationDoctorName({ doctorId: 100, historyDesc: 'AI药师接诊' }), AI_DOCTOR.name)
  assert.equal(resolveConsultationDoctorName({ doctorId: 100, historyDesc: '实时医生接诊' }), '')
})
