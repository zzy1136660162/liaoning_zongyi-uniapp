<!--
  处方列表页面
  主要功能：展示购物车中的商品，每个商品以处方卡片的形式显示
  支持选择商品和批量下单
-->
<template>
  <view class="page">
    <!-- 页面头部：医院信息和用户信息 -->
    <!--      <view class="header-info">
        <view class="hospital">{{ hospitalName }}</view>
        <view class="user-info" @click="onSelectUser">
          {{ currentUserName }}
        </view>
      </view>-->
      
    <!-- 日期选择区域（目前用于占位，后续可扩展筛选功能） -->
    <!--      <view class="date-section">
        <view class="date-label">日期选择</view>
        <view class="date-range" @click="onSelectDate">
        选择时间范围
        </view>
      </view>-->
      
    <!-- 标签筛选区域（保留布局结构，后续可扩展） -->
    <view class="filter-tabs">
      <view class="tab-item active">
        全部处方
      </view>
    </view>
    <!-- 主要内容区域 -->
    <view style="padding: 20rpx;">
      <!-- 可滚动的产品列表区域 -->
      <scroll-view
        class="prescription-list"
        scroll-y
      >
        <!-- 全选控制栏 -->
        <view class="select-all-bar">
          <view class="select-controls">
            <!-- 全选按钮：仅在有商品时显示 -->
            <view
              v-if="cartItemsList.length > 0"
              class="select-all"
              @click="toggleCartSelectAll"
            >
              <view
                class="checkbox"
                :class="{ checked: isCartAllSelected }"
              />
              <text>全选处方</text>
            </view>
          </view>
          <!-- 就诊时间显示：仅在有处方信息时显示 -->
          <view
            v-if="currentPrescription"
            class="consultation-time"
          >
            就诊时间: {{ latestConsultationTime }}
          </view>
        </view>
        
        <!-- 购物车商品列表：每个商品以处方卡片形式展示 -->
        <template
          v-for="cartItem in cartItemsList"
          :key="cartItem.id"
        >
          <view class="prescription-item">
            <!-- 商品选择框 -->
            <view
              class="prescription-checkbox"
              @click="toggleCartSelect(cartItem.id)"
            >
              <view
                class="checkbox"
                :class="{ checked: isCartItemSelected(cartItem.id) }"
              />
            </view>

            <!-- 商品信息内容区域 -->
            <view
              class="prescription-content"
              @click="onCartItemClick(cartItem)"
            >
              <!-- 商品名称 -->
              <view class="prescription-header">
                <text class="doctor-name">
                  {{ cartItem.name }}
                </text>
              </view>

              <!-- 商品标签 -->
              <view class="prescription-tags">
                <view class="tag">
                  中药
                </view>
                <view class="tag tag-online">
                  在线复诊
                </view>
                <view class="tag tag-convenient">
                  便捷配制剂
                </view>
              </view>

              <!-- 诊断信息 -->
              <view class="prescription-info">
                <text class="info-label">
                  诊断:
                </text>
                <text class="info-value">
                  {{ cartItem.diagnosis || '无' }}
                </text>
              </view>

              <!-- 医师信息 -->
              <view class="prescription-info">
                <text class="info-label">
                  医师:
                </text>
                <text class="info-value">
                  {{ currentPrescriptionDoctorName || cartItem.doctorName || '医师' }}
                </text>
              </view>

              <!-- 商品说明 -->
              <!-- <view
                v-if="cartItem.description"
                class="prescription-info"
              >
                <text class="info-label">
                  说明:
                </text>
                <text class="info-value">
                  {{ cartItem.description }}
                </text>
              </view> -->

              <!-- 商品数量和单价 -->
              <view class="prescription-info prescription-info-inline">
                <text class="info-label">
                  数量:
                </text>
                <text class="info-value">
                  {{ cartItem.quantity }}
                </text>
                <text class="info-label info-label-spaced">
                  单价:
                </text>
                <text class="info-value">
                  ¥{{ cartItem.price.toFixed(2) }}
                </text>
              </view>

              <!-- 商品总价和单位 -->
              <view class="prescription-footer">
                <view class="prescription-status">
                  <text class="status-text">
                    ¥{{ (cartItem.price * cartItem.quantity).toFixed(2) }}
                  </text>
                  <text class="status-time">
                    {{ cartItem.unit || '份' }}
                  </text>
                </view>
              </view>
            </view>
          </view>
        </template>
      </scroll-view>
    </view>

    <!-- 底部操作栏：仅在选中商品时显示 -->
    <view
      v-if="selectedCartCount > 0"
      class="footer"
    >
      <view class="footer-left">
        <!-- 显示选中的处方数量 -->
        <view>
          已选择 <text class="selected-count">
            {{ selectedCartCount }}
          </text> 张处方
        </view>
        <!-- 显示选中的商品总金额 -->
        <view class="total-amount">
          合计: ¥<text class="amount-value">
            {{ selectedCartTotal.toFixed(2) }}
          </text>
        </view>
      </view>
      <!-- 下单按钮 -->
      <button
        class="order-btn"
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
import { onLoad } from '@dcloudio/uni-app'
// 时间处理库
import dayjs from 'dayjs'

// ==================== 存储键常量 ====================
import { 
  STORAGE_KEY_USER_REGISTER,
  STORAGE_KEY_CURRENT_ORDER,
  STORAGE_KEY_VERIFIED_PRODUCTS,
  STORAGE_KEY_CURRENT_CONSULTATION_ID
} from '@/utils/storage.js'

// ==================== 工具函数 ====================
import {
  loadCartItems,
  buildOrderInfo,
  getCurrentCheckoutProductIds,
  getCartProductQuantity,
  updateProductSelection,
  updateMultipleSelections,
  getSelectedProductIds,
  setCheckoutProductIds
} from '@/utils/cart.js'

// ==================== API 接口 ====================
import { getConsultationDetail } from '@/api/consultation.js'
import { getProductDetail } from '@/api/product.js'
import { resolveConsultationDoctorName } from '@/utils/consultation-mode.js'

// ==================== 其他 ====================
import { logPageView } from '@/api/access-log.js'
  
// ==================== 响应式数据 ====================
/**
 * 医院名称 - 显示在页面顶部
 */
  const hospitalName = ref('辽宁中医药大学附属医院')

/**
 * 当前用户名 - 显示在页面顶部右侧
 */
const currentUserName = ref('')

/**
 * 选中的购物车产品ID列表 - 用户选择要购买的处方
 */
const selectedCartIds = ref([])

/**
 * 购物车产品分类数据 - 用于加载购物车商品信息
 */
  const categories = ref([])

/**
 * 当前显示的处方信息 - 用于显示就诊时间等信息
 */
const currentPrescription = ref(null)

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
   * 支持通过 URL 参数或本地存储获取咨询ID
   */
  onLoad((options) => {
    const selectedItems = options?.selectedItems
      ? options.selectedItems.split(',').map(id => normalizeCartId(id)).filter(Boolean)
      : []
    if (selectedItems.length > 0) {
      setCheckoutProductIds(selectedItems)
    }

    const consultationId = options?.consultationId || uni.getStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID)
    if (consultationId) {
      loadSingleConsultation(consultationId)
    }
    // 如果没有consultationId，页面仍可正常显示购物车商品
  })

  /**
   * 页面挂载时初始化数据
   */
  onMounted(async () => {
    const consultationId = uni.getStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID)
    if (consultationId) {
      await loadSingleConsultation(consultationId)
    }
    await loadProducts()
    loadUserInfo()
    loadSelectedProducts()

    logPageView('处方列表', '用户进入处方列表页面')
  })
  
  const loadUserInfo = () => {
    try {
      const userInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
      if (userInfo && userInfo.realName) {
        currentUserName.value = userInfo.realName
      }
    } catch (e) {
      console.error('加载用户信息失败:', e)
    }
  }
  
  /**
   * 加载用户之前选中的产品状态
   */
  const loadSelectedProducts = () => {
    try {
      syncSelectedCartState()
    } catch (e) {
      console.error('加载选中产品状态失败:', e)
      selectedCartIds.value = []
    }
  }


  /**
   * 加载单条咨询详情
   * 用于从其他页面跳转过来时获取咨询信息
   * @param {string} consultationId - 咨询ID
   */
  const loadSingleConsultation = async (consultationId) => {
    try {
      if (!consultationId) {
        console.warn('未提供咨询ID')
        return
      }

      uni.showLoading({ title: '加载中...' })

      // 调用API获取咨询详情
      const consultation = await getConsultationDetail(consultationId)
      console.log('咨询详情:', consultation)

      if (consultation) {
        // 将API返回的数据转换为页面所需的处方格式
        const apiPrescription = {
          id: consultation.id || String(1),
          visitNo: consultation.consultationNo || consultation.id,
          doctorName: resolveConsultationDoctorName(consultation) || '医生',
          department: consultation.department || '便捷配药门诊',
          consultationTime: consultation.consultationTime || consultation.createdAt,
          diagnosis: consultation.diagnosis || '待诊断',
          doses: consultation.doses || 1,
          details: consultation.symptoms || '详情',
          tags: consultation.tags || ['在线复诊'],
          timeLimit: '待处理',
          hospital: consultation.hospitalName || hospitalName.value,
          createdAt: consultation.createdAt,
          productId: consultation.productId,
          productPrice: consultation.totalAmount || 0,
          quantity: consultation.quantity || 1
        }

        // 保存当前处方信息，用于显示就诊时间等
        currentPrescription.value = apiPrescription
        if (apiPrescription.doctorName && categories.value.length > 0) {
          categories.value = categories.value.map(category => ({
            ...category,
            products: (category.products || []).map(product => ({
              ...product,
              doctorName: apiPrescription.doctorName
            }))
          }))
        }
      }

      uni.hideLoading()
    } catch (e) {
      console.error('加载咨询详情失败:', e)
      uni.hideLoading()
    }
  }
  
  /**
   * 加载购物车产品数据
   * 从本地存储中获取已验证的商品ID，然后批量获取商品详情
   * 每次进入页面都会重新加载，确保数据最新
   */
  const loadProducts = async () => {
    try {
      const checkoutIds = getCurrentCheckoutProductIds()
      const verifiedProducts = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
      const productIds = checkoutIds.length > 0
        ? checkoutIds
        : Object.keys(verifiedProducts).filter(id => verifiedProducts[id])
      
      // 如果购物车为空，不需要加载商品数据
      if (productIds.length === 0) {
        categories.value = []
        return
      }

      console.log('正在加载购物车商品数据...', productIds)
      uni.showLoading({ title: '加载商品...' })
      
      // 创建购物车商品分类结构
      const cartCategory = {
        id: 'cart_items',
        name: '购物车商品',
        products: []
      }
      
      // 逐个获取购物车中每个商品的详细信息
      for (const productId of productIds) {
        try {
          if (typeof getProductDetail === 'function') {
            const productDetail = await getProductDetail(productId)
            if (productDetail) {
              // 将API返回的数据转换为页面所需的格式
              cartCategory.products.push({
                id: productDetail.id,
                name: productDetail.productName || productDetail.name,
                description: productDetail.subTitle || productDetail.description,
                image: productDetail.coverImage || productDetail.image,
                price: productDetail.price,
                quantity: getCartProductQuantity(productId, 1),
                unit: productDetail.unit || '份',
                notice: productDetail.usageDesc || productDetail.notice,
                doctorName: currentPrescriptionDoctorName.value || productDetail.doctorName || '医师'
              })
            }
          } else {
            console.warn('商品详情API不可用，跳过商品:', productId)
          }
        } catch (err) {
          console.error(`获取商品详情失败 [${productId}]:`, err)
        }
      }
      
      // 更新分类数据，每次都重新计算确保数据准确
      categories.value = [cartCategory]
      
    } catch (error) {
      console.error('加载购物车商品失败:', error)
      categories.value = []
    } finally {
      uni.hideLoading()
    }
  }
  
  
  
/**
 * 获取最新的就诊时间 - 用于显示在页面顶部
 */
  const latestConsultationTime = computed(() => {
  if (!currentPrescription.value) return ''
  const time = currentPrescription.value.consultationTime
    if (!time) return ''
    const d = dayjs(time)
    return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : time
  })

  const currentPrescriptionDoctorName = computed(() => {
    return currentPrescription.value?.doctorName || ''
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
    return loadCartItems(categories.value)
  })
  
  
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
    updateProductSelection(normalizedId, newSelectedState)
    setCheckoutProductIds(selectedCartIds.value)
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
    updateMultipleSelections(selectionMap)
    setCheckoutProductIds(selectedCartIds.value)
  }
  
/**
 * 用户信息点击处理 - 目前显示提示信息
 */
  const onSelectUser = () => {
  uni.showToast({ title: '用户信息', icon: 'none' })
  }
  
/**
 * 日期选择处理 - 目前显示提示信息
 */
  const onSelectDate = () => {
  uni.showToast({ title: '日期选择', icon: 'none' })
  }
  
  
  /**
   * 购物车商品点击处理
   * 用户点击商品卡片时的响应函数
   * @param {Object} cartItem - 被点击的购物车商品对象
   */
  const onCartItemClick = (cartItem) => {
    console.log('用户点击了商品:', cartItem)

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
    // 检查用户是否选择了商品
    if (selectedCartIds.value.length === 0) {
      uni.showToast({
        title: '请选择处方',
        icon: 'none'
      })
      return
    }
    
    try {
      // 获取完整的购物车数据（包含数量等信息）
      const cartItems = loadCartItems(categories.value)
      
      // 获取用户选中的商品ID列表
      const selectedProductIds = selectedCartIds.value
      
      // 使用工具函数构建订单信息
      const orderInfo = buildOrderInfo(cartItems, selectedProductIds, hospitalName.value)
      
      // 将订单信息保存到本地存储，供确认页面使用
      uni.setStorageSync(STORAGE_KEY_CURRENT_ORDER, orderInfo)
      
      // 跳转到订单确认页面
      setCheckoutProductIds(selectedProductIds)
      uni.navigateTo({
        url: `/pages/order/confirm?selectedItems=${selectedProductIds.join(',')}`
      })
    } catch (e) {
      console.error('构建订单信息失败:', e)
      uni.showToast({
        title: '构建订单失败，请重试',
        icon: 'none'
      })
    }
  }
  </script>
  
  <style scoped>
  /* ==================== 页面布局样式 ==================== */
  .page {
  /* 页面背景色 */
    background: #f6f7fb;
  /* 最小高度为视窗高度 */
    min-height: 100vh;
  /* 底部预留空间给固定定位的底部栏 */
    padding-bottom: 200rpx;
  }
  
  .header-info {
    background: #fff;
    padding: 20rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1rpx solid #eee;
  }
  
  .hospital {
    font-size: 28rpx;
    color: #333;
  }
  
  .user-info {
    font-size: 28rpx;
    color: #333;
  }
  
  .date-section {
    background: #fff;
    padding: 20rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1rpx solid #eee;
  }
  
  .date-label {
    font-size: 28rpx;
    color: #333;
  }
  
  .date-range {
    font-size: 28rpx;
    color: #666;
  }
  
  .filter-tabs {
    background: #fff;
    display: flex;
    padding: 20rpx 0;
    border-bottom: 1rpx solid #eee;
  }
  
  .tab-item {
    flex: 1;
    text-align: center;
    font-size: 28rpx;
    color: #666;
    position: relative;
    padding: 10rpx 0;
  }
  
  .tab-item.active {
    color: #2a82e4;
    font-weight: 600;
  }
  
  .tab-badge {
    position: absolute;
    top: -20rpx;
    right: 20rpx;
    background: #ff4d4f;
    color: #fff;
    font-size: 20rpx;
    padding: 2rpx 8rpx;
    border-radius: 20rpx;
    min-width: 32rpx;
    text-align: center;
  }
  
/* 处方列表滚动容器 */
  .prescription-list {
    flex: 1;
  }
  
/* 全选控制栏样式 */
  .select-all-bar {
    background: #fff;
    padding: 20rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20rpx;
    border-radius: 8rpx;
  /* 阴影效果 */
  box-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.05);
}

/* 全选控制按钮组 */
.select-controls {
  display: flex;
  gap: 40rpx;
  }
  
  .select-all {
    display: flex;
    align-items: center;
    gap: 12rpx;
    font-size: 28rpx;
    color: #333;
  }
  
  .checkbox {
    width: 36rpx;
    height: 36rpx;
    border: 2rpx solid #ddd;
    border-radius: 50%;
    position: relative;
  }
  
  .checkbox.checked {
    background: #2a82e4;
    border-color: #2a82e4;
  }
  
  .checkbox.checked::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #fff;
    font-size: 24rpx;
  }
  
  .consultation-time {
    font-size: 24rpx;
    color: #999;
  }
  .selected-count{
    color: #ff4d4f;
    font-size: 36rpx;
    font-weight:bold;
  }
/* ==================== 处方卡片样式 ==================== */
/* 单个处方卡片容器 */
  .prescription-item {
    background: #fff;
    border-radius: 8rpx;
    padding: 20rpx;
    margin-bottom: 20rpx;
    display: flex;
    gap: 20rpx;
  /* 阴影效果 */
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
  /* 过渡动画 */
  transition: all 0.3s ease;
  }
  
/* 处方选择框容器 */
  .prescription-checkbox {
    display: flex;
    align-items: flex-start;
    padding-top: 4rpx;
  /* 防止选择框被压缩 */
  flex-shrink: 0;
  }
  
  .prescription-content {
    flex: 1;
    cursor: pointer;
  }
  
  .prescription-header {
    margin-bottom: 12rpx;
  }
  
  .doctor-name {
    font-size: 30rpx;
    font-weight: 600;
    color: #333;
  }
  
  .prescription-tags {
    display: flex;
    gap: 12rpx;
    margin-bottom: 16rpx;
    flex-wrap: wrap;
  }
  
  .tag {
    padding: 4rpx 12rpx;
    background: #f0f6ff;
    color: #2a82e4;
    font-size: 22rpx;
    border-radius: 4rpx;
  }
  
  /* 蓝底白字标签样式 */
  .tag-online,
  .tag-convenient {
    background: #2a82e4;
    color: #ffffff;
  }
  
  
  .prescription-info {
    margin-bottom: 8rpx;
    font-size: 26rpx;
  }
  
  .prescription-info-inline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }
  
  .info-label {
    color: #666;
    margin-right: 8rpx;
  }
  
  .info-label-spaced {
    margin-left: 20rpx;
  }
  
  .info-value {
    color: #333;
  }
  
  .prescription-footer {
    padding-right: 30rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 16rpx;
    padding-top: 16rpx;
    border-top: 1rpx solid #eee;
  }
  
  .prescription-status {
    display: flex;
    flex-direction: column;
    gap: 4rpx;
  }
  
  .status-text {
    font-size: 28rpx;
    color: #333;
  }
  
  .status-time {
    font-size: 24rpx;
    color: #999;
  }
  
  
  
/* ==================== 底部操作栏样式 ==================== */
/* 固定在底部的操作栏 */
  .footer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 25px;
    background: #fff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20rpx;
  /* 上阴影 */
  box-shadow: 0 -4rpx 12rpx rgba(0, 0, 0, 0.1);
  /* 确保在最上层 */
    z-index: 100;
  /* 右侧额外内边距 */
    padding-right: 30rpx;
  }
  
/* 底部栏左侧信息区域 */
  .footer-left {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    font-size: 28rpx;
    color: #333;
  }
  
  .total-amount {
    font-size: 24rpx;
    color: #666;
  }
  
  .amount-value {
    font-size: 32rpx;
    font-weight: 600;
    color: #ff4d4f;
  }
  
  .order-btn {
    margin: 0;
    background: #2a82e4;
    color: #fff;
    font-size: 30rpx;
    padding: 0rpx 40rpx;
    border-radius: 50rpx;
    border: none;
  }
  </style>
