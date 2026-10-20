import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadCartProducts } from '../utils/cart-products.js'

const product = { id: 10, productName: '商品', goodsMerchantType: 1, productCategory: 2,
  status: 1, delSign: 0, available: true, stock: 10,
  skus: [{ id: 1, price: 12, status: 1, delSign: 0, stock: 5 }, { id: 2, price: 18, status: 1, delSign: 0, stock: 8 }] }

test('同次加载同商品多规格只读一次，不跨次缓存价格库存', async () => {
  let calls = 0
  const fetch = async () => { calls++; return structuredClone(product) }
  const rows = await loadCartProducts(['10:1', '10:2'], { '10:1': { quantity: 2 } }, fetch)
  assert.equal(calls, 1)
  assert.deepEqual(rows.map(row => [row.id, row.price, row.quantity]), [['10:1', 12, 2], ['10:2', 18, 1]])
  await loadCartProducts(['10:1'], {}, fetch)
  assert.equal(calls, 2)
})

test('缺失规格和请求失败保留原选择占位，不退回默认规格或删除失败行', async () => {
  let rows = await loadCartProducts(['10', '10:9'], {}, async () => product)
  assert.equal(rows.length, 2)
  assert.ok(rows.every(row => row.available === false && row.selectionInvalid))
  rows = await loadCartProducts(['10:1'], { '10:1': { quantity: 3 } }, async () => { throw new Error('fixture offline') })
  assert.equal(rows[0].id, '10:1')
  assert.equal(rows[0].quantity, 3)
  assert.equal(rows[0].loadFailure, true)
})
