import { get, post, getToken } from '@/utils/request.js'
import { API_PATHS, getImageUrl } from '@/utils/config.js'
import { inventoryFields, inventoryStock } from '@/utils/inventory.js'

export const getCategoryList = (productCategory = null) => {
  const params = {}
  if (productCategory !== null && productCategory !== undefined && productCategory !== '') {
    params.productCategory = productCategory
  }
  return get(API_PATHS.CATEGORY.LIST, params, {
    needAuth: false,
    showLoading: true
  })
}

export const getCategoryProducts = (
  categoryId = null,
  pageNum = 1,
  pageSize = 10,
  productCategory = null,
  sortField = null,
  sortOrder = null,
  keyword = null
) => {
  const payload = {
    categoryId,
    pageNum,
    pageSize,
    _t: Date.now()
  }
  if (productCategory !== null && productCategory !== undefined && productCategory !== '') {
    payload.productCategory = productCategory
  }
  if (sortField) {
    payload.sortField = sortField
  }
  if (sortOrder) {
    payload.sortOrder = sortOrder
  }
  const normalizedKeyword = typeof keyword === 'string' ? keyword.trim() : ''
  if (normalizedKeyword) {
    payload.keyword = normalizedKeyword
  }
  return post(API_PATHS.CATEGORY.PRODUCTS, payload, {
    // 后端公开查询不依赖账号；会话校验不可用时仍应允许浏览、搜索和分页。
    needAuth: false,
    showLoading: pageNum <= 1
  })
}

export const getProductDetail = (id, { showLoading = true, silent = false } = {}) => {
  const token = getToken()
  const options = {
    needAuth: false,
    showLoading,
    silent
  }
  if (token) {
    options.header = { Authorization: `Bearer ${token}` }
  }
  return get(API_PATHS.PRODUCT.DETAIL(id), {
    _t: Date.now()
  }, options)
}

const parseGalleryImages = (galleryImages, coverImage) => {
  if (typeof galleryImages === 'string' && galleryImages.trim()) {
    const raw = galleryImages.trim()
    try {
      const parsed = raw.startsWith('[') ? JSON.parse(raw) : raw.split(',')
      if (Array.isArray(parsed)) {
        const images = parsed.filter(item => typeof item === 'string')
          .map(item => getImageUrl(item.trim())).filter(Boolean)
        if (images.length) return images
      }
    } catch (_) { /* 图集 JSON 无效时显示商品主图。 */ }
  }

  const image = getImageUrl(coverImage)
  return image ? [image] : []
}

// 接口统一使用 Product 的 camelCase 字段；这里只转换为页面使用的展示字段。
export const mapProductListItem = (product = {}) => {
  const productName = product.productName || ''
  const subTitle = product.subTitle
  const indications = product.indications
  const usageDesc = product.usageDesc
  const commonUsage = product.commonUsage
  const specText = product.specText
  const unit = product.unit || ''
  const goodsMerchantType = product.goodsMerchantType
  const productCategory = product.productCategory

  return {
    id: product.id,
    status: product.status,
    delSign: product.delSign,
    name: productName,
    subtitle: subTitle || '',
    description: subTitle || indications || '',
    image: product.coverImage || '',
    price: Number(product.price || 0),
    originalPrice: Number(product.originalPrice || 0),
    unit,
    doctorName: product.pharmacistName || '',
    specText: specText || '',
    notice: usageDesc || commonUsage || '',
    salesVolume: Number(product.salesVolume || 0),
    categoryId: product.categoryId,
    categoryCode: product.categoryCode || '',
    goodsMerchantType: goodsMerchantType == null ? null : Number(goodsMerchantType),
    productCategory: productCategory == null ? null : Number(productCategory),
    isPrescription: Number(product.isPrescription || 0),
    needQuestionnaire: Number(product.needQuestionnaire || 0),
    questionnaireId: product.questionnaireId,
    isHospitalStarFormula: Number(product.isHospitalStarFormula || 0),
    isNewProduct: Number(product.isNewProduct || 0),
    detailTitle: product.detailTitle || '',
    isStarProduct: Number(product.isStarProduct || 0),
    stock: inventoryStock(product.stock),
    ...inventoryFields(product),
    isExternal: Number(product.isExternal || 0),
    coldShippingType: Number(product.coldShippingType || 0),
    isSelfDeveloped: Number(product.isSelfDeveloped)
  }
}

const mapRecommendationProducts = (products = []) => {
  if (!Array.isArray(products)) {
    return []
  }

  return products.map(item => {
    const mapped = mapProductListItem(item)
    return {
      ...mapped,
      image: getImageUrl(item.coverImage || mapped.image)
    }
  })
}

const mapLimitInfo = (product) => {
  const raw = product.limitInfo || {}
  const enabled = raw.enabled === true
  if (!enabled) {
    return {
      enabled: false,
      text: '',
      remainingQuantity: null
    }
  }
  return {
    enabled: true,
    periodType: Number(raw.periodType || 0),
    periodLabel: raw.periodLabel || '',
    limitQuantity: Number(raw.limitQuantity || 0),
    purchasedQuantity: Number(raw.purchasedQuantity || 0),
    remainingQuantity: Number(raw.remainingQuantity || 0),
    text: raw.text || ''
  }
}

const mapProductSku = (sku = {}) => {
  const image = getImageUrl(sku.imageUrl)
  return {
    id: sku.id,
    productId: sku.productId,
    skuCode: sku.skuCode || '',
    skuName: sku.skuName || '',
    specText: sku.specText || '',
    unit: sku.unit || '',
    price: sku.price,
    stock: sku.stock,
    ...inventoryFields(sku),
    stockWarn: Number(sku.stockWarn || 0),
    salesVolume: Number(sku.salesVolume || 0),
    imageUrl: image,
    image,
    defaultFlag: Number(sku.defaultFlag || 0),
    sort: Number(sku.sort || 0),
    status: Number(sku.status ?? 1),
    delSign: Number(sku.delSign ?? 0)
  }
}

export const mapProductDetail = (product = {}) => {
  const listView = mapProductListItem(product)
  const coverImage = product.coverImage
  const rawSkus = product.skus || []

  return {
    ...listView,
    image: getImageUrl(coverImage || listView.image),
    images: parseGalleryImages(
      product.galleryImages,
      coverImage || listView.image
    ),
    intro: product.intro || '',
    indications: product.indications || '',
    ingredients: product.ingredients || '',
    commonUsage: product.commonUsage || '',
    usageDesc: product.usageDesc || '',
    contraindication: product.contraindication || '',
    precautions: product.precautions || '',
    storageCondition: product.storageCondition || '',
    adverseReactions: product.adverseReactions || '',
    drugInteractions: product.drugInteractions || '',
    appearanceDesc: product.appearanceDesc || '',
    dosageForm: product.dosageForm || '',
    packageSpec: product.packageSpec || '',
    validityPeriod: product.validityPeriod || '',
    originType: Number(product.originType || 0),
    approvalNumber: product.approvalNumber || '',
    manufacturer: product.manufacturer || '',
    executionStandard: product.executionStandard || '',
    warmTips: product.warmTips || '',
    brandName: product.brandName || '',
    suitableCrowd: product.suitableCrowd || '',
    detailTitle: product.detailTitle || '',
    isStarProduct: Number(product.isStarProduct || 0),
    relatedProducts: mapRecommendationProducts(product.relatedProducts || []),
    starProducts: mapRecommendationProducts(product.starProducts || []),
    skus: Array.isArray(rawSkus) ? rawSkus.map(mapProductSku).filter(item => item.id !== null && item.id !== undefined) : [],
    limitInfo: mapLimitInfo(product)
  }
}
