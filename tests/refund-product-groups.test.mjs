import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { canOrderApplyRefund, hasMixedTherapyAndNormalRefundItems, isTherapyRefundItem } from '../utils/refund.js'
import { loadOptions, loadSetup } from './sfc-harness.mjs'

const item = (category, extra = {}) => ({
  id: category, productId: category + 100, productName: `商品${category}`, price: 10,
  quantity: 5, productCategorySnapshot: category, redeemRequiredSnapshot: category === 3 ? 1 : 0,
  redeemedQuantity: 0, refundFrozenQuantity: 0, refundedQuantity: 0, refundableQuantity: 5,
  refundable: true, redeemVouchers: [], ...extra
})
const order = items => ({ id: 9, orderNo: 'fixture', orderStatus: 1, payStatus: 1, paymentFulfillmentStatus: 'READY', items })

const createApply = (mocks = {}) => {
  const calls = [], notices = []
  const options = loadOptions('pages/order/refund_apply.vue', {
    getSessionGeneration: () => 1, isCurrentSession: () => true, assertCurrentSession() {},
    setTimeout() {}, console: { error() {}, info() {}, warn() {} },
    checkCanApplyRefund: async () => true,
    getOrderDetail: async () => order([item(3)]),
    applyRefund: async data => { calls.push(structuredClone(data)) },
    uni: { showLoading() {}, hideLoading() {}, showModal() {}, showToast: value => notices.push(value.title) },
    ...mocks
  })
  const state = { ...options.data(), ...options.methods, orderId: 9 }
  for (const [name, getter] of Object.entries(options.computed)) {
    Object.defineProperty(state, name, { get: () => getter.call(state) })
  }
  return { state, calls, notices, options }
}

for (const categories of [[1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]]) {
  test(`购买组合${categories.join('+')}只预选同一退款组，一次确认只发一笔请求`, async () => {
    const { state, calls } = createApply()
    state.applyOrderData(order(categories.map(category => item(category))))
    const selected = state.allProducts.filter(product => product.selectedQuantity > 0)
    assert.equal(hasMixedTherapyAndNormalRefundItems(selected, state.orderInfo), false)
    assert.equal(state.refundGroups.length, categories.includes(3) && categories.length > 1 ? 2 : 1)
    state.selectReason(state.reasonOptions[0])
    await state.submitRefund()
    assert.equal(calls.length, 1)
    const selectedIds = calls[0].items.map(product => product.orderItemId)
    assert.deepEqual(selectedIds, categories.filter(category => state.activeRefundGroup === 'THERAPY' ? category === 3 : category !== 3))
    assert.equal(calls[0].refundType, selectedIds.length === categories.length ? 1 : 2)
  })
}

test('疗法买5用2可选3次，已占退款次数与已用次数单独展示并保留服务端上限', () => {
  const { state } = createApply()
  state.applyOrderData(order([item(3, { redeemedQuantity: 2, refundableQuantity: 3 })]))
  assert.equal(state.activeRefundGroup, 'THERAPY')
  assert.equal(state.visibleProducts[0].selectedQuantity, 3)
  assert.equal(state.visibleProducts[0].redeemedQuantity, 2)
  assert.equal(state.refundAmount, 30)
  state.applyOrderData(order([item(3, { redeemedQuantity: 2, refundFrozenQuantity: 1, refundedQuantity: 1, refundableQuantity: 2 })]))
  assert.equal(state.visibleProducts[0].selectedQuantity, 2)
  assert.equal(state.visibleProducts[0].refundFrozenQuantity, 1)
  assert.equal(state.visibleProducts[0].refundedQuantity, 1)
  const source = readFileSync(new URL('../pages/order/refund_apply.vue', import.meta.url), 'utf8')
  assert.match(source, /已用 \{\{ item\.redeemedQuantity \}\} 次/)
  assert.match(source, /退款中 \{\{ item\.refundFrozenQuantity \}\}/)
})

test('退款分组认购买快照，不因当前商品分类变化或缺少券列表误判', () => {
  assert.equal(isTherapyRefundItem(item(3, { productCategory: 2 })), true)
  assert.equal(isTherapyRefundItem(item(2, { productCategory: 3, redeemVouchers: [{ redeemStatus: 0 }] })), false)
  assert.equal(isTherapyRefundItem({ productCategorySnapshot: 3 }), true)
  assert.equal(isTherapyRefundItem({ redeemVouchers: [{ redeemStatus: 1 }] }), true)
  assert.equal(isTherapyRefundItem({}, { orderType: 4 }), true)
})

test('切换退款组只选择当前组并重选原因，疗法原因不混入包装物流问题', () => {
  const { state } = createApply()
  state.applyOrderData(order([item(1), item(2), item(3)]))
  state.selectReason('包装损坏')
  state.selectRefundGroup('THERAPY')
  assert.deepEqual(state.allProducts.map(product => product.selectedQuantity), [0, 0, 5])
  assert.equal(state.form.refundReason, '')
  assert.equal(state.reasonOptions.includes('包装损坏'), false)
  state.selectRefundGroup('PHYSICAL')
  assert.deepEqual(state.allProducts.map(product => product.selectedQuantity), [5, 5, 0])
})

test('返回页刷新后减少可退数量或归零，保留低于新上限的选择，不自动选中新增明细', async () => {
  const { state, notices, calls } = createApply()
  state.applyOrderData(order([item(3)]))
  state.decreaseQuantity(state.allProducts[0])
  state.applyOrderData(order([item(3, { refundableQuantity: 2 })]))
  assert.equal(state.allProducts[0].selectedQuantity, 2)
  state.applyOrderData(order([item(3, { refundableQuantity: 0 }), item(3, { id: 33 })]))
  assert.deepEqual(state.allProducts.map(product => product.selectedQuantity), [0, 0])
  assert.equal(state.canSubmit, true)
  await state.submitRefund()
  assert.equal(notices.at(-1), '请选择退款商品')
  assert.equal(calls.length, 0)
  assert.equal(notices.filter(text => text.includes('数量已变化')).length, 2)
})

test('超时保存请求快照，锁定编辑和刷新；原样重试成功后不重复提交', async () => {
  const sent = []
  let refreshed = 0
  const { state, options } = createApply({
    getOrderDetail: async () => { refreshed++; return order([item(3)]) },
    applyRefund: async data => {
      sent.push(structuredClone(data))
      if (sent.length === 1) throw new Error('network timeout')
    }
  })
  state.applyOrderData(order([item(1), item(3)]))
  state.selectReason(state.reasonOptions[0])
  state.form.refundImages.push('/fixture.jpg')
  await state.submitRefund()
  assert.equal(state.formLocked, true)
  state.selectRefundGroup('THERAPY')
  state.decreaseQuantity(state.allProducts[0])
  state.selectReason('其他')
  state.removeImage(0)
  assert.equal(state.activeRefundGroup, 'PHYSICAL')
  assert.equal(state.allProducts[0].selectedQuantity, 5)
  assert.equal(state.form.refundReason, sent[0].refundReason)
  assert.deepEqual(state.form.refundImages, ['/fixture.jpg'])
  options.onShow.call(state)
  await state.loadOrderDetail()
  assert.equal(refreshed, 0)
  // 即使外部数据变化，也只能重试保存的原请求，不能改变同一幂等编号的含义。
  state.allProducts[0].selectedQuantity = 1
  state.form.refundImages.push('/other.jpg')
  state.form.refundDescription = 'changed'
  await state.submitRefund()
  assert.deepEqual(sent[0], sent[1])
  assert.equal(state.submitted, true)
  await state.submitRefund()
  assert.equal(sent.length, 2)
})

test('明确拒绝后刷新可退数量并换用新编号，避免新内容复用旧请求', async () => {
  let refreshed = 0
  const { state } = createApply({
    getOrderDetail: async () => { refreshed++; return order([item(3, { refundableQuantity: 1 })]) },
    applyRefund: async () => { throw { code: 400, message: '可退数量已变化' } }
  })
  state.applyOrderData(order([item(3)]))
  state.selectReason(state.reasonOptions[0])
  const requestId = state.requestId
  await state.submitRefund()
  for (let i = 0; i < 5; i++) await Promise.resolve()
  assert.equal(state.pendingSubmission, null)
  assert.notEqual(state.requestId, requestId)
  assert.equal(refreshed, 1)
  assert.equal(state.allProducts[0].selectedQuantity, 1)
})

test('加载期间禁止切组，旧账号或已卸载页面不应用异步结果', async () => {
  let resolveOrder
  let current = true
  const { state, options } = createApply({
    isCurrentSession: () => current,
    getOrderDetail: () => new Promise(resolve => { resolveOrder = resolve })
  })
  state.applyOrderData(order([item(1), item(3)]))
  const loading = state.loadOrderDetail()
  await Promise.resolve()
  state.selectRefundGroup('THERAPY')
  assert.equal(state.activeRefundGroup, 'PHYSICAL')
  current = false
  resolveOrder(order([item(3)]))
  await loading
  assert.equal(state.activeRefundGroup, 'PHYSICAL')
  current = true
  options.onUnload.call(state)
  await state.submitRefund()
  assert.equal(state.pendingSubmission, null)
})

test('检查可退资格期间离开页面立即结束自己的加载，旧回调不关闭新页面加载', async () => {
  let finishCheck
  let hidden = 0
  let detailRequests = 0
  const { state, options } = createApply({
    checkCanApplyRefund: () => new Promise(resolve => { finishCheck = resolve }),
    getOrderDetail: async () => { detailRequests++; return order([item(3)]) },
    uni: { showLoading() {}, hideLoading: () => { hidden++ }, showToast() {} }
  })
  const loading = state.loadOrderDetail()
  assert.equal(state.loading, true)
  options.onUnload.call(state)
  assert.equal(state.loading, false)
  assert.equal(hidden, 1)
  // 新页面此时可展示自己的 Loading；旧检查返回后不能再 hideLoading。
  finishCheck(true)
  await loading
  assert.equal(hidden, 1)
  assert.equal(detailRequests, 0)
  assert.deepEqual(state.allProducts, [])
})

test('账号变更后卸载旧退款页，不关闭后来账号的加载提示', async () => {
  let current = true
  let finishCheck
  let hidden = 0
  const { state, options } = createApply({
    isCurrentSession: () => current,
    checkCanApplyRefund: () => new Promise(resolve => { finishCheck = resolve }),
    uni: { showLoading() {}, hideLoading: () => { hidden++ }, showToast() {} }
  })
  const loading = state.loadOrderDetail()
  current = false
  options.onUnload.call(state)
  finishCheck(true)
  await loading
  assert.equal(hidden, 0)
})

test('申请提交期间不能改数量或切组，也不会发出第二笔请求', async () => {
  let finish
  let submittedCount = 0
  const { state } = createApply({
    applyRefund: () => new Promise(resolve => { submittedCount++; finish = resolve })
  })
  state.applyOrderData(order([item(1), item(3)]))
  state.selectReason(state.reasonOptions[0])
  const submitting = state.submitRefund()
  state.selectRefundGroup('THERAPY')
  state.decreaseQuantity(state.allProducts[0])
  await state.submitRefund()
  assert.equal(state.activeRefundGroup, 'PHYSICAL')
  assert.equal(state.allProducts[0].selectedQuantity, 5)
  assert.equal(submittedCount, 1)
  finish()
  await submitting
  assert.equal(state.submitted, true)
})

test('历史退款不封住剩余次数申请，异常付款和已全退订单没有入口', () => {
  const source = order([item(3, { redeemedQuantity: 2, refundableQuantity: 3 })])
  assert.equal(canOrderApplyRefund({ ...source, refundApplicationId: 8, refundStatus: 4, orderStatus: 6 }), true)
  assert.equal(canOrderApplyRefund({ ...source, items: [item(3, { refundableQuantity: 0 })] }), false)
  for (const paymentFulfillmentStatus of ['PENDING', 'REFUND_REQUIRED', 'REFUNDED']) {
    assert.equal(canOrderApplyRefund({ ...source, paymentFulfillmentStatus }), false)
  }
  for (const orderStatus of [0, 4, 7]) assert.equal(canOrderApplyRefund({ ...source, orderStatus }), false)
})

test('列表映射保留次数字段，详情与列表共用续退规则且申请记录入口正常展示', () => {
  const list = loadSetup('pages/order/order_list.vue', {
    ref: value => ({ value }), onLoad() {}, onShow() {}, onUnmounted() {},
    onSessionChanged: () => () => {}, isTherapyOrder: () => false
  }, ['mapOrderListItem', 'refundActionText'])
  const mapped = list.mapOrderListItem({ ...order([item(3, { redeemedQuantity: 2, refundableQuantity: 3 })]), refundApplicationId: 8 })
  assert.equal(mapped.items[0].redeemedQuantity, 2)
  assert.equal(mapped.items[0].refundableQuantity, 3)
  assert.equal(canOrderApplyRefund(mapped), true)
  assert.match(list.refundActionText(mapped), /^继续/)
  const detail = loadOptions('pages/order/order-detail.vue', {})
  assert.equal(detail.computed.canApplyRefund.call({ order: mapped, allCartItems: mapped.items }), true)
  const source = readFileSync(new URL('../pages/order/order_list.vue', import.meta.url), 'utf8').replace(/<!--[\s\S]*?-->/g, '')
  assert.match(source, /v-if="canOrderApplyRefund\(order\)"/)
  assert.match(source, /v-if="order\.refundApplicationId"/)
})
