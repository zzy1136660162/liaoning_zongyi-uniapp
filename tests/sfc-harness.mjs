import { resolveProductFlow } from '../utils/product-biz.js'
import { getSessionGeneration, isCurrentSession } from '../utils/session.js'
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
import { canPayOrder, getOrderStatusText } from '../utils/order-status.js'
import * as prescription from '../utils/prescription.js'
import { hasTherapyEntitlement } from '../utils/therapy.js'

const imageScript = readFileSync(new URL('../utils/product-image.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export /gm, '')
export const { PRODUCT_PLACEHOLDER, useProductImages } = Function('ref', 'getImageUrl',
  `${imageScript}\nreturn { PRODUCT_PLACEHOLDER, useProductImages }`
)(value => ({ value }), getImageUrl)

// 执行页面本身的业务代码，仅替换生命周期、响应式和网络边界。
export const loadSetup = (path, mocks, exports) => {
  mocks = { ...checkout, checkoutEntries: (keys, purchase) => purchase ? checkout.checkoutEntries(keys, purchase)
    : mocks.getCartEntries ? mocks.getCartEntries() : {},
    getOrderSubmission: (kind, data, cartSnapshot) => ({ requestId: 'fixture-order-request', cartSnapshot }),
    rememberCreatedOrder() {}, releaseOrderSubmission() {}, forgetOrderSubmission() {}, consumeOrderCart: () => true, ...mocks }
  mocks = { ...prescription, canPayOrder, ...questionnaireForm, ...questionnaireState, getOrderStatusText, hasTherapyEntitlement, resolveProductFlow, getSessionGeneration, isCurrentSession, getProductCartLines, loadCartProducts, formatRichText, onUnload() {}, resolveProductSku, withProductSku, inventoryFields, useProductImages, ...mocks }
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const script = source.match(/<script\s+setup[^>]*>([\s\S]*?)<\/script>/)[1]
    .replace(/^[ \t]*import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
  return Function(...Object.keys(mocks), `${script}\nreturn {${exports.join(',')}}`)(...Object.values(mocks))
}

export const loadOptions = (path, mocks) => {
  mocks = { ...checkout, checkoutEntries: (keys, purchase) => purchase ? checkout.checkoutEntries(keys, purchase)
    : mocks.getCartEntries ? mocks.getCartEntries() : {}, ...mocks }
  const missingProductRequest = () => { throw new Error('测试未提供商品请求') }
  mocks = { ...prescription, canPayOrder, getOrderStatusText, getImageUrl, ...questionnaireForm, ...questionnaireState, SingleChoiceQuestion: {}, resolveProductFlow, getSessionGeneration, isCurrentSession, buildListCartCategories, isPurchaseAvailable, getProductCartLines, loadCartProducts, createHealthProductListMethods, getCategoryList: missingProductRequest,
    getCategoryProducts: missingProductRequest, getProductDetail: missingProductRequest,
    mapProductDetail: missingProductRequest, mapProductListItem: missingProductRequest,
    resolveProductSku, withProductSku, useProductImages, ...mocks }
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^[ \t]*import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace('export default', 'return')
  return Function(...Object.keys(mocks), script)(...Object.values(mocks))
}
