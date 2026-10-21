import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { establishAccountSession, fetchAccountProfile } from '../utils/account.js'
import { beginSession, endSession, getSessionGeneration, getSessionToken } from '../utils/session.js'
import { STORAGE_KEY_TOKEN, STORAGE_KEY_WECHAT_OPENID } from '../utils/storage.js'

const values = new Map()
const reads = [], writes = [], requests = [], redirects = []
const retiredProfileKeys = ['user_info', 'user_register_info', 'user_login_status']
const profile = (id = 7, phone = '13800138000') => ({
  id, phone, userName: `测试用户${id}`, idType: '护照', idCardNo: 'P12345678',
  avatarUrl: '/fixture-avatar.png', gender: 1, birthday: '1990-01-01'
})
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
const succeed = (request, data) => request.success({ statusCode: 200, data: { code: 200, data } })
const unauthorized = request => request.success({ statusCode: 401, data: { code: 401, message: '测试会话已失效' } })

beforeEach(() => {
  values.clear(); reads.length = 0; writes.length = 0; requests.length = 0; redirects.length = 0
  // 使用真实请求封装，仅替换最外层传输；测试从不访问运行环境接口。
  globalThis.uni = {
    getStorageSync: key => { reads.push(key); return values.get(key) },
    setStorageSync: (key, value) => { writes.push([key, value]); values.set(key, value) },
    removeStorageSync: key => values.delete(key),
    request: options => requests.push(options),
    showLoading() {}, hideLoading() {}, showToast() {}, $emit() {},
    reLaunch: options => redirects.push(options)
  }
  beginSession('fixture-token-A')
  reads.length = 0; writes.length = 0
})

afterEach(() => { endSession() })

test('旧资料键存在也只从当前账户接口取得资料，不读取或回写旧缓存', async () => {
  values.set('user_info', { id: 999, userName: '旧账号' })
  values.set('user_register_info', { realName: '未提交草稿', idNumber: 'draft-number' })
  values.set('user_login_status', true)

  const pending = fetchAccountProfile()
  await flush()
  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/api\/user\/profile$/)
  assert.equal(requests[0].method, 'GET')
  assert.equal(requests[0].header.Authorization, 'Bearer fixture-token-A')
  succeed(requests[0], profile())

  assert.deepEqual(await pending, profile())
  assert.deepEqual(reads.filter(key => retiredProfileKeys.includes(key)), [])
  assert.deepEqual(writes.filter(([key]) => retiredProfileKeys.includes(key)), [])
})

test('上次请求完成后再次读取仍真实GET，资料变更不会被内存快照遮住', async () => {
  const first = fetchAccountProfile()
  await flush(); succeed(requests[0], profile())
  assert.equal((await first).phone, '13800138000')

  const next = fetchAccountProfile()
  await flush()
  assert.equal(requests.length, 2)
  succeed(requests[1], profile(7, '13900139000'))
  assert.equal((await next).phone, '13900139000')
  assert.equal(writes.length, 0)
})

test('同会话同选项只合并进行中的请求，静默与跳转选项各自生效', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const silent = fetchAccountProfile({ authRedirect: false })
  const silentAgain = fetchAccountProfile({ authRedirect: false })
  const interactive = fetchAccountProfile()
  const interactiveAgain = fetchAccountProfile({ authRedirect: true })
  await flush()
  assert.equal(requests.length, 2)

  // 静默401先结束本会话；另一选项的旧请求不能随后跳转或恢复旧账号。
  const silentErrors = [silent, silentAgain].map(pending => assert.rejects(pending, { code: 401 }))
  const staleErrors = [interactive, interactiveAgain].map(pending => assert.rejects(pending, { code: 'SESSION_CHANGED' }))
  unauthorized(requests[0]); unauthorized(requests[1])
  await Promise.all([...silentErrors, ...staleErrors])
  t.mock.timers.tick(2000)
  assert.equal(redirects.length, 0)

  beginSession('fixture-token-interactive')
  const current = fetchAccountProfile({ authRedirect: true })
  const rejected = assert.rejects(current, { code: 401 })
  await flush(); unauthorized(requests[2]); await rejected
  t.mock.timers.tick(2000)
  assert.deepEqual(redirects, [{ url: '/pages/register/register' }])
})

test('切换账号后旧成功、失败和401均不能污染新会话或拆掉新请求的合并状态', async () => {
  for (const outcome of ['success', 'failure', 'unauthorized']) {
    beginSession(`fixture-token-A-${outcome}`)
    const firstIndex = requests.length
    const old = fetchAccountProfile()
    const oldRejected = assert.rejects(old, { code: 'SESSION_CHANGED' })
    await flush()
    beginSession(`fixture-token-B-${outcome}`)
    const current = fetchAccountProfile()
    await flush()

    const oldRequest = requests[firstIndex]
    if (outcome === 'success') succeed(oldRequest, profile(7))
    else if (outcome === 'failure') oldRequest.fail({ errMsg: 'request:fail timeout' })
    else unauthorized(oldRequest)
    await oldRejected

    // 旧请求的finally也必须按归属清理，不能误删B仍在进行的请求。
    const currentAgain = fetchAccountProfile()
    await flush()
    assert.equal(requests.length, firstIndex + 2)
    assert.equal(requests[firstIndex + 1].header.Authorization, `Bearer fixture-token-B-${outcome}`)
    succeed(requests[firstIndex + 1], profile(8))
    assert.deepEqual(await Promise.all([current, currentAgain]), [profile(8), profile(8)])
    assert.equal(getSessionToken(), `fixture-token-B-${outcome}`)
    assert.equal(redirects.length, 0)
  }
})

test('网络或业务失败向调用方抛出，下一次请求可重新取得服务端资料', async () => {
  for (const failure of ['network', 'business']) {
    const index = requests.length
    const pending = fetchAccountProfile()
    const rejected = assert.rejects(pending)
    await flush()
    if (failure === 'network') requests[index].fail({ errMsg: 'request:fail timeout' })
    else requests[index].success({ statusCode: 200, data: { code: 500, message: '测试资料服务繁忙' } })
    await rejected

    const retry = fetchAccountProfile()
    await flush()
    assert.equal(requests.length, index + 2)
    succeed(requests[index + 1], profile())
    assert.deepEqual(await retry, profile())
  }
  assert.equal(writes.length, 0)
})

test('Token直接被替换而会话代次不变时，也拒绝旧凭证的资料结果', async () => {
  const generation = getSessionGeneration()
  const old = fetchAccountProfile()
  const rejected = assert.rejects(old, { code: 'SESSION_CHANGED' })
  await flush()
  values.set(STORAGE_KEY_TOKEN, 'fixture-token-direct-B')
  assert.equal(getSessionGeneration(), generation)
  succeed(requests[0], profile(7))
  await rejected

  const current = fetchAccountProfile()
  await flush()
  assert.equal(requests[1].header.Authorization, 'Bearer fixture-token-direct-B')
  succeed(requests[1], profile(8))
  assert.deepEqual(await current, profile(8))
})

test('建立登录会话同步只保存凭证和openid，不保存表单或登录摘要也不请求资料', () => {
  const generation = getSessionGeneration()
  const result = establishAccountSession({
    token: 'fixture-login-token', wechatOpenid: 'fixture-login-openid', userId: 7,
    phone: '13800138000', userName: '表单姓名', avatarUrl: '/fixture-login-avatar.png',
    idType: '护照', idCardNo: 'P12345678', verifyCode: 'fixture-sms',
    wechatUnionid: 'fixture-union', sessionKey: 'fixture-session-key', hisBindingStatus: 'DISABLED'
  })

  assert.equal(typeof result, 'number')
  assert.ok(result > generation)
  assert.equal(result, getSessionGeneration())
  assert.equal(getSessionToken(), 'fixture-login-token')
  assert.equal(values.get(STORAGE_KEY_WECHAT_OPENID), 'fixture-login-openid')
  assert.equal(requests.length, 0)
  const allowed = new Set([STORAGE_KEY_TOKEN, STORAGE_KEY_WECHAT_OPENID, 'explicit_logout'])
  assert.deepEqual(writes.filter(([key]) => !allowed.has(key)), [])
  for (const key of retiredProfileKeys) assert.equal(values.has(key), false)
})

test('畸形资料或非法账号ID必须失败，不能当作已确认用户或复用上次结果', async () => {
  const first = fetchAccountProfile()
  await flush(); succeed(requests[0], profile()); await first
  const invalidProfiles = [null, undefined, [], {}, 'invalid-profile',
    ...[null, 0, -1, 1.5, true, false, '', 'not-an-id'].map(id => ({ ...profile(), id }))]

  for (const invalid of invalidProfiles) {
    const index = requests.length
    const pending = fetchAccountProfile()
    const rejected = assert.rejects(pending)
    await flush()
    assert.equal(requests.length, index + 1)
    succeed(requests[index], invalid)
    await rejected
  }

  const retry = fetchAccountProfile()
  await flush(); succeed(requests.at(-1), profile(8))
  assert.deepEqual(await retry, profile(8))
  assert.equal(writes.length, 0)
})

test('openid单项保存失败仍保留已建立的登录，不保存其他登录资料或主动查询', () => {
  const save = uni.setStorageSync
  uni.setStorageSync = (key, value) => {
    if (key === STORAGE_KEY_WECHAT_OPENID) throw new Error('fixture storage full')
    save(key, value)
  }
  const previous = getSessionGeneration()
  const generation = establishAccountSession({
    token: 'fixture-token-openid-write-failed', wechatOpenid: 'fixture-openid',
    userId: 7, userName: '未落盘姓名', phone: '13800138000', idCardNo: 'P12345678'
  })

  assert.ok(generation > previous)
  assert.equal(generation, getSessionGeneration())
  assert.equal(getSessionToken(), 'fixture-token-openid-write-failed')
  assert.equal(values.has(STORAGE_KEY_WECHAT_OPENID), false)
  assert.equal(requests.length, 0)
  const allowed = new Set([STORAGE_KEY_TOKEN, 'explicit_logout'])
  assert.deepEqual(writes.filter(([key]) => !allowed.has(key)), [])
})

test('Token保存失败明确抛出存储错误和当前代次，不能被页面当作旧会话静默忽略', () => {
  const save = uni.setStorageSync
  uni.setStorageSync = (key, value) => {
    if (key === STORAGE_KEY_TOKEN) throw new Error('fixture storage full')
    save(key, value)
  }
  const previous = getSessionGeneration()
  assert.throws(() => establishAccountSession({ token: 'fixture-unsaved-token', wechatOpenid: 'fixture-openid' }), error => {
    assert.equal(error.code, 'SESSION_STORAGE_FAILED')
    assert.equal(error.sessionGeneration, getSessionGeneration())
    assert.ok(error.sessionGeneration > previous)
    assert.match(error.message, /登录凭证保存失败/)
    return true
  })
  assert.equal(getSessionToken(), '')
  assert.equal(values.has(STORAGE_KEY_WECHAT_OPENID), false)
  assert.equal(requests.length, 0)
})
