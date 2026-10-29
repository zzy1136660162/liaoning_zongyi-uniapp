import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadOptions } from './sfc-harness.mjs'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const setup = (overrides = {}) => {
  let generation = 1
  const navigation = [], modals = [], sent = [], sessions = [], toasts = []
  const mocks = {
    getSessionGeneration: () => generation,
    assertCurrentSession: value => { if (value !== generation) throw Object.assign(new Error('stale'), { code: 'SESSION_CHANGED' }) },
    beginManualAccountLogin: () => () => {},
    establishAccountSession: result => { sessions.push(result); return ++generation },
    login: async payload => { sent.push(payload); return { token: 'fixture', userId: 7, wechatOpenid: 'bound' } },
    redirectToWithFallback: value => navigation.push(value),
    uni: { showToast: value => toasts.push(value), showModal: value => modals.push(value),
      navigateTo: value => navigation.push(value), getStorageSync: () => false, setStorageSync() {}, hideLoading() {} },
    ...overrides
  }
  const definition = loadOptions('pages/login/login.vue', mocks)
  const page = { ...definition.data(), ...definition.methods, phone: '13800000000', code: '123456', agreed: true, redirectUrl: '/pages/order/confirm?id=9' }
  return { page, definition, navigation, modals, sent, sessions, toasts, mocks, changeSession: () => ++generation }
}

test('登录、注册、绑定页面模板均能编译', () => {
  const require = createRequire(new URL('../../liaoning_zongyi-admin/ruoyi-ui/package.json', import.meta.url))
  const compiler = require('vue-template-compiler')
  for (const path of ['login/login', 'register/register', 'user/wechat_binding']) {
    const source = readFileSync(new URL(`../pages/${path}.vue`, import.meta.url), 'utf8')
    assert.deepEqual(compiler.compile(compiler.parseComponent(source).template.content).errors, [], path)
  }
})

test('手机号登录只发送手机号验证码，不要求证件或微信调用，成功回到原业务页', async () => {
  const env = setup()
  await env.page.handleLogin()
  assert.deepEqual(env.sent, [{ phone: '13800000000', code: '123456' }])
  assert.deepEqual(env.navigation, ['/pages/order/confirm?id=9'])
  assert.equal(env.sessions[0].userId, 7)
  assert.equal(env.page.code, '')
})

test('未注册只提示注册，用户确认后在内存传递手机号验证码，URL不携带凭证', async () => {
  const env = setup({ login: async () => { throw { code: 404, message: '尚未注册' } } })
  await env.page.handleLogin()
  assert.equal(env.sessions.length, 0)
  assert.equal(env.navigation.length, 0)
  env.modals[0].success({ confirm: true })
  const route = env.navigation[0]
  assert.equal(route.url, '/pages/register/register?redirect=%2Fpages%2Forder%2Fconfirm%3Fid%3D9')
  let transfer
  route.success({ eventChannel: { emit: (name, data) => { transfer = { name, data } } } })
  assert.deepEqual(transfer, { name: 'registration-phone', data: { phone: '13800000000', code: '123456' } })
  assert.equal(env.page.code, '')
})

test('短信登录成功后允许稍后绑定，不把已登录账号改成微信绑定失败', async () => {
  const env = setup({ login: async () => ({ token: 'fixture', userId: 7 }) })
  await env.page.handleLogin()
  assert.equal(env.sessions.length, 1)
  env.modals[0].success({ confirm: false })
  assert.deepEqual(env.navigation, ['/pages/order/confirm?id=9'])
})

test('旧登录响应或绑定提示不能在切号、离页后建立会话或跳转', async () => {
  let resolve
  const env = setup({ login: () => new Promise(done => { resolve = done }) })
  const pending = env.page.handleLogin()
  env.changeSession()
  resolve({ token: 'old', userId: 7 })
  await pending
  assert.equal(env.sessions.length, 0)
  const second = setup({ login: async () => ({ token: 'new', userId: 8 }) })
  await second.page.handleLogin()
  second.definition.onUnload.call(second.page)
  second.modals[0].success({ confirm: true })
  assert.equal(second.navigation.length, 0)
})

test('登录页隐藏后，注册建立会话不能触发隐藏页抢先导航', () => {
  const env = setup()
  env.definition.onHide.call(env.page)
  env.page.updateRecovery({ status: 'authenticated' })
  assert.deepEqual(env.navigation, [])
})

test('微信换绑必须明确确认且使用本次微信code，过期短信证明回到验证入口', async () => {
  const env = setup()
  const requests = []
  const definition = loadOptions('pages/user/wechat_binding.vue', { ...env.mocks,
    getWeChatLoginCode: async () => 'fresh-code',
    bindWechat: async payload => { requests.push(payload); throw { code: 428, message: '请验证手机' } }
  })
  const page = { ...definition.data(), ...definition.methods, bound: true, smsVerified: true, smsCode: '', loading: false, loadedSession: 1 }
  page.confirmBinding(false)
  assert.equal(requests.length, 0)
  await page.saveBinding(false)
  assert.deepEqual(requests, [{ code: 'fresh-code', smsCode: '', replace: true, confirmed: true }])
  assert.equal(page.smsVerified, false)
  assert.equal(page.bound, true)
  assert.equal(env.toasts[0].title, '请验证手机')
})

test('绑定页切号后清空原手机号，旧弹窗和旧页面不能提交新账号的绑定', async () => {
  const env = setup()
  let changed
  let requests = 0
  const definition = loadOptions('pages/user/wechat_binding.vue', { ...env.mocks,
    onSessionChanged: fn => { changed = fn; return () => {} },
    getWeChatLoginCode: async () => 'fresh', bindWechat: async () => { requests++ }
  })
  const page = { ...definition.data(), ...definition.methods, phone: '13800000000',
    loadedSession: 1, loading: false, smsVerified: true, loadBinding() {} }
  definition.onLoad.call(page)
  page.confirmBinding(false)
  env.changeSession(); changed()
  env.modals[0].success({ confirm: true })
  await page.saveBinding(false)
  assert.equal(requests, 0)
  assert.equal(page.phone, '')
  assert.equal(page.loadedSession, null)
  assert.equal(page.smsVerified, false)
})
