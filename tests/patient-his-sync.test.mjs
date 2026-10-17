import assert from 'node:assert/strict'
import { patientHisSyncNotice } from '../utils/patient.js'

for (const status of [undefined, null, '', 'SUCCESS', 'DISABLED']) {
  assert.equal(patientHisSyncNotice(status), '', `${status} 不应误报同步失败`)
}
for (const status of ['PENDING', 'RUNNING', 'FAILED', 'UNKNOWN', 'BLOCKED', 'NOT_REQUESTED']) {
  const notice = patientHisSyncNotice(status)
  assert.match(notice, /资料已保存/)
  assert.match(notice, /医院信息待同步/)
}

console.log('patient HIS synchronization notice tests passed')
