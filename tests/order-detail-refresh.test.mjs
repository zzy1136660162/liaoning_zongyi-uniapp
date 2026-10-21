import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { loadOptions } from './sfc-harness.mjs'
import * as doctors from '../utils/consultation-mode.js'
import * as context from '../utils/consultation-checkout.js'
import * as vouchers from '../utils/order-redeem-vouchers.js'
import * as status from '../utils/order-status.js'
import * as therapy from '../utils/therapy.js'
import { getRefundStageText } from '../utils/refund.js'
import { get as httpGet } from '../utils/request.js'

const loadApi = (file, name, get) => {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    .replace(/^[ \t]*import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '').replace(/^export /gm, '')
  const paths = Object.fromEntries(['PRODUCT', 'DOCTOR', 'PRESCRIPTION', 'CONSULTATION', 'ORDER']
    .map(key => [key, { DETAIL: id => `/fixture/${id}`, LIST: '/fixture' }]))
  return Function('get', 'API_PATHS', 'getToken', `${source}\nreturn ${name}`)(get, paths, () => 'fixture-token')
}

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
const item = redeemed => ({ id: 200, productId: 300, productName: '测试疗法', productImage: '/fixture.png',
  price: 10, quantity: 1, redeemRequiredSnapshot: 1,
  redeemVouchers: [{ id: 400, redeemStatus: redeemed, verifyCode: redeemed ? '' : 'FIXTURE1' }] })
const order = redeemed => ({ id: 100, orderStatus: redeemed ? 3 : 1, orderType: 4,
  payStatus: 1, redeemStatus: redeemed, refundStatus: 0, payableAmount: 10, items: [item(redeemed)] })
const createDetail = (kind = 'order', overrides = {}) => {
  let generation = 1
  const calls = [], toasts = [], loading = []
  const definition = loadOptions(kind === 'order' ? 'pages/order/order-detail.vue' : 'pages/order/refund_detail.vue', {
    ...doctors, ...context, ...vouchers, ...status, ...therapy, getRefundStageText,
    getSessionGeneration: () => generation, isCurrentSession: value => value === generation,
    getImageUrl: value => value, console: { debug() {}, error() {}, warn() {} },
    uni: { showLoading: () => loading.push('show'), hideLoading: () => loading.push('hide'),
      showToast: value => toasts.push(value) },
    [kind === 'order' ? 'getOrderDetail' : 'getRefundDetail']: (id, options) => {
      const request = deferred(); calls.push({ ...request, id, options }); return request.promise
    },
    ...overrides
  })
  const state = { ...definition.data(), ...definition.methods }
  for (const [name, getter] of Object.entries(definition.computed || {})) Object.defineProperty(state, name, { get: () => getter.call(state) })
  if (kind === 'order') {
    state.order.diagnosis = '已加载诊断'
    state.order.doctorName = '已加载医生'
  } else state.refundApplicationId = 100
  return { state, calls, toasts, loading, definition,
    load: () => kind === 'order' ? state.loadOrderDetail(100) : state.loadDetail(),
    unload: () => definition.onUnload.call(state), changeSession: () => { generation++ } }
}

for (const kind of ['order', 'refund']) {
  const response = fresh => kind === 'order' ? order(fresh ? 1 : 0)
    : { status: fresh ? 4 : 1, paymentRefundStatus: fresh ? 'SUCCESS' : 'PENDING', refundScene: 'GOODS_RETURN' }
  const checkFresh = state => kind === 'order'
    ? assert.equal(state.allCartItems[0].redeemVouchers[0].verifyCode, '')
    : assert.equal(state.detail.paymentRefundStatus, 'SUCCESS')

  test(`${kind}详情新响应先到后，旧成功或失败均不覆盖状态或弹出错误`, async () => {
    for (const rejectOld of [false, true]) {
      const { state, calls, load, toasts, loading } = createDetail(kind)
      const old = load(), latest = load()
      calls[1].resolve(response(true)); await latest
      const snapshot = JSON.stringify(kind === 'order' ? [state.order, state.allCartItems] : state.detail)
      const loadingBefore = loading.length
      if (rejectOld) calls[0].reject(new Error('old failure'))
      else calls[0].resolve(response(false))
      await old
      assert.equal(JSON.stringify(kind === 'order' ? [state.order, state.allCartItems] : state.detail), snapshot)
      checkFresh(state)
      assert.equal(toasts.length, 0)
      assert.equal(loading.length, loadingBefore)
      assert.deepEqual(calls.map(call => call.options), [
        { showLoading: false, silent: true }, { showLoading: false, silent: true }
      ])
    }
  })

  test(`${kind}详情新请求仍等待时，旧请求结束不能关闭加载提示`, async () => {
    const { state, calls, load, loading } = createDetail(kind)
    const old = load(), latest = load()
    calls[0].resolve(response(false)); await old
    assert.deepEqual(loading, ['show', 'show'])
    calls[1].resolve(response(true)); await latest
    assert.deepEqual(loading, ['show', 'show', 'hide'])
    checkFresh(state)
  })

  test(`${kind}详情退出或切换账号后，迟到响应不改数据、不弹提示、不操作其他页面加载框`, async () => {
    for (const invalidation of ['unload', 'session']) {
      for (const reject of [false, true]) {
        const { state, calls, load, unload, changeSession, loading, toasts } = createDetail(kind)
        const pending = load()
        const snapshot = JSON.stringify(kind === 'order' ? state.order : state.detail)
        if (invalidation === 'unload') unload()
        else changeSession()
        const loadingBefore = loading.length
        if (reject) calls[0].reject(new Error('late failure'))
        else calls[0].resolve(response(false))
        await pending
        assert.equal(JSON.stringify(kind === 'order' ? state.order : state.detail), snapshot)
        assert.equal(loading.length, loadingBefore)
        assert.equal(toasts.length, 0)
        await load()
        assert.equal(calls.length, 1)
      }
    }
  })

  test(`${kind}详情当前请求失败仍提示错误并结束加载，再次刷新可恢复`, async () => {
    const { calls, load, state, toasts, loading } = createDetail(kind)
    const failed = load()
    calls[0].reject(new Error('current failure')); await failed
    assert.equal(toasts.length, 1)
    assert.equal(loading.at(-1), 'hide')
    const retried = load()
    calls[1].resolve(response(true)); await retried
    checkFresh(state)
  })
}

test('订单各类商品、医生、处方补充请求也受同一加载代次约束', async () => {
  for (const scenario of ['diagnosis', 'product', 'product-doctor', 'prescription', 'prescription-doctor', 'consultation', 'prescription-context']) {
    const late = deferred()
    let productCalls = 0, doctorCalls = 0, prescriptionCalls = 0, consultationCalls = 0
    const { state, calls, load } = createDetail('order', {
      getProductDetail: async (id, options) => {
        assert.deepEqual(options, { showLoading: false, silent: true }); productCalls++
        return ['diagnosis', 'product'].includes(scenario) ? late.promise : { id }
      },
      getDoctorDetail: async (id, options) => {
        assert.deepEqual(options, { showLoading: false, silent: true }); doctorCalls++
        return ['product-doctor', 'prescription-doctor'].includes(scenario) ? late.promise : null
      },
      getPrescriptionDetail: async (id, options) => {
        assert.deepEqual(options, { showLoading: false, silent: true }); prescriptionCalls++
        return scenario === 'prescription' ? late.promise : { id, doctorId: 100, consultationId: 800 }
      },
      getConsultationDetail: async (id, options) => {
        assert.deepEqual(options, { showLoading: false, silent: true }); consultationCalls++
        return late.promise
      }
    })
    state.allCartItems = [{ id: 300, image: '/fixture.png' }]
    if (scenario === 'product-doctor') state.order.doctorId = 100
    const old = scenario === 'diagnosis' ? state.enrichDiagnosisFromAllProducts()
      : ['product', 'product-doctor'].includes(scenario) ? state.enrichByProduct(300)
        : scenario === 'prescription-context' ? state.fillPrescriptionInfo(700) : state.applyDoctorFromPrescription(700)
    await flush()
    assert.ok(productCalls + doctorCalls + prescriptionCalls + consultationCalls > 0)
    const latest = load()
    calls[0].resolve(order(1)); await latest
    const before = JSON.stringify([state.order, state.allCartItems, state.prescriptionInfoLoaded])
    late.resolve({ id: 700, doctorId: 100, doctorName: '旧医生', name: '旧医生', prescriptionDiagnosis: '旧诊断',
      diagnosis: '旧诊断', patientId: 88, patientName: '旧就诊人', coverImage: '/old.png' })
    await old
    assert.equal(JSON.stringify([state.order, state.allCartItems, state.prescriptionInfoLoaded]), before, scenario)
  }
})

test('订单主加载等待医生详情时失效，不继续写入旧订单商品', async () => {
  const doctor = deferred()
  const { state, calls, load } = createDetail('order', { getDoctorDetail: () => doctor.promise })
  const old = load()
  calls[0].resolve({ ...order(0), doctorId: 100 }); await flush()
  const latest = load()
  calls[1].resolve(order(1)); await latest
  doctor.resolve({ name: '旧医生' }); await old
  assert.equal(state.order.redeemStatus, 1)
  assert.equal(state.allCartItems[0].redeemVouchers[0].verifyCode, '')
  assert.notEqual(state.order.doctorName, '旧医生')
})

test('详情补充接口可关闭公共加载框，默认调用方式和鉴权保持兼容', async () => {
  for (const [file, name, needAuth] of [
    ['api/product.js', 'getProductDetail', false], ['api/hospital.js', 'getDoctorDetail', false],
    ['api/consultation.js', 'getPrescriptionDetail', true], ['api/consultation.js', 'getConsultationDetail', true],
    ['api/refund.js', 'getRefundDetail', true], ['api/order.js', 'getOrderDetail', true]
  ]) {
    const requests = []
    const fn = loadApi(file, name, (url, params, options) => { requests.push({ url, options }); return Promise.resolve({}) })
    await fn(100); await fn(100, { showLoading: false, silent: true })
    assert.deepEqual(requests.map(request => request.options.showLoading), [true, false], name)
    assert.deepEqual(requests.map(request => Boolean(request.options.silent)), [false, true], name)
    assert.ok(requests.every(request => request.options.needAuth === needAuth), name)
    if (name === 'getProductDetail') assert.equal(requests[1].options.header.Authorization, 'Bearer fixture-token')
  }
})

test('真实公共请求层收到旧 HTTP 错误时不会越过页面保护弹错或关闭最新 Loading', async () => {
  const previousUni = globalThis.uni
  try {
    for (const kind of ['order', 'refund']) {
      const requests = [], ui = []
      const uni = { getStorageSync: () => 'fixture-token', request: options => requests.push(options),
        showLoading: () => ui.push('show'), hideLoading: () => ui.push('hide'), showToast: () => ui.push('toast') }
      globalThis.uni = uni
      const name = kind === 'order' ? 'getOrderDetail' : 'getRefundDetail'
      const file = kind === 'order' ? 'api/order.js' : 'api/refund.js'
      const { load } = createDetail(kind, { uni, [name]: loadApi(file, name, httpGet) })
      const old = load(), latest = load()
      requests[0].success({ statusCode: 500, data: { code: 500 } }); await old
      assert.deepEqual(ui, ['show', 'show'])
      requests[1].success({ statusCode: 500, data: { code: 500 } }); await latest
      assert.deepEqual(ui, ['show', 'show', 'toast', 'hide'])
    }
  } finally {
    globalThis.uni = previousUni
  }
})
