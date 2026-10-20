import { ref } from 'vue'
import { getImageUrl } from './config.js'

export const PRODUCT_PLACEHOLDER = '/static/images/product-placeholder.jpg'

export const useProductImages = () => {
  const failedImages = ref({})

  const getProductImageUrl = (image) => {
    const raw = typeof image === 'string' ? image.trim() : ''
    const url = raw.startsWith('/static/') ? raw : getImageUrl(raw)
    return !url || failedImages.value[url] ? PRODUCT_PLACEHOLDER : url
  }

  const handleProductImageError = (image) => {
    const url = getProductImageUrl(image)
    if (url !== PRODUCT_PLACEHOLDER) {
      failedImages.value[url] = true
    }
  }

  return { getProductImageUrl, handleProductImageError }
}
