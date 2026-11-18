import assert from 'node:assert/strict'
import test from 'node:test'
import { loadSetup } from './sfc-harness.mjs'
import { isTraditionalTherapyProduct } from '../utils/therapy.js'

const reactive = {
  ref: value => ({ value }),
  computed: getter => ({ get value() { return getter() } }),
  onMounted() {}, onUnmounted() {}
}

for (const detail of ['medicine_detail', 'therapy_detail']) {
  test(`${detail} 收藏等服务端确认、阻止重复点击，取消失败保留已收藏`, async () => {
    const writes = []
    const messages = []
    let finish
    const page = loadSetup(`pages/products/${detail}.vue`, {
      ...reactive,
      uni: { showToast: ({ title }) => messages.push(title) },
      getSessionGeneration: () => 1, isCurrentSession: value => value === 1,
      setProductCollected: (id, desired) => {
        writes.push([id, desired])
        if (!desired) throw Error('网络中断')
        return new Promise(resolve => { finish = resolve })
      }
    }, ['product', 'toggleCollect', 'waitForFavorite'])
    page.product.value = { id: 19, collected: false }
    page.toggleCollect()
    page.toggleCollect()
    await Promise.resolve()
    assert.deepEqual(writes, [[19, true]])
    assert.equal(page.product.value.collected, false)
    finish()
    await page.waitForFavorite()
    assert.equal(page.product.value.collected, true)
    page.toggleCollect()
    await page.waitForFavorite()
    assert.equal(page.product.value.collected, true)
    assert.deepEqual(messages, ['已加入我的收藏', '网络中断'])
  })
}

test('收藏列表链接到对应详情，取消最后一件后返回有效页，换账号立即清空', async () => {
  const links = []
  const requests = []
  let changed
  const list = loadSetup('pages/favorites/index.vue', {
    ...reactive, isTraditionalTherapyProduct,
    onSessionChanged: callback => { changed = callback; return () => {} },
    uni: { navigateTo: ({ url }) => links.push(url), pageScrollTo() {} },
    getFavoriteProducts: async pageNum => {
      requests.push(pageNum)
      return { total: 1, records: pageNum === 1 ? [{ id: 5, productCategory: 3 }] : [] }
    }
  }, ['items', 'loadPage', 'openProduct', 'error'])
  await list.loadPage(2)
  assert.deepEqual(requests, [2, 1])
  list.openProduct(list.items.value[0])
  list.openProduct({ id: 6, productCategory: 2 })
  assert.deepEqual(links, ['/pages/products/therapy_detail?id=5', '/pages/products/medicine_detail?id=6'])
  changed()
  assert.deepEqual(list.items.value, [])
  assert.match(list.error.value, /账号状态/)
})
