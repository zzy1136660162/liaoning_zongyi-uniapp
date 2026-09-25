import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as storage from '../utils/storage.js'
import { endSession, beginSession, isExplicitlyLoggedOut, getAnalyticsSessionId } from '../utils/session.js'
import { request, getToken } from '../utils/request.js'
import { getWeChatLoginCode, getWeChatOpenId, loginByWeChatCode, login } from '../api/auth.js'
import { uploadFile } from '../api/common.js'

const values = new Map()
let requests = []
let loginSequence = 0
let redirects = 0
globalThis.uni = {
  getStorageSync: key => values.get(key),
  setStorageSync: (key, value) => values.set(key, value),
  removeStorageSync: key => values.delete(key),
  request: options => requests.push(options),
  uploadFile: options => requests.push(options),
  login: ({ success }) => success({ code: `fresh-${++loginSequence}` }),
  showLoading() {}, hideLoading() {}, showToast() {}, $emit() {},
  reLaunch() { redirects++ }
}
const take = () => requests.shift()
const ok = (call, data) => call.success({ statusCode: 200, data: { code: 200, data } })

test('退出清除实际凭证、就诊/地址/购物车/AI状态并保持显式退出', () => {
  for (const [name, key] of Object.entries(storage)) {
    if (name.startsWith('STORAGE_KEY_')) values.set(key, 'old-session-data')
  }
  values.set('auth_token', 'legacy-token')
  values.set('temp_selected_address', { id: 7 })
  const analytics = getAnalyticsSessionId()
  assert.notEqual(analytics, values.get(storage.STORAGE_KEY_WECHAT_SESSION_KEY))
  endSession()
  assert.equal(getToken(), '')
  assert.equal(isExplicitlyLoggedOut(), true)
  assert.equal(values.has('temp_selected_address'), false)
  for (const [name, key] of Object.entries(storage)) {
    if (name.startsWith('STORAGE_KEY_')) assert.equal(values.has(key), false, key)
  }
  beginSession('new-token')
  assert.equal(isExplicitlyLoggedOut(), false)
  assert.equal(getToken(), 'new-token')
  assert.notEqual(getAnalyticsSessionId(), analytics)
})

test('旧会话成功返回及401均不能污染新会话或跳转登录页', async () => {
  requests = []
  beginSession('session-A')
  const oldSuccess = request({ url: '/api/user/profile' })
  const oldUnauthorized = request({ url: '/api/patients' })
  const responseA = take()
  const response401 = take()
  endSession()
  beginSession('session-B')
  const rejectSuccess = assert.rejects(oldSuccess, { code: 'SESSION_CHANGED' })
  const rejectUnauthorized = assert.rejects(oldUnauthorized, { code: 'SESSION_CHANGED' })
  ok(responseA, { id: 1 })
  response401.success({ statusCode: 200, data: { code: 401 } })
  await Promise.all([rejectSuccess, rejectUnauthorized])
  assert.equal(getToken(), 'session-B')
  assert.equal(redirects, 0)
  assert.equal(requests.length, 0)
})

test('旧上传响应在退出后不可写回用户表单', async () => {
  requests = []
  const upload = uploadFile('/mock-local-image')
  const callback = take()
  endSession()
  const rejected = assert.rejects(upload, { code: 'SESSION_CHANGED' })
  ok(callback, { url: '/mock-result' })
  await rejected
})

test('直接更换登录凭证同样清除旧账号缓存', () => {
  beginSession('account-A')
  values.set(storage.STORAGE_KEY_AI_CHAT_MESSAGES, ['private-history'])
  values.set(storage.STORAGE_KEY_CURRENT_ORDER, { patientId: 42 })
  beginSession('account-B')
  assert.equal(getToken(), 'account-B')
  assert.equal(values.has(storage.STORAGE_KEY_AI_CHAT_MESSAGES), false)
  assert.equal(values.has(storage.STORAGE_KEY_CURRENT_ORDER), false)
})

test('openid查询、code登录、注册分别消费新code且不存sessionKey', async () => {
  requests = []
  const identity = getWeChatOpenId()
  await Promise.resolve()
  const exchange = take()
  assert.equal(exchange.data.code, 'fresh-1')
  ok(exchange, { openid: 'fixture-openid', unionid: 'fixture-union', sessionKey: 'must-not-persist' })
  const info = await identity
  assert.equal(info.openid, 'fixture-openid')
  assert.equal('sessionKey' in info, false)
  assert.equal(values.has(storage.STORAGE_KEY_WECHAT_SESSION_KEY), false)
  requests = []
  const code = await getWeChatLoginCode()
  const signIn = loginByWeChatCode(code)
  const signInCall = take()
  assert.deepEqual(signInCall.data, { code: 'fresh-2' })
  ok(signInCall, { token: 'fixture-token' })
  await signIn
  requests = []
  const wechatCode = await getWeChatLoginCode()
  const register = login({ wechatCode, phone: 'fixture-phone', code: 'fixture-sms' })
  const registerCall = take()
  assert.equal(registerCall.data.wechatCode, 'fresh-3')
  assert.equal(registerCall.data.wechatOpenid, undefined)
  ok(registerCall, { token: 'fixture-token' })
  await register
})
