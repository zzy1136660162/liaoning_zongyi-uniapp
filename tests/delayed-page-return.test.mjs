import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadOptions, loadSetup } from './sfc-harness.mjs'
import * as patients from '../utils/patient.js'
import { createPageReturn } from '../utils/page-return.js'

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
const routes = {
  address: 'pages/order/address_edit.vue', patient: 'pages/dispense/patient_edit.vue',
  refund: 'pages/order/refund_apply.vue', logistics: 'pages/order/refund_logistics.vue',
  detail: 'pages/order/refund_detail.vue'
}
const fixtureOrder = () => ({ id: 7, orderStatus: 1, payStatus: 1, items: [
  { id: 8, productId: 9, productCategorySnapshot: 1, price: 10, quantity: 1, refundableQuantity: 1 }
] })

const createPage = async (kind, { invalid = false, root = false, syncStatus = 'SUCCESS' } = {}) => {
  let generation = 1, now = 0, nextTimer = 0, saveResult = () => Promise.resolve({ id: 7, hisBindingStatus: syncStatus })
  const owner = { route: routes[kind].replace('.vue', ''), options: {} }
  const stack = root ? [owner] : [{ route: 'pages/user/profile' }, { route: 'fixture-list' }, owner]
  const timers = new Map(), callbacks = [], navigation = [], hooks = {}, saves = []
  const schedule = (fn, delay) => {
    const id = nextTimer++
    timers.set(id, { fn, at: now + delay }); callbacks.push(fn)
    return id
  }
  const cancel = id => timers.delete(id)
  const advance = ms => {
    now += ms
    for (const [id, timer] of [...timers]) {
      if (timer.at > now || !timers.has(id)) continue
      timers.delete(id); timer.fn()
    }
  }
  const save = async (...args) => { saves.push(args); return saveResult() }
  const mocks = {
    ...patients,
    ref: value => ({ value }), reactive: value => value,
    computed: get => ({ get value() { return get() } }), watch() {}, onMounted() {},
    onLoad: fn => { hooks.load = fn }, onShow: fn => { hooks.show = fn },
    onHide: fn => { hooks.hide = fn }, onUnload: fn => { hooks.unload = fn },
    getSessionGeneration: () => generation, isCurrentSession: value => value === generation,
    assertCurrentSession: value => { if (value !== generation) throw Object.assign(new Error('session changed'), { code: 'SESSION_CHANGED' }) },
    getCurrentPages: () => stack,
    setTimeout: schedule, clearTimeout: cancel,
    console: { error() {}, log() {}, warn() {}, debug() {} },
    STORAGE_KEY_USER_REGISTER: 'fixture-user',
    getImageUrl: value => value,
    addAddress: save, updateAddress: save, addPatient: save, updatePatient: save,
    applyRefund: save, submitReturnLogistics: save,
    getPatientDetail: async () => { throw new Error('load failed') },
    getRefundDetail: async () => ({ status: 1, paymentRefundStatus: 'PENDING' }),
    getOrderDetail: async () => fixtureOrder(), checkCanApplyRefund: async () => true,
    uni: {
      showLoading() {}, hideLoading() {}, showToast() {}, $emit() {}, getStorageSync() {},
      setNavigationBarTitle() {}, request: options => options.success({ data: [] }),
      navigateBack: () => { navigation.push('back'); stack.pop() },
      redirectTo: options => { navigation.push(options.url); stack.splice(-1, 1, { route: options.url }) }
    }
  }
  let state, submit
  if (['address', 'patient'].includes(kind)) {
    state = loadSetup(routes[kind], mocks, kind === 'address' ? ['formData', 'saveAddress']
      : ['formData', 'handleSubmit', 'loadPatient'])
    await hooks.load({})
    if (kind === 'address') {
      Object.assign(state.formData, { name: '测试收货人', phone: '13800138000', province: '辽宁省', city: '沈阳市', district: '和平区', detail: '测试地址' })
      submit = () => state.saveAddress()
    } else {
      Object.assign(state.formData, { name: '测试就诊人', idType: '护照', idNumber: 'FIXTURE', gender: '男', birthDate: '1990-01-01', phone: '13800138000', patientType: 'adult' })
      submit = () => state.handleSubmit()
    }
  } else {
    const definition = loadOptions(routes[kind], mocks)
    state = { ...definition.data(), ...definition.methods }
    for (const [name, getter] of Object.entries(definition.computed || {})) Object.defineProperty(state, name, { get: () => getter.call(state) })
    for (const [key, hook] of [['load', 'onLoad'], ['show', 'onShow'], ['hide', 'onHide'], ['unload', 'onUnload']]) {
      hooks[key] = options => definition[hook]?.call(state, options)
    }
    hooks.load(invalid ? {} : { orderId: 7, refundApplicationId: 8 })
    await flush()
    if (kind === 'refund') {
      state.applyOrderData(fixtureOrder()); state.selectReason('个人原因不想要了')
      submit = () => state.submitRefund()
    } else if (kind === 'logistics') {
      submit = () => state.viewRefundDetail()
    }
  }
  return { state, submit, timers, callbacks, navigation, stack, owner, saves, advance,
    hide: () => hooks.hide?.(), show: () => hooks.show?.(), unload: () => hooks.unload?.(),
    changeSession: () => { generation++ }, setSaveResult: fn => { saveResult = fn } }
}

for (const kind of ['address', 'patient', 'refund']) {
  test(`${kind}保存后按原提示时长自动返回一次`, async () => {
    const page = await createPage(kind)
    await page.submit()
    assert.equal(page.saves.length, 1)
    const delay = kind === 'patient' ? 1200 : 1500
    page.advance(delay - 1); assert.equal(page.navigation.length, 0)
    page.advance(1); assert.deepEqual(page.navigation, ['back'])
    assert.equal(page.stack.at(-1).route, 'fixture-list')
    page.advance(5000); assert.equal(page.navigation.length, 1)
  })

  test(`${kind}提前返回后清理定时器，不误退列表或后来打开的同名页面`, async () => {
    const page = await createPage(kind)
    await page.submit()
    page.stack.pop(); page.unload()
    assert.equal(page.timers.size, 0)
    page.stack.push({ ...page.owner })
    // 模拟清理前已进入任务队列的旧回调，不能只依赖 clearTimeout。
    page.callbacks.forEach(fn => fn()); page.advance(5000)
    assert.equal(page.navigation.length, 0)
    assert.equal(page.stack.length, 3)
  })

  test(`${kind}隐藏后取消返回，即使重新显示也不恢复旧定时器`, async () => {
    const page = await createPage(kind)
    await page.submit()
    page.hide(); page.stack.push({ route: 'fixture-other' })
    assert.equal(page.timers.size, 0)
    page.advance(5000); assert.equal(page.navigation.length, 0)
    page.stack.pop(); page.show(); await flush()
    page.advance(5000); assert.equal(page.navigation.length, 0)
  })

  test(`${kind}回调核对页面实例及会话，不能只比较路由名称`, async () => {
    for (const invalidation of ['page', 'session']) {
      const page = await createPage(kind)
      await page.submit()
      if (invalidation === 'page') page.stack.splice(-1, 1, { ...page.owner })
      else page.changeSession()
      page.advance(5000)
      assert.equal(page.navigation.length, 0, invalidation)
    }
  })

  test(`${kind}保存响应晚于卸载时不能重新安排返回`, async () => {
    const page = await createPage(kind), pending = deferred()
    page.setSaveResult(() => pending.promise)
    const submitted = page.submit()
    page.stack.pop(); page.unload()
    pending.resolve({ id: 7 }); await submitted
    assert.equal(page.timers.size, 0)
    page.advance(5000); assert.equal(page.navigation.length, 0)
  })

  test(`${kind}保存失败不跳转，重试成功仍可正常返回`, async () => {
    const page = await createPage(kind)
    page.setSaveResult(() => Promise.reject(new Error('network failure')))
    await page.submit(); page.advance(5000)
    assert.equal(page.navigation.length, 0)
    page.setSaveResult(() => Promise.resolve({ id: 7 }))
    await page.submit(); page.advance(5000)
    assert.deepEqual(page.navigation, ['back'])
  })
}

test('医院同步待完成的就诊人仍按 2500ms 展示提示后返回', async () => {
  const page = await createPage('patient', { syncStatus: 'PENDING' })
  await page.submit()
  page.advance(2499); assert.equal(page.navigation.length, 0)
  page.advance(1); assert.deepEqual(page.navigation, ['back'])
})

for (const kind of ['refund', 'detail']) {
  test(`${kind}参数错误定时返回也在离开后取消`, async () => {
    const page = await createPage(kind, { invalid: true })
    assert.equal(page.timers.size, 1)
    page.stack.pop(); page.unload()
    assert.equal(page.timers.size, 0)
    page.callbacks.forEach(fn => fn()); page.advance(2000)
    assert.equal(page.navigation.length, 0)
  })
}

test('就诊人加载失败的定时返回在离开后取消', async () => {
  const page = await createPage('patient')
  await page.state.loadPatient(7)
  assert.equal(page.timers.size, 1)
  page.stack.pop(); page.unload()
  assert.equal(page.timers.size, 0)
  page.callbacks.forEach(fn => fn()); page.advance(2000)
  assert.equal(page.navigation.length, 0)
})

test('退款表单从独立入口进入时保留原有跳转目的地', async () => {
  for (const [kind, target] of [['refund', '/pages/order/order_list']]) {
    const page = await createPage(kind, { root: true })
    await page.submit(); page.advance(1500)
    assert.deepEqual(page.navigation, [target])
  }
})

test('历史物流入口不再保存或安排延迟返回，仅主动查看退款详情', async () => {
  const page = await createPage('logistics', { root: true })
  page.advance(5000)
  assert.equal(page.timers.size, 0)
  assert.equal(page.navigation.length, 0)
  await page.submit()
  assert.deepEqual(page.saves, [])
  assert.deepEqual(page.navigation, ['/pages/order/refund_detail?refundApplicationId=8'])
})

test('同页重复安排返回只保留最后一次任务，已排队的旧回调也不能提前跳转', () => {
  const owner = {}, callbacks = [], cancelled = [], results = []
  const guard = createPageReturn(() => true, {
    getPages: () => [owner],
    setTimer: fn => { callbacks.push(fn); return callbacks.length - 1 },
    clearTimer: id => cancelled.push(id)
  })
  guard.bind()
  guard.schedule(() => results.push('old'))
  guard.schedule(() => results.push('latest'))
  assert.deepEqual(cancelled, [0])
  callbacks[0](); assert.deepEqual(results, [])
  callbacks[1](); assert.deepEqual(results, ['latest'])
})

test('页面栈不可读取时不猜测返回目标，卸载后不能重新绑定其他页面', () => {
  let stack = null
  const callbacks = []
  const guard = createPageReturn(() => true, {
    getPages: () => { if (!stack) throw new Error('unavailable'); return stack },
    setTimer: fn => callbacks.push(fn), clearTimer() {}
  })
  guard.bind(); guard.schedule(() => {})
  assert.equal(callbacks.length, 0)
  guard.dispose()
  stack = [{}]
  guard.bind(); guard.show(); guard.schedule(() => {})
  assert.equal(callbacks.length, 0)
})
