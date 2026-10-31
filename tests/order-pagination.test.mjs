import assert from 'node:assert/strict'
import { beforeEach, afterEach, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { loadOptions, loadSetup } from './sfc-harness.mjs'
import { beginSession, endSession, getSessionGeneration, isCurrentSession, onSessionChanged } from '../utils/session.js'
import { get } from '../utils/request.js'

const values = new Map()
let lists, requests, modals, stoppedSessionListeners, cancelled, confirmed, stoppedRefreshes, pageScrolls
globalThis.uni = {
  getStorageSync: key => values.get(key), setStorageSync: (key, value) => values.set(key, value),
  removeStorageSync: key => values.delete(key), request: options => requests.push(options),
  showLoading() {}, hideLoading() {}, showToast() {}, $emit() {},
  stopPullDownRefresh: () => { stoppedRefreshes++ },
  pageScrollTo: options => pageScrolls.push(options),
  showModal: options => modals.push(options)
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
const row = (id, extra = {}) => ({ id, orderStatus: 1, items: [{ id: `item-${id}`, productName: `商品${id}` }], ...extra })
const page = (rows, pageNum = 1, hasMore = false, total = rows.length) => ({ rows, pageNum, pageSize: 20, hasMore, total })
const createList = (options = {}) => {
  const pageCalls = [], detailCalls = []
  let load, mount, unmount, show, hide, pullDown, reachBottom
  const state = loadSetup('pages/order/order_list.vue', {
    ref: value => ({ value }), onMounted: callback => { mount = callback },
    onLoad: callback => { load = callback },
    onUnmounted: callback => { unmount = callback }, onShow: callback => { show = callback },
    onHide: callback => { hide = callback },
    onPullDownRefresh: callback => { pullDown = callback },
    onReachBottom: callback => { reachBottom = callback },
    getSessionGeneration, isCurrentSession,
    onSessionChanged: handler => {
      const unsubscribe = onSessionChanged(handler)
      return () => { stoppedSessionListeners++; unsubscribe() }
    },
    getCurrentPages: () => [{ options }],
    getOrderPage: params => new Promise((resolve, reject) => pageCalls.push({ params, resolve, reject })),
    getOrderDetail: id => new Promise((resolve, reject) => detailCalls.push({ id, resolve, reject })),
    cancelOrder: async () => { cancelled++ }, confirmReceipt: async () => { confirmed++ },
    logPageView() {}, logButtonClick() {}, isTherapyOrder: () => false,
    getOrderStatusText: () => ''
  }, ['activeTab', 'orders', 'pageNum', 'total', 'hasMore', 'hasLoaded', 'loading', 'refreshing', 'loadError',
    'loadOrders', 'loadMoreOrders', 'refreshOrders', 'retryOrders', 'switchTab', 'handleCancelOrder', 'handleConfirmReceipt'])
  const list = { state, pageCalls, detailCalls, unmount, show, hide, pullDown, reachBottom }
  lists.push(list)
  // 小程序先触发页面 onLoad、onShow，再触发组件 mounted。
  load?.(options)
  show()
  mount?.()
  return list
}

beforeEach(() => {
  values.clear(); lists = []; requests = []; modals = []; stoppedSessionListeners = 0; cancelled = 0; confirmed = 0
  stoppedRefreshes = 0; pageScrolls = []
  beginSession('fixture-A')
})
afterEach(() => {
  lists.forEach(list => list.unmount())
  endSession()
})

test('个人中心待支付入口在 onShow 早于 mounted 时仍结束加载并显示订单', async () => {
  let targetUrl
  const profile = loadSetup('pages/user/profile.vue', {
    ref: value => ({ value }), logButtonClick() {},
    fetchAccountProfile: async () => ({ id: 7, userName: '测试用户' }),
    uni: { navigateTo: ({ url }) => { targetUrl = url } }
  }, ['goToOrderListByStatus'])
  profile.goToOrderListByStatus(0)
  const target = new URL(targetUrl, 'https://fixture.invalid')
  assert.equal(target.pathname, '/pages/order/order_list')
  assert.equal(target.searchParams.get('status'), 'pending')

  const { state, pageCalls } = createList(Object.fromEntries(target.searchParams))
  assert.equal(state.activeTab.value, 'pending')
  pageCalls[0].resolve(page([row('pending-order', { payStatus: 0, orderStatus: 0 })])); await flush()
  assert.equal(state.loading.value, false, '接口已返回后必须退出加载态')
  assert.equal(state.hasLoaded.value, true)
  assert.deepEqual(state.orders.value.map(order => order.id), ['pending-order'])
  assert.equal(state.loadError.value, '')
  assert.equal(pageCalls.length, 1)
  assert.deepEqual(pageCalls[0].params, { tab: 'pending', pageNum: 1, pageSize: 20 })
})

test('入口分类在首次请求前确定，旧已支付和待发货链接及无效参数回退到全部', async () => {
  for (const status of ['all', 'pending', 'paid', 'cancelled', 'shipping', 'received', 'completed', 'afterSale', '', undefined, 'invalid']) {
    const expected = !status || ['invalid', 'paid', 'shipping'].includes(status) ? 'all' : status
    const { state, pageCalls } = createList(status === undefined ? {} : { status })
    assert.equal(pageCalls.length, 1)
    assert.deepEqual(pageCalls[0].params, { tab: expected, pageNum: 1, pageSize: 20 })
    pageCalls[0].resolve(page([])); await flush()
    assert.equal(state.activeTab.value, expected)
    assert.equal(state.loading.value, false)
    assert.equal(state.hasLoaded.value, true)
    assert.deepEqual(state.orders.value, [])
  }
})

test('带筛选参数的首次请求失败会结束加载，重试继续请求原分类', async () => {
  const { state, pageCalls } = createList({ status: 'received' })
  pageCalls[0].reject(new Error('网络失败')); await flush()
  assert.equal(state.loading.value, false)
  assert.equal(state.loadError.value, '网络失败')
  assert.equal(state.hasLoaded.value, false)
  const retry = state.retryOrders()
  assert.equal(pageCalls.length, 2)
  assert.deepEqual(pageCalls[1].params, { tab: 'received', pageNum: 1, pageSize: 20 })
  pageCalls[1].resolve(page([row('retried')])); await retry
  assert.equal(state.loading.value, false)
  assert.equal(state.loadError.value, '')
  assert.deepEqual(state.orders.value.map(order => order.id), ['retried'])
})

test('带筛选入口进入后切换分类，返回页面保留当前分类并刷新', async () => {
  const { state, pageCalls, show } = createList({ status: 'received' })
  pageCalls[0].resolve(page([row('received', { orderStatus: 2 })])); await flush()
  const switched = state.switchTab('completed')
  pageCalls[1].resolve(page([row('completed', { orderStatus: 3 })])); await switched
  show()
  assert.equal(state.activeTab.value, 'completed')
  assert.equal(pageCalls.length, 3)
  assert.deepEqual(pageCalls[2].params, { tab: 'completed', pageNum: 1, pageSize: 20 })
  pageCalls[2].resolve(page([row('refreshed', { orderStatus: 3 })])); await flush()
  assert.equal(state.loading.value, false)
  assert.deepEqual(state.orders.value.map(order => order.id), ['refreshed'])
})

test('第一页加载期间不显示空态，触底按页追加并去重，到末页不再请求', async () => {
  const { state, pageCalls, reachBottom } = createList()
  assert.equal(state.hasLoaded.value, false)
  assert.equal(state.loading.value, true)
  assert.deepEqual(pageCalls[0].params, { tab: 'all', pageNum: 1, pageSize: 20 })
  pageCalls[0].resolve(page([row(1), row(2)], 1, true, 3)); await flush()
  assert.equal(state.total.value, 3)
  const next = reachBottom()
  reachBottom()
  assert.equal(pageCalls.length, 2)
  assert.deepEqual(pageCalls[1].params, { tab: 'all', pageNum: 2, pageSize: 20 })
  pageCalls[1].resolve(page([row(2), row(3)], 2, false, 3)); await next
  assert.deepEqual(state.orders.value.map(order => order.id), [1, 2, 3])
  assert.equal(state.pageNum.value, 2)
  reachBottom()
  assert.equal(pageCalls.length, 2)

  const source = readFileSync(new URL('../pages/order/order_list.vue', import.meta.url), 'utf8')
  assert.match(source, /v-if="hasLoaded && !loading && !loadError && orders.length === 0"/)
  assert.match(source, /@click="retryOrders"/)
  assert.doesNotMatch(source, /filteredOrders|getRefundList/)
  const config = JSON.parse(readFileSync(new URL('../pages.json', import.meta.url), 'utf8'))
  const style = config.subPackages.find(group => group.root === 'pages/order')
    .pages.find(entry => entry.path === 'order_list').style
  assert.equal(style.enablePullDownRefresh, true)
  assert.equal(style.onReachBottomDistance, 120)
  assert.notEqual(style.disableScroll, true)
})

for (const failed of [false, true]) {
  test(`原生下拉刷新${failed ? '失败' : '成功'}后收起动画，重复下拉不叠加请求`, async () => {
    const { state, pageCalls, pullDown } = createList({ status: 'completed' })
    pageCalls[0].resolve(page([row('before')])); await flush()
    const refreshing = pullDown()
    pullDown()
    assert.equal(state.refreshing.value, true)
    assert.equal(pageCalls.length, 2)
    assert.deepEqual(pageCalls[1].params, { tab: 'completed', pageNum: 1, pageSize: 20 })
    if (failed) pageCalls[1].reject(new Error('刷新失败'))
    else pageCalls[1].resolve(page([row('refreshed')]))
    await refreshing
    assert.equal(stoppedRefreshes, 1)
    assert.equal(state.refreshing.value, false)
    assert.equal(state.loading.value, false)
    assert.equal(state.loadError.value, failed ? '刷新失败' : '')
    assert.deepEqual(state.orders.value.map(order => order.id), failed ? [] : ['refreshed'])
  })
}

test('切换分类回到页面顶部，旧刷新不能提前结束新分类的原生刷新', async () => {
  const { state, pageCalls, pullDown } = createList()
  pageCalls[0].resolve(page([row('before')])); await flush()
  const oldRefresh = pullDown()
  const switched = state.switchTab('completed')
  assert.equal(stoppedRefreshes, 1)
  assert.deepEqual(pageScrolls, [{ scrollTop: 0, duration: 0 }])
  state.switchTab('completed')
  state.switchTab('invalid')
  assert.equal(pageScrolls.length, 1)
  const currentRefresh = pullDown()
  pageCalls[1].resolve(page([row('stale-refresh')]))
  pageCalls[2].resolve(page([row('stale-tab')]))
  await Promise.all([oldRefresh, switched])
  assert.equal(stoppedRefreshes, 1)
  assert.equal(state.refreshing.value, true)
  assert.deepEqual(state.orders.value, [])
  pageCalls[3].resolve(page([row('current')]))
  await currentRefresh
  assert.equal(stoppedRefreshes, 2)
  assert.equal(state.refreshing.value, false)
  assert.deepEqual(state.orders.value.map(order => order.id), ['current'])
})

for (const action of ['hide', 'unmount', 'session']) {
  test(`原生刷新在${{ hide: '离开页面', unmount: '页面卸载', session: '切换账号' }[action]}时收起，迟到响应不重复收起`, async () => {
    const list = createList()
    list.pageCalls[0].resolve(page([row('before')])); await flush()
    const refreshing = list.pullDown()
    if (action === 'session') beginSession('fixture-B')
    else list[action]()
    assert.equal(stoppedRefreshes, 1)
    assert.equal(list.state.refreshing.value, false)
    list.pageCalls[1].resolve(page([row('late')]))
    await refreshing
    assert.equal(stoppedRefreshes, 1)
    if (action === 'session') assert.deepEqual(list.state.orders.value, [])
  })
}

test('每次返回订单列表都重新请求当前分类第一页', async () => {
  const list = createList()
  list.pageCalls[0].resolve(page([row(1)])); await flush()
  list.show()
  assert.equal(list.pageCalls.length, 2)
  assert.deepEqual(list.pageCalls[1].params, { tab: 'all', pageNum: 1, pageSize: 20 })
  list.pageCalls[1].resolve(page([row(2)])); await flush()
  assert.deepEqual(list.state.orders.value.map(order => order.id), [2])
})

test('切换分类重新请求第一页，旧分类成功和失败均不能覆盖当前状态', async () => {
  const { state, pageCalls } = createList()
  const received = state.switchTab('received')
  const completed = state.switchTab('completed')
  assert.deepEqual(pageCalls.slice(1).map(call => call.params), [
    { tab: 'received', pageNum: 1, pageSize: 20 }, { tab: 'completed', pageNum: 1, pageSize: 20 }
  ])
  pageCalls[1].resolve(page([row('stale')]))
  await received
  assert.deepEqual(state.orders.value, [])
  assert.equal(state.loading.value, true)
  pageCalls[2].resolve(page([row('current', { orderStatus: 3 })])); await completed
  pageCalls[0].reject(new Error('old request failed')); await flush()
  assert.deepEqual(state.orders.value.map(order => order.id), ['current'])
  assert.equal(state.loadError.value, '')
  assert.equal(state.activeTab.value, 'completed')
  assert.equal(state.pageNum.value, 1)
})

test('加载下一页失败保留已有订单，点击重试请求同页且保留最新退款字段', async () => {
  const { state, pageCalls } = createList()
  pageCalls[0].resolve(page([row(1, { refundApplicationId: 71, refundStatus: 1 })], 1, true, 2)); await flush()
  const loading = state.loadMoreOrders()
  pageCalls[1].reject(new Error('网络失败')); await loading
  assert.equal(state.pageNum.value, 1)
  assert.deepEqual(state.orders.value.map(order => order.id), [1])
  assert.equal(state.orders.value[0].refundApplicationId, 71)
  assert.equal(state.orders.value[0].refundStatus, 1)
  assert.equal(state.loadError.value, '网络失败')
  state.loadMoreOrders()
  assert.equal(pageCalls.length, 2)
  const retry = state.retryOrders()
  assert.equal(pageCalls[2].params.pageNum, 2)
  pageCalls[2].resolve(page([row(2)], 2)); await retry
  assert.equal(state.loadError.value, '')
  assert.deepEqual(state.orders.value.map(order => order.id), [1, 2])
})

test('第一页失败可以重试，刷新会重置页号并使旧的追加响应失效', async () => {
  const { state, pageCalls } = createList()
  pageCalls[0].reject(new Error('首次失败')); await flush()
  assert.equal(state.hasLoaded.value, false)
  const retry = state.retryOrders()
  pageCalls[1].resolve(page([row('before')], 1, true, 2)); await retry
  const append = state.loadMoreOrders()
  const refresh = state.refreshOrders()
  assert.equal(state.refreshing.value, true)
  assert.equal(pageCalls[3].params.pageNum, 1)
  pageCalls[2].resolve(page([row('old-page-2')], 2)); await append
  assert.equal(state.loading.value, true)
  pageCalls[3].resolve(page([row('refreshed')])); await refresh
  assert.deepEqual(state.orders.value.map(order => order.id), ['refreshed'])
  assert.equal(state.pageNum.value, 1)
  assert.equal(state.refreshing.value, false)
})

test('账号变化清空列表，旧账号响应不能覆盖重新展示后的当前账号数据', async () => {
  const { state, pageCalls, show } = createList()
  pageCalls[0].resolve(page([row('A')], 1, true, 2)); await flush()
  const append = state.loadMoreOrders()
  beginSession('fixture-B')
  assert.deepEqual(state.orders.value, [])
  assert.equal(state.pageNum.value, 0)
  assert.equal(state.loading.value, false)
  show()
  assert.equal(pageCalls[2].params.pageNum, 1)
  pageCalls[2].resolve(page([row('B')])); await flush()
  pageCalls[1].resolve(page([row('A-old')], 2)); await append
  assert.deepEqual(state.orders.value.map(order => order.id), ['B'])
  assert.equal(state.loadError.value, '')
})

test('旧页商品补全不能覆盖新分类，同页缺失明细仍能正常补全', async () => {
  const { state, pageCalls, detailCalls } = createList()
  pageCalls[0].resolve(page([row(1, { items: [] })])); await flush()
  assert.equal(detailCalls[0].id, 1)
  const current = state.switchTab('afterSale')
  pageCalls[1].resolve(page([row(1, { items: [], refundApplicationId: 5 })])); await flush()
  detailCalls[0].resolve(row(1, { items: [{ id: 'old-item', productName: '旧商品' }] })); await flush()
  assert.deepEqual(state.orders.value[0].items, [])
  assert.equal(state.loading.value, true)
  detailCalls[1].resolve(row(1, { items: [{ id: 'current-item', productName: '当前商品' }] })); await current
  assert.equal(state.orders.value[0].items[0].productName, '当前商品')
  assert.equal(state.orders.value[0].refundApplicationId, 5)
})

test('页面卸载释放订阅并拒绝迟到响应，旧账号确认弹窗不会再发操作请求', async () => {
  const list = createList()
  list.state.handleCancelOrder(1)
  list.state.handleConfirmReceipt(1)
  beginSession('fixture-B')
  await modals[0].success({ confirm: true })
  await modals[1].success({ confirm: true })
  assert.equal(cancelled, 0); assert.equal(confirmed, 0)
  list.unmount()
  assert.equal(stoppedSessionListeners, 1)
  list.pageCalls[0].resolve(page([row('late')])); await flush()
  assert.deepEqual(list.state.orders.value, [])
  list.state.loadOrders()
  assert.equal(list.pageCalls.length, 1)
})

test('确认收货和取消成功仍通过刷新入口重新请求当前分类第一页', async () => {
  const { state, pageCalls } = createList()
  const received = state.switchTab('received')
  pageCalls[1].resolve(page([row(1, { orderStatus: 2 })])); await received
  await state.handleConfirmReceipt(1)
  await modals.at(-1).success({ confirm: true })
  assert.equal(confirmed, 1)
  assert.deepEqual(pageCalls[2].params, { tab: 'received', pageNum: 1, pageSize: 20 })
  pageCalls[2].resolve(page([])); await flush()
  const pending = state.switchTab('pending')
  pageCalls[3].resolve(page([row(2, { orderStatus: 0 })])); await pending
  await state.handleCancelOrder(2)
  await modals.at(-1).success({ confirm: true })
  assert.equal(cancelled, 1)
  assert.deepEqual(pageCalls[4].params, { tab: 'pending', pageNum: 1, pageSize: 20 })
  pageCalls[4].resolve(page([])); await flush()
})

test('分页API读取完整响应元数据，普通请求继续仅返回data', async () => {
  const source = readFileSync(new URL('../api/order.js', import.meta.url), 'utf8')
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace(/^export /gm, '')
  const api = Function('get', 'API_PATHS', `${source}\nreturn { getOrderPage }`)(get, { ORDER: { LIST: '/api/orders' } })
  const paged = api.getOrderPage({ tab: 'afterSale', pageNum: 2, pageSize: 20 })
  const pagedCall = requests.shift()
  assert.deepEqual(pagedCall.data, { tab: 'afterSale', pageNum: 2, pageSize: 20 })
  pagedCall.success({ statusCode: 200, data: { code: 200, data: [{ id: 9 }], total: 55, pageNum: 2, pageSize: 20, hasMore: true } })
  assert.deepEqual(await paged, { rows: [{ id: 9 }], total: 55, pageNum: 2, pageSize: 20, hasMore: true })
  requests = []
  const ordinary = get('/api/fixture', {}, { showLoading: false })
  requests.shift().success({ statusCode: 200, data: { code: 200, data: { id: 4 }, total: 12 } })
  assert.deepEqual(await ordinary, { id: 4 })
})

const createProfileStats = getOrderStats => loadSetup('pages/user/profile.vue', {
  ref: value => ({ value }), computed: callback => ({ get value() { return callback() } }),
  onUnmounted() {}, onShow() {}, getSessionGeneration, isCurrentSession,
  fetchAccountProfile: async () => ({ id: 7, userName: '测试用户' }),
  getOrderStats, getImageUrl: value => value
}, ['loadOrderStats', 'orderStats'])

test('个人中心通过统计接口获取全量数量，空统计清零而不使用当前订单页数量', async () => {
  let calls = 0
  let response = { pending: '45', paid: 120, cancelled: 7, refund: '3' }
  const profile = createProfileStats(async () => { calls++; return response })
  await profile.loadOrderStats()
  assert.equal(calls, 1)
  assert.deepEqual(profile.orderStats.value, { pending: 45, paid: 120, cancelled: 7, refund: 3 })
  for (const empty of [{}, null]) {
    profile.orderStats.value = { pending: 45, paid: 120, cancelled: 7, refund: 3 }
    response = empty
    await profile.loadOrderStats()
    assert.deepEqual(profile.orderStats.value, { pending: 0, paid: 0, cancelled: 0, refund: 0 })
  }
  assert.equal(calls, 3)
})

test('个人中心旧账号统计响应不能覆盖后来账号的统计', async () => {
  let finish
  const profile = createProfileStats(() => new Promise(resolve => { finish = resolve }))
  const loading = profile.loadOrderStats()
  beginSession('fixture-B')
  const current = { pending: 2, paid: 3, cancelled: 0, refund: 1 }
  profile.orderStats.value = current
  finish({ pending: 99, paid: 88, cancelled: 77, refund: 66 })
  await loading
  assert.deepEqual(profile.orderStats.value, current)
})

test('处方订单主查询失败后按处方ID请求一条订单，匹配数字和字符串ID并忽略无关订单', async () => {
  const primaryIds = [], fallbackParams = [], applied = []
  let response = { id: 42, prescriptionId: 321, orderStatus: 2, orderNo: 'fixture-order', logisticsNo: 'fixture-logistics' }
  const definition = loadOptions('pages/prescription/detail.vue', {
    getSessionGeneration, isCurrentSession, getImageUrl: value => value,
    AI_DOCTOR: { name: 'fixture doctor' },
    getOrderByPrescriptionId: async id => { primaryIds.push(id); throw new Error('fixture primary failure') },
    getOrderPage: async params => { fallbackParams.push(params); return { rows: [response] } },
    console: { log() {}, error() {} }
  })
  const prescription = { ...definition.data(), ...definition.methods }
  prescription.pageOptions.prescriptionId = '321'
  const apply = prescription.updateDetailFromOrder
  prescription.updateDetailFromOrder = order => { applied.push(order); apply.call(prescription, order) }
  await prescription.loadOrderStatus()
  assert.deepEqual(primaryIds, ['321'])
  assert.deepEqual(fallbackParams, [{ prescriptionId: '321', pageNum: 1, pageSize: 1 }])
  assert.equal(prescription.orderStatus.order.id, 42)
  assert.equal(prescription.orderStatus.status, 2)
  assert.equal(prescription.orderStatus.logisticsNo, 'fixture-logistics')
  assert.equal(applied.length, 1)

  response = { id: 99, prescriptionId: 999, orderStatus: 3 }
  await prescription.loadOrderStatus()
  assert.equal(prescription.orderStatus.order, null, '不沿用上次加载的订单状态')
  assert.equal(applied.length, 1)
})
