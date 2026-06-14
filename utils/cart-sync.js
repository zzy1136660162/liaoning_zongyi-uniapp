import {
  deleteCartItem,
  deleteCartItems,
  syncCart,
  upsertCartItem
} from '@/api/cart.js'
import { getToken } from '@/utils/request.js'
import { getCartEntries, replaceCartData } from '@/utils/cart.js'

const pushTimers = new Map()

const isLoggedIn = () => Boolean(getToken())

const toServerChecked = (selected) => (selected ? 1 : 0)

const buildUpsertPayload = (productId, entry = {}) => ({
  productId: Number(productId),
  quantity: entry.quantity || 1,
  checked: toServerChecked(entry.selected !== false)
})

const serverItemsToLocalCart = (items = []) => {
  const cartData = {}
  items.forEach((item) => {
    const productId = String(item.productId)
    if (!productId) {
      return
    }
    cartData[productId] = {
      verified: true,
      selected: item.checked === 1 || item.checked === true,
      quantity: item.quantity || 1,
      available: item.available !== false,
      stock: item.stock ?? item.stockQuantity ?? item.inventory ?? null,
      bizType: item.bizType ?? null,
      goodsMerchantType: item.goodsMerchantType ?? null,
      needQuestionnaire: item.needQuestionnaire ?? 0,
      questionnairePassed: (item.needQuestionnaire ?? 0) !== 1,
      timestamp: item.updatedAt ? new Date(item.updatedAt).getTime() : Date.now()
    }
  })
  return cartData
}

const buildSyncPayload = () => {
  const entries = getCartEntries()
  return Object.entries(entries).map(([productId, entry]) => ({
    productId: Number(productId),
    quantity: entry.quantity || 1,
    checked: toServerChecked(entry.selected !== false)
  }))
}

export const applyServerCartToLocal = (items = []) => {
  const list = Array.isArray(items) ? items : []
  const cartData = serverItemsToLocalCart(list)
  console.log('[cart-sync] applyServerCartToLocal', {
    serverCount: list.length,
    localKeys: Object.keys(cartData)
  })
  replaceCartData(cartData)
}

export const syncCartOnLogin = async () => {
  if (!isLoggedIn()) {
    return
  }

  try {
    const localItems = buildSyncPayload()
    console.log('[cart-sync] syncCartOnLogin start', { localCount: localItems.length })
    const serverItems = await syncCart(localItems)
    applyServerCartToLocal(serverItems || [])
    console.log('[cart-sync] syncCartOnLogin ok', {
      serverCount: Array.isArray(serverItems) ? serverItems.length : 0
    })
  } catch (error) {
    console.warn('[cart-sync] syncCartOnLogin failed', {
      statusCode: error?.statusCode,
      bizCode: error?.code,
      message: error?.message || error?.errMsg,
      hint: error?.statusCode === 404
        ? 'POST /api/cart/sync 不存在，请更新后端'
        : '登录后购物车同步失败，暂用本地数据'
    })
  }
}

const pushSingleItem = async (productId) => {
  if (!isLoggedIn()) {
    return
  }

  const entry = getCartEntries()[String(productId)]
  if (!entry || !entry.verified) {
    await deleteCartItem(productId).catch(() => {})
    return
  }

  await upsertCartItem(buildUpsertPayload(productId, entry))
}

export const schedulePushCartItem = (productId) => {
  if (!isLoggedIn() || !productId) {
    return
  }

  const key = String(productId)
  if (pushTimers.has(key)) {
    clearTimeout(pushTimers.get(key))
  }

  const timer = setTimeout(() => {
    pushTimers.delete(key)
    pushSingleItem(key).catch((error) => {
      console.warn('pushSingleItem failed:', error)
    })
  }, 400)

  pushTimers.set(key, timer)
}

export const pushCartRemoval = async (productIds = []) => {
  if (!isLoggedIn() || !productIds.length) {
    return
  }

  try {
    if (productIds.length === 1) {
      await deleteCartItem(productIds[0])
      return
    }
    await deleteCartItems(productIds.map((id) => Number(id)))
  } catch (error) {
    console.warn('pushCartRemoval failed:', error)
  }
}

export const pushClearCart = async () => {
  if (!isLoggedIn()) {
    return
  }

  try {
    await deleteCartItems()
  } catch (error) {
    console.warn('pushClearCart failed:', error)
  }
}

export const handleCartRemoteSync = async (action, payload) => {
  if (!isLoggedIn()) {
    return
  }

  switch (action) {
    case 'upsert':
      (Array.isArray(payload) ? payload : [payload]).forEach((productId) => {
        schedulePushCartItem(productId)
      })
      break
    case 'remove':
      await pushCartRemoval(Array.isArray(payload) ? payload : [payload])
      break
    case 'clear':
      await pushClearCart()
      break
    default:
      break
  }
}

const CART_REMOTE_SYNC_EVENT = 'cartRemoteSync'
let cartRemoteSyncBound = false

/** 在 App 启动时注册，避免 cart.js 与 cart-sync.js 循环依赖导致小程序编译/运行异常 */
export const initCartRemoteSync = () => {
  if (cartRemoteSyncBound) {
    return
  }
  cartRemoteSyncBound = true
  uni.$on(CART_REMOTE_SYNC_EVENT, ({ action, payload } = {}) => {
    Promise.resolve(handleCartRemoteSync(action, payload)).catch((error) => {
      console.warn('cart remote sync failed:', error)
    })
  })
}
