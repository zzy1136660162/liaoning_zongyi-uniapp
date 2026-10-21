import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadOptions } from './sfc-harness.mjs'
import { normalizeQuestionnaireQuestions, buildQuestionnaireAnswers, hasRequiredQuestionnaireAnswers } from '../utils/questionnaire-form.js'

const questionnaire = () => ({ questionnaireId: 8, questions: [{ questionId: 7, title: '症状', questionType: 1,
  isRequired: 1, options: [{ optionId: 10, optionText: '是', valueKey: 'yes', scoreValue: 100 }] }] })
const product = (id = 3, questionnaireId = 8) => ({ id, needQuestionnaire: 1, questionnaireId,
  productCategory: id === 3 ? 1 : id === 5 ? 2 : 3, skus: [{ id: 2, price: 10, stock: 99, status: 1 }] })
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
let pages, toasts, navigations, modals, timers, added, updated
beforeEach(() => {
  pages = []; toasts = []; navigations = []; modals = []; timers = new Map(); added = []; updated = []
  globalThis.uni = {
    showLoading() {}, hideLoading() {}, showToast: value => toasts.push(value), showModal: value => modals.push(value),
    navigateTo: value => navigations.push(value), navigateBack: value => navigations.push(value),
    removeStorageSync() {}, $emit() {}
  }
})
afterEach(() => pages.forEach(({ definition, page }) => definition.onUnload.call(page)))

const createPage = (overrides = {}, options = {}) => {
  const definition = loadOptions('pages/products/product_questionnaire.vue', {
    getSessionGeneration: () => 1, isCurrentSession: () => true, onSessionChanged: () => () => {},
    restoreQuestionnaireDraft: (account, id, questionnaireId, questions) => questions,
    clearQuestionnaireDraft() {}, saveQuestionnaireDraft() {}, logPageView() {},
    getQuestionnaireByProductId: async () => questionnaire(),
    submitQuestionnaire: async () => ({ answerId: 30, isMatch: true }),
    getProductDetail: async id => product(Number(id)),
    buildCartItemKey: (id, sku) => `${id}:${sku}`,
    resolveCartCompatibility: () => ({ valid: true }),
    getCartProductQuantity: () => 1, getCartEntries: () => ({}),
    addCartItem: (...args) => { added.push(args); return true },
    updateCartQuestionnaire: (...args) => { updated.push(args); return true },
    prepareCheckout: keys => ({ valid: true, productIds: keys, requiresConsultation: true }),
    STORAGE_KEY_CURRENT_CONSULTATION_ID: 'consultation_id',
    setTimeout: callback => { const id = timers.size + 1; timers.set(id, callback); return id },
    clearTimeout: id => timers.delete(id),
    ...overrides
  })
  const page = { ...definition.data(), ...definition.methods }
  definition.onLoad.call(page, { id: '3', skuId: '2', ...options })
  pages.push({ definition, page })
  return { definition, page }
}
const loadAndSelect = async page => { await page.loadQuestionnaire(); page.selectAnswer(0, 10) }

test('单选组件只发选择事件，禁用时不发事件也不修改题目', () => {
  const definition = loadOptions('components/questionnaire/SingleChoiceQuestion.vue', {})
  const events = [], question = { selectedOptionId: null }
  const instance = { disabled: false, question, $emit: (...args) => events.push(args) }
  definition.methods.selectOption.call(instance, 10)
  instance.disabled = true
  definition.methods.selectOption.call(instance, 11)
  assert.deepEqual(events, [['select', 10]])
  assert.equal(question.selectedOptionId, null)
})

test('单选模型只保存展示信息和选中ID，必答及提交都依据当前有效选项', () => {
  const questions = normalizeQuestionnaireQuestions(questionnaire().questions)
  assert.deepEqual(Object.keys(questions[0]).sort(), ['isRequired', 'options', 'questionId', 'questionType', 'selectedOptionId', 'title'])
  assert.deepEqual(questions[0].options, [{ optionId: 10, optionText: '是' }])
  questions[0].selectedOptionId = 99
  assert.equal(hasRequiredQuestionnaireAnswers(questions), false)
  assert.deepEqual(buildQuestionnaireAnswers(questions), [])
  questions[0].selectedOptionId = 10
  assert.equal(hasRequiredQuestionnaireAnswers(questions), true)
  assert.deepEqual(buildQuestionnaireAnswers(questions), [{ questionId: 7, optionId: 10 }])
})

test('连续点击提交只发送一次，提交期间选择保持稳定', async () => {
  const response = deferred(); let calls = 0
  const { page } = createPage({ submitQuestionnaire: () => { calls++; return response.promise } })
  await loadAndSelect(page)
  const submitting = page.submitAnswer()
  page.selectAnswer(0, 99)
  await page.submitAnswer()
  assert.equal(calls, 1)
  assert.equal(page.questions[0].selectedOptionId, 10)
  response.resolve({ isMatch: false })
  await submitting
  assert.equal(modals.length, 1)
})

test('同账号退页后的提交响应不再写购物车或导航', async () => {
  const response = deferred(); let productReads = 0
  const { definition, page } = createPage({ submitQuestionnaire: () => response.promise,
    getProductDetail: async () => { productReads++; return product() } })
  await loadAndSelect(page)
  const submitting = page.submitAnswer()
  definition.onUnload.call(page)
  response.resolve({ answerId: 30, isMatch: true })
  await submitting
  assert.equal(productReads, 0)
  assert.equal(added.length + updated.length + navigations.length, 0)
})

test('通过后等待商品刷新时退页，也不会继续加购', async () => {
  const detail = deferred(); let reading
  const started = new Promise(resolve => { reading = resolve })
  const { definition, page } = createPage({ getProductDetail: () => { reading(); return detail.promise } })
  await loadAndSelect(page)
  const submitting = page.submitAnswer()
  await started
  definition.onUnload.call(page)
  detail.resolve(product())
  await submitting
  assert.equal(added.length + updated.length + navigations.length, 0)
})

test('补答只更新当前行的问卷凭据，不重新加购或自动结算', async () => {
  const { page } = createPage({}, { action: 'repair', quantity: '9' })
  await loadAndSelect(page)
  await page.submitAnswer()
  assert.equal(added.length, 0)
  assert.equal(updated.length, 1)
  assert.deepEqual(updated[0][1], { questionnairePassed: true, questionnaireId: 8, answerId: 30 })
  assert.equal(navigations.length, 0)
  assert.equal(timers.size, 1)
})

test('混合订单问卷通过后继续全部选中商品，并保留复诊分流', async () => {
  let checkoutKeys, checkoutProducts
  const keys = ['3:2', '5:2', '9:2']
  const { page } = createPage({
    getCartEntries: () => Object.fromEntries(keys.map(key => [key, { quantity: 4, selected: true }])),
    prepareCheckout: (selected, categories) => {
      checkoutKeys = selected; checkoutProducts = categories[0].products
      return { valid: true, productIds: selected, requiresConsultation: true }
    }
  }, { action: 'checkout', selectedItems: encodeURIComponent(keys.join(',')) })
  await loadAndSelect(page)
  await page.submitAnswer()
  assert.equal(added.length, 0)
  assert.equal(updated.length, 1)
  assert.deepEqual(checkoutKeys, keys)
  assert.deepEqual(checkoutProducts.map(item => item.quantity), [4, 4, 4])
  assert.equal(navigations[0].url, `/pages/dispense/apply?selectedItems=${keys.join(',')}`)
})

test('问卷提交后商品换绑，旧答案不写入购物车', async () => {
  const { page } = createPage({ getProductDetail: async () => product(3, 99) })
  await loadAndSelect(page)
  await page.submitAnswer()
  assert.equal(added.length + updated.length + navigations.length, 0)
  assert.match(toasts.at(-1).title, /问卷已更新/)
})

test('离开成功页取消返回定时器，旧回调也不能再操作页面栈', async () => {
  const { definition, page } = createPage()
  await loadAndSelect(page)
  await page.submitAnswer()
  const callback = [...timers.values()][0]
  assert.equal(added.length, 1)
  definition.onUnload.call(page)
  assert.equal(timers.size, 0)
  callback()
  assert.equal(navigations.length, 0)
})
