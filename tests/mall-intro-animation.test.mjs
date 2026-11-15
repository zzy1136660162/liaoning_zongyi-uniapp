import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, test } from 'node:test'
import { buildCategoryTree, normalizeCategoryId } from '../utils/category-tree.js'
import { loadOptions } from './sfc-harness.mjs'

const appDefinition = loadOptions('App.vue', {
  initCartRemoteSync() {}, console: { warn() {}, log() {} }
})
let app
beforeEach(t => {
  globalThis.uni = {
    $on() {}, $off() {}, removeStorageSync() {}, showToast() {}, upx2px: value => value / 2,
    createSelectorQuery() {
      const query = {
        in: () => query, select: () => query, boundingClientRect: () => query,
        exec: callback => callback([{ top: 0, height: 340 }, { top: 0, height: 300 }])
      }
      return query
    }
  }
  t.mock.timers.enable({ apis: ['setTimeout'] })
  app = { globalData: { ...appDefinition.globalData } }
  appDefinition.onLaunch.call(app)
})
afterEach(t => t.mock.timers.reset())

const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const deferred = () => {
  let resolve
  const promise = new Promise(yes => { resolve = yes })
  return { promise, resolve }
}
const createPage = (overrides = {}) => {
  let refreshes = 0, cartRefreshes = 0, unsubscribed = 0
  const definition = loadOptions('pages/products/medicine_list.vue', {
    getApp: () => app, TabBar: {}, getImageUrl: value => value,
    getExternalUseLabel() {}, getColdShippingLabel() {}, isSelfDevelopedProduct() {},
    buildCategoryTree, normalizeCategoryId, mapProductListItem: value => value,
    getCategoryList: async () => [], getCategoryProducts: async () => ({ records: [], total: 0 }),
    refreshCart: async () => [], subscribeCartUpdated: () => () => { unsubscribed++ },
    console: { error() {}, warn() {} }, ...overrides
  })
  const vm = {
    ...definition.data(), ...definition.methods,
    $set: (object, key, value) => { object[key] = value },
    $nextTick: callback => callback(),
    loadProducts() {
      refreshes++
      return definition.methods.loadProducts.call(this)
    },
    updateCartView() { cartRefreshes++ }
  }
  Object.entries(definition.computed).forEach(([name, getter]) =>
    Object.defineProperty(vm, name, { get: () => getter.call(vm) }))
  return { definition, vm, counts: () => ({ refreshes, cartRefreshes, unsubscribed }) }
}
const touch = (y, className = 'hospital-intro') => ({
  target: { className }, touches: [{ clientY: y }]
})

test('首次及重建首页在渲染前按胶囊底边预留8px，胶囊坐标保持px单位', () => {
  for (const bottom of [60, 80, 97]) {
    uni.getWindowInfo = () => ({ statusBarHeight: 24 })
    uni.getMenuButtonBoundingClientRect = () => ({ bottom })
    const { definition, vm } = createPage()
    definition.onLoad.call(vm)
    assert.equal(vm.introSafeTop, bottom + 8)
  }
  const source = readFileSync(new URL('../pages/products/medicine_list.vue', import.meta.url), 'utf8')
  assert.ok(source.includes("'--intro-safe-top': `${introSafeTop}px`"))
})

test('胶囊接口缺失、零值或抛错时按状态栏及导航高度回退，不影响首页加载', () => {
  for (const menu of [undefined, () => ({ bottom: 0 }), () => { throw new Error('unavailable') }]) {
    uni.getWindowInfo = () => ({ statusBarHeight: 59 })
    uni.getMenuButtonBoundingClientRect = menu
    const { definition, vm } = createPage()
    definition.onLoad.call(vm)
    assert.equal(vm.introSafeTop, 111)
  }
  delete uni.getWindowInfo
  uni.getSystemInfoSync = () => ({ statusBarHeight: 44 })
  const { vm } = createPage()
  vm.updateIntroSafeTop()
  assert.equal(vm.introSafeTop, 96)
  uni.getSystemInfoSync = () => { throw new Error('unavailable') }
  vm.updateIntroSafeTop()
  assert.equal(vm.introSafeTop, 76)
})

test('按实测横幅空白和屏幕单位折叠，布局交接前后保持同一视觉端点', t => {
  const { definition, vm } = createPage()
  definition.onLoad.call(vm)
  definition.onReady.call(vm)
  assert.equal(vm.bannerGapPx, 40)
  assert.equal(vm.collapseRangePx, 220)
  assert.deepEqual(vm.mallContentStyle, { marginTop: '-40px', transform: 'translateY(0px)' })
  vm.runCollapse()
  assert.equal(vm.layoutCollapsed, false, '动画期间不先收缩布局')
  assert.deepEqual(vm.mallContentStyle, { marginTop: '-40px', transform: 'translateY(-220px)' })
  t.mock.timers.tick(1499)
  assert.equal(vm.layoutCollapsed, false)
  t.mock.timers.tick(1)
  assert.deepEqual(vm.mallContentStyle, { marginTop: '-260px', transform: 'translateY(0px)' })
  assert.equal(vm.noTransition, true)
  t.mock.timers.tick(32)
  assert.equal(vm.noTransition, false)
  vm.runExpand()
  assert.deepEqual(vm.mallContentStyle, { marginTop: '-260px', transform: 'translateY(220px)' })
  t.mock.timers.tick(1500)
  assert.deepEqual(vm.mallContentStyle, { marginTop: '-40px', transform: 'translateY(0px)' })
})

test('首次立即消费标记，真实列表加载完成后停留1800ms再收起', async t => {
  const categories = deferred(), products = deferred()
  const { definition, vm } = createPage({
    getCategoryList: () => categories.promise, getCategoryProducts: () => products.promise
  })
  assert.equal(vm.shouldPlayIntro, true)
  definition.onLoad.call(vm)
  definition.onReady.call(vm)
  assert.equal(app.globalData.mallIntroPlayed, true)
  const loading = vm.loadProducts()
  t.mock.timers.tick(2000)
  assert.equal(vm.imageCollapsed, false, '尚未取得列表时不提前播放')
  categories.resolve([])
  await flush()
  products.resolve({ records: [], total: 0 })
  await loading
  assert.equal(vm.productsLoaded, true)
  assert.equal(vm.pendingIntro, false)
  assert.equal(vm.introFallbackTimer, null, '正常加载成功取消兜底')
  t.mock.timers.tick(1799)
  assert.equal(vm.imageCollapsed, false)
  t.mock.timers.tick(1)
  assert.equal(vm.imageCollapsed, true)
  assert.equal(vm.visualOffset, -220)
  assert.equal(vm.collapseTimer, null)
})

test('列表长期未完成时4500ms兜底启动停留，迟到数据不会重复播放', async t => {
  const categories = deferred()
  const { definition, vm } = createPage({ getCategoryList: () => categories.promise })
  definition.onLoad.call(vm)
  definition.onReady.call(vm)
  const loading = vm.loadProducts()
  t.mock.timers.tick(4499)
  assert.equal(vm.pendingIntro, true)
  assert.equal(vm.imageCollapsed, false)
  t.mock.timers.tick(1)
  assert.equal(vm.pendingIntro, false)
  t.mock.timers.tick(1799)
  assert.equal(vm.imageCollapsed, false)
  t.mock.timers.tick(1)
  assert.equal(vm.imageCollapsed, true)
  t.mock.timers.tick(1500)
  categories.resolve([])
  await loading
  assert.equal(vm.layoutCollapsed, true)
  assert.equal(vm.visualOffset, 0)
  assert.equal(vm.collapseTimer, null, '迟到的列表完成不创建第二次播放')
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
  assert.equal(second.vm.layoutCollapsed, true)
  assert.equal(second.vm.visualOffset, 0)
  assert.equal(second.vm.introFallbackTimer, null)
  assert.equal(second.vm.collapseTimer, null)
  assert.equal(second.vm.settleTimer, null)
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

test('等待中隐藏会清理待播和兜底计时，返回保留布局与已加载列表且不重播', async t => {
  const { definition, vm, counts } = createPage()
  definition.onLoad.call(vm)
  definition.onReady.call(vm)
  await vm.loadProducts()
  t.mock.timers.tick(300)
  definition.onHide.call(vm)
  assert.equal(vm.collapseTimer, null)
  assert.equal(vm.introFallbackTimer, null)
  assert.equal(vm.layoutCollapsed, false)
  assert.equal(vm.imageCollapsed, false)
  assert.equal(vm.shouldPlayIntro, false)
  await definition.onShow.call(vm)
  t.mock.timers.tick(6000)
  assert.equal(vm.layoutCollapsed, false)
  assert.equal(vm.visualOffset, 0)
  assert.deepEqual(counts(), { refreshes: 1, cartRefreshes: 2, unsubscribed: 0 })
})

test('onReady前隐藏后不再启动首次动画，返回加载完成也不补播', async t => {
  const { definition, vm } = createPage()
  definition.onLoad.call(vm)
  definition.onHide.call(vm)
  definition.onReady.call(vm)
  await definition.onShow.call(vm)
  await flush()
  t.mock.timers.tick(8000)
  assert.equal(vm.pendingIntro, false)
  assert.equal(vm.collapseTimer, null)
  assert.equal(vm.introFallbackTimer, null)
  assert.equal(vm.layoutCollapsed, false)
  assert.equal(vm.visualOffset, 0)
})

test('卸载取消正在进行的折叠结算并释放购物车订阅', t => {
  const { definition, vm, counts } = createPage()
  definition.onLoad.call(vm)
  definition.onReady.call(vm)
  vm.playIntroCollapse()
  t.mock.timers.tick(1800)
  assert.notEqual(vm.settleTimer, null)
  assert.equal(vm.visualOffset, -220)
  definition.onUnload.call(vm)
  assert.equal(vm.collapseTimer, null)
  assert.equal(vm.introFallbackTimer, null)
  assert.equal(vm.settleTimer, null)
  t.mock.timers.tick(8000)
  assert.equal(vm.layoutCollapsed, false, '卸载后旧结算不能再收缩布局')
  assert.equal(vm.visualOffset, 0)
  assert.equal(counts().unsubscribed, 1)
})

test('下拉先按手指位移展示，超过折叠距离一半才展开并在3秒后收起', t => {
  app.globalData.mallIntroPlayed = true
  const { definition, vm } = createPage()
  definition.onLoad.call(vm)
  vm.onPullStart(touch(100))
  vm.onPullMove(touch(107))
  assert.equal(vm.isFollowFinger, false)
  vm.onPullEnd()
  assert.equal(vm.visualOffset, 0)
  vm.onPullStart(touch(100))
  vm.onPullMove(touch(200))
  assert.equal(vm.visualOffset, 100)
  assert.equal(vm.isFollowFinger, true)
  vm.onPullEnd()
  assert.equal(vm.imageCollapsed, true, '不足一半时回弹到折叠位置')
  assert.equal(vm.visualOffset, 0)
  assert.equal(vm.collapseTimer, null)
  vm.onPullStart(touch(100))
  vm.onPullMove(touch(230))
  assert.equal(vm.visualOffset, 130)
  vm.onPullEnd()
  assert.equal(vm.isFollowFinger, false)
  assert.equal(vm.imageCollapsed, false)
  assert.equal(vm.visualOffset, 220)
  t.mock.timers.tick(1500)
  assert.equal(vm.layoutCollapsed, false)
  t.mock.timers.tick(1499)
  assert.equal(vm.imageCollapsed, false)
  t.mock.timers.tick(1)
  assert.equal(vm.imageCollapsed, true)
  t.mock.timers.tick(1500)
  assert.equal(vm.layoutCollapsed, true)
  assert.equal(vm.visualOffset, 0)
  const source = readFileSync(new URL('../pages/products/medicine_list.vue', import.meta.url), 'utf8')
  assert.match(source, /@touchcancel="onPullEnd"/)
})

test('展开与折叠动画中拒绝重复下拉，结算后恢复手势且入口按钮不触发展开', t => {
  app.globalData.mallIntroPlayed = true
  const { definition, vm } = createPage()
  definition.onLoad.call(vm)
  vm.runExpand()
  vm.onPullStart(touch(100))
  vm.onPullMove(touch(250))
  assert.equal(vm.pullStartY, null)
  assert.equal(vm.visualOffset, 220)
  t.mock.timers.tick(1500)
  vm.onPullStart(touch(100))
  assert.equal(vm.pullStartY, null, '已展开时不能再次下拉')
  vm.runCollapse()
  vm.onPullStart(touch(100))
  assert.equal(vm.pullStartY, null)
  assert.equal(vm.visualOffset, -220)
  t.mock.timers.tick(1500)
  vm.onPullStart(touch(100))
  assert.equal(vm.pullStartY, 100)
  vm.onPullEnd()
  vm.onPullStart(touch(100, 'toggle-text flow-text-animate'))
  vm.onPullMove(touch(250))
  assert.equal(vm.imageCollapsed, true)
  assert.equal(vm.pullStartY, null)
})
