/**
 * 商品数据缓存工具
 * 用于缓存商品分类和产品数据，避免重复请求
 */

import { 
  STORAGE_KEY_PRODUCTS_CACHE, 
  CACHE_EXPIRE_TIME 
} from './storage.js'

/**
 * 获取缓存的商品数据
 * @returns {Object|null} 缓存的数据或null
 */
export const getCachedProducts = () => {
  try {
    const cached = uni.getStorageSync(STORAGE_KEY_PRODUCTS_CACHE)
    if (!cached) {
      return null
    }

    // 检查是否过期
    const now = Date.now()
    if (now - cached.timestamp > cached.expireTime) {
      // 过期了，清除缓存
      uni.removeStorageSync(STORAGE_KEY_PRODUCTS_CACHE)
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
 * @param {Object} products 按分类ID组织的商品数据
 */
export const setCachedProducts = (categories, products) => {
  try {
    const cacheData = {
      categories,
      products,
      timestamp: Date.now(),
      expireTime: CACHE_EXPIRE_TIME
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
 * @returns {Boolean} 是否有效
 */
export const isCacheValid = () => {
  const cached = getCachedProducts()
  return cached !== null
}
