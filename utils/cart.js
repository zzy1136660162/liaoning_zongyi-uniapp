import {
  STORAGE_KEY_VERIFIED_PRODUCTS,
  STORAGE_KEY_PRODUCT_QUANTITIES,
  STORAGE_KEY_CHECKOUT_PRODUCT_IDS
} from './storage.js'
import {
  BIZ_TYPE_HOSPITAL_MEDICAL,
  resolveGoodsMerchantType,
  resolveProductBizType,
  resolveProductFlow,
  resolveProductTypeLabel
} from './product-biz.js'

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
  if (value === undefined || value === null || value === '') {
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

const normalizeId = (value) => {
  if (value === undefined || value === null || value === '') {
    return ''
  }
  return String(value).trim()
}

const uniqueIds = (ids = []) => {
  return [...new Set((Array.isArray(ids) ? ids : [ids]).map(normalizeId).filter(Boolean))]
}

export const splitCartItemKey = (cartKey) => {
  const key = normalizeId(cartKey)
  if (!key) {
    return { productId: '', skuId: '' }
  }
  const separatorIndex = key.indexOf(':')
  if (separatorIndex < 0) {
    return { productId: key, skuId: '' }
  }
  return {
    productId: key.slice(0, separatorIndex),
    skuId: key.slice(separatorIndex + 1)
  }
}

export const buildCartItemKey = (productId, skuId = null) => {
  const normalizedProductId = normalizeId(productId)
  const normalizedSkuId = normalizeId(skuId)
  if (!normalizedProductId) {
    return ''
  }
  return normalizedSkuId ? `${normalizedProductId}:${normalizedSkuId}` : normalizedProductId
}

const resolveProductId = (productOrId) => {
  if (productOrId && typeof productOrId === 'object') {
    const directProductId = normalizeId(productOrId.productId ?? productOrId.product_id)
    if (directProductId) {
      return directProductId
    }
    return splitCartItemKey(productOrId.id ?? productOrId.cartKey).productId
  }
  return splitCartItemKey(productOrId).productId
}

const resolveSkuId = (productOrId, options = {}) => {
  const optionSkuId = normalizeId(options.skuId ?? options.sku_id)
  if (optionSkuId) {
    return optionSkuId
  }
  if (productOrId && typeof productOrId === 'object') {
    const productSkuId = normalizeId(
      productOrId.skuId ??
      productOrId.sku_id ??
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
  return value.available !== undefined || value.saleable !== undefined || value.onSale !== undefined
}

const resolveAvailableFlag = (value = {}, fallback = true) => {
  if (value.available !== undefined) {
    return toFlag(value.available, fallback)
  }
  if (value.saleable !== undefined) {
    return toFlag(value.saleable, fallback)
  }
  if (value.onSale !== undefined) {
    return toFlag(value.onSale, fallback)
  }
  return fallback
}

const resolveStockValue = (value = {}, fallback = null) => {
  if (value.stock !== undefined) {
    return toStockValue(value.stock, fallback)
  }
  if (value.stockQuantity !== undefined) {
    return toStockValue(value.stockQuantity, fallback)
  }
  if (value.inventory !== undefined) {
    return toStockValue(value.inventory, fallback)
  }
  return fallback
}

const isCartEntryAvailable = (entry = {}) => {
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

const readLegacyQuantities = () => {
  const quantities = uni.getStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES) || {}
  return typeof quantities === 'object' && quantities !== null ? quantities : {}
}

const pickText = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }
  return ''
}

const pickValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }
  return null
}

const buildCartEntry = (cartKeyOrProductId, partial = {}, legacyQuantities = {}) => {
  const productId = resolveProductId({ id: cartKeyOrProductId, ...partial })
  const skuId = resolveSkuId({ id: cartKeyOrProductId, ...partial })
  const cartKey = buildCartItemKey(productId, skuId)
  if (!cartKey) {
    return null
  }

  const legacyQuantity = legacyQuantities[cartKey] ?? legacyQuantities[productId]
  const stock = resolveStockValue(partial, null)
  const available = stock === 0 ? false : resolveAvailableFlag(partial, true)
  const quantity = clampQuantityToStock(toPositiveInt(partial.quantity, toPositiveInt(legacyQuantity, 1)), stock)
  const needQuestionnaire = toNumber(partial.needQuestionnaire, 0)
  const defaultQuestionnairePassed = needQuestionnaire === 1 ? false : true

  return {
    productId,
    skuId: skuId || null,
    skuCode: pickText(partial.skuCode, partial.sku_code),
    skuName: pickText(partial.skuName, partial.sku_name),
    skuSpecText: pickText(partial.skuSpecText, partial.sku_spec_text, partial.specText, partial.spec_text),
    productName: pickText(partial.productName, partial.product_name, partial.name),
    name: pickText(partial.name, partial.productName, partial.product_name),
    coverImage: pickText(partial.coverImage, partial.cover_image, partial.image),
    image: pickText(partial.image, partial.coverImage, partial.cover_image),
    price: partial.price !== undefined && partial.price !== null && partial.price !== '' ? Number(partial.price) : null,
    unit: pickText(partial.unit),
    verified: toFlag(partial.verified, true),
    selected: available ? toFlag(partial.selected, true) : false,
    quantity,
    available,
    stock,
    bizType: partial.bizType !== undefined && partial.bizType !== null && partial.bizType !== ''
      ? toNumber(partial.bizType, null)
      : null,
    goodsMerchantType: partial.goodsMerchantType !== undefined && partial.goodsMerchantType !== null && partial.goodsMerchantType !== ''
      ? toNumber(partial.goodsMerchantType, null)
      : null,
    productCategory: partial.productCategory !== undefined && partial.productCategory !== null && partial.productCategory !== ''
      ? toNumber(partial.productCategory, null)
      : null,
    isPrescription: partial.isPrescription !== undefined && partial.isPrescription !== null && partial.isPrescription !== ''
      ? toNumber(partial.isPrescription, null)
      : null,
    categoryId: partial.categoryId ?? partial.category_id ?? null,
    categoryCode: partial.categoryCode || partial.category_code || '',
    needQuestionnaire,
    questionnaireId: needQuestionnaire === 1 ? pickValue(partial.questionnaireId, partial.questionnaire_id) : null,
    answerId: needQuestionnaire === 1 ? pickValue(partial.answerId, partial.answer_id) : null,
    questionnairePassed: toFlag(partial.questionnairePassed, defaultQuestionnairePassed),
    timestamp: partial.timestamp ? toNumber(partial.timestamp, Date.now()) : Date.now()
  }
}

const normalizeCartData = (rawData, options = {}) => {
  const { includeLegacyIds = true } = options
  const legacyQuantities = readLegacyQuantities()
  const normalized = {}
  const source = rawData && typeof rawData === 'object' ? rawData : {}
  const sourceKeys = Object.keys(source)
  const ids = includeLegacyIds
    ? uniqueIds([...sourceKeys, ...Object.keys(legacyQuantities)])
    : uniqueIds(sourceKeys)

  ids.forEach((rawKey) => {
    const value = source[rawKey]
    if (typeof value === 'boolean') {
      const entry = buildCartEntry(rawKey, { verified: value }, legacyQuantities)
      if (entry && entry.verified) {
        normalized[buildCartItemKey(entry.productId, entry.skuId)] = entry
      }
      return
    }

    if (value && typeof value === 'object') {
      const entry = buildCartEntry(rawKey, value, legacyQuantities)
      if (entry && entry.verified) {
        normalized[buildCartItemKey(entry.productId, entry.skuId)] = entry
      }
      return
    }

    if (legacyQuantities[rawKey] !== undefined) {
      const entry = buildCartEntry(rawKey, { verified: true }, legacyQuantities)
      if (entry) {
        normalized[buildCartItemKey(entry.productId, entry.skuId)] = entry
      }
    }
  })

  return normalized
}

const readCartData = () => {
  const raw = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
  return normalizeCartData(raw)
}

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
  const normalized = normalizeCartData(cartData, { includeLegacyIds: false })
  const legacyQuantities = {}

  Object.entries(normalized).forEach(([cartKey, entry]) => {
    if (entry.verified) {
      legacyQuantities[cartKey] = toPositiveInt(entry.quantity, 1)
    }
  })

  uni.setStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS, normalized)
  uni.setStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES, legacyQuantities)

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
      triggerRemoteSync('clear')
    }
  }
}

export const replaceCartData = (cartData) => {
  writeCartData(cartData, { suppressSync: true, eventSource: 'server' })
}

const resolveCartMetaFromProduct = (product = {}, existing = {}, options = {}) => {
  const hasProductObject = product && typeof product === 'object'
  const productBizType = hasProductObject ? resolveProductBizType(product) : null
  const productGoodsMerchantType = hasProductObject ? resolveGoodsMerchantType(product) : null
  const productCategory = hasProductObject && product.productCategory !== undefined && product.productCategory !== null && product.productCategory !== ''
    ? toNumber(product.productCategory, null)
    : null
  const isPrescription = hasProductObject && product.isPrescription !== undefined && product.isPrescription !== null && product.isPrescription !== ''
    ? toNumber(product.isPrescription, null)
    : null
  const categoryId = hasProductObject
    ? (product.categoryId ?? product.category_id ?? existing.categoryId ?? null)
    : (existing.categoryId ?? null)
  const categoryCode = hasProductObject
    ? (product.categoryCode || product.category_code || existing.categoryCode || '')
    : (existing.categoryCode || '')
  const resolvedNeedQuestionnaire = options.needQuestionnaire !== undefined
    ? toNumber(options.needQuestionnaire, 0)
    : (hasProductObject && product.needQuestionnaire !== undefined
      ? toNumber(product.needQuestionnaire, 0)
      : toNumber(existing.needQuestionnaire, 0))

  const questionnairePassed = options.questionnairePassed !== undefined
    ? toFlag(options.questionnairePassed, false)
    : (existing.questionnairePassed !== undefined
      ? toFlag(existing.questionnairePassed, resolvedNeedQuestionnaire !== 1)
      : resolvedNeedQuestionnaire !== 1)
  const questionnaireId = resolvedNeedQuestionnaire === 1
    ? pickValue(options.questionnaireId, product.questionnaireId, product.questionnaire_id, existing.questionnaireId)
    : null
  const answerId = resolvedNeedQuestionnaire === 1
    ? pickValue(options.answerId, product.answerId, product.answer_id, existing.answerId)
    : null

  return {
    bizType: options.bizType !== undefined && options.bizType !== null
      ? toNumber(options.bizType, productBizType || existing.bizType || null)
      : (productBizType !== null ? productBizType : (existing.bizType ?? null)),
    goodsMerchantType: options.goodsMerchantType !== undefined && options.goodsMerchantType !== null
      ? toNumber(options.goodsMerchantType, productGoodsMerchantType || existing.goodsMerchantType || null)
      : (productGoodsMerchantType !== null ? productGoodsMerchantType : (existing.goodsMerchantType ?? null)),
    productCategory: options.productCategory !== undefined && options.productCategory !== null
      ? toNumber(options.productCategory, productCategory || existing.productCategory || null)
      : (productCategory !== null ? productCategory : (existing.productCategory ?? null)),
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
      return normalizeId(item.productId ?? item.product_id) === productId &&
        normalizeId(item.skuId ?? item.sku_id) === skuId
    })
    if (skuMatch) {
      return skuMatch
    }
  }
  return products.find(item => {
    const itemProductId = normalizeId(item.productId ?? item.product_id ?? item.id)
    const itemSkuId = normalizeId(item.skuId ?? item.sku_id)
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
    const cartData = readCartData()
    const existing = cartData[cartKey] || {}
    const meta = resolveCartMetaFromProduct(productOrId, existing, options)
    const product = productOrId && typeof productOrId === 'object' ? productOrId : {}

    cartData[cartKey] = {
      ...existing,
      productId,
      skuId: skuId || null,
      skuCode: pickText(options.skuCode, product.skuCode, product.sku_code, existing.skuCode),
      skuName: pickText(options.skuName, product.skuName, product.sku_name, existing.skuName),
      skuSpecText: pickText(options.skuSpecText, product.skuSpecText, product.sku_spec_text, product.specText, existing.skuSpecText),
      productName: pickText(product.productName, product.product_name, product.name, existing.productName),
      name: pickText(product.name, product.productName, product.product_name, existing.name),
      coverImage: pickText(product.coverImage, product.cover_image, product.image, existing.coverImage),
      image: pickText(product.image, product.coverImage, product.cover_image, existing.image),
      price: product.price !== undefined && product.price !== null && product.price !== ''
        ? Number(product.price)
        : (existing.price ?? null),
      unit: pickText(product.unit, existing.unit),
      verified: options.verified !== undefined ? toFlag(options.verified, true) : true,
      selected: meta.available !== false && meta.stock !== 0
        ? (options.selected !== undefined ? toFlag(options.selected, true) : (existing.selected !== undefined ? toFlag(existing.selected, true) : true))
        : false,
      quantity: clampQuantityToStock(quantity, meta.stock),
      available: meta.stock === 0 ? false : meta.available,
      stock: meta.stock,
      bizType: meta.bizType,
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

export const saveToCart = (productId, quantity = 1, selected = true) => {
  const existing = getCartProductInfo(productId)
  return addCartItem(existing ? { id: productId, ...existing } : { id: productId }, quantity, {
    selected
  })
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
    const existing = cartData[cartKey] || {}
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
    writeCartData({}, { syncClear: true })
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
    .filter(([, entry]) => entry.verified && entry.selected && isCartEntryAvailable(entry))
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

    Object.entries(cartData).forEach(([cartKey, entry]) => {
      if (!entry.verified) {
        return
      }
      if (onlySelected && !entry.selected) {
        return
      }

      const product = findProductById(categories, cartKey)
      if (!product) {
        return
      }

      const nextProductCategory = product.productCategory !== undefined && product.productCategory !== null && product.productCategory !== ''
        ? toNumber(product.productCategory, null)
        : (entry.productCategory ?? null)
      const nextIsPrescription = product.isPrescription !== undefined && product.isPrescription !== null && product.isPrescription !== ''
        ? toNumber(product.isPrescription, null)
        : (entry.isPrescription ?? null)
      const nextCategoryId = product.categoryId ?? product.category_id ?? entry.categoryId ?? null
      const nextCategoryCode = product.categoryCode || product.category_code || entry.categoryCode || ''
      const nextBizType = entry.bizType ?? resolveProductBizType(product)
      const nextGoodsMerchantType = entry.goodsMerchantType ?? resolveGoodsMerchantType(product)
      const nextNeedQuestionnaire = entry.needQuestionnaire ?? toNumber(product.needQuestionnaire, 0)
      const nextQuestionnaireId = nextNeedQuestionnaire === 1
        ? pickValue(entry.questionnaireId, product.questionnaireId, product.questionnaire_id)
        : null
      const nextAnswerId = nextNeedQuestionnaire === 1
        ? pickValue(entry.answerId, product.answerId, product.answer_id)
        : null
      const nextQuestionnairePassed = entry.questionnairePassed !== undefined
        ? entry.questionnairePassed
        : nextNeedQuestionnaire !== 1
      const nextStock = resolveStockValue(product, entry.stock ?? null)
      const nextAvailable = nextStock === 0
        ? false
        : (hasExplicitAvailable(product) ? resolveAvailableFlag(product, true) : resolveAvailableFlag(entry, true))
      const nextSelected = nextAvailable ? entry.selected !== false : false
      const nextQuantity = clampQuantityToStock(entry.quantity, nextStock)
      const productSkuId = normalizeId(product.skuId ?? product.sku_id ?? entry.skuId)
      const productId = normalizeId(product.productId ?? product.product_id ?? entry.productId ?? splitCartItemKey(cartKey).productId)
      const skuSpecText = pickText(product.skuSpecText, product.sku_spec_text, product.specText, entry.skuSpecText)
      const skuName = pickText(product.skuName, product.sku_name, entry.skuName)
      const price = product.price !== undefined && product.price !== null && product.price !== ''
        ? Number(product.price)
        : (entry.price ?? 0)

      if (
        entry.bizType !== nextBizType ||
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
          available: nextAvailable,
          stock: nextStock,
          bizType: nextBizType,
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
        skuCode: pickText(product.skuCode, product.sku_code, entry.skuCode),
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
        verified: entry.verified !== false,
        available: nextAvailable,
        stock: nextStock,
        bizType: nextBizType,
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
      writeCartData(cartData, { suppressSync: true, silent: true })
    }

    return cartItems.sort((a, b) => toNumber(a.timestamp, 0) - toNumber(b.timestamp, 0))
  } catch (error) {
    console.error('loadCartItems failed:', error)
    return []
  }
}

export const mapServerCartItemToProduct = (item = {}) => {
  const productId = normalizeId(item.productId ?? item.product_id ?? item.id)
  const skuId = normalizeId(item.skuId ?? item.sku_id)
  const cartKey = buildCartItemKey(productId, skuId)
  const specText = pickText(item.skuSpecText, item.sku_spec_text, item.specText, item.spec_text, item.subTitle, item.sub_title)
  return {
    id: cartKey,
    cartKey,
    productId,
    skuId: skuId || null,
    skuCode: pickText(item.skuCode, item.sku_code),
    skuName: pickText(item.skuName, item.sku_name),
    skuSpecText: specText,
    name: item.productName || item.product_name || item.name || '',
    productName: item.productName || item.product_name || item.name || '',
    description: item.subTitle || item.sub_title || '',
    image: item.coverImage || item.cover_image || item.image || '',
    coverImage: item.coverImage || item.cover_image || item.image || '',
    price: Number(item.price || 0),
    unit: item.unit || '件',
    specText,
    bizType: item.bizType,
    goodsMerchantType: item.goodsMerchantType,
    productCategory: item.productCategory,
    isPrescription: item.isPrescription,
    categoryId: item.categoryId ?? item.category_id,
    categoryCode: item.categoryCode || item.category_code || '',
    needQuestionnaire: toNumber(item.needQuestionnaire, 0),
    questionnaireId: item.questionnaireId ?? item.questionnaire_id ?? null,
    answerId: item.answerId ?? item.answer_id ?? null,
    stock: resolveStockValue(item, null),
    available: resolveStockValue(item, null) === 0 ? false : item.available !== false
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
  const bizType = flow.valid ? flow.bizType : BIZ_TYPE_HOSPITAL_MEDICAL

  return {
    prescriptions: orderItems.map(item => item.productId),
    bizType,
    items: orderItems,
    deliveryInfo: {
      distributor,
      logistics: '顺丰快递',
      purchaseMethod: bizType === 2 ? '健康产品-在线支付' : '药品配送-在线支付',
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

export const resolveCartCompatibility = (productOrMeta, options = {}) => {
  const ignoreCartKey = normalizeId(options.ignoreProductId ?? options.ignoreCartKey)
  const ignoreProductId = splitCartItemKey(ignoreCartKey).productId
  const currentEntries = Object.entries(readCartData())
    .filter(([cartKey, entry]) => {
      if (!entry.verified) {
        return false
      }
      if (!ignoreCartKey) {
        return true
      }
      return normalizeId(cartKey) !== ignoreCartKey && normalizeId(entry.productId) !== ignoreProductId
    })
    .map(([cartKey, entry]) => ({
      id: cartKey,
      cartKey,
      ...entry
    }))

  if (!currentEntries.length) {
    const flow = resolveProductFlow(productOrMeta ? [productOrMeta] : [])
    return {
      valid: true,
      bizType: flow.bizType,
      goodsMerchantType: flow.goodsMerchantType,
      flowType: flow.flowType,
      requiresConsultation: flow.requiresConsultation,
      message: ''
    }
  }

  const targetProduct = productOrMeta || currentEntries[0]
  const flow = resolveProductFlow([...currentEntries, targetProduct])
  if (!flow.valid) {
    return {
      valid: false,
      bizType: null,
      goodsMerchantType: null,
      flowType: flow.flowType,
      requiresConsultation: flow.requiresConsultation,
      message: flow.message
    }
  }

  return {
    valid: true,
    bizType: flow.bizType,
    goodsMerchantType: flow.goodsMerchantType,
    flowType: flow.flowType,
    requiresConsultation: flow.requiresConsultation,
    message: ''
  }
}

export const resolveCheckoutFlow = (productIds = [], categories = []) => {
  const ids = uniqueIds(productIds.length > 0 ? productIds : getCurrentCheckoutProductIds())
  if (!ids.length) {
    return {
      valid: true,
      bizType: BIZ_TYPE_HOSPITAL_MEDICAL,
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
      bizType: null,
      goodsMerchantType: null,
      flowType: null,
      requiresConsultation: true,
      message: stockCheck.message,
      stockCheck,
      items: [],
      productIds: uniqueIds(productIds.length > 0 ? productIds : getCurrentCheckoutProductIds())
    }
  }

  const resolved = resolveCheckoutFlow(productIds, categories)
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
