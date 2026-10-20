import test from 'node:test'
import assert from 'node:assert/strict'
import { isTraditionalTherapyProduct, isTherapyOrder, hasTherapyEntitlement } from '../utils/therapy.js'
import { resolveProductFlow } from '../utils/product-biz.js'

test('疗法只认购买分类3，任意目录均可归入疗法', () => {
  const product = { categoryId: 812, categoryCode: '任意展示类目', productCategory: 3 }
  assert.equal(isTraditionalTherapyProduct(product), true)
  assert.equal(resolveProductFlow([product]).allTraditionalTherapy, true)
  for (const product of [{ categoryId: 34 }, { categoryCode: '传统疗法' }, { productCategory: 2, categoryCode: '传统疗法' }]) {
    assert.equal(isTraditionalTherapyProduct(product), false)
  }
})

test('历史订单仅按下单分类和核销资格快照，改当前商品分类不改变权益', () => {
  const therapy = { productCategorySnapshot: 3, productCategory: 2, redeemRequiredSnapshot: 1 }
  const physical = { productCategorySnapshot: 2, productCategory: 3, redeemRequiredSnapshot: 0 }
  assert.equal(isTherapyOrder({ items: [therapy] }), true)
  assert.equal(isTherapyOrder({ items: [therapy, physical] }), false)
  assert.equal(hasTherapyEntitlement({ items: [therapy, physical] }), true)
  assert.equal(hasTherapyEntitlement({ items: [physical] }), false)
  assert.equal(isTherapyOrder({ orderType: 1, items: [{ productCategory: 3 }] }), false)
  assert.equal(hasTherapyEntitlement({ items: [{ redeemVouchers: [{ id: 1 }] }] }), true)
})


test('历史纯疗法配送沿已存订单类型，新实物快照优先于冲突类型', () => {
  const legacy = { orderType: 4, items: [{ productCategorySnapshot: null }] }
  assert.equal(isTherapyOrder(legacy), true)
  assert.equal(legacy.items[0].productCategorySnapshot, null, '不补写历史未知分类')
  assert.equal(hasTherapyEntitlement(legacy), false, '配送事实不授予核销权益')
  assert.equal(isTherapyOrder({ orderType: 4, items: [{ productCategorySnapshot: 3 }, { productCategorySnapshot: 2 }] }), false)
})
