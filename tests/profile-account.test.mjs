import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadSetup } from './sfc-harness.mjs'

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
const profile = (id = 7, userName = '测试用户') => ({
  id, userName, phone: '13800138000', idType: '护照', idCardNo: `P1234567${id}`
})
const displayed = data => ({ realName: data.userName, phone: data.phone, idType: data.idType, idNumber: data.idCardNo })
const empty = { realName: '', phone: '', idType: '', idNumber: '' }

function createProfile(initialToken = 'fixture-token') {
  const requests = [], hooks = {}, storageCalls = [], routes = [], modals = []
  let generation = 1, statsCalls = 0, token = initialToken
  const state = loadSetup('pages/user/profile.vue', {
    ref: value => ({ value }),
    getSessionToken: () => token,
    getSessionGeneration: () => generation, isCurrentSession: value => value === generation,
    onShow: callback => { hooks.show = callback }, onUnload: callback => { hooks.unload = callback },
    fetchAccountProfile: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
    getOrderStats: async () => { statsCalls++; return { paid: 0 } },
    console: { error() {} },
    uni: {
      navigateTo: options => routes.push(options.url),
      showModal: options => modals.push(options),
      getStorageSync: key => { storageCalls.push(['get', key]); throw new Error('资料页不应读取本地资料') },
      setStorageSync: key => { storageCalls.push(['set', key]); throw new Error('资料页不应保存本地资料') }
    }
  }, ['userInfo', 'isLoggedIn', 'profileLoading', 'profileError', 'loadUserProfile', 'orderStats', 'goToLogin', 'handleAuthAction'])
  return { state, requests, hooks, storageCalls, routes, modals, getStatsCalls: () => statsCalls,
    changeSession: (nextToken = token) => { generation++; token = nextToken } }
}

test('未登录点击资料栏或设置入口直接去登录，携带返回个人中心的地址且不弹退出确认', () => {
  const { state, routes, modals } = createProfile('')
  state.goToLogin()
  state.handleAuthAction()
  assert.equal(routes.length, 2)
  for (const route of routes) {
    const url = new URL(route, 'https://test.invalid')
    assert.equal(url.pathname, '/pages/register/register')
    assert.equal(url.searchParams.get('redirect'), '/pages/user/profile')
  }
  assert.deepEqual(modals, [])
})

test('已登录资料栏不跳登录，设置入口仍弹退出确认，并按点击时的实际登录状态分流', () => {
  const { state, routes, modals, changeSession } = createProfile()
  state.goToLogin()
  state.handleAuthAction()
  assert.deepEqual(routes, [])
  assert.equal(modals.length, 1)
  assert.equal(modals[0].content, '确定要退出登录吗？')

  changeSession('')
  state.handleAuthAction()
  assert.equal(routes.length, 1)
  assert.equal(modals.length, 1)
})

test('未登录进入个人中心直接显示游客状态，不请求资料和订单统计', async () => {
  const { state, hooks, requests, getStatsCalls } = createProfile('')
  hooks.show(); await flush()
  assert.equal(state.isLoggedIn.value, false)
  assert.deepEqual(state.userInfo.value, empty)
  assert.equal(state.profileLoading.value, false)
  assert.equal(state.profileError.value, '')
  assert.equal(requests.length, 0)
  assert.equal(getStatsCalls(), 0)
  assert.deepEqual(state.orderStats.value, { pending: 0, paid: 0, cancelled: 0, refund: 0 })
})

test('退出后返回个人中心清空资料和角标，旧回包不覆盖游客状态，重新登录可刷新姓名', async () => {
  const { state, hooks, requests, changeSession, getStatsCalls } = createProfile()
  hooks.show()
  requests[0].resolve(profile()); await flush()
  state.orderStats.value = { pending: 2, paid: 3, cancelled: 1, refund: 1 }
  hooks.show()
  changeSession('')
  hooks.show()
  requests[1].resolve(profile(7, '旧账号姓名')); await flush()
  assert.equal(state.isLoggedIn.value, false)
  assert.deepEqual(state.userInfo.value, empty)
  assert.equal(state.profileLoading.value, false)
  assert.equal(state.profileError.value, '')
  assert.equal(requests.length, 2)
  assert.equal(getStatsCalls(), 2)
  assert.deepEqual(state.orderStats.value, { pending: 0, paid: 0, cancelled: 0, refund: 0 })

  changeSession('fixture-new-token')
  hooks.show()
  requests[2].resolve(profile(8, '新账号姓名')); await flush()
  assert.equal(state.isLoggedIn.value, true)
  assert.deepEqual(state.userInfo.value, displayed(profile(8, '新账号姓名')))
  assert.equal(state.profileError.value, '')
  assert.equal(getStatsCalls(), 3)
})

test('个人中心每次显示重新请求资料，等待期间清空旧显示，订单统计独立刷新', async () => {
  const { state, hooks, requests, storageCalls, getStatsCalls } = createProfile()
  hooks.show()
  assert.equal(requests.length, 1)
  assert.equal(state.profileLoading.value, true)
  assert.deepEqual(state.userInfo.value, empty)
  requests[0].resolve(profile()); await flush()
  assert.deepEqual(state.userInfo.value, displayed(profile()))
  assert.equal(state.profileLoading.value, false)

  hooks.show()
  assert.equal(requests.length, 2)
  assert.equal(state.profileLoading.value, true)
  assert.deepEqual(state.userInfo.value, empty)
  requests[1].resolve(profile(8, '接口更新姓名')); await flush()
  assert.deepEqual(state.userInfo.value, displayed(profile(8, '接口更新姓名')))
  assert.equal(state.profileError.value, '')
  assert.equal(getStatsCalls(), 2)
  assert.deepEqual(storageCalls, [])
})

test('资料加载失败不显示旧资料或注册草稿，点击重试对应的方法可恢复接口资料', async () => {
  const { state, requests, storageCalls } = createProfile()
  const initial = state.loadUserProfile()
  requests[0].resolve(profile()); await initial
  assert.deepEqual(state.userInfo.value, displayed(profile()))

  const failed = state.loadUserProfile()
  assert.deepEqual(state.userInfo.value, empty)
  requests[1].reject(new Error('request:fail timeout')); await failed
  assert.deepEqual(state.userInfo.value, empty)
  assert.equal(state.profileError.value, '个人资料加载失败，请重试')
  assert.equal(state.profileLoading.value, false)

  const retry = state.loadUserProfile()
  assert.equal(state.profileError.value, '')
  assert.equal(state.profileLoading.value, true)
  requests[2].resolve(profile(8)); await retry
  assert.deepEqual(state.userInfo.value, displayed(profile(8)))
  assert.equal(state.profileError.value, '')
  assert.equal(state.profileLoading.value, false)
  assert.deepEqual(storageCalls, [])
})

test('同账号旧请求的成功、失败和结束动作不覆盖新资料或提前结束新加载', async () => {
  for (const rejectOld of [false, true]) {
    const { state, requests } = createProfile()
    const first = state.loadUserProfile(), second = state.loadUserProfile()
    if (rejectOld) requests[0].reject(new Error('旧请求失败'))
    else requests[0].resolve(profile(7, '旧请求姓名'))
    await first
    assert.deepEqual(state.userInfo.value, empty)
    assert.equal(state.profileLoading.value, true)
    assert.equal(state.profileError.value, '')
    requests[1].resolve(profile(8)); await second
    assert.deepEqual(state.userInfo.value, displayed(profile(8)))

    const old = state.loadUserProfile(), latest = state.loadUserProfile()
    requests[3].resolve(profile(9)); await latest
    if (rejectOld) requests[2].reject(new Error('更晚返回的旧失败'))
    else requests[2].resolve(profile(7, '更晚返回的旧姓名'))
    await old
    assert.deepEqual(state.userInfo.value, displayed(profile(9)))
    assert.equal(state.profileLoading.value, false)
    assert.equal(state.profileError.value, '')
  }
})

test('切换账号或卸载后旧资料请求失效，新账号资料和错误状态不受影响', async () => {
  for (const rejectOld of [false, true]) {
    const current = createProfile()
    const old = current.state.loadUserProfile()
    current.changeSession()
    const next = current.state.loadUserProfile()
    current.requests[1].resolve(profile(8)); await next
    if (rejectOld) current.requests[0].reject(new Error('旧账号失败'))
    else current.requests[0].resolve(profile(7, '旧账号姓名'))
    await old
    assert.deepEqual(current.state.userInfo.value, displayed(profile(8)))
    assert.equal(current.state.profileError.value, '')
    assert.equal(current.state.profileLoading.value, false)

    const unloaded = createProfile()
    const pending = unloaded.state.loadUserProfile()
    unloaded.hooks.unload()
    if (rejectOld) unloaded.requests[0].reject(new Error('卸载后失败'))
    else unloaded.requests[0].resolve(profile())
    await pending
    assert.deepEqual(unloaded.state.userInfo.value, empty)
    assert.equal(unloaded.state.profileError.value, '')
    await unloaded.state.loadUserProfile()
    assert.equal(unloaded.requests.length, 1)
  }
})
