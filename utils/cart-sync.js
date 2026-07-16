import {
  deleteCartItem,
  deleteCartItems,
  syncCart,
  upsertCartItem
} from '@/api/cart.js'
import { getToken } from '@/utils/request.js'
import { buildCartItemKey, getCartEntries, replaceCartData } from '@/utils/cart.js'
import { buildCartSyncPayload } from '@/utils/cart-sync-payload.js'

const CART_REMOTE_SYNC_EVENT = 'cartRemoteSync'
const pushTimers = new Map()

const isLoggedIn = () => Boolean(getToken())

const normalizeId = (value) => {
  if (value === undefined || value === null || value === '') {
    return ''
  }
  return String(value).trim()
}

const serverItemsToLocalCart = (items = []) => {
  const cartData = {}
  items.forEach((item) => {
    const productId = normalizeId(item.productId)
    if (!productId) {
      return
    }
    const skuId = normalizeId(item.skuId)
    const cartKey = buildCartItemKey(productId, skuId)
    cartData[cartKey] = {
      productId,
      skuId: skuId || null,
      skuCode: item.skuCode || '',
      skuName: item.skuName || '',
      skuSpecText: item.skuSpecText || item.specText || '',
      productName: item.productName || '',
      name: item.productName || '',
      coverImage: item.coverImage || '',
      image: item.coverImage || '',
      price: item.price ?? null,
      unit: item.unit || '',
      verified: true,
      selected: item.checked === 1 || item.checked === true,
      quantity: item.quantity || 1,
      available: item.available !== false,
      stock: item.stock ?? item.stockQuantity ?? item.inventory ?? null,
      bizType: item.bizType ?? null,
      goodsMerchantType: item.goodsMerchantType ?? null,
      productCategory: item.productCategory ?? null,
      isPrescription: item.isPrescription ?? null,
      categoryId: item.categoryId ?? null,
      categoryCode: item.categoryCode || '',
      needQuestionnaire: item.needQuestionnaire ?? 0,
      questionnaireId: item.questionnaireId ?? item.questionnaire_id ?? null,
      answerId: item.answerId ?? item.answer_id ?? null,
      questionnairePassed: (item.needQuestionnaire ?? 0) !== 1 || !!(item.answerId ?? item.answer_id),
      timestamp: item.updatedAt ? new Date(item.updatedAt).getTime() : Date.now()
    }
  })
  return cartData
}

const buildSyncPayload = () => {
  const entries = getCartEntries()
  return Object.entries(entries).map(([cartKey, entry]) => buildCartSyncPayload(cartKey, entry))
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
        ? 'POST /api/cart/sync 不存在，请更新后端服务'
        : '登录后购物车同步失败，暂用本地数据'
    })
  }
}

const pushSingleItem = async (cartKey) => {
  if (!isLoggedIn()) {
    return
  }

  const entry = getCartEntries()[String(cartKey)]
  if (!entry || !entry.verified) {
    await deleteCartItem(cartKey).catch(() => {})
    return
  }

  await upsertCartItem(buildCartSyncPayload(cartKey, entry))
}

export const schedulePushCartItem = (cartKey) => {
  if (!isLoggedIn() || !cartKey) {
    return
  }

  const key = String(cartKey)
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
  const ids = Array.isArray(productIds) ? productIds : [productIds]
  if (!isLoggedIn() || !ids.length) {
    return
  }

  try {
    if (ids.length === 1) {
      await deleteCartItem(ids[0])
      return
    }
    await deleteCartItems(ids)
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
      (Array.isArray(payload) ? payload : [payload]).forEach((cartKey) => {
        schedulePushCartItem(cartKey)
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

let cartRemoteSyncBound = false

/** 在 App 启动时注册，避免 cart.js 与 cart-sync.js 循环依赖导致小程序编译或运行异常。 */
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
