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

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toPositiveInt = (value, fallback = 1) => {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
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
  const quantity = toPositiveInt(partial.quantity, toPositiveInt(legacyQuantity, 1))
  const needQuestionnaire = toNumber(partial.needQuestionnaire, 0)
  const defaultQuestionnairePassed = needQuestionnaire === 1 ? false : true

  return {
    verified: toFlag(partial.verified, true),
    selected: toFlag(partial.selected, true),
    quantity,
    bizType: partial.bizType !== undefined && partial.bizType !== null && partial.bizType !== ''
      ? toNumber(partial.bizType, null)
      : null,
    goodsMerchantType: partial.goodsMerchantType !== undefined && partial.goodsMerchantType !== null && partial.goodsMerchantType !== ''
      ? toNumber(partial.goodsMerchantType, null)
      : null,
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

const writeCartData = (cartData) => {
  const normalized = normalizeCartData(cartData, { includeLegacyIds: false })
  const legacyQuantities = {}

  Object.entries(normalized).forEach(([productId, entry]) => {
    if (entry.verified) {
      legacyQuantities[productId] = toPositiveInt(entry.quantity, 1)
    }
  })

  uni.setStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS, normalized)
  uni.setStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES, legacyQuantities)
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
    needQuestionnaire: resolvedNeedQuestionnaire,
    questionnairePassed
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
      selected: options.selected !== undefined ? toFlag(options.selected, true) : (existing.selected !== undefined ? toFlag(existing.selected, true) : true),
      quantity: toPositiveInt(quantity, existing.quantity || 1),
      bizType: meta.bizType,
      goodsMerchantType: meta.goodsMerchantType,
      needQuestionnaire: meta.needQuestionnaire,
      questionnairePassed: meta.questionnairePassed,
      timestamp: Date.now()
    }

    writeCartData(cartData)
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
      quantity: toPositiveInt(quantity, 1),
      timestamp: Date.now()
    }
    writeCartData(cartData)
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
    console.log('[cart] removeFromCart:before', {
      ids,
      cartKeys: Object.keys(cartData),
      legacyKeys: Object.keys(readLegacyQuantities())
    })
    ids.forEach((productId) => {
      delete cartData[productId]
    })

    writeCartData(cartData)
    console.log('[cart] removeFromCart:after', {
      ids,
      cartKeys: Object.keys(readCartData()),
      legacyKeys: Object.keys(readLegacyQuantities())
    })
    updateCheckoutIdsAfterRemoval(ids)
    return true
  } catch (error) {
    console.error('removeFromCart failed:', error)
    return false
  }
}

export const clearCart = () => {
  try {
    uni.setStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS, {})
    uni.setStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES, {})
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

    cartData[normalizedId].selected = toFlag(selected, true)
    cartData[normalizedId].timestamp = Date.now()
    writeCartData(cartData)
    return true
  } catch (error) {
    console.error('updateProductSelection failed:', error)
    return false
  }
}

export const updateMultipleSelections = (selectionMap = {}) => {
  try {
    const cartData = readCartData()
    Object.entries(selectionMap).forEach(([productId, selected]) => {
      const normalizedId = normalizeId(productId)
      if (cartData[normalizedId]) {
        cartData[normalizedId].selected = toFlag(selected, true)
        cartData[normalizedId].timestamp = Date.now()
      }
    })
    writeCartData(cartData)
    return true
  } catch (error) {
    console.error('updateMultipleSelections failed:', error)
    return false
  }
}

export const getSelectedProductIds = () => {
  return Object.entries(readCartData())
    .filter(([, entry]) => entry.verified && entry.selected)
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

      const nextBizType = entry.bizType ?? resolveProductBizType(product)
      const nextGoodsMerchantType = entry.goodsMerchantType ?? resolveGoodsMerchantType(product)
      const nextNeedQuestionnaire = entry.needQuestionnaire ?? toNumber(product.needQuestionnaire, 0)
      const nextQuestionnairePassed = entry.questionnairePassed !== undefined
        ? entry.questionnairePassed
        : nextNeedQuestionnaire !== 1

      if (
        entry.bizType !== nextBizType ||
        entry.goodsMerchantType !== nextGoodsMerchantType ||
        entry.needQuestionnaire !== nextNeedQuestionnaire ||
        entry.questionnairePassed !== nextQuestionnairePassed
      ) {
        cartData[productId] = {
          ...entry,
          bizType: nextBizType,
          goodsMerchantType: nextGoodsMerchantType,
          needQuestionnaire: nextNeedQuestionnaire,
          questionnairePassed: nextQuestionnairePassed
        }
        needsSave = true
      }

      cartItems.push({
        ...product,
        quantity: toPositiveInt(entry.quantity, 1),
        selected: entry.selected !== false,
        verified: entry.verified !== false,
        bizType: nextBizType,
        goodsMerchantType: nextGoodsMerchantType,
        needQuestionnaire: nextNeedQuestionnaire,
        questionnairePassed: nextQuestionnairePassed,
        timestamp: entry.timestamp || Date.now()
      })
    })

    if (needsSave) {
      writeCartData(cartData)
    }

    return cartItems.sort((a, b) => toNumber(a.timestamp, 0) - toNumber(b.timestamp, 0))
  } catch (error) {
    console.error('loadCartItems failed:', error)
    return []
  }
}

export const calculateTotalPrice = (cartItems = []) => {
  return cartItems.reduce((total, item) => {
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
  })
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
    .map(([, entry]) => entry)

  if (!currentEntries.length) {
    return {
      valid: true,
      bizType: productOrMeta ? resolveProductBizType(productOrMeta) : BIZ_TYPE_HOSPITAL_MEDICAL,
      goodsMerchantType: productOrMeta ? resolveGoodsMerchantType(productOrMeta) : null,
      message: ''
    }
  }

  const targetBizType = productOrMeta ? resolveProductBizType(productOrMeta) : currentEntries[0].bizType
  const targetGoodsMerchantType = productOrMeta ? resolveGoodsMerchantType(productOrMeta) : currentEntries[0].goodsMerchantType

  const mixed = currentEntries.some(entry => {
    if (entry.bizType == null || entry.goodsMerchantType == null) {
      return false
    }
    return Number(entry.bizType) !== Number(targetBizType) || Number(entry.goodsMerchantType) !== Number(targetGoodsMerchantType)
  })

  if (mixed) {
    return {
      valid: false,
      bizType: null,
      goodsMerchantType: null,
      message: '暂不支持本院产品与健康产品混合下单'
    }
  }

  return {
    valid: true,
    bizType: targetBizType,
    goodsMerchantType: targetGoodsMerchantType,
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
  const selectedCount = entries.filter(entry => entry.selected).length
  return {
    totalCount,
    selectedCount,
    totalPrice: 0
  }
}
