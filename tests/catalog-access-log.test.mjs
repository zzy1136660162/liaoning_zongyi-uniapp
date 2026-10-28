import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { loadOptions, loadSetup } from './sfc-harness.mjs'

const logs = []
const logMocks = {
  logButtonClick: value => logs.push({ ...value, actionType: 'BUTTON_CLICK' }),
  logAccess: value => logs.push(value),
  logPageView: value => logs.push({ ...value, actionType: 'PAGE_VIEW' })
}
beforeEach(() => {
  logs.length = 0
  globalThis.uni = { showLoading() {}, hideLoading() {}, showToast() {}, showModal() {}, navigateTo() {} }
})

test('购物车删除分别记录点击、取消和接口删除结果，不把点击当删除成功', async () => {
  let confirmation, removed = 0
  uni.showModal = value => { confirmation = value }
  const definition = loadOptions('pages/cart/cart.vue', {
    TabBar: {}, ...logMocks, getSessionGeneration: () => 1, isCurrentSession: () => true,
    getCartEntries: () => ({ '123:11': { serverCartItemId: '700', serverCartVersion: '0' } }),
    removeFromCart: () => { removed++; return true }
  })
  const page = { ...definition.data(), ...definition.methods, loadCartData() {} }
  page.cartItems = [{ id: '123:11' }]
  page.removeItem('123:11')
  assert.equal(logs.length, 1)
  await confirmation.success({ confirm: false })
  assert.equal(removed, 0)
  assert.equal(logs.at(-1).actionResult, 'CANCELLED')
  page.removeItem('123:11')
  await confirmation.success({ confirm: true })
  assert.equal(removed, 1)
  assert.equal(logs.at(-1).actionResult, 'SUCCESS')
  assert.equal(logs.at(-1).requestUri, '/pages/cart/cart')
  assert.match(logs.at(-1).accessDescription, /指定商品规格/)
})

test('商品列表的按钮检索只记白名单上下文，不上报用户输入原文', () => {
  const definition = loadOptions('pages/products/priducts_list.vue', { TabBar: {}, ...logMocks })
  let searches = 0
  const page = { currentCategoryId: 3, getSearchKeyword: () => 'private-health-text', handleSearch: () => { searches++ } }
  definition.methods.submitSearch.call(page)
  assert.equal(searches, 1)
  assert.equal(logs.length, 1)
  assert.equal(logs[0].actionCode, 'SEARCH_PRODUCTS')
  assert.deepEqual(logs[0].extraData, { categoryId: 3, hasKeyword: true })
  assert.ok(!JSON.stringify(logs).includes('private-health-text'))
})

test('推荐商品加购前置读取超时也记录一次点击，结果归属原详情页', async () => {
  const page = loadSetup('pages/products/medicine_detail.vue', {
    ...logMocks, ref: value => ({ value }), computed: read => ({ get value() { return read() } }),
    onMounted() {}, onUnmounted() {}, getImageUrl: value => value,
    getToken: () => 'fixture', getCartEntries: () => ({}),
    getProductDetail: async () => { throw { errMsg: 'request:fail timeout' } }
  }, ['flyToCart', 'routeProductId'])
  page.routeProductId.value = '123'
  await page.flyToCart({}, { id: 456 })
  assert.deepEqual(logs.map(value => value.actionType), ['BUTTON_CLICK', 'BEHAVIOR'])
  assert.equal(logs[1].actionResult, 'UNKNOWN')
  assert.equal(logs[1].pageId, '123')
  assert.equal(logs[1].extraData.productId, 456)
  assert.equal(logs[1].requestUri, '/pages/products/medicine_detail')
})

const questionnairePage = (overrides = {}) => {
  const definition = loadOptions('pages/products/product_questionnaire.vue', {
    ...logMocks, getSessionGeneration: () => 1, isCurrentSession: () => true,
    clearQuestionnaireDraft() {},
    submitQuestionnaire: async () => ({ isMatch: false, answerId: 21 }), ...overrides
  })
  return { ...definition.data(), ...definition.methods,
    productId: '123', skuId: '11', questionnaireId: 8, draftAccountId: 'fixture-account',
    questions: [{ questionId: 1, title: 'private-medical-question', questionType: 1, isRequired: 1,
      selectedOptionId: 2, options: [{ optionId: 2, optionText: 'private-answer' }] }]
  }
}

test('问卷提交成功且不匹配记录真实结果，日志不携带问卷和答案', async () => {
  const page = questionnairePage()
  await page.submitAnswer()
  const outcome = logs.find(value => value.actionType === 'BEHAVIOR')
  assert.equal(outcome.actionResult, 'SUCCESS')
  assert.equal(outcome.extraData.matched, false)
  assert.equal(outcome.extraData.answerId, 21)
  assert.equal(outcome.requestUri, '/pages/products/product_questionnaire')
  assert.ok(!JSON.stringify(logs).includes('private-'))
})

test('问卷提交超时记录未知结果，固定原因不携带异常原文', async () => {
  const page = questionnairePage({ submitQuestionnaire: async () => { throw { errMsg: 'request:fail timeout private-token' } } })
  await page.submitAnswer()
  assert.equal(logs.at(-1).actionResult, 'UNKNOWN')
  assert.equal(logs.at(-1).extraData.reason, 'SUBMISSION_UNAVAILABLE')
  assert.ok(!JSON.stringify(logs).includes('private-token'))
})

test('问卷提交期间切换账号，旧响应不向新会话记录结果', async () => {
  let complete, active = true
  const response = new Promise(resolve => { complete = resolve })
  const page = questionnairePage({ isCurrentSession: () => active, submitQuestionnaire: () => response })
  const pending = page.submitAnswer()
  active = false
  complete({ answerId: 21, isMatch: false })
  await pending
  assert.deepEqual(logs.map(value => value.actionType), ['BUTTON_CLICK'])
})
