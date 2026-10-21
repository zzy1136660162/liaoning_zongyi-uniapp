/** 单选问卷只在客户端保存题目、选项 ID；评分继续由现有接口计算。 */
export const UNSUPPORTED_QUESTION_TYPE_MESSAGE = '当前问卷含暂不支持的题型，请联系管理员调整后再试'

export const hasSupportedQuestionTypes = (questions = []) => questions.every(question => question.questionType === 1)

export const normalizeQuestionnaireQuestions = (questions = []) => questions.map(question => ({
  questionId: question.questionId,
  title: question.title,
  questionType: question.questionType,
  isRequired: question.isRequired,
  options: (question.options || []).map(option => ({ optionId: option.optionId, optionText: option.optionText })),
  selectedOptionId: null
}))

const selectedOption = question => question.selectedOptionId == null ? null : (question.options || [])
  .find(option => String(option.optionId) === String(question.selectedOptionId))

export const hasRequiredQuestionnaireAnswers = (questions = []) => questions.every(question =>
  question.isRequired !== 1 || !!selectedOption(question))

export const buildQuestionnaireAnswers = (questions = []) => questions
  .filter(question => question.questionType === 1 && selectedOption(question))
  .map(question => ({ questionId: question.questionId, optionId: selectedOption(question).optionId }))
