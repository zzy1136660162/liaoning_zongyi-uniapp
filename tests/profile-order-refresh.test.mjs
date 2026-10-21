import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadSetup } from './sfc-harness.mjs'

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
const createProfile = () => {
  const requests = [], routes = [], hooks = {}
  let generation = 1
  const state = loadSetup('pages/user/profile.vue', {
    ref: value => ({ value }),
    onShow: fn => { hooks.show = fn },
    onUnload: fn => { hooks.unload = fn },
    getSessionGeneration: () => generation, isCurrentSession: value => value === generation,
    getOrderStats: options => {
      assert.deepEqual(options, { silent: true })
      return new Promise((resolve, reject) => requests.push({ resolve, reject }))
    },
    fetchAccountProfile: async () => ({ id: 7, userName: '测试用户', phone: '13800138000', idType: '护照', idCardNo: 'P12345678' }),
    uni: { showLoading() {}, hideLoading() {}, navigateTo: value => routes.push(value.url) },
    console: { error() {} }
  }, ['goToOrderListByStatus', 'orderStats', 'loadOrderStats'])
  return { state, requests, routes, hooks, changeSession: () => { generation++ } }
}

test('个人中心已支付和已取消使用独立筛选，退款继续进入退款列表', () => {
  const { state, routes } = createProfile()
  for (const status of [0, 1, 4, 'refund']) state.goToOrderListByStatus(status)
  assert.deepEqual(routes, ['/pages/order/order_list?status=pending', '/pages/order/order_list?status=paid',
    '/pages/order/order_list?status=cancelled', '/pages/order/refund_list'])
})

test('个人中心首次显示只加载一次统计，每次返回都刷新支付和取消后的数字', async () => {
  const { state, requests, hooks } = createProfile()
  hooks.show(); await flush()
  assert.equal(requests.length, 1)
  requests[0].resolve({ pending: 2, paid: 0, cancelled: 0, refund: 0 }); await flush()
  hooks.show()
  assert.equal(requests.length, 2)
  requests[1].resolve({ pending: 0, paid: 1, cancelled: 1, refund: 0 }); await flush()
  assert.deepEqual(state.orderStats.value, { pending: 0, paid: 1, cancelled: 1, refund: 0 })
})

test('个人中心同账号晚到的旧成功和失败均不覆盖最新统计，最新失败保留上次成功值', async () => {
  for (const rejectOld of [false, true]) {
    const { state, requests, hooks } = createProfile()
    hooks.show(); hooks.show()
    requests[1].resolve({ paid: 5 }); await flush()
    if (rejectOld) requests[0].reject(new Error('old failure'))
    else requests[0].resolve({ paid: 99 })
    await flush()
    assert.equal(state.orderStats.value.paid, 5)
    hooks.show(); requests[2].reject(new Error('latest failure')); await flush()
    assert.equal(state.orderStats.value.paid, 5)
  }
})

test('个人中心卸载或切换账号后，旧统计请求不再回写', async () => {
  for (const invalidate of ['unload', 'session']) {
    const { state, requests, hooks, changeSession } = createProfile()
    hooks.show()
    if (invalidate === 'unload') hooks.unload()
    else changeSession()
    requests[0].resolve({ paid: 99 }); await flush()
    assert.equal(state.orderStats.value.paid, 0)
    if (invalidate === 'unload') {
      await state.loadOrderStats()
      assert.equal(requests.length, 1)
    }
  }
})
