/**
 * 购物车 API
 */

import { get, post, put, del } from '@/utils/request.js'
import { API_PATHS } from '@/utils/config.js'

const logCartApiError = (action, error) => {
  const statusCode = error?.statusCode
  const bizCode = error?.code
  const message = error?.message || error?.errMsg || ''
  let hint = message || '未知错误'

  if (statusCode === 404) {
    hint = '接口不存在(404)：后端可能未部署 Cart API，请更新 liaoning_zongyi-springboot 并重启服务'
  } else if (statusCode === 401 || bizCode === 401) {
    hint = '未登录或 Token 已过期(401)'
  } else if (statusCode === 500 || bizCode === 500) {
    hint = '服务端内部错误(500)，请查看 springboot 日志'
  } else if (String(message).includes('timeout')) {
    hint = '请求超时，请检查网络或 BASE_URL'
  } else if (String(message).includes('fail')) {
    hint = '网络连接失败，请确认后端地址可达'
  }

  console.warn(`[cart-api] ${action} failed`, {
    url: API_PATHS.CART.LIST,
    statusCode,
    bizCode,
    message,
    hint,
    raw: error
  })
}

export const getCartList = async () => {
  console.log('[cart-api] GET /api/cart start')
  try {
    const data = await get(API_PATHS.CART.LIST, {}, {
      needAuth: true,
      showLoading: false
    })
    const count = Array.isArray(data) ? data.length : 0
    console.log('[cart-api] GET /api/cart ok', { count, sample: data?.[0] })
    return data
  } catch (error) {
    logCartApiError('GET /api/cart', error)
    throw error
  }
}

export const upsertCartItem = (data) => {
  return post(API_PATHS.CART.UPSERT_ITEM, data, {
    needAuth: true,
    showLoading: false
  })
}

export const updateCartItem = (productId, data) => {
  return put(API_PATHS.CART.UPDATE_ITEM(productId), data, {
    needAuth: true,
    showLoading: false
  })
}

export const deleteCartItem = (productId) => {
  return del(API_PATHS.CART.DELETE_ITEM(productId), {}, {
    needAuth: true,
    showLoading: false
  })
}

export const deleteCartItems = (productIds = []) => {
  const query = productIds.length > 0
    ? `?productIds=${productIds.map((id) => encodeURIComponent(id)).join(',')}`
    : ''
  return del(`${API_PATHS.CART.DELETE_ITEMS}${query}`, {}, {
    needAuth: true,
    showLoading: false
  })
}

export const syncCart = (items = []) => {
  return post(API_PATHS.CART.SYNC, { items }, {
    needAuth: true,
    showLoading: false
  })
}
