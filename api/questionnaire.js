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
    showLoading: false
  })
}

/**
 * 提交问卷答案
 * @param {Object} data 提交数据
 * @param {Number} data.productId 商品ID
 * @param {Number} data.questionnaireId 问卷ID
 * @param {Array} data.answers 答案列表
 * @param {Number} data.answers[].questionId 问题ID
 * @param {Number} data.answers[].optionId 单选题选项ID
 */
export const submitQuestionnaire = (data) => {
  return post(API_PATHS.QUESTIONNAIRE.SUBMIT, data, {
    needAuth: true,
    showLoading: false
  })
}

