import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadSetup } from './sfc-harness.mjs'

let patientRows = []
let patientListError = null
let therapy = false
const orders = []
const toasts = []
const modals = []
const routes = []
const page = loadSetup('pages/order/confirm.vue', {
  ref: value => ({ value }),
  computed: get => ({ get value() { return get() } }),
  onLoad: () => {}, onShow: () => {}, onMounted: () => {},
  getSessionGeneration: () => 1,
  isCurrentSession: () => true,
  assertCurrentSession: () => {},
  getPatientList: async () => { if (patientListError) throw patientListError; return patientRows },
  getCurrentCheckoutProductIds: () => ['100:1'],
  setCheckoutProductIds: () => {},
  getCartEntries: () => ({ '100:1': { productId: 100, skuId: 1, quantity: 1 } }),
  splitCartItemKey: () => ({ productId: 100 }),
  getProductDetail: async () => ({ id: 100, status: 1, delSign: 0, productName: 'mock goods', price: 12, available: true, stock: 10, skus: [{ id: 1, price: 12, status: 1, delSign: 0, stock: 10 }] }),
  resolveProductFlow: () => ({ valid: true, requiresConsultation: false, requiresShipping: !therapy, allTraditionalTherapy: therapy }),
  loadCartItems: categories => categories.flatMap(category => category.products.map(product => ({ ...product, quantity: 1 }))),
  buildOrderInfo: items => ({ items, prescriptions: [], deliveryInfo: {}, cost: { medicineCost: 12, shippingFee: 0 }, total: 12 }),
  getAddressList: async () => [{ id: 10, isDefault: true }],
  queryFreight: async () => ({}),
  validateCheckoutStock: () => ({ valid: true }),
  ensureWeChatIdentity: async () => ({ openid: 'mock-openid' }),
  createOrder: async order => { orders.push(order); return { id: 1 } },
  wechatSinglePay: async () => ({}),
  logButtonClick: () => {},
  STORAGE_KEY_CURRENT_ORDER: 'mock-current-order',
  STORAGE_KEY_DEFAULT_ADDRESS_ID: 'mock-address-id',
  ORDER_TYPE_THERAPY: 4,
  uni: {
    getStorageSync: () => null, setStorageSync: () => {}, removeStorageSync: () => {},
    showToast: toast => toasts.push(toast),
    showModal: modal => modals.push(modal),
    navigateTo: route => routes.push(route.url),
    showLoading: () => {}, hideLoading: () => {}, redirectTo: () => {}
  }
}, ['loadCheckoutPatients', 'selectPatient', 'removeSelectedPatient', 'selectedPatient', 'patients', 'selectedRequiresConsultation',
  'checkoutContext', 'isTherapyOrder', 'selectedAddress', 'orderInfo', 'canSubmit', 'submitOrder'])

page.selectedRequiresConsultation.value = false
page.selectedAddress.value = { id: 10 }
page.orderInfo.value.items = [{ id: '100:1', productId: 100, skuId: 1, name: 'mock goods', price: 12, quantity: 1 }]
page.orderInfo.value.cost.medicineCost = 12

patientRows = [{ id: 7, name: '就诊人甲' }, { id: 8, name: '就诊人乙', hisBindingStatus: 'UNKNOWN' }]
await page.loadCheckoutPatients()
assert.equal(page.selectedPatient.value, null, '多位就诊人必须主动选择')
assert.equal(page.canSubmit.value, false)
await page.submitOrder()
assert.equal(orders.length, 0, '未选患者不能创建订单')
assert.equal(toasts.at(-1).title, '请选择就诊人')

patientRows = [{ id: 8, name: '就诊人乙' }]
await page.loadCheckoutPatients()
assert.equal(page.selectedPatient.value, null, '多位候选未选择后刷新也不能自动决定就诊人')
patientRows = [{ id: 7, name: '就诊人甲' }, { id: 8, name: '就诊人乙', hisBindingStatus: 'UNKNOWN' }]
await page.loadCheckoutPatients()
page.selectPatient(page.patients.value[1])
assert.equal(page.selectedPatient.value.id, 8)
assert.equal(page.canSubmit.value, true, '医院同步结果待核查不阻断正常下单')
await page.submitOrder()
assert.equal(orders.at(-1).patientId, 8)
assert.equal(orders.at(-1).addressId, 10)

page.removeSelectedPatient()
assert.equal(page.selectedPatient.value, null, '移除仅清空本次订单的选择')
assert.equal(page.patients.value.length, 2, '移除后可选列表保留全部就诊人')
assert.equal(page.canSubmit.value, false)
await page.loadCheckoutPatients()
assert.equal(page.selectedPatient.value, null, '刷新不会恢复被移除的选择')
page.selectPatient(page.patients.value[0])
page.selectPatient(page.patients.value[1])
assert.equal(page.selectedPatient.value.id, 8, '选择另一位时替换当前选择')

patientRows = [{ id: 7, name: '就诊人甲' }]
await page.loadCheckoutPatients()
assert.equal(page.selectedPatient.value, null, '患者被删除后不能自动切换成其他人')
await page.loadCheckoutPatients()
assert.equal(page.selectedPatient.value, null, '再次刷新也不能自动替换已失效患者')

page.selectPatient(page.patients.value[0])
page.selectedRequiresConsultation.value = true
page.checkoutContext.value = { consultationId: 11, patientId: 8 }
patientRows = [{ id: 7, name: '就诊人甲' }, { id: 8, name: '就诊人乙' }]
await page.loadCheckoutPatients()
assert.equal(page.selectedPatient.value.id, 8)
page.selectPatient(page.patients.value[0])
assert.equal(page.selectedPatient.value.id, 8, '复诊患者不可在结算时切换')
page.removeSelectedPatient()
await page.loadCheckoutPatients()
assert.equal(page.selectedPatient.value, null, '复诊移除后也只清空本次选择')
page.selectPatient(page.patients.value[1])
assert.equal(page.selectedPatient.value.id, 8, '仍可重新选择对应的复诊就诊人')
patientRows = [{ id: 7, name: '就诊人甲' }]
await page.loadCheckoutPatients()
assert.equal(page.selectedPatient.value, null, '不能用其他患者替代已删除的复诊患者')

page.isTherapyOrder.value = true
page.selectedRequiresConsultation.value = false
therapy = true
page.selectedAddress.value = null
await page.loadCheckoutPatients()
page.selectPatient(page.patients.value[0])
await page.submitOrder()
assert.equal(orders.at(-1).orderType, undefined, '订单购买分类由服务端按明细核定')
assert.equal(orders.at(-1).patientId, 7)
assert.equal(orders.at(-1).addressId, undefined, '到店核销不创建配送地址')

patientRows = [{ id: '7', name: '就诊人甲', idNumberMasked: '1101**********0019' }]
await page.loadCheckoutPatients()
assert.equal(page.selectedPatient.value.id, '7', '刷新兼容字符串与数字 ID')
page.removeSelectedPatient()
await page.submitOrder()
assert.equal(page.selectedPatient.value, null, '提交前重新加载不能恢复已移除的唯一就诊人')
assert.equal(toasts.at(-1).title, '请选择就诊人')

page.selectPatient(page.patients.value[0])
patientListError = new Error('fixture offline')
await page.loadCheckoutPatients()
assert.equal(page.selectedPatient.value, null)
patientListError = null
patientRows = [{ id: 9, name: '就诊人丙' }]
await page.loadCheckoutPatients()
assert.equal(page.selectedPatient.value, null, '请求失败后恢复不能自动选择其他人')

patientRows = [{ id: 9, name: '待完善就诊人', profileComplete: false, profileIncompleteReason: '请完善出生日期和性别' }]
await page.loadCheckoutPatients()
page.selectPatient(page.patients.value[0])
const createdBeforeCompletion = orders.length
await page.submitOrder()
assert.equal(orders.length, createdBeforeCompletion, '资料未完善不能创建订单')
assert.match(modals.at(-1).content, /出生日期和性别/)
modals.at(-1).success({ confirm: false })
assert.deepEqual(routes, [], '取消提示不会跳转')
modals.at(-1).success({ confirm: true })
assert.equal(routes.at(-1), '/pages/user/patient_list')
patientRows = [{ id: 9, name: '已完善就诊人', profileComplete: true }]
await page.loadCheckoutPatients()
await page.submitOrder()
assert.equal(orders.length, createdBeforeCompletion + 1, '完善后返回原页可以继续提交')
assert.equal(orders.at(-1).patientId, 9)
patientRows = [{ id: 9, profileComplete: false }]
await page.submitOrder()
assert.equal(orders.length, createdBeforeCompletion + 1, '提交前最新校验发现缺资料也必须阻止创建')
assert.equal(modals.at(-1).title, '请完善就诊人信息')

const source = readFileSync(new URL('../pages/order/confirm.vue', import.meta.url), 'utf8')
assert.match(source, /v-for="patient in patients"/, '可选就诊人直接列在确认页')
assert.match(source, /patient\.idNumberMasked/, '仅展示脱敏证件号')
assert.match(source, /当前账号下同一身份证无需重复添加/, '身份证去重范围是当前登记账号')
assert.doesNotMatch(source, /deletePatient/, '订单确认页不得删除全局就诊人')

const pendingLists = []
let unloadPage
const asyncPage = loadSetup('pages/order/confirm.vue', {
  ref: value => ({ value }), computed: get => ({ get value() { return get() } }),
  onLoad() {}, onShow() {}, onUnload: callback => { unloadPage = callback },
  getSessionGeneration: () => 1, isCurrentSession: () => true, assertCurrentSession() {},
  getPatientList: () => new Promise(resolve => { pendingLists.push(resolve) }),
  uni: { showToast() {}, hideLoading() {} }
}, ['loadCheckoutPatients', 'selectPatient', 'selectedPatient', 'patients', 'loadingPatients'])
const earlier = asyncPage.loadCheckoutPatients()
const latest = asyncPage.loadCheckoutPatients()
pendingLists[1]([{ id: 8, name: '就诊人乙' }])
await latest
assert.equal(asyncPage.selectedPatient.value.id, 8, '首次只有一人时可以默认选择')
pendingLists[0]([{ id: 7, name: '就诊人甲' }])
await earlier
assert.equal(asyncPage.selectedPatient.value.id, 8, '迟到请求不能替换最新候选和选择')
assert.equal(asyncPage.loadingPatients.value, false)
const afterUnload = asyncPage.loadCheckoutPatients()
unloadPage()
pendingLists[2]([{ id: 9, name: '就诊人丙' }])
await afterUnload
assert.equal(asyncPage.selectedPatient.value.id, 8, '页面卸载后忽略迟到患者响应')

console.log('order confirmation patient selection tests passed')
