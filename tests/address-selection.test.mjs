import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import * as session from '../utils/session.js'
import { loadSetup } from './sfc-harness.mjs'

const values = new Map(), messages = [], navigations = []
const oldAddressKeys = new Set(['default_address_id', 'temp_selected_address', 'shipping_addresses'])
const quiet = { debug() {}, log() {}, warn() {}, error() {} }
let returns = 0
globalThis.uni = {
  getStorageSync(key) { assert.equal(oldAddressKeys.has(key), false, `不得读取地址缓存 ${key}`); return values.get(key) },
  setStorageSync(key, value) { assert.equal(oldAddressKeys.has(key), false, `不得写入地址缓存 ${key}`); values.set(key, value) },
  removeStorageSync: key => values.delete(key),
  showToast: message => messages.push(message), showLoading() {}, hideLoading() {}, $emit() {},
  navigateTo: options => navigations.push(options), navigateBack: () => { returns++ }
}
beforeEach(() => {
  values.clear(); messages.length = 0; navigations.length = 0; returns = 0
  session.beginSession('fixture-address-account')
})
const reactive = { ref: value => ({ value }), computed: get => ({ get value() { return get() } }) }
const addresses = () => [{ id: 1, isDefault: 1, addressDetail: '地址甲' }, { id: 2, isDefault: 0, addressDetail: '地址乙' }]

function checkout(read = async () => addresses()) {
  let unload
  const page = loadSetup('pages/order/confirm.vue', {
    ...session, ...reactive, console: quiet,
    getCurrentCheckoutProductIds: () => [], getAddressList: read,
    queryFreight: async () => ({ freight: 12, quoteExpiresAt: Date.now() + 900000 }),
    onUnload: callback => { unload = callback }
  }, ['loadAddresses', 'selectAddress', 'selectedAddress', 'selectedRequiresShipping', 'freightQuote', 'orderInfo'])
  page.selectedRequiresShipping.value = true
  page.orderInfo.value.items = [{ productId: 10, skuId: 11, quantity: 1 }]
  return { ...page, unload }
}

function addressPage(channel, read = async () => addresses(), setDefaultApi = async () => {}) {
  const page = loadSetup('pages/order/address_list.vue', {
    ...session, ...reactive, console: quiet, getAddressList: read, setDefaultApi,
    getCurrentInstance: () => ({ proxy: { getOpenerEventChannel: () => channel } })
  }, ['selectAddress', 'setDefaultAddress', 'loadAddresses', 'addresses', 'isSelectMode'])
  page.isSelectMode.value = true
  return page
}

function choose(page, id) {
  page.selectAddress()
  const route = navigations.at(-1)
  assert.equal(route.url, '/pages/order/address_list?select=true')
  addressPage({ emit: (name, value) => route.events[name](value) }).selectAddress({ id })
}

test('默认地址只取服务端，旧本地默认和临时选择均不参与，新订单重新初始化', async () => {
  values.set('default_address_id', 2); values.set('temp_selected_address', 2)
  let current = addresses()
  const first = checkout(async () => current)
  await first.loadAddresses()
  assert.equal(first.selectedAddress.value.id, 1)
  current = [{ id: 1, isDefault: 0 }, { id: 2, isDefault: '1' }]
  await first.loadAddresses()
  assert.equal(first.selectedAddress.value.id, 1, '刷新保留本次订单已展示的地址')
  const next = checkout(async () => current)
  await next.loadAddresses()
  assert.equal(next.selectedAddress.value.id, 2)
})

test('没有服务端默认地址时等待用户选择，不把列表第一条或字符串0当默认', async () => {
  const page = checkout(async () => [{ id: 1, isDefault: 0 }, { id: 2, isDefault: '0' }])
  await page.loadAddresses()
  assert.equal(page.selectedAddress.value, null)
  assert.equal(page.freightQuote.value.amount, null)
})

test('地址选择页仅通过自身事件通道返回ID，订单页重新查询最新内容', async () => {
  let detail = '初始内容', reads = 0
  const page = checkout(async () => { reads++; return [{ id: 1, isDefault: true }, { id: 2, addressDetail: detail }] })
  await page.loadAddresses()
  choose(page, '2')
  assert.equal(returns, 1)
  assert.equal(page.selectedAddress.value, null)
  detail = '服务端最新地址'
  await page.loadAddresses()
  assert.equal(page.selectedAddress.value.id, 2)
  assert.equal(page.selectedAddress.value.addressDetail, '服务端最新地址')
  assert.equal(reads, 2)
})

test('取消选择返回仍保留本次地址，不被变化后的默认地址覆盖', async () => {
  let current = addresses()
  const page = checkout(async () => current)
  await page.loadAddresses()
  page.selectAddress()
  current = [{ id: 1, isDefault: 0 }, { id: 2, isDefault: 1 }]
  await page.loadAddresses()
  assert.equal(page.selectedAddress.value.id, 1)
})

test('选择后接口失败不丢选中ID，重试仍恢复该地址而非默认地址', async () => {
  let fail = false
  const page = checkout(async () => { if (fail) throw new Error('fixture unavailable'); return addresses() })
  await page.loadAddresses()
  choose(page, 2)
  fail = true
  await page.loadAddresses()
  assert.equal(page.selectedAddress.value, null)
  assert.equal(page.freightQuote.value.amount, null)
  fail = false
  await page.loadAddresses()
  assert.equal(page.selectedAddress.value.id, 2)
})

test('已选地址删除后持续要求重选，保留的默认地址不能偷偷接替', async () => {
  let current = addresses()
  const page = checkout(async () => current)
  await page.loadAddresses()
  choose(page, 2)
  await page.loadAddresses()
  current = [{ id: 1, isDefault: 1 }]
  await page.loadAddresses(); await page.loadAddresses()
  assert.equal(page.selectedAddress.value, null)
  assert.equal(page.freightQuote.value.amount, null)
  assert.match(messages.at(-1).title, /重新选择/)
  choose(page, 1)
  await page.loadAddresses()
  assert.equal(page.selectedAddress.value.id, 1)
})

test('新选择使先前未完成的地址刷新失效，迟到结果不能恢复旧选择', async () => {
  let finish, reads = 0
  const page = checkout(() => ++reads === 1 ? new Promise(resolve => { finish = resolve }) : Promise.resolve(addresses()))
  const old = page.loadAddresses()
  choose(page, 2)
  await page.loadAddresses()
  finish([{ id: 1, isDefault: 1 }])
  await old
  assert.equal(page.selectedAddress.value.id, 2)
})

test('页面卸载或账号切换后，旧地址事件不能修改原页面选择', async () => {
  for (const close of [page => page.unload(), () => session.endSession()]) {
    session.beginSession('fixture-address-account')
    const page = checkout()
    await page.loadAddresses()
    page.selectAddress()
    const notify = navigations.at(-1).events.addressSelected
    close(page)
    notify(2)
    assert.equal(page.selectedAddress.value.id, 1)
  }
})

test('两个订单页面的选择分别绑定各自通道，不共享临时存储或全局事件', async () => {
  const first = checkout(), second = checkout()
  await first.loadAddresses(); await second.loadAddresses()
  choose(first, 2)
  await first.loadAddresses(); await second.loadAddresses()
  assert.equal(first.selectedAddress.value.id, 2)
  assert.equal(second.selectedAddress.value.id, 1)
})

test('管理页设置默认地址只调用后端并刷新，缺少选择通道时提示重新进入', async () => {
  let current = addresses(), saved
  const page = addressPage(null, async () => current, async id => {
    saved = id
    current = addresses().map(address => ({ ...address, isDefault: address.id === id ? 1 : 0 }))
  })
  await page.setDefaultAddress(2)
  assert.equal(saved, 2)
  assert.equal(page.addresses.value.find(address => address.id === 2).isDefault, 1)
  page.selectAddress({ id: 2 })
  assert.equal(returns, 0)
  assert.match(messages.at(-1).title, /订单页/)
})
