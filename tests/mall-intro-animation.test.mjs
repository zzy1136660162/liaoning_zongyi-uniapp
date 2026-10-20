import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, test } from 'node:test'
import { loadOptions } from './sfc-harness.mjs'

const appDefinition = loadOptions('App.vue', {
  initCartRemoteSync() {}, console: { warn() {}, log() {} }
})
let app
globalThis.uni = { $on() {}, $off() {}, removeStorageSync() {} }

beforeEach(t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  app = { globalData: { ...appDefinition.globalData } }
  appDefinition.onLaunch.call(app)
})
afterEach(t => t.mock.timers.reset())

const createPage = () => {
  let refreshes = 0, cartRefreshes = 0, unsubscribed = 0
  const definition = loadOptions('pages/products/medicine_list.vue', {
    getApp: () => app, TabBar: {}, getImageUrl: value => value,
    getExternalUseLabel() {}, getColdShippingLabel() {}, isSelfDevelopedProduct() {},
    subscribeCartUpdated: () => () => { unsubscribed++ }
  })
  const vm = {
    ...definition.data(), ...definition.methods,
    loadProducts() { refreshes++ },
    loadVerifiedProductsFromStorage() { cartRefreshes++ }
  }
  return { definition, vm, counts: () => ({ refreshes, cartRefreshes, unsubscribed }) }
}
const touch = (y, className = 'hospital-intro') => ({
  target: { className }, touches: [{ clientY: y }]
})

test('本次启动首次进入立即消费标记，渲染完成后停留800ms才收起', t => {
  const { definition, vm } = createPage()
  assert.equal(vm.shouldPlayIntro, true)
  assert.equal(vm.imageCollapsed, false)
  definition.onLoad.call(vm)
  assert.equal(app.globalData.mallIntroPlayed, true)
  assert.equal(vm.collapseTimer, null)
  t.mock.timers.tick(2000)
  assert.equal(vm.imageCollapsed, false)
  definition.onReady.call(vm)
  t.mock.timers.tick(799)
  assert.equal(vm.imageCollapsed, false)
  t.mock.timers.tick(1)
  assert.equal(vm.imageCollapsed, true)
  assert.equal(vm.introMotion, 'collapse')
  assert.equal(vm.collapseTimer, null)
})

test('首页重建首帧直接收起，首次动画未完成也不会重复播放', t => {
  const first = createPage()
  first.definition.onLoad.call(first.vm)
  const second = createPage()
  assert.equal(second.vm.shouldPlayIntro, false)
  assert.equal(second.vm.imageCollapsed, true)
  second.definition.onLoad.call(second.vm)
  second.definition.onReady.call(second.vm)
  t.mock.timers.tick(5000)
  assert.equal(second.vm.introMotion, '')
  assert.equal(second.vm.collapseTimer, null)
})

test('前台恢复不重置标记，真正冷启动后再次首次进入才播放', () => {
  const first = createPage()
  first.definition.onLoad.call(first.vm)
  appDefinition.onHide.call(app)
  appDefinition.onShow.call(app)
  assert.equal(app.globalData.mallIntroPlayed, true)
  assert.equal(createPage().vm.imageCollapsed, true)
  appDefinition.onLaunch.call(app)
  assert.equal(app.globalData.mallIntroPlayed, false)
  assert.equal(createPage().vm.imageCollapsed, false)
})

test('等待中离开会清理定时器，返回同一页面只刷新商品和购物车', t => {
  const { definition, vm, counts } = createPage()
  definition.onLoad.call(vm)
  definition.onReady.call(vm)
  t.mock.timers.tick(300)
  definition.onHide.call(vm)
  assert.equal(vm.collapseTimer, null)
  assert.equal(vm.imageCollapsed, true)
  assert.equal(vm.shouldPlayIntro, false)
  definition.onShow.call(vm)
  t.mock.timers.tick(3000)
  assert.equal(vm.introMotion, '')
  assert.deepEqual(counts(), { refreshes: 1, cartRefreshes: 1, unsubscribed: 0 })
})

test('收起过程中离开立即结束动画，onReady前离开也不再启动', t => {
  const first = createPage()
  first.definition.onLoad.call(first.vm)
  first.definition.onReady.call(first.vm)
  t.mock.timers.tick(800)
  assert.equal(first.vm.introMotion, 'collapse')
  first.definition.onHide.call(first.vm)
  assert.equal(first.vm.introMotion, '')
  assert.equal(first.vm.imageCollapsed, true)

  appDefinition.onLaunch.call(app)
  const next = createPage()
  next.definition.onLoad.call(next.vm)
  next.definition.onHide.call(next.vm)
  next.definition.onReady.call(next.vm)
  assert.equal(next.vm.collapseTimer, null)
  t.mock.timers.tick(5000)
  assert.equal(next.vm.introMotion, '')
})

test('卸载同时取消动画计时并释放购物车订阅', t => {
  const { definition, vm, counts } = createPage()
  definition.onLoad.call(vm)
  definition.onReady.call(vm)
  definition.onUnload.call(vm)
  t.mock.timers.tick(5000)
  assert.equal(vm.collapseTimer, null)
  assert.equal(vm.introMotion, '')
  assert.equal(vm.imageCollapsed, true)
  assert.equal(counts().unsubscribed, 1)
})

test('手动下拉超过阈值才展开，结束或取消后停留2秒再次收起', t => {
  app.globalData.mallIntroPlayed = true
  const { vm } = createPage()
  vm.onPullStart(touch(100))
  vm.onPullMove(touch(107))
  vm.onPullEnd()
  assert.equal(vm.imageCollapsed, true)
  assert.equal(vm.collapseTimer, null)

  vm.onPullStart(touch(100))
  vm.onPullMove(touch(120))
  assert.equal(vm.imageCollapsed, false)
  assert.equal(vm.introMotion, 'expand')
  vm.onPullMove(touch(140))
  vm.onPullEnd()
  assert.equal(vm.pullStartY, null)
  assert.equal(vm.isPullingIntro, false)
  vm.onIntroAnimationEnd({ target: { id: 'mall-content' } })
  t.mock.timers.tick(1999)
  assert.equal(vm.imageCollapsed, false)
  t.mock.timers.tick(1)
  assert.equal(vm.imageCollapsed, true)
  assert.equal(vm.introMotion, 'collapse')

  const source = readFileSync(new URL('../pages/products/medicine_list.vue', import.meta.url), 'utf8')
  assert.match(source, /@touchcancel="onPullEnd"/)
})

test('动画期间忽略重复下拉，子节点动画结束不提前中止主体动画', () => {
  app.globalData.mallIntroPlayed = true
  const { vm } = createPage()
  vm.introMotion = 'collapse'
  vm.onPullStart(touch(100))
  vm.onPullMove(touch(150))
  assert.equal(vm.pullStartY, null)
  assert.equal(vm.imageCollapsed, true)
  vm.onIntroAnimationEnd({ target: { id: 'flow-text' } })
  assert.equal(vm.introMotion, 'collapse')
  vm.onIntroAnimationEnd({ target: { id: 'mall-content' } })
  assert.equal(vm.introMotion, '')

  vm.onPullStart(touch(100, 'toggle-text flow-text-animate'))
  vm.onPullMove(touch(150))
  assert.equal(vm.imageCollapsed, true)
  assert.equal(vm.pullStartY, null)
})
