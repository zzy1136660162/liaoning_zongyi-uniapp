import assert from 'node:assert/strict'
import { test, beforeEach, afterEach, mock } from 'node:test'
import { beginSession, endSession, getSessionGeneration, getSessionToken, isCurrentSession, isExplicitlyLoggedOut, assertCurrentSession } from '../utils/session.js'
import { request } from '../utils/request.js'
import { handleAuthenticationFailure } from '../utils/auth-failure.js'
import { uploadFile } from '../api/common.js'
import { logout } from '../api/logout.js'
import { getRefundStageText } from '../utils/refund.js'
import { ID_TYPE_OPTIONS } from '../utils/patient.js'
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

test('退款详情重新显示时只在原账号会话有效时读取', () => {
  const definition = loadOptions('pages/order/refund_detail.vue', { isCurrentSession: value => value === 1,
    getPaymentRefundStatusText() {}, getRefundStageText() {}, getImageUrl: value => value })
  let reads = 0
  const page = { ...definition.data(), refundApplicationId: 8, sessionGeneration: 1, loadDetail: () => { reads++ } }
  definition.onShow.call(page)
  page.sessionGeneration = 0
  definition.onShow.call(page)
  assert.equal(reads, 1)
})

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
test('首页旧凭证失效后只恢复一次登录，新会话资料由业务页按需读取', async () => {
  let loginCount = 0, profileCount = 0
  const page = loadOptions('pages/index/index.vue', {
    getSessionGeneration, isCurrentSession, isExplicitlyLoggedOut, assertCurrentSession,
    getToken: getSessionToken, establishAccountSession: result => { beginSession(result.token); return getSessionGeneration() },
    getWeChatLoginCode: async () => 'fixture-fresh-code',
    loginByWeChatCode: async () => { loginCount++; return { token: 'fixture-B' } },
    fetchAccountProfile: async options => {
      assert.deepEqual(options, { authRedirect: false })
      profileCount++
      if (profileCount === 1) throw handleAuthenticationFailure({ generation: getSessionGeneration(), token: getSessionToken(), required: true, redirect: false })
      return { id: 7, userName: 'fixture' }
    }
  })
  await page.methods.loadCurrentUser.call({})
  assert.equal(loginCount, 1); assert.equal(profileCount, 1); assert.equal(getSessionToken(), 'fixture-B')
  assert.equal(values.has('user_info'), false); assert.equal(values.has('user_register_info'), false)
  assert.equal(redirects, 0); assert.equal(prompts, 0)
})

test('首页新登录无需资料初始化，主动退出不自动登录，旧微信授权不能建立后来会话', async () => {
  let loginCount = 0, profileCount = 0, finishCode
  const mocks = {
    getSessionGeneration, isCurrentSession, isExplicitlyLoggedOut, assertCurrentSession, getToken: getSessionToken,
    establishAccountSession: result => { beginSession(result.token); return getSessionGeneration() },
    getWeChatLoginCode: async () => 'fixture-code',
    loginByWeChatCode: async () => { loginCount++; return { token: 'fixture-B' } },
    fetchAccountProfile: async () => { profileCount++; throw new Error('must not initialize profile') }
  }
  endSession({ explicit: false })
  await loadOptions('pages/index/index.vue', mocks).methods.loadCurrentUser.call({})
  assert.equal(loginCount, 1); assert.equal(profileCount, 0); assert.equal(getSessionToken(), 'fixture-B')
  endSession()
  await loadOptions('pages/index/index.vue', mocks).methods.loadCurrentUser.call({})
  assert.equal(loginCount, 1)
  endSession({ explicit: false })
  const page = loadOptions('pages/index/index.vue', { ...mocks,
    getWeChatLoginCode: () => new Promise(resolve => { finishCode = resolve }) })
  const pending = page.methods.loadCurrentUser.call({})
  beginSession('fixture-C'); finishCode('old-code'); await pending
  assert.equal(loginCount, 1); assert.equal(getSessionToken(), 'fixture-C')
})

test('注册登录保留授权拒绝后的身份登录和会话保护，延迟跳转不能影响后来账号', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const options = loadOptions('pages/register/register.vue', {
    ID_TYPE_OPTIONS,
    getSessionGeneration, assertCurrentSession,
    getWeChatLoginCode: async () => 'fixture-code',
    getWeChatUserProfile: async () => { throw new Error('authorization denied') },
    login: async payload => { assert.equal(payload.avatarUrl, ''); return { token: 'fixture-B' } },
    establishAccountSession: result => { beginSession(result.token); return getSessionGeneration() },
    patientHisSyncNotice: () => '', redirectToWithFallback: () => { redirects++ }
  })
  const page = { ...options.data(), ...options.methods, canSubmit: true }
  await page.handleLogin()
  assert.equal(getSessionToken(), 'fixture-B')
  assert.equal(values.has('user_info'), false); assert.equal(values.has('user_register_info'), false)
  beginSession('fixture-C'); mock.timers.tick(1500)
  assert.equal(redirects, 0)
})
test('注册页凭证保存失败即使已推进会话代次仍展示失败且不跳转', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const toasts = [], logs = []
  const initialGeneration = getSessionGeneration()
  let cartRefreshes = 0
  const options = loadOptions('pages/register/register.vue', {
    ID_TYPE_OPTIONS, getSessionGeneration, assertCurrentSession,
    getWeChatLoginCode: async () => 'fixture-code', getWeChatUserProfile: async () => ({}),
    login: async () => ({ token: 'fixture-B' }),
    establishAccountSession: () => {
      endSession({ explicit: false })
      throw Object.assign(new Error('登录凭证保存失败，请重试'), {
        code: 'SESSION_STORAGE_FAILED', sessionGeneration: getSessionGeneration()
      })
    },
    refreshCart: async () => { cartRefreshes++; return [] },
    logAccess: entry => logs.push(entry),
    redirectToWithFallback: () => { redirects++ },
    uni: { ...uni, showToast: toast => toasts.push(toast) }
  })
  const page = { ...options.data(), ...options.methods, canSubmit: true }

  await page.handleLogin()

  assert.ok(getSessionGeneration() > initialGeneration)
  assert.deepEqual(toasts, [{ title: '登录凭证保存失败，请重试', icon: 'none' }])
  assert.equal(logs.length, 1)
  assert.equal(logs[0].accessTitle, '注册登录未完成')
  assert.equal(logs[0].extraData.reason, 'login_incomplete')
  assert.equal(page.loggingIn, false)
  assert.equal(cartRefreshes, 0)
  mock.timers.tick(10000)
  assert.equal(redirects, 0)
})

test('退款详情优先展示真实渠道阶段，历史实物退货提示线下处理', () => {
  assert.equal(getRefundStageText({ status: 1, refundScene: 'FORMULATION_RETURN', paymentRefundStatus: 'PENDING' }), '请线下联系客服处理退款')
  assert.equal(getRefundStageText({ status: 3, refundScene: 'FORMULATION_RETURN', paymentRefundStatus: 'PENDING' }), '请线下联系客服处理退款')
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

test('历史退货物流入口不再读写物流，账号变化后不能查看原账号申请', () => {
  const options = loadOptions('pages/order/refund_logistics.vue', { getSessionGeneration, isCurrentSession })
  const page = { ...options.data(), ...options.methods }
  options.onLoad.call(page, { refundApplicationId: 8 })
  assert.equal(calls.length, 0)
  beginSession('fixture-B')
  uni.redirectTo = () => { redirects++ }
  page.viewRefundDetail()
  assert.equal(redirects, 0)
  assert.equal(calls.length, 0)
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
    fetchAccountProfile: () => new Promise(resolve => { finish = resolve }),
    STORAGE_KEY_USER_REGISTER: 'user_register_info', logout: () => { throw new Error('old modal must not revoke') }
  }, ['loadUserProfile', 'handleLogout', 'userInfo', 'profileError'])
  uni.showModal = options => { modal = options }
  const loading = page.loadUserProfile(); page.handleLogout()
  beginSession('fixture-B'); values.set('user_register_info', { realName: 'B' })
  finish({ userName: 'A' }); await loading; await modal.success({ confirm: true })
  assert.deepEqual(values.get('user_register_info'), { realName: 'B' })
  assert.equal(page.userInfo.value.realName, '')
  assert.equal(page.profileError.value, '')
  assert.equal(getSessionToken(), 'fixture-B'); assert.equal(redirects, 0)
})


test('请求和上传固定声明新购买分类合同，调用方不能降回旧字段适配', async () => {
  const pending = request({ url: '/api/contract-fixture', header: { 'X-Product-Contract': 'legacy' } })
  const call = calls.shift()
  assert.equal(call.header['X-Product-Contract'], 'category-v1')
  response(call, 200, 200); await pending
  const upload = uploadFile('/fixture', { header: { 'X-Product-Contract': 'legacy' } })
  const uploadCall = calls.shift()
  assert.equal(uploadCall.header['X-Product-Contract'], 'category-v1')
  response(uploadCall, 200, 200, { url: '/fixture.png' }); await upload
})
