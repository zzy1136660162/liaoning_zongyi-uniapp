import assert from 'node:assert/strict'
import { beforeEach, afterEach, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { loadOptions } from './sfc-harness.mjs'
import { beginSession, endSession, getSessionGeneration, isCurrentSession, onSessionChanged } from '../utils/session.js'
import { get } from '../utils/request.js'
import { getRefundStageText } from '../utils/refund.js'

const values = new Map()
let lists, requests, modals, toasts, subscriptions
globalThis.uni = {
  getStorageSync: key => values.get(key), setStorageSync: (key, value) => values.set(key, value),
  removeStorageSync: key => values.delete(key), request: options => requests.push(options),
  showLoading() {}, hideLoading() {}, $emit() {},
  showModal: options => modals.push(options), showToast: options => toasts.push(options)
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
const row = (id, status = 0) => ({ id, status, orderNo: `fixture-${id}`, refundAmount: 2 })
const page = (rows, pageNum = 1, hasMore = false, total = rows.length) => ({ rows, pageNum, pageSize: 20, hasMore, total })
const createList = (tab = 'all') => {
  const pageCalls = [], statsCalls = [], cancelCalls = []
  const definition = loadOptions('pages/order/refund_list.vue', {
    getSessionGeneration, isCurrentSession, getRefundStageText,
    onSessionChanged: callback => {
      subscriptions++
      const unsubscribe = onSessionChanged(callback)
      return () => { subscriptions--; unsubscribe() }
    },
    getRefundPage: params => new Promise((resolve, reject) => pageCalls.push({ params, resolve, reject })),
    getRefundStats: () => new Promise((resolve, reject) => statsCalls.push({ resolve, reject })),
    cancelRefund: id => new Promise((resolve, reject) => cancelCalls.push({ id, resolve, reject })),
    logPageView() {}, logButtonClick() {}
  })
  const state = { ...definition.data(), ...definition.methods, activeTab: tab }
  const list = { state, pageCalls, statsCalls, cancelCalls,
    show: () => definition.onShow.call(state), unload: () => definition.onUnload.call(state) }
  lists.push(list)
  definition.onLoad.call(state)
  return list
}
const counts = state => Object.fromEntries(state.tabs.map(tab => [tab.key, tab.count]))
beforeEach(() => {
  values.clear(); lists = []; requests = []; modals = []; toasts = []; subscriptions = 0
  beginSession('fixture-A')
})
afterEach(() => {
  lists.forEach(list => list.unload())
  assert.equal(subscriptions, 0)
  endSession()
})

test('仅onShow加载首次和回页数据，统计来自全量接口而不是当前页', async () => {
  const { state, pageCalls, statsCalls, show } = createList()
  assert.equal(pageCalls.length, 0); assert.equal(statsCalls.length, 0)
  show()
  assert.equal(pageCalls.length, 1); assert.equal(statsCalls.length, 1)
  assert.deepEqual(pageCalls[0].params, { tab: 'all', pageNum: 1, pageSize: 20 })
  assert.equal(state.loading, true); assert.equal(state.hasLoaded, false)
  statsCalls[0].resolve({ all: 105, pending: 42, processing: 13, completed: 37 })
  pageCalls[0].resolve(page([row(1)], 1, true, 105)); await flush()
  assert.equal(state.total, 105)
  assert.deepEqual(counts(state), { all: 105, pending: 42, processing: 13, completed: 37 })
  show()
  assert.equal(pageCalls.length, 2); assert.equal(statsCalls.length, 2)
  pageCalls[1].resolve(page([])); statsCalls[1].resolve(null); await flush()
  assert.deepEqual(counts(state), { all: 0, pending: 0, processing: 0, completed: 0 })
  assert.equal(state.hasLoaded, true); assert.deepEqual(state.refundList, [])
})

test('触底按页追加去重，重复触底只请求一次，到末页停止且不改全量徽标', async () => {
  const { state, pageCalls, statsCalls, show } = createList()
  show(); pageCalls[0].resolve(page([row(1), row(2)], 1, true, 3)); statsCalls[0].resolve({ all: 3, pending: 3 }); await flush()
  const loading = state.loadMoreRefunds()
  state.loadMoreRefunds()
  assert.equal(pageCalls.length, 2)
  assert.deepEqual(pageCalls[1].params, { tab: 'all', pageNum: 2, pageSize: 20 })
  pageCalls[1].resolve(page([row(2), row(3)], 2)); await loading
  assert.deepEqual(state.refundList.map(item => item.id), [1, 2, 3])
  assert.equal(state.pageNum, 2); assert.equal(state.hasMore, false)
  state.loadMoreRefunds()
  assert.equal(pageCalls.length, 2); assert.equal(statsCalls.length, 1)
  assert.equal(counts(state).all, 3)
})

test('分类由服务端筛选并重置页码，旧分类成功和失败不会覆盖新分类', async () => {
  const { state, pageCalls, statsCalls, show } = createList()
  show()
  const pending = state.switchTab('pending')
  const completed = state.switchTab('completed')
  assert.deepEqual(pageCalls.slice(1).map(call => call.params), [
    { tab: 'pending', pageNum: 1, pageSize: 20 }, { tab: 'completed', pageNum: 1, pageSize: 20 }
  ])
  pageCalls[1].resolve(page([row('stale')])); await pending
  assert.deepEqual(state.refundList, []); assert.equal(state.loading, true)
  pageCalls[2].resolve(page([row('current', 4)])); await completed
  pageCalls[0].reject(new Error('old request failed')); statsCalls[0].resolve({ all: 10, completed: 6 }); await flush()
  assert.deepEqual(state.refundList.map(item => item.id), ['current'])
  assert.equal(state.loadError, ''); assert.equal(counts(state).completed, 6)
  state.switchTab('completed'); state.switchTab('unknown')
  assert.equal(pageCalls.length, 3)
})

test('下一页失败保留已有记录，重试原页；第一页失败也能重新请求', async () => {
  const { state, pageCalls, statsCalls, show } = createList()
  show(); pageCalls[0].resolve(page([row(1)], 1, true, 2)); statsCalls[0].resolve({}); await flush()
  const next = state.loadMoreRefunds()
  pageCalls[1].reject(new Error('网络失败')); await next
  assert.equal(state.pageNum, 1); assert.deepEqual(state.refundList.map(item => item.id), [1])
  assert.equal(state.loadError, '网络失败')
  state.loadMoreRefunds(); assert.equal(pageCalls.length, 2)
  const retry = state.retryRefunds()
  assert.equal(pageCalls[2].params.pageNum, 2)
  pageCalls[2].resolve(page([row(2)], 2)); await retry
  assert.deepEqual(state.refundList.map(item => item.id), [1, 2])
  const reset = state.loadRefundList()
  pageCalls[3].reject(new Error('首次失败')); await reset
  assert.equal(state.hasLoaded, false)
  const retryFirst = state.retryRefunds()
  assert.equal(pageCalls[4].params.pageNum, 1)
  pageCalls[4].resolve(page([])); await retryFirst
  assert.equal(state.loadError, '')
})

test('统计失败不阻断列表，统计可单独重试，旧统计不能覆盖新统计', async () => {
  const { state, pageCalls, statsCalls, show } = createList()
  show(); pageCalls[0].resolve(page([row(1)])); statsCalls[0].reject(new Error('stats failed')); await flush()
  assert.equal(state.refundList.length, 1); assert.equal(state.statsError, true)
  const firstRetry = state.loadRefundStats()
  const latestRetry = state.loadRefundStats()
  statsCalls[2].resolve({ all: 99, pending: '30' }); await latestRetry
  statsCalls[1].resolve({ all: 1 }); await firstRetry
  assert.equal(state.statsError, false)
  assert.deepEqual(counts(state), { all: 99, pending: 30, processing: 0, completed: 0 })
  assert.equal(pageCalls.length, 1)
})

test('刷新重置分页，旧追加和旧统计不会覆盖最新刷新', async () => {
  const { state, pageCalls, statsCalls, show } = createList()
  show(); pageCalls[0].resolve(page([row('old')], 1, true, 2)); await flush()
  const append = state.loadMoreRefunds()
  const refresh = state.refreshRefunds()
  assert.equal(pageCalls[2].params.pageNum, 1)
  assert.equal(state.refreshing, true)
  pageCalls[1].resolve(page([row('old-page-2')], 2)); await append
  assert.equal(state.loading, true)
  statsCalls[0].resolve({ all: 123 }); pageCalls[2].resolve(page([row('new')])); statsCalls[1].resolve({ all: 1 }); await refresh
  assert.deepEqual(state.refundList.map(item => item.id), ['new'])
  assert.equal(counts(state).all, 1); assert.equal(state.pageNum, 1); assert.equal(state.refreshing, false)
})

test('账号切换清空列表与徽标，旧账号列表和统计迟到不覆盖当前账号', async () => {
  const { state, pageCalls, statsCalls, show } = createList()
  show(); pageCalls[0].resolve(page([row('A')], 1, true, 2)); statsCalls[0].resolve({ all: 2 }); await flush()
  const append = state.loadMoreRefunds()
  const stats = state.loadRefundStats()
  beginSession('fixture-B')
  assert.deepEqual(state.refundList, [])
  assert.deepEqual(counts(state), { all: 0, pending: 0, processing: 0, completed: 0 })
  assert.equal(state.loading, false); assert.equal(state.pageNum, 0)
  show()
  pageCalls[2].resolve(page([row('B')])); statsCalls[2].resolve({ all: 1, completed: 1 }); await flush()
  pageCalls[1].resolve(page([row('old-A')], 2)); statsCalls[1].resolve({ all: 88 }); await Promise.all([append, stats])
  assert.deepEqual(state.refundList.map(item => item.id), ['B'])
  assert.equal(counts(state).all, 1)
})

test('取消成功刷新当前分类第一页和全量统计，等待中重复点击不重复取消', async () => {
  const { state, pageCalls, statsCalls, cancelCalls, show } = createList('pending')
  show(); pageCalls[0].resolve(page([row(1)], 1, false, 1)); statsCalls[0].resolve({ all: 20, pending: 1 }); await flush()
  const cancel = state.cancelRefund(1)
  state.cancelRefund(1)
  assert.equal(modals.length, 1)
  modals[0].success({ confirm: true }); await flush()
  assert.deepEqual(cancelCalls.map(call => call.id), [1])
  cancelCalls[0].resolve(); await flush()
  assert.deepEqual(pageCalls[1].params, { tab: 'pending', pageNum: 1, pageSize: 20 })
  assert.equal(statsCalls.length, 2)
  pageCalls[1].resolve(page([])); statsCalls[1].resolve({ all: 20, pending: 0 }); await cancel
  assert.equal(counts(state).all, 20); assert.equal(counts(state).pending, 0)
  assert.deepEqual(state.refundList, []); assert.equal(state.cancellingRefundId, null)
  assert.equal(toasts.at(-1).title, '取消成功')
})

test('旧账号取消弹窗不发请求，旧取消结果不刷新新账号，卸载释放订阅', async () => {
  const { state, pageCalls, statsCalls, cancelCalls, show, unload } = createList()
  show(); pageCalls[0].resolve(page([row(1)])); statsCalls[0].resolve({ all: 1 }); await flush()
  const beforeConfirm = state.cancelRefund(1)
  beginSession('fixture-B'); modals[0].success({ confirm: true }); await beforeConfirm
  assert.equal(cancelCalls.length, 0)
  const beforeResponse = state.cancelRefund(1)
  modals[1].success({ confirm: true }); await flush()
  beginSession('fixture-C'); cancelCalls[0].resolve(); await beforeResponse
  assert.equal(pageCalls.length, 1); assert.equal(statsCalls.length, 1)
  assert.equal(toasts.length, 0)
  show()
  unload()
  assert.equal(subscriptions, 0)
  pageCalls[1].resolve(page([row('late')])); statsCalls[1].resolve({ all: 98 }); await flush()
  assert.deepEqual(state.refundList, []); assert.equal(counts(state).all, 0)
  state.refreshRefunds(); state.loadMoreRefunds(); state.retryRefunds()
  assert.equal(pageCalls.length, 2)
})

test('退款API保留顶层分页元信息、数组兼容wrapper和独立统计响应', async () => {
  const source = readFileSync(new URL('../api/refund.js', import.meta.url), 'utf8')
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace(/^export /gm, '')
  const api = Function('get', `${source}\nreturn { getRefundPage, getRefundList, getRefundStats }`)(get)
  const paged = api.getRefundPage({ tab: 'pending', pageNum: 2, pageSize: 20 })
  const pagedCall = requests.shift()
  assert.ok(pagedCall.url.endsWith('/api/refund/list'))
  assert.deepEqual(pagedCall.data, { tab: 'pending', pageNum: 2, pageSize: 20 })
  pagedCall.success({ statusCode: 200, data: { code: 200, data: [row(7)], total: 81, pageNum: 2, pageSize: 20, hasMore: true } })
  assert.deepEqual(await paged, { rows: [row(7)], total: 81, pageNum: 2, pageSize: 20, hasMore: true })
  requests = []
  const compatible = api.getRefundList()
  requests.shift().success({ statusCode: 200, data: { code: 200, data: [row(8)], total: 2 } })
  assert.deepEqual(await compatible, [row(8)])
  requests = []
  const stats = api.getRefundStats()
  const statsCall = requests.shift()
  assert.ok(statsCall.url.endsWith('/api/refund/stats'))
  statsCall.success({ statusCode: 200, data: { code: 200, data: { all: 81, pending: 19, processing: 5, completed: 40 } } })
  assert.deepEqual(await stats, { all: 81, pending: 19, processing: 5, completed: 40 })
})

test('页面连接触底、刷新和失败重试，空态只在当前请求成功后出现', () => {
  const source = readFileSync(new URL('../pages/order/refund_list.vue', import.meta.url), 'utf8')
  assert.match(source, /@scrolltolower="loadMoreRefunds"/)
  assert.match(source, /@refresherrefresh="refreshRefunds"/)
  assert.match(source, /@tap="retryRefunds"/)
  assert.match(source, /@tap="loadRefundStats"/)
  assert.match(source, /hasLoaded && !loading && !loadError && refundList.length === 0/)
  assert.doesNotMatch(source, /filteredList|updateTabCounts|getRefundList/)
})
