/**
 * 本地存储 Key 常量管理
 * 统一管理项目中所有 uni.setStorageSync / uni.getStorageSync 使用的 key 值
 * 便于维护和避免 key 值冲突
 */

// ==================== 用户相关 ====================
/**
 * 用户注册信息
 * 存储格式: {
 *   realName: string,        // 真实姓名
 *   idType: string,          // 证件类型 (如: '身份证')
 *   idNumber: string,        // 证件号码
 *   phone: string,           // 手机号
 *   verifyCode: string       // 验证码
 * }
 */
export const STORAGE_KEY_USER_REGISTER = 'user_register_info'

/**
 * 用户登录状态
 * 存储格式: boolean
 */
export const STORAGE_KEY_USER_LOGIN_STATUS = 'user_login_status'

/**
 * 用户认证Token
 * 存储格式: string
 */
export const STORAGE_KEY_TOKEN = 'auth_token'

/**
 * 用户基本信息
 * 存储格式: {
 *   userId: string,
 *   userName: string,
 *   phone: string,
 *   ...
 * }
 */
export const STORAGE_KEY_USER_INFO = 'user_info'

/**
 * 微信 OpenID
 * 存储格式: string
 * 说明: 微信用户唯一标识，用于微信支付等功能
 */
export const STORAGE_KEY_WECHAT_OPENID = 'wechat_openid'

/**
 * 微信 UnionID
 * 存储格式: string
 * 说明: 微信开放平台账号下的唯一标识，可能为空
 */
export const STORAGE_KEY_WECHAT_UNIONID = 'wechat_unionid'

/**
 * 微信会话密钥
 * 存储格式: string
 * 说明: 微信会话密钥，用于解密微信数据
 */
export const STORAGE_KEY_WECHAT_SESSION_KEY = 'wechat_session_key'

// ==================== 其他业务数据 ====================
/**
 * 用户协议同意状态
 * 存储格式: boolean
 */
export const STORAGE_KEY_AGREEMENT_ACCEPTED = 'agreement_accepted'

/**
 * 用户隐私协议同意状态
 * 存储格式: boolean
 */
export const STORAGE_KEY_PRIVACY_ACCEPTED = 'privacy_accepted'

// ==================== 产品相关 ====================
/**
 * 已验证的产品列表（包含选中状态和数量信息）
 * 存储格式: {
 *   [productId: string]: {
 *     verified: boolean,     // 是否已验证（加入购物车）
 *     selected: boolean,     // 是否在处方列表中选中
 *     quantity: number,      // 产品数量（最小值为1）
 *     timestamp: number      // 添加时间戳（用于排序）
 *   }
 * }
 * 说明: 存储用户购物车中的产品完整信息，包括验证状态、选中状态和数量
 * 示例: {
 *   'zhou1': { verified: true, selected: true, quantity: 2, timestamp: 1234567890 },
 *   'gaoyao1': { verified: true, selected: false, quantity: 1, timestamp: 1234567891 }
 * }
 * 兼容性: 支持旧格式自动转换 { 'productId': boolean } -> 新格式
 */
export const STORAGE_KEY_VERIFIED_PRODUCTS = 'verifiedProducts'

/**
 * 产品数量（向后兼容）
 * 存储格式: {
 *   [productId: string]: number  // 产品ID作为key，对应的值为该产品的数量
 * }
 * 说明: 保留此常量以确保向后兼容，新代码优先使用 STORAGE_KEY_VERIFIED_PRODUCTS 中的 quantity 字段
 * 示例: { 'zhou1': 2, 'gaoyao1': 1 }
 */
export const STORAGE_KEY_PRODUCT_QUANTITIES = 'productQuantities'

/**
 * 选中的产品ID列表
 * 存储格式: string[]
 * 说明: 存储用户在商品列表页选中的产品ID列表，用于购物车功能
 * 示例: ['zhou1', 'gaoyao1']
 */
export const STORAGE_KEY_SELECTED_PRODUCTS = 'selected_products'

// ==================== 问诊/处方相关 ====================
/**
 * 当前问诊ID（用于关联处方和订单）
 * 存储格式: number | null
 */
export const STORAGE_KEY_CURRENT_CONSULTATION_ID = 'current_consultation_id'

// ==================== 订单相关 ====================
/**
 * 处方订单列表
 * 存储格式: Array<{
 *   id: string,                    // 订单ID
 *   doctorName: string,            // 医生姓名
 *   department: string,            // 科室
 *   consultationTime: string,      // 就诊时间
 *   diagnosis: string,             // 诊断
 *   doses: number,                 // 帖数
 *   details: string,               // 明细
 *   status: string,                // 状态: 'pending_review' | 'pending_payment' | 'collecting' | 'finished'
 *   tags: string[],                // 标签: ['在线复诊', '中药方', '密', '便捷配药']
 *   timeLimit: string,             // 时间限制: '1分钟内' | '1分钟前'
 *   hospital: string,              // 医院名称
 *   createdAt: string              // 创建时间
 * }>
 * 说明: 存储用户的处方订单列表
 */
export const STORAGE_KEY_PRESCRIPTION_ORDERS = 'prescription_orders'

/**
 * 当前选中的处方订单ID列表
 * 存储格式: string[]
 * 说明: 存储用户在订单缴费页面选中的处方订单ID列表
 */
export const STORAGE_KEY_SELECTED_PRESCRIPTIONS = 'selected_prescriptions'

/**
 * 当前订单信息
 * 存储格式: {
 *   prescriptions: string[],       // 选中的处方ID列表
 *   items: Array<{                 // 订单商品列表
 *     id: string,
 *     name: string,                // 商品名称
 *     type: string,                // 商品类型: '中药'
 *     price: number                // 单价
 *   }>,
 *   deliveryInfo: {                // 配送信息
 *     distributor: string,          // 配送方
 *     logistics: string,           // 物流公司
 *     purchaseMethod: string,       // 购药方式
 *     shippingPaymentMethod: string // 快递费支付方式
 *   },
 *   cost: {                        // 费用信息
 *     medicineCost: number,         // 药品费用
 *     isDecocted: boolean,          // 是否代煎
 *     shippingFee: number          // 快递费
 *   },
 *   total: number                  // 合计金额
 * }
 * 说明: 存储当前确认订单页面的订单信息
 */
export const STORAGE_KEY_CURRENT_ORDER = 'current_order'

// ==================== 地址相关 ====================
/**
 * 收货地址列表
 * 存储格式: Array<{
 *   id: string,                    // 地址ID
 *   name: string,                  // 收货人姓名
 *   phone: string,                 // 手机号
 *   province: string,              // 省份
 *   city: string,                  // 城市
 *   district: string,              // 区县
 *   street: string,                // 街道
 *   detail: string,                // 详细地址
 *   isDefault: boolean,            // 是否默认地址
 *   createdAt: string              // 创建时间
 * }>
 * 说明: 存储用户的收货地址列表
 */
export const STORAGE_KEY_SHIPPING_ADDRESSES = 'shipping_addresses'

/**
 * 默认收货地址ID
 * 存储格式: string | null
 * 说明: 存储当前默认收货地址的ID，如果为null则表示没有默认地址
 */
export const STORAGE_KEY_DEFAULT_ADDRESS_ID = 'default_address_id'

// ==================== 缓存相关 ====================
/**
 * 商品分类和产品缓存
 * 存储格式: {
 *   categories: Array,           // 分类列表
 *   products: Object,            // 按分类ID组织的商品数据
 *   timestamp: number,           // 缓存时间戳
 *   expireTime: number           // 过期时间（毫秒）
 * }
 * 说明: 缓存商品分类和产品数据，避免重复请求
 */
export const STORAGE_KEY_PRODUCTS_CACHE = 'products_cache'

/**
 * 缓存过期时间（毫秒）
 * 默认30分钟过期
 */
export const CACHE_EXPIRE_TIME = 30 * 60 * 1000

