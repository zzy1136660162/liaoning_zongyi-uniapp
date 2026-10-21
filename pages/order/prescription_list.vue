<!--
  处方列表页面
  主要功能：展示购物车中的商品，每个商品以处方卡片的形式显示
  支持选择商品和批量下单
-->
<template>
  <view
    class="page"
    :class="{ 'with-footer': selectedCartCount > 0 }"
  >
    <view class="page-content">
      <view
        v-if="loading"
        class="load-state"
      >
        正在加载本次处方…
      </view>
      <view
        v-else-if="loadError"
        class="load-state"
        @click="loadPage"
      >
        {{ loadError }}，点击重试
      </view>
      <view
        v-if="currentPrescription"
        class="consultation-card"
      >
        <view class="section-heading">
          <text class="section-title">
            就诊信息
          </text>
        </view>
        <view class="consultation-row patient-row">
          <text class="consultation-label">
            就诊人
          </text>
          <view
            v-if="currentPrescription.patientSnapshotAvailable"
            class="patient-info"
          >
            <text class="patient-name">
              {{ currentPrescription.patientName }}
            </text>
            <text class="patient-meta">
              {{ currentPrescription.patientGender }} {{ currentPrescription.patientAge ?? '—' }}岁
            </text>
          </view>
          <text
            v-else
            class="consultation-value"
          >
            历史记录未关联就诊人
          </text>
        </view>
        <view class="consultation-row">
          <text class="consultation-label">
            就诊时间
          </text>
          <text class="consultation-value">
            {{ latestConsultationTime || '—' }}
          </text>
        </view>
        <view class="consultation-row">
          <text class="consultation-label">
            处方状态
          </text>
          <text class="consultation-value">
            {{ getPrescriptionStatusText(currentPrescription) }}
          </text>
        </view>
      </view>

      <view class="list-heading">
        <text class="section-title list-title">
          结算商品
        </text>
        <text class="list-count">
          共 {{ cartItemsList.length }} 项
        </text>
      </view>

      <view
        v-if="cartItemsList.length > 0"
        class="select-all-bar"
      >
        <view
          class="select-all"
          @click="toggleCartSelectAll"
        >
          <view
            class="checkbox"
            :class="{ checked: isCartAllSelected }"
          />
          <text>全选商品</text>
        </view>
        <text class="selection-summary">
          已选 {{ selectedCartCount }} 项
        </text>
      </view>

      <view class="prescription-list">
        <view
          v-for="cartItem in cartItemsList"
          :key="cartItem.id"
          class="prescription-item"
        >
          <view
            class="prescription-checkbox"
            @click="toggleCartSelect(cartItem.id)"
          >
            <view
              class="checkbox"
              :class="{ checked: isCartItemSelected(cartItem.id) }"
            />
          </view>
          <view
            class="prescription-content"
            @click="onCartItemClick(cartItem)"
          >
            <view class="prescription-header">
              <text class="product-name">
                {{ cartItem.name }}
              </text>
            </view>
            <view class="prescription-tags">
              <view class="tag tag-online">
                {{ resolveProductTypeLabel(cartItem) }}
              </view>
              <view
                v-if="cartItem.productCategory === 1"
                class="tag tag-convenient"
              >
                便捷配制剂
              </view>
            </view>
            <text
              v-if="cartItem.skuSpecText || cartItem.specText || cartItem.skuName"
              class="product-spec"
            >
              {{ cartItem.skuSpecText || cartItem.specText || cartItem.skuName }}
            </text>

            <view
              v-if="cartItem.productCategory === 1"
              class="clinical-info"
            >
              <view class="prescription-info">
                <text class="info-label">
                  本次处方诊断
                </text>
                <text class="info-value">
                  {{ currentPrescription?.diagnosis || '—' }}
                </text>
              </view>
              <view class="prescription-info">
                <text class="info-label">
                  医师
                </text>
                <text class="info-value">
                  {{ prescriptionDoctorName }}
                </text>
              </view>
            </view>

            <view class="quantity-price-row">
              <text class="unit-price">
                单价 ¥{{ cartItem.price.toFixed(2) }}
              </text>
              <text class="product-quantity">
                数量 ×{{ cartItem.quantity }}
              </text>
            </view>
            <view class="prescription-footer">
              <text class="subtotal-label">
                商品小计
              </text>
              <text class="subtotal-value">
                ¥{{ (cartItem.price * cartItem.quantity).toFixed(2) }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <view
        v-if="!loading && !loadError && cartItemsList.length === 0"
        class="empty-state"
      >
        <view class="empty-icon">
          <uni-icons
            type="list"
            size="36"
            color="#2a82e4"
          />
        </view>
        <text class="empty-title">
          暂无结算商品
        </text>
        <text class="empty-description">
          可返回上一页重新选择商品
        </text>
      </view>
    </view>

    <view
      v-if="selectedCartCount > 0"
      class="footer"
    >
      <view class="footer-left">
        <view class="total-amount">
          <text class="total-label">
            合计
          </text>
          <text class="amount-value">
            ¥{{ selectedCartTotal.toFixed(2) }}
          </text>
        </view>
        <view class="selection-detail">
          已选择 <text class="selected-count">
            {{ selectedCartCount }}
          </text> 种商品
        </view>
      </view>
      <button
        class="order-btn"
        :disabled="!canSubmit"
        @click="goToOrder"
      >
        去下单
      </button>
    </view>
  </view>
</template>

<script setup>
// ==================== 导入依赖 ====================
// Vue 3 响应式 API
import { ref, computed, onMounted } from 'vue'
// uni-app 生命周期钩子
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
// 时间处理库
import dayjs from 'dayjs'

// ==================== 存储键常量 ====================
import {
  STORAGE_KEY_CURRENT_ORDER,
} from '@/utils/storage.js'

// ==================== 工具函数 ====================
import {
  loadCartItems,
  buildOrderInfo,
  getCurrentCheckoutProductIds,
  updateProductSelection,
  updateMultipleSelections,
  getSelectedProductIds,
  setCheckoutProductIds,
} from '@/utils/cart.js'
import { parseDirectPurchase, directPurchaseQuery, checkoutEntries } from '@/utils/checkout.js'

// ==================== API 接口 ====================
import { getConsultationDetail, getPrescriptionByConsultation } from '@/api/consultation.js'
import { parseConsultationContext, requireConsultationPatient, requireCreatedPrescription } from '@/utils/consultation-checkout.js'
import { getSessionGeneration, assertCurrentSession } from '@/utils/session.js'
import { loadCartProducts } from '@/utils/cart-products.js'
import { getProductDetail } from '@/api/product.js'
import { getDoctorDetail } from '@/api/hospital.js'
import { getPrescriptionStatusText, resolvePrescriptionDoctorName } from '@/utils/prescription.js'

// ==================== 其他 ====================
import { logPageView } from '@/api/access-log.js'
import { resolveProductTypeLabel } from '@/utils/product-biz.js'

// ==================== 响应式数据 ====================
/**
 * 医院名称 - 显示在页面顶部
 */
  const hospitalName = ref('辽宁中医药大学附属医院')

/**
 * 选中的购物车产品ID列表 - 用户选择要购买的处方
 */
const selectedCartIds = ref([])

/**
 * 购物车产品分类数据 - 用于加载购物车商品信息
 */
  const categories = ref([])

const consultation = ref(null)
const currentPrescription = ref(null)
const prescriptionDoctorName = ref('')
const loading = ref(false)
const loadError = ref('')
const checkoutContext = ref(null)
const directPurchase = ref(null)
const checkoutItemKeys = ref([])
const checkoutRouteError = ref('')
const pageSession = getSessionGeneration()
let pageActive = true
let refreshId = 0
onUnload(() => { pageActive = false; refreshId += 1 })

const normalizeCartId = (value) => {
  if (value === undefined || value === null || value === '') {
    return ''
  }
  return String(value)
}

const buildSelectionMap = (productIds = [], selected = true) => {
  return productIds.reduce((result, productId) => {
    const normalizedId = normalizeCartId(productId)
    if (normalizedId) {
      result[normalizedId] = selected
    }
    return result
  }, {})
}

const isCartItemSelected = (cartItemId) => {
  const normalizedId = normalizeCartId(cartItemId)
  return normalizedId ? selectedCartIds.value.includes(normalizedId) : false
}

const syncSelectedCartState = () => {
  const cartIds = cartItemsList.value
    .map(item => normalizeCartId(item.id))
    .filter(Boolean)

  if (cartIds.length === 0) {
    selectedCartIds.value = []
    return
  }

  if (directPurchase.value) {
    selectedCartIds.value = [...cartIds]
    return
  }

  const checkoutIds = getCurrentCheckoutProductIds()
    .map(id => normalizeCartId(id))
    .filter(Boolean)

  const selectedIds = checkoutIds.length > 0
    ? checkoutIds
    : getSelectedProductIds().map(id => normalizeCartId(id)).filter(Boolean)

  const matchedSelectedIds = cartIds.filter(id => selectedIds.includes(id))

  if (matchedSelectedIds.length === 0) {
    selectedCartIds.value = [...cartIds]
    updateMultipleSelections(buildSelectionMap(cartIds, true))
    setCheckoutProductIds(cartIds)
    return
  }

  selectedCartIds.value = matchedSelectedIds
  setCheckoutProductIds(matchedSelectedIds)
}

  // ==================== 生命周期钩子 ====================
  /**
   * 页面加载时处理
   * 本次问诊和就诊人必须由入口明确传入。
   */
  onLoad((options) => {
    try { directPurchase.value = parseDirectPurchase(options) }
    catch (error) { checkoutRouteError.value = error.message }
    if (directPurchase.value && !options?.selectedItems) checkoutRouteError.value = '购买信息无效，请返回商品页重新选择'
    const selectedItems = options?.selectedItems
      ? options.selectedItems.split(',').map(id => normalizeCartId(id)).filter(Boolean)
      : []
    if (selectedItems.length > 0) {
      checkoutItemKeys.value = selectedItems
      if (!directPurchase.value) setCheckoutProductIds(selectedItems)
    }

    checkoutContext.value = parseConsultationContext(options)
    if (!checkoutContext.value) uni.showToast({ title: '缺少本次复诊信息，请返回重新申请', icon: 'none' })
  })

  /**
   * 页面挂载时初始化数据
   */
  onShow(() => loadPage())
  onMounted(() => {
    logPageView('处方列表', '用户进入处方列表页面')
  })

  const loadPage = async () => {
    if (!pageActive) return
    const requestId = ++refreshId
    loading.value = true
    loadError.value = ''
    consultation.value = null
    currentPrescription.value = null
    prescriptionDoctorName.value = ''
    categories.value = []
    selectedCartIds.value = []
    try {
      assertCurrentSession(pageSession)
      const context = checkoutContext.value
      if (!context) throw new Error('缺少本次复诊信息，请返回重新申请')
      const [record, prescription] = await Promise.all([
        getConsultationDetail(context.consultationId),
        getPrescriptionByConsultation(context.consultationId)
      ])
      if (!pageActive || requestId !== refreshId) return
      assertCurrentSession(pageSession)
      requireConsultationPatient(record, context)
      requireCreatedPrescription(prescription, context)

      let doctorName = resolvePrescriptionDoctorName(prescription)
      if (prescription.doctorId) {
        try {
          const doctor = await getDoctorDetail(prescription.doctorId)
          assertCurrentSession(pageSession)
          doctorName = resolvePrescriptionDoctorName({ ...prescription, doctorName: doctor.name })
        } catch (error) {
          if (error.code === 'SESSION_CHANGED') throw error
        }
      }
      if (!pageActive || requestId !== refreshId) return
      await loadProducts(requestId)
      if (!pageActive || requestId !== refreshId) return
      assertCurrentSession(pageSession)
      consultation.value = record
      currentPrescription.value = prescription
      prescriptionDoctorName.value = doctorName
      syncSelectedCartState()
    } catch (error) {
      if (!pageActive || requestId !== refreshId || error.code === 'SESSION_CHANGED') return
      consultation.value = null
      currentPrescription.value = null
      prescriptionDoctorName.value = ''
      categories.value = []
      selectedCartIds.value = []
      loadError.value = error.message || '本次处方加载失败，请重试'
      uni.showToast({ title: loadError.value, icon: 'none' })
    } finally {
      if (requestId === refreshId) loading.value = false
    }
  }

  /**
   * 加载购物车产品数据
   * 从本地存储中获取已验证的商品ID，然后批量获取商品详情
   * 每次进入页面都会重新加载，确保数据最新
   */
  const loadProducts = async (requestId) => {
    try {
      if (checkoutRouteError.value) throw new Error(checkoutRouteError.value)
      const checkoutIds = checkoutItemKeys.value.length ? checkoutItemKeys.value : getCurrentCheckoutProductIds()
      const productIds = checkoutIds.length > 0
        ? checkoutIds
        : getSelectedProductIds()
      const cartEntries = checkoutEntries(productIds, directPurchase.value)

      // 如果购物车为空，不需要加载商品数据
      if (productIds.length === 0) {
        categories.value = []
        return
      }

      console.debug('event=ui_order_prescription_list stage=load_products result=observed')
      uni.showLoading({ title: '加载商品...' })

      // 创建购物车商品分类结构
      const cartCategory = {
        id: 'cart_items',
        name: '购物车商品',
        products: []
      }

      cartCategory.products = await loadCartProducts(productIds, cartEntries, getProductDetail)
      if (!pageActive || requestId !== refreshId) return
      assertCurrentSession(pageSession)

      // 更新分类数据，每次都重新计算确保数据准确
      categories.value = [cartCategory]

    } finally {
      uni.hideLoading()
    }
  }



/**
 * 获取最新的就诊时间 - 用于显示在页面顶部
 */
  const latestConsultationTime = computed(() => {
  const time = consultation.value?.createdAt
    if (!time) return ''
    const d = dayjs(time)
    return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : time
  })

  // ==================== 购物车相关计算属性 ====================

  /**
   * 已选中的购物车商品数量（处方数量）
   */
  const selectedCartCount = computed(() => {
    return cartItemsList.value.filter(item => isCartItemSelected(item.id)).length
  })

  /**
   * 是否已全选购物车中的所有商品
   */
  const isCartAllSelected = computed(() => {
    return cartItemsList.value.length > 0 &&
           cartItemsList.value.every(item => isCartItemSelected(item.id))
  })

  /**
   * 已选中商品的总金额（处方总价）
   */
  const selectedCartTotal = computed(() => {
    if (selectedCartIds.value.length === 0) return 0

    // 过滤出已选中的商品
    const selectedItems = cartItemsList.value.filter(item => isCartItemSelected(item.id))

    // 计算总价：单价 × 数量
    return selectedItems.reduce((total, item) =>
      total + (item.price * item.quantity), 0
    )
  })


  /**
   * 购物车商品列表
   * 从分类数据中提取所有商品，并包含数量信息
   */
  const cartItemsList = computed(() => {
    if (categories.value.length === 0) {
      return []
    }

    // 使用工具函数加载购物车数据（包含数量信息）
    return loadCartItems(categories.value, false, { entries: checkoutEntries(checkoutItemKeys.value, directPurchase.value), preserveQuantity: true })
  })

  const canSubmit = computed(() => !loading.value && !loadError.value &&
    !!consultation.value && [0, 1].includes(currentPrescription.value?.status) &&
    currentPrescription.value.expired === false && selectedCartCount.value > 0 &&
    cartItemsList.value.filter(item => isCartItemSelected(item.id)).every(item =>
      !item.loadFailure && item.available !== false && (item.stock == null || item.quantity <= item.stock)))


  // ==================== 购物车选择相关方法 ====================

  /**
   * 切换单个购物车商品的选择状态
   * @param {string} cartItemId - 商品ID
   */
  const toggleCartSelect = (cartItemId) => {
    const normalizedId = normalizeCartId(cartItemId)
    if (!normalizedId) {
      return
    }
    const isCurrentlySelected = selectedCartIds.value.includes(normalizedId)
    const newSelectedState = !isCurrentlySelected

    // 更新内存中的选中状态
    if (newSelectedState) {
      selectedCartIds.value.push(normalizedId)
    } else {
      const index = selectedCartIds.value.indexOf(normalizedId)
      if (index > -1) {
        selectedCartIds.value.splice(index, 1)
      }
    }

    // 持久化到storage
    if (!directPurchase.value) updateProductSelection(normalizedId, newSelectedState)
    if (!directPurchase.value) setCheckoutProductIds(selectedCartIds.value)
  }

  /**
   * 切换全选/取消全选状态
   * 如果当前已全选，则取消全选；否则全选所有商品
   */
  const toggleCartSelectAll = () => {
    const allProductIds = cartItemsList.value
      .map(item => normalizeCartId(item.id))
      .filter(Boolean)
    const newSelectedState = !isCartAllSelected.value

    // 更新内存中的选中状态
    selectedCartIds.value = newSelectedState ? [...allProductIds] : []

    // 批量更新storage中的选中状态
    const selectionMap = {}
    allProductIds.forEach(productId => {
      selectionMap[productId] = newSelectedState
    })

    // 使用cart.js中的批量更新函数
    if (!directPurchase.value) updateMultipleSelections(selectionMap)
    if (!directPurchase.value) setCheckoutProductIds(selectedCartIds.value)
  }

  /**
   * 购物车商品点击处理
   * 用户点击商品卡片时的响应函数
   * @param {Object} cartItem - 被点击的购物车商品对象
   */
  const onCartItemClick = (cartItem) => {
    console.debug('event=ui_order_prescription_list stage=on_cart_item_click result=observed')

    // TODO: 可以跳转到商品详情页面或显示商品详情弹窗
    // 目前显示简单的提示信息
        uni.showToast({
      title: `查看 ${cartItem.name}`,
          icon: 'none'
    })
  }

  /**
   * 跳转到订单确认页面
   * 收集用户选中的商品，构建订单信息并跳转到确认页面
   */
  const goToOrder = () => {
    if (checkoutRouteError.value) { uni.showToast({ title: checkoutRouteError.value, icon: 'none' }); return }
    if (!canSubmit.value) {
      uni.showToast({ title: loadError.value || '本次处方或所选商品不可结算，请检查后重试', icon: 'none' })
      return
    }
    try {
      if (!pageActive) return
      assertCurrentSession(pageSession)
      // 获取完整的购物车数据（包含数量等信息）
      const cartItems = cartItemsList.value

      // 获取用户选中的商品ID列表
      const selectedProductIds = selectedCartIds.value

      // 使用工具函数构建订单信息
      const orderInfo = buildOrderInfo(cartItems, selectedProductIds, hospitalName.value)

      // 将订单信息保存到本地存储，供确认页面使用
      uni.setStorageSync(STORAGE_KEY_CURRENT_ORDER, orderInfo)

      // 跳转到订单确认页面
      if (!directPurchase.value) setCheckoutProductIds(selectedProductIds)
      uni.navigateTo({
        url: `/pages/order/confirm?selectedItems=${selectedProductIds.join(',')}&consultationId=${checkoutContext.value.consultationId}&patientId=${checkoutContext.value.patientId}${directPurchaseQuery(directPurchase.value)}`
      })
    } catch (e) {
      if (e.code === 'SESSION_CHANGED') return
      console.error('event=ui_order_prescription_list stage=go_to_order result=failed reason=operation_incomplete')
      uni.showToast({
        title: '构建订单失败，请重试',
        icon: 'none'
      })
    }
  }
  </script>

  <style scoped>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  background: #f6f7fb;
}

.page.with-footer {
  padding-bottom: calc(184rpx + env(safe-area-inset-bottom));
}

.page-content {
  padding: 24rpx;
}

.load-state {
  margin-bottom: 24rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: #fff;
  font-size: 26rpx;
  line-height: 1.6;
  color: #666;
  word-break: break-all;
}

.consultation-card {
  margin-bottom: 32rpx;
  padding: 28rpx;
  border: 1rpx solid #eee;
  border-radius: 24rpx;
  background: #fff;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
}

.section-heading {
  margin-bottom: 24rpx;
  padding-left: 16rpx;
  border-left: 6rpx solid #2a82e4;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.4;
  color: #333;
}

.consultation-row {
  display: flex;
  align-items: baseline;
  margin-top: 18rpx;
  font-size: 26rpx;
  line-height: 1.6;
}

.consultation-label {
  flex-shrink: 0;
  width: 128rpx;
  color: #999;
}

.patient-info {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: baseline;
  min-width: 0;
}

.patient-name {
  margin-right: 20rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  word-break: break-all;
}

.patient-meta {
  font-size: 24rpx;
  color: #666;
}

.consultation-value {
  flex: 1;
  min-width: 0;
  color: #666;
  word-break: break-all;
}

.list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 4rpx 20rpx;
}

.list-title {
  font-size: 32rpx;
}

.list-count,
.selection-summary {
  flex-shrink: 0;
  margin-left: 16rpx;
  font-size: 24rpx;
  color: #999;
}

.select-all-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding: 12rpx 24rpx;
  border: 1rpx solid #eee;
  border-radius: 20rpx;
  background: #fff;
}

.select-all {
  display: flex;
  align-items: center;
  min-height: 64rpx;
  font-size: 26rpx;
  color: #333;
}

.select-all .checkbox {
  margin-right: 16rpx;
}

.checkbox {
  position: relative;
  box-sizing: border-box;
  flex-shrink: 0;
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid #ddd;
  border-radius: 50%;
  background: #fff;
}

.checkbox.checked {
  border-color: #2a82e4;
  background: #2a82e4;
}

.checkbox.checked::after {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 26rpx;
  line-height: 1;
  color: #fff;
  content: '✓';
}

.prescription-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 20rpx;
  padding: 28rpx 24rpx;
  border: 1rpx solid #eee;
  border-radius: 24rpx;
  background: #fff;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
}

.prescription-item:last-child {
  margin-bottom: 0;
}

.prescription-checkbox {
  box-sizing: border-box;
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  width: 64rpx;
  min-height: 88rpx;
  padding-top: 2rpx;
}

.prescription-content {
  flex: 1;
  min-width: 0;
}

.prescription-header {
  margin-bottom: 16rpx;
}

.product-name {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.5;
  color: #333;
  word-break: break-all;
}

.prescription-tags {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 8rpx;
}

.tag {
  margin: 0 12rpx 8rpx 0;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background: #f0f6ff;
  font-size: 22rpx;
  line-height: 1.5;
  color: #2a82e4;
}

.tag-online,
.tag-convenient {
  background: #2a82e4;
  color: #ffffff;
}

.product-spec {
  display: block;
  margin: 8rpx 0 20rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #999;
  word-break: break-all;
}

.clinical-info {
  margin: 16rpx 0 24rpx;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  background: #f6f7fb;
}

.prescription-info {
  display: flex;
  align-items: baseline;
  padding: 4rpx 0;
  font-size: 26rpx;
  line-height: 1.6;
}

.info-label {
  flex-shrink: 0;
  width: 168rpx;
  color: #666;
}

.info-value {
  flex: 1;
  min-width: 0;
  color: #333;
  word-break: break-all;
}

.quantity-price-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-top: 20rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #666;
}

.product-quantity {
  margin-left: 16rpx;
}

.prescription-footer {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #eee;
  line-height: 1.5;
}

.subtotal-label {
  font-size: 24rpx;
  color: #666;
}

.subtotal-value {
  margin-left: 12rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #ff4d4f;
  word-break: break-all;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 96rpx 32rpx;
  border-radius: 24rpx;
  background: #fff;
  text-align: center;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 128rpx;
  height: 128rpx;
  margin-bottom: 28rpx;
  border-radius: 50%;
  background: #f0f6ff;
}

.empty-title {
  margin-bottom: 16rpx;
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
}

.empty-description {
  font-size: 26rpx;
  line-height: 1.6;
  color: #999;
}

.footer {
  position: fixed;
  z-index: 100;
  right: 0;
  bottom: 0;
  left: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.footer-left {
  flex: 1;
  min-width: 0;
  margin-right: 24rpx;
}

.total-amount {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  line-height: 1.4;
}

.total-label {
  margin-right: 12rpx;
  font-size: 24rpx;
  color: #666;
}

.amount-value {
  font-size: 38rpx;
  font-weight: 600;
  color: #ff4d4f;
  word-break: break-all;
}

.selection-detail {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.4;
  color: #333;
}

.selected-count {
  font-weight: 600;
  color: #ff4d4f;
}

.order-btn {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  min-width: 192rpx;
  height: 88rpx;
  margin: 0;
  padding: 0 36rpx;
  border: none;
  border-radius: 44rpx;
  background: #2a82e4;
  font-size: 30rpx;
  font-weight: 500;
  line-height: 1.5;
  color: #fff;
}

.order-btn[disabled] {
  background: #ddd;
  color: #999;
}

.order-btn::after {
  border: none;
}
</style>
