/**
 * API配置文件
 * 统一管理API基础配置
 */

// API基础配置
export const API_CONFIG = {
    // 开发环境
    development: {
        baseURL: 'http://localhost:10086',
        timeout: 30000
    },
    // 生产环境
    production: {
        // baseURL: 'https://yuntuoengine.com/lnzy-api', // 替换为实际的生产环境地址
		baseURL: 'https://shop.lntcm.com/weapp-api', // 替换为实际的生产环境地址
        timeout: 30000
    }
}

// 当前环境 process.env.NODE_ENV ||
// const ENV =  process.env.NODE_ENV || 'production'||'development'
const ENV =  'production' || 'development'

export const CUSTOMER_SERVICE_ENV = {
    development: {
        corpId: 'ww3fe8ec237bf70c8b',
        url: 'https://work.weixin.qq.com/kfid/kfcc92471bfa5f832db',
        unavailableMessage: '人工客服暂时不可用'
    },
    production: {
        corpId: 'ww3fe8ec237bf70c8b',
        url: 'https://work.weixin.qq.com/kfid/kfcc92471bfa5f832db',
        unavailableMessage: '人工客服暂时不可用'
    }
}

// 导出当前环境配置
export const BASE_URL = API_CONFIG[ENV].baseURL
export const TIMEOUT = API_CONFIG[ENV].timeout
export const CUSTOMER_SERVICE_CONFIG = CUSTOMER_SERVICE_ENV[ENV]

// Token存储Key
export const TOKEN_KEY = 'user_token'

// 用户ID存储Key
export const USER_ID_KEY = 'user_id'

// 图片地址前缀
// export const IMAGE_BASE_URL = 'https://yuntuoengine.com/lnzy-admin'
export const IMAGE_BASE_URL = 'https://shop.lntcm.com/assets_files'

/**
 * 处理图片地址
 * 如果地址中包含 http 或以 // 开头，则返回原路径
 * 否则使用图片前缀 + 参数地址
 * @param {String} imageUrl 图片地址
 * @returns {String} 处理后的完整图片地址
 */
export const getImageUrl = (imageUrl) => {
    // 如果为空或未定义，返回空字符串
    if (!imageUrl) {
        return ''
    }

    // 转换为字符串
    const url = String(imageUrl).trim()

    // 如果为空字符串，返回空
    if (!url) {
        return ''
    }

    // 如果包含 http:// 或 https://，返回原路径
    if (url.includes('http://') || url.includes('https://')) {
        return url
    }

    // 如果以 // 开头（协议相对路径），返回原路径
    if (url.startsWith('//')) {
        return url
    }

    // 其他情况，使用前缀 + 地址
    // 确保地址以 / 开头，避免重复斜杠
    const path = url.startsWith('/') ? url : '/' + url
    return IMAGE_BASE_URL + path
}


// API路径常量
export const API_PATHS = {
    // 认证模块
    AUTH: {
        SEND_SMS: '/api/auth/send-sms',           // 发送短信验证码
        LOGIN: '/api/auth/login',                 // 登录/注册
        LOGIN_BY_OPENID: '/api/auth/login-by-openid', // 通过 openid 自动登录
        LOGOUT: '/api/auth/logout',               // 退出登录
        USER_PROFILE: '/api/user/profile',        // 获取用户信息
        USER_BY_OPENID: '/api/user/by-openid',    // 通过 openid 查询用户信息
    },

    // 就诊人模块
    PATIENT: {
        LIST: '/api/patients',                    // 获取就诊人列表
        DETAIL: (id) => `/api/patients/${id}`,   // 获取就诊人详情
        ADD: '/api/patients',                     // 新增就诊人
        UPDATE: (id) => `/api/patients/${id}`,   // 编辑就诊人
        DELETE: (id) => `/api/patients/${id}`,   // 删除就诊人
    },

    // 访问日志模块
    ACCESS_LOG: {
        SAVE: '/api/access-log',                  // 记录访问日志
    },

    // 收货地址模块
    ADDRESS: {
        LIST: '/api/addresses',                       // 获取地址列表
        DETAIL: (id) => `/api/addresses/${id}`,      // 获取地址详情
        ADD: '/api/addresses',                        // 新增地址
        UPDATE: (id) => `/api/addresses/${id}`,      // 编辑地址
        DELETE: (id) => `/api/addresses/${id}`,      // 删除地址
        SET_DEFAULT: (id) => `/api/addresses/${id}/set-default`, // 设置默认地址
    },

    // 医院医生模块
    HOSPITAL: {
        LIST: '/api/hospitals',                            // 获取医院列表
        DOCTORS: (hospitalName) => `/api/hospitals/${hospitalName}/doctors`, // 获取医院下医生列表
    },
    DOCTOR: {
        DETAIL: (id) => `/api/doctors/${id}`,             // 获取医生详情
        BY_OUTPATIENT: (no) => `/api/doctors/outpatient/${no}` // 通过门诊号获取医生详情（后端需支持）
    },

    // 商品模块
    CATEGORY: {
        LIST: '/api/categories',                          // 获取分类列表
        PRODUCTS: '/api/categories/products',             // 获取商品列表（POST，通过body传递categoryId）
    },
    PRODUCT: {
        DETAIL: (id) => `/api/products/${id}`,           // 获取商品详情
    },

    // 咨询处方模块
    CONSULTATION: {
        CREATE: '/api/consultations',                     // 发起复诊咨询
        LIST: '/api/consultations',                       // 获取咨询列表
        DETAIL: (id) => `/api/consultations/${id}`,      // 获取咨询详情
        PRESCRIPTION: (id) => `/api/consultations/${id}/prescription`, // 获取咨询对应处方
    },
    PRESCRIPTION: {
        DETAIL: (id) => `/api/prescriptions/${id}`,      // 获取处方详情
        ITEMS: (id) => `/api/prescriptions/${id}/items`, // 获取处方药品列表
    },

    // 订单模块
    ORDER: {
        FROM_PRESCRIPTION: '/api/orders/from-prescription', // 处方一键下单
        CREATE: '/api/orders',                             // 创建普通订单
        LIST: '/api/orders',                               // 获取订单列表
        DETAIL: (id) => `/api/orders/${id}`,              // 获取订单详情
        BY_PRESCRIPTION: (prescriptionId) => `/api/orders/by-prescription/${prescriptionId}`, // 通过处方ID查询订单
        CANCEL: (id) => `/api/orders/${id}/cancel`,       // 取消订单
        CONFIRM_RECEIPT: (id) => `/api/orders/${id}/confirm-receipt`, // 确认收货
        REDEEM: '/api/orders/redeem',                              // 传统疗法扫码核销
    },

    // 支付模块
    PAYMENT: {
        PREPAY: (channel) => `/api/pay/${channel}/prepay`,  // 创建支付预订单
        NOTIFY: (channel) => `/api/pay/${channel}/notify`,  // 支付回调
    },

    // 公告模块
    ANNOUNCEMENT: {
        LIST: '/api/announcements',                       // 获取公告列表
        DETAIL: (id) => `/api/announcements/${id}`,      // 获取公告详情
    },

    // 问卷模块
    QUESTIONNAIRE: {
        GET_BY_PRODUCT: (productId) => `/api/questionnaire/product/${productId}`, // 根据商品ID获取问卷
        GET_BY_ID: (id) => `/api/questionnaire/${id}`,   // 根据问卷ID获取问卷
        SUBMIT: '/api/questionnaire/submit',              // 提交问卷答案
    },

    // 购物车模块
    CART: {
        LIST: '/api/cart',
        UPSERT_ITEM: '/api/cart/items',
        UPDATE_ITEM: (productId) => `/api/cart/items/${productId}`,
        DELETE_ITEM: (productId) => `/api/cart/items/${productId}`,
        DELETE_ITEMS: '/api/cart/items',
        SYNC: '/api/cart/sync',
    },

    COMMON: {
        UPLOAD: '/common/upload',
    }
}
