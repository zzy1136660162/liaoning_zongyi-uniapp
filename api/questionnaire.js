/**
 * 问卷模块API
 */

import { get, post } from '@/utils/request.js'
import { API_PATHS } from '@/utils/config.js'

/**
 * 根据商品ID获取问卷详情
 * @param {Number} productId 商品ID
 */
export const getQuestionnaireByProductId = (productId) => {
  return get(API_PATHS.QUESTIONNAIRE.GET_BY_PRODUCT(productId), {}, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 根据问卷ID获取问卷详情
 * @param {Number} questionnaireId 问卷ID
 */
export const getQuestionnaireById = (questionnaireId) => {
  return get(API_PATHS.QUESTIONNAIRE.GET_BY_ID(questionnaireId), {}, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 提交问卷答案
 * @param {Object} data 提交数据
 * @param {Number} data.productId 商品ID
 * @param {Number} data.questionnaireId 问卷ID
 * @param {Array} data.answers 答案列表
 * @param {Number} data.answers[].questionId 问题ID
 * @param {Number} data.answers[].optionId 选项ID（单选/多选题）
 * @param {String} data.answers[].inputValue 填空题内容
 */
export const submitQuestionnaire = (data) => {
  return post(API_PATHS.QUESTIONNAIRE.SUBMIT, data, {
    needAuth: true,
    showLoading: true,
    loadingTitle: '提交中...'
  })
}

