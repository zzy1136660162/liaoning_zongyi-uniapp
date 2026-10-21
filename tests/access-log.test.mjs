import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test, beforeEach } from 'node:test'
import { logAccess, logPageView, logButtonClick, getActionFailureResult } from '../utils/accessLog.js'
import { request } from '../utils/request.js'
import { beginSession, endSession, getSessionToken } from '../utils/session.js'

const { parse } = createRequire(import.meta.url)('espree')
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
let calls, storage
const pageLog = {
  moduleCode: 'MALL', accessType: '健康商城', pageType: 'MEDICINE_DETAIL', pageId: '123',
  actionCode: 'VIEW_PAGE', accessTitle: '浏览制剂商品详情', accessDescription: '进入制剂商品详情，查看商品及购买入口',
  requestUri: '/pages/products/medicine_detail', extraData: { skuId: 7 }
}
beforeEach(() => {
  calls = []; storage = new Map()
  globalThis.getCurrentPages = () => [{ route: 'pages/products/medicine_list' }, { route: 'pages/products/medicine_detail' }]
  globalThis.uni = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key),
    getSystemInfoSync: () => ({ platform: 'test' }), request: options => calls.push(options),
    hideLoading() {}, showLoading() {}, $emit() {}, showToast() { throw new Error('日志不得弹窗') }, reLaunch() { throw new Error('日志不得跳转') }
  }
  beginSession('fixture-token')
})

test('每次显式显示均发送一条完整页面日志，快速返回不被时间缓存吞掉', () => {
  logPageView(pageLog); logPageView(pageLog)
  assert.equal(calls.length, 2)
  for (const call of calls) {
    assert.ok(call.url.endsWith('/api/access-log'))
    assert.equal(call.data.actionType, 'PAGE_VIEW')
    for (const field of ['moduleCode', 'accessType', 'pageType', 'pageId', 'actionCode', 'accessTitle', 'accessDescription', 'requestUri']) assert.equal(call.data[field], pageLog[field])
    assert.equal(call.header.Authorization, 'Bearer fixture-token')
    assert.deepEqual(JSON.parse(call.data.extraData), { skuId: 7 })
    assert.equal(call.data.referer, '/pages/products/medicine_list')
    assert.ok(!('userId' in call.data))
  }
})

test('源页面显式上下文在跳转后保持正确；按钮与结果类别不混淆', () => {
  globalThis.getCurrentPages = () => [{ route: 'pages/order/confirm' }]
  logButtonClick({ ...pageLog, actionCode: 'BUY_PRODUCT' })
  logAccess({ ...pageLog, actionType: 'BEHAVIOR', actionCode: 'BUY_PRODUCT', actionResult: 'CANCELLED' })
  assert.deepEqual(calls.map(call => call.data.actionType), ['BUTTON_CLICK', 'BEHAVIOR'])
  assert.ok(calls.every(call => call.data.requestUri === pageLog.requestUri))
  assert.equal(calls[1].data.actionResult, 'CANCELLED')
})

test('不支持的事件和旧位置参数不发送；日志失败、失效凭证及存储失败不影响业务', () => {
  logAccess({ ...pageLog, actionType: 'API_CALL' }); logPageView('MEDICINE_DETAIL')
  logPageView({ ...pageLog, accessDescription: '' })
  logPageView({ ...pageLog, extraData: { text: 'x'.repeat(9000) } })
  assert.equal(calls.length, 0)
  logPageView(pageLog)
  calls[0].fail({ errMsg: 'synthetic private error' })
  calls[0].success?.({ statusCode: 401, data: { code: 401 } })
  assert.equal(getSessionToken(), 'fixture-token')
  assert.equal(calls.length, 1)
  uni.getStorageSync = () => { throw new Error('storage unavailable') }
  assert.doesNotThrow(() => logPageView(pageLog))
  assert.equal(calls.length, 2)
  uni.request = () => { throw new Error('request unavailable') }
  assert.doesNotThrow(() => logPageView(pageLog))
})

test('访客可记录页面访问；业务请求成功不产生API_CALL或日志自记录', async () => {
  endSession(); logPageView(pageLog)
  assert.equal(calls[0].header.Authorization, undefined)
  const response = request({ url: '/api/products/123', showLoading: false })
  assert.equal(calls.length, 2)
  calls[1].success({ statusCode: 200, data: { code: 200, data: { id: 123 } } })
  assert.deepEqual(await response, { id: 123 })
  assert.equal(calls.length, 2)
})

test('明确取消、业务拒绝和未知网络结果分别分类', () => {
  assert.equal(getActionFailureResult(new Error('用户取消支付')), 'CANCELLED')
  assert.equal(getActionFailureResult({ errMsg: 'requestPayment:fail cancel' }), 'CANCELLED')
  assert.equal(getActionFailureResult({ code: 409 }), 'FAILED')
  for (const error of [{ code: 500 }, { statusCode: 504 }, { code: 408 }, new Error('timeout'), undefined]) assert.equal(getActionFailureResult(error), 'UNKNOWN')
})

const walk = (node, visit, ancestors = []) => {
  if (!node || typeof node !== 'object') return
  if (node.type) visit(node, ancestors)
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) child.forEach(value => walk(value, visit, [...ancestors, node]))
    else if (child && typeof child === 'object') walk(child, visit, [...ancestors, node])
  }
}

test('pages.json的全部33页具有唯一onShow访问入口，逐页执行日志对象通过发送合同', () => {
  const config = JSON.parse(read('pages.json'))
  const routes = [...config.pages.map(page => page.path), ...config.subPackages.flatMap(group => group.pages.map(page => `${group.root}/${page.path}`))]
  assert.equal(routes.length, 33)
  const value = new Proxy(() => value, { get: (_, key) => key === Symbol.toPrimitive ? () => '123' : key === 'toJSON' ? () => '123' : key === 'length' ? 1 : value, apply: () => value })
  for (const route of routes) {
    const script = read(`${route}.vue`).match(/<script\b[^>]*>([\s\S]*?)<\/script>/)[1]
    const tree = parse(script, { ecmaVersion: 'latest', sourceType: 'module', range: true })
    let base, pageCall
    const identifiers = new Set()
    walk(tree, (node, ancestors) => {
      if (node.type === 'VariableDeclarator' && node.id.name === 'PAGE_LOG') base = Function(`return (${script.slice(...node.init.range)})`)()
      if (node.type !== 'CallExpression' || !['logPageView', 'logButtonClick', 'logAccess'].includes(node.callee.name)) return
      assert.equal(node.arguments.length, 1, `${route}: 仅使用对象参数`)
      assert.ok(['ObjectExpression', 'Identifier'].includes(node.arguments[0].type), `${route}: 使用对象或对象变量`)
      if (node.callee.name !== 'logPageView') return
      assert.ok(!pageCall, `${route}: 页面访问入口不得重复`)
      assert.ok(ancestors.some(parent => parent.type === 'CallExpression' && parent.callee.name === 'onShow' || parent.type === 'Property' && parent.key.name === 'onShow'), `${route}: 访问只在onShow记录`)
      pageCall = node
      walk(node.arguments[0], child => { if (child.type === 'Identifier') identifiers.add(child.name) })
    })
    assert.ok(base && pageCall, `${route}: 不能遗漏注册页面`)
    assert.equal(base.requestUri, '/' + route)
    const names = [...identifiers].filter(name => !['PAGE_LOG', 'String', 'Number', 'Boolean', 'Object', 'Array', 'JSON', 'undefined'].includes(name))
    const object = Function('PAGE_LOG', ...names, `return (${script.slice(...pageCall.arguments[0].range)})`).call(value, base, ...names.map(() => value))
    const before = calls.length
    logPageView(object); logPageView(object)
    assert.equal(calls.length, before + 2, `${route}: 完整中文对象必须能发送，重复显示不能被吞掉`)
    const data = calls.at(-1).data
    assert.equal(data.requestUri, '/' + route)
    assert.match(data.moduleCode, /^[A-Z][A-Z0-9_]*$/)
    assert.match(data.actionCode, /^[A-Z][A-Z0-9_]*$/)
    for (const field of ['accessType', 'accessTitle', 'accessDescription']) assert.match(data[field], /[\u4e00-\u9fff]/, `${route}: ${field}须可读`)
  }
  assert.doesNotMatch(read('main.js'), /mixin|trackCurrentPageVisit/)
  assert.doesNotMatch(read('utils/request.js'), /logApiAccess|API_CALL/)
})
