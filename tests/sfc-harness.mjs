import * as orderDisplay from '../utils/order-display.js'
import { resolveProductFlow } from '../utils/product-biz.js'
import { getSessionGeneration, getSessionToken, isCurrentSession, onSessionChanged, sessionChangedError } from '../utils/session.js'
import { loadCartProducts } from '../utils/cart-products.js'
import { readFileSync } from 'node:fs'
import { resolveProductSku, withProductSku } from '../utils/product-sku.js'
import { buildListCartCategories, getProductCartLines } from '../utils/product-list-cart.js'
import { isPurchaseAvailable } from '../utils/purchase-quantity.js'
import { createHealthProductListMethods } from '../utils/health-product-list.js'
import { formatRichText } from '../utils/product-rich-text.js'
import { inventoryFields } from '../utils/inventory.js'
import { getImageUrl } from '../utils/config.js'
import * as checkout from '../utils/checkout.js'
import * as questionnaireForm from '../utils/questionnaire-form.js'
import * as questionnaireState from '../utils/questionnaire-state.js'
import { canPayOrder, getOrderStatusText, getReceiptConfirmText } from '../utils/order-status.js'
import * as prescription from '../utils/prescription.js'
import * as refund from '../utils/refund.js'
import { hasTherapyEntitlement } from '../utils/therapy.js'
import { getActionFailureResult } from '../utils/accessLog.js'
import { deriveBirthDateFromId, getPatientProfileNotice, preferredPatient } from '../utils/patient.js'
import { createPageReturn } from '../utils/page-return.js'
import { formatFreightEstimate } from '../utils/freight.js'
import { waitForSessionRecovery, beginManualAccountLogin, getAccountSessionState, onAccountSessionState } from '../utils/auth-session.js'
import { redirectToWithFallback } from '../utils/navigate.js'

const logMocks = { computed: getter => ({ get value() { return getter() } }), preferredPatient, getPatientList: async () => [], getImageUrl, formatFreightEstimate, getCurrentInstance: () => ({}), onLoad() {}, onShow() {}, onHide() {}, onResize() {}, onPageScroll() {}, onPullDownRefresh() {}, onReachBottom() {}, logPageView() {}, logButtonClick() {}, logAccess() {}, getActionFailureResult,
  getSessionToken, onSessionChanged, sessionChangedError,
  redirectToWithFallback,
  // 角标统计是页面的辅助读取，默认隔离网络；具体统计契约由调用方按需提供。
  getOrderStats: async () => ({ pending: 0 }),
  // 支付结果页隔离只读医院状态查询；具体字段和错误场景由支付结果用例注入。
  getPaymentStatusByOrder: async () => null,
  waitForSessionRecovery, beginManualAccountLogin, getAccountSessionState, onAccountSessionState,
  // 页面测试隔离身份服务；真实恢复与导航在 auth-session.test 中验证。
  requireAccountSession: async () => true,
  restoreAccountSession: async () => false,
  accountReturnPath: value => value || '/pages/products/medicine_list',
  // 页面单测默认使用合成账户；账户传输、鉴权与无缓存契约由 account-profile.test 单独验证。
  fetchAccountProfile: async () => ({ id: 7, userName: '测试账户', phone: '13800000000', idType: '身份证', idCardNo: '110101199001011237', avatarUrl: '' }),
  refreshCart: async () => [], changeCartItemQuantity: async () => true,
  // 默认隔离返回购物车的订单补查，清理契约由购物车核心用例注入真实实现。
  recoverPaidOrderCarts: async () => true }

const imageScript = readFileSync(new URL('../utils/product-image.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export /gm, '')
export const { PRODUCT_PLACEHOLDER, useProductImages, preloadProductImages } = Function('ref', 'getImageUrl',
  `${imageScript}\nreturn { PRODUCT_PLACEHOLDER, useProductImages, preloadProductImages }`
)(value => ({ value }), getImageUrl)

// 执行页面本身的业务代码，仅替换生命周期、响应式和网络边界。
const pageReturnMocks = mocks => ({
  createPageReturn: isCurrent => createPageReturn(isCurrent, {
    getPages: mocks.getCurrentPages || (() => []),
    setTimer: mocks.setTimeout || setTimeout,
    clearTimer: mocks.clearTimeout || clearTimeout
  })
})

export const loadSetup = (path, mocks, exports) => {
  mocks = { ...pageReturnMocks(mocks), ...mocks }
  if (path === 'pages/products/therapy_detail.vue' || path === 'pages/products/medicine_detail.vue') {
    const script = readFileSync(new URL('../utils/product-favorite.js', import.meta.url), 'utf8')
      .replace(/^import .*$/gm, '').replace(/^export /gm, '')
    mocks.useProductFavorite = Function('ref', 'setProductCollected', 'getSessionGeneration', 'isCurrentSession', 'uni',
      `${script}\nreturn useProductFavorite`)(mocks.ref, mocks.setProductCollected,
      mocks.getSessionGeneration || getSessionGeneration, mocks.isCurrentSession || isCurrentSession, mocks.uni)
  }
  if (mocks.getSessionGeneration && !mocks.isCurrentSession) mocks = { ...mocks, isCurrentSession: value => value === mocks.getSessionGeneration() }
  mocks = { ...logMocks, ...checkout, checkoutEntries: (keys, purchase) => purchase ? checkout.checkoutEntries(keys, purchase)
    : mocks.getCartEntries ? mocks.getCartEntries() : {},
    getOrderSubmission: (kind, data, cartSnapshot) => ({ requestId: 'fixture-order-request', cartSnapshot }),
    rememberCreatedOrder() {}, releaseOrderSubmission() {}, forgetOrderSubmission() {}, consumeOrderCart: () => true, ...mocks }
  mocks = { ...prescription, ...refund, ...orderDisplay, canPayOrder, ...questionnaireForm, ...questionnaireState, deriveBirthDateFromId, getPatientProfileNotice, getOrderStatusText, getReceiptConfirmText, hasTherapyEntitlement, resolveProductFlow, getSessionGeneration, isCurrentSession, getProductCartLines, loadCartProducts, formatRichText, onUnload() {}, resolveProductSku, withProductSku, inventoryFields, useProductImages, preloadProductImages, ...mocks }
  // 页面用例继续隔离后端结算与微信SDK；真实一次HTTP结算及会话边界由支付模块用例验证。
  if (path === 'pages/order/confirm.vue') mocks = {
    ...mocks,
    prepareOrderCheckout: mocks.prepareOrderCheckout || (async (kind, data) => {
      const order = await (kind === 'prescription' ? mocks.createOrderFromPrescription : mocks.createOrder)(data)
      return { order, paymentState: Number(order?.payStatus) === 1 ? 'ALREADY_PAID' : 'READY',
        payment: { orderId: order?.id, actualPayType: 'single' } }
    }),
    invokePreparedWechatPayment: mocks.invokePreparedWechatPayment || (orderId => mocks.wechatSinglePay(orderId))
  }
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const script = source.match(/<script\s+setup[^>]*>([\s\S]*?)<\/script>/)[1]
    .replace(/^[ \t]*import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
  return Function(...Object.keys(mocks), `${script}\nreturn {${exports.join(',')}}`)(...Object.values(mocks))
}

export const loadOptions = (path, mocks) => {
  mocks = { ...pageReturnMocks(mocks), ...mocks }
  if (mocks.getSessionGeneration && !mocks.isCurrentSession) mocks = { ...mocks, isCurrentSession: value => value === mocks.getSessionGeneration() }
  mocks = { ...logMocks, ...checkout, checkoutEntries: (keys, purchase) => purchase ? checkout.checkoutEntries(keys, purchase)
    : mocks.getCartEntries ? mocks.getCartEntries() : {}, ...mocks }
  const missingProductRequest = () => { throw new Error('测试未提供商品请求') }
  mocks = { ...prescription, ...refund, ...orderDisplay, canPayOrder, getOrderStatusText, getReceiptConfirmText, getImageUrl, ...questionnaireForm, ...questionnaireState, SingleChoiceQuestion: {}, resolveProductFlow, getSessionGeneration, isCurrentSession, buildListCartCategories, isPurchaseAvailable, getProductCartLines, loadCartProducts, createHealthProductListMethods, getCategoryList: missingProductRequest,
    getCategoryProducts: missingProductRequest, getProductDetail: missingProductRequest,
    mapProductDetail: missingProductRequest, mapProductListItem: missingProductRequest,
    resolveProductSku, withProductSku, useProductImages, preloadProductImages, ...mocks }
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^[ \t]*import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace('export default', 'return')
  return Function(...Object.keys(mocks), script)(...Object.values(mocks))
}
