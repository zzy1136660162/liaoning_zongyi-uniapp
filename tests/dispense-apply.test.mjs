import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as cart from '../utils/cart.js'
import * as mode from '../utils/consultation-mode.js'
import { loadSetup } from './sfc-harness.mjs'

const keys = ['7:1', '8:1', '9:1']
const product = id => ({ id, productName: `商品${id}`, productCategory: Number(id) - 6,
  goodsMerchantType: 1, status: 1, delSign: 0, available: true, stock: 20,
  skus: [{ id: 1, specText: `规格${id}`, price: Number(id), stock: 20, status: 1, delSign: 0 }] })
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }

const harness = (overrides = {}, route = {}) => {
  let mount, show, unmount, currentSession = true, patientCalls = 0
  let patientRows = [{ id: 8, name: '患者甲' }, { id: 9, name: '患者乙' }]
  const storage = new Map(), listeners = new Map(), routes = [], toasts = [], modals = [], deleted = []
  const uni = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key), $emit: (event, data) => listeners.get(event)?.(data),
    $on: (event, fn) => listeners.set(event, fn), $off: (event, fn) => {
      if (listeners.get(event) === fn) listeners.delete(event)
    },
    showLoading() {}, hideLoading() {}, showToast: value => toasts.push(value),
    showModal: value => modals.push(value), navigateBack() {},
    navigateTo: value => routes.push(value.url), redirectTo: value => routes.push(value.url)
  }
  globalThis.uni = uni
  cart.replaceCartData(Object.fromEntries(keys.map((key, index) => [key, {
    productId: String(index + 7), skuId: '1', productName: `商品${index + 7}`,
    quantity: [2, 1, 3][index], selected: true, available: true, stock: 20,
    productCategory: index + 1, goodsMerchantType: 1, price: index + 7
  }])))
  const options = { selectedItems: keys.join(','), ...route }
  const page = loadSetup('pages/dispense/apply.vue', {
    ...cart, ...mode,
    ref: value => ({ value }), computed: get => ({ get value() { return get() } }),
    onMounted: fn => { mount = fn }, onShow: fn => { show = fn }, onUnmounted: fn => { unmount = fn },
    getCurrentPages: () => [{ options }], getSessionGeneration: () => 1,
    isCurrentSession: () => currentSession,
    assertCurrentSession() {
      if (!currentSession) throw Object.assign(new Error('fixture-session-changed'), { code: 'SESSION_CHANGED' })
    },
    getProductDetail: async id => product(id),
    getPatientList: async () => { patientCalls++; return patientRows },
    deletePatient: async id => { deleted.push(id); patientRows = patientRows.filter(patient => patient.id !== id) },
    logPageView() {}, logButtonClick() {}, getImageUrl: value => value,
    STORAGE_KEY_CURRENT_CONSULTATION_ID: 'current_consultation_id', uni,
    console: { debug() {}, warn() {}, error() {} }, ...overrides
  }, ['loadPatientsFromAPI', 'loadProducts', 'patients', 'selectedPatient', 'cartItems',
    'selectedItems', 'directPurchase', 'onSubmit', 'onDeletePatient', 'selectPatient', 'onQuantityChange',
    'showAgreementDialog', 'showAgreement', 'agreementChecked', 'selectConsultationMode', 'consultationMode',
    'totalPrice', 'totalQuantity'])
  return { ...page, storage, listeners, routes, toasts, modals, deleted,
    mount: async () => { mount(); await flush() }, show: () => show(), unmount: () => unmount(),
    changeSession: () => { currentSession = false }, patientCalls: () => patientCalls,
    changePatients: rows => { patientRows = rows },
    patientChanged: id => uni.$emit('patientChanged', { patientId: id }) }
}

test('申请页保留混购、数量修改、协议弹窗和AI问诊路由', async () => {
  const page = harness()
  await page.mount()
  await page.show()
  assert.equal(page.totalPrice.value, 49)
  assert.equal(page.totalQuantity.value, 6)
  assert.equal(page.selectedPatient.value.id, 8)
  assert.deepEqual(page.cartItems.value.map(item => item.id), keys)
  page.onQuantityChange(page.cartItems.value[0], 4)
  assert.equal(page.totalPrice.value, 63)
  assert.equal(page.totalQuantity.value, 8)
  assert.equal(cart.getCartEntries()['7:1'].quantity, 4)
  page.showAgreementDialog()
  assert.equal(page.showAgreement.value, true)
  page.agreementChecked.value = true
  page.onSubmit()
  const query = new URL(page.routes[0], 'https://fixture.invalid').searchParams
  assert.equal(query.get('selectedItems'), keys.join(','))
  assert.equal(query.get('patientId'), '8')
  assert.equal(query.get('consultationMode'), 'ai')
  assert.equal(query.get('doctorId'), null)
  assert.equal(query.get('doctorName'), mode.AI_DOCTOR.name)
  assert.equal(query.get('doctorAvatar'), mode.AI_DOCTOR.avatar)
})

test('人工问诊仍在提交时随机分配一次，ID姓名头像保持同一对象', async t => {
  let randoms = 0
  const page = harness()
  await page.mount()
  await page.show()
  t.mock.method(Math, 'random', () => { randoms++; return 0 })
  page.selectConsultationMode(mode.CONSULTATION_MODE_MANUAL)
  page.agreementChecked.value = true
  page.onSubmit()
  const query = new URL(page.routes[0], 'https://fixture.invalid').searchParams
  assert.equal(query.get('consultationMode'), 'manual')
  assert.equal(query.get('doctorId'), String(mode.MANUAL_DOCTORS[0].id))
  assert.equal(query.get('doctorName'), mode.MANUAL_DOCTORS[0].name)
  assert.equal(query.get('doctorAvatar'), mode.MANUAL_DOCTORS[0].avatar)
  assert.equal(randoms, 1)
})

test('患者编辑事件只记优先ID，返回页刷新一次并保留之后的当前选择', async () => {
  const page = harness()
  await page.mount()
  await page.show()
  assert.equal(page.patientCalls(), 1)
  page.changePatients([{ id: 8, name: '患者甲' }, { id: 9, name: '患者乙' }, { id: 10, name: '新患者' }])
  page.patientChanged(10)
  assert.equal(page.patientCalls(), 1, '保存事件不能与返回页面各发一次请求')
  await page.show()
  assert.equal(page.patientCalls(), 2)
  assert.equal(page.selectedPatient.value.id, 10)
  page.selectPatient(page.patients.value[1])
  await page.show()
  assert.equal(page.selectedPatient.value.id, 9)
})

test('编辑后的优先患者保留到最新一次show应用，乱序返回不会丢失选择意图', async () => {
  let calls = 0
  const responses = []
  const page = harness({ getPatientList: () => ++calls === 1
    ? Promise.resolve([{ id: 8, name: '患者甲' }])
    : new Promise(resolve => { responses.push(resolve) }) })
  await page.mount()
  await page.show()
  page.patientChanged(10)
  const first = page.show()
  const second = page.show()
  const rows = [{ id: 8, name: '患者甲' }, { id: 10, name: '新患者' }]
  responses[1](rows)
  await second
  assert.equal(page.selectedPatient.value.id, 10)
  responses[0](rows)
  await first
  assert.equal(page.selectedPatient.value.id, 10)
})

test('患者刷新失败后再次show仍优先选择本次编辑的患者', async () => {
  let calls = 0
  const page = harness({ getPatientList: async () => {
    if (++calls === 2) throw new Error('fixture-patients-offline')
    return [{ id: 8, name: '患者甲' }, { id: 10, name: '新患者' }]
  } })
  await page.mount()
  await page.show()
  page.patientChanged(10)
  await page.show()
  assert.equal(page.selectedPatient.value, null)
  await page.show()
  assert.equal(page.selectedPatient.value.id, 10)
})

test('请求等待期间新增的优先患者不能被旧请求消费', async () => {
  let calls = 0
  const responses = []
  const page = harness({ getPatientList: () => ++calls === 1
    ? Promise.resolve([{ id: 8, name: '患者甲' }])
    : new Promise(resolve => { responses.push(resolve) }) })
  await page.mount()
  await page.show()
  page.patientChanged(10)
  const first = page.show()
  page.patientChanged(11)
  const rows = [{ id: 8, name: '患者甲' }, { id: 10, name: '新患者甲' }, { id: 11, name: '新患者乙' }]
  responses[0](rows)
  await first
  assert.equal(page.selectedPatient.value.id, 10)
  const second = page.show()
  responses[1](rows)
  await second
  assert.equal(page.selectedPatient.value.id, 11)
})

test('患者默认选择和删除后的回落策略沿用原行为', async () => {
  const page = harness()
  await page.mount()
  await page.show()
  page.onDeletePatient(8)
  assert.equal(page.modals[0].content, '确定要删除此就诊人吗？')
  await page.modals[0].success({ confirm: false })
  assert.deepEqual(page.deleted, [])
  await page.modals[0].success({ confirm: true })
  assert.deepEqual(page.deleted, [8])
  assert.ok(page.toasts.some(toast => toast.title === '删除成功'))
  assert.equal(page.selectedPatient.value.id, 9)
  page.changePatients([])
  await page.show()
  assert.equal(page.selectedPatient.value, null)
})

test('切换账号或卸载后忽略迟到患者响应并移除事件监听', async () => {
  for (const action of ['changeSession', 'unmount']) {
    let resolve
    const page = harness({ getPatientList: () => new Promise(done => { resolve = done }) })
    await page.mount()
    const pending = page.show()
    page[action]()
    resolve([{ id: 10, name: '迟到患者' }])
    await pending
    assert.deepEqual(page.patients.value, [])
    assert.equal(page.selectedPatient.value, null)
    assert.deepEqual(page.toasts, [])
    page.onSubmit()
    assert.deepEqual(page.routes, [])
    if (action === 'unmount') assert.equal(page.listeners.has('patientChanged'), false)
  }
})

test('较早患者请求失败不覆盖后一次成功结果', async () => {
  let reject, calls = 0
  const page = harness({ getPatientList: () => ++calls === 1
    ? new Promise((resolve, fail) => { reject = fail })
    : Promise.resolve([{ id: 10, name: '最新患者' }]) })
  const old = page.show()
  await page.show()
  reject(new Error('fixture-old-patients-offline'))
  await old
  assert.equal(page.selectedPatient.value.id, 10)
  assert.deepEqual(page.toasts, [])
})

test('患者接口失败沿用原错误提示并清空选择', async () => {
  const page = harness({ getPatientList: async () => { throw new Error('fixture-patients-offline') } })
  await page.show()
  assert.deepEqual(page.patients.value, [])
  assert.equal(page.selectedPatient.value, null)
  assert.equal(page.toasts[0].title, 'fixture-patients-offline')
})

test('删除等待期间切换账号或卸载，不显示旧账号成功提示或刷新患者', async () => {
  for (const action of ['changeSession', 'unmount']) {
    let resolve
    const page = harness({ deletePatient: () => new Promise(done => { resolve = done }) })
    page.onDeletePatient(8)
    const pending = page.modals[0].success({ confirm: true })
    page[action]()
    resolve()
    await pending
    assert.deepEqual(page.toasts, [])
    assert.equal(page.patientCalls(), 0)
  }
})

test('商品请求完成前卸载或切换账号，不填充旧页或跳转', async () => {
  for (const action of ['changeSession', 'unmount']) {
    let resolve
    const wait = new Promise(done => { resolve = done })
    const page = harness({ getProductDetail: async id => { await wait; return product(id) } })
    const pending = page.loadProducts()
    page[action]()
    resolve()
    await pending
    assert.deepEqual(page.cartItems.value, [])
    assert.deepEqual(page.toasts, [])
    assert.deepEqual(page.routes, [])
  }
})

test('立即购买数量和问卷凭据沿用独立条目，不覆盖购物车同SKU', async () => {
  const page = harness({}, { selectedItems: '7:1', buyQuantity: '3', buyQuestionnaireId: '90', buyAnswerId: '91' })
  const before = structuredClone(cart.getCartEntries())
  await page.mount()
  await page.show()
  assert.equal(page.cartItems.value[0].quantity, 3)
  page.onQuantityChange(page.cartItems.value[0], 4)
  page.agreementChecked.value = true
  page.onSubmit()
  const query = new URL(page.routes[0], 'https://fixture.invalid').searchParams
  assert.equal(query.get('selectedItems'), '7:1')
  assert.equal(query.get('buyQuantity'), '4')
  assert.equal(query.get('buyQuestionnaireId'), '90')
  assert.equal(query.get('buyAnswerId'), '91')
  assert.deepEqual(cart.getCartEntries(), before)
})
