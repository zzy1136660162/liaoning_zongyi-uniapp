import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const uniappRoot = path.resolve(testDir, '..')

const read = (relativePath) => fs.readFileSync(path.resolve(uniappRoot, relativePath), 'utf8')

const relatedPagePaths = [
  'pages/order/order-detail.vue',
  'pages/order/prescription_list.vue',
  'pages/prescription/detail.vue'
]

for (const pagePath of relatedPagePaths) {
  const source = read(pagePath)
  assert.match(source, /AI_DOCTOR/, `${pagePath} 应统一使用 AI_DOCTOR 展示名`)
  assert.doesNotMatch(source, /线上医生|线上名医/, `${pagePath} 不应保留旧的医生兜底文案`)
}

const prescriptionListSource = read('pages/order/prescription_list.vue')
assert.doesNotMatch(
  prescriptionListSource,
  /productDetail\.pharmacistName\s*\|\|/,
  '处方清单不得使用商品药师作为接诊医生'
)

const orderDetailSource = read('pages/order/order-detail.vue')
assert.match(
  orderDetailSource,
  /!this\.order\.prescriptionId\s*&&\s*!this\.order\.doctorName/,
  '处方订单不得触发商品医生兜底'
)
assert.match(
  orderDetailSource,
  /orderDetail\.doctorId\s*&&\s*!this\.order\.prescriptionId/,
  '处方订单不得直接信任订单接口中的商品医生'
)
assert.match(
  orderDetailSource,
  /needsPrescriptionEnrichment\(\)[\s\S]{0,160}!this\.prescriptionInfoLoaded/,
  '处方订单必须刷新权威处方医生，不能按字段完整度跳过'
)

console.log('AI doctor display consistency tests passed')
