import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadOptions, loadSetup } from './sfc-harness.mjs'
import { ID_TYPE_OPTIONS, patientHisSyncNotice } from '../utils/patient.js'
import * as consultationMode from '../utils/consultation-mode.js'

const fixture = () => {
  let generation = 1
  const logs = [], modals = []
  const mocks = {
    ...consultationMode,
    ID_TYPE_OPTIONS, patientHisSyncNotice, renderMarkdown: value => value,
    ref: value => ({ value }), reactive: value => value, computed: get => ({ get value() { return get() } }), watch() {}, nextTick() {}, onMounted() {}, onUnmounted() {},
    getSessionGeneration: () => generation, isCurrentSession: value => value === generation,
    getSessionToken: () => 'fixture-token', onSessionChanged: () => () => {},
    assertCurrentSession(value) { if (value !== generation) throw Object.assign(new Error('stale'), { code: 'SESSION_CHANGED' }) },
    logPageView: value => logs.push({ ...value, kind: 'PAGE_VIEW' }), logButtonClick: value => logs.push({ ...value, kind: 'BUTTON_CLICK' }),
    logAccess: value => logs.push(value), setTimeout() {},
    STORAGE_KEY_USER_REGISTER: 'register', STORAGE_KEY_USER_INFO: 'user', STORAGE_KEY_USER_LOGIN_STATUS: 'logged-in', STORAGE_KEY_AGREEMENT_ACCEPTED: 'agreement',
    STORAGE_KEY_AI_CHAT_ID: 'chat', STORAGE_KEY_AI_CHAT_MESSAGES: 'messages', STORAGE_KEY_WECHAT_OPENID: 'openid',
    uni: { redirectTo() {}, showLoading() {}, hideLoading() {}, hideKeyboard() {}, showToast() {}, getStorageSync() {}, setStorageSync() {}, showModal: value => modals.push(value) }
  }
  return { mocks, logs, modals, changeSession: () => { generation++ } }
}

test('启动页自动跳转不伪造按钮，主动进入只记录一次', () => {
  for (const route of ['index/index', 'splash/splash']) {
    const env = fixture()
    const page = loadOptions(`pages/${route}.vue`, env.mocks)
    page.methods.goToNotice.call({ timer: null })
    assert.equal(env.logs.length, 0)
    page.methods.goToNotice.call({ timer: null }, true)
    assert.equal(env.logs.length, 1)
    assert.equal(env.logs[0].actionCode, 'ENTER_NOTICE')
  }
})

test('签名画布初始化不记重签，主动重签明确记录医生ID且不带图片', () => {
  for (const route of ['signature', 'signature_landscape']) {
    const env = fixture()
    const page = loadOptions(`pages/doctor/${route}.vue`, env.mocks)
    const context = { doctorId: 3, ctx: { clearRect() {} }, canvasWidth: 100, canvasHeight: 100 }
    page.methods.clearCanvas.call(context)
    assert.equal(env.logs.length, 0)
    page.methods.clearCanvas.call(context, true)
    assert.equal(env.logs.length, 1)
    assert.equal(env.logs[0].pageId, 3)
    assert.equal(env.logs[0].extraData, undefined)
  }
})

test('微信登录原生Promise迟到失败不能把旧操作结果记到新账号', async () => {
  const env = fixture()
  let rejectCode
  const definition = loadOptions('pages/register/register.vue', { ...env.mocks,
    getWeChatLoginCode: () => new Promise((_, reject) => { rejectCode = reject })
  })
  const page = { ...definition.data(), ...definition.methods, canSubmit: true }
  const pending = page.handleLogin()
  assert.equal(env.logs.length, 1)
  env.changeSession(); rejectCode(new Error('synthetic private provider failure'))
  await pending
  assert.equal(env.logs.length, 1)
  assert.equal(env.logs[0].actionCode, 'LOGIN')
  assert.equal(JSON.stringify(env.logs).includes('synthetic private'), false)
})

test('登录主动建立新会话后仍能记录成功，日志不含登录表单', async () => {
  const env = fixture()
  const definition = loadOptions('pages/register/register.vue', { ...env.mocks,
    getWeChatLoginCode: async () => 'fixture-code', getWeChatUserProfile: async () => ({}),
    login: async () => ({ token: 'fixture-token' }), establishAccountSession: () => { env.changeSession(); return 2 }
  })
  const page = { ...definition.data(), ...definition.methods, canSubmit: true }
  Object.assign(page.formData, { realName: 'SYNTHETIC_PRIVATE', phone: 'SYNTHETIC_PRIVATE', verifyCode: 'SYNTHETIC_PRIVATE' })
  await page.handleLogin()
  assert.ok(env.logs.some(log => log.actionCode === 'LOGIN' && log.actionResult === 'SUCCESS'))
  assert.equal(JSON.stringify(env.logs).includes('SYNTHETIC_PRIVATE'), false)
})

test('旧账号客服会话弹窗关闭或确认均不产生新账号结果', () => {
  for (const confirm of [false, true]) {
    const env = fixture()
    const page = loadSetup('pages/ai/chat.vue', env.mocks, ['messages', 'handleStartNewChat'])
    page.messages.value = [{ role: 'user', content: 'SYNTHETIC_PRIVATE' }]
    page.handleStartNewChat()
    assert.equal(env.logs.length, 1)
    env.changeSession(); env.modals[0].success({ confirm })
    assert.equal(env.logs.length, 1)
    assert.equal(page.messages.value[0].content, 'SYNTHETIC_PRIVATE')
    assert.equal(JSON.stringify(env.logs).includes('SYNTHETIC_PRIVATE'), false)
  }
})

test('智能客服只记录请求结果与入口，不记录咨询和回复正文', async () => {
  const env = fixture()
  const page = loadSetup('pages/ai/chat.vue', { ...env.mocks,
    sendAiChatMessage: async () => ({ chatId: 'fixture-chat', content: 'SYNTHETIC_PRIVATE_REPLY' })
  }, ['submitMessage'])
  await page.submitMessage('SYNTHETIC_PRIVATE_QUESTION', 'quick_question')
  assert.equal(env.logs.length, 2)
  assert.equal(env.logs[0].extraData.entry, 'quick_question')
  assert.equal(env.logs[1].actionResult, 'SUCCESS')
  assert.equal(JSON.stringify(env.logs).includes('SYNTHETIC_PRIVATE'), false)
})

test('就诊人保存校验拒绝记录点击和固定失败原因，不发送保存请求', async () => {
  const env = fixture()
  let writes = 0
  const page = loadSetup('pages/dispense/patient_edit.vue', { ...env.mocks, addPatient: async () => { writes++ } }, ['handleSubmit'])
  await page.handleSubmit()
  assert.equal(writes, 0)
  assert.equal(env.logs.length, 2)
  assert.equal(env.logs[1].actionResult, 'FAILED')
  assert.equal(env.logs[1].extraData.reason, 'INVALID_PATIENT_FORM')
})

test('继续配制剂流程缺少就诊人时记录明确校验拒绝', () => {
  const env = fixture()
  const page = loadSetup('pages/dispense/apply.vue', env.mocks, ['onSubmit'])
  page.onSubmit()
  assert.equal(env.logs.length, 2)
  assert.equal(env.logs[1].actionResult, 'FAILED')
  assert.equal(env.logs[1].extraData.reason, 'PATIENT_REQUIRED')
})

test('在线复诊本地购买参数无效记明确失败，不冒充网络结果未知', async () => {
  const env = fixture()
  const page = loadSetup('pages/dispense/consultation.vue', env.mocks, ['patientId', 'checkoutRouteError', 'createConsultationRecord'])
  page.patientId.value = 7
  page.checkoutRouteError.value = 'SYNTHETIC_PRIVATE_CONTEXT'
  await page.createConsultationRecord()
  assert.equal(env.logs.length, 1)
  assert.equal(env.logs[0].actionResult, 'FAILED')
  assert.equal(JSON.stringify(env.logs).includes('SYNTHETIC_PRIVATE'), false)
})
