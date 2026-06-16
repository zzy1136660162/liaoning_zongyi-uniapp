import { get, post, getToken } from '@/utils/request.js'
import { API_PATHS, getImageUrl } from '@/utils/config.js'

export const getCategoryList = (bizType = null) => {
  const params = {}
  if (bizType !== null && bizType !== undefined && bizType !== '') {
    params.bizType = bizType
  }
  return get(API_PATHS.CATEGORY.LIST, params, {
    needAuth: false,
    showLoading: true
  })
}

export const getProductsByCategory = (
  categoryId = null,
  pageNum = 1,
  pageSize = 10,
  bizType = null,
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
  if (bizType !== null && bizType !== undefined && bizType !== '') {
    payload.bizType = bizType
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
    needAuth: true,
    showLoading: pageNum <= 1
  })
}

export const getCategoryProducts = getProductsByCategory

export const getProductDetail = (id) => {
  const token = getToken()
  const options = {
    needAuth: false,
    showLoading: true
  }
  if (token) {
    options.header = { Authorization: `Bearer ${token}` }
  }
  return get(API_PATHS.PRODUCT.DETAIL(id), {
    _t: Date.now()
  }, options)
}

const pickField = (product, ...keys) => {
  if (!product) return null
  for (const key of keys) {
    const value = product[key]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }
  return null
}

const parseGalleryImages = (galleryImages, coverImage) => {
  if (Array.isArray(galleryImages)) {
    return galleryImages.map(item => getImageUrl(item)).filter(Boolean)
  }

  if (typeof galleryImages === 'string' && galleryImages.trim()) {
    const raw = galleryImages.trim()
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map(item => getImageUrl(item)).filter(Boolean)
      }
    } catch (error) {
      const fallbackList = raw
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
      if (fallbackList.length > 0) {
        return fallbackList.map(item => getImageUrl(item))
      }
    }
  }

  const image = getImageUrl(coverImage)
  return image ? [image] : []
}

export const mapProductListItem = (product = {}) => {
  const productName = pickField(product, 'productName', 'product_name', 'name') || ''
  const subTitle = pickField(product, 'subTitle', 'sub_title')
  const indications = pickField(product, 'indications')
  const usageDesc = pickField(product, 'usageDesc', 'usage_desc')
  const commonUsage = pickField(product, 'commonUsage', 'common_usage')
  const specText = pickField(product, 'specText', 'spec_text')
  const unit = pickField(product, 'unit') || ''
  const goodsMerchantType = pickField(product, 'goodsMerchantType', 'goods_merchant_type')
  const productCategory = pickField(product, 'productCategory', 'product_category')

  return {
    id: pickField(product, 'id'),
    name: productName,
    subtitle: subTitle || '',
    description: subTitle || indications || '',
    image: pickField(product, 'coverImage', 'cover_image', 'image', 'productImage') || '',
    price: Number(pickField(product, 'price') || 0),
    originalPrice: Number(pickField(product, 'originalPrice', 'original_price') || 0),
    unit,
    doctorName: pickField(product, 'pharmacistName', 'pharmacist_name') || '',
    specText: specText || '',
    notice: usageDesc || commonUsage || '',
    salesVolume: Number(pickField(product, 'salesVolume', 'sales_volume') || 0),
    categoryId: pickField(product, 'categoryId', 'category_id'),
    categoryCode: pickField(product, 'categoryCode', 'category_code') || '',
    bizType: Number(pickField(product, 'bizType', 'biz_type') || 1),
    goodsMerchantType: goodsMerchantType === null ? null : Number(goodsMerchantType),
    productCategory: productCategory === null ? null : Number(productCategory),
    isPrescription: Number(pickField(product, 'isPrescription', 'is_prescription') || 0),
    needQuestionnaire: Number(pickField(product, 'needQuestionnaire', 'need_questionnaire') || 0),
    questionnaireId: pickField(product, 'questionnaireId', 'questionnaire_id'),
    isHospitalStarFormula: Number(pickField(product, 'isHospitalStarFormula', 'is_hospital_star_formula') || 0),
    isNewProduct: Number(pickField(product, 'isNewProduct', 'is_new_product') || 0),
    detailTitle: pickField(product, 'detailTitle', 'detail_title') || '',
    isStarProduct: Number(pickField(product, 'isStarProduct', 'is_star_product') || 0),
    stock: Number(pickField(product, 'stock') || 0),
    isExternal: Number(pickField(product, 'isExternal', 'is_external') || 0),
    coldShippingType: Number(pickField(product, 'coldShippingType', 'cold_shipping_type') || 0),
    isSelfDeveloped: (() => {
      const raw = pickField(product, 'isSelfDeveloped', 'is_self_developed')
      if (raw === null || raw === undefined || raw === '') return 1
      return Number(raw)
    })()
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
      image: getImageUrl(pickField(item, 'coverImage', 'cover_image', 'image', 'productImage') || mapped.image)
    }
  })
}

const mapLimitInfo = (product) => {
  const raw = pickField(product, 'limitInfo', 'limit_info') || {}
  const enabled = raw.enabled === true || raw.enabled === 1 || raw.enabled === '1'
  if (!enabled) {
    return {
      enabled: false,
      text: '',
      remainingQuantity: null
    }
  }
  return {
    enabled: true,
    periodType: Number(pickField(raw, 'periodType', 'period_type') || 0),
    periodLabel: pickField(raw, 'periodLabel', 'period_label') || '',
    limitQuantity: Number(pickField(raw, 'limitQuantity', 'limit_quantity') || 0),
    purchasedQuantity: Number(pickField(raw, 'purchasedQuantity', 'purchased_quantity') || 0),
    remainingQuantity: Number(pickField(raw, 'remainingQuantity', 'remaining_quantity') || 0),
    text: pickField(raw, 'text') || ''
  }
}

export const mapProductDetail = (product = {}) => {
  const listView = mapProductListItem(product)
  const coverImage = pickField(product, 'coverImage', 'cover_image', 'image', 'productImage')

  return {
    ...listView,
    image: getImageUrl(coverImage || listView.image),
    images: parseGalleryImages(
      pickField(product, 'galleryImages', 'gallery_images'),
      coverImage || listView.image
    ),
    intro: pickField(product, 'intro') || '',
    indications: pickField(product, 'indications') || '',
    ingredients: pickField(product, 'ingredients') || '',
    commonUsage: pickField(product, 'commonUsage', 'common_usage') || '',
    usageDesc: pickField(product, 'usageDesc', 'usage_desc') || '',
    contraindication: pickField(product, 'contraindication') || '',
    precautions: pickField(product, 'precautions') || '',
    storageCondition: pickField(product, 'storageCondition', 'storage_condition') || '',
    adverseReactions: pickField(product, 'adverseReactions', 'adverse_reactions') || '',
    drugInteractions: pickField(product, 'drugInteractions', 'drug_interactions') || '',
    appearanceDesc: pickField(product, 'appearanceDesc', 'appearance_desc') || '',
    dosageForm: pickField(product, 'dosageForm', 'dosage_form') || '',
    packageSpec: pickField(product, 'packageSpec', 'package_spec') || '',
    validityPeriod: pickField(product, 'validityPeriod', 'validity_period') || '',
    originType: Number(pickField(product, 'originType', 'origin_type') || 0),
    approvalNumber: pickField(product, 'approvalNumber', 'approval_number') || '',
    manufacturer: pickField(product, 'manufacturer') || '',
    executionStandard: pickField(product, 'executionStandard', 'execution_standard') || '',
    warmTips: pickField(product, 'warmTips', 'warm_tips') || '',
    brandName: pickField(product, 'brandName', 'brand_name') || '',
    suitableCrowd: pickField(product, 'suitableCrowd', 'suitable_crowd') || '',
    detailTitle: pickField(product, 'detailTitle', 'detail_title') || '',
    isStarProduct: Number(pickField(product, 'isStarProduct', 'is_star_product') || 0),
    relatedProducts: mapRecommendationProducts(pickField(product, 'relatedProducts', 'related_products') || []),
    starProducts: mapRecommendationProducts(pickField(product, 'starProducts', 'star_products') || []),
    limitInfo: mapLimitInfo(product)
  }
}
