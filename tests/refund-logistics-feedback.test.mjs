import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getRefundErrorModal } from '../utils/refund.js'
import { loadOptions, loadSetup } from './sfc-harness.mjs'

const message = '当前物流状态暂不支持在线退款。请联系客服核查物流信息，确认未发货后再申请；如已发货，请由客服协助处理退款。'
const conflict = { code: 409, message }
const modal = { title: '退款提示', content: message, showCancel: false, confirmText: '我知道了' }

const createEntry = (entry, error = conflict) => {
  const modals = [], toasts = [], navigations = []
  const mocks = {
    ref: value => ({ value }), onUnmounted() {}, onSessionChanged: () => () => {},
    getSessionGeneration: () => 0, isCurrentSession: () => true,
    console: { error() {}, debug() {} },
    checkCanApplyRefund: async () => { throw error },
    uni: {
      showModal: value => modals.push(value), showToast: value => toasts.push(value.title),
      navigateTo: value => navigations.push(value.url), showLoading() {}, hideLoading() {}
    }
  }
  let page, run
  if (entry === 'list') {
    page = loadSetup('pages/order/order_list.vue', mocks, ['applyRefund'])
    run = () => page.applyRefund(9)
  } else {
    const options = loadOptions(`pages/order/${entry === 'detail' ? 'order-detail' : 'refund_apply'}.vue`, mocks)
    page = { ...options.data(), ...options.methods, order: { id: 9 }, orderId: 9 }
    run = () => entry === 'detail' ? page.applyRefund() : page.loadOrderDetail()
  }
  return { page, run, modals, toasts, navigations }
}

test('退款状态冲突展示完整指引，不按物流原因解释网络或系统故障', () => {
  assert.deepEqual(getRefundErrorModal(conflict), modal)
  for (const error of [{ code: 500, message: '系统异常，请稍后重试' }, { errMsg: 'request:fail timeout' }, { code: 400, message: '可退数量已变化' }]) {
    assert.equal(getRefundErrorModal(error), null)
  }
})

for (const entry of ['list', 'detail', 'apply']) {
  test(`${entry} 入口遇到物流拦截只弹一次退款提示，不跳转或提示系统异常`, async () => {
    const fixture = createEntry(entry)
    await fixture.run()
    assert.deepEqual(fixture.modals, [modal])
    assert.deepEqual(fixture.toasts, [])
    assert.deepEqual(fixture.navigations, [])
  })

  test(`${entry} 入口仍保留普通失败提示`, async () => {
    const fixture = createEntry(entry, { code: 500, message: '服务暂不可用' })
    await fixture.run()
    assert.deepEqual(fixture.modals, [])
    assert.deepEqual(fixture.toasts, ['服务暂不可用'])
  })
}

test('明确拒绝后的静默刷新不重复弹出物流指引', async () => {
  const fixture = createEntry('apply')
  await fixture.page.loadOrderDetail({ silent: true })
  assert.deepEqual(fixture.modals, [])
  assert.deepEqual(fixture.toasts, [])
})
