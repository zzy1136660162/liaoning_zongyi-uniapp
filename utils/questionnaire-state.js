export const QUESTIONNAIRE_UNAVAILABLE_MESSAGE = '商品问卷暂不可用，请联系医院确认后再购买'
export const QUESTIONNAIRE_REQUIRED_MESSAGE = '请先完成本次结算问卷'

const normalizeId = value => value == null ? '' : String(value).trim()
const hasValidId = value => /^[1-9]\d*$/.test(normalizeId(value))

/** 通过态属于当前商品绑定的问卷和服务端答案，不信任旧的布尔通过标志。 */
export const resolveQuestionnaireState = (product = {}, entry = {}) => {
  if (Number(product.needQuestionnaire) !== 1) return 'not_required'
  if (!hasValidId(product.questionnaireId)) return 'unavailable'
  return normalizeId(product.questionnaireId) === normalizeId(entry?.questionnaireId) && hasValidId(entry?.answerId)
    ? 'passed' : 'required'
}

export const getQuestionnaireStateMessage = state => state === 'unavailable'
  ? QUESTIONNAIRE_UNAVAILABLE_MESSAGE : state === 'required' ? QUESTIONNAIRE_REQUIRED_MESSAGE : ''

/** 所有购买入口复用须知→问卷两层路径，repair 用于补答原购物车行。 */
export const buildQuestionnaireNoticeUrl = (product, { quantity = 1, action = 'cart', selectedItems = [] } = {}) => {
  const id = product.productId || product.id
  const skuParam = product.skuId ? `&skuId=${encodeURIComponent(product.skuId)}` : ''
  const selectedParam = selectedItems.length ? `&selectedItems=${encodeURIComponent(selectedItems.join(','))}` : ''
  return `/pages/products/product_notice?id=${encodeURIComponent(id)}&quantity=${Math.max(1, Number(quantity) || 1)}&action=${encodeURIComponent(action)}${skuParam}${selectedParam}`
}

/** 混合结算只答一份：在所选需要问卷的商品中，固定取商品 ID 最小的一件。 */
export const resolveCheckoutQuestionnaire = (items = []) => {
  const first = items.filter(product => Number(product.needQuestionnaire) === 1)
    .sort((left, right) => Number(left.productId || left.id) - Number(right.productId || right.id))[0] || null
  // 问卷属于商品：同一最小商品的已选规格已有当前答卷时复用，不强迫另一规格重复答题。
  const item = first && (items.find(product => String(product.productId || product.id) === String(first.productId || first.id)
    && normalizeId(product.questionnaireId) === normalizeId(first.questionnaireId)
    && resolveQuestionnaireState(product, product) === 'passed') || first)
  const state = item ? resolveQuestionnaireState(item, item) : 'not_required'
  return { valid: state === 'not_required' || state === 'passed', state, item, message: getQuestionnaireStateMessage(state) }
}
