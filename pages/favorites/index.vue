<template>
  <view class="page">
    <view
      v-if="busy && !items.length"
      class="notice"
    >
      正在加载收藏…
    </view>
    <view
      v-else-if="error"
      class="notice"
    >
      <text>{{ error }}</text>
      <button
        class="action"
        @click="loadPage(requestedPage)"
      >
        重新加载
      </button>
    </view>
    <view
      v-else-if="!items.length"
      class="notice empty"
    >
      <view class="empty-icon">
        <uni-icons
          type="star"
          size="36"
          color="#9b753e"
        />
      </view>
      <text class="empty-title">
        暂无收藏商品
      </text>
      <text>在商品详情页点亮「收藏」，就能在这里找到它。</text>
      <button
        class="action"
        @click="browse"
      >
        去逛商品
      </button>
    </view>
    <block v-else>
      <view class="summary">
        已收藏 {{ total }} 件商品
      </view>
      <view class="list">
        <button
          v-for="item in items"
          :key="item.id"
          class="item"
          @click="openProduct(item)"
        >
          <image
            class="cover"
            mode="aspectFill"
            :src="getProductImageUrl(item.coverImage)"
            @error="handleProductImageError(item.coverImage)"
          />
          <view class="details">
            <text class="kind">
              {{ categoryNames[item.productCategory] || '商品' }}
            </text>
            <text class="name">
              {{ item.productName }}
            </text>
            <text
              v-if="item.subTitle"
              class="subtitle"
            >
              {{ item.subTitle }}
            </text>
          </view>
          <uni-icons
            type="right"
            size="15"
            color="#a59b8e"
          />
        </button>
      </view>
      <view
        v-if="pages > 1"
        class="pager"
      >
        <button
          :disabled="busy || page <= 1"
          @click="loadPage(page - 1)"
        >
          上一页
        </button>
        <text>{{ page }} / {{ pages }}</text>
        <button
          :disabled="busy || page >= pages"
          @click="loadPage(page + 1)"
        >
          下一页
        </button>
      </view>
    </block>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow, onUnload } from '@dcloudio/uni-app'
import { getFavoriteProducts } from '@/api/product.js'
import { useProductImages } from '@/utils/product-image.js'
import { isTraditionalTherapyProduct } from '@/utils/therapy.js'
import { requireAccountSession } from '@/utils/auth-session.js'
import { getSessionGeneration, isCurrentSession, onSessionChanged } from '@/utils/session.js'

const pageSize = 12
const categoryNames = { 1: '院内制剂', 2: '健康商品', 3: '中医疗法' }
const { getProductImageUrl, handleProductImageError } = useProductImages()
const items = ref([])
const page = ref(1)
const requestedPage = ref(1)
const total = ref(0)
const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const busy = ref(true)
const error = ref('')
let sequence = 0

const loadPage = async target => {
  const request = ++sequence
  const session = getSessionGeneration()
  requestedPage.value = target
  busy.value = true
  error.value = ''
  try {
    if (!(await requireAccountSession('/pages/favorites/index'))) {
      if (request === sequence) error.value = '请登录后查看我的收藏'
      return
    }
    const result = await getFavoriteProducts(target, pageSize)
    if (request !== sequence || !isCurrentSession(session)) return
    total.value = result.total
    // 从详情页取消本页最后一件收藏后，返回仍显示有效页。
    if (target > pages.value) {
      await loadPage(pages.value)
      return
    }
    if (page.value !== target) uni.pageScrollTo({ scrollTop: 0, duration: 0 })
    items.value = result.records
    page.value = target
  } catch (failure) {
    if (request === sequence && isCurrentSession(session)) {
      error.value = failure.message || '收藏加载失败，请检查网络后重试'
    }
  } finally {
    if (request === sequence) busy.value = false
  }
}

const openProduct = item => {
  const detail = isTraditionalTherapyProduct(item) ? 'therapy_detail' : 'medicine_detail'
  uni.navigateTo({ url: `/pages/products/${detail}?id=${item.id}` })
}
const browse = () => uni.navigateTo({ url: '/pages/products/medicine_list' })
const unsubscribe = onSessionChanged(() => {
  sequence++
  items.value = []
  total.value = 0
  page.value = 1
  requestedPage.value = 1
  busy.value = false
  error.value = '账号状态已变更，请重新加载收藏'
})
onShow(() => loadPage(page.value))
onUnload(() => {
  sequence++
  unsubscribe()
})
</script>

<style scoped>
.page { min-height: 100vh; box-sizing: border-box; background: #f6f5f2; color: #292e32; padding: 32rpx 26rpx calc(40rpx + env(safe-area-inset-bottom)); }
.summary { margin: 0 8rpx 22rpx; color: #726b62; font-size: 25rpx; }
.list, .notice { background: #fff; border-radius: 24rpx; }
.item { display: flex; align-items: center; gap: 24rpx; margin: 0 24rpx; padding: 27rpx 0; background: transparent; border-radius: 0; text-align: left; line-height: 1.45; }
.item + .item { border-top: 1rpx solid #edeae5; }
button::after { border: 0; }
.cover { width: 130rpx; height: 130rpx; flex: none; border-radius: 14rpx; background: #f4f2ee; }
.details { display: flex; flex-direction: column; align-items: flex-start; gap: 5rpx; flex: 1; min-width: 0; }
.kind { font-size: 22rpx; color: #85642f; }
.name { color: #282f33; font-weight: 600; font-size: 30rpx; overflow-wrap: anywhere; }
.subtitle { font-size: 24rpx; color: #706d66; }
.name, .subtitle { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pager { display: flex; align-items: center; justify-content: center; gap: 32rpx; margin-top: 30rpx; font-size: 24rpx; color: #736e67; }
.pager button, .action { margin: 0; padding: 0 28rpx; border-radius: 12rpx; background: white; font-size: 26rpx; line-height: 80rpx; }
.notice { padding: 92rpx 36rpx; display: flex; flex-direction: column; gap: 18rpx; align-items: center; text-align: center; color: #716c64; font-size: 26rpx; line-height: 1.6; }
.empty-icon { width: 100rpx; height: 100rpx; border-radius: 50%; background: #f7f1e7; display: flex; align-items: center; justify-content: center; }
.empty-title { font-size: 33rpx; font-weight: 600; color: #2e3335; }
.action { margin-top: 16rpx; background: #303a40; color: #fff; }
</style>
