/**
 * 购物车数据工具函数
 * 统一管理购物车数据的加载和计算
 */

import { 
  STORAGE_KEY_VERIFIED_PRODUCTS, 
  STORAGE_KEY_PRODUCT_QUANTITIES 
} from './storage.js'

/**
 * 数据格式标准化函数
 * 将旧格式转换为新格式，并确保数据完整性
 * 自动检测和同步STORAGE_KEY_PRODUCT_QUANTITIES的外部修改
 * @param {Object} rawData - 原始数据
 * @returns {Object} 标准化后的数据
 */
const normalizeCartData = (rawData) => {
  const normalized = {}

  // 获取旧格式的数量数据（用于向后兼容）
  const legacyQuantities = uni.getStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES) || {}

  // 检查是否有外部直接修改STORAGE_KEY_PRODUCT_QUANTITIES的情况
  // 如果有商品在旧格式中有但新格式中没有，需要同步过来
  let needsSync = false
  for (const [productId, quantity] of Object.entries(legacyQuantities)) {
    if (!rawData || !rawData[productId]) {
      // 新格式中没有这个商品，但旧格式中有，说明是外部直接添加的
      normalized[productId] = {
        verified: true,
        selected: true, // 默认为选中
        quantity: Math.max(1, parseInt(quantity) || 1),
        timestamp: Date.now()
      }
      needsSync = true
    }
  }

  // 如果检测到需要同步，保存同步后的数据
  if (needsSync) {
    saveNormalizedCartData(normalized)
  }

  for (const [productId, value] of Object.entries(rawData || {})) {
    if (typeof value === 'boolean') {
      // 旧格式转换：{ productId: true } -> 新格式
      normalized[productId] = {
        verified: value,
        selected: true, // 默认为选中状态
        quantity: legacyQuantities[productId] || 1, // 从旧存储中获取数量
        timestamp: Date.now()
      }
    } else if (typeof value === 'object' && value !== null) {
      // 新格式：确保所有必需字段存在
      normalized[productId] = {
        verified: value.verified !== false, // 默认为true
        selected: value.selected !== false, // 默认为true
        quantity: Math.max(1, parseInt(value.quantity) || legacyQuantities[productId] || 1), // 优先使用新格式，否则使用旧格式
        timestamp: value.timestamp || Date.now()
      }
    }
  }

  return normalized
}

/**
 * 获取标准化后的购物车数据
 * @returns {Object} 标准化后的购物车数据
 */
const getNormalizedCartData = () => {
  const rawData = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
  return normalizeCartData(rawData)
}

/**
 * 保存标准化后的购物车数据
 * @param {Object} cartData - 购物车数据
 */
const saveNormalizedCartData = (cartData) => {
  // 保存新格式数据
  uni.setStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS, cartData)

  // 同步保存旧格式的数量数据（向后兼容）
  const legacyQuantities = {}
  for (const [productId, productInfo] of Object.entries(cartData)) {
    if (productInfo.verified) {
      legacyQuantities[productId] = productInfo.quantity
    }
  }
  uni.setStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES, legacyQuantities)
}

/**
 * 将产品添加到购物车
 * @param {string|number} productId - 产品ID
 * @param {number} quantity - 数量（可选，默认值为1）
 * @param {boolean} selected - 是否选中（可选，默认值为true）
 * @returns {boolean} 添加是否成功
 */
export const saveToCart = (productId, quantity = 1, selected = true) => {
  try {
    const cartData = getNormalizedCartData()
    const normalizedId = String(productId)

    // 添加或更新产品信息
    cartData[normalizedId] = {
      verified: true,
      selected: selected,
      quantity: Math.max(1, parseInt(quantity) || 1),
      timestamp: cartData[normalizedId]?.timestamp || Date.now()
    }

    // 保存更新后的数据
    saveNormalizedCartData(cartData)
    
    return true
  } catch (e) {
    console.error('保存到购物车失败:', e)
    return false
  }
}

/**
 * 从 storage 加载购物车数据
 * @param {Array} categories - 产品分类列表
 * @param {boolean} onlySelected - 是否只返回选中的商品（默认false，返回所有商品）
 * @returns {Array} 购物车商品列表，每个商品包含完整的产品信息和数量
 */
export const loadCartItems = (categories, onlySelected = false) => {
  try {
    const cartData = getNormalizedCartData()
    
    // 构建购物车列表
    const cartItems = []

    for (const [productId, productInfo] of Object.entries(cartData)) {
      // 如果只返回选中的商品，跳过未选中的
      if (onlySelected && !productInfo.selected) {
        continue
      }

      // 如果未验证，跳过
      if (!productInfo.verified) {
        continue
      }

        // 在所有分类中查找产品信息
        let product = null
        const normalizedId = String(productId)
        for (let category of categories) {
          product = category.products.find(p => String(p.id) === normalizedId)
          if (product) break
        }
        
        if (product) {
          cartItems.push({
            ...product,
          quantity: productInfo.quantity,
          selected: productInfo.selected,
          timestamp: productInfo.timestamp
          })
      }
    }
    
    return cartItems
  } catch (e) {
    console.error('加载购物车数据失败:', e)
    return []
  }
}

/**
 * 计算购物车总价格
 * @param {Array} cartItems - 购物车商品列表
 * @returns {number} 总价格
 */
export const calculateTotalPrice = (cartItems) => {
  return cartItems.reduce((total, item) => {
    const price = item.price || 0
    const quantity = item.quantity || 1
    return total + (price * quantity)
  }, 0)
}

/**
 * 计算购物车总数量
 * @param {Array} cartItems - 购物车商品列表
 * @returns {number} 总数量
 */
export const calculateTotalQuantity = (cartItems) => {
  return cartItems.reduce((total, item) => {
    return total + (item.quantity || 1)
  }, 0)
}

/**
 * 从购物车数据构建订单商品列表
 * @param {Array} cartItems - 购物车商品列表
 * @param {Array} selectedProductIds - 选中的产品ID列表（可选，如果不提供则使用所有商品）
 * @returns {Array} 订单商品列表
 */
export const buildOrderItems = (cartItems, selectedProductIds = null) => {
  let items = cartItems
  if (selectedProductIds && selectedProductIds.length > 0) {
    items = cartItems.filter(item => selectedProductIds.includes(item.id))
  }
  
  return items.map(item => ({
    id: item.id,
    name: item.name,
    type: '中药',
    price: parseFloat(((item.price || 0) * (item.quantity || 1)).toFixed(2)),
    quantity: item.quantity || 1
  }))
}

/**
 * 从购物车数据构建订单信息
 * @param {Array} cartItems - 购物车商品列表
 * @param {Array} selectedProductIds - 选中的产品ID列表（可选）
 * @param {string} hospital - 医院名称
 * @returns {Object} 订单信息
 */
export const buildOrderInfo = (cartItems, selectedProductIds = null, hospital = '辽宁中医药大学附属医院') => {
  const orderItems = buildOrderItems(cartItems, selectedProductIds)
  const medicineCost = parseFloat(orderItems.reduce((sum, item) => sum + item.price, 0).toFixed(2))
  
  return {
    prescriptions: selectedProductIds || cartItems.map(item => item.id),
    items: orderItems,
    deliveryInfo: {
      distributor: hospital,
      logistics: '顺丰快递',
      purchaseMethod: '药品配送-在线支付',
      shippingPaymentMethod: '在线支付'
    },
    cost: {
      medicineCost: medicineCost,
      isDecocted: false,
      shippingFee: 0 // 确认页面会自动设置为18元
    },
    total: medicineCost // 确认页面会重新计算包含快递费的总价
  }
}

/**
 * 从购物车中移除指定商品
 * @param {string|number|Array} productIds - 商品ID或商品ID数组
 * @returns {boolean} 移除是否成功
 */
export const removeFromCart = (productIds) => {
  try {
    // 统一处理为数组格式
    const idsToRemove = Array.isArray(productIds) ? productIds : [productIds]
    
    // 获取购物车数据
    const cartData = getNormalizedCartData()
    
    // 移除指定的商品
    idsToRemove.forEach(productId => {
      const normalizedId = String(productId)
      delete cartData[normalizedId]
    })
    
    // 保存更新后的数据
    saveNormalizedCartData(cartData)
    
    return true
  } catch (e) {
    console.error('从购物车移除商品失败:', e)
    return false
  }
}

/**
 * 清空购物车
 * @returns {boolean} 清空是否成功
 */
export const clearCart = () => {
  try {
    // 清空新格式数据
    uni.setStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS, {})
    // 清空旧格式数据（向后兼容）
    uni.setStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES, {})
    return true
  } catch (e) {
    console.error('清空购物车失败:', e)
    return false
  }
}

/**
 * 更新商品的选中状态
 * @param {string|number} productId - 商品ID
 * @param {boolean} selected - 是否选中
 * @returns {boolean} 更新是否成功
 */
export const updateProductSelection = (productId, selected) => {
  try {
    const cartData = getNormalizedCartData()
    const normalizedId = String(productId)

    if (cartData[normalizedId]) {
      cartData[normalizedId].selected = selected
      saveNormalizedCartData(cartData)
      return true
    }

    return false
  } catch (e) {
    console.error('更新商品选中状态失败:', e)
    return false
  }
}

/**
 * 批量更新商品选中状态
 * @param {Object} selectionMap - 选中状态映射 { productId: selected }
 * @returns {boolean} 更新是否成功
 */
export const updateMultipleSelections = (selectionMap) => {
  try {
    const cartData = getNormalizedCartData()

    for (const [productId, selected] of Object.entries(selectionMap)) {
      const normalizedId = String(productId)
      if (cartData[normalizedId]) {
        cartData[normalizedId].selected = selected
      }
    }

    saveNormalizedCartData(cartData)
    return true
  } catch (e) {
    console.error('批量更新商品选中状态失败:', e)
    return false
  }
}

/**
 * 获取所有已选中商品的ID列表
 * @returns {Array} 已选中商品的ID数组
 */
export const getSelectedProductIds = () => {
  try {
    const cartData = getNormalizedCartData()
    return Object.keys(cartData).filter(productId => cartData[productId].selected)
  } catch (e) {
    console.error('获取选中商品ID失败:', e)
    return []
  }
}

/**
 * 获取购物车统计信息
 * @returns {Object} 统计信息 { totalCount: number, selectedCount: number, totalPrice: number }
 */
export const getCartStatistics = () => {
  try {
    const cartData = getNormalizedCartData()
    let totalCount = 0
    let selectedCount = 0
    let totalPrice = 0

    for (const [productId, productInfo] of Object.entries(cartData)) {
      if (productInfo.verified) {
        totalCount++
        if (productInfo.selected) {
          selectedCount++
          // 注意：这里无法计算总价，因为需要商品的单价信息
          // 总价计算需要在有商品详细信息时进行
        }
      }
    }

    return { totalCount, selectedCount, totalPrice: 0 }
  } catch (e) {
    console.error('获取购物车统计信息失败:', e)
    return { totalCount: 0, selectedCount: 0, totalPrice: 0 }
  }
}

