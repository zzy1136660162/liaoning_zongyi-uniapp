import { get, post } from '@/utils/request.js'
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

export const getProductsByCategory = (categoryId = null, pageNum = 1, pageSize = 10, bizType = null) => {
  const payload = {
    categoryId,
    pageNum,
    pageSize,
    _t: Date.now()
  }
  if (bizType !== null && bizType !== undefined && bizType !== '') {
    payload.bizType = bizType
  }
  return post(API_PATHS.CATEGORY.PRODUCTS, payload, {
    needAuth: true,
    showLoading: true
  })
}

export const getCategoryProducts = getProductsByCategory

export const getProductDetail = (id) => {
  return get(API_PATHS.PRODUCT.DETAIL(id), {
    _t: Date.now()
  }, {
    needAuth: false,
    showLoading: true
  })
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

  return {
    id: pickField(product, 'id'),
    name: productName,
    subtitle: subTitle || '',
    description: subTitle || indications || '',
    image: pickField(product, 'coverImage', 'cover_image', 'image', 'productImage') || '',
    price: Number(pickField(product, 'price') || 0),
    originalPrice: Number(pickField(product, 'originalPrice', 'original_price') || 0),
    unit,
    specText: specText || '',
    notice: usageDesc || commonUsage || '',
    salesVolume: Number(pickField(product, 'salesVolume', 'sales_volume') || 0),
    categoryId: pickField(product, 'categoryId', 'category_id'),
    categoryCode: pickField(product, 'categoryCode', 'category_code') || '',
    bizType: Number(pickField(product, 'bizType', 'biz_type') || 1),
    goodsMerchantType: Number(pickField(product, 'goodsMerchantType', 'goods_merchant_type') || 1),
    productCategory: Number(pickField(product, 'productCategory', 'product_category') || 2),
    isPrescription: Number(pickField(product, 'isPrescription', 'is_prescription') || 0),
    needQuestionnaire: Number(pickField(product, 'needQuestionnaire', 'need_questionnaire') || 0),
    questionnaireId: pickField(product, 'questionnaireId', 'questionnaire_id'),
    isHospitalStarFormula: Number(pickField(product, 'isHospitalStarFormula', 'is_hospital_star_formula') || 0),
    isNewProduct: Number(pickField(product, 'isNewProduct', 'is_new_product') || 0),
    detailTitle: pickField(product, 'detailTitle', 'detail_title') || '',
    isStarProduct: Number(pickField(product, 'isStarProduct', 'is_star_product') || 0)
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
    starProducts: mapRecommendationProducts(pickField(product, 'starProducts', 'star_products') || [])
  }
}
