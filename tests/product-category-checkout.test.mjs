import test from 'node:test'
import assert from 'node:assert/strict'
import * as cart from './cart-api-fixture.mjs'
import { parseConsultationContext, requireConsultationPatient } from '../utils/consultation-checkout.js'
import { loadSetup } from './sfc-harness.mjs'

const combinations = [[1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]]
for (const combination of combinations) {
  test(`真实购物车到创建订单 ${combination.join('+')}：全量合计、只制剂复诊、实物配送`, async () => {
    const storage = new Map(), orders = [], consultationChecks = [], payments = []
    const products = combination.map(category => ({ id: category * 10, productCategory: category,
      goodsMerchantType: category === 2 ? 2 : 1, categoryId: 34, categoryCode: '不参与业务判断',
      productName: `商品${category}`, status: 1, delSign: 0, price: category * 10, stock: 20,
      skus: [{ id: category * 100, productId: category * 10, price: category * 10,
        stock: 20, status: 1, delSign: 0, defaultFlag: 1 }] }))
    const uni = { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
      removeStorageSync: key => storage.delete(key), $emit() {}, showLoading() {}, hideLoading() {},
      showToast() {}, redirectTo() {}, navigateBack() {} }
    globalThis.uni = uni
    for (const product of products) {
      assert.equal(await cart.addCartItem({ ...product, skuId: product.skus[0].id, price: product.skus[0].price }, 2), true)
    }
    const keys = Object.keys(cart.getCartEntries())
    let onLoad
    const page = loadSetup('pages/order/confirm.vue', {
      ...cart, uni, ref: value => ({ value }), computed: get => ({ get value() { return get() } }),
      onLoad: callback => { onLoad = callback }, onShow() {}, onMounted() {},
      getSessionGeneration: () => 1, isCurrentSession: () => true, assertCurrentSession() {},
      parseConsultationContext, requireConsultationPatient,
      getConsultationDetail: async id => { consultationChecks.push(id); return { id: 99, patientId: 8 } },
      getProductDetail: async id => products.find(product => String(product.id) === String(id)),
      getPatientList: async () => [{ id: 8, name: '本次就诊人' }],
      getAddressList: async () => [{ id: 7, isDefault: true }], queryFreight: async () => ({ freight: 0 }),
      createOrder: async input => { orders.push(input); return { id: 70, payableAmount: 2 * combination.reduce((sum, category) => sum + category * 10, 0) } },
      ensureWeChatIdentity: async () => ({ openid: 'fixture' }),
      wechatSinglePay: async (id, input) => { payments.push({ id, input }); return {} },
      STORAGE_KEY_CURRENT_ORDER: 'current_order', STORAGE_KEY_DEFAULT_ADDRESS_ID: 'default_address_id',
      logButtonClick() {}, console: { debug() {}, error() {}, warn() {} }
    }, ['loadProducts', 'loadOrderInfo', 'orderInfo', 'submitOrder', 'requiresShipping', 'requiresConsultationPatient'])
    // 路由中的旧 therapy 标记不能把实物订单变成无地址疗法订单。
    onLoad({ selectedItems: keys.join(','), consultationId: '99', patientId: '8', therapy: '1' })
    await page.loadProducts(); page.loadOrderInfo()
    assert.equal(page.requiresShipping.value, combination.some(category => category !== 3))
    assert.equal(page.requiresConsultationPatient.value, combination.includes(1))
    const expectedTotal = 2 * combination.reduce((sum, category) => sum + category * 10, 0)
    assert.equal(page.orderInfo.value.total, expectedTotal)
    await page.submitOrder()
    assert.equal(orders.length, 1)
    assert.deepEqual(orders[0].items.map(item => item.productId).sort(), products.map(product => String(product.id)).sort())
    assert.ok(orders[0].items.every(item => item.skuId && item.quantity === 2))
    assert.equal(orders[0].addressId, combination.every(category => category === 3) ? undefined : 7)
    assert.equal(orders[0].consultationId, combination.includes(1) ? 99 : undefined)
    assert.equal(orders[0].patientId, 8)
    assert.deepEqual(consultationChecks, combination.includes(1) ? [99] : [])
    assert.equal(payments[0].input.totalAmount, expectedTotal)
  })
}
