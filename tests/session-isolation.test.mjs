import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as storage from '../utils/storage.js'
import { endSession, beginSession, isExplicitlyLoggedOut, getAnalyticsSessionId } from '../utils/session.js'
import { request, getToken } from '../utils/request.js'
import { getWeChatLoginCode, getWeChatOpenId, loginByWeChatCode, login } from '../api/auth.js'
import { uploadFile } from '../api/common.js'

const values = new Map()
const retiredKeys = ['user_info', 'user_register_info', 'user_login_status', 'current_order', 'shipping_addresses', 'default_address_id', 'temp_selected_address']
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
  retiredKeys.forEach(key => values.set(key, { id: 'fixture-legacy-data' }))
  const analytics = getAnalyticsSessionId()
  assert.equal([...values.values()].includes(analytics), false)
  endSession()
  assert.equal(getToken(), '')
  assert.equal(isExplicitlyLoggedOut(), true)
  retiredKeys.forEach(key => assert.equal(values.has(key), false, key))
  for (const [name, key] of Object.entries(storage)) {
    if (name.startsWith('STORAGE_KEY_')) {
      const preserved = ['agreement_accepted', 'privacy_accepted', 'products_cache'].includes(key)
      assert.equal(values.has(key), preserved, key)
    }
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
  retiredKeys.forEach(key => values.set(key, { id: 'fixture-legacy-data' }))
  beginSession('account-B')
  assert.equal(getToken(), 'account-B')
  assert.equal(values.has(storage.STORAGE_KEY_AI_CHAT_MESSAGES), false)
  retiredKeys.forEach(key => assert.equal(values.has(key), false, key))
})

test('首次登录和会话失效退出均清理旧资料及订单草稿，保留设备偏好', () => {
  values.clear()
  values.set(storage.STORAGE_KEY_AGREEMENT_ACCEPTED, true)
  values.set('layout-preference', 'fixture-layout')
  for (const action of [() => beginSession('fixture-login'), () => endSession({ explicit: false })]) {
    retiredKeys.forEach(key => values.set(key, { id: 'fixture-legacy-data' }))
    action()
    retiredKeys.forEach(key => assert.equal(values.has(key), false, key))
    assert.equal(values.get(storage.STORAGE_KEY_AGREEMENT_ACCEPTED), true)
    assert.equal(values.get('layout-preference'), 'fixture-layout')
  }
  assert.equal(getToken(), '')
  assert.equal(isExplicitlyLoggedOut(), false)
})

test('同凭证会话初始化保留下单重试标识、付款清理快照和当前结算范围', () => {
  beginSession('fixture-same-token')
  const pending = { requestId: 'fixture-request', orderId: 42 }
  const snapshots = { 42: { '10:11': { serverCartItemId: 8, serverCartVersion: 2, quantity: 1 } } }
  values.set(storage.STORAGE_KEY_ORDER_SUBMISSION, pending)
  values.set(storage.STORAGE_KEY_ORDER_CART_SNAPSHOTS, snapshots)
  values.set(storage.STORAGE_KEY_CHECKOUT_PRODUCT_IDS, ['10:11'])
  beginSession('fixture-same-token')
  assert.equal(getToken(), 'fixture-same-token')
  assert.deepEqual(values.get(storage.STORAGE_KEY_ORDER_SUBMISSION), pending)
  assert.deepEqual(values.get(storage.STORAGE_KEY_ORDER_CART_SNAPSHOTS), snapshots)
  assert.deepEqual(values.get(storage.STORAGE_KEY_CHECKOUT_PRODUCT_IDS), ['10:11'])
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
  assert.equal(values.has('wechat_session_key'), false)
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
