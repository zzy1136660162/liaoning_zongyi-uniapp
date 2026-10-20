import { inventoryFields, inventoryStock } from './inventory.js'
import { isPurchaseAvailable } from './purchase-quantity.js'

const active = sku => Number(sku.status ?? 1) === 1 && Number(sku.delSign ?? sku.del_sign ?? 0) === 0
const invalidSelection = message => Object.assign(new Error(message), { code: 'SKU_SELECTION_INVALID' })

export const withProductSku = (product, sku) => {
  if (!sku) return product
  const his = product.inventoryMode === 'HIS_AVAILABILITY' || sku.inventoryMode === 'HIS_AVAILABILITY'
  const inventory = inventoryFields(his ? { ...sku, inventoryMode: 'HIS_AVAILABILITY' } : sku, his ? {} : product)
  const enabled = active(product) && active(sku)
  if (!enabled || product.available === false || (his && (product.inventoryStatus !== 'AVAILABLE' || product.available !== true))) {
    inventory.available = false
    inventory.inventoryStatus = 'UNAVAILABLE'
  }
  const productId = product.productId || product.id
  return {
    ...product,
    id: productId,
    productId,
    skuId: sku.id,
    skuCode: sku.skuCode || '',
    skuName: sku.skuName || '',
    skuSpecText: sku.specText || sku.skuName || '',
    price: Number(sku.price ?? product.price ?? 0),
    originalPrice: Number(product.originalPrice ?? 0),
    unit: sku.unit || product.unit,
    specText: sku.specText || sku.skuName || product.specText,
    image: sku.image || sku.imageUrl || product.image || product.coverImage,
    coverImage: sku.imageUrl || sku.image || product.coverImage || product.image,
    stock: !enabled || inventory.available === false ? 0 : his ? null : inventoryStock(sku.stock, product.stock),
    ...inventory
  }
}

export const resolveProductSku = (product, skuId = null) => {
  const skus = Array.isArray(product.skus) ? product.skus : []
  if (skuId !== null && skuId !== undefined && skuId !== '') {
    const sku = skus.find(item => String(item.id) === String(skuId) && active(item))
    if (!sku) throw invalidSelection('所选规格已失效，请重新选择')
    return sku
  }
  if (!skus.length) return null
  const enabled = skus.filter(active)
  if (!enabled.length) throw invalidSelection('商品规格已下架')
  return enabled.find(sku => Number(sku.defaultFlag) === 1 && isPurchaseAvailable(withProductSku(product, sku))) ||
    enabled.find(sku => isPurchaseAvailable(withProductSku(product, sku))) ||
    enabled.find(sku => Number(sku.defaultFlag) === 1) || enabled[0]
}
