import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test, beforeEach, afterEach } from 'node:test'
import * as cart from '../utils/cart.js'
import { buildCartSyncPayload } from '../utils/cart-sync-payload.js'
import { splitCartItemKey } from '../utils/cart-key.js'
import { loadOptions } from './sfc-harness.mjs'

const values = new Map()
globalThis.uni = { getStorageSync: key => values.get(key), setStorageSync: (key, value) => values.set(key, value),
  removeStorageSync: key => values.delete(key), $emit() {} }
const product = id => ({ id, productId: id, skuId: 1, productName: `商品${id}`, price: 10,
  stock: 20, available: true, goodsMerchantType: 1, productCategory: 2 })
const serverRows = () => [10, 20].map(id => ({ ...product(id), quantity: 1, checked: 1, needQuestionnaire: 0 }))
const deferred = () => { let finish; const promise = new Promise(resolve => { finish = resolve }); return { promise, finish } }
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
beforeEach(t => { values.clear(); t.mock.timers.enable({ apis: ['setTimeout'] }) })
afterEach(t => t.mock.timers.reset())

const syncModule = (syncCart = async () => [], overrides = {}) => {
  const pushed = [], removed = []
  let session = 1, sessionChanged
  const code = readFileSync(new URL('../utils/cart-sync.js', import.meta.url), 'utf8')
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '').replace(/^export /gm, '')
  const mocks = { ...cart, splitCartItemKey, buildCartSyncPayload, syncCart,
    getToken: () => 'fixture', getSessionGeneration: () => session, isCurrentSession: value => value === session,
    onSessionChanged: callback => { sessionChanged = callback },
    upsertCartItem: async value => { pushed.push(value); return overrides.upsert?.(value) },
    deleteCartItem: async key => { removed.push(key); return overrides.remove?.(key) },
    deleteCartItems: async keys => { if (keys) removed.push(...keys); return overrides.clear?.() }, console: { log() {}, warn() {} } }
  const api = Function(...Object.keys(mocks), `${code}\nreturn { applyServerCartToLocal, syncCartOnLogin, captureCartSyncSnapshot, handleCartRemoteSync, schedulePushCartItem, pushCartRemoval, pushClearCart }`)(...Object.values(mocks))
  return { ...api, pushed, removed, changeSession: () => { session++; sessionChanged() } }
}

test('单行写回清除服务端判无效的答卷，只合并对应行凭据', async t => {
  const assessed = { ...product(10), needQuestionnaire: 1, questionnaireId: 92 }
  cart.addCartItem(assessed, 3)
  cart.updateCartQuestionnaire(assessed, { questionnaireId: 92, answerId: 91 })
  cart.addCartItem(product(20), 2)
  const sync = syncModule(undefined, { upsert: async () => ({ productId: 10, skuId: 1,
    needQuestionnaire: 1, questionnaireId: 92, answerId: null, quantity: 99, checked: 0 }) })
  await sync.handleCartRemoteSync('upsert', ['10:1'])
  t.mock.timers.tick(400)
  await flush()
  const entries = cart.getCartEntries()
  assert.equal(entries['10:1'].answerId, null)
  assert.equal(entries['10:1'].questionnairePassed, false)
  assert.equal(entries['10:1'].quantity, 3)
  assert.equal(entries['10:1'].selected, true)
  assert.equal(entries['20:1'].quantity, 2)
})

test('单行旧回包不能覆盖新答卷、恢复删除行或写入新账号', async t => {
  for (const action of ['answer', 'delete', 'session']) {
    const assessed = { ...product(10), needQuestionnaire: 1, questionnaireId: 92 }
    cart.addCartItem(assessed, 1)
    cart.updateCartQuestionnaire(assessed, { questionnaireId: 92, answerId: 91 })
    const reply = deferred()
    const sync = syncModule(undefined, { upsert: () => reply.promise })
    await sync.handleCartRemoteSync('upsert', ['10:1'])
    t.mock.timers.tick(400)
    if (action === 'answer') {
      cart.updateCartQuestionnaire(assessed, { questionnaireId: 92, answerId: 93 })
      await sync.handleCartRemoteSync('upsert', ['10:1'])
    } else if (action === 'delete') cart.removeFromCart('10:1')
    else sync.changeSession()
    reply.finish({ productId: 10, skuId: 1, needQuestionnaire: 1, questionnaireId: 92, answerId: null })
    await flush()
    if (action === 'answer') assert.equal(cart.getCartEntries()['10:1'].answerId, 93)
    if (action === 'delete') assert.equal(cart.getCartEntries()['10:1'], undefined)
    if (action === 'session') assert.equal(cart.getCartEntries()['10:1'].answerId, 91)
    sync.changeSession()
    cart.clearCart()
  }
})

test('单行回包保留旧后台省略的凭据，接受合法新答卷和关闭问卷配置', async t => {
  const replies = [
    { needQuestionnaire: 1 },
    { needQuestionnaire: 1, questionnaireId: 92 },
    { needQuestionnaire: 1, answerId: null },
    { needQuestionnaire: 1, questionnaireId: 92, answerId: 91 },
    { needQuestionnaire: 1, questionnaireId: 92, answerId: 93 },
    { needQuestionnaire: 0, questionnaireId: null, answerId: null }
  ]
  for (const reply of replies) {
    const assessed = { ...product(10), needQuestionnaire: 1, questionnaireId: 92 }
    cart.addCartItem(assessed, 2)
    cart.updateCartQuestionnaire(assessed, { questionnaireId: 92, answerId: 91 })
    const revision = cart.getCartEntries()['10:1'].revision
    const sync = syncModule(undefined, { upsert: async () => ({ id: 700, cartVersion: 3, productId: 10, skuId: 1, ...reply }) })
    await sync.handleCartRemoteSync('upsert', ['10:1'])
    t.mock.timers.tick(400)
    await flush()
    const entry = cart.getCartEntries()['10:1']
    if (reply.needQuestionnaire === 0) {
      assert.equal(entry.needQuestionnaire, 0)
      assert.equal(entry.questionnaireId, null)
      assert.equal(entry.answerId, null)
      assert.equal(entry.questionnairePassed, true)
    } else {
      assert.equal(entry.needQuestionnaire, 1)
      assert.equal(entry.questionnaireId, 92)
      assert.equal(entry.answerId, reply.answerId === 93 ? 93 : 91)
      assert.equal(entry.questionnairePassed, true)
    }
    assert.equal(entry.quantity, 2)
    assert.equal(entry.serverCartItemId, '700')
    assert.equal(entry.serverCartVersion, '3')
    if (reply.needQuestionnaire === 1 && reply.answerId !== 93) assert.equal(entry.revision, revision)
    else assert.notEqual(entry.revision, revision)
    sync.changeSession()
    cart.clearCart()
  }
})

test('未触发同步事件的新答卷、同值重加行和错误行回包也不能被单行旧结果覆盖', async t => {
  for (const scenario of ['local-edit', 'readded', 'wrong-key']) {
    const assessed = { ...product(10), needQuestionnaire: 1, questionnaireId: 92 }
    cart.addCartItem(assessed, 1)
    cart.updateCartQuestionnaire(assessed, { questionnaireId: 92, answerId: 91 })
    const reply = deferred(), sync = syncModule(undefined, { upsert: () => reply.promise })
    await sync.handleCartRemoteSync('upsert', ['10:1'])
    t.mock.timers.tick(400)
    if (scenario === 'local-edit') cart.updateCartQuestionnaire(assessed, { questionnaireId: 92, answerId: 93 })
    if (scenario === 'readded') {
      cart.removeFromCart('10:1')
      cart.addCartItem(assessed, 1)
      cart.updateCartQuestionnaire(assessed, { questionnaireId: 92, answerId: 91 })
    }
    reply.finish({ id: 700, cartVersion: 9, productId: scenario === 'wrong-key' ? 20 : 10, skuId: 1,
      needQuestionnaire: 1, questionnaireId: 92, answerId: null })
    await flush()
    assert.equal(cart.getCartEntries()['10:1'].answerId, scenario === 'local-edit' ? 93 : 91)
    assert.equal(cart.getCartEntries()['10:1'].serverCartItemId, null)
    assert.equal(cart.getCartEntries()['20:1'], undefined)
    sync.changeSession()
    cart.clearCart()
  }
})

const editDuringRequest = () => {
  cart.setCartItemQuantity('10:1', 3)
  cart.removeFromCart('20:1')
  cart.addCartItem(product(30), 2)
}
const assertCurrentEdits = (sync, t) => {
  const entries = cart.getCartEntries()
  assert.equal(entries['10:1'].quantity, 3)
  assert.equal(entries['20:1'], undefined)
  assert.equal(entries['30:1'].quantity, 2)
  t.mock.timers.tick(400)
  assert.deepEqual(sync.pushed.map(item => [item.productId, item.quantity]), [[10, 3], [30, 2]])
  assert.deepEqual(sync.removed, ['20:1'])
}

test('购物车GET返回时保留请求期间增量、删除和新加购，列表同步展示新行并只重推一次', async t => {
  cart.addCartItem(product(10), 1); cart.addCartItem(product(20), 1)
  const reply = deferred(), sync = syncModule()
  const definition = loadOptions('pages/cart/cart.vue', { ...cart, ...sync,
    TabBar: {}, getImageUrl: value => value, getCartList: () => reply.promise,
    console: { log() {}, warn() {}, error() {} } })
  const page = { ...definition.data(), ...definition.methods }
  const pending = page.loadCartFromServer()
  editDuringRequest()
  reply.finish(serverRows())
  await pending
  assertCurrentEdits(sync, t)
  await flush()
  assert.deepEqual(page.cartItems.map(item => item.id), ['10:1', '30:1'])
})

test('登录合并的迟到响应不恢复已删行、不覆盖新数量，无后续编辑时不循环重推', async t => {
  cart.addCartItem(product(10), 1); cart.addCartItem(product(20), 1)
  const reply = deferred(), sync = syncModule(() => reply.promise)
  const pending = sync.syncCartOnLogin()
  editDuringRequest()
  reply.finish(serverRows())
  await pending
  assertCurrentEdits(sync, t)
  await flush()
  const before = sync.pushed.length
  sync.applyServerCartToLocal(serverRows(), false, sync.captureCartSyncSnapshot())
  t.mock.timers.tick(400)
  await flush()
  assert.equal(sync.pushed.length, before)
})

test('加购后400ms内进入购物车，尚未发送的新行不会被旧GET删除', async t => {
  cart.addCartItem(product(10), 3)
  const sync = syncModule()
  await sync.handleCartRemoteSync('upsert', ['10:1'])
  const snapshot = sync.captureCartSyncSnapshot()
  sync.applyServerCartToLocal([], false, snapshot)
  assert.equal(cart.getCartEntries()['10:1'].quantity, 3)
  t.mock.timers.tick(400)
  await flush()
  assert.equal(sync.pushed.length, 1)
  assert.equal(sync.pushed[0].quantity, 3)
})

test('请求开始时待推送、返回前已写成功，旧GET仍不能覆盖且不再重复推送', async t => {
  cart.addCartItem(product(10), 3)
  const sync = syncModule()
  await sync.handleCartRemoteSync('upsert', ['10:1'])
  const snapshot = sync.captureCartSyncSnapshot()
  t.mock.timers.tick(400)
  await flush()
  assert.deepEqual(sync.captureCartSyncSnapshot().pendingKeys, [])
  sync.applyServerCartToLocal(serverRows(), false, snapshot)
  assert.equal(cart.getCartEntries()['10:1'].quantity, 3)
  t.mock.timers.tick(400)
  await flush()
  assert.equal(sync.pushed.length, 1)
})

test('推送失败的新数量保持dirty，后续GET不能覆盖，相同版本写成功才解除', async t => {
  cart.addCartItem(product(10), 3)
  let fail = true
  const sync = syncModule(undefined, { upsert: async () => { if (fail) throw new Error('fixture offline') } })
  await sync.handleCartRemoteSync('upsert', ['10:1'])
  t.mock.timers.tick(400)
  await flush()
  assert.deepEqual(sync.captureCartSyncSnapshot().pendingKeys, ['10:1'])
  const snapshot = sync.captureCartSyncSnapshot()
  sync.applyServerCartToLocal(serverRows(), false, snapshot)
  assert.equal(cart.getCartEntries()['10:1'].quantity, 3)
  fail = false
  t.mock.timers.tick(400)
  await flush()
  assert.deepEqual(sync.captureCartSyncSnapshot().pendingKeys, [])
  assert.equal(sync.pushed.length, 2)
})

test('清空尚在途时启动GET，清空成功后迟到的旧列表也不能恢复已删行', async () => {
  cart.addCartItem(product(10), 1)
  const clearing = deferred()
  const sync = syncModule(undefined, { clear: () => clearing.promise })
  const keys = Object.keys(cart.getCartEntries())
  cart.clearCart()
  const pending = sync.handleCartRemoteSync('clear', keys)
  const snapshot = sync.captureCartSyncSnapshot()
  clearing.finish()
  await pending
  sync.applyServerCartToLocal(serverRows().slice(0, 1), false, snapshot)
  assert.deepEqual(cart.getCartEntries(), {})
})

test('请求期间数量1变2又变1，已完成写入的版本仍阻止中间值迟到覆盖', async t => {
  cart.addCartItem(product(10), 1)
  const sync = syncModule(), snapshot = sync.captureCartSyncSnapshot()
  for (const quantity of [2, 1]) {
    cart.setCartItemQuantity('10:1', quantity)
    await sync.handleCartRemoteSync('upsert', ['10:1'])
    t.mock.timers.tick(400)
    await flush()
  }
  sync.applyServerCartToLocal([{ ...serverRows()[0], quantity: 2 }], false, snapshot)
  assert.equal(cart.getCartEntries()['10:1'].quantity, 1)
  assert.equal(sync.pushed.length, 2)
})

test('旧账号在途请求结束不能清理新账号同key状态', async t => {
  cart.addCartItem(product(10), 1)
  const replies = [deferred(), deferred()]
  let call = 0
  const sync = syncModule(undefined, { upsert: () => replies[call++].promise })
  await sync.handleCartRemoteSync('upsert', ['10:1'])
  t.mock.timers.tick(400)
  sync.changeSession()
  await sync.handleCartRemoteSync('upsert', ['10:1'])
  t.mock.timers.tick(400)
  replies[0].finish()
  await flush()
  assert.deepEqual(sync.captureCartSyncSnapshot().pendingKeys, ['10:1'])
  replies[1].finish()
  await flush()
  assert.deepEqual(sync.captureCartSyncSnapshot().pendingKeys, [])
})

test('同key并行写入逆序成功，保留在途保护并补推最新数量一次', async t => {
  cart.addCartItem(product(10), 1)
  const replies = [deferred(), deferred()]
  let call = 0
  const sync = syncModule(undefined, { upsert: () => call < replies.length ? replies[call++].promise : undefined })
  await sync.handleCartRemoteSync('upsert', ['10:1'])
  t.mock.timers.tick(400)
  cart.setCartItemQuantity('10:1', 2)
  await sync.handleCartRemoteSync('upsert', ['10:1'])
  t.mock.timers.tick(400)
  replies[1].finish()
  await flush()
  assert.deepEqual(sync.captureCartSyncSnapshot().pendingKeys, ['10:1'])
  replies[0].finish()
  await flush()
  const snapshot = sync.captureCartSyncSnapshot()
  sync.applyServerCartToLocal(serverRows().slice(0, 1), false, snapshot)
  assert.equal(cart.getCartEntries()['10:1'].quantity, 2)
  t.mock.timers.tick(400)
  await flush()
  assert.deepEqual(sync.pushed.map(item => item.quantity), [1, 2, 2])
  assert.deepEqual(sync.captureCartSyncSnapshot().pendingKeys, [])
})

test('登录sync旧数量晚于最新upsert成功，仍补推当前数量且后续GET不回退', async t => {
  cart.addCartItem(product(10), 1)
  const loginReply = deferred()
  const sync = syncModule(() => loginReply.promise)
  const pendingLogin = sync.syncCartOnLogin()
  cart.setCartItemQuantity('10:1', 2)
  await sync.handleCartRemoteSync('upsert', ['10:1'])
  t.mock.timers.tick(400)
  await flush()
  loginReply.finish(serverRows().slice(0, 1))
  await pendingLogin
  assert.equal(cart.getCartEntries()['10:1'].quantity, 2)
  const snapshot = sync.captureCartSyncSnapshot()
  sync.applyServerCartToLocal(serverRows().slice(0, 1), false, snapshot)
  assert.equal(cart.getCartEntries()['10:1'].quantity, 2)
  t.mock.timers.tick(400)
  await flush()
  assert.deepEqual(sync.pushed.map(item => item.quantity), [2, 2])
  assert.deepEqual(sync.captureCartSyncSnapshot().pendingKeys, [])
})

test('登录时已有本地行上传失败，后续GET保留并重推，成功后才解除dirty', async t => {
  cart.addCartItem(product(10), 3)
  const sync = syncModule(async () => { throw new Error('fixture offline') })
  await sync.syncCartOnLogin()
  assert.deepEqual(sync.captureCartSyncSnapshot().pendingKeys, ['10:1'])
  sync.applyServerCartToLocal([], false, sync.captureCartSyncSnapshot())
  assert.equal(cart.getCartEntries()['10:1'].quantity, 3)
  t.mock.timers.tick(400)
  await flush()
  assert.deepEqual(sync.captureCartSyncSnapshot().pendingKeys, [])
  assert.equal(sync.pushed.length, 1)
})

test('删除写失败后GET不能恢复行，同版本删除成功才解除dirty', async () => {
  cart.addCartItem(product(10), 1)
  let fail = true
  const sync = syncModule(undefined, { remove: async () => { if (fail) throw new Error('fixture offline') } })
  cart.removeFromCart('10:1')
  await sync.handleCartRemoteSync('remove', ['10:1'])
  assert.deepEqual(sync.captureCartSyncSnapshot().pendingKeys, ['10:1'])
  fail = false
  sync.applyServerCartToLocal(serverRows().slice(0, 1), false, sync.captureCartSyncSnapshot())
  await flush()
  assert.deepEqual(cart.getCartEntries(), {})
  assert.deepEqual(sync.captureCartSyncSnapshot().pendingKeys, [])
  assert.deepEqual(sync.removed, ['10:1', '10:1'])
})

test('本地商品加载期间切换账号，旧fallback不能覆盖新账号页面或购物车', async () => {
  cart.addCartItem(product(10), 1)
  const reply = deferred()
  let session = 1, reloads = 0
  const definition = loadOptions('pages/cart/cart.vue', { ...cart, TabBar: {}, getImageUrl: value => value,
    getSessionGeneration: () => session, isCurrentSession: value => value === session,
    loadCartProducts: () => reply.promise, console: { log() {}, warn() {}, error() {} } })
  const page = { ...definition.data(), ...definition.methods, loadCartData: () => { reloads++ } }
  const pending = page.loadLocalCartFallback()
  session++
  cart.clearCart(); cart.addCartItem(product(20), 2)
  page.categories = [{ id: 'new-account' }]
  reply.finish([product(10)])
  await pending
  assert.deepEqual(page.categories, [{ id: 'new-account' }])
  assert.equal(reloads, 0)
  assert.deepEqual(Object.keys(cart.getCartEntries()), ['20:1'])
})
