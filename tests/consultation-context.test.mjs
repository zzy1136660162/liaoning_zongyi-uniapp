import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadSetup } from './sfc-harness.mjs'
import * as context from '../utils/consultation-checkout.js'
import * as flow from '../utils/product-biz.js'
import * as mode from '../utils/consultation-mode.js'

const harness = (overrides = {}) => {
  let load, unload
  const navigations = []
  const mocks = {
    ref: value => ({ value }), nextTick: fn => fn(), onMounted() {},
    onLoad: fn => { load = fn }, onUnload: fn => { unload = fn },
    getSessionGeneration: () => 0, assertCurrentSession() {},
    createConsultation: async input => ({ id: 123, patientId: input.patientId }),
    getPrescriptionByConsultation: async id => ({ id: 789, consultationId: id, patientId: 42, status: 0 }),
    getProductDetail: async id => ({ id, bizType: 1, productCategory: 1, productName: 'fixture' }),
    getCartEntries: () => ({ '7': { quantity: 2 } }),
    getCurrentCheckoutProductIds: () => ['7'], setCheckoutProductIds() {},
    splitCartItemKey: value => ({ productId: value }),
    STORAGE_KEY_PRODUCT_QUANTITIES: 'productQuantities',
    logPageView() {}, getImageUrl: value => value,
    uni: { getStorageSync: () => 888, navigateTo: route => navigations.push(route.url), showToast() {} },
    ...context, ...flow, ...mode, ...overrides
  }
  const page = loadSetup('pages/dispense/consultation.vue', mocks,
    ['createConsultationRecord', 'viewPrescription', 'showPrescriptionBtn', 'checkoutContext', 'consultationError', 'prescriptionStatusText'])
  load({ patientId: '42', selectedItems: '7' })
  return { ...page, navigations, unload: () => unload() }
}

test('请求失败不播放成功且不复用已存旧问诊ID', async () => {
  const page = harness({ createConsultation: async () => { throw new Error('fixture-create-failed') } })
  await page.createConsultationRecord()
  page.viewPrescription()
  assert.equal(page.showPrescriptionBtn.value, false)
  assert.equal(page.checkoutContext.value, null)
  assert.equal(page.consultationError.value, 'fixture-create-failed')
  assert.deepEqual(page.navigations, [])
})

test('真实问诊和待审核处方成功后传递本次患者及问诊上下文', async () => {
  const page = harness()
  await page.createConsultationRecord()
  assert.equal(page.showPrescriptionBtn.value, true)
  assert.equal(page.prescriptionStatusText.value, '本次处方已生成，待审核')
  page.viewPrescription()
  assert.match(page.navigations[0], /consultationId=123&patientId=42/)
  assert.doesNotMatch(page.navigations[0], /888/)
})

test('处方查询失败可重试同次创建，不重复创建或关联其他患者', async () => {
  let creates = 0, fetches = 0
  const page = harness({
    createConsultation: async () => { creates++; return { id: 123, patientId: 42 } },
    getPrescriptionByConsultation: async () => {
      if (++fetches === 1) throw new Error('fixture-fetch-failed')
      return { id: 789, consultationId: 123, patientId: 42, status: 0 }
    }
  })
  await page.createConsultationRecord()
  assert.equal(page.showPrescriptionBtn.value, false)
  await page.createConsultationRecord()
  assert.equal(creates, 1)
  assert.equal(page.showPrescriptionBtn.value, true)
  const wrongPatient = harness({ createConsultation: async () => ({ id: 123, patientId: 43 }) })
  await wrongPatient.createConsultationRecord()
  assert.equal(wrongPatient.showPrescriptionBtn.value, false)
})

test('页面关闭后的迟到创建结果不会开放处方入口', async () => {
  let complete
  const page = harness({ createConsultation: () => new Promise(resolve => { complete = resolve }) })
  const pending = page.createConsultationRecord()
  for (let i = 0; i < 5 && !complete; i++) await Promise.resolve()
  page.unload()
  complete({ id: 123, patientId: 42 })
  await pending
  assert.equal(page.showPrescriptionBtn.value, false)
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
