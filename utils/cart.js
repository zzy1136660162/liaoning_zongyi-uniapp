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
  return String(value)
}

const uniqueIds = (ids = []) => {
  return [...new Set((Array.isArray(ids) ? ids : [ids]).map(normalizeId).filter(Boolean))]
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

const buildCartEntry = (productId, partial = {}, legacyQuantities = {}) => {
  const normalizedId = normalizeId(productId)
  if (!normalizedId) {
    return null
  }

  const legacyQuantity = legacyQuantities[normalizedId]
  const stock = resolveStockValue(partial, null)
  const available = stock === 0 ? false : resolveAvailableFlag(partial, true)
  const quantity = clampQuantityToStock(toPositiveInt(partial.quantity, toPositiveInt(legacyQuantity, 1)), stock)
  const needQuestionnaire = toNumber(partial.needQuestionnaire, 0)
  const defaultQuestionnairePassed = needQuestionnaire === 1 ? false : true

  return {
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
    questionnairePassed: toFlag(partial.questionnairePassed, defaultQuestionnairePassed),
    timestamp: partial.timestamp ? toNumber(partial.timestamp, Date.now()) : Date.now()
  }
}

const normalizeCartData = (rawData, options = {}) => {
  const { includeLegacyIds = true } = options
  const legacyQuantities = readLegacyQuantities()
  const normalized = {}
  const source = rawData && typeof rawData === 'object' ? rawData : {}
  const ids = includeLegacyIds
    ? uniqueIds([...Object.keys(source), ...Object.keys(legacyQuantities)])
    : uniqueIds(Object.keys(source))

  ids.forEach((productId) => {
    const value = source[productId]
    if (typeof value === 'boolean') {
      const entry = buildCartEntry(productId, { verified: value }, legacyQuantities)
      if (entry && entry.verified) {
        normalized[productId] = entry
      }
      return
    }

    if (value && typeof value === 'object') {
      const entry = buildCartEntry(productId, value, legacyQuantities)
      if (entry && entry.verified) {
        normalized[productId] = entry
      }
      return
    }

    if (legacyQuantities[productId] !== undefined) {
      const entry = buildCartEntry(productId, { verified: true }, legacyQuantities)
      if (entry) {
        normalized[productId] = entry
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

  Object.entries(normalized).forEach(([productId, entry]) => {
    if (entry.verified) {
      legacyQuantities[productId] = toPositiveInt(entry.quantity, 1)
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

const resolveProductId = (productOrId) => {
  if (productOrId && typeof productOrId === 'object') {
    return normalizeId(productOrId.id || productOrId.productId)
  }
  return normalizeId(productOrId)
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

const updateCheckoutIdsAfterRemoval = (removedIds = []) => {
  const current = getCheckoutProductIds()
  if (!current.length) {
    return
  }
  const removedSet = new Set(uniqueIds(removedIds))
  const next = current.filter(id => !removedSet.has(id))
  if (next.length > 0) {
    setCheckoutProductIds(next)
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

const findProductById = (categories = [], productId) => {
  const normalizedId = normalizeId(productId)
  if (!normalizedId) {
    return null
  }

  const products = flattenCategoryProducts(categories)
  return products.find(item => normalizeId(item.id) === normalizedId) || null
}

export const getCartEntries = () => {
  return readCartData()
}

export const getCartProductInfo = (productId) => {
  const normalizedId = normalizeId(productId)
  if (!normalizedId) {
    return null
  }
  const cartData = readCartData()
  return cartData[normalizedId] || null
}

export const getCartProductQuantity = (productId, fallback = 1) => {
  const entry = getCartProductInfo(productId)
  return entry ? toPositiveInt(entry.quantity, fallback) : fallback
}

export const getCartTotalQuantity = () => {
  return Object.values(readCartData()).reduce((sum, entry) => sum + toPositiveInt(entry.quantity, 1), 0)
}

export const addCartItem = (productOrId, quantity = 1, options = {}) => {
  try {
    const productId = resolveProductId(productOrId)
    if (!productId) {
      return false
    }

    const cartData = readCartData()
    const existing = cartData[productId] || {}
    const meta = resolveCartMetaFromProduct(productOrId, existing, options)

    cartData[productId] = {
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
      questionnairePassed: meta.questionnairePassed,
      timestamp: Date.now()
    }

    writeCartData(cartData, { syncProductIds: [productId] })
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
    const normalizedId = normalizeId(productId)
    if (!normalizedId) {
      return false
    }

    if (toNumber(quantity, 0) <= 0) {
      return removeFromCart(normalizedId)
    }

    const cartData = readCartData()
    const existing = cartData[normalizedId] || {}
    cartData[normalizedId] = {
      ...buildCartEntry(normalizedId, existing),
      quantity: clampQuantityToStock(quantity, existing.stock),
      timestamp: Date.now()
    }
    writeCartData(cartData, { syncProductIds: [normalizedId] })
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
    ids.forEach((productId) => {
      delete cartData[productId]
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
    const normalizedId = normalizeId(productId)
    const cartData = readCartData()
    if (!cartData[normalizedId]) {
      return false
    }

    cartData[normalizedId].selected = isCartEntryAvailable(cartData[normalizedId])
      ? toFlag(selected, true)
      : false
    cartData[normalizedId].timestamp = Date.now()
    writeCartData(cartData, { syncProductIds: [normalizedId] })
    return selected ? cartData[normalizedId].selected : true
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
      const normalizedId = normalizeId(productId)
      if (cartData[normalizedId]) {
        cartData[normalizedId].selected = isCartEntryAvailable(cartData[normalizedId])
          ? toFlag(selected, true)
          : false
        cartData[normalizedId].timestamp = Date.now()
        changedIds.push(normalizedId)
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
    .map(([productId]) => productId)
}

export const setCheckoutProductIds = (productIds = []) => {
  try {
    uni.setStorageSync(STORAGE_KEY_CHECKOUT_PRODUCT_IDS, uniqueIds(productIds))
    return true
  } catch (error) {
    console.error('setCheckoutProductIds failed:', error)
    return false
  }
}

export const getCheckoutProductIds = () => {
  try {
    const ids = uni.getStorageSync(STORAGE_KEY_CHECKOUT_PRODUCT_IDS) || []
    return uniqueIds(ids)
  } catch (error) {
    console.error('getCheckoutProductIds failed:', error)
    return []
  }
}

export const clearCheckoutProductIds = () => {
  try {
    uni.removeStorageSync(STORAGE_KEY_CHECKOUT_PRODUCT_IDS)
    return true
  } catch (error) {
    console.error('clearCheckoutProductIds failed:', error)
    return false
  }
}

export const getCurrentCheckoutProductIds = () => {
  const checkoutIds = getCheckoutProductIds()
  return checkoutIds.length > 0 ? checkoutIds : getSelectedProductIds()
}

export const loadCartItems = (categories = [], onlySelected = false) => {
  try {
    const cartData = readCartData()
    const cartItems = []
    let needsSave = false

    Object.entries(cartData).forEach(([productId, entry]) => {
      if (!entry.verified) {
        return
      }
      if (onlySelected && !entry.selected) {
        return
      }

      const product = findProductById(categories, productId)
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
      const nextQuestionnairePassed = entry.questionnairePassed !== undefined
        ? entry.questionnairePassed
        : nextNeedQuestionnaire !== 1
      const nextStock = resolveStockValue(product, entry.stock ?? null)
      const nextAvailable = nextStock === 0
        ? false
        : (hasExplicitAvailable(product) ? resolveAvailableFlag(product, true) : resolveAvailableFlag(entry, true))
      const nextSelected = nextAvailable ? entry.selected !== false : false
      const nextQuantity = clampQuantityToStock(entry.quantity, nextStock)

      if (
        entry.bizType !== nextBizType ||
        entry.goodsMerchantType !== nextGoodsMerchantType ||
        entry.productCategory !== nextProductCategory ||
        entry.isPrescription !== nextIsPrescription ||
        entry.categoryId !== nextCategoryId ||
        entry.categoryCode !== nextCategoryCode ||
        entry.needQuestionnaire !== nextNeedQuestionnaire ||
        entry.questionnairePassed !== nextQuestionnairePassed ||
        entry.available !== nextAvailable ||
        entry.stock !== nextStock ||
        entry.selected !== nextSelected ||
        entry.quantity !== nextQuantity
      ) {
        cartData[productId] = {
          ...entry,
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
          questionnairePassed: nextQuestionnairePassed
        }
        needsSave = true
      }

      if (onlySelected && !nextSelected) {
        return
      }

      cartItems.push({
        ...product,
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
        questionnairePassed: nextQuestionnairePassed,
        timestamp: entry.timestamp || Date.now()
      })
    })

    if (needsSave) {
      writeCartData(cartData, { suppressSync: true })
    }

    return cartItems.sort((a, b) => toNumber(a.timestamp, 0) - toNumber(b.timestamp, 0))
  } catch (error) {
    console.error('loadCartItems failed:', error)
    return []
  }
}

export const mapServerCartItemToProduct = (item = {}) => {
  const productId = item.productId ?? item.id
  return {
    id: productId,
    productId,
    name: item.productName || '',
    productName: item.productName || '',
    description: item.subTitle || '',
    image: item.coverImage || '',
    coverImage: item.coverImage || '',
    price: Number(item.price || 0),
    unit: item.unit || '件',
    specText: item.specText || item.subTitle || '',
    bizType: item.bizType,
    goodsMerchantType: item.goodsMerchantType,
    productCategory: item.productCategory,
    isPrescription: item.isPrescription,
    categoryId: item.categoryId ?? item.category_id,
    categoryCode: item.categoryCode || item.category_code || '',
    needQuestionnaire: toNumber(item.needQuestionnaire, 0),
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
      name: item.name,
      type: resolveProductTypeLabel(item),
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
    prescriptions: orderItems.map(item => item.id),
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
  const currentEntries = Object.entries(readCartData())
    .filter(([productId, entry]) => entry.verified && normalizeId(productId) !== normalizeId(options.ignoreProductId))
    .map(([productId, entry]) => ({
      id: productId,
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
  const resolved = resolveCheckoutFlow(productIds, categories)
  if (resolved.productIds.length > 0) {
    setCheckoutProductIds(resolved.productIds)
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
