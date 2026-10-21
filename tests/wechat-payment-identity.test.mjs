import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { getWeChatOpenId } from '../api/auth.js'
import { createPrepay, wechatPay, wechatSinglePay } from '../api/payment.js'
import { beginSession, endSession, getSessionGeneration, getSessionToken } from '../utils/session.js'
import { STORAGE_KEY_TOKEN, STORAGE_KEY_WECHAT_OPENID, STORAGE_KEY_WECHAT_UNIONID } from '../utils/storage.js'

const values = new Map(), requests = [], sdkCalls = [], reads = [], toasts = []
let codeSequence, failCacheKey, loginHandler
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
const succeed = (call, data) => call.success({ statusCode: 200, data: { code: 200, data } })
const prepared = () => ({ outTradeNo: 'fixture-trade', prepayId: 'fixture-prepay', payParams: {
  timeStamp: '1', nonceStr: 'fixture-nonce', packageValue: 'prepay_id=fixture-prepay', signType: 'RSA', paySign: 'fixture-sign'
} })

beforeEach(() => {
  values.clear(); requests.length = 0; sdkCalls.length = 0; reads.length = 0; toasts.length = 0
  codeSequence = 0; failCacheKey = ''; loginHandler = options => options.success({ code: `fixture-code-${++codeSequence}` })
  // 只替换微信SDK及HTTP传输，账户/认证/支付模块均执行真实实现，不触网。
  globalThis.uni = {
    getStorageSync: key => { reads.push(key); return values.get(key) },
    setStorageSync: (key, value) => { if (key === failCacheKey) throw new Error('fixture cache full'); values.set(key, value) },
    removeStorageSync: key => values.delete(key),
    login: options => loginHandler(options), request: options => requests.push(options),
    requestPayment: options => sdkCalls.push(options),
    showToast: toast => toasts.push(toast), showLoading() {}, hideLoading() {}, $emit() {}
  }
  beginSession('fixture-token-A')
  reads.length = 0
})
afterEach(() => { endSession() })

test('接口已确认的微信标识在openid或unionid缓存写失败时仍返回，诊断也不能阻断', async t => {
  for (const key of [STORAGE_KEY_WECHAT_OPENID, STORAGE_KEY_WECHAT_UNIONID]) {
    failCacheKey = key
    const index = requests.length, pending = getWeChatOpenId()
    await flush()
    succeed(requests[index], { openid: 'fixture-verified-openid', unionid: 'fixture-verified-union' })
    assert.deepEqual(await pending, { openid: 'fixture-verified-openid', unionid: 'fixture-verified-union' })
  }
  t.mock.method(console, 'warn', () => { throw new Error('fixture console unavailable') })
  failCacheKey = STORAGE_KEY_WECHAT_OPENID
  const pending = getWeChatOpenId()
  await flush(); succeed(requests.at(-1), { openid: 'fixture-verified-openid' })
  assert.equal((await pending).openid, 'fixture-verified-openid')
})

test('预支付、通用付款与单笔付款统一取得新code，旧缓存和调用者openid金额不能覆盖', async () => {
  values.set(STORAGE_KEY_WECHAT_OPENID, 'forged-cache-openid')
  values.set(STORAGE_KEY_WECHAT_UNIONID, 'forged-cache-union')
  const entries = [() => createPrepay('wechat', 10), () => wechatPay(10),
    () => wechatSinglePay(10, { openid: 'forged-caller-openid', wechatCode: 'replayed-code', totalAmount: 1 })]
  for (const [index, start] of entries.entries()) {
    const requestIndex = requests.length, sdkIndex = sdkCalls.length
    const pending = start(); await flush()
    assert.equal(requests.length, requestIndex + 1)
    assert.match(requests[requestIndex].url, /\/api\/payment\/single\/create-by-order\/10$/)
    assert.equal(requests[requestIndex].header.Authorization, 'Bearer fixture-token-A')
    assert.deepEqual(requests[requestIndex].data, { wechatCode: `fixture-code-${index + 1}` })
    succeed(requests[requestIndex], prepared()); await flush()
    if (index > 0) {
      assert.equal(sdkCalls.length, sdkIndex + 1)
      sdkCalls[sdkIndex].success({ errMsg: 'requestPayment:ok' })
    } else assert.equal(sdkCalls.length, sdkIndex)
    assert.equal((await pending).outTradeNo, 'fixture-trade')
  }
  assert.equal(reads.includes(STORAGE_KEY_WECHAT_OPENID), false)
  assert.equal(reads.includes(STORAGE_KEY_WECHAT_UNIONID), false)
})

test('无商城会话或微信授权失败时，不创建支付请求或调用支付SDK', async () => {
  endSession()
  await assert.rejects(wechatSinglePay(10), /请先登录/)
  assert.equal(codeSequence, 0)
  beginSession('fixture-token-A')
  loginHandler = options => options.fail({ errMsg: 'fixture private provider failure' })
  await assert.rejects(createPrepay('wechat', 10), /微信登录失败/)
  await assert.rejects(wechatSinglePay(10), /微信登录失败/)
  assert.equal(requests.length, 0)
  assert.equal(sdkCalls.length, 0)
  assert.equal(getSessionToken(), 'fixture-token-A')
})

test('等待微信授权时切号或直接替换Token，旧付款不使用新账号发起请求', async () => {
  for (const change of ['session', 'token']) {
    beginSession(`fixture-A-${change}`)
    let login
    loginHandler = options => { login = options }
    const pending = wechatSinglePay(10)
    const rejected = assert.rejects(pending, { code: 'SESSION_CHANGED' })
    const generation = getSessionGeneration()
    if (change === 'session') beginSession('fixture-token-B')
    else { values.set(STORAGE_KEY_TOKEN, 'fixture-token-B'); assert.equal(getSessionGeneration(), generation) }
    login.success({ code: 'fixture-old-code' }); await rejected
  }
  assert.equal(requests.length, 0)
  assert.equal(sdkCalls.length, 0)
})

test('预支付结果返回前切号或直接替换Token，旧结果不能调起付款', async () => {
  for (const change of ['session', 'token']) {
    beginSession(`fixture-A-${change}`)
    const index = requests.length, pending = wechatSinglePay(10)
    const rejected = assert.rejects(pending, { code: 'SESSION_CHANGED' })
    await flush()
    if (change === 'session') beginSession('fixture-token-B')
    else values.set(STORAGE_KEY_TOKEN, 'fixture-token-B')
    succeed(requests[index], prepared()); await rejected
  }
  assert.equal(sdkCalls.length, 0)
})

test('旧SDK成功或失败不回写新账号，不在新账号提示付款结果', async () => {
  for (const change of ['session', 'token']) {
    for (const outcome of ['success', 'failure']) {
      beginSession(`fixture-A-${change}-${outcome}`)
      const requestIndex = requests.length, sdkIndex = sdkCalls.length
      const pending = wechatSinglePay(10)
      const rejected = assert.rejects(pending, { code: 'SESSION_CHANGED' })
      await flush(); succeed(requests[requestIndex], prepared()); await flush()
      assert.equal(sdkCalls.length, sdkIndex + 1)
      if (change === 'session') beginSession('fixture-token-B')
      else values.set(STORAGE_KEY_TOKEN, 'fixture-token-B')
      const previousToasts = toasts.length
      if (outcome === 'success') sdkCalls[sdkIndex].success({ errMsg: 'requestPayment:ok' })
      else sdkCalls[sdkIndex].fail({ errMsg: 'requestPayment:fail cancel' })
      await rejected
      assert.equal(toasts.length, previousToasts)
      assert.equal(getSessionToken(), 'fixture-token-B')
    }
  }
})

test('微信code失效返回409不注销商城Token，下次付款使用新code重新请求', async () => {
  const pending = wechatSinglePay(10)
  const rejected = assert.rejects(pending, error => error.code === 409)
  await flush()
  requests[0].success({ statusCode: 200, data: { code: 409, message: '微信支付授权已失效，请重新发起支付' } })
  await rejected
  assert.equal(getSessionToken(), 'fixture-token-A')
  assert.equal(sdkCalls.length, 0)
  const retry = wechatSinglePay(10)
  await flush()
  assert.deepEqual(requests[1].data, { wechatCode: 'fixture-code-2' })
  succeed(requests[1], prepared()); await flush()
  sdkCalls[0].success({ errMsg: 'requestPayment:ok' }); await retry
})

test('支付接口失败或缺少支付参数时不能调起SDK，不以本地身份补造支付结果', async () => {
  const failed = wechatSinglePay(10), rejected = assert.rejects(failed)
  await flush(); requests[0].fail({ errMsg: 'request:fail timeout' }); await rejected
  const malformed = wechatSinglePay(10), malformedRejected = assert.rejects(malformed, /支付参数不完整/)
  await flush(); succeed(requests[1], { outTradeNo: 'fixture-trade' }); await malformedRejected
  assert.equal(sdkCalls.length, 0)
  assert.equal(getSessionToken(), 'fixture-token-A')
})
