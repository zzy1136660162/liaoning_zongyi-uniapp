import { splitCartItemKey } from './cart-key.js'
import {
  deleteCartItem,
  deleteCartItems,
  syncCart,
  upsertCartItem
} from '@/api/cart.js'
import { getToken } from '@/utils/request.js'
import { getCartEntries, replaceCartData, mapServerCartItemToProduct } from '@/utils/cart.js'
import { buildCartSyncPayload } from '@/utils/cart-sync-payload.js'
import { getSessionGeneration, isCurrentSession, onSessionChanged } from './session.js'

const CART_REMOTE_SYNC_EVENT = 'cartRemoteSync'
const pushTimers = new Map()
const inFlightKeys = new Map()
const mutationVersions = new Map()
const confirmedVersions = new Map()
onSessionChanged(() => {
  pushTimers.forEach(timer => clearTimeout(timer))
  pushTimers.clear()
  inFlightKeys.clear()
  mutationVersions.clear()
  confirmedVersions.clear()
})

const isLoggedIn = () => Boolean(getToken())

const trackMutation = async (keys, action) => {
  const session = getSessionGeneration()
  keys.forEach(key => {
    // 登录时已有的本地行也可能尚未上传；无成功记录的版本同样需要失败保护。
    if (!mutationVersions.has(key)) mutationVersions.set(key, 0)
    inFlightKeys.set(key, (inFlightKeys.get(key) || 0) + 1)
  })
  const sentVersions = new Map(keys.map(key => [key, mutationVersions.get(key) || 0]))
  const staleKeys = []
  try {
    const result = await action()
    if (isCurrentSession(session)) keys.forEach(key => {
      const sentVersion = sentVersions.get(key)
      if (sentVersion < (mutationVersions.get(key) || 0)) {
        // 旧写晚成功可能把后台改回旧值；最新操作重新变为未确认，并合并补推一次。
        confirmedVersions.set(key, Math.min(confirmedVersions.get(key) ?? -1, sentVersion))
        staleKeys.push(key)
      }
      else confirmedVersions.set(key, Math.max(confirmedVersions.get(key) ?? -1, sentVersion))
    })
    return result
  }
  finally {
    // 旧账号请求结束不能清掉新账号同一商品的在途状态；同key并行请求按次数收尾。
    if (isCurrentSession(session)) keys.forEach(key => {
      const count = inFlightKeys.get(key) - 1
      if (count > 0) inFlightKeys.set(key, count)
      else inFlightKeys.delete(key)
    })
    if (isCurrentSession(session)) staleKeys.forEach(key => {
      if (!pushTimers.has(key)) schedulePushCartItem(key)
    })
  }
}

// 已失败的写入仍未确认；保留dirty版本直到同一版本写成功，不靠定时重试循环。
const dirtyKeys = () => [...mutationVersions.keys()]
  .filter(key => mutationVersions.get(key) > (confirmedVersions.get(key) ?? -1))

export const captureCartSyncSnapshot = () => ({
  entries: getCartEntries(),
  pendingKeys: [...new Set([...pushTimers.keys(), ...inFlightKeys.keys(), ...dirtyKeys()])],
  versions: new Map(mutationVersions)
})

// 服务器商品字段只映射一次，购物车同步只补数量、勾选和问卷答案等用户操作字段。
const serverItemsToLocalCart = (items = []) => Object.fromEntries(items.map(item => {
  const product = mapServerCartItemToProduct(item)
  return [product.cartKey, { ...product, selected: item.checked === 1,
    quantity: item.quantity,
    timestamp: item.updatedAt ? new Date(item.updatedAt).getTime() : Date.now() }]
}).filter(([key]) => key))

const buildSyncPayload = (entries) => {
  return Object.entries(entries).filter(([, entry]) => entry.skuId)
    .map(([cartKey, entry]) => buildCartSyncPayload(cartKey, entry))
}

// 登录合并保留后台拒绝的本地行并提示失效；普通后台读取则以后台完整列表为准。
const editState = entry => entry ? JSON.stringify([
  entry.quantity, entry.selected, entry.questionnaireId, entry.answerId, entry.questionnairePassed
]) : ''

export const applyServerCartToLocal = (items = [], preserveMissing = false, requestSnapshot = null) => {
  const list = Array.isArray(items) ? items : []
  const cartData = serverItemsToLocalCart(list)
  const currentCart = getCartEntries()
  const requestCart = requestSnapshot?.entries
  const unconfirmed = new Set(dirtyKeys())
  if (preserveMissing) {
    Object.entries(currentCart).forEach(([key, entry]) => {
      if (!cartData[key]) {
        cartData[key] = { ...entry, selected: false, available: false, stock: 0,
          inventoryStatus: 'UNAVAILABLE', inventoryReason: 'INVALID_CART_ITEM' }
      }
    })
  }
  console.log('[cart-sync] applyServerCartToLocal', {
    serverCount: list.length,
    localKeys: Object.keys(cartData)
  })
  // 同一账号也可能在请求期间继续加购/删除；旧响应不能覆盖这些新操作。
  const changedKeys = requestCart ? [...new Set([
    ...Object.keys(requestCart), ...Object.keys(currentCart),
    ...requestSnapshot.pendingKeys, ...pushTimers.keys(), ...inFlightKeys.keys(), ...mutationVersions.keys()
  ])].filter(key => requestSnapshot.pendingKeys.includes(key) || unconfirmed.has(key) || pushTimers.has(key) || inFlightKeys.has(key) ||
    (requestSnapshot.versions.get(key) || 0) !== (mutationVersions.get(key) || 0) ||
    editState(requestCart[key]) !== editState(currentCart[key])) : []
  changedKeys.forEach(key => {
    if (currentCart[key]) cartData[key] = currentCart[key]
    else delete cartData[key]
  })
  replaceCartData(cartData)
  // 后台快照可能早于刚才的操作，按最新行重推一次；应用结果本身不再触发远程同步。
  changedKeys.filter(key => splitCartItemKey(key).skuId).forEach(key => {
    const version = mutationVersions.get(key) || 0
    if ((requestSnapshot.versions.get(key) || 0) === version &&
      editState(requestCart[key]) !== editState(currentCart[key])) confirmedVersions.delete(key)
    // 已有推送负责当前状态，或最新版本已写成功时，只保护本地，不重复请求。
    if (pushTimers.has(key) || inFlightKeys.has(key) || (confirmedVersions.get(key) ?? -1) >= version) return
    if (currentCart[key]) schedulePushCartItem(key)
    else pushCartRemoval([key])
  })
  return cartData
}

export const syncCartOnLogin = async () => {
  const session = getSessionGeneration()
  if (!isLoggedIn()) {
    return
  }

  try {
    const requestSnapshot = captureCartSyncSnapshot()
    const localItems = buildSyncPayload(requestSnapshot.entries)
    console.log('[cart-sync] syncCartOnLogin start', { localCount: localItems.length })
    const submittedKeys = Object.keys(requestSnapshot.entries).filter(key => requestSnapshot.entries[key].skuId)
    const serverItems = await trackMutation(submittedKeys, () => syncCart(localItems))
    if (!isCurrentSession(session)) return
    applyServerCartToLocal(serverItems || [], true, requestSnapshot)
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
  if (!entry) {
    await trackMutation([cartKey], () => deleteCartItem(cartKey)).catch(() => {})
    return
  }

  if (entry.skuId) await trackMutation([cartKey], () => upsertCartItem(buildCartSyncPayload(cartKey, entry)))
}

// 连续增减只合并后台请求，本地数量即时保存；换账号时取消旧账号尚未发送的请求。
export const schedulePushCartItem = (cartKey) => {
  const session = getSessionGeneration()
  if (!isLoggedIn() || !cartKey) {
    return
  }

  const key = String(cartKey)
  if (pushTimers.has(key)) {
    clearTimeout(pushTimers.get(key))
  }

  const timer = setTimeout(() => {
    if (!isCurrentSession(session)) return
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
      await trackMutation(ids, () => deleteCartItem(ids[0]))
      return
    }
    await trackMutation(ids, () => deleteCartItems(ids))
  } catch (error) {
    console.warn('pushCartRemoval failed:', error)
  }
}

export const pushClearCart = async (keys = []) => {
  if (!isLoggedIn()) {
    return
  }

  try {
    await trackMutation(keys, () => deleteCartItems())
  } catch (error) {
    console.warn('pushClearCart failed:', error)
  }
}

export const handleCartRemoteSync = async (action, payload) => {
  if (!isLoggedIn()) {
    return
  }

  const keys = Array.isArray(payload) ? payload : payload ? [payload] : []
  keys.forEach(key => mutationVersions.set(String(key), (mutationVersions.get(String(key)) || 0) + 1))

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
      await pushClearCart(keys)
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
