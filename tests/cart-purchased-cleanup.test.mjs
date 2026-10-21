import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { beforeEach, afterEach, test } from 'node:test'
import * as cart from '../utils/cart.js'
import { splitCartItemKey } from '../utils/cart-key.js'
import { buildCartSyncPayload } from '../utils/cart-sync-payload.js'

const storage = new Map(), events = []
globalThis.uni = {
  getStorageSync: key => structuredClone(storage.get(key)),
  setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
  removeStorageSync: key => storage.delete(key), $emit: (name, payload) => events.push({ name, payload })
}
beforeEach(t => { storage.clear(); events.length = 0; t.mock.timers.enable({ apis: ['setTimeout'] }) })
afterEach(t => t.mock.timers.reset())
const product = () => ({ id: 10, productId: 10, skuId: 1, quantity: 2, selected: true,
  productCategory: 2, price: 10, stock: 20, available: true })
const serverItem = (extra = {}) => ({ ...product(), id: 700, checked: 1, cartVersion: 0, ...extra })
const seed = () => cart.replaceCartData({ '10:1': { ...product(), serverCartItemId: 700, serverCartVersion: 0 } })
const snapshot = () => ({ '10:1': cart.getCartEntries()['10:1'] })
const cleanupEvent = () => events.filter(event => event.name === 'cartRemoteSync').at(-1)?.payload
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

function syncModule(overrides = {}) {
  let session = 1, sessionChanged
  const upserts = [], removes = [], cleanups = []
  const code = readFileSync(new URL('../utils/cart-sync.js', import.meta.url), 'utf8')
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '').replace(/^export /gm, '')
  const mocks = {
    ...cart, splitCartItemKey, buildCartSyncPayload, getToken: () => 'fixture',
    getSessionGeneration: () => session, isCurrentSession: value => value === session,
    onSessionChanged: callback => { sessionChanged = callback }, syncCart: async () => [],
    upsertCartItem: async item => { upserts.push(item); return overrides.upsert?.(item) ?? serverItem({ cartVersion: upserts.length, quantity: item.quantity }) },
    deleteCartItem: async key => removes.push(key), deleteCartItems: async keys => removes.push(...(keys || [])),
    cleanupPurchasedCartItems: async items => { cleanups.push(items); return overrides.cleanup?.(items) },
    console: { log() {}, warn() {} }
  }
  const api = Function(...Object.keys(mocks), `${code}\nreturn { handleCartRemoteSync, applyServerCartToLocal, captureCartSyncSnapshot, pushSingleItem }`)(...Object.values(mocks))
  return { ...api, upserts, removes, cleanups, changeSession: () => { session++; sessionChanged() } }
}

test('服务端行身份和零版本规范保存，当前upsert确认不产生事件、不改变本地revision', () => {
  cart.addCartItem(product(), 2)
  const before = cart.getCartEntries()['10:1']
  events.length = 0
  assert.equal(cart.acknowledgeServerCartItem('10:1', before.revision, serverItem()), true)
  const acknowledged = cart.getCartEntries()['10:1']
  assert.equal(acknowledged.serverCartItemId, '700')
  assert.equal(acknowledged.serverCartVersion, '0')
  assert.equal(acknowledged.revision, before.revision)
  assert.deepEqual(events, [])
  cart.setCartItemQuantity('10:1', 3)
  assert.equal(cart.acknowledgeServerCartItem('10:1', before.revision, serverItem({ cartVersion: 9 })), false)
  assert.equal(cart.getCartEntries()['10:1'].serverCartVersion, '0')
  assert.equal(cart.acknowledgeServerCartItem('10:1', cart.getCartEntries()['10:1'].revision,
    serverItem({ productId: 20 })), false)
})

test('相同远端版本刷新保留本地revision，远端改版本或删后重加同数量仍更换revision', () => {
  const sync = syncModule()
  sync.applyServerCartToLocal([serverItem()])
  const original = cart.getCartEntries()['10:1']
  sync.applyServerCartToLocal([serverItem()])
  assert.equal(cart.getCartEntries()['10:1'].revision, original.revision)
  sync.applyServerCartToLocal([serverItem({ cartVersion: 1 })])
  const changed = cart.getCartEntries()['10:1']
  assert.notEqual(changed.revision, original.revision)
  sync.applyServerCartToLocal([serverItem({ id: 701, cartVersion: 1 })])
  assert.notEqual(cart.getCartEntries()['10:1'].revision, changed.revision)
  assert.equal(cart.removePurchasedCartItems({ '10:1': original }), true)
  assert.equal(cart.getCartEntries()['10:1'].serverCartItemId, '701')
})

test('已购清理只发快照确认的服务端身份，取消待发upsert且不走原SKU删除', async t => {
  seed()
  const original = snapshot(), sync = syncModule()
  await sync.handleCartRemoteSync('upsert', ['10:1'])
  cart.removePurchasedCartItems(original)
  const event = cleanupEvent()
  assert.equal(event.payload.items[0].cartVersion, '0')
  assert.equal(event.action, 'purchasedCleanup')
  assert.equal(event.payload.keys[0], '10:1')
  await sync.handleCartRemoteSync(event.action, event.payload)
  t.mock.timers.tick(400); await flush()
  assert.deepEqual(sync.cleanups, [[{ id: '700', cartVersion: '0' }]])
  assert.deepEqual(sync.removes, [])
  assert.deepEqual(sync.upserts, [])
  assert.deepEqual(cart.getCartEntries(), {})
})

test('另一设备已改版本时条件删除失配，新GET恢复新行，不被旧pending快照转成无条件删除', async t => {
  seed()
  const remote = serverItem({ cartVersion: 1, quantity: 5 })
  let deleted = false
  const sync = syncModule({ cleanup: async items => {
    deleted = items.some(item => String(item.id) === String(remote.id) && String(item.cartVersion) === String(remote.cartVersion))
  } })
  await sync.handleCartRemoteSync('upsert', ['10:1'])
  const request = sync.captureCartSyncSnapshot(), purchased = snapshot()
  cart.removePurchasedCartItems(purchased)
  await sync.handleCartRemoteSync('purchasedCleanup', cleanupEvent().payload)
  assert.equal(deleted, false)
  sync.applyServerCartToLocal([remote], false, request)
  t.mock.timers.tick(400); await flush()
  assert.equal(cart.getCartEntries()['10:1'].quantity, 5)
  assert.notEqual(cart.getCartEntries()['10:1'].revision, purchased['10:1'].revision)
  assert.deepEqual(sync.removes, [])
  assert.deepEqual(sync.upserts, [])
})

test('条件清理失败不留下删除dirty或重试循环，后续列表恢复服务器行', async t => {
  seed()
  const sync = syncModule({ cleanup: async () => { throw new Error('fixture offline') } })
  cart.removePurchasedCartItems(snapshot())
  await sync.handleCartRemoteSync('purchasedCleanup', cleanupEvent().payload)
  assert.deepEqual(sync.captureCartSyncSnapshot().pendingKeys, [])
  sync.applyServerCartToLocal([serverItem()], false, sync.captureCartSyncSnapshot())
  t.mock.timers.tick(400); await flush()
  assert.equal(cart.getCartEntries()['10:1'].serverCartItemId, '700')
  assert.equal(sync.cleanups.length, 1)
  assert.deepEqual(sync.removes, [])
})

test('清理前较旧upsert在途，清理后迟到成功不能ack消失行或触发无条件删除补推', async t => {
  seed()
  const old = deferred(), sync = syncModule({ upsert: () => old.promise })
  await sync.handleCartRemoteSync('upsert', ['10:1'])
  t.mock.timers.tick(400)
  cart.setCartItemQuantity('10:1', 3)
  await sync.handleCartRemoteSync('upsert', ['10:1'])
  cart.removePurchasedCartItems(snapshot())
  await sync.handleCartRemoteSync('purchasedCleanup', cleanupEvent().payload)
  old.resolve(serverItem({ cartVersion: 5 })); await flush()
  t.mock.timers.tick(400); await flush()
  assert.deepEqual(cart.getCartEntries(), {})
  assert.deepEqual(sync.captureCartSyncSnapshot().pendingKeys, [])
  assert.equal(sync.upserts.length, 1)
  assert.deepEqual(sync.removes, [])
})

test('清理后重新加购建立新本地版本，旧upsert回执不绑定新行且新upsert正常确认', async t => {
  seed()
  const old = deferred()
  let calls = 0
  const sync = syncModule({ upsert: item => ++calls === 1 ? old.promise : serverItem({ cartVersion: 6, quantity: item.quantity }) })
  await sync.handleCartRemoteSync('upsert', ['10:1']); t.mock.timers.tick(400)
  cart.removePurchasedCartItems(snapshot())
  await sync.handleCartRemoteSync('purchasedCleanup', cleanupEvent().payload)
  cart.addCartItem(product(), 4)
  await sync.handleCartRemoteSync('upsert', ['10:1'])
  old.resolve(serverItem({ cartVersion: 5 })); await flush()
  assert.equal(cart.getCartEntries()['10:1'].serverCartItemId, null)
  t.mock.timers.tick(400); await flush()
  assert.equal(cart.getCartEntries()['10:1'].quantity, 4)
  assert.equal(cart.getCartEntries()['10:1'].serverCartVersion, '6')
  assert.equal(sync.upserts.length, 2)
  assert.deepEqual(sync.removes, [])
})

test('没有已确认服务端身份时仅清本地，旧upsert定时器不能退化为SKU删除', async t => {
  cart.addCartItem(product(), 2)
  const sync = syncModule()
  await sync.handleCartRemoteSync('upsert', ['10:1'])
  cart.removePurchasedCartItems(snapshot())
  await sync.handleCartRemoteSync('purchasedCleanup', cleanupEvent().payload)
  t.mock.timers.tick(400); await flush()
  assert.deepEqual(sync.cleanups, [])
  assert.deepEqual(sync.removes, [])
  assert.deepEqual(sync.upserts, [])
})

test('付款时原行upsert已在途且未确认，迟到ACK只条件清理该精确服务端版本', async t => {
  cart.addCartItem(product(), 2)
  const original = snapshot(), reply = deferred()
  let remote = []
  const sync = syncModule({ upsert: () => reply.promise, cleanup: async items => {
    remote = remote.filter(row => !items.some(item => String(item.id) === String(row.id) &&
      String(item.cartVersion) === String(row.cartVersion)))
  } })
  await sync.handleCartRemoteSync('upsert', ['10:1']); t.mock.timers.tick(400)
  cart.removePurchasedCartItems(original)
  await sync.handleCartRemoteSync('purchasedCleanup', cleanupEvent().payload)
  assert.deepEqual(sync.cleanups, [])
  remote = [serverItem({ cartVersion: 1 })]
  reply.resolve(remote[0]); await flush()
  assert.deepEqual(sync.cleanups, [[{ id: '700', cartVersion: '1' }]])
  assert.deepEqual(remote, [])
  sync.applyServerCartToLocal(remote, false, sync.captureCartSyncSnapshot())
  assert.deepEqual(cart.getCartEntries(), {})
  assert.deepEqual(sync.removes, [])
  assert.deepEqual(sync.captureCartSyncSnapshot().pendingKeys, [])
})

test('问卷清空回包同时确认服务端版本，真实凭据变更不丢失行身份', async t => {
  const assessed = { ...product(), needQuestionnaire: 1, questionnaireId: 92 }
  cart.addCartItem(assessed, 2)
  cart.updateCartQuestionnaire(assessed, { questionnaireId: 92, answerId: 91 })
  const original = cart.getCartEntries()['10:1']
  const sync = syncModule({ upsert: () => serverItem({ cartVersion: 8,
    needQuestionnaire: 1, questionnaireId: 92, answerId: null }) })
  await sync.handleCartRemoteSync('upsert', ['10:1'])
  t.mock.timers.tick(400); await flush()
  const current = cart.getCartEntries()['10:1']
  assert.equal(current.answerId, null)
  assert.equal(current.questionnairePassed, false)
  assert.equal(current.serverCartItemId, '700')
  assert.equal(current.serverCartVersion, '8')
  assert.notEqual(current.revision, original.revision)
  assert.equal(current.quantity, original.quantity)
})

test('已购问卷行的迟到清空回包先精确条件清理，不能复活本地行或回退SKU删除', async t => {
  const assessed = { ...product(), needQuestionnaire: 1, questionnaireId: 92 }
  cart.addCartItem(assessed, 2)
  cart.updateCartQuestionnaire(assessed, { questionnaireId: 92, answerId: 91 })
  const original = snapshot(), reply = deferred(), sync = syncModule({ upsert: () => reply.promise })
  await sync.handleCartRemoteSync('upsert', ['10:1']); t.mock.timers.tick(400)
  cart.removePurchasedCartItems(original)
  await sync.handleCartRemoteSync('purchasedCleanup', cleanupEvent().payload)
  reply.resolve(serverItem({ cartVersion: 9, needQuestionnaire: 1, questionnaireId: 92, answerId: null }))
  await flush()
  assert.deepEqual(sync.cleanups, [[{ id: '700', cartVersion: '9' }]])
  assert.deepEqual(cart.getCartEntries(), {})
  assert.deepEqual(sync.removes, [])
  assert.deepEqual(sync.captureCartSyncSnapshot().pendingKeys, [])
})

test('旧账号的upsert回执不能确认新账号同SKU的服务端版本', async () => {
  seed()
  const old = deferred(), sync = syncModule({ upsert: () => old.promise })
  const pending = sync.pushSingleItem('10:1')
  sync.changeSession()
  cart.replaceCartData({ '10:1': { ...product(), serverCartItemId: 800, serverCartVersion: 0 } })
  old.resolve(serverItem({ cartVersion: 5 })); await pending
  assert.equal(cart.getCartEntries()['10:1'].serverCartItemId, '800')
  assert.equal(cart.getCartEntries()['10:1'].serverCartVersion, '0')
})

test('条件清理API只提交行ID与版本，使用认证POST而非原按SKU删除接口', async () => {
  const code = readFileSync(new URL('../api/cart.js', import.meta.url), 'utf8')
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '').replace(/^export /gm, '')
  const calls = [], post = async (...args) => { calls.push(args) }
  const api = Function('post', 'API_PATHS', `${code}\nreturn { cleanupPurchasedCartItems }`)(post, { CART: { LIST: '/api/cart' } })
  await api.cleanupPurchasedCartItems([{ id: '700', cartVersion: '0' }])
  assert.deepEqual(calls, [['/api/cart/purchased-cleanup', { items: [{ id: '700', cartVersion: '0' }] },
    { needAuth: true, showLoading: false }]])
})

test('条件清理API超过200行按上限分批，任一批失败即停止且不退回SKU删除', async () => {
  const code = readFileSync(new URL('../api/cart.js', import.meta.url), 'utf8')
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '').replace(/^export /gm, '')
  const batches = [], post = async (path, data) => { batches.push(data.items) }
  const api = Function('post', 'API_PATHS', `${code}\nreturn { cleanupPurchasedCartItems }`)(post, { CART: { LIST: '/api/cart' } })
  const items = Array.from({ length: 401 }, (_, index) => ({ id: String(index + 1), cartVersion: '0' }))
  await api.cleanupPurchasedCartItems(items)
  assert.deepEqual(batches.map(batch => batch.length), [200, 200, 1])
  assert.deepEqual(batches.flat(), items)
  const failedBatches = []
  const failing = Function('post', 'API_PATHS', `${code}\nreturn { cleanupPurchasedCartItems }`)(async (path, data) => {
    failedBatches.push(data.items)
    throw new Error('fixture offline')
  }, { CART: { LIST: '/api/cart' } })
  await assert.rejects(failing.cleanupPurchasedCartItems(items), /fixture offline/)
  assert.equal(failedBatches.length, 1)
})
