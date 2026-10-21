import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { ID_TYPE_OPTIONS, deriveAgeFromId, deriveGenderFromId, deriveBirthDateFromId, getPatientProfileNotice, patientHisSyncNotice } from '../utils/patient.js'
import { loadOptions, loadSetup } from './sfc-harness.mjs'

const fixture = () => {
  const values = new Map(), writes = [], toasts = [], events = []
  let generation = 1
  let accountProfile = { id: 7, userName: '测试陪诊人', idType: '护照', idCardNo: 'P87654321', phone: '13900139000' }
  const mocks = {
    ID_TYPE_OPTIONS, deriveAgeFromId, deriveGenderFromId, deriveBirthDateFromId, getPatientProfileNotice, patientHisSyncNotice,
    ref: value => ({ value }), reactive: value => value,
    computed: get => ({ get value() { return get() } }), watch() {}, onLoad() {}, onMounted() {},
    getSessionGeneration: () => generation, isCurrentSession: value => value === generation,
    assertCurrentSession: value => { if (value !== generation) throw new Error('stale session') },
    STORAGE_KEY_USER_REGISTER: 'register', STORAGE_KEY_USER_INFO: 'user', STORAGE_KEY_USER_LOGIN_STATUS: 'logged-in',
    STORAGE_KEY_AGREEMENT_ACCEPTED: 'agreed', getToken: () => 'fixture-token', isExplicitlyLoggedOut: () => false,
    getImageUrl: value => value, logButtonClick() {}, setTimeout() {},
    getPatientDetail: async () => ({}),
    fetchAccountProfile: async () => accountProfile,
    establishAccountSession: () => ++generation,
    addPatient: async payload => { writes.push(payload); return { id: 7 } },
    updatePatient: async (id, payload) => { writes.push({ id, ...payload }); return { id } },
    uni: {
      getStorageSync: key => values.get(key), setStorageSync: (key, value) => values.set(key, value),
      showLoading() {}, hideLoading() {}, showToast: value => toasts.push(value),
      $emit: (...args) => events.push(args)
    }
  }
  return { mocks, values, writes, toasts, events, changeSession: () => { generation++ }, setAccountProfile: profile => { accountProfile = profile } }
}
const editPage = env => loadSetup('pages/dispense/patient_edit.vue', env.mocks, [
  'formData', 'patientId', 'idTypeOptions', 'guardianIdTypeOptions', 'idTypeIndex', 'guardianIdTypeIndex',
  'initGuardianInfo', 'onIdTypeChange', 'onGuardianIdTypeChange', 'loadPatient', 'switchPatientType', 'handleSubmit'
])
const fillPatient = (page, patientType = 'adult') => Object.assign(page.formData, {
  name: '测试就诊人', idType: '护照', idNumber: 'P12345678', gender: '女',
  birthDate: patientType === 'child' ? '2020-01-01' : '1990-01-01', phone: '13800138000', patientType,
  guardianName: '测试陪诊人', guardianIdType: '护照', guardianIdNumber: 'P87654321', guardianPhone: '13900139000'
})

test('个人页和首页只使用接口资料且不写个人缓存，缺失类型不复用旧值，保留就诊卡号显示', async () => {
  for (const idType of [...ID_TYPE_OPTIONS, undefined]) {
    const env = fixture()
    const profile = { id: 7, userName: '测试用户', idType, idCardNo: 'P12345678', phone: '13800138000' }
    env.setAccountProfile(profile)
    const oldCache = { idType: '身份证', idNumber: 'old-number' }
    env.values.set('register', oldCache)
    const page = loadSetup('pages/user/profile.vue', env.mocks, ['loadUserProfile', 'userInfo'])
    await page.loadUserProfile()
    const expected = { realName: profile.userName, idType: idType || '', idNumber: profile.idCardNo, phone: profile.phone }
    assert.deepEqual(page.userInfo.value, expected)
    assert.equal(page.userInfo.value.idNumber, profile.idCardNo)
    const home = loadOptions('pages/index/index.vue', env.mocks)
    await home.methods.loadCurrentUser.call({})
    assert.deepEqual(env.values.get('register'), oldCache)
    assert.equal(env.values.has('user'), false)
    assert.equal(env.values.has('logged-in'), false)
  }
  const source = readFileSync(new URL('../pages/user/profile.vue', import.meta.url), 'utf8')
  const templateText = source.split('<script')[0].replace(/<[^>]*>/g, '')
  assert.match(templateText, /就诊卡号[:：]?\s*\{\{ userInfo.idNumber/)
})

test('注册保留原九类选项，患者本人及陪诊人都能选择并按原类型保存', async () => {
  assert.deepEqual(ID_TYPE_OPTIONS, ['身份证', '护照', '港澳通行证', '台胞证', '军官证', '士兵证', '户口簿', '出生医学证明', '外国人居留证'])
  const register = loadOptions('pages/register/register.vue', fixture().mocks).data()
  assert.deepEqual(register.idTypeList, ID_TYPE_OPTIONS)
  assert.equal(register.formData.idType, '身份证')
  for (const idType of ID_TYPE_OPTIONS) {
    const env = fixture(), page = editPage(env)
    fillPatient(page, 'child')
    page.onIdTypeChange({ detail: { value: page.idTypeOptions.value.findIndex(item => item.value === idType) } })
    page.formData.idNumber = idType === '身份证' ? '110105202001010019' : 'P12345678'
    page.onGuardianIdTypeChange({ detail: { value: String(page.guardianIdTypeOptions.value.findIndex(item => item.value === idType)) } })
    await page.handleSubmit()
    assert.equal(env.writes.length, 1)
    assert.equal(env.writes[0].idType, idType)
    assert.equal(env.writes[0].guardianIdType, idType)
  }
})

test('九类接口证件正确预填陪诊人，缺失或未知类型保留号码并要求明确选择', async () => {
  for (const idType of [...ID_TYPE_OPTIONS, undefined, '历史证件']) {
    const env = fixture()
    env.setAccountProfile({ id: 7, userName: '测试陪诊人', idType, idCardNo: 'P87654321', phone: '13900139000' })
    env.values.set('register', { realName: '旧缓存姓名', idType: '身份证', idNumber: 'old-number' })
    const page = editPage(env)
    page.formData.patientType = 'child'
    await page.initGuardianInfo()
    assert.equal(page.formData.guardianIdNumber, 'P87654321')
    assert.equal(page.formData.guardianIdType, ID_TYPE_OPTIONS.includes(idType) ? idType : '')
    if (!ID_TYPE_OPTIONS.includes(idType)) {
      fillPatient(page, 'child')
      page.formData.guardianIdType = ''
      await page.handleSubmit()
      assert.equal(env.writes.length, 0)
      assert.equal(env.toasts.at(-1).title, '请选择陪诊人证件类型')
      assert.equal(page.guardianIdTypeIndex.value, 0)
    }
  }
  const env = fixture(), page = editPage(env)
  env.setAccountProfile({ id: 7, name: '旧姓名', idCardType: '军官证', idCard: 'legacy-number', mobile: '13900139000' })
  page.formData.patientType = 'child'
  await page.initGuardianInfo()
  assert.equal(page.formData.guardianName, '')
  assert.equal(page.formData.guardianIdType, '')
  assert.equal(page.formData.guardianIdNumber, '')
  assert.equal(page.formData.guardianPhone, '')
})

test('注册忽略全部旧草稿，仅恢复协议偏好，既有证件选项、校验和登录载荷保留', async () => {
  for (const cached of [undefined, null, {}, '', 'invalid', [], { realName: '旧草稿', idType: '历史证件', idNumber: 'old-number', phone: '13800138000' }]) {
    const env = fixture(), requests = []
    Object.assign(env.mocks, {
      getWeChatLoginCode: async () => 'fixture-code',
      getWeChatUserProfile: async () => ({ avatarUrl: '/fixture-avatar.jpg', gender: 2 }),
      login: async payload => { requests.push(payload); return { token: 'fixture-token', userId: 7 } },
      establishAccountSession: () => { env.changeSession(); return 2 }
    })
    env.values.set('register', cached)
    env.values.set('agreed', true)
    const options = loadOptions('pages/register/register.vue', env.mocks)
    const page = { ...options.data(), ...options.methods }
    Object.defineProperty(page, 'canSubmit', { get: () => options.computed.canSubmit.call(page) })
    page.loadAgreementPreference()
    assert.deepEqual(page.formData, { realName: '', idType: '身份证', idNumber: '', phone: '', verifyCode: '' })
    assert.deepEqual(page.idTypeList, ID_TYPE_OPTIONS)
    assert.equal(page.isAgreed, true)
    assert.equal(Boolean(page.canSubmit), false)
    await page.handleLogin()
    assert.equal(requests.length, 0)
    Object.assign(page.formData, { realName: '注册用户', idType: '', idNumber: 'P12345678', phone: '13800138000', verifyCode: 'fixture-sms-code' })
    assert.equal(Boolean(page.canSubmit), false)
    page.onIdTypeChange({ detail: { value: page.idTypeList.indexOf('护照') } })
    assert.equal(page.canSubmit, true)
    await page.handleLogin()
    assert.deepEqual(requests, [{ wechatCode: 'fixture-code', phone: '13800138000', code: 'fixture-sms-code',
      userName: '注册用户', idType: '护照', idCardNo: 'P12345678', avatarUrl: '/fixture-avatar.jpg', gender: 2 }])
    assert.equal(env.values.get('register'), cached)
    assert.equal(env.values.has('user'), false)
    assert.equal(env.values.has('logged-in'), false)
    assert.equal(options.watch, undefined)
    assert.equal(page.saveFormData, undefined)
    page.toggleAgreement()
    assert.equal(env.values.get('agreed'), false)
    assert.equal(env.values.get('register'), cached)
  }
})

test('接口失败和重复预填不回退旧缓存，也不清空或覆盖已填写的陪诊人', async () => {
  for (const cached of [null, '', 'invalid', 1, true, [], { realName: '旧账号姓名', idType: '身份证', idNumber: 'old-number' }]) {
    const env = fixture()
    env.values.set('register', cached)
    env.mocks.fetchAccountProfile = async () => { throw new Error('profile unavailable') }
    const empty = editPage(env)
    empty.formData.patientType = 'child'
    await empty.initGuardianInfo()
    assert.equal(empty.formData.guardianIdType, '')
    assert.equal(empty.formData.guardianIdNumber, '')
  }
  const env = fixture(), page = editPage(env)
  page.formData.guardianName = '手工填写'
  page.formData.patientType = 'child'
  env.values.set('register', { realName: '缓存姓名', idType: '护照' })
  await page.initGuardianInfo()
  assert.equal(page.formData.guardianName, '手工填写')
  const empty = editPage(env)
  empty.formData.patientType = 'child'
  env.mocks.uni.getStorageSync = () => { throw new Error('storage unavailable') }
  await assert.doesNotReject(() => empty.initGuardianInfo())
})

test('已有详情保留未知证件并优先于缓存，切换患者类型和只改电话不会篡改证件', async () => {
  const env = fixture(), page = editPage(env)
  const detail = { name: '已有患者', idType: '历史本人类型', idNumber: 'old-patient', gender: '男', birthDate: '2020-01-01', patientType: 'child',
    guardianName: '已有陪诊人', guardianIdType: '历史陪诊类型', guardianIdNumber: 'old-guardian', guardianPhone: '13900139000' }
  env.mocks.getPatientDetail = async () => detail
  const loaded = editPage(env)
  loaded.patientId.value = 8
  env.values.set('register', { realName: '缓存姓名', idType: '身份证', idNumber: 'cached-number' })
  await loaded.loadPatient(8)
  assert.match(loaded.idTypeOptions.value[loaded.idTypeIndex.value].label, /历史本人类型.*已有类型/)
  assert.match(loaded.guardianIdTypeOptions.value[loaded.guardianIdTypeIndex.value].label, /历史陪诊类型.*已有类型/)
  loaded.switchPatientType('adult'); loaded.switchPatientType('child')
  loaded.formData.guardianPhone = '13800138000'
  await loaded.handleSubmit()
  assert.equal(env.writes[0].idType, detail.idType)
  assert.equal(env.writes[0].idNumber, detail.idNumber)
  assert.equal(env.writes[0].guardianIdType, detail.guardianIdType)
  assert.equal(env.writes[0].guardianIdNumber, detail.guardianIdNumber)
  assert.equal(env.writes[0].guardianPhone, '13800138000')
  fillPatient(page)
  page.onIdTypeChange({ detail: { value: 0 } })
  await page.handleSubmit()
  assert.equal(env.toasts.at(-1).title, '请选择证件类型')
})

test('缺失详情类型明确为空，不回填为身份证或使用注册缓存', async () => {
  const env = fixture()
  env.mocks.getPatientDetail = async () => ({ name: '旧患者', idNumber: 'old-patient', guardianIdNumber: 'old-guardian' })
  env.values.set('register', { realName: '缓存姓名', idType: '护照', idNumber: 'cached-number' })
  const page = editPage(env)
  page.patientId.value = 9
  await page.loadPatient(9)
  await page.initGuardianInfo()
  assert.equal(page.formData.idType, '')
  assert.equal(page.formData.guardianIdType, '')
  assert.equal(page.formData.guardianIdNumber, 'old-guardian')
  assert.equal(page.idTypeIndex.value, 0)
})

test('账号变化后旧详情和旧保存响应不能回填、发事件或提示成功', async () => {
  const env = fixture()
  let finish
  env.mocks.getPatientDetail = () => new Promise(resolve => { finish = resolve })
  const page = editPage(env)
  const loading = page.loadPatient(8)
  env.changeSession()
  finish({ name: '旧账号患者', idType: '护照' })
  await loading
  assert.equal(page.formData.name, '')
  env.values.set('register', { realName: '新账号', idType: '护照' })
  await page.initGuardianInfo()
  assert.equal(page.formData.guardianName, '')
  fillPatient(page)
  await page.handleSubmit()
  assert.equal(env.writes.length, 0)

  const savingEnv = fixture()
  savingEnv.mocks.addPatient = () => new Promise(resolve => { finish = resolve })
  const savingPage = editPage(savingEnv)
  fillPatient(savingPage)
  const saving = savingPage.handleSubmit()
  savingEnv.changeSession()
  finish({ id: 7 })
  await saving
  assert.equal(savingEnv.events.length, 0)
  assert.equal(savingEnv.toasts.length, 0)
})
