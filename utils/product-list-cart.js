// 列表按商品汇总展示数量，修改时仍须定位真实的 SKU 行，不能把总数写给任意规格。
export const getProductCartLines = (entries, productId) => Object.entries(entries)
  .filter(([_key, entry]) => String(entry.productId) === String(productId))
  .map(([cartKey, entry]) => ({ ...entry, cartKey }))

// 列表只持有商品汇总。底部结算仍限于当前已加载商品，但价格、库存和身份使用实际 SKU 行。
export const buildListCartCategories = (categories, entries) => categories.map(category => ({
  ...category,
  products: (category.products || []).flatMap(product => getProductCartLines(entries, product.id)
    .map(line => ({ ...product, ...line, id: line.cartKey })))
}))
