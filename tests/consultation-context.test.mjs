import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { loadSetup } from './sfc-harness.mjs'
import * as context from '../utils/consultation-checkout.js'
import * as flow from '../utils/product-biz.js'
import * as mode from '../utils/consultation-mode.js'

beforeEach(t => t.mock.timers.enable({ apis: ['setTimeout'] }))
afterEach(t => t.mock.timers.reset())

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
const visibleMessages = page => page.messages.value.map(message => message.show)
const finishMessages = t => {
  t.mock.timers.tick(500)
  for (let i = 0; i < 4; i++) t.mock.timers.tick(1500)
  t.mock.timers.tick(1000)
}

const harness = (overrides = {}, options = {}) => {
  let load, unload, mount
  const navigations = []
  const mocks = {
    ref: value => ({ value }), nextTick: fn => fn(), onMounted: fn => { mount = fn },
    onLoad: fn => { load = fn }, onUnload: fn => { unload = fn },
    getSessionGeneration: () => 0, assertCurrentSession() {},
    createConsultation: async input => ({ id: 123, patientId: input.patientId }),
    getPrescriptionByConsultation: async id => ({ id: 789, consultationId: id, patientId: 42, status: 1 }),
    getProductDetail: async id => ({ id, status: 1, delSign: 0, goodsMerchantType: 1, productCategory: 1, productName: 'fixture', stock: 20, available: true, skus: [{ id: 1, status: 1, delSign: 0, price: 12, stock: 20 }] }),
    getCartEntries: () => ({ '7:1': { productId: 7, skuId: 1, quantity: 2 } }),
    getCurrentCheckoutProductIds: () => ['7:1'], setCheckoutProductIds() {},
    splitCartItemKey: value => ({ productId: value }),
    logPageView() {}, getImageUrl: value => value,
    uni: { getStorageSync: () => 888, navigateTo: route => navigations.push(route.url), showToast() {} },
    ...context, ...flow, ...mode, ...overrides
  }
  const page = loadSetup('pages/dispense/consultation.vue', mocks,
    ['createConsultationRecord', 'viewPrescription', 'showPrescriptionBtn', 'checkoutContext', 'consultationError',
      'prescriptionStatusText', 'messages', 'doctorName', 'doctorId'])
  load({ patientId: '42', selectedItems: '7:1', ...options })
  return { ...page, navigations, mount: () => mount(), unload: () => unload() }
}

test('请求失败不播放成功且不复用已存旧问诊ID', async t => {
  const page = harness({ createConsultation: async () => { throw new Error('fixture-create-failed') } })
  await page.createConsultationRecord()
  t.mock.timers.tick(15000)
  page.viewPrescription()
  assert.equal(page.showPrescriptionBtn.value, false)
  assert.equal(page.checkoutContext.value, null)
  assert.equal(page.consultationError.value, 'fixture-create-failed')
  assert.deepEqual(page.navigations, [])
})

test('真实成功后原五条文案依次播放，末条停留一秒才开放已审核处方', async t => {
  const page = harness()
  await page.createConsultationRecord()
  assert.equal(page.doctorName.value, mode.AI_DOCTOR.name)
  assert.equal(page.doctorId.value, null)
  assert.equal(page.prescriptionStatusText.value, '处方审核通过')
  assert.deepEqual(page.messages.value.map(message => message.text), [
    '您好，我是辽宁中医在线医生，已收到您的复诊开药诉求，正在为您诊断开方，预计1分钟，请不要离开。',
    '请问您是否还有其他信息需要补充，如无，我将依据您的资料开具处方。',
    '请稍等，正在审核您提交的购买制剂信息。',
    '如无信息补充，我将根据您提交的复诊信息开具处方。',
    '已为您开具处方，您可以点击下方查看处方按钮，完成支付。'
  ])
  assert.deepEqual(visibleMessages(page), [false, false, false, false, false])
  assert.equal(page.showPrescriptionBtn.value, false)
  page.viewPrescription()
  assert.deepEqual(page.navigations, [])
  t.mock.timers.tick(499)
  assert.deepEqual(visibleMessages(page), [false, false, false, false, false])
  t.mock.timers.tick(1)
  for (let shown = 1; shown <= 5; shown++) {
    assert.deepEqual(visibleMessages(page), Array.from({ length: 5 }, (_, index) => index < shown))
    assert.equal(page.showPrescriptionBtn.value, false)
    if (shown < 5) {
      t.mock.timers.tick(1499)
      assert.deepEqual(visibleMessages(page), Array.from({ length: 5 }, (_, index) => index < shown))
      t.mock.timers.tick(1)
    }
  }
  t.mock.timers.tick(999)
  assert.equal(page.showPrescriptionBtn.value, false)
  t.mock.timers.tick(1)
  assert.equal(page.showPrescriptionBtn.value, true)
  page.viewPrescription()
  assert.match(page.navigations[0], /consultationId=123&patientId=42/)
  assert.doesNotMatch(page.navigations[0], /888/)
})

test('处方查询失败可重试同次创建，不重复创建或关联其他患者', async t => {
  let creates = 0, fetches = 0
  const page = harness({
    createConsultation: async () => { creates++; return { id: 123, patientId: 42 } },
    getPrescriptionByConsultation: async () => {
      if (++fetches === 1) throw new Error('fixture-fetch-failed')
      return { id: 789, consultationId: 123, patientId: 42, status: 1 }
    }
  })
  await page.createConsultationRecord()
  assert.equal(page.showPrescriptionBtn.value, false)
  assert.equal(page.consultationError.value, 'fixture-fetch-failed')
  await page.createConsultationRecord()
  assert.equal(creates, 1)
  assert.equal(page.consultationError.value, '')
  assert.equal(page.showPrescriptionBtn.value, false)
  assert.deepEqual(visibleMessages(page), [false, false, false, false, false])
  finishMessages(t)
  assert.equal(page.showPrescriptionBtn.value, true)
  const wrongPatient = harness({ createConsultation: async () => ({ id: 123, patientId: 43 }) })
  await wrongPatient.createConsultationRecord()
  t.mock.timers.tick(15000)
  assert.equal(wrongPatient.showPrescriptionBtn.value, false)
})

test('创建或处方请求未完成时只显示等待状态，失败不播放成功', async t => {
  let completeCreation, failPrescription
  const page = harness({
    createConsultation: () => new Promise(resolve => { completeCreation = resolve }),
    getPrescriptionByConsultation: () => new Promise((resolve, reject) => { failPrescription = reject })
  })
  const pending = page.createConsultationRecord()
  await flush()
  t.mock.timers.tick(15000)
  assert.equal(page.messages.value.length, 1)
  assert.equal(page.showPrescriptionBtn.value, false)
  assert.equal(page.prescriptionStatusText.value, '')
  completeCreation({ id: 123, patientId: 42 })
  await flush()
  t.mock.timers.tick(15000)
  assert.equal(page.messages.value.length, 1)
  assert.equal(page.showPrescriptionBtn.value, false)
  failPrescription(new Error('fixture-prescription-pending-failed'))
  await pending
  t.mock.timers.tick(15000)
  assert.equal(page.checkoutContext.value, null)
  assert.equal(page.showPrescriptionBtn.value, false)
  assert.equal(page.consultationError.value, 'fixture-prescription-pending-failed')
})

test('页面关闭后的迟到创建结果不会开放处方入口', async t => {
  let complete
  const page = harness({ createConsultation: () => new Promise(resolve => { complete = resolve }) })
  const pending = page.createConsultationRecord()
  await flush()
  page.unload()
  complete({ id: 123, patientId: 42 })
  await pending
  t.mock.timers.tick(15000)
  assert.equal(page.showPrescriptionBtn.value, false)
})

test('播放中卸载取消剩余消息及处方按钮', async t => {
  const page = harness()
  await page.createConsultationRecord()
  t.mock.timers.tick(500)
  assert.deepEqual(visibleMessages(page), [true, false, false, false, false])
  page.unload()
  finishMessages(t)
  assert.deepEqual(visibleMessages(page), [true, false, false, false, false])
  assert.equal(page.showPrescriptionBtn.value, false)
})

test('播放中切换账号后停止消息和处方入口', async t => {
  let sessionChanged = false
  const page = harness({ assertCurrentSession() {
    if (sessionChanged) throw Object.assign(new Error('fixture-session-changed'), { code: 'SESSION_CHANGED' })
  } })
  await page.createConsultationRecord()
  t.mock.timers.tick(500)
  sessionChanged = true
  finishMessages(t)
  assert.deepEqual(visibleMessages(page), [true, false, false, false, false])
  assert.equal(page.showPrescriptionBtn.value, false)
  page.viewPrescription()
  assert.deepEqual(page.navigations, [])
})

test('页面挂载自动创建人工问诊，动画保留上页传入的真实医生', async t => {
  let request
  const page = harness({ createConsultation: async input => {
    request = input
    return { id: 123, patientId: input.patientId }
  } }, { consultationMode: 'manual', doctorId: '100', doctorName: encodeURIComponent('fixture-doctor') })
  await page.mount()
  assert.equal(request.doctorId, 100)
  assert.equal(page.doctorId.value, 100)
  assert.equal(page.doctorName.value, 'fixture-doctor')
  assert.equal(page.showPrescriptionBtn.value, false)
  finishMessages(t)
  assert.equal(page.showPrescriptionBtn.value, true)
})

test('处方ID与问诊ID相同也必须沿处方外键查询', async () => {
  const calls = []
  const result = await context.loadPrescriptionContext(5, {
    getPrescriptionDetail: async id => { calls.push(['prescription', id]); return { id, consultationId: 99 } },
    getConsultationDetail: async id => { calls.push(['consultation', id]); return { id } }
  })
  assert.deepEqual(calls, [['prescription', 5], ['consultation', 99]])
  assert.equal(result.prescription.id, 5)
  await assert.rejects(context.loadPrescriptionContext(5, { getPrescriptionDetail: async () => ({ id: 6 }) }), /处方信息不匹配/)
  assert.equal(context.parseConsultationContext({ consultationId: '123' }), null)
  assert.throws(() => context.requireConsultationPatient({ id: 123, patientId: 43 }, { consultationId: 123, patientId: 42 }), /就诊人不一致/)
})


test('三类混购只将制剂ID开入处方，下游仍携带全部结算行', async t => {
  let request
  const page = harness({
    getCartEntries: () => Object.fromEntries([1, 2, 3].map(id => [`${id}:1`, { productId: id, skuId: 1, quantity: 2 }])),
    getProductDetail: async id => ({ id, productCategory: Number(id), productName: `商品${id}`,
      status: 1, delSign: 0, goodsMerchantType: id === 2 ? 2 : 1,
      skus: [{ id: 1, price: 12, stock: 20, status: 1, delSign: 0 }] }),
    createConsultation: async input => { request = input; return { id: 123, patientId: input.patientId } }
  }, { selectedItems: '1:1,2:1,3:1' })
  await page.createConsultationRecord()
  assert.deepEqual(request.prescriptionItems.map(item => String(item.productId)), ['1'])
  finishMessages(t); page.viewPrescription()
  assert.match(page.navigations[0], /selectedItems=1:1,2:1,3:1/)
})
