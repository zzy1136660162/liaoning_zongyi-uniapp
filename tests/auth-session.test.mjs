import assert from 'node:assert/strict'
import { test, beforeEach, afterEach, mock } from 'node:test'
import { readFileSync } from 'node:fs'
import { beginSession, endSession, getSessionGeneration, getSessionToken, isExplicitlyLoggedOut } from '../utils/session.js'
import { restoreAccountSession, waitForSessionRecovery, getAccountSessionState, requireAccountSession,
  cancelAccountRecovery, onAccountSessionState, beginManualAccountLogin } from '../utils/auth-session.js'
import { request, get, post } from '../utils/request.js'
import { API_PATHS } from '../utils/config.js'
import { buildCategoryTree, normalizeCategoryId } from '../utils/category-tree.js'
import { fetchAccountProfile, establishAccountSession } from '../utils/account.js'
import { uploadFile } from '../api/common.js'
import { createPrepay } from '../api/payment.js'
import { refreshCart, getCartTotalQuantity, updateProductSelection } from '../utils/cart.js'
import { ID_TYPE_OPTIONS } from '../utils/patient.js'
import { loadOptions, loadSetup } from './sfc-harness.mjs'

// 执行真实商品 API 包装及请求层，避免用手写 needAuth 掩盖页面实际使用的配置。
const productSource = readFileSync(new URL('../api/product.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '').replace(/^export /gm, '')
const { getCategoryList, getCategoryProducts } = Function('get', 'post', 'API_PATHS',
  `${productSource}\nreturn { getCategoryList, getCategoryProducts }`
)(get, post, API_PATHS)

const storage = new Map()
let calls, logins, navigations, toasts, pages
globalThis.uni = {
  getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key), $emit() {}, showLoading() {}, hideLoading() {},
  request: call => { calls.push(call); return { abort: () => { call.aborted = true } } },
  uploadFile: call => calls.push(call), login: call => logins.push(call),
  reLaunch: options => navigations.push(options), showToast: options => toasts.push(options)
}
globalThis.getCurrentPages = () => pages
const flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve() }
const pending = path => calls.filter(call => !call.answered && new URL(call.url).pathname.endsWith(path))
const take = path => { const call = pending(path)[0]; assert.ok(call, `missing ${path}`); call.answered = true; return call }
const reply = (call, data, code = 200, http = 200) => call.success({ statusCode: http, data: { code, data, message: code === 200 ? '成功' : '身份校验失败' } })
const fail = (call, authReason, http = 200) => reply(call, { authReason }, 401, http)
const finishRecovery = async (token = 'renewed-A') => {
  assert.equal(logins.length, 1)
  logins[0].success({ code: 'fresh-wechat-code' }); await flush()
  reply(take('/api/auth/recover'), { token, userId: 7 }); await flush()
}
const cartItem = (checked = 1) => ({ id: 8, productId: 10, skuId: 11, productName: '测试商品', quantity: 2,
  checked, cartVersion: 1, stock: 9, price: 5, productCategory: 2 })
beforeEach(() => {
  calls = []; logins = []; navigations = []; toasts = []; storage.clear()
  pages = [{ route: 'pages/order/order-detail', options: { id: '18' } }]
  beginSession('old-A')
})
afterEach(() => { endSession(); mock.timers.reset() })

test('App 启动只检查身份，启动与前台生命周期共享请求，页面按需读取', async () => {
  const app = loadOptions('App.vue', { restoreAccountSession, getAccountSessionState })
  app.onLaunch.call(app); app.onShow.call(app); await flush()
  assert.equal(calls.length, 1)
  reply(take('/api/auth/session'), { userId: 7 }); await flush()
  assert.equal(getAccountSessionState().status, 'authenticated')
  assert.equal(logins.length, 0)
  app.onShow.call(app); await flush(); assert.equal(calls.length, 1)
  for (const file of ['pages/index/index.vue', 'pages/register/register.vue']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /refreshCart|getCartList|fetchAccountProfile|getProductList|loginByWeChatCode/)
  }
})

for (const reason of ['TOKEN_EXPIRED', 'SESSION_MISSING']) {
  test(`${reason}：启动恢复时角标、订单与资料等待，公开商品请求不等待`, async () => {
    const generation = getSessionGeneration()
    storage.set('order_submission', { requestId: 'keep-draft' })
    const restore = restoreAccountSession()
    const cart = refreshCart(), orders = request({ url: '/api/orders' }), profile = fetchAccountProfile()
    const products = getCategoryProducts(7, 1, 20, 1)
    await flush()
    assert.equal(calls.length, 2)
    reply(take(API_PATHS.CATEGORY.PRODUCTS), { records: [{ id: 10 }], total: 1 })
    assert.deepEqual(await products, { records: [{ id: 10 }], total: 1 })
    fail(take('/api/auth/session'), reason); await flush()
    assert.equal(pending('/api/cart').length, 0); assert.equal(navigations.length, 0)
    await finishRecovery()
    assert.equal(await restore, true)
    for (const path of ['/api/cart', '/api/orders', '/api/user/profile']) {
      const call = take(path)
      assert.equal(call.header.Authorization, 'Bearer renewed-A')
      reply(call, path.endsWith('profile') ? { id: 7 } : [])
    }
    await Promise.all([cart, orders, profile])
    assert.equal(getSessionGeneration(), generation)
    assert.deepEqual(storage.get('order_submission'), { requestId: 'keep-draft' })
    assert.equal(navigations.length, 0)
  })
}

test('无本地凭证的首次恢复后，等待中的资料和角标使用同一新凭证', async () => {
  endSession({ explicit: false })
  const restore = restoreAccountSession(), profile = fetchAccountProfile(), cart = refreshCart()
  await flush(); assert.equal(calls.length, 0)
  await finishRecovery()
  assert.equal(await restore, true)
  reply(take('/api/user/profile'), { id: 7 }); reply(take('/api/cart'), [])
  assert.equal((await profile).id, 7); await cart
  assert.equal(navigations.length, 0)
})

test('运行中并发401及迟到旧401只恢复一次，GET至多重读一次', async () => {
  const first = request({ url: '/api/orders' }), second = request({ url: '/api/patients' })
  const a = take('/api/orders'), b = take('/api/patients')
  fail(a, 'SESSION_MISSING'); await flush()
  await finishRecovery()
  fail(b, 'SESSION_REPLACED', 401); await flush()
  reply(take('/api/orders'), ['order']); reply(take('/api/patients'), ['patient'])
  assert.deepEqual(await first, ['order']); assert.deepEqual(await second, ['patient'])
  assert.equal(calls.filter(call => call.url.endsWith('/api/auth/recover')).length, 1)
  assert.equal(logins.length, 1); assert.equal(navigations.length, 0)
})

for (const method of ['POST', 'PUT', 'DELETE', 'UPLOAD']) {
  test(`${method} 在401后恢复登录但不自动重发，等待用户再次确认`, async () => {
    const operation = method === 'UPLOAD' ? uploadFile('/test.png') : request({ url: '/api/write-fixture', method })
    const rejected = assert.rejects(operation, { code: 'AUTH_RETRY_REQUIRED' })
    const call = calls[0]; call.answered = true
    fail(call, 'TOKEN_EXPIRED', method === 'UPLOAD' ? 401 : 200); await flush()
    await finishRecovery(); await rejected
    assert.equal(calls.filter(item => item.url === call.url).length, 1)
    assert.equal(getSessionToken(), 'renewed-A'); assert.equal(navigations.length, 0)
  })
}

for (const reason of ['SESSION_REPLACED', 'SESSION_REVOKED', 'ACCOUNT_UNAVAILABLE', 'INVALID_CREDENTIAL']) {
  test(`${reason} 不静默重登，等待页面只导航一次，关闭重开也不自动覆盖会话`, async () => {
    const restore = restoreAccountSession()
    const first = request({ url: '/api/orders' }), second = request({ url: '/api/patients' })
    const rejected = Promise.all([assert.rejects(first, { code: 401, authReason: reason }), assert.rejects(second, { code: 401, authReason: reason })])
    await flush(); fail(take('/api/auth/session'), reason); assert.equal(await restore, false); await rejected
    assert.equal(logins.length, 0); assert.equal(navigations.length, 1)
    assert.equal(navigations[0].url, '/pages/login/login?redirect=%2Fpages%2Forder%2Forder-detail%3Fid%3D18')
    assert.equal(getSessionToken(), ''); assert.equal(isExplicitlyLoggedOut(), false)
    assert.equal(await restoreAccountSession({ retry: true }), false)
    assert.equal(logins.length, 0)
  })
}

test('恢复失败不触发公开页面跳转；未知401不靠短信、openid或旧接口兜底', async () => {
  const restore = restoreAccountSession(); await flush()
  fail(take('/api/auth/session'), undefined); assert.equal(await restore, false)
  assert.equal(navigations.length, 0); assert.equal(logins.length, 0)
})

test('网络和503不清除凭证，主动重试成功后再发送页面请求', async () => {
  for (const network of [false, true]) {
    beginSession('old-A'); calls = []
    const generation = getSessionGeneration(), restore = restoreAccountSession()
    const rejected = assert.rejects(restore); await flush()
    const check = take('/api/auth/session')
    if (network) check.fail({ errMsg: 'network failed' }); else reply(check, null, 503, 503)
    await rejected
    assert.equal(getSessionToken(), 'old-A'); assert.equal(getSessionGeneration(), generation)
    assert.equal(navigations.length, 0); assert.equal(logins.length, 0)
    const read = request({ url: '/api/orders' }); await flush()
    assert.equal(pending('/api/orders').length, 0)
    reply(take('/api/auth/session'), { userId: 7 }); await flush()
    reply(take('/api/orders'), []); await read
  }
})

for (const response of [
  { label: 'HTTP 200 空响应', http: 200, data: '' },
  { label: 'HTTP 404 接口不存在', http: 404, data: { code: 404, message: '请求资源不存在' } }
]) {
  test(`${response.label}：公开商品查询独立完成，受保护请求失败且保留原会话`, async () => {
    const generation = getSessionGeneration()
    const restore = restoreAccountSession(), rejected = assert.rejects(restore)
    const orders = request({ url: '/api/orders' }), ordersRejected = assert.rejects(orders)
    const products = getCategoryProducts(7, 2, 20, 1, 'price', 'asc', '测试商品')
      .then(data => ({ data }), error => ({ error }))
    await flush()
    const productRequest = pending(API_PATHS.CATEGORY.PRODUCTS)[0]
    if (productRequest) {
      productRequest.answered = true
      reply(productRequest, { records: [{ id: 10 }], total: 21 })
    }
    take('/api/auth/session').success({ statusCode: response.http, data: response.data })
    await Promise.all([rejected, ordersRejected])
    const outcome = await products
    assert.ok(productRequest, '登录校验未结束时，公开商品查询也应直接发出')
    assert.equal(productRequest.header.Authorization, undefined)
    assert.equal(productRequest.method, 'POST')
    assert.equal(productRequest.data.categoryId, 7)
    assert.equal(productRequest.data.pageNum, 2)
    assert.equal(productRequest.data.productCategory, 1)
    assert.equal(productRequest.data.keyword, '测试商品')
    assert.deepEqual(outcome.data, { records: [{ id: 10 }], total: 21 })
    assert.equal(getSessionToken(), 'old-A')
    assert.equal(getSessionGeneration(), generation)
    assert.equal(getAccountSessionState().status, 'unavailable')
    assert.equal(pending('/api/orders').length, 0)
    assert.equal(logins.length, 0)
    assert.equal(navigations.length, 0)

    // 已处于校验不可用状态时继续浏览，不重启认证，也不污染原认证状态。
    const nextPage = getCategoryProducts(7, 3, 20, 1)
    reply(take(API_PATHS.CATEGORY.PRODUCTS), { records: [], total: 21 })
    assert.deepEqual(await nextPage, { records: [], total: 21 })
    assert.equal(calls.filter(call => call.url.endsWith('/api/auth/session')).length, 1)
    assert.equal(getAccountSessionState().status, 'unavailable')
  })
}

test('制剂商品页实际加载链路不等待会话检查，空响应也不会清掉已显示商品', async () => {
  const restore = restoreAccountSession(), rejected = assert.rejects(restore, { code: 503 })
  const definition = loadOptions('pages/products/medicine_list.vue', {
    getApp: () => ({ globalData: { mallIntroPlayed: false } }),
    TabBar: {}, getExternalUseLabel() {}, getColdShippingLabel() {}, isSelfDevelopedProduct() {},
    getCategoryList, getCategoryProducts, buildCategoryTree, normalizeCategoryId,
    mapProductListItem: value => value, getCartEntries: () => ({}), loadCartItems: () => []
  })
  const page = { ...definition.data(), ...definition.methods,
    $set: (object, key, value) => { object[key] = value } }
  Object.entries(definition.computed).forEach(([key, getter]) =>
    Object.defineProperty(page, key, { get: () => getter.call(page) }))
  const load = page.loadProducts()
  reply(take(API_PATHS.CATEGORY.LIST), [{ id: 7, name: '测试分类', parentId: 0 }])
  await flush()
  const productRequest = take(API_PATHS.CATEGORY.PRODUCTS)
  assert.equal(productRequest.header.Authorization, undefined)
  const product = { id: 10, name: '测试商品', stock: 5 }
  reply(productRequest, { records: [product], total: 1 })
  await load
  assert.deepEqual(page.getPageState('all').records, [product])
  assert.equal(page.getPageState('all').loading, false)
  assert.equal(getAccountSessionState().status, 'checking')
  take('/api/auth/session').success({ statusCode: 200, data: '' })
  await rejected
  assert.deepEqual(page.getPageState('all').records, [product])
  assert.equal(getAccountSessionState().status, 'unavailable')
  assert.equal(getSessionToken(), 'old-A')
  assert.equal(navigations.length, 0)
  assert.equal(toasts.length, 0)
})

test('恢复超时有结束状态，迟到结果不能存凭证或继续业务请求', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const restore = restoreAccountSession({ reason: 'SESSION_MISSING' })
  const rejected = assert.rejects(restore, { code: 'AUTH_UNAVAILABLE' }); await flush()
  logins[0].success({ code: 'slow-code' }); await flush()
  const recovery = take('/api/auth/recover')
  mock.timers.tick(10000); await rejected
  assert.equal(recovery.aborted, true)
  reply(recovery, { token: 'late-token', userId: 7 }); await flush()
  assert.equal(getSessionToken(), 'old-A')
  assert.equal(getAccountSessionState().status, 'unavailable'); assert.equal(navigations.length, 0)
})

for (const change of ['logout', 'switch', 'manual']) {
  test(`${change} 使恢复中的微信回调失效，不重新登录或污染新账号`, async () => {
    const restore = restoreAccountSession({ reason: 'SESSION_MISSING' })
    const rejected = assert.rejects(restore, { code: 'SESSION_CHANGED' }); await flush()
    if (change === 'logout') endSession()
    else if (change === 'switch') beginSession('account-B')
    else cancelAccountRecovery()
    logins[0].success({ code: 'late-code' }); await rejected; await flush()
    assert.equal(calls.length, 0); assert.equal(navigations.length, 0)
    assert.equal(getSessionToken(), change === 'logout' ? '' : change === 'switch' ? 'account-B' : 'old-A')
    if (change === 'logout') assert.equal(await restoreAccountSession(), false)
  })
}

test('登录页在恢复完成后返回原入口，移除监听后不再导航', async () => {
  const restore = restoreAccountSession({ reason: 'SESSION_MISSING' })
  const options = loadOptions('pages/register/register.vue', { ID_TYPE_OPTIONS,
    STORAGE_KEY_AGREEMENT_ACCEPTED: 'agreed', onAccountSessionState, waitForSessionRecovery,
    getAccountSessionState, redirectToWithFallback: url => navigations.push({ url }) })
  const page = { ...options.data() }
  Object.entries(options.methods).forEach(([name, method]) => { page[name] = method.bind(page) })
  options.onLoad.call(page, { redirect: encodeURIComponent('/pages/order/order-detail?id=18') })
  assert.equal(page.waitingForRecovery, true)
  await flush(); await finishRecovery(); await restore
  assert.deepEqual(navigations, [{ url: '/pages/order/order-detail?id=18' }])
  assert.equal(page.waitingForRecovery, false)
  options.onUnload.call(page)
})

test('购物车角标和购物车页面共享读取，写操作前后的读取不能错误合并', async () => {
  const first = refreshCart(), same = refreshCart()
  assert.equal(first, same); await flush()
  const write = updateProductSelection('10:11', false), later = refreshCart()
  assert.notEqual(later, first)
  reply(take('/api/cart'), [cartItem()]); await first; await flush()
  assert.equal(getCartTotalQuantity(), 2)
  const update = take('/api/cart/items/10'); assert.equal(update.method, 'PUT'); assert.equal(update.data.checked, 0)
  reply(update, cartItem(0)); await write; await flush()
  reply(take('/api/cart'), [cartItem(0)]); await later
  assert.equal(calls.filter(call => call.url.endsWith('/api/cart')).length, 2)
  assert.equal(getCartTotalQuantity(), 2)
})

test('读取重试后再次401有上限，不陷入无限恢复', async () => {
  const read = request({ url: '/api/orders' }), rejected = assert.rejects(read, { code: 401 })
  fail(take('/api/orders'), 'TOKEN_EXPIRED'); await flush(); await finishRecovery()
  fail(take('/api/orders'), 'TOKEN_EXPIRED'); await rejected
  assert.equal(logins.length, 1); assert.equal(navigations.length, 1)
})

test('购买入口在恢复中等待，失败只提示重试，不把网络故障当成退出', async () => {
  const restore = restoreAccountSession(), rejected = assert.rejects(restore)
  const guard = requireAccountSession('/pages/cart/cart'); await flush()
  reply(take('/api/auth/session'), null, 503, 503); await rejected
  assert.equal(await guard, false)
  assert.equal(getSessionToken(), 'old-A'); assert.equal(navigations.length, 0)
})

test('个人页等待恢复被拒绝时结束加载，不滞留旧账号资料', async () => {
  const restore = restoreAccountSession()
  const page = loadSetup('pages/user/profile.vue', { ref: value => ({ value }), onMounted() {},
    waitForSessionRecovery, getSessionToken, getSessionGeneration, fetchAccountProfile,
    getOrderStats: async () => ({ pending: 0 }) }, ['loadUserProfile', 'userInfo', 'profileLoading', 'isLoggedIn'])
  const load = page.loadUserProfile(); assert.equal(page.profileLoading.value, true)
  await flush(); fail(take('/api/auth/session'), 'SESSION_REPLACED')
  await restore; await load
  assert.equal(page.profileLoading.value, false); assert.equal(page.isLoggedIn.value, false)
  assert.equal(page.userInfo.value.realName, '')
})

test('支付准备先等待已有登录恢复，再获取专用新微信code，预支付只发一次', async () => {
  const restore = restoreAccountSession({ reason: 'SESSION_MISSING' })
  const payment = createPrepay('wechat', 18)
  await flush(); assert.equal(logins.length, 1)
  await finishRecovery(); await restore
  assert.equal(logins.length, 2)
  logins[1].success({ code: 'fresh-payment-code' }); await flush()
  const prepay = take('/api/payment/single/create-by-order/18')
  assert.equal(prepay.header.Authorization, 'Bearer renewed-A')
  assert.equal(prepay.data.wechatCode, 'fresh-payment-code')
  reply(prepay, { payParams: {} }); await payment
  assert.equal(calls.filter(call => call.url.endsWith('/api/payment/single/create-by-order/18')).length, 1)
})

test('恢复请求已发出后切换账号，迟到成功不能覆盖手动登录', async () => {
  const restore = restoreAccountSession({ reason: 'SESSION_MISSING' })
  const rejected = assert.rejects(restore, { code: 'SESSION_CHANGED' }); await flush()
  logins[0].success({ code: 'late-recovery-code' }); await flush()
  const recovery = take('/api/auth/recover')
  beginSession('account-B'); await rejected
  reply(recovery, { token: 'late-A', userId: 7 }); await flush()
  assert.equal(getSessionToken(), 'account-B'); assert.equal(navigations.length, 0)
})

test('实际商品页登录入口等待恢复，不提前打开注册页', async () => {
  const page = loadOptions('pages/products/medicine_list.vue', {
    requireAccountSession, TabBar: {}, getExternalUseLabel() {}, getColdShippingLabel() {}, isSelfDevelopedProduct() {}
  })
  const restore = restoreAccountSession({ reason: 'SESSION_MISSING' })
  const guard = page.methods.ensureLogin.call({ buildListRedirect: () => '/pages/products/medicine_list' })
  await flush(); assert.equal(navigations.length, 0)
  await finishRecovery(); await restore
  assert.equal(await guard, true); assert.equal(navigations.length, 0)
})

test('手动登录期间 App 回到前台不重启自动恢复，成功后直接使用已验证会话', async () => {
  const restore = restoreAccountSession({ reason: 'SESSION_MISSING' })
  const rejected = assert.rejects(restore, { code: 'SESSION_CHANGED' }); await flush()
  const finishManualLogin = beginManualAccountLogin(); await rejected
  const app = loadOptions('App.vue', { restoreAccountSession, getAccountSessionState })
  app.onShow.call(app); await flush()
  assert.equal(logins.length, 1); assert.equal(calls.length, 0)
  establishAccountSession({ token: 'manual-A', userId: 7 })
  finishManualLogin()
  assert.equal(getAccountSessionState().status, 'authenticated')
  app.onShow.call(app); await flush()
  assert.equal(calls.length, 0)
  logins[0].success({ code: 'late-old-code' }); await flush()
  assert.equal(getSessionToken(), 'manual-A'); assert.equal(navigations.length, 0)
})
