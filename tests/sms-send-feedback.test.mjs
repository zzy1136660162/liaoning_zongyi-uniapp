import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { sendSmsCode } from '../api/auth.js'
import { ID_TYPE_OPTIONS } from '../utils/patient.js'
import { assertCurrentSession } from '../utils/session.js'
import { loadOptions } from './sfc-harness.mjs'

const requests = [], toasts = []
let timerStarts = 0

beforeEach(() => {
  requests.length = 0; toasts.length = 0; timerStarts = 0
  globalThis.uni = {
    getStorageSync: () => '', setStorageSync() {}, removeStorageSync() {},
    showLoading() {}, hideLoading() {}, showToast: value => toasts.push(value),
    request: options => requests.push(options)
  }
})

const registerPage = () => {
  const definition = loadOptions('pages/register/register.vue', {
    uni, sendSmsCode, ID_TYPE_OPTIONS, assertCurrentSession,
    setInterval: () => { timerStarts++; return 1 }
  })
  const page = { ...definition.data(), ...definition.methods }
  page.formData.phone = '13800000000'
  return page
}

test('短信业务失败通过真实请求封装提示用户，不显示发送成功或开始倒计时', async () => {
  const page = registerPage()
  const pending = page.getVerifyCode()
  assert.match(requests[0].url, /\/api\/auth\/send-sms$/)
  requests[0].success({ statusCode: 200, data: {
    code: 503, success: false, message: '验证码发送失败，请稍后重试'
  } })
  await pending

  assert.deepEqual(toasts.map(value => value.title), ['验证码发送失败，请稍后重试'])
  assert.equal(toasts[0].icon, 'none')
  assert.equal(page.countdown, 0)
  assert.equal(timerStarts, 0)
})

test('短信服务确认受理后仍显示成功并开始倒计时', async () => {
  const page = registerPage()
  const pending = page.getVerifyCode()
  requests[0].success({ statusCode: 200, data: { code: 200, success: true } })
  await pending

  assert.deepEqual(toasts.map(value => value.title), ['验证码已发送'])
  assert.equal(page.countdown, 60)
  assert.equal(timerStarts, 1)
})
