import assert from 'node:assert/strict'
import { beforeEach, afterEach, test } from 'node:test'
import { loadOptions } from './sfc-harness.mjs'
import { beginSession, endSession, getSessionGeneration, isCurrentSession, onSessionChanged } from '../utils/session.js'
import * as drafts from '../utils/questionnaire-draft.js'

const values = new Map()
let toasts, modals, navigations, pages, failDraftWrite
globalThis.uni = {
  getStorageSync: key => values.get(key),
  setStorageSync: (key, value) => {
    if (failDraftWrite && key.startsWith('questionnaire_draft:')) throw new Error('storage full')
    values.set(key, structuredClone(value))
  },
  removeStorageSync: key => values.delete(key),
  showLoading() {}, hideLoading() {}, $emit() {},
  showToast: toast => toasts.push(toast), showModal: modal => modals.push(modal),
  navigateBack: options => navigations.push(options)
}
const signIn = accountId => {
  beginSession(`fixture-session-${accountId}`)
  values.set('user_info', { id: accountId })
}
const questionnaire = (id = 8) => ({ questionnaireId: id, questions: [
  { questionId: 7, title: '症状一', questionType: 1, isRequired: 1,
    options: [{ optionId: 10, optionText: '是', valueKey: 'yes' }, { optionId: 11, optionText: '否', valueKey: 'no' }] },
  { questionId: 9, title: '症状二', questionType: 1, isRequired: 0,
    options: [{ optionId: 20, optionText: '有', valueKey: 'has' }] }
] })
const createPage = (overrides = {}, productId = '6') => {
  const definition = loadOptions('pages/products/product_questionnaire.vue', {
    getSessionGeneration, isCurrentSession, onSessionChanged, ...drafts,
    getQuestionnaireByProductId: async () => questionnaire(),
    submitQuestionnaire: async () => ({ answerId: 30, isMatch: false }),
    logPageView() {}, ...overrides
  })
  const page = { ...definition.data(), ...definition.methods, productId }
  pages.push({ definition, page })
  return { definition, page }
}
const draftEntries = () => [...values.entries()].filter(([key]) => key.startsWith('questionnaire_draft:'))
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }

beforeEach(() => {
  values.clear(); toasts = []; modals = []; navigations = []; pages = []; failDraftWrite = false
  signIn('A')
})
afterEach(() => {
  pages.forEach(({ definition, page }) => definition.onUnload.call(page))
  endSession()
})

test('暂存实际写入答案，退出后重新进入恢复，且只保存题目与选项ID', async () => {
  const { page } = createPage()
  await page.loadQuestionnaire()
  page.selectAnswer(0, 10)
  page.saveDraft()
  assert.equal(toasts.at(-1).title, '已暂存')
  assert.deepEqual(draftEntries().map(([, draft]) => draft), [{ answers: [{ questionId: 7, optionId: 10 }] }])
  assert.ok(draftEntries()[0][0].includes(':A:6:8'))
  assert.ok(!draftEntries()[0][0].includes('fixture-session'))

  const { page: reopened } = createPage()
  await reopened.loadQuestionnaire()
  assert.equal(reopened.questions[0].selectedOptionId, 10)
  assert.equal(reopened.questions[0].answer, 'yes')
  assert.equal(reopened.questions[1].selectedOptionId, null)
})

test('草稿按账号、商品和问卷隔离，同账号重新登录可恢复自己的草稿', async () => {
  const { page } = createPage()
  await page.loadQuestionnaire(); page.selectAnswer(0, 10); page.saveDraft()
  for (const [productId, questionnaireId] of [['different-product', 8], ['6', 99]]) {
    const { page: other } = createPage({ getQuestionnaireByProductId: async () => questionnaire(questionnaireId) }, productId)
    await other.loadQuestionnaire()
    assert.equal(other.questions[0].selectedOptionId, null)
  }
  signIn('B')
  const { page: accountB } = createPage()
  await accountB.loadQuestionnaire()
  assert.equal(accountB.questions[0].selectedOptionId, null)
  accountB.selectAnswer(0, 11); accountB.saveDraft()
  signIn('A')
  const { page: accountA } = createPage()
  await accountA.loadQuestionnaire()
  assert.equal(accountA.questions[0].selectedOptionId, 10)
  assert.equal(draftEntries().length, 2)
})

test('恢复时忽略删除的题目、删除的选项以及属于其他题目的选项', async () => {
  const { page } = createPage()
  await page.loadQuestionnaire(); page.selectAnswer(0, 10); page.selectAnswer(1, 20); page.saveDraft()
  const [key] = draftEntries()[0]
  values.set(key, { answers: [null, { questionId: 7, optionId: 20 }, { questionId: 'deleted', optionId: 10 }] })
  const { page: changed } = createPage()
  await changed.loadQuestionnaire()
  assert.ok(changed.questions.every(question => question.selectedOptionId === null && question.answer === null))

  values.set(key, { answers: [{ questionId: 7, optionId: 10 }] })
  const detail = questionnaire()
  detail.questions[0].options = detail.questions[0].options.filter(option => option.optionId !== 10)
  const { page: removedOption } = createPage({ getQuestionnaireByProductId: async () => detail })
  await removedOption.loadQuestionnaire()
  assert.equal(removedOption.questions[0].selectedOptionId, null)
})

test('服务端成功接收提交后清除当前草稿，提交失败保留草稿', async () => {
  const { page } = createPage()
  await page.loadQuestionnaire(); page.selectAnswer(0, 10); page.saveDraft()
  await page.submitAnswer()
  assert.equal(draftEntries().length, 0)
  assert.equal(modals.length, 1)

  const { page: failed } = createPage({ submitQuestionnaire: async () => { throw new Error('fixture failure') } })
  await failed.loadQuestionnaire(); failed.selectAnswer(0, 11); failed.saveDraft()
  await failed.submitAnswer()
  assert.equal(draftEntries().length, 1)
  assert.equal(toasts.at(-1).title, 'fixture failure')
})

test('账号切换清空旧页面，旧加载响应不会恢复或显示上一账号问卷', async () => {
  let finish
  const { definition, page } = createPage({ getQuestionnaireByProductId: () => new Promise(resolve => { finish = resolve }) })
  definition.onLoad.call(page, { id: '6' })
  definition.onShow.call(page)
  signIn('B')
  finish(questionnaire())
  await flush()
  assert.deepEqual(page.questions, [])
  assert.equal(page.questionnaireId, null)
  assert.match(page.questionnaireError, /登录状态已变更/)
  page.saveDraft()
  assert.equal(draftEntries().length, 0)
})

test('旧提交异步返回不清除新账号草稿，不弹窗或跳转', async () => {
  let finish
  const { definition, page } = createPage({ submitQuestionnaire: () => new Promise(resolve => { finish = resolve }) })
  definition.onLoad.call(page, { id: '6' }); definition.onShow.call(page); await flush()
  page.selectAnswer(0, 10); page.saveDraft()
  const submitting = page.submitAnswer()
  signIn('B')
  const { page: current } = createPage()
  await current.loadQuestionnaire(); current.selectAnswer(0, 11); current.saveDraft()
  const before = draftEntries()
  finish({ answerId: 30, isMatch: false })
  await submitting
  assert.deepEqual(draftEntries(), before)
  assert.equal(modals.length, 0)
  assert.equal(navigations.length, 0)
  assert.deepEqual(page.questions, [])
})

test('本地存储失败不会显示已暂存，没有确认账号时也不保存草稿', async () => {
  const { page } = createPage()
  await page.loadQuestionnaire(); page.selectAnswer(0, 10)
  failDraftWrite = true
  page.saveDraft()
  assert.equal(toasts.at(-1).title, '暂存失败，请稍后重试')
  assert.equal(draftEntries().length, 0)
  failDraftWrite = false
  values.delete('user_info')
  const { page: unknown } = createPage()
  await unknown.loadQuestionnaire(); unknown.selectAnswer(0, 10); unknown.saveDraft()
  assert.equal(toasts.at(-1).title, '暂存失败，请稍后重试')
  assert.equal(draftEntries().length, 0)
})

test('重新展示刷新问卷，保留未提交且仍有效的答案，清除已删除选项的答案', async () => {
  let current = questionnaire(), calls = 0
  const { definition, page } = createPage({ getQuestionnaireByProductId: async () => { calls++; return current } })
  definition.onLoad.call(page, { id: '6' })
  assert.equal(calls, 0)
  definition.onShow.call(page); await flush()
  page.selectAnswer(0, 10); page.selectAnswer(1, 20)
  current = questionnaire()
  current.questions[0].options[0].valueKey = 'new-value'
  current.questions[1].options = []
  definition.onShow.call(page); await flush()
  assert.equal(calls, 2)
  assert.equal(page.questions[0].selectedOptionId, 10)
  assert.equal(page.questions[0].answer, 'new-value')
  assert.equal(page.questions[1].selectedOptionId, null)
  assert.equal(page.questions[1].answer, null)
  assert.equal(draftEntries().length, 0)
})
