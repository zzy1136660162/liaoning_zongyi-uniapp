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
import { deriveBirthDateFromId, getPatientProfileNotice } from '../utils/patient.js'
import { createPageReturn } from '../utils/page-return.js'
import { formatFreightEstimate } from '../utils/freight.js'
import { waitForSessionRecovery, beginManualAccountLogin, getAccountSessionState, onAccountSessionState } from '../utils/auth-session.js'

const logMocks = { formatFreightEstimate, getCurrentInstance: () => ({}), onLoad() {}, onShow() {}, onHide() {}, onResize() {}, onPullDownRefresh() {}, onReachBottom() {}, logPageView() {}, logButtonClick() {}, logAccess() {}, getActionFailureResult,
  getSessionToken, onSessionChanged, sessionChangedError,
  waitForSessionRecovery, beginManualAccountLogin, getAccountSessionState, onAccountSessionState,
  // 页面测试隔离身份服务；真实恢复与导航在 auth-session.test 中验证。
  requireAccountSession: async () => true,
  restoreAccountSession: async () => false,
  accountReturnPath: value => value || '/pages/products/medicine_list',
  // 页面单测默认使用合成账户；账户传输、鉴权与无缓存契约由 account-profile.test 单独验证。
  fetchAccountProfile: async () => ({ id: 7, userName: '测试账户', phone: '13800000000', idType: '身份证', idCardNo: '110101199001011237', avatarUrl: '' }),
  refreshCart: async () => [], changeCartItemQuantity: async () => true }

const imageScript = readFileSync(new URL('../utils/product-image.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export /gm, '')
export const { PRODUCT_PLACEHOLDER, useProductImages } = Function('ref', 'getImageUrl',
  `${imageScript}\nreturn { PRODUCT_PLACEHOLDER, useProductImages }`
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
  if (mocks.getSessionGeneration && !mocks.isCurrentSession) mocks = { ...mocks, isCurrentSession: value => value === mocks.getSessionGeneration() }
  mocks = { ...logMocks, ...checkout, checkoutEntries: (keys, purchase) => purchase ? checkout.checkoutEntries(keys, purchase)
    : mocks.getCartEntries ? mocks.getCartEntries() : {},
    getOrderSubmission: (kind, data, cartSnapshot) => ({ requestId: 'fixture-order-request', cartSnapshot }),
    rememberCreatedOrder() {}, releaseOrderSubmission() {}, forgetOrderSubmission() {}, consumeOrderCart: () => true, ...mocks }
  mocks = { ...prescription, ...refund, canPayOrder, ...questionnaireForm, ...questionnaireState, deriveBirthDateFromId, getPatientProfileNotice, getOrderStatusText, getReceiptConfirmText, hasTherapyEntitlement, resolveProductFlow, getSessionGeneration, isCurrentSession, getProductCartLines, loadCartProducts, formatRichText, onUnload() {}, resolveProductSku, withProductSku, inventoryFields, useProductImages, ...mocks }
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
  mocks = { ...prescription, ...refund, canPayOrder, getOrderStatusText, getReceiptConfirmText, getImageUrl, ...questionnaireForm, ...questionnaireState, SingleChoiceQuestion: {}, resolveProductFlow, getSessionGeneration, isCurrentSession, buildListCartCategories, isPurchaseAvailable, getProductCartLines, loadCartProducts, createHealthProductListMethods, getCategoryList: missingProductRequest,
    getCategoryProducts: missingProductRequest, getProductDetail: missingProductRequest,
    mapProductDetail: missingProductRequest, mapProductListItem: missingProductRequest,
    resolveProductSku, withProductSku, useProductImages, ...mocks }
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^[ \t]*import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace('export default', 'return')
  return Function(...Object.keys(mocks), script)(...Object.values(mocks))
}
