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

const product = id => ({ id, status: 1, delSign: 0, goodsMerchantType: 1,
  productCategory: 1, productName: 'fixture', stock: 20, available: true,
  skus: [{ id: 1, status: 1, delSign: 0, price: 12, stock: 20 }] })

const harness = (overrides = {}, options = {}) => {
  let load, unload, mount
  const navigations = []
  const mocks = {
    ref: value => ({ value }), nextTick: fn => fn(), onMounted: fn => { mount = fn },
    onLoad: fn => { load = fn }, onUnload: fn => { unload = fn },
    getSessionGeneration: () => 0, assertCurrentSession() {},
    createConsultation: async input => ({ id: 123, patientId: input.patientId }),
    getPrescriptionByConsultation: async id => ({ id: 789, consultationId: id, patientId: 42, status: 1 }),
    getProductDetail: async id => product(id),
    getCartEntries: () => ({ '7:1': { productId: 7, skuId: 1, quantity: 2 } }),
    getCurrentCheckoutProductIds: () => ['7:1'], setCheckoutProductIds() {},
    splitCartItemKey: value => ({ productId: value }),
    logPageView() {}, getImageUrl: value => value,
    uni: { getStorageSync: () => 888, navigateTo: route => navigations.push(route.url),
      redirectTo: route => navigations.push(route.url), showToast() {} },
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
  } }, { consultationMode: 'manual', doctorId: '100', doctorName: encodeURIComponent(mode.MANUAL_DOCTORS[0].name) })
  await page.mount()
  assert.equal(request.doctorId, 100)
  assert.equal(page.doctorId.value, 100)
  assert.equal(page.doctorName.value, mode.MANUAL_DOCTORS[0].name)
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

test('挂载分流与创建共用本次商品读取，同商品不同规格保留两条明细', async () => {
  const reads = []
  let request
  const page = harness({
    getCartEntries: () => ({
      '7:1': { productId: 7, skuId: 1, quantity: 2 },
      '7:2': { productId: 7, skuId: 2, quantity: 3 }
    }),
    getProductDetail: async id => {
      reads.push(id)
      const detail = product(id)
      return { ...detail, skus: [...detail.skus, { ...detail.skus[0], id: 2 }] }
    },
    createConsultation: async input => { request = input; return { id: 123, patientId: input.patientId } }
  }, { selectedItems: '7:1,7:2' })
  await page.mount()
  assert.deepEqual(reads, ['7'])
  assert.deepEqual(request.prescriptionItems.map(item => String(item.productId)), ['7', '7'])
})

test('已创建问诊的重试只查原处方，不因商品随后不可用而失败或更换医生', async t => {
  let reads = 0, creates = 0
  const prescriptionQueries = []
  const doctor = mode.MANUAL_DOCTORS[1]
  const page = harness({
    getProductDetail: async id => {
      if (++reads > 1) throw new Error('fixture-product-unavailable')
      return product(id)
    },
    createConsultation: async input => {
      creates++
      assert.equal(input.doctorId, doctor.id)
      assert.equal(input.historyDesc, `人工接诊医生：${doctor.name}`)
      return { id: 123, patientId: input.patientId }
    },
    getPrescriptionByConsultation: async id => {
      prescriptionQueries.push(id)
      if (prescriptionQueries.length === 1) throw new Error('fixture-prescription-failed')
      return { id: 789, consultationId: id, patientId: 42 }
    }
  }, { consultationMode: 'manual', doctorId: String(doctor.id) })
  await page.mount()
  await page.createConsultationRecord()
  assert.equal(reads, 1)
  assert.equal(creates, 1)
  assert.deepEqual(prescriptionQueries, [123, 123])
  assert.equal(page.consultationError.value, '')
  finishMessages(t)
  assert.equal(page.showPrescriptionBtn.value, true)
})

test('尚未创建成功时重试重新校验商品，不复用失败前的商品数据', async () => {
  let reads = 0, creates = 0
  const page = harness({
    getProductDetail: async id => {
      reads++
      if (reads === 2) throw new Error('fixture-product-unavailable')
      return product(id)
    },
    createConsultation: async input => {
      if (++creates === 1) throw new Error('fixture-create-failed')
      return { id: 123, patientId: input.patientId }
    }
  })
  await page.mount()
  assert.equal(page.consultationError.value, 'fixture-create-failed')
  await page.createConsultationRecord()
  assert.equal(page.consultationError.value, '所选商品或规格已失效，请重新选择')
  assert.equal(creates, 1)
  await page.createConsultationRecord()
  assert.equal(reads, 3)
  assert.equal(creates, 2)
  assert.equal(page.consultationError.value, '')
})

test('首次读取商品期间重复触发提交，只进行一次读取和创建', async () => {
  let complete, reads = 0, creates = 0
  const page = harness({
    getProductDetail: id => {
      reads++
      return new Promise(resolve => { complete = () => resolve(product(id)) })
    },
    createConsultation: async input => { creates++; return { id: 123, patientId: input.patientId } }
  })
  const pending = page.mount()
  await flush()
  await page.createConsultationRecord()
  assert.equal(reads, 1)
  complete()
  await pending
  assert.equal(creates, 1)
})

for (const reason of ['unload', 'session']) {
  test(`商品读取期间${reason === 'unload' ? '卸载页面' : '切换账号'}，迟到结果不得创建问诊`, async t => {
    let complete, creates = 0, sessionChanged = false
    const page = harness({
      getProductDetail: id => new Promise(resolve => { complete = () => resolve(product(id)) }),
      createConsultation: async input => { creates++; return { id: 123, patientId: input.patientId } },
      assertCurrentSession() {
        if (sessionChanged) throw Object.assign(new Error('fixture-session-changed'), { code: 'SESSION_CHANGED' })
      }
    })
    const pending = page.mount()
    await flush()
    if (reason === 'unload') page.unload()
    else sessionChanged = true
    complete()
    await pending
    t.mock.timers.tick(15000)
    assert.equal(creates, 0)
    assert.equal(page.showPrescriptionBtn.value, false)
    assert.equal(page.checkoutContext.value, null)
    assert.deepEqual(page.navigations, [])
  })
}

test('无需问诊的直购仅取一次商品并保留数量与问卷凭据跳转确认页', async () => {
  let reads = 0
  const page = harness({
    getProductDetail: async id => { reads++; return { ...product(id), productCategory: 2 } },
    getCartEntries() { assert.fail('直购不能读取购物车条目') },
    setCheckoutProductIds() { assert.fail('直购不能写购物车结算选择') },
    createConsultation() { assert.fail('无需问诊不能创建问诊') },
    getPrescriptionByConsultation() { assert.fail('无需问诊不能查询处方') }
  }, { buyQuantity: '3', buyQuestionnaireId: '11', buyAnswerId: '22' })
  await page.mount()
  assert.equal(reads, 1)
  assert.equal(page.navigations.length, 1)
  const route = new URL(page.navigations[0], 'https://fixture.invalid')
  assert.equal(route.pathname, '/pages/order/confirm')
  assert.equal(route.searchParams.get('selectedItems'), '7:1')
  assert.equal(route.searchParams.get('buyQuantity'), '3')
  assert.equal(route.searchParams.get('buyQuestionnaireId'), '11')
  assert.equal(route.searchParams.get('buyAnswerId'), '22')
})

test('无效人工医生通过原错误区域阻止创建，AI忽略矛盾医生参数', async () => {
  const invalid = harness({
    getProductDetail() { assert.fail('无效路由不能查询商品') },
    createConsultation() { assert.fail('无效路由不能创建问诊') }
  }, { consultationMode: 'manual', doctorId: '999' })
  await invalid.mount()
  assert.equal(invalid.consultationError.value, '问诊未完成，请重试')
  assert.equal(invalid.showPrescriptionBtn.value, false)
  const ai = harness({}, { consultationMode: 'ai', doctorId: '100', doctorName: '%E0%A4%A', doctorAvatar: '%' })
  await ai.mount()
  assert.equal(ai.consultationError.value, '')
  assert.equal(ai.doctorId.value, null)
  assert.equal(ai.doctorName.value, mode.AI_DOCTOR.name)
})
