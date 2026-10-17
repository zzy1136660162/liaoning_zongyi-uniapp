import { getSessionToken } from './session.js'
import { STORAGE_KEY_USER_INFO } from './storage.js'

export const getQuestionnaireDraftAccountId = () => {
  try {
    if (!getSessionToken()) return ''
    const user = uni.getStorageSync(STORAGE_KEY_USER_INFO) || {}
    const id = user.userId ?? user.id
    return id === null || id === undefined ? '' : String(id)
  } catch (_) {
    return ''
  }
}

const draftKey = (accountId, productId, questionnaireId) => {
  if (!accountId || !productId || !questionnaireId) throw new Error('问卷暂存信息不完整')
  return `questionnaire_draft:${[accountId, productId, questionnaireId].map(value => encodeURIComponent(String(value))).join(':')}`
}

export const saveQuestionnaireDraft = (accountId, productId, questionnaireId, questions) => {
  const answers = questions.filter(question => question.questionType === 1 &&
    question.options.some(option => option.optionId === question.selectedOptionId))
    .map(question => ({ questionId: question.questionId, optionId: question.selectedOptionId }))
  uni.setStorageSync(draftKey(accountId, productId, questionnaireId), { answers })
}

export const restoreQuestionnaireDraft = (accountId, productId, questionnaireId, questions) => {
  const draft = uni.getStorageSync(draftKey(accountId, productId, questionnaireId))
  if (!Array.isArray(draft?.answers)) return questions
  const answers = new Map(draft.answers.filter(answer => answer?.questionId != null && answer.optionId != null)
    .map(answer => [String(answer.questionId), String(answer.optionId)]))
  return questions.map(question => {
    const option = question.questionType === 1 && question.options.find(item =>
      String(item.optionId) === answers.get(String(question.questionId)))
    return { ...question, selectedOptionId: option ? option.optionId : null, answer: option ? option.value : null }
  })
}

export const clearQuestionnaireDraft = (accountId, productId, questionnaireId) => {
  uni.removeStorageSync(draftKey(accountId, productId, questionnaireId))
}
