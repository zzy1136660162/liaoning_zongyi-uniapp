import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

const profile = read('pages/user/profile.vue')
const patientEdit = read('pages/dispense/patient_edit.vue')
const apply = read('pages/dispense/apply.vue')
const consultation = read('pages/dispense/consultation.vue')

assert.match(profile, /url:\s*['"]\/pages\/user\/patient_list['"]/)
assert.match(patientEdit, /getPatientDetail/)
assert.match(patientEdit, /updatePatient\(patientId\.value,\s*payload\)/)

const payloadBlock = patientEdit.match(/const payload = \{[\s\S]*?\n\s*\}/)?.[0] || ''
assert.ok(payloadBlock, '未找到就诊人保存 payload')
assert.doesNotMatch(payloadBlock, /\bage\s*:/, '年龄必须由后端根据出生日期计算')

assert.doesNotMatch(apply, /STORAGE_KEY_USER_REGISTER/)
assert.match(apply, /patientId=\$\{encodeURIComponent\(selectedPatient\.value\.id\)\}/)
assert.match(consultation, /patientId:\s*patientId\.value/)

const detailPages = [
  'pages/order/consultation_detail.vue',
  'pages/order/prescription_detail.vue',
  'pages/order/order-detail.vue',
  'pages/order/prescription_list.vue',
  'pages/prescription/detail.vue'
]

for (const detailPage of detailPages) {
  const source = read(detailPage)
  assert.match(source, /patientSnapshotAvailable/, `${detailPage} 未使用就诊人快照标记`)
  assert.match(source, /历史记录未关联就诊人/, `${detailPage} 未处理无快照历史记录`)
  assert.doesNotMatch(
    source,
    /STORAGE_KEY_USER_REGISTER/,
    `${detailPage} 不得使用当前账号资料回填历史医疗记录`
  )
}

console.log('patient medical record consistency tests passed')
