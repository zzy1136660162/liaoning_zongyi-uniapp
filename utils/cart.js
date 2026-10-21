import { normalizeCartId as normalizeId, splitCartItemKey, buildCartItemKey } from './cart-key.js'
import {
  STORAGE_KEY_CART_ITEMS,
  STORAGE_KEY_CHECKOUT_PRODUCT_IDS
} from './storage.js'
import {
  resolveGoodsMerchantType,
  resolveProductFlow,
  resolveProductTypeLabel
} from './product-biz.js'
import { inventoryFields } from './inventory.js'
import { resolveQuestionnaireState, resolveCheckoutQuestionnaire } from './questionnaire-state.js'

const CART_REMOTE_SYNC_EVENT = 'cartRemoteSync'

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toPositiveInt = (value, fallback = 1) => {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const toStockValue = (value, fallback = null) => {
  if (value === null) return null
  if (value === undefined || value === '') {
    return fallback
  }
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

const toFlag = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') {
    return fallback
  }
  if (typeof value === 'string') {
    return value === '1' || value.toLowerCase() === 'true'
  }
  return Boolean(value)
}

const uniqueIds = (ids = []) => [...new Set((Array.isArray(ids) ? ids : [ids]).map(normalizeId).filter(Boolean))]

export { splitCartItemKey, buildCartItemKey }

const resolveProductId = (productOrId) => {
  if (productOrId && typeof productOrId === 'object') {
    const directProductId = normalizeId(productOrId.productId)
    if (directProductId) {
      return directProductId
    }
    return splitCartItemKey(productOrId.id ?? productOrId.cartKey).productId
  }
  return splitCartItemKey(productOrId).productId
}

const resolveSkuId = (productOrId, options = {}) => {
  const optionSkuId = normalizeId(options.skuId)
  if (optionSkuId) {
    return optionSkuId
  }
  if (productOrId && typeof productOrId === 'object') {
    const productSkuId = normalizeId(
      productOrId.skuId ??
      productOrId.selectedSkuId ??
      productOrId.selectedSku?.id
    )
    if (productSkuId) {
      return productSkuId
    }
    return splitCartItemKey(productOrId.cartKey ?? productOrId.id).skuId
  }
  return splitCartItemKey(productOrId).skuId
}

const resolveCartItemKey = (productOrId, options = {}) => {
  if (typeof productOrId === 'string' || typeof productOrId === 'number') {
    const key = normalizeId(productOrId)
    if (key.includes(':') && options.skuId === undefined) {
      return key
    }
  }
  return buildCartItemKey(resolveProductId(productOrId), resolveSkuId(productOrId, options))
}

const hasExplicitAvailable = (value = {}) => {
  return value.inventoryMode === 'HIS_AVAILABILITY' || value.available !== undefined
}

const resolveAvailableFlag = (value = {}, fallback = true) => {
  if (value.inventoryMode === 'HIS_AVAILABILITY') return inventoryFields(value).available
  if (value.available !== undefined) {
    return toFlag(value.available, fallback)
  }

  return fallback
}

const resolveStockValue = (value = {}, fallback = null) => {
  if (value.stock !== undefined) {
    return toStockValue(value.stock, fallback)
  }

  return fallback
}

const isCartEntryAvailable = (entry = {}) => {
  if (entry.inventoryMode === 'HIS_AVAILABILITY' && !inventoryFields(entry).available) return false
  if (entry.available === false) {
    return false
  }
  if (entry.stock !== null && entry.stock !== undefined && toStockValue(entry.stock, null) <= 0) {
    return false
  }
  return true
}

const clampQuantityToStock = (quantity, stock) => {
  const normalizedQuantity = toPositiveInt(quantity, 1)
  const normalizedStock = toStockValue(stock, null)
  if (normalizedStock !== null && normalizedStock > 0) {
    return Math.min(normalizedQuantity, normalizedStock)
  }
  return normalizedQuantity
}

const pickText = (...values) => pickValue(...values) ?? ''

const pickValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }
  return null
}

const buildCartEntry = (cartKeyOrProductId, partial = {}) => {
  const productId = resolveProductId({ id: cartKeyOrProductId, ...partial })
  const skuId = resolveSkuId({ id: cartKeyOrProductId, ...partial })
  const cartKey = buildCartItemKey(productId, skuId)
  if (!cartKey) {
    return null
  }

  const stock = resolveStockValue(partial, null)
  const available = !skuId || stock === 0 ? false : resolveAvailableFlag(partial, true)
  const quantity = clampQuantityToStock(toPositiveInt(partial.quantity, 1), stock)
  const needQuestionnaire = toNumber(partial.needQuestionnaire, 0)

  return {
    productId,
    ...inventoryFields(partial),
    skuId: skuId || null,
    skuCode: pickText(partial.skuCode),
    skuName: pickText(partial.skuName),
    skuSpecText: pickText(partial.skuSpecText, partial.specText),
    productName: pickText(partial.productName, partial.name),
    coverImage: pickText(partial.coverImage, partial.image),
    price: partial.price !== undefined && partial.price !== null && partial.price !== '' ? Number(partial.price) : null,
    unit: pickText(partial.unit),
    selected: available ? toFlag(partial.selected, true) : false,
    quantity,
    available,
    stock,
    goodsMerchantType: partial.goodsMerchantType !== undefined && partial.goodsMerchantType !== null && partial.goodsMerchantType !== ''
      ? toNumber(partial.goodsMerchantType, null)
      : null,
    productCategory: partial.productCategory !== undefined && partial.productCategory !== null && partial.productCategory !== ''
      ? toNumber(partial.productCategory, null)
      : null,
    isPrescription: partial.isPrescription !== undefined && partial.isPrescription !== null && partial.isPrescription !== ''
      ? toNumber(partial.isPrescription, null)
      : null,
    categoryId: partial.categoryId ?? null,
    categoryCode: partial.categoryCode || '',
    needQuestionnaire,
    questionnaireId: needQuestionnaire === 1 ? pickValue(partial.questionnaireId) : null,
    answerId: needQuestionnaire === 1 ? pickValue(partial.answerId) : null,
    questionnairePassed: ['not_required', 'passed'].includes(resolveQuestionnaireState(partial, partial)),
    timestamp: partial.timestamp ? toNumber(partial.timestamp, Date.now()) : Date.now()
  }
}

// 购物车只保存规范条目；详情页数量草稿和处方编号不能成为购物车商品。
const normalizeCartData = (rawData) => {
  const normalized = {}
  Object.entries(rawData && typeof rawData === 'object' ? rawData : {}).forEach(([cartKey, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return
    const entry = buildCartEntry(cartKey, value)
    if (entry) normalized[buildCartItemKey(entry.productId, entry.skuId)] = entry
  })
  return normalized
}

const readCartData = () => {
  const raw = uni.getStorageSync(STORAGE_KEY_CART_ITEMS) || {}
  return normalizeCartData(raw)
}

// 本地写入立即通知页面/角标；后台推送独立防抖，不能阻塞用户增减数量。
const emitCartUpdated = (source = 'local') => {
  uni.$emit('cartUpdated', { source })
}

const triggerRemoteSync = (action, payload) => {
  try {
    uni.$emit(CART_REMOTE_SYNC_EVENT, { action, payload })
  } catch (error) {
    console.warn('cart remote sync dispatch failed:', error)
  }
}

const writeCartData = (cartData, options = {}) => {
  const normalized = normalizeCartData(cartData)
  uni.setStorageSync(STORAGE_KEY_CART_ITEMS, normalized)

  if (!options.silent) {
    emitCartUpdated(options.eventSource || 'local')
  }

  if (!options.suppressSync) {
    if (options.syncProductIds?.length) {
      triggerRemoteSync('upsert', options.syncProductIds)
    }
    if (options.syncRemoveIds?.length) {
      triggerRemoteSync('remove', options.syncRemoveIds)
    }
    if (options.syncClear) {
      triggerRemoteSync('clear', options.syncClear)
    }
  }
}

export const replaceCartData = (cartData) => {
  writeCartData(cartData, { suppressSync: true, eventSource: 'server' })
}

const resolveCartMetaFromProduct = (product = {}, existing = {}, options = {}) => {
  const hasProductObject = product && typeof product === 'object'
  const productGoodsMerchantType = hasProductObject && product.goodsMerchantType !== undefined
    ? (product.goodsMerchantType === null ? resolveGoodsMerchantType(product) : toNumber(product.goodsMerchantType, null))
    : null
  const productCategory = hasProductObject && product.productCategory !== undefined && product.productCategory !== null && product.productCategory !== ''
    ? toNumber(product.productCategory, null)
    : null
  const isPrescription = hasProductObject && product.isPrescription !== undefined && product.isPrescription !== null && product.isPrescription !== ''
    ? toNumber(product.isPrescription, null)
    : null
  const categoryId = hasProductObject
    ? (product.categoryId ?? existing.categoryId ?? null)
    : (existing.categoryId ?? null)
  const categoryCode = hasProductObject
    ? (product.categoryCode || existing.categoryCode || '')
    : (existing.categoryCode || '')
  const resolvedNeedQuestionnaire = hasProductObject && product.needQuestionnaire !== undefined
    ? toNumber(product.needQuestionnaire, 0)
    : toNumber(pickValue(options.needQuestionnaire, existing.needQuestionnaire, 0), 0)
  const hasProductQuestionnaireId = hasProductObject && product.questionnaireId !== undefined
  const productQuestionnaireId = product.questionnaireId
  const questionnaireId = resolvedNeedQuestionnaire === 1
    ? (hasProductQuestionnaireId ? productQuestionnaireId : pickValue(options.questionnaireId, existing.questionnaireId))
    : null
  const questionnaireProduct = { needQuestionnaire: resolvedNeedQuestionnaire, questionnaireId }
  // 提交凭据、后台回读凭据、原购物车凭据都必须匹配当前绑定，换绑不能沿用旧答案。
  const answerSource = [options, product, existing].find(entry => resolveQuestionnaireState(questionnaireProduct, entry) === 'passed')
  const answerId = answerSource?.answerId ?? null
  const questionnairePassed = ['not_required', 'passed'].includes(resolveQuestionnaireState(questionnaireProduct, { questionnaireId, answerId }))

  return {
    ...inventoryFields(product, existing),
    goodsMerchantType: toNumber(pickValue(productGoodsMerchantType, options.goodsMerchantType, existing.goodsMerchantType, resolveGoodsMerchantType(product)), null),
    // 最新商品配置优先于页面参数和持久化元数据，避免改类后仍走旧购买流程。
    productCategory: hasProductObject && product.productCategory !== undefined
      ? productCategory
      : toNumber(pickValue(options.productCategory, existing.productCategory), null),
    isPrescription: options.isPrescription !== undefined && options.isPrescription !== null
      ? toNumber(options.isPrescription, isPrescription || existing.isPrescription || null)
      : (isPrescription !== null ? isPrescription : (existing.isPrescription ?? null)),
    categoryId,
    categoryCode,
    needQuestionnaire: resolvedNeedQuestionnaire,
    questionnaireId,
    answerId,
    questionnairePassed,
    available: options.available !== undefined
      ? toFlag(options.available, true)
      : (hasProductObject && hasExplicitAvailable(product)
        ? resolveAvailableFlag(product, true)
        : resolveAvailableFlag(existing, true)),
    stock: options.stock !== undefined
      ? toStockValue(options.stock, null)
      : (hasProductObject
        ? resolveStockValue(product, resolveStockValue(existing, null))
        : resolveStockValue(existing, null))
  }
}

const getCheckoutProductIds = () => {
  try {
    const ids = uni.getStorageSync(STORAGE_KEY_CHECKOUT_PRODUCT_IDS) || []
    return uniqueIds(ids)
  } catch (error) {
    console.error('getCheckoutProductIds failed:', error)
    return []
  }
}

const clearCheckoutProductIds = () => {
  try {
    uni.removeStorageSync(STORAGE_KEY_CHECKOUT_PRODUCT_IDS)
    return true
  } catch (error) {
    console.error('clearCheckoutProductIds failed:', error)
    return false
  }
}

const setCheckoutProductIdsInternal = (productIds = []) => {
  try {
    uni.setStorageSync(STORAGE_KEY_CHECKOUT_PRODUCT_IDS, uniqueIds(productIds))
    return true
  } catch (error) {
    console.error('setCheckoutProductIds failed:', error)
    return false
  }
}

const updateCheckoutIdsAfterRemoval = (removedIds = []) => {
  const current = getCheckoutProductIds()
  if (!current.length) {
    return
  }
  const removedKeys = uniqueIds(removedIds)
  const removedSet = new Set(removedKeys)
  const removedProductOnlyIds = new Set(
    removedKeys
      .map(id => splitCartItemKey(id))
      .filter(item => item.productId && !item.skuId)
      .map(item => item.productId)
  )
  const next = current.filter((id) => {
    if (removedSet.has(id)) {
      return false
    }
    const { productId } = splitCartItemKey(id)
    return !removedProductOnlyIds.has(productId)
  })
  if (next.length > 0) {
    setCheckoutProductIdsInternal(next)
  } else {
    clearCheckoutProductIds()
  }
}

const flattenCategoryProducts = (categories = []) => {
  if (!Array.isArray(categories)) {
    return []
  }

  const items = []
  categories.forEach((category) => {
    if (Array.isArray(category?.products)) {
      items.push(...category.products)
    }
  })
  return items
}

const findProductById = (categories = [], cartKeyOrProductId) => {
  const cartKey = normalizeId(cartKeyOrProductId)
  if (!cartKey) {
    return null
  }

  const { productId, skuId } = splitCartItemKey(cartKey)
  const products = flattenCategoryProducts(categories)
  const exact = products.find(item => normalizeId(item.id ?? item.cartKey) === cartKey)
  if (exact) {
    return exact
  }
  if (skuId) {
    const skuMatch = products.find(item => {
      return normalizeId(item.productId) === productId &&
        normalizeId(item.skuId) === skuId
    })
    if (skuMatch) {
      return skuMatch
    }
    return null
  }
  return products.find(item => {
    const itemProductId = normalizeId(item.productId ?? item.id)
    const itemSkuId = normalizeId(item.skuId)
    return itemProductId === productId && (!skuId || !itemSkuId)
  }) || null
}

export const getCartEntries = () => {
  return readCartData()
}

export const getCartProductInfo = (productId, skuId = null) => {
  const key = buildCartItemKey(productId, skuId)
  if (!key) {
    return null
  }
  const cartData = readCartData()
  return cartData[key] || null
}

export const getCartProductQuantity = (productId, fallback = 1, skuId = null) => {
  const cartData = readCartData()
  const key = buildCartItemKey(productId, skuId)
  if (key && cartData[key]) {
    return toPositiveInt(cartData[key].quantity, fallback)
  }
  if (skuId) {
    return fallback
  }
  const normalizedProductId = normalizeId(productId)
  const total = Object.values(cartData)
    .filter(entry => normalizeId(entry.productId) === normalizedProductId)
    .reduce((sum, entry) => sum + toPositiveInt(entry.quantity, 1), 0)
  return total > 0 ? total : fallback
}

export const getCartTotalQuantity = () => {
  return Object.values(readCartData()).reduce((sum, entry) => sum + toPositiveInt(entry.quantity, 1), 0)
}

export const addCartItem = (productOrId, quantity = 1, options = {}) => {
  try {
    const cartKey = resolveCartItemKey(productOrId, options)
    if (!cartKey) {
      return false
    }

    const productId = resolveProductId(productOrId)
    const skuId = resolveSkuId(productOrId, options)
    if (!skuId) return false
    const cartData = readCartData()
    const existing = cartData[cartKey] || {}
    const meta = resolveCartMetaFromProduct(productOrId, existing, options)
    const product = productOrId && typeof productOrId === 'object' ? productOrId : {}

    cartData[cartKey] = {
      ...existing,
      productId,
      skuId: skuId || null,
      skuCode: pickText(options.skuCode, product.skuCode, existing.skuCode),
      skuName: pickText(options.skuName, product.skuName, existing.skuName),
      skuSpecText: pickText(options.skuSpecText, product.skuSpecText, product.specText, existing.skuSpecText),
      productName: pickText(product.productName, product.name, existing.productName),
      coverImage: pickText(product.coverImage, product.image, existing.coverImage),
      price: product.price !== undefined && product.price !== null && product.price !== ''
        ? Number(product.price)
        : (existing.price ?? null),
      unit: pickText(product.unit, existing.unit),
      selected: meta.available !== false && meta.stock !== 0
        ? (options.selected !== undefined ? toFlag(options.selected, true) : (existing.selected !== undefined ? toFlag(existing.selected, true) : true))
        : false,
      quantity: clampQuantityToStock(quantity, meta.stock),
      available: meta.stock === 0 ? false : meta.available,
      stock: meta.stock,
      ...inventoryFields(meta),
      goodsMerchantType: meta.goodsMerchantType,
      productCategory: meta.productCategory,
      isPrescription: meta.isPrescription,
      categoryId: meta.categoryId,
      categoryCode: meta.categoryCode,
      needQuestionnaire: meta.needQuestionnaire,
      questionnaireId: meta.questionnaireId,
      answerId: meta.answerId,
      questionnairePassed: meta.questionnairePassed,
      timestamp: existing.timestamp || Date.now()
    }

    writeCartData(cartData, { syncProductIds: [cartKey] })
    return true
  } catch (error) {
    console.error('addCartItem failed:', error)
    return false
  }
}


/** 补答只更新原行的问卷凭据；期间数量、勾选和删除操作均以当前购物车为准。 */
export const updateCartQuestionnaire = (product, submission) => {
  if (resolveQuestionnaireState(product, submission) !== 'passed') return false
  const cartKey = resolveCartItemKey(product)
  const data = readCartData()
  if (!resolveSkuId(product) || !data[cartKey]) return false
  data[cartKey] = { ...data[cartKey], needQuestionnaire: 1, questionnaireId: product.questionnaireId,
    answerId: submission.answerId, questionnairePassed: true }
  writeCartData(data, { syncProductIds: [cartKey] })
  return true
}

export const setCartItemQuantity = (productId, quantity) => {
  try {
    const cartKey = resolveCartItemKey(productId)
    if (!cartKey) {
      return false
    }

    if (toNumber(quantity, 0) <= 0) {
      return removeFromCart(cartKey)
    }

    const cartData = readCartData()
    const existing = cartData[cartKey]
    if (!existing?.skuId) return false
    const entry = buildCartEntry(cartKey, existing)
    if (!entry) {
      return false
    }
    cartData[cartKey] = {
      ...entry,
      quantity: clampQuantityToStock(quantity, existing.stock)
    }
    writeCartData(cartData, { syncProductIds: [cartKey] })
    return true
  } catch (error) {
    console.error('setCartItemQuantity failed:', error)
    return false
  }
}

export const removeFromCart = (productIds) => {
  try {
    const ids = uniqueIds(productIds)
    if (!ids.length) {
      return true
    }

    const cartData = readCartData()
    ids.forEach((id) => {
      const cartKey = resolveCartItemKey(id)
      if (cartData[cartKey]) {
        delete cartData[cartKey]
        return
      }
      const { productId, skuId } = splitCartItemKey(cartKey)
      if (!skuId && productId) {
        Object.keys(cartData).forEach((existingKey) => {
          const entry = cartData[existingKey]
          const existingProductId = normalizeId(entry?.productId || splitCartItemKey(existingKey).productId)
          if (existingProductId === productId) {
            delete cartData[existingKey]
          }
        })
      }
    })

    writeCartData(cartData, { syncRemoveIds: ids })
    updateCheckoutIdsAfterRemoval(ids)
    return true
  } catch (error) {
    console.error('removeFromCart failed:', error)
    return false
  }
}

export const clearCart = () => {
  try {
    const removedKeys = Object.keys(readCartData())
    writeCartData({}, { syncClear: removedKeys })
    clearCheckoutProductIds()
    return true
  } catch (error) {
    console.error('clearCart failed:', error)
    return false
  }
}

export const updateProductSelection = (productId, selected) => {
  try {
    const cartKey = resolveCartItemKey(productId)
    const cartData = readCartData()
    if (!cartData[cartKey]) {
      return false
    }

    cartData[cartKey].selected = isCartEntryAvailable(cartData[cartKey])
      ? toFlag(selected, true)
      : false
    writeCartData(cartData, { syncProductIds: [cartKey] })
    return selected ? cartData[cartKey].selected : true
  } catch (error) {
    console.error('updateProductSelection failed:', error)
    return false
  }
}

export const updateMultipleSelections = (selectionMap = {}) => {
  try {
    const cartData = readCartData()
    const changedIds = []
    Object.entries(selectionMap).forEach(([productId, selected]) => {
      const cartKey = resolveCartItemKey(productId)
      if (cartData[cartKey]) {
        cartData[cartKey].selected = isCartEntryAvailable(cartData[cartKey])
          ? toFlag(selected, true)
          : false
        changedIds.push(cartKey)
      }
    })
    writeCartData(cartData, { syncProductIds: changedIds })
    return true
  } catch (error) {
    console.error('updateMultipleSelections failed:', error)
    return false
  }
}

export const getSelectedProductIds = () => {
  return Object.entries(readCartData())
    .filter(([, entry]) => entry.selected && isCartEntryAvailable(entry))
    .map(([cartKey]) => cartKey)
}

export const setCheckoutProductIds = (productIds = []) => {
  return setCheckoutProductIdsInternal(productIds)
}

export { getCheckoutProductIds, clearCheckoutProductIds }

export const getCurrentCheckoutProductIds = () => {
  const checkoutIds = getCheckoutProductIds()
  return checkoutIds.length > 0 ? checkoutIds : getSelectedProductIds()
}

const resolveProductDisplayName = (product = {}, entry = {}, productId = '') => {
  return product.name || product.productName || product.title || entry.name || entry.productName || productId || '商品'
}

export const validateCheckoutStock = (productIds = [], categories = []) => {
  const ids = uniqueIds(productIds.length > 0 ? productIds : getCurrentCheckoutProductIds())
  if (!ids.length) {
    return { valid: true, message: '', productId: null }
  }

  const cartData = readCartData()
  for (const cartKey of ids) {
    const entry = cartData[cartKey]
    const product = findProductById(categories, cartKey)
    const productName = resolveProductDisplayName(product || {}, entry || {}, cartKey)

    if (!entry || !product) {
      console.warn('category=CHECKOUT_STOCK_GUARD action=validate result=denied reason=product_missing cartKey=%s productName=%s', cartKey, productName)
      return {
        valid: false,
        productId: cartKey,
        message: `商品「${productName}」信息已失效，请刷新购物车后重试`,
        reason: 'product_missing'
      }
    }

    const quantity = toPositiveInt(entry.quantity, 1)
    const latestStock = resolveStockValue(product, entry.stock ?? null)
    const latestAvailable = latestStock === 0
      ? false
      : (hasExplicitAvailable(product) ? resolveAvailableFlag(product, true) : resolveAvailableFlag(entry, true))

    if (!latestAvailable) {
      console.warn('category=CHECKOUT_STOCK_GUARD action=validate result=denied reason=unavailable cartKey=%s productName=%s quantity=%s latestStock=%s', cartKey, productName, quantity, latestStock)
      return {
        valid: false,
        productId: cartKey,
        quantity,
        latestStock,
        message: `商品「${productName}」已售罄或下架，请调整购物车后重试`,
        reason: 'unavailable'
      }
    }

    if (latestStock !== null && quantity > latestStock) {
      console.warn('category=CHECKOUT_STOCK_GUARD action=validate result=denied reason=stock_shortage cartKey=%s productName=%s quantity=%s latestStock=%s', cartKey, productName, quantity, latestStock)
      return {
        valid: false,
        productId: cartKey,
        quantity,
        latestStock,
        message: `商品「${productName}」库存不足，当前库存${latestStock}件，请调整数量后重试`,
        reason: 'stock_shortage'
      }
    }
  }

  console.info('category=CHECKOUT_STOCK_GUARD action=validate result=allowed productCount=%s', ids.length)
  return { valid: true, message: '', productId: null }
}

export const loadCartItems = (categories = [], onlySelected = false) => {
  try {
    const cartData = readCartData()
    const cartItems = []
    let needsSave = false
    let quantityChanged = false

    Object.entries(cartData).forEach(([cartKey, entry]) => {
      if (onlySelected && !entry.selected) {
        return
      }

      const product = findProductById(categories, cartKey)
      if (!product) {
        return
      }

      const nextProductCategory = product.productCategory !== undefined
        ? (product.productCategory === null || product.productCategory === '' ? null : toNumber(product.productCategory, null))
        : (entry.productCategory ?? null)
      const nextIsPrescription = product.isPrescription !== undefined && product.isPrescription !== null && product.isPrescription !== ''
        ? toNumber(product.isPrescription, null)
        : (entry.isPrescription ?? null)
      const nextCategoryId = product.categoryId ?? entry.categoryId ?? null
      const nextCategoryCode = product.categoryCode || entry.categoryCode || ''
      const currentMeta = resolveCartMetaFromProduct(product, entry)
      const nextGoodsMerchantType = currentMeta.goodsMerchantType
      const nextNeedQuestionnaire = currentMeta.needQuestionnaire
      const nextQuestionnaireId = currentMeta.questionnaireId
      const nextAnswerId = currentMeta.answerId
      const nextQuestionnairePassed = currentMeta.questionnairePassed
      const nextStock = currentMeta.stock
      const nextAvailable = nextStock === 0 ? false : currentMeta.available
      const nextSelected = nextAvailable ? entry.selected !== false : false
      const nextQuantity = clampQuantityToStock(entry.quantity, nextStock)
      quantityChanged = quantityChanged || entry.quantity !== nextQuantity
      const productSkuId = normalizeId(product.skuId ?? entry.skuId)
      const productId = normalizeId(product.productId ?? entry.productId ?? splitCartItemKey(cartKey).productId)
      const skuSpecText = pickText(product.skuSpecText, product.specText, entry.skuSpecText)
      const skuName = pickText(product.skuName, entry.skuName)
      const price = product.price !== undefined && product.price !== null && product.price !== ''
        ? Number(product.price)
        : (entry.price ?? 0)

      const nextInventory = inventoryFields(product, entry)
      if (
        entry.inventoryMode !== nextInventory.inventoryMode ||
        entry.inventoryStatus !== nextInventory.inventoryStatus ||
        entry.inventoryReason !== nextInventory.inventoryReason ||
        entry.inventoryCheckedAt !== nextInventory.inventoryCheckedAt ||
        entry.goodsMerchantType !== nextGoodsMerchantType ||
        entry.productCategory !== nextProductCategory ||
        entry.isPrescription !== nextIsPrescription ||
        entry.categoryId !== nextCategoryId ||
        entry.categoryCode !== nextCategoryCode ||
        entry.needQuestionnaire !== nextNeedQuestionnaire ||
        entry.questionnaireId !== nextQuestionnaireId ||
        entry.answerId !== nextAnswerId ||
        entry.questionnairePassed !== nextQuestionnairePassed ||
        entry.available !== nextAvailable ||
        entry.stock !== nextStock ||
        entry.selected !== nextSelected ||
        entry.quantity !== nextQuantity
      ) {
        cartData[cartKey] = {
          ...entry,
          productId,
          skuId: productSkuId || null,
          skuName,
          skuSpecText,
          selected: nextSelected,
          quantity: nextQuantity,
          stock: nextStock,
          ...nextInventory,
          available: nextAvailable,
          goodsMerchantType: nextGoodsMerchantType,
          productCategory: nextProductCategory,
          isPrescription: nextIsPrescription,
          categoryId: nextCategoryId,
          categoryCode: nextCategoryCode,
          needQuestionnaire: nextNeedQuestionnaire,
          questionnaireId: nextQuestionnaireId,
          answerId: nextAnswerId,
          questionnairePassed: nextQuestionnairePassed
        }
        needsSave = true
      }

      if (onlySelected && !nextSelected) {
        return
      }

      cartItems.push({
        ...product,
        id: cartKey,
        cartKey,
        productId,
        skuId: productSkuId || null,
        skuCode: pickText(product.skuCode, entry.skuCode),
        skuName,
        skuSpecText,
        specText: skuSpecText || product.specText || entry.skuSpecText || '',
        name: product.name || product.productName || entry.name || entry.productName || '',
        productName: product.productName || product.name || entry.productName || entry.name || '',
        image: product.image || product.coverImage || entry.image || entry.coverImage || '',
        coverImage: product.coverImage || product.image || entry.coverImage || entry.image || '',
        price,
        unit: product.unit || entry.unit || '',
        quantity: nextQuantity,
        selected: nextSelected,
        stock: nextStock,
        ...nextInventory,
        available: nextAvailable,
        goodsMerchantType: nextGoodsMerchantType,
        productCategory: nextProductCategory,
        isPrescription: nextIsPrescription,
        categoryId: nextCategoryId,
        categoryCode: nextCategoryCode,
        needQuestionnaire: nextNeedQuestionnaire,
        questionnaireId: nextQuestionnaireId,
        answerId: nextAnswerId,
        questionnairePassed: nextQuestionnairePassed,
        timestamp: entry.timestamp || Date.now()
      })
    })

    if (needsSave) {
      writeCartData(cartData, { suppressSync: true, silent: !quantityChanged })
    }

    return cartItems.sort((a, b) => toNumber(a.timestamp, 0) - toNumber(b.timestamp, 0))
  } catch (error) {
    console.error('loadCartItems failed:', error)
    return []
  }
}

export const mapServerCartItemToProduct = (item = {}) => {
  const productId = normalizeId(item.productId ?? item.id)
  const skuId = normalizeId(item.skuId)
  const cartKey = buildCartItemKey(productId, skuId)
  const specText = pickText(item.skuSpecText, item.specText, item.subTitle)
  const stock = resolveStockValue(item, null)
  return {
    id: cartKey,
    cartKey,
    productId,
    skuId: skuId || null,
    skuCode: pickText(item.skuCode),
    skuName: pickText(item.skuName),
    skuSpecText: specText,
    name: item.productName || item.name || '',
    productName: item.productName || item.name || '',
    description: item.subTitle || '',
    image: item.coverImage || item.image || '',
    coverImage: item.coverImage || item.image || '',
    price: Number(item.price || 0),
    unit: item.unit || '件',
    specText,
    goodsMerchantType: item.goodsMerchantType,
    productCategory: item.productCategory,
    isPrescription: item.isPrescription,
    categoryId: item.categoryId,
    categoryCode: item.categoryCode || '',
    needQuestionnaire: toNumber(item.needQuestionnaire, 0),
    questionnaireId: item.questionnaireId ?? null,
    answerId: item.answerId ?? null,
    ...inventoryFields(item),
    stock,
    available: stock === 0 ? false : resolveAvailableFlag(item, true)
  }
}

export const buildCategoriesFromServerCart = (serverItems = []) => {
  const products = (Array.isArray(serverItems) ? serverItems : []).map(mapServerCartItemToProduct)
  return [{
    id: 'cart_items',
    name: '购物车商品',
    products
  }]
}

export const calculateTotalPrice = (cartItems = []) => {
  return cartItems.reduce((total, item) => {
    if (item.selected === false || !isCartEntryAvailable(item)) {
      return total
    }
    const unitPrice = toNumber(item.price, 0)
    const quantity = toPositiveInt(item.quantity, 1)
    return total + unitPrice * quantity
  }, 0)
}

export const calculateTotalQuantity = (cartItems = []) => {
  return cartItems.reduce((total, item) => total + toPositiveInt(item.quantity, 1), 0)
}

export const buildOrderItems = (cartItems = [], selectedProductIds = null) => {
  let items = cartItems
  if (Array.isArray(selectedProductIds) && selectedProductIds.length > 0) {
    const selectedSet = new Set(uniqueIds(selectedProductIds))
    items = cartItems.filter(item => selectedSet.has(normalizeId(item.id)))
  }

  return items.map(item => {
    if (!isCartEntryAvailable(item)) {
      return null
    }
    const unitPrice = toNumber(item.price, 0)
    const quantity = toPositiveInt(item.quantity, 1)
    return {
      id: item.id,
      cartKey: item.cartKey || item.id,
      productId: normalizeId(item.productId ?? splitCartItemKey(item.id).productId),
      skuId: normalizeId(item.skuId ?? splitCartItemKey(item.id).skuId) || null,
      skuCode: item.skuCode || '',
      skuName: item.skuName || '',
      skuSpecText: item.skuSpecText || item.specText || '',
      name: item.name || item.productName || '',
      type: resolveProductTypeLabel(item),
      specText: item.specText || item.skuSpecText || '',
      unitPrice: Number(unitPrice.toFixed(2)),
      price: Number((unitPrice * quantity).toFixed(2)),
      quantity
    }
  }).filter(Boolean)
}

export const buildOrderInfo = (
  cartItems = [],
  selectedProductIds = null,
  distributor = '辽宁中医药大学附属医院',
) => {
  let selectedItems = cartItems
  if (Array.isArray(selectedProductIds) && selectedProductIds.length > 0) {
    const selectedSet = new Set(uniqueIds(selectedProductIds))
    selectedItems = cartItems.filter(item => selectedSet.has(normalizeId(item.id)))
  }

  const orderItems = buildOrderItems(selectedItems)
  const medicineCost = Number(orderItems.reduce((sum, item) => sum + item.price, 0).toFixed(2))
  const flow = resolveProductFlow(selectedItems)

  return {
    prescriptions: orderItems.map(item => item.productId),
    items: orderItems,
    deliveryInfo: {
      distributor,
      logistics: '顺丰快递',
      purchaseMethod: flow.requiresConsultation ? '制剂复诊及商品购买' : '商品在线支付',
      shippingPaymentMethod: '在线支付'
    },
    cost: {
      medicineCost,
      isDecocted: false,
      shippingFee: 0
    },
    total: medicineCost
  }
}

// 加购只验证购买分类有效性，不按分类、商户或后续是否复诊互相排斥。
export const resolveCartCompatibility = product => resolveProductFlow(product ? [product] : [])

export const resolveCheckoutFlow = (productIds = [], categories = []) => {
  const ids = uniqueIds(productIds.length > 0 ? productIds : getCurrentCheckoutProductIds())
  if (!ids.length) {
    return {
      valid: true,
      message: '',
      items: [],
      productIds: []
    }
  }

  const selectedSet = new Set(ids)
  const items = loadCartItems(categories).filter(item => selectedSet.has(normalizeId(item.id)))
  const flow = resolveProductFlow(items)

  return {
    ...flow,
    items,
    productIds: ids
  }
}

export const prepareCheckout = (productIds = [], categories = []) => {
  const stockCheck = validateCheckoutStock(productIds, categories)
  if (!stockCheck.valid) {
    return {
      valid: false,
      goodsMerchantType: null,
      flowType: null,
      requiresConsultation: false,
      message: stockCheck.message,
      stockCheck,
      items: [],
      productIds: uniqueIds(productIds.length > 0 ? productIds : getCurrentCheckoutProductIds())
    }
  }

  const resolved = resolveCheckoutFlow(productIds, categories)
  if (!resolved.valid) return resolved
  const questionnaireCheck = resolveCheckoutQuestionnaire(resolved.items)
  if (!questionnaireCheck.valid) return { ...resolved, valid: false, message: questionnaireCheck.message, questionnaireCheck }
  if (resolved.productIds.length > 0) {
    setCheckoutProductIdsInternal(resolved.productIds)
  }
  return resolved
}

export const getCartStatistics = () => {
  const entries = Object.values(readCartData())
  const totalCount = entries.length
  const selectedCount = entries.filter(entry => entry.selected && isCartEntryAvailable(entry)).length
  return {
    totalCount,
    selectedCount,
    totalPrice: 0
  }
}
