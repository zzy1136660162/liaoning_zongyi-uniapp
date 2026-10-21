import { beforeEach } from 'node:test'
import * as realCart from '../utils/cart.js'

export * from '../utils/cart.js'

const clone = value => structuredClone(value)
const rows = new Map(), catalog = new Map()
let nextId = 700
const requests = []
const keyOf = item => `${item.productId ?? item.id}:${item.skuId ?? ''}`

export const registerCartProduct = product => {
  if (product && typeof product === 'object' && product.skuId) catalog.set(keyOf(product), clone(product))
}

const dto = (item, previous = {}) => ({
  id: previous.id ?? nextId++, cartVersion: previous.cartVersion ?? 0,
  productId: Number(item.productId ?? item.id), skuId: item.skuId == null ? null : Number(item.skuId),
  productName: item.productName || item.name || '测试商品', price: item.price ?? 10,
  skuCode: item.skuCode, skuName: item.skuName, skuSpecText: item.skuSpecText ?? item.specText,
  unit: item.unit, coverImage: item.coverImage ?? item.image,
  stock: item.stock === undefined ? 100 : item.stock,
  available: item.available !== false && item.stock !== 0,
  goodsMerchantType: item.goodsMerchantType ?? 1, productCategory: item.productCategory ?? 2,
  isPrescription: item.isPrescription ?? 0,
  needQuestionnaire: item.needQuestionnaire ?? 0, questionnaireId: item.questionnaireId ?? null,
  answerId: item.answerId ?? null, inventoryMode: item.inventoryMode,
  inventoryStatus: item.inventoryStatus, inventoryReason: item.inventoryReason,
  inventoryCheckedAt: item.inventoryCheckedAt,
  quantity: item.quantity ?? 1, checked: item.selected === false || item.available === false || item.stock === 0 ? 0 : 1,
  updatedAt: item.updatedAt || '2026-10-21T00:00:00'
})

export const cartApiFixture = {
  requests,
  onRequest: null,
  seed(entries = {}) {
    rows.clear(); catalog.clear()
    for (const entry of Object.values(entries)) {
      registerCartProduct(entry)
      const row = dto(entry, { id: entry.serverCartItemId, cartVersion: entry.serverCartVersion })
      rows.set(keyOf(row), row)
    }
  },
  get rows() { return clone([...rows.values()]) },
  failNext: null
}

export const installCartApi = () => {
  const target = globalThis.uni || (globalThis.uni = {})
  target.showLoading ||= () => {}
  target.hideLoading ||= () => {}
  target.showToast ||= () => {}
  target.$emit ||= () => {}
  if (!target.getStorageSync?.cartFixture) {
    const read = target.getStorageSync || (() => undefined)
    const wrapped = key => key === 'user_token' ? (read(key) || 'fixture-token') : read(key)
    wrapped.cartFixture = true
    target.getStorageSync = wrapped
  }
  target.request = options => {
    const parsed = new URL(options.url)
    const path = parsed.pathname.replace(/^.*(?=\/api\/cart)/, '')
    requests.push({ method: options.method, path, data: clone(options.data), query: parsed.search })
    const execute = () => {
      if (cartApiFixture.failNext) {
        const failure = cartApiFixture.failNext
        cartApiFixture.failNext = null
        options.fail(failure)
        return
      }
      try {
        let result
        const input = options.data || {}
        if (options.method === 'GET' && path === '/api/cart') result = [...rows.values()]
        else if (options.method === 'POST' && path === '/api/cart/purchased-cleanup') {
          for (const item of input.items || []) for (const [key, row] of rows) {
            if (String(row.id) === String(item.id) && String(row.cartVersion) === String(item.cartVersion)) rows.delete(key)
          }
        } else if (['POST', 'PUT'].includes(options.method) && path.startsWith('/api/cart/items')) {
          const productId = input.productId ?? path.split('/').at(-1)
          const key = `${productId}:${input.skuId}`
          const previous = rows.get(key)
          const product = catalog.get(key) || previous
          if (!product) throw new Error('测试商品未注册')
          const quantity = input.quantity ?? previous?.quantity
          if (quantity < 1 || (input.quantity != null && product.stock != null && quantity > product.stock) ||
              ((input.quantity != null || input.checked === 1) && product.available === false)) throw new Error('商品库存不足或不可售')
          const row = dto({ ...previous, ...product, productId, skuId: input.skuId, quantity }, previous || {})
          row.cartVersion = previous ? Number(previous.cartVersion) + 1 : 0
          row.checked = input.checked ?? previous?.checked ?? 1
          if (previous && Number(previous.questionnaireId) !== Number(row.questionnaireId)) row.answerId = null
          if (input.questionnaireId != null && Number(input.questionnaireId) === Number(row.questionnaireId)) row.answerId = input.answerId ?? row.answerId
          if (row.needQuestionnaire !== 1) row.answerId = null
          if (row.available === false || row.stock === 0) row.checked = 0
          rows.set(key, row)
          result = row
        } else if (options.method === 'DELETE') {
          if (path === '/api/cart/items') {
            const keys = parsed.searchParams.get('itemKeys')?.split(',')
            if (keys?.length) keys.forEach(key => rows.delete(key))
            else rows.clear()
          } else {
            const productId = path.split('/').at(-1), skuId = parsed.searchParams.get('skuId')
            for (const [key, row] of rows) if (String(row.productId) === productId && (!skuId || String(row.skuId) === skuId)) rows.delete(key)
          }
        } else throw new Error(`未模拟的请求 ${options.method} ${path}`)
        options.success({ statusCode: 200, data: { code: 200, data: clone(result) } })
      } catch (error) {
        options.success({ statusCode: 200, data: { code: 400, message: error.message } })
      }
    }
    if (cartApiFixture.onRequest) cartApiFixture.onRequest(options, execute)
    else queueMicrotask(execute)
  }
  return cartApiFixture
}

export const replaceCartData = entries => {
  installCartApi()
  cartApiFixture.seed(entries)
  realCart.replaceCartData(Object.fromEntries(Object.entries(entries).map(([key, entry]) => {
    const server = rows.get(keyOf(entry))
    return [key, { ...entry, serverCartItemId: entry.serverCartItemId ?? server?.id,
      serverCartVersion: entry.serverCartVersion ?? server?.cartVersion }]
  })))
}

export const addCartItem = (product, quantity, options) => {
  installCartApi()
  registerCartProduct(product)
  return realCart.addCartItem(product, quantity, options)
}

beforeEach(() => {
  cartApiFixture.onRequest = null
  cartApiFixture.failNext = null
  nextId = 700
  requests.length = 0
  replaceCartData({})
})
