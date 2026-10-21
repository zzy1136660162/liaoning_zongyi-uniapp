import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { readFileSync } from 'node:fs'
import dayjs from 'dayjs'
import * as cart from '../utils/cart.js'
import * as context from '../utils/consultation-checkout.js'
import * as prescriptionDisplay from '../utils/prescription.js'
import { AI_DOCTOR } from '../utils/consultation-mode.js'
import { loadSetup } from './sfc-harness.mjs'

const itemKeys = ['10:11', '10:12', '20:21', '30:31']
const prescription = (extra = {}) => ({ id: 900, consultationId: 123, patientId: 8,
  patientName: '处方患者', patientGender: '女', patientAge: 0, patientSnapshotAvailable: true,
  doctorId: 100, diagnosis: '真实处方诊断', status: 1, expired: false, ...extra })
const consultation = (extra = {}) => ({ id: 123, patientId: 8, patientName: '问诊患者',
  doctorId: 200, doctorName: '问诊医生', createdAt: '2026-10-21T10:00:00', ...extra })
const product = id => ({ id: Number(id), productName: `商品${id}`, productCategory: Number(id) / 10,
  goodsMerchantType: 1, status: 1, delSign: 0, available: true, stock: 50,
  prescriptionDiagnosis: '商品预设诊断', doctorName: '商品默认医生',
  skus: (Number(id) === 10 ? [11, 12] : [Number(id) + 1]).map((skuId, index) => ({
    id: skuId, specText: `规格${skuId}`, price: Number(id) + index * 2,
    unit: '盒', status: 1, delSign: 0, stock: 50
  })) })

const harness = (overrides = {}, options = {}) => {
  let onLoad, onShow, onUnload, currentSession = true
  const storage = new Map(), routes = [], toasts = [], prescriptionQueries = [], doctorQueries = []
  const uni = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key), $emit() {},
    showLoading() {}, hideLoading() {}, showToast: value => toasts.push(value.title),
    navigateTo: value => routes.push(value.url)
  }
  globalThis.uni = uni
  cart.replaceCartData(Object.fromEntries(itemKeys.map((key, index) => {
    const { productId, skuId } = cart.splitCartItemKey(key)
    return [key, { productId, skuId, productName: `商品${productId}`, skuSpecText: `规格${skuId}`,
      quantity: [2, 1, 3, 4][index], selected: true, available: true, stock: 50,
      goodsMerchantType: 1, productCategory: Number(productId) / 10, price: Number(productId) }]
  })))
  const mocks = {
    ...cart, ...context, ...prescriptionDisplay, dayjs,
    ref: value => ({ value }), computed: get => ({ get value() { return get() } }),
    onLoad: fn => { onLoad = fn }, onShow: fn => { onShow = fn }, onUnload: fn => { onUnload = fn },
    onMounted() {}, logPageView() {}, getSessionGeneration: () => 1,
    assertCurrentSession() {
      if (!currentSession) throw Object.assign(new Error('fixture-session-changed'), { code: 'SESSION_CHANGED' })
    },
    getConsultationDetail: async () => consultation(),
    getPrescriptionByConsultation: async id => { prescriptionQueries.push(id); return prescription() },
    getDoctorDetail: async id => { doctorQueries.push(id); return { id, name: '处方医生' } },
    getProductDetail: async id => product(id),
    STORAGE_KEY_CURRENT_ORDER: 'current_order', uni,
    console: { debug() {}, warn() {}, error() {} }, ...overrides
  }
  const page = loadSetup('pages/order/prescription_list.vue', mocks, [
    'loadPage', 'consultation', 'currentPrescription', 'prescriptionDoctorName', 'latestConsultationTime',
    'cartItemsList', 'selectedCartIds', 'selectedCartCount', 'selectedCartTotal', 'canSubmit',
    'loadError', 'loading', 'goToOrder', 'toggleCartSelect', 'toggleCartSelectAll'
  ])
  onLoad({ selectedItems: itemKeys.join(','), consultationId: '123', patientId: '8', ...options })
  return { ...page, storage, routes, toasts, prescriptionQueries, doctorQueries,
    show: () => onShow(), unload: () => onUnload(), changeSession: () => { currentSession = false } }
}

describe('处方清单普通购物车', () => {
  test('真实诊断和患者来自处方，医生按处方ID查询，混购保留规格和数量', async () => {
    const page = harness()
    await page.show()
    assert.deepEqual(page.prescriptionQueries, [123], '按问诊外键查询处方，不把两个ID混用')
    assert.deepEqual(page.doctorQueries, [100])
    assert.equal(page.currentPrescription.value.id, 900)
    assert.equal(page.currentPrescription.value.diagnosis, '真实处方诊断')
    assert.equal(page.currentPrescription.value.patientName, '处方患者')
    assert.equal(page.currentPrescription.value.patientAge, 0)
    assert.equal(page.consultation.value.patientName, '问诊患者')
    assert.equal(page.prescriptionDoctorName.value, '处方医生')
    assert.equal(page.latestConsultationTime.value, '2026-10-21 10:00')
    assert.deepEqual(page.cartItemsList.value.map(item => [item.id, item.skuSpecText, item.quantity]), [
      ['10:11', '规格11', 2], ['10:12', '规格12', 1], ['20:21', '规格21', 3], ['30:31', '规格31', 4]
    ])
    assert.equal(page.selectedCartTotal.value, 212)
    assert.equal(page.canSubmit.value, true)
    page.goToOrder()
    assert.equal(page.routes[0], '/pages/order/confirm?selectedItems=10:11,10:12,20:21,30:31&consultationId=123&patientId=8')
    assert.deepEqual(page.storage.get('current_order').items.map(item => [item.skuId, item.quantity]),
      [['11', 2], ['12', 1], ['21', 3], ['31', 4]])
    const template = readFileSync(new URL('../pages/order/prescription_list.vue', import.meta.url), 'utf8').split('<script')[0]
    assert.match(template, /currentPrescription\?\.diagnosis/)
    assert.match(template, /cartItem\.skuSpecText/)
    assert.match(template, /v-if="cartItem\.productCategory === 1"[\s\S]*?本次处方诊断/)
    assert.match(template, /v-if="cartItem\.productCategory === 1"[\s\S]*?prescriptionDoctorName/)
    assert.doesNotMatch(template, /cartItem\.diagnosis|cartItem\.doctorName|复诊调方/)
  })

  test('人工医生资料失败明确显示缺失，无doctorId才使用AI身份', async () => {
    for (const doctorId of [100, null]) {
      const page = harness({
        getPrescriptionByConsultation: async () => prescription({ doctorId }),
        getDoctorDetail: async () => { throw new Error('fixture-doctor-offline') }
      })
      await page.show()
      assert.equal(page.prescriptionDoctorName.value, doctorId ? '医师资料暂不可用' : AI_DOCTOR.name)
      assert.equal(page.canSubmit.value, true, '辅助医生资料失败不丢弃真实处方')
    }
  })

  test('保留待审核和已审核结算政策，作废、未知、过期及缺少有效期标记均不能下单', async () => {
    for (const [status, expired, allowed] of [
      [0, false, true], [1, false, true], [2, false, false], [null, false, false],
      [1, true, false], [1, undefined, false], [1, 'false', false]
    ]) {
      const page = harness({ getPrescriptionByConsultation: async () => prescription({ status, expired }) })
      await page.show()
      assert.equal(page.canSubmit.value, allowed)
      page.goToOrder()
      assert.equal(page.routes.length, allowed ? 1 : 0)
    }
  })

  test('刷新开始立即清旧资料，处方失败后禁止下单，重试可重新加载', async () => {
    let reject, requests = 0
    const page = harness({ getPrescriptionByConsultation: () => ++requests === 2
      ? new Promise((resolve, fail) => { reject = fail }) : Promise.resolve(prescription()) })
    await page.show()
    const pending = page.show()
    assert.equal(page.loading.value, true)
    assert.equal(page.currentPrescription.value, null)
    assert.deepEqual(page.cartItemsList.value, [])
    assert.equal(page.canSubmit.value, false)
    reject(new Error('fixture-prescription-offline'))
    await pending
    assert.equal(page.consultation.value, null)
    assert.equal(page.prescriptionDoctorName.value, '')
    assert.equal(page.canSubmit.value, false)
    page.goToOrder()
    assert.deepEqual(page.routes, [])
    assert.equal(page.loadError.value, 'fixture-prescription-offline')
    await page.loadPage()
    assert.equal(page.canSubmit.value, true)
  })

  test('问诊患者、处方患者或处方问诊不匹配时均拒绝展示及下单', async () => {
    for (const overrides of [
      { getConsultationDetail: async () => consultation({ patientId: 9 }) },
      { getPrescriptionByConsultation: async () => prescription({ patientId: 9 }) },
      { getPrescriptionByConsultation: async () => prescription({ consultationId: 999 }) }
    ]) {
      const page = harness(overrides)
      await page.show()
      assert.equal(page.currentPrescription.value, null)
      assert.equal(page.canSubmit.value, false)
      page.goToOrder()
      assert.deepEqual(page.routes, [])
    }
  })

  test('商品查询失败保留失败行且不能只提交其余成功商品', async () => {
    const page = harness({ getProductDetail: async id => {
      if (Number(id) === 20) throw new Error('fixture-product-offline')
      return product(id)
    } })
    await page.show()
    assert.equal(page.cartItemsList.value.length, 4)
    assert.equal(page.cartItemsList.value.find(item => item.id === '20:21').loadFailure, true)
    assert.equal(page.canSubmit.value, false)
    page.goToOrder()
    assert.deepEqual(page.routes, [])
  })

  test('勾选只影响当前结算选择，空选不能导航', async () => {
    const page = harness()
    await page.show()
    page.toggleCartSelect('10:11')
    assert.equal(page.selectedCartCount.value, 3)
    assert.equal(page.selectedCartTotal.value, 192)
    assert.equal(cart.getCartEntries()['10:11'].selected, false)
    page.toggleCartSelectAll()
    page.toggleCartSelectAll()
    assert.equal(page.selectedCartCount.value, 0)
    assert.equal(page.canSubmit.value, false)
    page.goToOrder()
    assert.deepEqual(page.routes, [])
  })

  test('页面卸载或切换账号后忽略迟到处方，不能导航', async () => {
    for (const action of ['unload', 'changeSession']) {
      let resolve
      const page = harness({ getPrescriptionByConsultation: () => new Promise(done => { resolve = done }) })
      const pending = page.show()
      page[action]()
      resolve(prescription())
      await pending
      assert.equal(page.currentPrescription.value, null)
      assert.equal(page.canSubmit.value, false)
      page.goToOrder()
      assert.deepEqual(page.routes, [])
    }
  })

  test('较早刷新失败不能清掉较新刷新成功的资料', async () => {
    let reject, requests = 0
    const page = harness({ getPrescriptionByConsultation: () => ++requests === 1
      ? new Promise((resolve, fail) => { reject = fail })
      : Promise.resolve(prescription({ diagnosis: '较新的真实诊断' })) })
    const old = page.show()
    await page.show()
    reject(new Error('fixture-old-request-offline'))
    await old
    assert.equal(page.currentPrescription.value.diagnosis, '较新的真实诊断')
    assert.equal(page.loadError.value, '')
    assert.equal(page.canSubmit.value, true)
  })
})

describe('处方清单独立立即购买入口兼容', () => {
  test('直接购买数量及问卷凭据沿页面传递，不改购物车同SKU行', async () => {
    const page = harness({}, { selectedItems: '10:12', buyQuantity: '2',
      buyQuestionnaireId: '90', buyAnswerId: '91' })
    const before = structuredClone(cart.getCartEntries())
    await page.show()
    assert.equal(page.cartItemsList.value.length, 1)
    assert.equal(page.cartItemsList.value[0].quantity, 2)
    assert.equal(page.selectedCartTotal.value, 24)
    page.toggleCartSelect('10:12')
    assert.equal(page.canSubmit.value, false)
    page.toggleCartSelect('10:12')
    page.goToOrder()
    assert.equal(page.routes[0], '/pages/order/confirm?selectedItems=10:12&consultationId=123&patientId=8&buyQuantity=2&buyQuestionnaireId=90&buyAnswerId=91')
    assert.equal(page.storage.get('current_order').items[0].quantity, 2)
    assert.deepEqual(cart.getCartEntries(), before)
  })

  test('无效直接购买数量或缺少商品规格时禁止下单', async () => {
    for (const options of [{ buyQuantity: '0' }, { buyQuantity: '2', selectedItems: '' }]) {
      const page = harness({}, options)
      await page.show()
      assert.equal(page.canSubmit.value, false)
      page.goToOrder()
      assert.deepEqual(page.routes, [])
      assert.ok(page.loadError.value)
    }
  })
})
