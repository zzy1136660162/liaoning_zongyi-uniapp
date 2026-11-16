import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const confirmPage = readFileSync(
  new URL('../pages/order/confirm.vue', import.meta.url),
  'utf8'
)
const medicineIndexPage = readFileSync(
  new URL('../pages/products/medicine_index.vue', import.meta.url),
  'utf8'
)
const medicineListPage = readFileSync(
  new URL('../pages/products/medicine_list.vue', import.meta.url),
  'utf8'
)
const medicineDetailPage = readFileSync(
  new URL('../pages/products/medicine_detail.vue', import.meta.url),
  'utf8'
)
const therapyDetailPage = readFileSync(
  new URL('../pages/products/therapy_detail.vue', import.meta.url),
  'utf8'
)
const medicineDetailTemplate = medicineDetailPage
  .slice(0, medicineDetailPage.indexOf('<script'))
  .replace(/<!--[\s\S]*?-->/g, '')
const therapyDetailTemplate = therapyDetailPage
  .slice(0, therapyDetailPage.indexOf('<script'))
  .replace(/<!--[\s\S]*?-->/g, '')
const medicineIndexTemplate = medicineIndexPage
  .slice(0, medicineIndexPage.indexOf('<script'))
  .replace(/<!--[\s\S]*?-->/g, '')
const medicineListTemplate = medicineListPage
  .slice(0, medicineListPage.indexOf('<script'))
  .replace(/<!--[\s\S]*?-->/g, '')

assert.match(confirmPage, /v-model="orderRemark"/)
assert.match(confirmPage, /maxlength="255"/)
assert.match(confirmPage, /remark:\s*orderRemark\.value\.trim\(\)/)
assert.doesNotMatch(confirmPage, /remark:\s*''/)

assert.match(medicineIndexPage, /const loadError = ref\(false\)/)
assert.match(medicineIndexPage, /loadError\.value = false/)
assert.match(medicineIndexPage, /loadError\.value = true/)
assert.match(
  medicineIndexTemplate,
  /<button\s+class="retry-button"\s+@click="loadFeaturedProducts">\s*重新加载\s*<\/button>/
)
assert.match(
  medicineIndexTemplate,
  /<view\s+v-if="loading"\s+class="status-state">[\s\S]*?<\/view>\s*<view\s+v-else-if="loadError"\s+class="status-state error-state">[\s\S]*?<\/view>\s*<view\s+v-else-if="featuredProducts\.length === 0"\s+class="status-state">[\s\S]*?<\/view>\s*<view\s+v-else\s+class="product-grid">/
)

// 当前列表精简了规格与销量摘要，仍展示商品名称及实际价格。
assert.match(medicineListTemplate, /{{\s*product\.name\s*}}/)
assert.match(medicineListTemplate, /Number\(product\.price \|\| 0\)\.toFixed\(2\)/)

for (const detailPage of [medicineDetailPage, therapyDetailPage]) {
  assert.match(
    detailPage,
    /label:\s*'适用人群',\s*value:\s*product\.value\.suitableCrowd/
  )
  assert.match(
    detailPage,
    /label:\s*'药物相互作用',\s*value:\s*product\.value\.drugInteractions/
  )
}

assert.match(medicineDetailTemplate, /v-for="item in usageItems"/)
assert.match(therapyDetailTemplate, /v-for="item in usageItems"/)
// 检查去除注释后的实际模板，核销提示和动态资料必须共处唯一的使用说明卡片。
assert.equal((therapyDetailTemplate.match(/class="usage-title">\s*使用说明/g) || []).length, 1)
assert.equal((therapyDetailTemplate.match(/v-for="item in usageItems"/g) || []).length, 1)
assert.match(therapyDetailTemplate, /class="usage-title">\s*使用说明[\s\S]*?class="usage-tip">[\s\S]*?凭订单中的核销码[\s\S]*?<view\s+v-if="usageItems\.length > 0"\s+class="usage-list"\s*>[\s\S]*?v-for="item in usageItems"/)

for (const detailTemplate of [medicineDetailTemplate, therapyDetailTemplate]) {
  assert.match(
    detailTemplate,
    /v-if="product\.limitInfo\.periodLabel != null"[\s\S]*?限购周期[\s\S]*?product\.limitInfo\.periodLabel/
  )
  assert.match(
    detailTemplate,
    /v-if="product\.limitInfo\.limitQuantity != null"[\s\S]*?限购上限[\s\S]*?product\.limitInfo\.limitQuantity/
  )
  assert.match(
    detailTemplate,
    /v-if="product\.limitInfo\.purchasedQuantity != null"[\s\S]*?已购数量[\s\S]*?product\.limitInfo\.purchasedQuantity/
  )
  assert.match(
    detailTemplate,
    /v-if="product\.limitInfo\.remainingQuantity != null"[\s\S]*?剩余可购[\s\S]*?product\.limitInfo\.remainingQuantity/
  )
}
