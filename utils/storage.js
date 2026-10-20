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
export const STORAGE_KEY_TOKEN = 'user_token'

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
 * 当前账号购物车只存 productId:skuId 规范条目；缺真实规格的历史条目不进入当前购物车。
 * 条目保留数量、勾选、问卷答案及商品展示快照；价格/库存每次打开页面重新查询。
 * 处方、问诊使用各自真实 ID，不能写成购物车条目。
 */
export const STORAGE_KEY_CART_ITEMS = 'cart_items'

// ==================== 问诊/处方相关 ====================
/**
 * 当前问诊ID（用于关联处方和订单）
 * 存储格式: number | null
 */
export const STORAGE_KEY_CURRENT_CONSULTATION_ID = 'current_consultation_id'

/**
 * 当前结算商品ID列表
 * 存储格式: string[]
 * 说明: 贯穿购物车 -> 问诊/确认页的当前结算上下文，避免使用全部购物车商品
 */
export const STORAGE_KEY_CHECKOUT_PRODUCT_IDS = 'checkout_product_ids'

// ==================== AI 客服相关 ====================
/**
 * 智能客服当前会话 ID
 * 存储格式: string
 */
export const STORAGE_KEY_AI_CHAT_ID = 'ai_chat_id'

/**
 * 智能客服消息列表
 * 存储格式: Array<{
 *   id: string,
 *   role: 'assistant' | 'user' | 'system',
 *   content: string,
 *   htmlContent: string,
 *   status: 'sending' | 'sent' | 'error',
 *   createdAt: number
 * }>
 */
export const STORAGE_KEY_AI_CHAT_MESSAGES = 'ai_chat_messages'

// ==================== 订单相关 ====================
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
 * 默认收货地址ID
 * 存储格式: string | null
 * 说明: 存储当前默认收货地址的ID，如果为null则表示没有默认地址
 */
export const STORAGE_KEY_DEFAULT_ADDRESS_ID = 'default_address_id'
