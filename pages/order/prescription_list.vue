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
    <view
      class="hero"
      :style="{ paddingTop: statusBarHeight + 'px' }"
    >
      <view class="hero-nav">
        <view
          class="hero-back"
          @click="goBack"
        >
          <uni-icons
            type="left"
            size="22"
            color="#ffffff"
          />
        </view>
        <text class="hero-title">
          详情
        </text>
        <view class="hero-nav-holder" />
      </view>
      <view class="hero-status">
        <view class="hero-check">
          ✓
        </view>
        <text class="hero-status-text">
          {{ currentPrescription ? getPrescriptionStatusText(currentPrescription) : '处方结算' }}
        </text>
      </view>
    </view>

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
          <text class="section-icon">
            辽宁中医药大学附属医院互联网医院
          </text>
          <text class="section-title">
            用药建议
          </text>
        </view>
        <view class="consultation-row patient-row">
          <text class="consultation-label">
            患者信息：
          </text>
          <view
            v-if="currentPrescription.patientSnapshotAvailable"
            class="patient-info"
          >
            <text class="patient-name">
              {{ currentPrescription.patientName }}
            </text>
            <view class="patient-divider" />
            <text class="patient-meta">
              {{ currentPrescription.patientGender }}
            </text>
            <view class="patient-divider" />
            <text class="patient-meta">
              {{ currentPrescription.patientAge ?? '—' }}岁
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
            就诊科室：
          </text>
          <text class="consultation-value">
            全科
          </text>
        </view>
        <view class="consultation-row">
          <text class="consultation-label">
            费别：
          </text>
          <text class="consultation-value">
            自费
          </text>
        </view>
        <view class="consultation-row">
          <text class="consultation-label">
            开方时间：
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

      <!-- <view class="list-heading">
        <text class="section-title list-title">
          结算商品
        </text>
        <text class="list-count">
          共 {{ cartItemsList.length }} 项
        </text>
      </view> -->

      <view
        v-if="cartItemsList.length > 0"
        class="prescription-card"
      >
        <view class="prescription-heading">
          <text class="prescription-heading-title">
            处方信息
          </text>
          <view
            class="prescription-heading-link"
            @click="goToPrescriptionDetail"
          >
            <!-- <text class="prescription-heading-link-text">
              查看原始处方
            </text>
            <uni-icons
              type="right"
              size="12"
              color="#8a94a6"
            /> -->
          </view>
        </view>

        <view
          v-for="cartItem in cartItemsList"
          :key="cartItem.id"
          class="prescription-item"
          @click="onCartItemClick(cartItem)"
        >
          <view class="prescription-content">
            <view class="prescription-main">
              <text class="product-name">
                {{ cartItem.name }}
              </text>
              <text
                v-if="cartItem.skuSpecText || cartItem.specText || cartItem.skuName"
                class="product-spec"
              >
                {{ cartItem.skuSpecText || cartItem.specText || cartItem.skuName }}
              </text>
              <text class="product-quantity">
                ×{{ cartItem.quantity }}
              </text>
            </view>
            <text
              v-if="cartItem.usageDesc"
              class="product-usage"
            >
              {{ cartItem.usageDesc }}
            </text>
          </view>
          <uni-icons
            class="prescription-arrow"
            type="right"
            size="14"
            color="#c2c8d2"
          />
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
            color="#2f7cf6"
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
import { ref, computed } from 'vue'
// uni-app 生命周期钩子
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
// 时间处理库
import dayjs from 'dayjs'

// ==================== 工具函数 ====================
import {
  loadCartItems,
  refreshCart,
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
import { getSessionGeneration, assertCurrentSession, isCurrentSession } from '@/utils/session.js'
import { loadCartProducts } from '@/utils/cart-products.js'
import { getProductDetail } from '@/api/product.js'
import { getDoctorDetail } from '@/api/hospital.js'
import { getPrescriptionStatusText, resolvePrescriptionDoctorName } from '@/utils/prescription.js'

// ==================== 其他 ====================
import { logPageView, logButtonClick, logAccess } from '@/utils/accessLog.js'

const PAGE_LOG = { moduleCode: 'PRESCRIPTION', accessType: '处方', pageType: 'PRESCRIPTION_LIST', pageId: '', requestUri: '/pages/order/prescription_list' }

// ==================== 响应式数据 ====================
/**
 * 选中的购物车产品ID列表 - 用户选择要购买的处方
 */
const selectedCartIds = ref([])
// 自定义导航：状态栏高度，用于顶部渐变区域留白
const statusBarHeight = ref(24)

const goBack = () => {
  uni.navigateBack({
    fail: () => {
      uni.switchTab({ url: '/pages/index/index' })
    }
  })
}

/**
 * 查看原始处方
 */
const goToPrescriptionDetail = () => {
  const prescriptionId = currentPrescription.value?.id || currentPrescription.value?.prescriptionId
  if (!prescriptionId) {
    uni.showToast({ title: '暂无原始处方', icon: 'none' })
    return
  }
  uni.navigateTo({ url: `/pages/prescription/detail?prescriptionId=${prescriptionId}` })
}



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

const syncSelectedCartState = async () => {
  const cartIds = cartItemsList.value
    .map(item => normalizeCartId(item.id))
    .filter(Boolean)

  if (cartIds.length === 0) {
    selectedCartIds.value = []
    return
  }

  // 不做勾选：处方内商品默认全部选中
  if (!directPurchase.value) {
    await updateMultipleSelections(buildSelectionMap(cartIds, true))
    assertCurrentSession(pageSession)
    if (!pageActive) return
  }
  selectedCartIds.value = [...cartIds]
  if (!directPurchase.value) setCheckoutProductIds(cartIds)
}

  // ==================== 生命周期钩子 ====================
  /**
   * 页面加载时处理
   * 本次问诊和就诊人必须由入口明确传入。
   */
  onLoad((options) => {
    try {
      const info = uni.getWindowInfo?.() || uni.getSystemInfoSync?.() || {}
      statusBarHeight.value = info.statusBarHeight || 24
    } catch {
      statusBarHeight.value = 24
    }
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
  onShow(() => {
    if (pageActive && isCurrentSession(pageSession)) logPageView({ ...PAGE_LOG, actionCode: 'PRESCRIPTION_LIST_VIEW', accessTitle: '本次复诊处方确认', accessDescription: '进入本次复诊处方确认页，查看处方与准备结算的商品', extraData: { consultationId: checkoutContext.value?.consultationId || '', checkoutSource: directPurchase.value ? 'DIRECT' : 'CART' } })
    return loadPage()
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
      await syncSelectedCartState()
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
   * 刷新服务端购物车，再按本次结算的规格加载商品详情
   * 每次进入页面都会重新加载，确保数据最新
   */
  const loadProducts = async (requestId) => {
    try {
      if (checkoutRouteError.value) throw new Error(checkoutRouteError.value)
      if (!directPurchase.value) await refreshCart()
      assertCurrentSession(pageSession)
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
  const selectionSaving = ref(false)
  const toggleCartSelect = async (cartItemId) => {
    const normalizedId = normalizeCartId(cartItemId)
    if (!normalizedId || selectionSaving.value) return
    const selected = !selectedCartIds.value.includes(normalizedId)
    selectionSaving.value = true
    try {
      if (!directPurchase.value) await updateProductSelection(normalizedId, selected)
      assertCurrentSession(pageSession)
      if (!pageActive) return
      selectedCartIds.value = selected
        ? [...selectedCartIds.value, normalizedId]
        : selectedCartIds.value.filter(id => id !== normalizedId)
      if (!directPurchase.value) setCheckoutProductIds(selectedCartIds.value)
    } catch (error) {
      if (pageActive && error.code !== 'SESSION_CHANGED') {
        if (!directPurchase.value) {
          const confirmed = getSelectedProductIds()
          selectedCartIds.value = cartItemsList.value.map(item => String(item.id)).filter(id => confirmed.includes(id))
          setCheckoutProductIds(selectedCartIds.value)
        }
        uni.showToast({ title: error.message || '修改选择失败', icon: 'none' })
      }
    } finally { selectionSaving.value = false }
  }

  const toggleCartSelectAll = async () => {
    if (selectionSaving.value) return
    const allProductIds = cartItemsList.value.map(item => normalizeCartId(item.id)).filter(Boolean)
    const selected = !isCartAllSelected.value
    selectionSaving.value = true
    try {
      if (!directPurchase.value) await updateMultipleSelections(buildSelectionMap(allProductIds, selected))
      assertCurrentSession(pageSession)
      if (!pageActive) return
      selectedCartIds.value = selected ? allProductIds : []
      if (!directPurchase.value) setCheckoutProductIds(selectedCartIds.value)
    } catch (error) {
      if (pageActive && error.code !== 'SESSION_CHANGED') {
        if (!directPurchase.value) {
          const confirmed = getSelectedProductIds()
          selectedCartIds.value = cartItemsList.value.map(item => String(item.id)).filter(id => confirmed.includes(id))
          setCheckoutProductIds(selectedCartIds.value)
        }
        uni.showToast({ title: error.message || '修改选择失败', icon: 'none' })
      }
    } finally { selectionSaving.value = false }
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
    if (!pageActive || !isCurrentSession(pageSession)) return
    if (checkoutRouteError.value) {
      logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'PRESCRIPTION_CHECKOUT_RESULT', actionResult: 'FAILED', accessTitle: '确认处方商品', accessDescription: '购买上下文无效，未进入订单确认', extraData: { reason: 'INVALID_CHECKOUT_CONTEXT' } })
      uni.showToast({ title: checkoutRouteError.value, icon: 'none' }); return
    }
    if (!canSubmit.value) {
      logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'PRESCRIPTION_CHECKOUT_RESULT', actionResult: 'FAILED', accessTitle: '确认处方商品', accessDescription: '本次处方或商品尚不可结算，未进入订单确认', extraData: { reason: 'CHECKOUT_NOT_READY' } })
      uni.showToast({ title: loadError.value || '本次处方或所选商品不可结算，请检查后重试', icon: 'none' })
      return
    }
    try {
      if (!pageActive) return
      assertCurrentSession(pageSession)
      logButtonClick({ ...PAGE_LOG, actionCode: 'PRESCRIPTION_CHECKOUT', accessTitle: '确认处方商品', accessDescription: '确认本次处方所选商品并进入订单确认', extraData: { consultationId: checkoutContext.value?.consultationId || '', selectedCount: selectedCartIds.value.length } })

      // 获取用户选中的商品ID列表
      const selectedProductIds = selectedCartIds.value

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
  background: #f4f6fa;
}

.page.with-footer {
  padding-bottom: calc(184rpx + env(safe-area-inset-bottom));
}

/* 顶部蓝色头部：向下延伸至卡片分割线下方一点，与卡片衔接 */
.hero {
  position: relative;
  z-index: 1;
  padding: 40rpx 32rpx 196rpx;
  border-radius: 0 0 20rpx 20rpx;
  overflow: hidden;
  background: linear-gradient(160deg, #2f7cf6, #4a9bff);
  color: #fff;
}

.hero-nav {
  display: flex;
  align-items: center;
  height: 88rpx;
}

.hero-back,
.hero-nav-holder {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 80rpx;
  height: 88rpx;
}

.hero-title {
  flex: 1;
  font-size: 34rpx;
  font-weight: 500;
  line-height: 1.4;
  text-align: center;
  color: #fff;
}

.hero-status {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 12rpx;
}

.hero-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44rpx;
  height: 44rpx;
  margin-right: 14rpx;
  border: 2rpx solid #fff;
  border-radius: 50%;
  font-size: 26rpx;
  line-height: 1;
}

.hero-status-text {
  font-size: 34rpx;
  font-weight: 500;
  line-height: 1.4;
}

.page-content {
  position: relative;
  z-index: 2;
  margin-top: -190rpx;
  padding: 24rpx 24rpx 24rpx;
}

.load-state {
  margin-bottom: 24rpx;
  padding: 28rpx;
  border-radius: 20rpx;
  background: #fff;
  font-size: 26rpx;
  line-height: 1.6;
  color: #5a6b80;
  word-break: break-all;
}

.consultation-card {
  margin-bottom: 20rpx;
  padding: 32rpx;
  border-radius: 20rpx;
  background: #fff;
  box-shadow: 0 4rpx 20rpx rgba(47, 124, 246, 0.06);
}

.section-heading {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 8rpx;
  padding: 0 0 24rpx;
  border-bottom: 1rpx solid #eef1f6;
  text-align: center;
}

.section-icon {
  margin-bottom: 12rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #8a94a6;
  text-align: center;
}

.section-title {
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1.4;
  color: #1f2d3d;
  text-align: center;
}

.consultation-row {
  display: flex;
  align-items: baseline;
  margin-top: 22rpx;
  font-size: 28rpx;
  line-height: 1.6;
}

.consultation-label {
  flex-shrink: 0;
  width: 150rpx;
  color: #8a94a6;
}

.patient-info {
  display: flex;
  flex: 1;
  flex-wrap: nowrap;
  align-items: baseline;
  min-width: 0;
}

.patient-name,
.patient-meta {
  white-space: nowrap;
}

.patient-name {
  margin-right: 0;
  font-size: 26rpx;
  color: #1f2d3d;
  word-break: break-all;
}

.patient-divider {
  align-self: center;
  flex-shrink: 0;
  width: 1rpx;
  height: 24rpx;
  margin: 0 16rpx;
  background: #d5dbe5;
}

.patient-meta {
  font-size: 26rpx;
  color: #5a6b80;
}

.consultation-value {
  flex: 1;
  min-width: 0;
  color: #1f2d3d;
  word-break: break-all;
}

.list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 8rpx 20rpx;
}

.list-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2d3d;
}

.list-count,
.selection-summary {
  flex-shrink: 0;
  margin-left: 16rpx;
  font-size: 24rpx;
  color: #8a94a6;
}

.prescription-card {
  margin-bottom: 20rpx;
  border-radius: 20rpx;
  background: #fff;
  box-shadow: 0 4rpx 20rpx rgba(47, 124, 246, 0.06);
  overflow: hidden;
}

.prescription-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 28rpx 8rpx;
}

.prescription-heading-title {
  font-size: 32rpx;
  font-weight: 700;
  line-height: 1.4;
  color: #1f2d3d;
}

.prescription-heading-link {
  display: flex;
  align-items: center;
}

.prescription-heading-link-text {
  margin-right: 6rpx;
  font-size: 26rpx;
  line-height: 1.4;
  color: #8a94a6;
}

.prescription-item {
  display: flex;
  align-items: flex-start;
  padding: 20rpx 28rpx 32rpx;
}

.prescription-item + .prescription-item {
  padding-top: 28rpx;
  border-top: 1rpx solid #f1f3f7;
}

.prescription-arrow {
  flex-shrink: 0;
  margin: 10rpx 0 0 12rpx;
}

.prescription-content {
  flex: 1;
  min-width: 0;
}

.prescription-main {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
}

.product-name {
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1.5;
  color: #1f2d3d;
  word-break: break-all;
}

.product-spec {
  margin-left: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #8a94a6;
  word-break: break-all;
}

.product-quantity {
  margin-left: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #8a94a6;
  white-space: nowrap;
}

.product-usage {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #8a94a6;
  word-break: break-all;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 96rpx 32rpx;
  border-radius: 20rpx;
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
  background: #eaf2ff;
}

.empty-title {
  margin-bottom: 16rpx;
  font-size: 30rpx;
  font-weight: 500;
  color: #1f2d3d;
}

.empty-description {
  font-size: 26rpx;
  line-height: 1.6;
  color: #8a94a6;
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
  padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #eef1f6;
  background: #fff;
  box-shadow: 0 -4rpx 20rpx rgba(47, 124, 246, 0.06);
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
  color: #8a94a6;
}

.amount-value {
  font-size: 38rpx;
  font-weight: 600;
  color: #2f7cf6;
  word-break: break-all;
}

.selection-detail {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.4;
  color: #5a6b80;
}

.selected-count {
  font-weight: 600;
  color: #2f7cf6;
}

.order-btn {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  min-width: 240rpx;
  height: 92rpx;
  margin: 0;
  padding: 0 44rpx;
  border: none;
  border-radius: 46rpx;
  background: linear-gradient(135deg, #2f7cf6, #4a9bff);
  font-size: 32rpx;
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
