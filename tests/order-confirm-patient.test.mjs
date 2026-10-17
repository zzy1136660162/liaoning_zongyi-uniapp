import assert from 'node:assert/strict'
import { loadSetup } from './sfc-harness.mjs'

let patientRows = []
const orders = []
const toasts = []
const page = loadSetup('pages/order/confirm.vue', {
  ref: value => ({ value }),
  computed: get => ({ get value() { return get() } }),
  onLoad: () => {}, onShow: () => {}, onMounted: () => {},
  getSessionGeneration: () => 1,
  isCurrentSession: () => true,
  assertCurrentSession: () => {},
  getPatientList: async () => patientRows,
  getCurrentCheckoutProductIds: () => [],
  validateCheckoutStock: () => ({ valid: true }),
  ensureWeChatIdentity: async () => ({ openid: 'mock-openid' }),
  createOrder: async order => { orders.push(order); return { id: 1 } },
  wechatSinglePay: async () => ({}),
  logButtonClick: () => {},
  STORAGE_KEY_CURRENT_ORDER: 'mock-current-order',
  ORDER_TYPE_THERAPY: 4,
  uni: {
    getStorageSync: () => null, setStorageSync: () => {},
    showToast: toast => toasts.push(toast),
    showLoading: () => {}, hideLoading: () => {}, redirectTo: () => {}
  }
}, ['loadCheckoutPatients', 'selectPatient', 'selectedPatient', 'patients', 'selectedRequiresConsultation',
  'checkoutContext', 'isTherapyOrder', 'selectedAddress', 'orderInfo', 'canSubmit', 'submitOrder'])

page.selectedRequiresConsultation.value = false
page.selectedAddress.value = { id: 10 }
page.orderInfo.value.items = [{ id: 100, name: 'mock goods', price: 12, quantity: 1 }]
page.orderInfo.value.cost.medicineCost = 12

patientRows = [{ id: 7, name: '就诊人甲' }, { id: 8, name: '就诊人乙', hisBindingStatus: 'UNKNOWN' }]
await page.loadCheckoutPatients()
assert.equal(page.selectedPatient.value, null, '多位就诊人必须主动选择')
assert.equal(page.canSubmit.value, false)
await page.submitOrder()
assert.equal(orders.length, 0, '未选患者不能创建订单')
assert.equal(toasts.at(-1).title, '请选择就诊人')

page.selectPatient({ detail: { value: '1' } })
assert.equal(page.selectedPatient.value.id, 8)
assert.equal(page.canSubmit.value, true, '医院同步结果待核查不阻断正常下单')
await page.submitOrder()
assert.equal(orders.at(-1).patientId, 8)
assert.equal(orders.at(-1).addressId, 10)

patientRows = [{ id: 7, name: '就诊人甲' }]
await page.loadCheckoutPatients()
assert.equal(page.selectedPatient.value, null, '患者被删除后不能自动切换成其他人')

page.selectedRequiresConsultation.value = true
page.checkoutContext.value = { consultationId: 11, patientId: 8 }
patientRows = [{ id: 7, name: '就诊人甲' }, { id: 8, name: '就诊人乙' }]
await page.loadCheckoutPatients()
assert.equal(page.selectedPatient.value.id, 8)
page.selectPatient({ detail: { value: '0' } })
assert.equal(page.selectedPatient.value.id, 8, '复诊患者不可在结算时切换')
patientRows = [{ id: 7, name: '就诊人甲' }]
await page.loadCheckoutPatients()
assert.equal(page.selectedPatient.value, null, '不能用其他患者替代已删除的复诊患者')

page.isTherapyOrder.value = true
page.selectedAddress.value = null
await page.loadCheckoutPatients()
await page.submitOrder()
assert.equal(orders.at(-1).orderType, 4)
assert.equal(orders.at(-1).patientId, 7)
assert.equal(orders.at(-1).addressId, undefined, '到店核销不创建配送地址')

console.log('order confirmation patient selection tests passed')
