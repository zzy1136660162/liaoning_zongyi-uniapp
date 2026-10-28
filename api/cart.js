import { normalizeCartId as normalizeId, splitCartItemKey } from '../utils/cart-key.js'
/**
 * 购物车 API
 */

import { get, post, put, del } from '../utils/request.js'
import { API_PATHS } from '../utils/config.js'
import { getSessionGeneration, assertCurrentSession } from '../utils/session.js'

/** 查询失败由统一请求层和页面处理；不在API层再复制响应/商品快照。 */
export const getCartList = () => get(API_PATHS.CART.LIST, {}, { needAuth: true, showLoading: false })

export const upsertCartItem = (data) => {
  return post(API_PATHS.CART.UPSERT_ITEM, data, {
    needAuth: true,
    showLoading: false
  })
}

export const updateCartItem = (cartKey, data) => {
  const { productId, skuId } = splitCartItemKey(cartKey)
  return put(API_PATHS.CART.UPDATE_ITEM(productId), { ...data, skuId }, {
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

/** 人工删除使用确认时的行 ID 和版本；不得退回按商品删除或空参数清空。 */
export const removeCartItems = (items) => post(`${API_PATHS.CART.LIST}/items/remove`, { items }, {
  needAuth: true,
  showLoading: false
})

export const cleanupPurchasedCartItems = async (items = []) => {
  const session = getSessionGeneration()
  for (let offset = 0; offset < items.length; offset += 200) {
    assertCurrentSession(session)
    await post(`${API_PATHS.CART.LIST}/purchased-cleanup`, { items: items.slice(offset, offset + 200) }, {
      needAuth: true,
      showLoading: false
    })
    assertCurrentSession(session)
  }
}
