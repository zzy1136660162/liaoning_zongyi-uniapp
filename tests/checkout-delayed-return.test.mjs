import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { beginSession, endSession, getSessionGeneration, isCurrentSession, assertCurrentSession } from '../utils/session.js'
import { parseConsultationContext } from '../utils/consultation-checkout.js'
import { loadSetup } from './sfc-harness.mjs'

const values = new Map()
beforeEach(() => {
  values.clear()
  globalThis.uni = {
    getStorageSync: key => values.get(key), setStorageSync: (key, value) => values.set(key, value),
    removeStorageSync: key => values.delete(key), $emit() {}, hideLoading() {}
  }
  beginSession('fixture-account-A')
})

const createPage = async failure => {
  const hooks = {}, timers = new Map(), callbacks = [], navigation = []
  const owner = { route: 'pages/order/confirm' }, stack = [{ route: 'pages/cart/cart' }, owner]
  let nextTimer = 0, storageUnavailable = false
  const page = loadSetup('pages/order/confirm.vue', {
    ref: value => ({ value }), computed: get => ({ get value() { return get() } }),
    onLoad: callback => { hooks.load = callback }, onShow() {},
    onHide: callback => { hooks.hide = callback }, onUnload: callback => { hooks.unload = callback },
    getSessionGeneration, isCurrentSession, assertCurrentSession, parseConsultationContext,
    getCurrentPages: () => stack,
    setTimeout: callback => { const id = nextTimer++; timers.set(id, callback); callbacks.push(callback); return id },
    clearTimeout: id => timers.delete(id),
    getProductDetail: async () => ({ id: 10, productName: '测试商品', productCategory: 99, available: true,
      skus: [{ id: 11, price: 10, stock: 8, status: 1, delSign: 0 }] }),
    console: { debug() {}, error() {} },
    uni: { ...uni, getStorageSync: key => {
      if (storageUnavailable) throw new Error('fixture storage unavailable')
      return values.get(key)
    }, showLoading() {}, showToast() {}, navigateBack: () => navigation.push('back') }
  }, ['loadProducts', 'loadOrderInfo'])
  hooks.load({ selectedItems: '10:11', buyQuantity: '1' })
  if (failure === 'product') await page.loadProducts()
  else {
    storageUnavailable = true
    page.loadOrderInfo()
  }
  assert.equal(timers.size, 1)
  return { hooks, timers, callbacks, navigation, stack }
}

for (const failure of ['product', 'order-info']) {
  test(`确认页${failure}错误延迟返回只在原页面执行一次`, async () => {
    const page = await createPage(failure)
    for (const callback of page.timers.values()) callback()
    assert.deepEqual(page.navigation, ['back'])
    page.hooks.unload()
    page.callbacks[0]()
    assert.deepEqual(page.navigation, ['back'])
  })

  for (const boundary of ['logout', 'switch-account', 'unload', 'hide', 'new-page']) {
    test(`确认页${failure}错误后${boundary}，旧延迟回调不能退掉后来页面`, async () => {
      const page = await createPage(failure)
      if (boundary === 'logout') endSession()
      else if (boundary === 'switch-account') beginSession('fixture-account-B')
      else if (boundary === 'unload') page.hooks.unload()
      else if (boundary === 'hide') page.hooks.hide()
      else page.stack.push({ route: 'pages/user/profile' })
      if (['unload', 'hide'].includes(boundary)) assert.equal(page.timers.size, 0)
      // 即使 clearTimeout 前回调已经入队，页面实例、会话和任务代次仍会拒绝执行。
      page.callbacks[0]()
      assert.deepEqual(page.navigation, [])
    })
  }
}
