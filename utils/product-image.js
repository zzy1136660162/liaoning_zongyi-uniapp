import { ref } from 'vue'
import { getImageUrl } from './config.js'

export const PRODUCT_PLACEHOLDER = '/static/images/product-placeholder.jpg'

// 模块级缓存：下载过的图片记下本地路径，页面切走重建后直接复用，不再重复请求网络图
const cachedImagePaths = ref({})
const pendingImageUrls = new Set()

const resolveImageUrl = (image) => {
  const raw = typeof image === 'string' ? image.trim() : ''
  if (!raw) return ''
  return raw.startsWith('/static/') ? raw : getImageUrl(raw)
}

const preloadProductImage = (url) => {
  if (!url || url.startsWith('/static/')) return
  if (cachedImagePaths.value[url] || pendingImageUrls.has(url)) return
  if (typeof uni === 'undefined' || typeof uni.getImageInfo !== 'function') return
  pendingImageUrls.add(url)
  uni.getImageInfo({
    src: url,
    success: (res) => {
      const path = res && (res.path || res.apFilePath)
      if (path) {
        cachedImagePaths.value[url] = path
      }
    },
    complete: () => {
      pendingImageUrls.delete(url)
    }
  })
}

// 列表数据到手后一次性预下载整页图片，首屏不用等图片滚动到可视区才开始加载
export const preloadProductImages = (images = []) => {
  const list = Array.isArray(images) ? images : [images]
  list.forEach(image => preloadProductImage(resolveImageUrl(image)))
}

export const useProductImages = () => {
  const failedImages = ref({})

  const getProductImageUrl = (image) => {
    const url = resolveImageUrl(image)
    if (!url || failedImages.value[url]) return PRODUCT_PLACEHOLDER
    const cachedPath = cachedImagePaths.value[url]
    if (cachedPath) return cachedPath
    preloadProductImage(url)
    return url
  }

  const handleProductImageError = (image) => {
    const url = resolveImageUrl(image)
    if (!url || url === PRODUCT_PLACEHOLDER) return
    if (cachedImagePaths.value[url]) {
      // 本地临时文件可能被系统清理，清掉缓存回退网络地址重新加载
      const nextPaths = { ...cachedImagePaths.value }
      delete nextPaths[url]
      cachedImagePaths.value = nextPaths
      return
    }
    failedImages.value[url] = true
  }

  return { getProductImageUrl, handleProductImageError }
}
