import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as patientUtils from '../utils/patient.js'
import { loadSetup } from './sfc-harness.mjs'

const createEditPage = (detail) => {
  const writes = []
  const toasts = []
  const page = loadSetup('pages/dispense/patient_edit.vue', {
    ...patientUtils,
    ref: value => ({ value }),
    reactive: value => value,
    computed: get => ({ get value() { return get() } }),
    watch() {},
    onLoad() {},
    onShow() {},
    getSessionGeneration: () => 1,
    isCurrentSession: () => true,
    getPatientDetail: async () => detail,
    updatePatient: async (id, payload) => {
      writes.push({ id, ...payload })
      return { id, profileComplete: true, hisBindingStatus: 'DISABLED' }
    },
    setTimeout() {},
    uni: {
      showToast: toast => toasts.push(toast),
      showLoading() {},
      hideLoading() {},
      $emit() {}
    }
  }, ['formData', 'patientId', 'profileNotice', 'loadPatient', 'handleSubmit'])
  page.patientId.value = 7
  return { page, writes, toasts }
}

test('完整性提示以服务端标记为准，旧版响应保留兼容', () => {
  for (const patient of [null, {}, { profileComplete: true }, { profileIncompleteReason: '旧数据提示' }]) {
    assert.equal(patientUtils.getPatientProfileNotice(patient), '')
  }
  assert.equal(patientUtils.getPatientProfileNotice({
    profileComplete: false,
    profileIncompleteReason: ' 请补充出生日期 '
  }), '请补充出生日期')
  assert.equal(patientUtils.getPatientProfileNotice({ profileComplete: false }), '请完善就诊人资料后再下单')
})

test('身份证按注册格式提取生日和性别，不校验末位校验码，也不把非法日期滚动成下一月', () => {
  assert.equal(patientUtils.deriveBirthDateFromId(' 11010519491231002x '), '1949-12-31')
  assert.equal(patientUtils.deriveBirthDateFromId('110105194912310020'), '1949-12-31')
  assert.equal(patientUtils.deriveGenderFromId('110105194912310020'), '女')
  assert.equal(patientUtils.deriveBirthDateFromId('110105200002290019'), '2000-02-29')
  for (const number of ['', 'P12345678', '110105199002310019', '110105209901010019']) {
    assert.equal(patientUtils.deriveBirthDateFromId(number), '')
    assert.equal(patientUtils.deriveAgeFromId(number), 0)
  }
})

test('待完善的非身份证详情不伪填生日或性别，补齐后编辑原记录即可保存', async () => {
  const env = createEditPage({
    name: '待完善就诊人',
    idType: '护照',
    idNumber: 'P12345678',
    gender: null,
    birthDate: null,
    age: 0,
    phone: '13800138000',
    patientType: 'adult',
    profileComplete: false,
    profileIncompleteReason: '请补充出生日期和性别'
  })
  await env.page.loadPatient(7)
  assert.equal(env.page.formData.gender, '')
  assert.equal(env.page.formData.birthDate, '')
  assert.equal(env.page.profileNotice.value, '请补充出生日期和性别')
  await env.page.handleSubmit()
  assert.equal(env.toasts.at(-1).title, '请选择出生日期')
  assert.equal(env.writes.length, 0)

  env.page.formData.birthDate = '1990-01-01'
  await env.page.handleSubmit()
  assert.equal(env.toasts.at(-1).title, '请选择性别')
  env.page.formData.gender = '女'
  await env.page.handleSubmit()
  assert.equal(env.writes.length, 1)
  assert.equal(env.writes[0].id, 7)
  assert.equal(env.writes[0].birthDate, '1990-01-01')
  assert.equal(env.writes[0].gender, '女')
})

test('已有身份证详情缺少派生字段时自动补齐生日和性别', async () => {
  const env = createEditPage({
    name: '本人就诊人',
    idType: '身份证',
    idNumber: '110105194912310020',
    gender: null,
    birthDate: null,
    phone: '13800138000',
    patientType: 'adult'
  })
  await env.page.loadPatient(7)
  assert.equal(env.page.formData.birthDate, '1949-12-31')
  assert.equal(env.page.formData.gender, '女')
  await env.page.handleSubmit()
  assert.equal(env.writes[0].birthDate, '1949-12-31')
  assert.equal(env.writes[0].gender, '女')
})

test('身份证日期无法提取时可手动完善，未来或非法的人工日期不能保存', async () => {
  const env = createEditPage({
    name: '需手动完善',
    idType: '身份证',
    idNumber: '110105199002310019',
    gender: null,
    birthDate: null,
    phone: '13800138000',
    patientType: 'adult'
  })
  await env.page.loadPatient(7)
  assert.equal(env.page.formData.birthDate, '')
  for (const birthDate of ['1990-02-31', '2099-01-01']) {
    env.page.formData.birthDate = birthDate
    await env.page.handleSubmit()
    assert.equal(env.toasts.at(-1).title, '请选择有效的出生日期')
    assert.equal(env.writes.length, 0)
  }
  env.page.formData.birthDate = '1990-02-28'
  await env.page.handleSubmit()
  assert.equal(env.writes[0].birthDate, '1990-02-28')
})

test('管理列表展示待完善状态和完善入口，不把未知生日显示为真实零岁', () => {
  const source = readFileSync(new URL('../pages/user/patient_list.vue', import.meta.url), 'utf8')
  assert.match(source, /待完善/)
  assert.match(source, /完善信息/)
  assert.match(source, /出生日期待完善/)
  assert.match(source, /getPatientProfileNotice\(patient\)/)
})
