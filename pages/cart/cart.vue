<template>
  <view class="cart-container">
    <!-- 购物车标题栏 -->
    <!-- <view class="cart-header">
      <view class="header-left">
        <text class="header-title">
          🛒 我的购物车
        </text>
      </view>
    </view> -->
    <!-- <view class="header-decoration">
      <view class="deco-dot dot1" />
      <view class="deco-dot dot2" />
      <view class="deco-dot dot3" />
    </view> -->

    <!-- Banner区域：保留远端购物车顶部视觉入口 -->
    <view class="banner-section">
      <image
        class="banner-image"
        :src="getImageUrl('/profile/liaoning_zongyi/banner_bg.png')"
        mode="widthFix"
      />
    </view>

    <!-- 购物车内容区域 -->
    <view class="cart-content">
      <!-- 空购物车状态 -->
      <view
        v-if="cartItems.length === 0"
        class="empty-cart"
      >
        <image
          class="empty-icon"
          :src="getImageUrl('/profile/liaoning_zongyi/empty_cart.png')"
          mode="aspectFit"
        />
        <text class="empty-text">
          购物车还是空的
        </text>
        <button
          class="go-shopping-btn"
          @click="goShopping"
        >
          去逛逛
        </button>
      </view>

      <!-- 购物车商品列表 -->
      <view
        v-else
        class="cart-list"
      >
        <view
          v-for="item in cartItems"
          :key="item.id"
          class="cart-item"
          :class="{ unavailable: item.available === false }"
        >
          <!-- 选择框 -->
          <view
            class="checkbox-wrapper"
            :class="{ disabled: !isItemSelectable(item) }"
            @click="toggleItemSelection(item.id)"
          >
            <view
              class="checkbox"
              :class="{ checked: selectedItems.includes(item.id), disabled: !isItemSelectable(item) }"
            />
          </view>

          <!-- 商品信息 -->
          <view class="item-content">
            <image
              class="item-image"
              :src="getProductImageUrl(item.image)"
              mode="aspectFill"
              @error="handleProductImageError(item.image)"
              @click="goToProductDetail(item)"
            />
            <view class="item-info">
              <text
                class="item-name"
                @click="goToProductDetail(item)"
              >
                {{ item.name }}
              </text>
              <text class="item-desc">
                规格：{{ item.specText || '—' }}
              </text>
              <text
                v-if="item.available === false"
                class="item-unavailable"
              >
                商品已下架
              </text>
              <view class="item-bottom">
                <text class="item-price">
                  ¥{{ formatPrice(item.price) }}
                </text>
                <view class="quantity-controls">
                  <button
                    class="quantity-btn"
                    @click="decreaseQuantity(item)"
                  >
                    -
                  </button>
                  <text class="quantity-text">
                    {{ item.quantity }}
                  </text>
                  <button
                    class="quantity-btn"
                    :class="{ disabled: isQuantityAtStockLimit(item) }"
                    @click="increaseQuantity(item)"
                  >
                    +
                  </button>
                </view>
              </view>
            </view>
          </view>

          <!-- 删除按钮（编辑模式下显示） -->
          <view
            v-if="isEditMode"
            class="delete-btn"
            @click="removeItem(item.id)"
          >
            <uni-icons
              type="trash"
              size="20"
              color="#ff6b6b"
            />
          </view>
        </view>
      </view>
    </view>

    <!-- 底部结算栏 -->
    <view
      v-if="cartItems.length > 0"
      class="checkout-bar"
    >
      <view
        class="select-all-wrapper"
        @click="toggleSelectAll"
      >
        <view
          class="checkbox"
          :class="{ checked: isAllSelected }"
        />
        <text class="select-all-text">
          全选
        </text>
      </view>

      <view class="checkout-info">
        <text class="total-text">
          合计：<text class="total-price">
            ¥{{ selectedTotalPrice.toFixed(2) }}
          </text>
        </text>
        <text class="total-count">
          已选{{ selectedItemCount }}件
        </text>
      </view>

      <button
        class="checkout-btn"
        :disabled="selectedItems.length === 0"
        @click="goToCheckout"
      >
        {{ isEditMode ? '删除' : '结算' }}
      </button>
    </view>

    <TabBar
      :current="currentTab"
      @change="handleTabChange"
    />
  </view>
</template>

<script>
import { STORAGE_KEY_CURRENT_CONSULTATION_ID } from '@/utils/storage.js'
import { fetchAccountProfile } from '@/utils/account.js'
import {
  getCartEntries,
  refreshCart,
  changeCartItemQuantity,
  calculateTotalQuantity,
  loadCartItems,
  calculateTotalPrice,
  prepareCheckout,
  removeFromCart,
  splitCartItemKey,
  updateProductSelection,
  updateMultipleSelections
} from '@/utils/cart.js'
import { getSessionGeneration, isCurrentSession } from '@/utils/session.js'
import {
  shouldReloadCartFromServer,
  subscribeCartUpdated
} from '@/utils/cart-events.js'
import { getImageUrl } from '@/utils/config.js'
import { useProductImages } from '@/utils/product-image.js'
import { getToken } from '@/utils/request.js'
import TabBar from '@/components/TabBar/TabBar.vue'
import { logPageView, logButtonClick, logAccess } from '@/utils/accessLog.js'
import { isTraditionalTherapyProduct } from '@/utils/therapy.js'
import { buildQuestionnaireNoticeUrl } from '@/utils/questionnaire-state.js'


const PAGE_LOG = {
  pageId: '', moduleCode: 'CART', accessType: '购物车', pageType: 'CART',
  requestUri: '/pages/cart/cart', actionCode: 'VIEW_CART',
  accessTitle: '访问购物车', accessDescription: '用户查看购物车商品并准备调整或结算'
}

export default {
  components: {
    TabBar
  },
  setup: useProductImages,
  data() {
    return {
      cartItems: [],
      categories: [],
      selectedItems: [],
      isEditMode: false,
      currentTab: 'cart',
      selectionSaving: false,
      loading: false,
      // 加载期间再次进入页面，只排队一次后续查询，避免丢掉最新后台状态。
      pendingServerRefresh: false,
      unsubscribeCartUpdated: null
    }
  },
  computed: {
    cartCount() {
      return calculateTotalQuantity(this.cartItems)
    },
    selectedItemCount() {
      return this.selectedItems.length
    },
    selectedTotalPrice() {
      const selectedCartItems = this.cartItems.filter(item => this.selectedItems.includes(item.id) && this.isItemSelectable(item))
      return calculateTotalPrice(selectedCartItems)
    },
    isAllSelected() {
      const selectableItems = this.cartItems.filter(item => this.isItemSelectable(item))
      return selectableItems.length > 0 && selectableItems.every(item => this.selectedItems.includes(item.id))
    }
  },
  onLoad() {
    this.currentTab = 'cart'
    this.unsubscribeCartUpdated = subscribeCartUpdated((event = {}) => {
      if (shouldReloadCartFromServer(event)) {
        this.loadCartPageData({ queueIfLoading: true })
        return
      }
      this.loadCartData()
    })
  },
  onShow() {
    logPageView({ ...PAGE_LOG })
    this.loadCartPageData({ queueIfLoading: true })
  },
  onUnload() {
    if (this.unsubscribeCartUpdated) {
      this.unsubscribeCartUpdated()
      this.unsubscribeCartUpdated = null
    }
  },
  methods: {
    getImageUrl,
    formatPrice(price) {
      return Number(price || 0).toFixed(2)
    },
    isItemSelectable(item) {
      if (!item || item.available === false) {
        return false
      }
      if (item.stock !== undefined && item.stock !== null && Number(item.stock) <= 0) {
        return false
      }
      return true
    },
    isQuantityAtStockLimit(item) {
      if (!item || item.stock === undefined || item.stock === null) {
        return false
      }
      return Number(item.quantity || 1) >= Number(item.stock)
    },
    async loadCartPageData(options = {}) {
      if (this.loading) {
        if (options.queueIfLoading) {
          this.pendingServerRefresh = true
        }
        console.log('[cart] loadCartPageData skipped: already loading')
        return
      }

      const requestSession = getSessionGeneration()
      this.loading = true
      try {
        await this.loadCartFromServer()
      } catch (error) {
        if (isCurrentSession(requestSession) && error.code !== 'SESSION_CHANGED') {
          uni.showToast({ title: error.message || '购物车加载失败，请重试', icon: 'none' })
        }
      } finally {
        this.loading = false
        if (this.pendingServerRefresh) {
          this.pendingServerRefresh = false
          this.loadCartPageData()
        }
      }
    },
    async loadCartFromServer() {
      await refreshCart()
      this.loadCartData()
    },
    loadCartData() {
      const entries = getCartEntries()
      this.categories = [{ id: 'cart_items', name: '购物车商品', products: Object.values(entries) }]
      this.cartItems = loadCartItems(this.categories)
      this.selectedItems = this.cartItems
        .filter(item => item.selected !== false && this.isItemSelectable(item))
        .map(item => item.id)
    },
    toggleEditMode() {
      this.isEditMode = !this.isEditMode
    },
    async toggleItemSelection(itemId) {
      if (this.selectionSaving) return
      const normalizedId = itemId
      const item = this.cartItems.find(cartItem => cartItem.id === normalizedId)
      if (!this.isItemSelectable(item)) {
        uni.showToast({ title: '商品已下架或库存不足', icon: 'none' })
        return
      }
      this.selectionSaving = true
      try {
        await updateProductSelection(normalizedId, !this.selectedItems.includes(normalizedId))
        this.loadCartData()
      } catch (error) { this.showCartError(error) }
      finally { this.selectionSaving = false }
    },
    async toggleSelectAll() {
      if (this.selectionSaving) return
      const nextSelected = !this.isAllSelected
      const selectionMap = {}
      this.cartItems.forEach(item => {
        selectionMap[item.id] = this.isItemSelectable(item) ? nextSelected : false
      })
      this.selectionSaving = true
      try {
        await updateMultipleSelections(selectionMap)
        this.loadCartData()
      } catch (error) { this.loadCartData(); this.showCartError(error) }
      finally { this.selectionSaving = false }
    },
    showCartError(error) {
      if (error.code !== 'SESSION_CHANGED') uni.showToast({ title: error.message || '购物车操作失败', icon: 'none' })
    },
    async increaseQuantity(item) {
      if (!this.isItemSelectable(item)) return
      if (this.isQuantityAtStockLimit(item)) {
        uni.showToast({ title: '已达库存上限', icon: 'none' })
        return
      }
      const actionLog = { ...PAGE_LOG, actionCode: 'CHANGE_CART_QUANTITY', accessTitle: '修改购物车数量', accessDescription: '增加当前购物车规格的购买数量', extraData: { cartKey: item.id } }
      logButtonClick(actionLog)
      try {
        await changeCartItemQuantity(item.id, 1)
        this.loadCartData()
        logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'SUCCESS' })
      } catch (error) {
        logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED' })
        this.showCartError(error)
      }
    },
    async decreaseQuantity(item) {
      const actionLog = { ...PAGE_LOG, actionCode: 'CHANGE_CART_QUANTITY', accessTitle: '修改购物车数量', accessDescription: '减少当前购物车规格的购买数量，减至零时移除该行', extraData: { cartKey: item.id } }
      logButtonClick(actionLog)
      try {
        await changeCartItemQuantity(item.id, -1)
        this.loadCartData()
        logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'SUCCESS' })
      } catch (error) {
        logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED' })
        this.showCartError(error)
      }
    },
    removeItem(itemId) {
      const session = getSessionGeneration()
      const actionLog = { ...PAGE_LOG, actionCode: 'REMOVE_CART_ITEM', accessTitle: '删除购物车商品', accessDescription: '通过确认弹窗删除指定商品规格', extraData: { cartKey: itemId } }
      logButtonClick(actionLog)
      uni.showModal({
        title: '确认删除', content: '确定要删除这个商品吗？',
        success: async (res) => {
          if (!isCurrentSession(session)) return
          if (!res.confirm) { logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'CANCELLED' }); return }
          try {
            await removeFromCart(itemId)
            this.loadCartData()
            logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'SUCCESS' })
            uni.showToast({ title: '删除成功', icon: 'success' })
          } catch (error) {
            if (isCurrentSession(session)) logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED' })
            this.showCartError(error)
          }
        }
      })
    },
    goToProductDetail(item) {
      const page = isTraditionalTherapyProduct(item) ? 'therapy_detail' : 'medicine_detail'
      const productId = item.productId || splitCartItemKey(item.id).productId || item.id
      logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_PRODUCT_DETAIL', accessTitle: '查看购物车商品', accessDescription: '用户从购物车进入对应商品详情', extraData: { productId, cartKey: item.id } })
      console.info('category=PRODUCT_NAVIGATION action=go_detail result=pending from=CART targetPage=%s productId=%s cartKey=%s', page, productId, item.id)
      uni.navigateTo({
        url: `/pages/products/${page}?id=${productId}`
      })
    },
    goShopping() {
      logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_MEDICINE_LIST', accessTitle: '去商城选购', accessDescription: '用户从购物车进入制剂商品列表继续选购' })
      uni.navigateTo({
        url: '/pages/products/medicine_list'
      })
    },
    async goToCheckout() {
      if (this.selectionSaving) return
      const session = getSessionGeneration()
      const actionLog = { ...PAGE_LOG, actionCode: this.isEditMode ? 'REMOVE_CART_ITEMS' : 'START_CHECKOUT', accessTitle: this.isEditMode ? '批量删除购物车商品' : '发起购物车结算', accessDescription: this.isEditMode ? '用户确认移除购物车中选中的商品规格' : '用户按选中商品发起问卷、复诊或订单确认流程', extraData: { selectedCount: this.selectedItems.length } }
      logButtonClick(actionLog)
      if (this.isEditMode) {
        if (this.selectedItems.length === 0) {
          logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED', extraData: { ...actionLog.extraData, reason: 'NO_SELECTION' } })
          uni.showToast({ title: '请选择要删除的商品', icon: 'none' })
          return
        }
        uni.showModal({
          title: '确认删除',
          content: '确定要删除选中的 ' + this.selectedItems.length + ' 个商品吗？',
          success: async (res) => {
            if (!res.confirm) {
              if (isCurrentSession(session)) logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'CANCELLED' })
              return
            }
            if (!isCurrentSession(session)) return
            try {
              await removeFromCart(this.selectedItems)
              this.loadCartData()
              this.isEditMode = false
              logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'SUCCESS' })
              uni.showToast({ title: '删除成功', icon: 'success' })
            } catch (error) {
              if (isCurrentSession(session)) logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED' })
              this.showCartError(error)
            }
          }
        })
        return
      }

      if (this.selectedItems.length === 0) {
        logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED', extraData: { ...actionLog.extraData, reason: 'NO_SELECTION' } })
        uni.showToast({ title: '请选择要结算的商品', icon: 'none' })
        return
      }

      const unavailableSelected = this.cartItems.filter(item => this.selectedItems.includes(item.id) && !this.isItemSelectable(item))
      if (unavailableSelected.length > 0) {
        logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED', extraData: { ...actionLog.extraData, reason: 'PRODUCT_UNAVAILABLE' } })
        uni.showToast({ title: '所选商品含已下架商品', icon: 'none' })
        return
      }

      if (!getToken()) {
        logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED', extraData: { ...actionLog.extraData, reason: 'LOGIN_REQUIRED' } })
        uni.navigateTo({ url: '/pages/register/register' })
        return
      }

      try {
        await refreshCart()
        this.loadCartData()
        // 结算账户以资料接口确认，不用本地表单或姓名推断注册状态。
        await fetchAccountProfile()
        if (!isCurrentSession(session)) return

        const checkout = prepareCheckout(this.selectedItems, this.categories)
        if (!checkout.valid) {
          if (checkout.questionnaireCheck?.state === 'required') {
            uni.navigateTo({ url: buildQuestionnaireNoticeUrl(checkout.questionnaireCheck.item,
              { action: 'checkout', selectedItems: checkout.productIds }) })
            return
          }
          uni.showToast({ title: checkout.message, icon: 'none' })
          logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED', extraData: { ...actionLog.extraData, reason: 'CHECKOUT_REJECTED' } })
          return
        }

        const selectedItemsParam = checkout.productIds.join(',')
        if (!checkout.requiresConsultation) {
          uni.removeStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID)
          uni.navigateTo({
            url: '/pages/order/confirm?selectedItems=' + selectedItemsParam
          })
          return
        }

        uni.navigateTo({
          url: '/pages/dispense/apply?selectedItems=' + selectedItemsParam
        })
      } catch (error) {
        console.error('goToCheckout failed:', error)
        this.showCartError(error)
      }
    },
    handleTabChange(tab) {
      this.currentTab = tab
    }
  }
}
</script>

<style scoped>
.cart-container {
  width: 100%;
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: calc(  env(safe-area-inset-bottom));
}

.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 30rpx 16rpx;
  background: linear-gradient(135deg, #4A90E2 0%, #67B26F 100%);
}

.header-left {
  display: flex;
  align-items: center;
}

.header-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #ffffff;
  letter-spacing: 2rpx;
}

.header-decoration {
  display: flex;
  align-items: center;
  padding: 0 30rpx 20rpx;
  background: linear-gradient(135deg, #4A90E2 0%, #67B26F 100%);
}

.deco-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  margin-right: 16rpx;
}

.deco-dot.dot1 {
  background: rgba(255, 255, 255, 0.9);
}

.deco-dot.dot2 {
  background: rgba(255, 255, 255, 0.6);
  width: 8rpx;
  height: 8rpx;
}

.deco-dot.dot3 {
  background: rgba(255, 255, 255, 0.3);
  width: 6rpx;
  height: 6rpx;
}

.banner-section {
  width: 100%;
  margin-bottom: 20rpx;
  overflow: hidden;
  background: #ffffff;
}

.banner-image {
  width: 100%;
  height: auto;
  display: block;
}

.cart-content {
  flex: 1;
  padding: 0 20rpx calc(120rpx + 100rpx + env(safe-area-inset-bottom) + 20rpx) 20rpx;
}

.empty-cart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 240rpx 0;
  background: #ffffff;
  border-radius: 16rpx;
  margin: 20rpx 0;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
}

.empty-icon {
  width: 220rpx;
  height: 220rpx;
  margin-bottom: 40rpx;
  opacity: 0.7;
  filter: drop-shadow(0 4rpx 12rpx rgba(74, 144, 226, 0.15));
}

.empty-text {
  font-size: 30rpx;
  color: #666666;
  margin-bottom: 60rpx;
  font-weight: 500;
  letter-spacing: 1rpx;
}

.go-shopping-btn {
  background: #4A90E2;
  color: #ffffff;
  font-size: 28rpx;
  padding: 16rpx 48rpx;
  border-radius: 999rpx;
  border: none;
  font-weight: 500;
  transition: all 0.3s ease;
  letter-spacing: 1rpx;
}

.cart-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 0;
}

.cart-item {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
}

.cart-item.unavailable {
  opacity: 0.65;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 44rpx;
  min-height: 72rpx;
}

.checkbox-wrapper.disabled {
  opacity: 0.45;
}

.checkbox {
  position: relative;
  box-sizing: border-box;
  flex: 0 0 44rpx;
  width: 44rpx;
  height: 44rpx;
  border: 2rpx solid #e1e8ed;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  background: #ffffff;
}

.checkbox.checked {
  background: #4A90E2;
  border-color: #4A90E2;
}

.checkbox.checked::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 10rpx;
  height: 20rpx;
  border: solid #ffffff;
  border-width: 0 3rpx 3rpx 0;
  transform: translate(-50%, -60%) rotate(45deg);
}

.checkbox.disabled {
  background: #f1f3f5;
  border-color: #d8dee4;
  box-shadow: none;
}

.item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.item-image {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  background-color: #f5f5f5;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 160rpx;
  padding: 4rpx 0;
}

.item-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 12rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
  letter-spacing: 0.5rpx;
}

.item-desc {
  font-size: 24rpx;
  color: #7f8c8d;
  margin-bottom: 16rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  line-height: 1.4;
  font-weight: 400;
}

.item-unavailable {
  font-size: 22rpx;
  color: #e74c3c;
  margin-bottom: 8rpx;
}

.item-bottom {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: auto;
}

.item-price {
  font-size: 34rpx;
  font-weight: bold;
  color: #e74c3c;
  text-shadow: 0 1rpx 2rpx rgba(231, 76, 60, 0.2);
}

.quantity-controls {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  margin-left: auto;
  gap: 16rpx;
  background: #f5f5f5;
  border-radius: 30rpx;
  padding: 6rpx 12rpx;
}

.quantity-btn {
  width: 44rpx;
  height: 44rpx;
  background: #4A90E2;
  color: #ffffff;
  font-size: 26rpx;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  font-weight: bold;
  padding: 0;
  flex-shrink: 0;
}

.quantity-btn.disabled {
  background: #cccccc;
  color: #888888;
}

.quantity-text {
  font-size: 26rpx;
  color: #333333;
  min-width: 36rpx;
  text-align: center;
}

.delete-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #ff6b6b;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.checkout-bar {
  position: fixed;
  bottom: calc(100rpx + env(safe-area-inset-bottom));
  left: 0;
  right: 0;
  height: 120rpx;
  background: #ffffff;
  border-top: 1rpx solid #e5e5e5;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  z-index: 100;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
}

.select-all-wrapper {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 16rpx;
  margin-right: 24rpx;
}

.select-all-text {
  white-space: nowrap;
  font-size: 28rpx;
  color: #2c3e50;
  font-weight: 500;
}

.checkout-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.total-text {
  font-size: 24rpx;
  color: #7f8c8d;
  margin-bottom: 6rpx;
  font-weight: 400;
}

.total-price {
  font-size: 34rpx;
  font-weight: bold;
  color: #e74c3c;
  text-shadow: 0 1rpx 2rpx rgba(231, 76, 60, 0.2);
}

.total-count {
  font-size: 22rpx;
  color: #95a5a6;
  font-weight: 400;
}

.checkout-btn {
  background-color: #4A90E2;
  color: #ffffff;
  font-size: 32rpx;
  padding: 4rpx 60rpx;
  border-radius: 60rpx;
  border: none;
  font-weight: 500;
  min-width: auto;
}

.checkout-btn[disabled] {
  background-color: #cccccc;
  color: #999999;
}

.go-shopping-btn:hover {
  transform: translateY(-2rpx);
  box-shadow: 0 12rpx 32rpx rgba(74, 144, 226, 0.4);
}
</style>
