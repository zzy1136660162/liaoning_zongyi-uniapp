/**
 * 退货模块API
 */

import { get, post } from '@/utils/request.js'

/**
 * 申请退货
 * @param {Object} data 退货申请数据
 */
export const applyRefund = (data) => {
  return post('/api/refund/apply', data, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 获取用户退货申请列表
 */
export const getRefundList = (params = {}) => getRefundPage(params).then(page => page.rows)

/** 获取一页退款记录及总数，旧调用方仍可使用数组返回结构。 */
export const getRefundPage = (params = {}) => {
  return get('/api/refund/list', params, {
    needAuth: true,
    showLoading: false,
    returnResponse: true
  }).then(response => {
    const rows = Array.isArray(response.data) ? response.data : []
    return {
      rows,
      total: response.total ?? rows.length,
      pageNum: response.pageNum ?? 1,
      pageSize: response.pageSize ?? rows.length,
      hasMore: response.hasMore === true
    }
  })
}

export const getRefundStats = () => get('/api/refund/stats', {}, {
  needAuth: true,
  showLoading: false
})

/**
 * 获取退货申请详情
 * @param {Number} refundApplicationId 退货申请ID
 */
export const getRefundDetail = (refundApplicationId, { showLoading = true, silent = false } = {}) => {
  return get(`/api/refund/detail/${refundApplicationId}`, {}, {
    needAuth: true,
    showLoading,
    silent
  })
}

/**
 * 取消退货申请
 * @param {Number} refundApplicationId 退货申请ID
 */
export const cancelRefund = (refundApplicationId) => {
  return post(`/api/refund/cancel/${refundApplicationId}`, {}, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 提交退货物流信息
 * @param {Number} refundApplicationId 退货申请ID
 * @param {Object} logisticsData 物流信息
 */
export const submitReturnLogistics = (refundApplicationId, logisticsData) => {
  return post(`/api/refund/logistics/${refundApplicationId}`, logisticsData, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 检查订单是否可以申请退货
 * @param {Number} orderId 订单ID
 */
export const checkCanApplyRefund = (orderId) => {
  return get(`/api/refund/check/${orderId}`, {}, {
    needAuth: true,
    showLoading: false
  })
}

// ============ 管理员接口 ============

/**
 * 获取所有退货申请列表（管理员）
 * @param {Object} params 查询参数
 */
export const getAllRefundList = (params = {}) => {
  return get('/api/refund/admin/list', params, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 审核退货申请（管理员）
 * @param {Number} refundApplicationId 退货申请ID
 * @param {Object} auditData 审核数据
 */
export const auditRefund = (refundApplicationId, auditData) => {
  return post(`/api/refund/admin/audit/${refundApplicationId}`, auditData, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 执行退款（管理员）
 * @param {Number} refundApplicationId 退货申请ID
 */
export const executeRefund = (refundApplicationId) => {
  return post(`/api/refund/admin/refund/${refundApplicationId}`, {}, {
    needAuth: true,
    showLoading: true
  })
}
