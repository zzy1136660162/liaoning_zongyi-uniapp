/**
 * pages.json 路由元数据，用于自动页面访问日志
 */

export const PAGE_ID_QUERY_KEYS = [
  'id',
  'orderId',
  'productId',
  'prescriptionId',
  'refundApplicationId',
  'consultationId',
  'selectedItems'
]

/** route → { pageType, title } */
export const PAGE_ROUTE_META = {
  'pages/index/index': { pageType: 'INDEX', title: '启动首页' },
  'pages/splash/splash': { pageType: 'SPLASH', title: '闪屏页' },
  'pages/notice/notice': { pageType: 'NOTICE', title: '就诊告知' },
  'pages/products/priducts_list': { pageType: 'HEALTH_PRODUCT_LIST', title: '健康商城列表' },
  'pages/products/priducts_list2': { pageType: 'HEALTH_PRODUCT_LIST_ALT', title: '健康商城列表(备用)' },
  'pages/products/priducts_detail': { pageType: 'HEALTH_PRODUCT_DETAIL', title: '健康商品详情' },
  'pages/products/medicine_index': { pageType: 'MEDICINE_INDEX', title: '商城首页' },
  'pages/products/medicine_detail': { pageType: 'MEDICINE_DETAIL', title: '制剂商品详情' },
  'pages/products/therapy_detail': { pageType: 'THERAPY_DETAIL', title: '传统疗法详情' },
  'pages/products/medicine_list': { pageType: 'MEDICINE_LIST', title: '制剂商品列表' },
  'pages/products/product_notice': { pageType: 'PRODUCT_NOTICE', title: '用药须知' },
  'pages/products/product_questionnaire': { pageType: 'PRODUCT_QUESTIONNAIRE', title: '健康问卷' },
  'pages/register/register': { pageType: 'REGISTER', title: '注册登录' },
  'pages/cart/cart': { pageType: 'CART', title: '购物车' },
  'pages/user/profile': { pageType: 'USER_PROFILE', title: '我的' },
  'pages/ai/chat': { pageType: 'AI_CHAT', title: '智能客服' },
  'pages/dispense/apply': { pageType: 'DISPENSE_APPLY', title: '申请配药' },
  'pages/dispense/patient_edit': { pageType: 'PATIENT_EDIT', title: '就诊人信息' },
  'pages/dispense/consultation': { pageType: 'DISPENSE_CONSULTATION', title: '在线复诊' },
  'pages/order/order-detail': { pageType: 'ORDER_DETAIL', title: '订单详情' },
  'pages/order/order_list': { pageType: 'ORDER_LIST', title: '我的订单' },
  'pages/order/prescription_list': { pageType: 'PRESCRIPTION_LIST', title: '药品处方列表' },
  'pages/order/prescription_detail': { pageType: 'PRESCRIPTION_DETAIL', title: '处方详情(订单)' },
  'pages/order/consultation_detail': { pageType: 'CONSULTATION_DETAIL', title: '复诊详情' },
  'pages/order/confirm': { pageType: 'ORDER_CONFIRM', title: '确认订单' },
  'pages/order/address_list': { pageType: 'ADDRESS_LIST', title: '收货地址列表' },
  'pages/order/address_edit': { pageType: 'ADDRESS_EDIT', title: '编辑收货地址' },
  'pages/order/payment_success': { pageType: 'PAYMENT_SUCCESS', title: '支付成功' },
  'pages/order/refund_apply': { pageType: 'REFUND_APPLY', title: '申请退款' },
  'pages/order/refund_detail': { pageType: 'REFUND_DETAIL', title: '退款详情' },
  'pages/order/refund_list': { pageType: 'REFUND_LIST', title: '退款记录' },
  'pages/order/refund_logistics': { pageType: 'REFUND_LOGISTICS', title: '填写退货物流' },
  'pages/prescription/detail': { pageType: 'PRESCRIPTION_DETAIL', title: '处方详情' },
  'pages/doctor/signature': { pageType: 'DOCTOR_SIGNATURE', title: '医生签名' },
  'pages/doctor/signature_landscape': { pageType: 'DOCTOR_SIGNATURE_LANDSCAPE', title: '医生签名横屏' }
}

export const resolveRouteMeta = (route = '') => {
  const normalizedRoute = String(route || '').replace(/^\//, '')
  if (PAGE_ROUTE_META[normalizedRoute]) {
    return PAGE_ROUTE_META[normalizedRoute]
  }

  const segments = normalizedRoute.split('/').filter(Boolean)
  const pageType = segments.map((part) => part.replace(/[-]/g, '_').toUpperCase()).join('_') || 'UNKNOWN_PAGE'

  return {
    pageType,
    title: normalizedRoute || '未知页面'
  }
}

export const extractPageIdFromOptions = (options = {}) => {
  for (const key of PAGE_ID_QUERY_KEYS) {
    const value = options[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value)
    }
  }
  return ''
}

export const buildPageQueryString = (options = {}) => {
  const keys = Object.keys(options || {})
  if (!keys.length) {
    return ''
  }
  return keys
    .sort()
    .map((key) => `${key}=${encodeURIComponent(options[key])}`)
    .join('&')
}
