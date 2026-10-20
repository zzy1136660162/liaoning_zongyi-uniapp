import { splitCartItemKey } from './cart-key.js'
import { resolveProductSku, withProductSku } from './product-sku.js'

/**
 * 每次页面加载重新取商品；同一商品的多个规格只共享本次请求。
 * 返回失败占位行而非删除用户选择，防止只提交其余成功商品。
 */
export const loadCartProducts = async (itemKeys, entries, fetchProduct) => {
  const requests = new Map()
  return Promise.all(itemKeys.map(async value => {
    const key = String(value), entry = entries[key] || {}
    const { productId, skuId } = splitCartItemKey(key)
    try {
      if (!requests.has(productId)) requests.set(productId, fetchProduct(productId))
      const product = await requests.get(productId)
      if (!product || String(product.id) !== productId) throw new Error('商品信息不匹配')
      if (!skuId) throw Object.assign(new Error('请重新选择商品规格'), { code: 'SKU_SELECTION_INVALID' })
      const sku = resolveProductSku(product, skuId)
      const sale = withProductSku(product, sku)
      return { ...sale, id: key, cartKey: key, productId, skuId: skuId ? sku.id : null,
        name: product.productName, image: sale.coverImage, quantity: entry.quantity || 1,
        notice: product.usageDesc || '', description: product.subTitle || '' }
    } catch (error) {
      if (error.code === 'SESSION_CHANGED') throw error
      return { ...entry, id: key, cartKey: key, productId, skuId: skuId || null,
        stock: 0, available: false, inventoryStatus: 'UNAVAILABLE',
        selectionInvalid: error.code === 'SKU_SELECTION_INVALID', loadFailure: true }
    }
  }))
}
