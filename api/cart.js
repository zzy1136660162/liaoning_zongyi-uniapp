import { normalizeCartId as normalizeId, splitCartItemKey } from '@/utils/cart-key.js'
/**
 * 购物车 API
 */

import { get, post, del } from '@/utils/request.js'
import { API_PATHS } from '@/utils/config.js'

/** 查询失败由统一请求层和页面处理；不在API层再复制响应/商品快照。 */
export const getCartList = () => get(API_PATHS.CART.LIST, {}, { needAuth: true, showLoading: false })

export const upsertCartItem = (data) => {
  return post(API_PATHS.CART.UPSERT_ITEM, data, {
    needAuth: true,
    showLoading: false
  })
}

export const deleteCartItem = (cartKey) => {
  const { productId, skuId } = splitCartItemKey(cartKey)
  const query = skuId ? `?skuId=${encodeURIComponent(skuId)}` : ''
  return del(`${API_PATHS.CART.DELETE_ITEM(productId)}${query}`, {}, { needAuth: true, showLoading: false })
}

export const deleteCartItems = (productIds = []) => {
  const ids = Array.isArray(productIds) ? productIds : [productIds]
  const query = ids.length ? `?itemKeys=${ids.map(id => encodeURIComponent(normalizeId(id))).join(',')}` : ''
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
