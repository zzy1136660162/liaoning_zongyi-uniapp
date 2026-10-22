import { inventoryFields, inventoryStock } from './inventory.js'
import { isPurchaseAvailable } from './purchase-quantity.js'

const active = sku => Number(sku.status ?? 1) === 1 && Number(sku.delSign ?? 0) === 0
const invalidSelection = message => Object.assign(new Error(message), { code: 'SKU_SELECTION_INVALID' })

export const withProductSku = (product, sku) => {
  // 主表不是可售规格；页面初始化或缺少真实 SKU 时保持展示，但禁止购买。
  if (!sku) return { ...product, available: false, stock: 0, inventoryStatus: 'UNAVAILABLE', inventoryReason: 'SKU_SELECTION_REQUIRED' }
  const his = product.inventoryMode === 'HIS_AVAILABILITY' || sku.inventoryMode === 'HIS_AVAILABILITY'
  const inventory = inventoryFields(his ? { ...sku, inventoryMode: 'HIS_AVAILABILITY' } : sku, his ? {} : product)
  // SKU 售价与库存独立于商品汇总；缺字段时不可售，显式 null 库存表示不计数量。
  const price = Number(sku.price)
  const hasPrice = sku.price !== null && sku.price !== undefined && sku.price !== '' && Number.isFinite(price) && price >= 0
  const hasStock = sku.stock === null || (sku.stock !== undefined && sku.stock !== '' && Number.isFinite(Number(sku.stock)) && Number(sku.stock) >= 0)
  const enabled = active(product) && active(sku) && hasPrice && hasStock
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
    price: hasPrice ? price : 0,
    weight: sku.weight == null ? product.weight : sku.weight,
    originalPrice: Number(product.originalPrice ?? 0),
    unit: sku.unit || product.unit,
    specText: sku.specText || sku.skuName || product.specText,
    image: sku.image || sku.imageUrl || product.image || product.coverImage,
    coverImage: sku.imageUrl || sku.image || product.coverImage || product.image,
    stock: !enabled || inventory.available === false ? 0 : his ? null : inventoryStock(sku.stock),
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
  if (!skus.length) throw invalidSelection('商品未配置可售规格')
  const enabled = skus.filter(active)
  if (!enabled.length) throw invalidSelection('商品规格已下架')
  return enabled.find(sku => Number(sku.defaultFlag) === 1 && isPurchaseAvailable(withProductSku(product, sku))) ||
    enabled.find(sku => isPurchaseAvailable(withProductSku(product, sku))) ||
    enabled.find(sku => Number(sku.defaultFlag) === 1) || enabled[0]
}
