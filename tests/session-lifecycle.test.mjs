import assert from 'node:assert/strict'
import { test, beforeEach, afterEach, mock } from 'node:test'
import { beginSession, endSession, getSessionGeneration, getSessionToken, isCurrentSession, isExplicitlyLoggedOut, assertCurrentSession } from '../utils/session.js'
import { request } from '../utils/request.js'
import { handleAuthenticationFailure } from '../utils/auth-failure.js'
import { uploadFile } from '../api/common.js'
import { logout } from '../api/logout.js'
import { getRefundStageText } from '../utils/refund.js'
import { loadOptions, loadSetup } from './sfc-harness.mjs'
const values = new Map()
let calls = [], redirects = 0, prompts = 0
globalThis.uni = {
  getStorageSync: key => values.get(key), setStorageSync: (key, value) => values.set(key, value),
  removeStorageSync: key => values.delete(key), request: options => { if (typeof options.success === 'function') calls.push(options) }, uploadFile: options => calls.push(options),
  showLoading() {}, hideLoading() {}, $emit() {}, showToast() { prompts++ }, reLaunch() { redirects++ }
}
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }
const response = (call, http, code, data = {}) => call.success({ statusCode: http, data: { code, data } })
beforeEach(() => { values.clear(); calls = []; redirects = 0; prompts = 0; beginSession('fixture-A') })
afterEach(() => { endSession(); mock.timers.reset() })

test('匿名和可选鉴权的401不会清理有效会话或设置主动退出', async () => {
  for (const http of [200, 401]) {
    const generation = getSessionGeneration()
    const result = request({ url: '/api/fixture', needAuth: false, header: { Authorization: 'Bearer fixture-A' } })
    const rejected = assert.rejects(result, { code: 401 })
    response(calls.shift(), http, 401)
    await rejected
    assert.equal(getSessionToken(), 'fixture-A'); assert.equal(getSessionGeneration(), generation)
    assert.equal(isExplicitlyLoggedOut(), false); assert.equal(redirects, 0); assert.equal(prompts, 0)
  }
})
test('HTTP和业务401统一失效；多请求只安排一次登录跳转', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const first = request({ url: '/api/fixture' }), second = request({ url: '/api/fixture' })
  const a = calls.shift(), b = calls.shift()
  const rejectedA = assert.rejects(first, { code: 401, invalidated: true })
  const rejectedB = assert.rejects(second, { code: 'SESSION_CHANGED' })
  response(a, 401, 401); response(b, 200, 401)
  await Promise.all([rejectedA, rejectedB])
  assert.equal(getSessionToken(), ''); assert.equal(isExplicitlyLoggedOut(), false); assert.equal(prompts, 1)
  mock.timers.tick(2000); assert.equal(redirects, 1)
})
test('未携带Token的401不覆盖主动退出；403和503不清除有效登录', async () => {
  endSession()
  let p = request({ url: '/api/fixture', authRedirect: false }); let rejected = assert.rejects(p, { code: 401 })
  response(calls.shift(), 200, 401); await rejected; assert.equal(isExplicitlyLoggedOut(), true)
  beginSession('fixture-B')
  for (const code of [403, 503]) {
    p = request({ url: '/api/fixture' }); rejected = assert.rejects(p)
    response(calls.shift(), code, code); await rejected; assert.equal(getSessionToken(), 'fixture-B')
  }
})
test('上传401使用相同的失效策略，上传旧响应不清理后来登录', async () => {
  let p = uploadFile('/fixture', { authRedirect: false }); let rejected = assert.rejects(p, { code: 401 })
  response(calls.shift(), 200, 401); await rejected
  assert.equal(getSessionToken(), ''); assert.equal(isExplicitlyLoggedOut(), false)
  beginSession('fixture-A'); p = uploadFile('/fixture'); const old = calls.shift(); beginSession('fixture-B')
  rejected = assert.rejects(p, { code: 'SESSION_CHANGED' }); response(old, 401, 401); await rejected
  assert.equal(getSessionToken(), 'fixture-B')
})
test('退出后服务端成功仍可确认，且不影响后来登录', async () => {
  const p = logout(getSessionToken()), call = calls.shift()
  assert.equal(call.timeout, 5000); assert.equal(call.header.Authorization, 'Bearer fixture-A')
  endSession(); beginSession('fixture-B'); response(call, 200, 200)
  assert.deepEqual(await p, { confirmed: true, attempts: 1 }); assert.equal(getSessionToken(), 'fixture-B')
})
test('注销失败只重试一次，并固定使用退出前凭证', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const p = logout(getSessionToken()); calls.shift().fail({}); endSession(); beginSession('fixture-B')
  await flush(); mock.timers.tick(1000); await flush()
  const retry = calls.shift(); assert.equal(retry.header.Authorization, 'Bearer fixture-A')
  retry.fail({}); assert.deepEqual(await p, { confirmed: false, attempts: 2 })
  mock.timers.tick(5000); assert.equal(calls.length, 0); assert.equal(getSessionToken(), 'fixture-B')
})
test('首页旧凭证失效后只恢复一次登录并重新取得自己的资料', async () => {
  let loginCount = 0, profileCount = 0
  const page = loadOptions('pages/index/index.vue', {
    getSessionGeneration, isCurrentSession, isExplicitlyLoggedOut, assertCurrentSession,
    getToken: getSessionToken, saveToken: beginSession, getWeChatLoginCode: async () => 'fixture-fresh-code',
    loginByWeChatCode: async () => { loginCount++; return { token: 'fixture-B' } }, syncCartOnLogin() {},
    getUserProfile: async () => {
      profileCount++
      if (profileCount === 1) throw handleAuthenticationFailure({ generation: getSessionGeneration(), token: getSessionToken(), required: true, redirect: false })
      return { id: 7, userName: 'fixture' }
    }, STORAGE_KEY_USER_INFO: 'user_info', STORAGE_KEY_USER_REGISTER: 'user_register_info', STORAGE_KEY_USER_LOGIN_STATUS: 'user_login_status'
  })
  await page.methods.loadCurrentUser.call({})
  assert.equal(loginCount, 1); assert.equal(profileCount, 2); assert.equal(getSessionToken(), 'fixture-B')
  assert.equal(values.get('user_info').id, 7)
})
test('退款详情优先展示真实阶段，待处理金额状态不掩盖退货物流步骤', () => {
  assert.equal(getRefundStageText({ status: 1, refundScene: 'FORMULATION_RETURN', paymentRefundStatus: 'PENDING' }), '待填写退货物流')
  assert.equal(getRefundStageText({ status: 3, refundScene: 'FORMULATION_RETURN', paymentRefundStatus: 'PENDING' }), '等待商家收货处理')
  assert.equal(getRefundStageText({ status: 3, refundScene: 'FORMULATION_PRE_SHIP', paymentRefundStatus: 'PENDING' }), '等待执行退款')
  assert.equal(getRefundStageText({ status: 3, paymentRefundStatus: 'UNKNOWN' }), '退款结果确认中')
})

for (const name of ['signature', 'signature_landscape']) {
  test(`${name}画布导出旧回调不再使用新账号上传`, async () => {
    let canvas
    uni.canvasToTempFilePath = options => { canvas = options }
    const options = loadOptions(`pages/doctor/${name}.vue`, { getSessionGeneration, isCurrentSession, uploadFile })
    const page = { ...options.data(), ...options.methods, doctorId: 3 }
    const submitting = page.submitSignature()
    beginSession('fixture-B')
    canvas.success({ tempFilePath: '/fixture.png' })
    await submitting
    assert.equal(calls.length, 0)
    assert.equal(prompts, 0)
    assert.equal(getSessionToken(), 'fixture-B')
  })

  test(`${name}签名上传成功后的延迟返回不能影响新登录`, async () => {
    mock.timers.enable({ apis: ['setTimeout'] })
    uni.canvasToTempFilePath = options => options.success({ tempFilePath: '/fixture.png' })
    uni.navigateBack = () => { redirects++ }
    const options = loadOptions(`pages/doctor/${name}.vue`, { getSessionGeneration, isCurrentSession, uploadFile })
    const page = { ...options.data(), ...options.methods, doctorId: 3 }
    const submitting = page.submitSignature()
    await flush()
    response(calls.shift(), 200, 200, '/fixture/signature.png')
    await submitting
    assert.equal(prompts, 1)
    beginSession('fixture-B')
    mock.timers.tick(1500)
    assert.equal(redirects, 0)
  })
}

test('退货物流默认今天，空白、超长和渠道处理中均不能提交', () => {
  const options = loadOptions('pages/order/refund_logistics.vue', { getSessionGeneration, isCurrentSession })
  const page = { ...options.data(), ...options.methods }
  page.initDateRange()
  assert.equal(page.form.returnTime, page.formatDate(new Date()))
  page.refundDetail = { status: 1, paymentRefundStatus: 'PENDING' }
  page.form.logisticsCompany = ' SF '; page.form.logisticsNo = ' waybill '
  assert.ok(options.computed.canSubmit.call(page))
  page.form.logisticsNo = '   '; assert.equal(Boolean(options.computed.canSubmit.call(page)), false)
  page.form.logisticsNo = 'x'.repeat(65); assert.equal(Boolean(options.computed.canSubmit.call(page)), false)
  page.form.logisticsNo = 'waybill'; page.refundDetail.paymentRefundStatus = 'UNKNOWN'
  assert.equal(Boolean(options.computed.canSubmit.call(page)), false)
})


test('地址列表旧异步结果不能覆盖新账号地址缓存', async () => {
  let finish
  const page = loadSetup('pages/order/address_list.vue', {
    getSessionGeneration, isCurrentSession, ref: value => ({ value }), onMounted() {}, onShow() {},
    getAddressList: () => new Promise(resolve => { finish = resolve }),
    STORAGE_KEY_SHIPPING_ADDRESSES: 'shipping_addresses', STORAGE_KEY_DEFAULT_ADDRESS_ID: 'default_address_id'
  }, ['loadAddresses', 'addresses'])
  const loading = page.loadAddresses()
  beginSession('fixture-B'); values.set('shipping_addresses', [{ id: 'B' }])
  finish([{ id: 'A' }]); await loading
  assert.deepEqual(values.get('shipping_addresses'), [{ id: 'B' }])
  assert.deepEqual(page.addresses.value, [])
})

test('个人资料旧异步结果不能写入新账号，旧退出弹窗也不能注销新账号', async () => {
  let finish, modal
  const page = loadSetup('pages/user/profile.vue', {
    getSessionGeneration, isCurrentSession, getSessionToken, endSession,
    ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }),
    onMounted() {}, onShow() {}, onUnmounted() {},
    getUserProfile: () => new Promise(resolve => { finish = resolve }),
    STORAGE_KEY_USER_REGISTER: 'user_register_info', logout: () => { throw new Error('old modal must not revoke') }
  }, ['loadUserProfile', 'handleLogout'])
  uni.showModal = options => { modal = options }
  const loading = page.loadUserProfile(); page.handleLogout()
  beginSession('fixture-B'); values.set('user_register_info', { realName: 'B' })
  finish({ userName: 'A' }); await loading; await modal.success({ confirm: true })
  assert.deepEqual(values.get('user_register_info'), { realName: 'B' })
  assert.equal(getSessionToken(), 'fixture-B'); assert.equal(redirects, 0)
})
