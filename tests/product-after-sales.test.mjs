import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { inventoryFields, inventoryStock } from '../utils/inventory.js'
import { canOrderApplyRefund, getOrderItemReturnPolicyText, shouldReviewPhysicalRefund } from '../utils/refund.js'
import { loadOptions, loadSetup } from './sfc-harness.mjs'
import { withProductSku } from '../utils/product-sku.js'

const script = readFileSync(new URL('../api/product.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '').replace(/^export /gm, '')
const { mapProductDetail } = Function('inventoryFields', 'inventoryStock', 'getImageUrl',
  `${script}\nreturn { mapProductDetail }`)(inventoryFields, inventoryStock, value => value || '')

test('展示销量独立于真实成交数，管理员设置零也不回退，切换规格保留商品政策', () => {
  const product = mapProductDetail({ id: 1, salesVolume: 78, displaySalesVolume: 0, supportReturn: 1,
    skus: [{ id: 2, salesVolume: 9 }] })
  assert.equal(product.salesVolume, 78)
  assert.equal(product.displaySalesVolume, 0)
  assert.equal(product.supportReturn, 1)
  assert.equal(product.skus[0].salesVolume, 9)
  const selected = withProductSku(product, product.skus[0])
  assert.equal(selected.displaySalesVolume, 0)
  assert.equal(selected.supportReturn, 1)
  const defaults = mapProductDetail({ salesVolume: 78 })
  assert.equal(defaults.displaySalesVolume, 0)
  assert.equal(defaults.supportReturn, 0)
  assert.equal(mapProductDetail({ displaySalesVolume: '200' }).displaySalesVolume, 200)
})

test('所有已售展示使用后台展示销量，商品详情同时显示可配置的售后说明', () => {
  for (const name of ['medicine_index', 'medicine_list', 'medicine_detail', 'therapy_detail']) {
    const source = readFileSync(new URL(`../pages/products/${name}.vue`, import.meta.url), 'utf8')
    assert.match(source, /已售 \{\{ (?:product|item)\.displaySalesVolume/)
    assert.doesNotMatch(source, /已售 \{\{ (?:product|item)\.salesVolume/)
    if (name.endsWith('detail')) {
      assert.match(source, /Number\(product\.supportReturn\) === 1/)
      assert.doesNotMatch(source, /不支持七天无理由退换|通常不支持退换|未使用次数可按规则申请退款/)
    }
  }
})

test('购买政策不读取当前商品设置，历史未记录保持未知，单项开放单独显示', () => {
  assert.equal(getOrderItemReturnPolicyText({ supportReturn: 1, supportReturnSnapshot: 0 }), '不支持退货')
  assert.equal(getOrderItemReturnPolicyText({ supportReturn: 0, supportReturnSnapshot: 1 }), '允许退货')
  assert.equal(getOrderItemReturnPolicyText({ supportReturnSnapshot: null }), '历史订单沿原售后规则处理')
  assert.equal(getOrderItemReturnPolicyText({ supportReturnSnapshot: 0, refundOpened: 1 }), '不支持退货，本单本项已开放退款')
  assert.equal(getOrderItemReturnPolicyText({ supportReturnSnapshot: 0, productCategorySnapshot: 3 }), '不支持退款')
})

test('历史退货物流页指引线下处理物流，不误称已发货商品不能申请退款', () => {
  const source = readFileSync(new URL('../pages/order/refund_logistics.vue', import.meta.url), 'utf8')
  assert.match(source, /符合退款条件的商品可在订单中申请退款/)
  assert.match(source, /退货物流请线下联系客服/)
  assert.doesNotMatch(source, /发货后不支持在线申请退款/)
})

const item = (id, extra = {}) => ({ id, productId: id, productName: `商品${id}`, quantity: 1, price: 10,
  productCategorySnapshot: 1, supportReturnSnapshot: 0, refundOpened: 0, refundableQuantity: 0, refundable: false,
  refundBlockedReason: '本商品不支持退款，尚未开放本单本项退款', ...extra })
const order = items => ({ id: 9, orderNo: 'fixture', orderStatus: 2, payStatus: 1, paymentFulfillmentStatus: 'READY', items })

test('全部受限隐藏入口及已发货申请提示，混合单仍可退服务端允许的子项', () => {
  const blocked = item(1)
  assert.equal(canOrderApplyRefund(order([blocked])), false)
  assert.equal(shouldReviewPhysicalRefund(order([blocked])), false)
  const allowed = item(2, { supportReturnSnapshot: 1, refundableQuantity: 1, refundable: true })
  assert.equal(canOrderApplyRefund(order([blocked, allowed])), true)
  assert.equal(shouldReviewPhysicalRefund(order([blocked, allowed])), true)
  const list = loadSetup('pages/order/order_list.vue', {
    ref: value => ({ value }), onLoad() {}, onShow() {}, onUnmounted() {}, onSessionChanged: () => () => {}
  }, ['mapOrderListItem'])
  const mapped = list.mapOrderListItem(order([blocked, item(3, { supportReturnSnapshot: null, refundOpened: 1 })]))
  assert.equal(mapped.items[0].supportReturnSnapshot, 0)
  assert.equal(mapped.items[1].supportReturnSnapshot, null)
  assert.equal(mapped.items[1].refundOpened, 1)
})

test('退款申请不预选受限项，开放后刷新资格仍保留已有选择与原因', async () => {
  const requests = []
  const definition = loadOptions('pages/order/refund_apply.vue', {
    getSessionGeneration: () => 1, isCurrentSession: () => true, assertCurrentSession() {}, setTimeout() {},
    applyRefund: async data => requests.push(data),
    uni: { showLoading() {}, hideLoading() {}, showToast() {}, showModal() {} }
  })
  const page = { ...definition.data(), ...definition.methods, orderId: 9 }
  for (const [key, getter] of Object.entries(definition.computed)) Object.defineProperty(page, key, { get: () => getter.call(page) })
  page.applyOrderData(order([item(1), item(2, { supportReturnSnapshot: 1, refundableQuantity: 1, refundable: true })]))
  assert.deepEqual(page.allProducts.map(product => product.selectedQuantity), [0, 1])
  page.increaseQuantity(page.allProducts[0])
  assert.equal(page.allProducts[0].selectedQuantity, 0)
  page.selectReason('商品质量问题')
  page.applyOrderData(order([item(1, { refundOpened: 1, refundableQuantity: 1, refundable: true }),
    item(2, { supportReturnSnapshot: 1, refundableQuantity: 1, refundable: true })]))
  assert.deepEqual(page.allProducts.map(product => product.selectedQuantity), [0, 1])
  assert.equal(page.form.refundReason, '商品质量问题')
  await page.submitRefund()
  assert.deepEqual(requests[0].items.map(product => product.orderItemId), [2])
})
