import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { loadOptions } from './sfc-harness.mjs'
import { AI_DOCTOR } from '../utils/consultation-mode.js'
import { canCreatePrescriptionOrder, getPrescriptionStatusText } from '../utils/prescription.js'

const prescription = (values = {}) => ({ id: 7, status: 1, expired: false, doctorId: null,
  diagnosis: '保存的诊断', usageNote: '保存的医嘱', createdAt: '2026-10-01T10:20:30',
  patientSnapshotAvailable: true, patientName: '快照患者', patientGender: '女', patientAge: 0,
  patientIdNumberMasked: '123****5678', ...values })

const harness = (overrides = {}) => {
  const toasts = []
  const definition = loadOptions('pages/prescription/detail.vue', {
    getSessionGeneration: () => 1, isCurrentSession: () => true,
    getPrescriptionDetail: async () => prescription(),
    getPrescriptionItems: async () => [{ id: 1, productId: 20, drugName: '处方药品', remark: '开方时保存的说明' }],
    getOrderByPrescriptionId: async () => null,
    getProductDetail: async () => { throw new Error('历史处方不能读取当前商品覆盖说明') },
    getDoctorDetail: async () => { throw new Error('fixture doctor unavailable') },
    uni: { showToast: toast => toasts.push(toast), navigateTo() {} },
    logPageView() {}, ...overrides
  })
  const page = { ...definition.data(), ...definition.methods }
  for (const [key, getter] of Object.entries(definition.computed)) {
    Object.defineProperty(page, key, { get: () => getter.call(page) })
  }
  page.pageOptions.prescriptionId = 7
  return { page, definition, toasts }
}

test('处方一键下单只接受服务端明确的已审核且未过期，状态文案保留作废与过期', () => {
  for (const [value, expected] of [
    [prescription(), true], [prescription({ expired: true }), false],
    [prescription({ expired: undefined }), false], [prescription({ status: 0 }), false],
    [prescription({ status: 2 }), false], [prescription({ status: 9 }), false], [null, false]
  ]) assert.equal(canCreatePrescriptionOrder(value), expected)
  assert.equal(getPrescriptionStatusText(prescription({ status: 0 })), '待审核')
  assert.equal(getPrescriptionStatusText(prescription({ status: 2, expired: true })), '已作废')
  assert.equal(getPrescriptionStatusText(prescription({ expired: true })), '已过期')
})

test('诊断、主表医嘱和逐项说明均读取处方保存内容，不依赖当前商品；零岁快照有效', async () => {
  let productReads = 0
  const { page } = harness({ getProductDetail: async () => { productReads++; return { usageDesc: '修改后的当前用法' } } })
  await page.reload()
  assert.equal(page.prescriptionLoaded, true)
  assert.equal(page.detail.diagnosis, '保存的诊断')
  assert.equal(page.detail.usageNote, '保存的医嘱')
  assert.equal(page.detail.prescriptionItems[0].remark, '开方时保存的说明')
  assert.equal(page.detail.age, 0)
  assert.equal(page.detail.patientSnapshotAvailable, true)
  assert.equal(page.detail.idNumberMasked, '123****5678')
  assert.equal(productReads, 0)
  assert.equal(page.canBuyMedicine, true)
})

test('只有无医生ID显示AI，有真实ID但资料失败保持不可用且不补签名', async () => {
  let current = prescription({ doctorId: 100 })
  let doctorReads = 0
  const { page } = harness({
    getPrescriptionDetail: async () => current,
    getDoctorDetail: async () => { doctorReads++; throw new Error('fixture offline') }
  })
  await page.reload()
  assert.equal(page.prescriptionLoaded, true)
  assert.equal(page.detail.doctorName, '医师资料暂不可用')
  assert.notEqual(page.detail.doctorName, AI_DOCTOR.name)
  assert.equal(page.detail.doctorSignatureUrl, '')
  current = prescription()
  await page.reload()
  assert.equal(page.detail.doctorName, AI_DOCTOR.name)
  assert.equal(page.detail.doctorSignatureUrl, '')
  assert.equal(doctorReads, 1)
})

test('医生和订单辅助读取并发，医生缓慢不会阻止处方与订单状态展示', async () => {
  let finishDoctor
  const { page } = harness({ getPrescriptionDetail: async () => prescription({ doctorId: 100 }),
    getDoctorDetail: () => new Promise(resolve => { finishDoctor = resolve }) })
  const pending = page.reload()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(page.prescriptionLoaded, true)
  assert.equal(page.orderStatusLoaded, true)
  assert.equal(page.detail.doctorName, '医师资料加载中')
  finishDoctor({ name: '真实处方医师', signatureUrl: '/fixture-signature.png' })
  await pending
  assert.equal(page.detail.doctorName, '真实处方医师')
  assert.ok(page.detail.doctorSignatureUrl.endsWith('/fixture-signature.png'))
})

test('处方失效不提示等待支付，已有订单付款处理中不会再次开放支付', async () => {
  let order = null
  const { page } = harness({ getPrescriptionDetail: async () => prescription({ expired: true }),
    getOrderByPrescriptionId: async () => order })
  await page.reload()
  assert.equal(page.statusMainText, '已过期')
  assert.equal(page.statusSubText, '尚未关联订单')
  assert.equal(page.canBuyMedicine, false)
  order = { id: 42, payStatus: 1, orderStatus: 0, paymentFulfillmentStatus: 'PENDING' }
  await page.reload()
  assert.equal(page.statusSubText, '订单：已付款，订单处理中')
  assert.equal(page.canBuyMedicine, false)
  order = { id: 42, payStatus: 0, orderStatus: 0 }
  await page.reload()
  assert.equal(page.canBuyMedicine, true, '已有待付原单独立续付，不重新创建处方订单')
})

test('双订单查询失败保留真实处方并给出重试状态，重试成功才开放购药', async () => {
  let failed = true
  const { page } = harness({
    getOrderByPrescriptionId: async () => { if (failed) throw new Error('fixture primary'); return null },
    getOrderPage: async () => { throw new Error('fixture secondary') }
  })
  await page.reload()
  assert.equal(page.prescriptionLoaded, true)
  assert.equal(page.orderStatusLoaded, false)
  assert.match(page.statusSubText, /读取失败/)
  assert.equal(page.canBuyMedicine, false)
  failed = false
  await page.reload()
  assert.equal(page.orderStatusError, '')
  assert.equal(page.canBuyMedicine, true)
})

test('再次读取处方失败不显示旧临床内容，且不开放购药', async () => {
  let failed = false
  const { page } = harness({ getPrescriptionDetail: async () => {
    if (failed) throw new Error('fixture offline')
    return prescription()
  } })
  await page.reload()
  failed = true
  await page.reload()
  assert.equal(page.prescriptionLoaded, false)
  assert.equal(page.prescription, null)
  assert.deepEqual(page.detail.prescriptionItems, [])
  assert.equal(page.statusMainText, '处方加载失败')
  assert.equal(page.canBuyMedicine, false)
})

test('迟到的旧刷新不能覆盖新刷新，卸载或切换账号后不写入处方', async () => {
  let finishOld, calls = 0, currentSession = true
  const { page, definition } = harness({ isCurrentSession: () => currentSession,
    getPrescriptionDetail: () => ++calls === 1 ? new Promise(resolve => { finishOld = resolve })
      : Promise.resolve(prescription({ diagnosis: '较新的诊断' })) })
  const old = page.reload()
  await page.reload()
  finishOld(prescription({ diagnosis: '迟到的诊断' }))
  await old
  assert.equal(page.detail.diagnosis, '较新的诊断')
  definition.onUnload.call(page)
  await page.loadPrescriptionById(7)
  assert.equal(calls, 2)
  currentSession = false
  await page.reload()
  assert.equal(calls, 2)
})

test('详情模板仅渲染实际签名与已保存说明，不保留固定签名和空集合布局', () => {
  const source = readFileSync(new URL('../pages/prescription/detail.vue', import.meta.url), 'utf8')
  assert.match(source, /v-if="detail\.doctorSignatureUrl"/)
  assert.match(source, /item\.remark/)
  assert.match(source, /detail\.usageNote/)
  assert.doesNotMatch(source, /zhongyi_qianming|associatedDoctors|formulaName|item\.usageDesc|getProductDetail/)
})
