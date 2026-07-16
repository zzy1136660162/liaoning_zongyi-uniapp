import assert from 'node:assert/strict'

const payload = await import('../utils/cart-sync-payload.js')

assert.deepEqual(payload.buildCartSyncPayload('401:11', {
  productId: '401',
  skuId: '11',
  quantity: 2,
  selected: true,
  questionnaireId: 901,
  answerId: 902
}), {
  productId: 401,
  skuId: 11,
  quantity: 2,
  checked: 1,
  questionnaireId: 901,
  answerId: 902
})

assert.deepEqual(payload.buildCartSyncPayload('402', {
  productId: '402',
  quantity: 1,
  selected: false
}), {
  productId: 402,
  skuId: null,
  quantity: 1,
  checked: 0
})
