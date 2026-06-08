/**
 * 商品数据缓存工具
 * 用于缓存下单确认页选中的商品，避免重复请求
 */

import {
  STORAGE_KEY_PRODUCTS_CACHE,
  CHECKOUT_CACHE_EXPIRE_TIME
} from './storage.js'

const buildProductIdKey = (productIds = []) => {
  return [...new Set((productIds || []).map(id => String(id)).filter(Boolean))].sort().join(',')
}

/**
 * 获取缓存的商品数据
 * @param {Array<string|number>} productIds 当前选中的商品 ID 列表，用于校验缓存是否匹配
 * @returns {Object|null} 缓存的数据或 null
 */
export const getCachedProducts = (productIds = []) => {
  try {
    const cached = uni.getStorageSync(STORAGE_KEY_PRODUCTS_CACHE)
    if (!cached) {
      return null
    }

    const now = Date.now()
    if (now - cached.timestamp > (cached.expireTime || CHECKOUT_CACHE_EXPIRE_TIME)) {
      uni.removeStorageSync(STORAGE_KEY_PRODUCTS_CACHE)
      return null
    }

    const requestedKey = buildProductIdKey(productIds)
    const cachedKey = buildProductIdKey(cached.productIds || [])
    if (requestedKey && cachedKey && requestedKey !== cachedKey) {
      return null
    }

    return cached
  } catch (e) {
    console.error('获取缓存失败:', e)
    return null
  }
}

/**
 * 设置商品数据缓存
 * @param {Array} categories 分类列表
 * @param {Object} products 按分类 ID 组织的商品数据
 * @param {Array<string|number>} productIds 当前选中的商品 ID 列表
 */
export const setCachedProducts = (categories, products, productIds = []) => {
  try {
    const cacheData = {
      categories,
      products,
      productIds: [...new Set((productIds || []).map(id => String(id)).filter(Boolean))],
      timestamp: Date.now(),
      expireTime: CHECKOUT_CACHE_EXPIRE_TIME
    }
    uni.setStorageSync(STORAGE_KEY_PRODUCTS_CACHE, cacheData)
  } catch (e) {
    console.error('设置缓存失败:', e)
  }
}

/**
 * 清除商品数据缓存
 */
export const clearCachedProducts = () => {
  try {
    uni.removeStorageSync(STORAGE_KEY_PRODUCTS_CACHE)
  } catch (e) {
    console.error('清除缓存失败:', e)
  }
}

/**
 * 检查缓存是否存在且有效
 * @param {Array<string|number>} productIds 当前选中的商品 ID 列表
 * @returns {Boolean} 是否有效
 */
export const isCacheValid = (productIds = []) => {
  return getCachedProducts(productIds) !== null
}

export { buildProductIdKey }
