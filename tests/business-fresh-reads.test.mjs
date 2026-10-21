import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadOptions, loadSetup } from './sfc-harness.mjs'

const reactive = {
  ref: value => ({ value }),
  computed: getter => ({ get value() { return getter() } }),
  onLoad() {}, onMounted() {}, onShow() {},
  getSessionGeneration: () => 1, isCurrentSession: value => value === 1,
  assertCurrentSession() {}
}
const quiet = { debug() {}, log() {}, warn() {}, error() {} }

test('购物车连续展示均查询后台，并发返回页面仍排队刷新', async () => {
  let calls = 0, finish
  const options = loadOptions('pages/cart/cart.vue', {
    TabBar: {}, getImageUrl: value => value, getToken: () => 'fixture-token',
    BASE_URL: 'fixture', logPageView() {}, console: quiet
  })
  const page = { ...options.data(), ...options.methods }
  page.loadCartFromServer = async () => { calls++ }
  await page.loadCartPageData()
  await page.loadCartPageData()
  assert.equal(calls, 2)

  page.loadCartFromServer = () => { calls++; return new Promise(resolve => { finish = resolve }) }
  const pending = page.loadCartPageData()
  options.onShow.call(page)
  assert.equal(page.pendingServerRefresh, true)
  page.loadCartFromServer = async () => { calls++ }
  finish()
  await pending
  assert.equal(calls, 4)
})

test('地址每次加载取新列表，接口失败不会恢复持久化旧地址', async () => {
  const values = new Map([['shipping_addresses', [{ id: 'stale' }]]])
  let fail = false, calls = 0
  const page = loadSetup('pages/order/address_list.vue', {
    ...reactive, console: quiet,
    getAddressList: async () => { if (fail) throw new Error('offline'); return [{ id: ++calls }] },
    uni: { getStorageSync: key => values.get(key), setStorageSync: (key, value) => values.set(key, value), showToast() {} }
  }, ['loadAddresses', 'addresses'])
  await page.loadAddresses(); assert.equal(page.addresses.value[0].id, 1)
  await page.loadAddresses(); assert.equal(page.addresses.value[0].id, 2)
  fail = true
  await page.loadAddresses()
  assert.deepEqual(page.addresses.value, [])
  assert.deepEqual(values.get('shipping_addresses'), [{ id: 'stale' }])
})

test('选择地址只传ID，确认页从最新地址列表解析且不使用旧对象', async () => {
  const values = new Map([['temp_selected_address', 7], ['shipping_addresses', [{ id: 7, name: '旧地址' }]]])
  let fail = false
  const page = loadSetup('pages/order/confirm.vue', {
    ...reactive, console: quiet, getCurrentCheckoutProductIds: () => [],
    STORAGE_KEY_CURRENT_ORDER: 'current_order', STORAGE_KEY_DEFAULT_ADDRESS_ID: 'default_address_id',
    getAddressList: async () => { if (fail) throw new Error('offline'); return [{ id: 7, name: '最新地址' }] },
    queryFreight: async () => ({}),
    uni: { getStorageSync: key => values.get(key), setStorageSync: (key, value) => values.set(key, value),
      removeStorageSync: key => values.delete(key), showToast() {}, showLoading() {}, hideLoading() {} }
  }, ['loadAddresses', 'selectedAddress', 'selectedRequiresShipping'])
  page.selectedRequiresShipping.value = true
  await page.loadAddresses()
  assert.equal(page.selectedAddress.value.name, '最新地址')
  assert.equal(values.has('temp_selected_address'), false)
  fail = true
  await page.loadAddresses()
  assert.equal(page.selectedAddress.value, null)
})

test('订单详情商品与医生重复读取不复用上次结果', async () => {
  let products = 0, doctors = 0
  const options = loadOptions('pages/order/order-detail.vue', {
    getImageUrl: value => value, console: quiet,
    getProductDetail: async id => ({ id, price: ++products }),
    getDoctorDetail: async id => ({ id, name: `doctor-${++doctors}` })
  })
  const page = options.methods
  assert.equal((await page.loadProductDetail(7)).price, 1)
  assert.equal((await page.loadProductDetail(7)).price, 2)
  assert.equal((await page.loadDoctorDetail(8)).name, 'doctor-1')
  assert.equal((await page.loadDoctorDetail(8)).name, 'doctor-2')
})

test('订单详情请求失败不从购物车或本地订单构造服务端状态', async () => {
  const options = loadOptions('pages/order/order-detail.vue', {
    getImageUrl: value => value, console: quiet,
    getOrderDetail: async () => { throw new Error('offline') },
    uni: { showLoading() {}, hideLoading() {}, showToast() {},
      getStorageSync() { throw new Error('must not read local order') } }
  })
  const page = { ...options.data(), ...options.methods, orderLoaded: true, allCartItems: [{ id: 7 }] }
  await page.loadOrderDetail(1)
  assert.equal(page.orderLoaded, false)
  assert.deepEqual(page.allCartItems, [])
})

test('处方订单状态忽略current_order草稿，每次查询真实状态', async () => {
  let calls = 0
  const options = loadOptions('pages/prescription/detail.vue', {
    ...reactive, AI_DOCTOR: { name: 'fixture doctor' }, getImageUrl: value => value, console: quiet,
    getOrderByPrescriptionId: async () => ({ id: 5, orderNo: 'real', orderStatus: ++calls, payStatus: 1 }),
    uni: { getStorageSync() { throw new Error('must not read draft as order state') } }
  })
  const page = { ...options.data(), ...options.methods }
  page.pageOptions.prescriptionId = 9
  await page.loadOrderStatus(); assert.equal(page.orderStatus.status, 1)
  await page.loadOrderStatus(); assert.equal(page.orderStatus.status, 2)
  assert.equal(calls, 2)
})

test('处方详情接口失败不会读写旧处方响应副本', async () => {
  const options = loadOptions('pages/prescription/detail.vue', {
    ...reactive, AI_DOCTOR: { name: 'fixture doctor' }, getImageUrl: value => value, console: quiet,
    getPrescriptionDetail: async () => { throw new Error('offline') },
    getPrescriptionItems: async () => [],
    uni: { showLoading() {}, hideLoading() {}, showToast() {},
      getStorageSync() { throw new Error('must not read saved prescription response') },
      setStorageSync() { throw new Error('must not save prescription response') } }
  })
  const page = { ...options.data(), ...options.methods }
  await page.loadPrescriptionById(9)
  assert.equal(page.prescriptionLoaded, false)
  assert.deepEqual(page.detail.prescriptionItems, [])
})

test('购物车新业务字段覆盖旧元数据，0值有效且问卷新启用需要重新通过', async () => {
  const values = new Map()
  globalThis.uni = { getStorageSync: key => values.get(key), setStorageSync: (key, value) => values.set(key, value), $emit() {} }
  const cart = await import('../utils/cart.js')
  cart.replaceCartData({ '7:1': { productId: 7, skuId: 1, selected: false, quantity: 3,
    stock: 8, available: true, productCategory: 1, goodsMerchantType: 1, needQuestionnaire: 0, questionnairePassed: true } })
  const product = { id: '7:1', productId: 7, skuId: 1, stock: 8, available: true, price: 10, productCategory: 2,
    goodsMerchantType: 2, needQuestionnaire: 1, questionnaireId: 101 }
  let [item] = cart.loadCartItems([{ products: [product] }])
  assert.equal(item.productCategory, 2); assert.equal(item.goodsMerchantType, 2)
  assert.equal(item.needQuestionnaire, 1); assert.equal(item.questionnairePassed, false)
  assert.equal(item.questionnaireId, 101); assert.equal(item.answerId, null)
  assert.equal(item.quantity, 3); assert.equal(item.selected, false)
  assert.equal(cart.getCartProductInfo(7, 1).goodsMerchantType, 2)

  ;[item] = cart.loadCartItems([{ products: [{ ...product, productCategory: 0, goodsMerchantType: 0, needQuestionnaire: 0 }] }])
  assert.equal(item.productCategory, 0); assert.equal(item.goodsMerchantType, 0); assert.equal(item.needQuestionnaire, 0)
  assert.equal(item.answerId, null)
  ;[item] = cart.loadCartItems([{ products: [{ id: '7:1', productId: 7, skuId: 1, stock: 8, available: true, price: 10 }] }])
  assert.equal(item.goodsMerchantType, 0, '缺失字段兼容已有元数据')
  ;[item] = cart.loadCartItems([{ products: [{ ...product, productCategory: 2, goodsMerchantType: null, needQuestionnaire: 0 }] }])
  assert.equal(item.goodsMerchantType, 0, '无效空商户不推断成另一业务类型')
})

test('购物车问卷相同保留用户答案，问卷换绑清除旧通过态及答案', async () => {
  const values = new Map()
  globalThis.uni = { getStorageSync: key => values.get(key), setStorageSync: (key, value) => values.set(key, value), $emit() {} }
  const cart = await import('../utils/cart.js')
  cart.replaceCartData({ '7:1': { productId: 7, skuId: 1, selected: true, quantity: 2,
    stock: 8, available: true, needQuestionnaire: 1, questionnaireId: 101, answerId: 55, questionnairePassed: true } })
  const product = { id: '7:1', productId: 7, skuId: 1, stock: 8, available: true, price: 10, needQuestionnaire: 1, questionnaireId: 101 }
  let [item] = cart.loadCartItems([{ products: [product] }])
  assert.equal(item.answerId, 55); assert.equal(item.questionnairePassed, true)
  ;[item] = cart.loadCartItems([{ products: [{ ...product, questionnaireId: 102 }] }])
  assert.equal(item.questionnaireId, 102)
  assert.equal(item.answerId, null); assert.equal(item.questionnairePassed, false)
  assert.equal(item.quantity, 2); assert.equal(item.selected, true)

  cart.addCartItem({ ...product, skuId: 1, productCategory: 3, goodsMerchantType: 0, questionnaireId: 103 }, 2,
    { productCategory: 2, goodsMerchantType: 2, questionnaireId: 101, answerId: 55, questionnairePassed: true })
  const stored = cart.getCartProductInfo(7, 1)
  assert.equal(stored.productCategory, 3); assert.equal(stored.goodsMerchantType, 0)
  assert.equal(stored.questionnaireId, 103); assert.equal(stored.answerId, null); assert.equal(stored.questionnairePassed, false)
  ;[item] = cart.loadCartItems([{ products: [{ ...product, questionnaireId: null }] }])
  assert.equal(item.questionnaireId, null, '显式null清除旧问卷ID')
  assert.equal(item.answerId, null); assert.equal(item.questionnairePassed, false)
})
