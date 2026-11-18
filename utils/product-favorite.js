import { ref } from 'vue'
import { setProductCollected } from '@/api/product.js'
import { getSessionGeneration, isCurrentSession } from './session.js'

/** 两类商品详情共用同一收藏操作，返回详情时等正在提交的写入结束再读取。 */
export const useProductFavorite = (product, ensureLogin) => {
  const savingFavorite = ref(false)
  let pending

  const save = async (id, collected) => {
    const session = getSessionGeneration()
    try {
      if (!(await ensureLogin()) || !isCurrentSession(session)) return
      await setProductCollected(id, collected)
      if (isCurrentSession(session) && product.value.id === id) {
        product.value.collected = collected
        uni.showToast({ title: collected ? '已加入我的收藏' : '已取消收藏', icon: 'none' })
      }
    } catch (error) {
      if (isCurrentSession(session)) {
        uni.showToast({ title: error.message || '收藏操作未确认，请重试', icon: 'none' })
      }
    } finally {
      savingFavorite.value = false
    }
  }

  const toggleCollect = () => {
    if (savingFavorite.value) return
    const { id, collected } = product.value
    if (!id || typeof collected !== 'boolean') {
      uni.showToast({ title: '请先重新加载商品详情', icon: 'none' })
      return
    }
    savingFavorite.value = true
    pending = save(id, !collected)
  }
  return { savingFavorite, toggleCollect, waitForFavorite: () => pending }
}
