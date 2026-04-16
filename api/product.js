/**
 * 商品模块API
 */

import { get, post } from '@/utils/request.js'
import { API_PATHS } from '@/utils/config.js'

/**
 * 获取商品分类列表
 */
export const getCategoryList = () => {
  return get(API_PATHS.CATEGORY.LIST, {}, {
    needAuth: false,
    showLoading: true
  })
}

/**
 * 获取商品列表（支持查询全部或指定分类）
 * @param {Number|null} categoryId 分类ID，如果为 null 或不传递则查询所有分类的商品
 * @param {Number} pageNum 页码，默认1
 * @param {Number} pageSize 每页数量，默认10
 */
export const getProductsByCategory = (categoryId = null, pageNum = 1, pageSize = 10) => {
  return post(API_PATHS.CATEGORY.PRODUCTS, {
    categoryId: categoryId,
    pageNum: pageNum,
    pageSize: pageSize,
      _t: Date.now() // 添加时间戳避免缓存
  }, {
    needAuth: true,
    showLoading: true
  })
}

/**
 * 获取分类下商品列表（别名）
 * @param {Number|null} categoryId 分类ID，如果为 null 或不传递则查询所有分类的商品
 * @param {Number} pageNum 页码，默认1
 * @param {Number} pageSize 每页数量，默认10
 */
export const getCategoryProducts = getProductsByCategory

/**
 * 获取商品详情
 * @param {Number} id 商品ID
 */
export const getProductDetail = (id) => {
  // 添加时间戳参数避免缓存
  const params = {
    _t: Date.now()
  }
  return get(API_PATHS.PRODUCT.DETAIL(id), params, {
    needAuth: false,
    showLoading: true
  })
}
