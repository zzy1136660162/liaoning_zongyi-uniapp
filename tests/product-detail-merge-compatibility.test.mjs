import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const readPage = relativePath => readFileSync(
  new URL(relativePath, import.meta.url),
  'utf8'
)

const medicineDetailPage = readPage('../pages/products/medicine_detail.vue')
const therapyDetailPage = readPage('../pages/products/therapy_detail.vue')
const conflictMarkerPattern = /^(<<<<<<<|=======|>>>>>>>)/m

assert.doesNotMatch(medicineDetailPage, conflictMarkerPattern)
assert.doesNotMatch(therapyDetailPage, conflictMarkerPattern)

for (const page of [medicineDetailPage, therapyDetailPage]) {
  assert.match(page, /限购周期：\{\{ product\.limitInfo\.periodLabel \}\}/)
  assert.match(page, /限购上限：\{\{ product\.limitInfo\.limitQuantity \}\}件/)
  assert.match(page, /已购数量：\{\{ product\.limitInfo\.purchasedQuantity \}\}件/)
  assert.match(page, /剩余可购：\{\{ product\.limitInfo\.remainingQuantity \}\}件/)
  assert.match(page, /\.goods-info\s*\{[\s\S]*?margin-top:\s*-50rpx;/)
  assert.match(page, /\.goods-info\s*\{[\s\S]*?border-radius:\s*32rpx;/)
  assert.match(page, /class="goods-name"[\s\S]*?selectable="true"/)
}

assert.match(therapyDetailPage, /class="quantity-stepper"/)
assert.match(therapyDetailPage, /class="quantity-value"[\s\S]*?selectable="true"/)
assert.match(therapyDetailPage, /v-for="item in usageItems"/)
assert.match(therapyDetailPage, /class="usage-label"[\s\S]*?selectable="true"/)
assert.match(therapyDetailPage, /class="usage-text"[\s\S]*?selectable="true"/)

console.log('product detail merge compatibility tests passed')
