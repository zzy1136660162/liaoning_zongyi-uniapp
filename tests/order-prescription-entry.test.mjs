import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { loadOptions } from './sfc-harness.mjs'
import * as doctors from '../utils/consultation-mode.js'
import * as context from '../utils/consultation-checkout.js'
import * as vouchers from '../utils/order-redeem-vouchers.js'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}

// 执行订单页面本身的计算属性和点击方法，只替换请求与小程序导航边界。
// 每个请求由测试主动完成，便于确认刷新等待、成功和失败时入口的变化。
const createDetail = () => {
  const requests = [], routes = [], toasts = []
  const definition = loadOptions('pages/order/order-detail.vue', {
    ...doctors, ...context, ...vouchers,
    getSessionGeneration: () => 1, isCurrentSession: value => value === 1,
    getImageUrl: value => value, console: { debug() {}, error() {}, warn() {} },
    getOrderDetail: () => {
      const request = deferred(); requests.push(request); return request.promise
    },
    getPrescriptionDetail: async id => ({ id, diagnosis: '处方诊断' }),
    getProductDetail: async id => ({ id, prescriptionDiagnosis: '商品说明' }),
    uni: { showLoading() {}, hideLoading() {}, showToast: value => toasts.push(value),
      navigateTo: value => routes.push(value.url) }
  })
  const state = { ...definition.data(), ...definition.methods }
  for (const [name, getter] of Object.entries(definition.computed)) {
    Object.defineProperty(state, name, { get: () => getter.call(state) })
  }
  state.order.id = 100
  state.order.diagnosis = '已有诊断'
  state.order.doctorName = '已有医生'
  return { state, requests, routes, toasts, load: () => state.loadOrderDetail(100) }
}

const order = (prescriptionId, categories = [1]) => ({
  id: 100, prescriptionId, orderStatus: 1, payStatus: 1, payableAmount: 10,
  items: categories.map((category, index) => ({ id: index + 1, productId: index + 10,
    productCategorySnapshot: category, productName: '测试商品', productImage: '/fixture.png',
    price: 10, quantity: 1 }))
})

test('无有效处方关联时隐藏入口，直接调用点击方法也不能用订单 ID 跳转', () => {
  const { state, routes, toasts } = createDetail()
  state.orderLoaded = true
  // 订单 ID 始终存在；这些值都不能成为通过订单 ID 兜底打开处方页的理由。
  const invalidIds = [null, undefined, '', 0, '0', -1, '-1', 'abc', 'null', 'undefined', '1.5']
  for (const id of invalidIds) {
    state.order.prescriptionId = id
    assert.equal(state.canViewPrescription, false, `无效处方 ID：${String(id)}`)
    assert.equal(state.resolvePrescriptionNavigationParams(), '')
    state.handleView()
  }
  assert.deepEqual(routes, [])
  assert.equal(toasts.length, invalidIds.length)
  assert.ok(toasts.every(toast => toast.title === '暂无关联处方'))
})

test('接口返回数字或字符串形式的有效处方 ID 时，入口打开对应的真实处方', () => {
  for (const id of [7, '8']) {
    const { state, routes, toasts } = createDetail()
    state.orderLoaded = true
    state.order.prescriptionId = id
    assert.equal(state.canViewPrescription, true)
    state.handleView()
    assert.deepEqual(routes, [`/pages/prescription/detail?prescriptionId=${id}`])
    assert.deepEqual(toasts, [])
  }
})

test('纯单、混合订单和缺少分类快照的历史订单统一按实际处方关联决定入口', async () => {
  // 包含制剂不代表已经取得处方；历史分类为空也不能隐藏已有关联的处方。
  for (const categories of [[1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3], [null]]) {
    for (const prescriptionId of [null, 7]) {
      const { state, requests, routes, load } = createDetail()
      const pending = load()
      requests[0].resolve(order(prescriptionId, categories)); await pending
      assert.equal(state.canViewPrescription, prescriptionId !== null,
        `分类 ${categories.join('+')}，处方 ${prescriptionId}`)
      state.handleView()
      assert.equal(routes.length, prescriptionId !== null ? 1 : 0)
    }
  }
})

test('刷新响应不再包含处方时清除旧关联，避免按钮继续指向上次的处方', async () => {
  for (const emptyId of [null, undefined, '', 0]) {
    const { state, requests, routes, load } = createDetail()
    const initial = load()
    requests[0].resolve(order(7)); await initial
    assert.equal(state.canViewPrescription, true)

    const refreshed = load()
    requests[1].resolve(order(emptyId, [2, 3])); await refreshed
    assert.equal(state.order.prescriptionId, null)
    assert.equal(state.canViewPrescription, false)
    state.handleView()
    assert.deepEqual(routes, [])
  }
})

test('首次加载和刷新等待期间隐藏处方入口，收到有效订单后才恢复', async () => {
  const { state, requests, routes, load } = createDetail()
  state.order.prescriptionId = 7
  assert.equal(state.canViewPrescription, false, '首次加载未完成')
  state.orderLoaded = true
  assert.equal(state.canViewPrescription, true)
  const pending = load()
  assert.equal(state.canViewPrescription, false, '刷新等待期间不能使用旧关联')
  state.handleView()
  assert.deepEqual(routes, [])
  requests[0].resolve(order(8)); await pending
  assert.equal(state.canViewPrescription, true)
  state.handleView()
  assert.deepEqual(routes, ['/pages/prescription/detail?prescriptionId=8'])
})

test('刷新失败后即使内存仍有旧处方 ID，也不能显示入口或跳转', async () => {
  const { state, requests, routes, toasts, load } = createDetail()
  state.orderLoaded = true
  state.order.prescriptionId = 7
  const pending = load()
  requests[0].reject(new Error('模拟订单查询失败')); await pending
  assert.equal(state.canViewPrescription, false)
  assert.equal(toasts[0].title, '订单加载失败，请重试')
  state.handleView()
  assert.deepEqual(routes, [])
  assert.equal(toasts.at(-1).title, '暂无关联处方')
})

test('处方按钮绑定实际关联判断，并使用明确的“查看处方”文案', () => {
  // 行为测试之外确认模板接入了同一判断，避免只修方法而仍展示无效按钮。
  const source = readFileSync(new URL('../pages/order/order-detail.vue', import.meta.url), 'utf8')
  const button = source.match(/<button\b[^>]*@tap="handleView"[^>]*>([\s\S]*?)<\/button>/)
  assert.ok(button, '应保留查看处方按钮')
  assert.match(button[0], /v-if="canViewPrescription"/)
  assert.equal(button[1].trim(), '查看处方')
})
