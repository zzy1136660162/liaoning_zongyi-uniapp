<template>
  <view class="page">

    <!-- 状态栏占位（适配刘海等）-->
    <view class="safe-top" />


    <view style="padding: 20rpx;">


      <!-- 页面内容 -->
      <scroll-view class="body body-scroll" scrollY>

        <!-- 指定药品 卡片 -->
        <view class="card">
          <view class="card-title">指定药品</view>
          <view
              class="card-body"
              v-for="(item, index) in cartItems"
              :key="item.id"
              :style="{marginBottom: index < cartItems.length - 1 ? '20rpx' : '0'}"
          >
            <view class="med-left">
              <image class="med-thumb" :src="getImageUrl(item.image)" mode="aspectFill" />
              <view class="med-qty" v-if="item.quantity">×{{ item.quantity }}</view>
            </view>

            <view class="med-right">
              <view class="med-name">{{ item.name }}</view>
              <view class="med-price">¥{{ item.price.toFixed(2) }}</view>
            </view>
          </view>
          <view class="modify-wrapper">
            <view class="modify" @click="onModify">修改</view>
          </view>
        </view>

        <!-- 就诊人信息 -->
        <view class="section">
          <view class="section-title">就诊人信息</view>

          <view class="patient-row">
            <view class="label"><text class="required">*</text> 就诊人</view>

            <view class="patients">
              <view
                  class="patient-item"
                  v-for="p in patients"
                  :key="p.id"
              >
                <view class="patient-chip-wrapper">
                <view
                    class="patient-chip"
                    :class="{active: selectedPatient && selectedPatient.id === p.id}"
                    @click="selectPatient(p)"
                >
                  {{ p.name }}
                </view>
                  <view
                      class="delete-icon"
                      v-if="p.id"
                      @click.stop="onDeletePatient(p.id)"
                  >
                    <uni-icons type="close" size="14" color="#fff"></uni-icons>
                  </view>
                </view>
              </view>

              <view class="patient-add" @click="onAddPatient">＋ 添加就诊人</view>
            </view>
          </view>
        </view>

        <!-- 占位（让页面更接近你示意图的空白） -->
        <view style="height: 40vh"></view>

      </scroll-view>
    </view>
    <!-- 底部固定提交栏 -->
    <view class="footer">
      <view class="footer-left">
        <view class="icon-bag">
          <uni-icons type="cart" size="24" color="#4a90e2"></uni-icons>
          <text class="badge" v-if="totalQuantity > 0">{{ totalQuantity }}</text>
        </view>
        <view class="total">
          <text class="price">¥{{ totalPrice.toFixed(2) }}</text>
          <text class="note"> 不含复诊费，实际金额以结算为准</text>
        </view>
      </view>

      <button class="submit-btn" type="primary" @click="onSubmit">提&nbsp;交</button>
    </view>

  </view>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import {
  STORAGE_KEY_CURRENT_CONSULTATION_ID,
  STORAGE_KEY_USER_REGISTER,
  STORAGE_KEY_VERIFIED_PRODUCTS,
  STORAGE_KEY_PRODUCT_QUANTITIES
} from '@/utils/storage.js'
import { calculateTotalPrice, calculateTotalQuantity, getCurrentCheckoutProductIds, setCheckoutProductIds } from '@/utils/cart.js'
import { getPatientList, updatePatient, deletePatient } from '@/api/patient.js'
import { getCategoryList, getCategoryProducts, getProductDetail } from '@/api/product.js'
import { deriveGenderFromId, deriveAgeFromId } from '@/utils/patient.js'
import { logPageView, logButtonClick } from '@/utils/accessLog.js'
import { getImageUrl } from '@/utils/config.js'
import { BIZ_TYPE_HEALTH_GOODS, resolveProductFlow } from '@/utils/product-biz.js'

const cartItems = ref([]) // 购物车商品列表
const productsData = ref(null) // 产品数据（保持兼容性）
const selectedItems = ref([]) // 从URL参数获取的选中商品ID列表

const patients = ref([])
const selectedPatient = ref(null)
const selectedBizType = ref(1)

// 计算总价格
const totalPrice = computed(() => {
  return calculateTotalPrice(cartItems.value)
})

// 计算总数量
const totalQuantity = computed(() => {
  return calculateTotalQuantity(cartItems.value)
})

// 从API加载就诊人列表
const loadPatientsFromAPI = async () => {
  try {
    uni.showLoading({ title: '加载中...' })

    // 保存当前选中的就诊人ID，用于保持选择状态
    const currentSelectedId = selectedPatient.value?.id

    const patientList = await getPatientList()

    console.log('就诊人列表:', patientList)

    if (patientList && patientList.length > 0) {
      patients.value = patientList.map(p => ({
        id: p.id,
        name: p.name || p.patientName,
        phone: p.phone,
        idNumber: p.idNumber,
        idType: p.idType,
        gender: p.gender,
        age: p.age
      }))

      // 如果之前有选中的就诊人，尝试保持选择状态
      if (currentSelectedId !== null && currentSelectedId !== undefined) {
        const found = patients.value.find(p => p.id === currentSelectedId)
        if (found) {
          selectedPatient.value = found
        } else {
          // 如果之前选中的就诊人不在新列表中，选择第一个
          selectedPatient.value = patients.value.length > 0 ? patients.value[0] : null
        }
      } else {
        // 如果之前没有选中的就诊人，选择第一个
        selectedPatient.value = patients.value.length > 0 ? patients.value[0] : null
      }
    } else {
      // 如果没有就诊人，尝试从注册信息创建
      const userRegisterInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
      if (userRegisterInfo && userRegisterInfo.realName) {
        patients.value = [{
          id: null,
          name: userRegisterInfo.realName,
          phone: userRegisterInfo.phone,
          idNumber: userRegisterInfo.idNumber,
          idType: userRegisterInfo.idType,
          gender: deriveGenderFromId(userRegisterInfo.idNumber),
          age: deriveAgeFromId(userRegisterInfo.idNumber)
        }]
        // 如果之前没有选中的就诊人，才选择这个
        if (!currentSelectedId) {
          selectedPatient.value = patients.value[0]
        }
      } else {
        patients.value = []
        selectedPatient.value = null
      }
    }

    uni.hideLoading()

  } catch (e) {
    console.error('加载就诊人信息失败:', e)
    uni.hideLoading()

    // API失败时从本地加载
    const userRegisterInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
    if (userRegisterInfo && userRegisterInfo.realName) {
      patients.value = [{
        id: null,
        name: userRegisterInfo.realName,
        gender: deriveGenderFromId(userRegisterInfo.idNumber),
        age: deriveAgeFromId(userRegisterInfo.idNumber)
      }]
      // 如果之前没有选中的就诊人，才选择这个
      if (!selectedPatient.value?.id) {
        selectedPatient.value = patients.value[0]
      }
    } else {
      patients.value = []
      selectedPatient.value = null
    }
  }
}

const handlePatientChanged = () => {
  // 延迟执行，避免快速重复触发
  setTimeout(() => {
    loadPatientsFromAPI()
  }, 100)
}

onMounted(() => {
  logPageView('DISPENSE_APPLY')
  uni.$on('patientChanged', handlePatientChanged)

  // 获取URL参数中的选中商品
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const selectedItemsParam = currentPage.options.selectedItems

  if (selectedItemsParam) {
    selectedItems.value = selectedItemsParam.split(',').filter(id => id.trim())
  } else {
    selectedItems.value = getCurrentCheckoutProductIds()
  }

  if (selectedItems.value.length > 0) {
    setCheckoutProductIds(selectedItems.value)
  }

  loadPatientsFromAPI()
  loadProducts()
})

onUnmounted(() => {
  uni.$off('patientChanged', handlePatientChanged)
})

// 加载产品数据（仅加载购物车需要的商品）
const loadProducts = async () => {
  try {
    // 如果有选中商品参数，只加载选中的商品；否则加载所有购物车商品
    let productIds = []

    if (selectedItems.value && selectedItems.value.length > 0) {
      // 只加载从URL参数传入的选中商品，但要确保这些商品已经在购物车中验证过
      const verifiedProducts = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
      productIds = selectedItems.value.filter(id => verifiedProducts[id])
    } else {
      // 从购物车获取需要的产品ID（原有的逻辑）
      const verifiedProducts = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
      productIds = Object.keys(verifiedProducts).filter(id => verifiedProducts[id])
    }

    if (productIds.length === 0) {
      uni.showToast({ title: '购物车为空', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 1500)
      return
    }

    // 直接从服务器加载商品数据，不使用前端缓存

    console.log('从服务器加载购物车商品详情')
    uni.showLoading({ title: '加载商品...' })

    // 获取购物车验证数据
    const verifiedProducts = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}

    // 直接构建购物车商品列表
    const cartItemsList = []

    // 逐个获取购物车商品的详细信息
    for (const productId of productIds) {
      try {
        const productDetail = await getProductDetail(productId)
        if (productDetail) {
          // 获取商品数量（优先从新格式获取）
          const productInfo = verifiedProducts[productId]
          const quantity = productInfo && typeof productInfo === 'object' && productInfo.quantity
            ? productInfo.quantity
            : 1

          cartItemsList.push({
            id: productDetail.id,
            name: productDetail.productName || productDetail.name,
            description: productDetail.subTitle || productDetail.description,
            image: getImageUrl(productDetail.coverImage || productDetail.image),
            price: productDetail.price,
            bizType: productDetail.bizType,
            goodsMerchantType: productDetail.goodsMerchantType,
            unit: productDetail.unit || '份',
            notice: productDetail.usageDesc || productDetail.notice,
            quantity: quantity
          })
        }
      } catch (err) {
        console.error(`获取商品${productId}详情失败:`, err)
      }
    }

    // 直接设置购物车商品列表
    cartItems.value = cartItemsList
    const flow = resolveProductFlow(cartItemsList)
    if (!flow.valid) {
      uni.showToast({ title: flow.message, icon: 'none' })
      setTimeout(() => uni.navigateBack(), 1500)
      return
    }
    selectedBizType.value = flow.bizType

    // 设置兼容性数据（如果其他地方需要）
    productsData.value = { categories: [] }

    loadCartData()
  } catch (error) {
    console.error('加载商品失败，使用本地数据:', error)
    loadCartData()
  } finally {
    uni.hideLoading()
  }
}

// 加载购物车数据（简化版，直接使用已获取的商品详情）
const loadCartData = () => {
  try {
    // 获取购物车验证数据
    const verifiedProducts = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
    console.log(verifiedProducts,'verifiedProducts----------apply')

    // 如果cartItems还没有加载（出错情况），提示用户
    if (cartItems.value.length === 0) {
      uni.showToast({
        title: '购物车为空',
        icon: 'none'
      })
      // 延迟返回上一页
      setTimeout(() => {
        uni.navigateBack()
      }, 1500)
    }

    console.log('购物车数据已加载:', cartItems.value.length, '件商品')
  } catch (e) {
    console.error('加载购物车数据失败:', e)
    uni.showToast({
      title: '加载购物车失败',
      icon: 'none'
    })
  }
}

// 底部栏高度（参考列表页面的 120rpx）
const footerHeight = 120

const onClose = () => {
  // 小程序返回/关闭
  uni.navigateBack({ delta: 1 })
}

const onModify = () => {
  // 返回商品列表页面进行修改
  uni.navigateBack()
}

const selectPatient = (p) => {
  logButtonClick('选择就诊人', 'DISPENSE_APPLY', p?.id?.toString() || '', {
    patientName: p?.name
  })
  selectedPatient.value = p
}


// ✅ 删除就诊人
const onDeletePatient = (patientId) => {
  logButtonClick('删除就诊人', 'DISPENSE_APPLY', patientId.toString())
  uni.showModal({
    title: '提示',
    content: '确定要删除此就诊人吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '删除中...' })

          await deletePatient(patientId)

          uni.hideLoading()
          uni.showToast({ title: '删除成功', icon: 'success' })

          // 重新加载就诊人列表
          await loadPatientsFromAPI()
        } catch (error) {
          console.error('删除就诊人失败:', error)
          uni.hideLoading()
          uni.showToast({
            title: error.message || '删除失败',
            icon: 'none'
          })
        }
      }
    }
  })
}

// ✅ 添加就诊人
const onAddPatient = () => {
  logButtonClick('添加就诊人', 'DISPENSE_APPLY')
  uni.navigateTo({
    url: '/pages/dispense/patient_edit'
  })
}

const onSubmit = () => {
  if (selectedBizType.value !== BIZ_TYPE_HEALTH_GOODS && !selectedPatient.value) {
    uni.showToast({ title: '请先选择就诊人', icon: 'none' })
    return
  }

  logButtonClick('提交申请', 'DISPENSE_APPLY', selectedPatient.value?.id?.toString() || '', {
    patientName: selectedPatient.value?.name,
    productCount: cartItems.value.length
  })

  const selectedItemIds = selectedItems.value.length > 0
    ? selectedItems.value.join(',')
    : cartItems.value.map(item => item.id).join(',')
  setCheckoutProductIds(selectedItemIds ? selectedItemIds.split(',') : [])

  if (selectedBizType.value === BIZ_TYPE_HEALTH_GOODS) {
    uni.removeStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID)
    uni.navigateTo({
      url: `/pages/order/confirm?selectedItems=${selectedItemIds}`
    })
    return
  }

  uni.navigateTo({
    url: `/pages/dispense/consultation?selectedItems=${selectedItemIds}`
  })
}
</script>

<style scoped>
/* Safe area 顶部填充（适配状态栏高度）*/
.safe-top {
  height: env(safe-area-inset-top);
  background: #fff;
}

/* 整体背景 */
.page {
  background: #f6f7fb;
  min-height: 100vh;
}

/* 白色导航栏 */
.nav-bar {
  height: 88rpx;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0 20rpx;
  border-bottom: 1rpx solid #eee;
}
.nav-left, .nav-right {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 120rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  font-size: 36rpx;
}
.nav-left { left: 0; }
.nav-right { right: 0; }
.nav-title {
  font-size: 34rpx;
  font-weight: 600;
}

/* 页面滚动区 */
.body-scroll {
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}

/* 卡片 */
.card {
  background: #fff;
  border-radius: 8rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.03);
}
.card-title {
  font-size: 30rpx;
  font-weight: 600;
  text-align: center;
  margin-bottom: 10rpx;
  color: #333;
}
.card-body {
  display: flex;
  align-items: center;
  position: relative;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.card-body:last-of-type {
  border-bottom: none;
  padding-bottom: 0;
}
.modify-wrapper {
  text-align: right;
  margin-top: 10rpx;
  padding-top: 10rpx;
  border-top: 1rpx solid #f0f0f0;
}
.med-left {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  margin-right: 20rpx;
}
.med-thumb {
  width: 100%;
  height: 100%;
  border-radius: 8rpx;
  background: #eee;
}
.med-qty {
  position: absolute;
  right: -10rpx;
  top: -10rpx;
  background: #fff;
  color: #333;
  padding: 6rpx 12rpx;
  border-radius: 16rpx;
  font-size: 26rpx;
  border: 1rpx solid #ddd;
}

.med-right {
  flex: 1;
}
.med-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 12rpx;
}
.med-price {
  color: #e64340;
  font-size: 28rpx;
}

.modify {
  position: absolute;
  right: 14rpx;
  top: 14rpx;
  color: #4a90e2;
  font-size: 28rpx;
}

/* section */
.section {
  margin-top: 20rpx;
  background: #fff;
  padding: 24rpx;
  border-radius: 8rpx;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.03);
}
.section-title {
  font-size: 30rpx;
  font-weight: 700;
  text-align: center;
  margin-bottom: 18rpx;
}
.patient-row {
  display: flex;
  flex-direction: column;
}
.label {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 18rpx;
}
.required { color: #e64340; margin-right: 6rpx; }

/* 就诊人 chips */
.patients {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}

.patient-item {
  display: flex;
  align-items: center;
}

.patient-chip-wrapper {
  display: flex;
  align-items: center;
  position: relative;
}

.patient-chip {
  padding: 12rpx 28rpx;
  border-radius: 36rpx;
  background: #f4f7ff;
  color: #4a90e2;
  font-size: 26rpx;
  border: 1rpx solid transparent;
}
.patient-chip.active {
  background: #2a82e4;
  color: #fff;
  border-color: rgba(0,0,0,0.06);
  box-shadow: 0 2rpx 6rpx rgba(42,130,228,0.12);
}

.delete-icon {
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  background: rgba(255, 102, 102, 0.8);
  margin-left: -12rpx;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.delete-icon:hover {
  background: rgba(255, 102, 102, 1);
}

.patient-add {
  padding: 12rpx 18rpx;
  color: #3e86e4;
  font-size: 26rpx;
}

/* footer 固定底部 */
.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  min-height: 120rpx;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 24rpx;
  padding-top: 0;
  padding-bottom: calc(18rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -6rpx 18rpx rgba(0,0,0,0.06);
  z-index: 100;
}

/* footer 左侧包裹 */
.footer-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.icon-bag {
  width: 72rpx;
  height: 72rpx;
  border-radius: 12rpx;
  background: #f0f6ff;
  display:flex;
  align-items:center;
  justify-content:center;
  position: relative;
}
.badge {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  background: #ff4d4f;
  color: #fff;
  padding: 4rpx 8rpx;
  border-radius: 16rpx;
  font-size: 22rpx;
}
.total .price {
  font-size: 30rpx;
  color: #e64340;
  font-weight: 600;
}
.total .note {
  display: block;
  font-size: 22rpx;
  color: #999;
}

/* 提交按钮 */
.submit-btn {
  margin: 0;
  background: #2a82e4;
  color: #fff;
  padding: 0 35rpx;
  border-radius: 50rpx;
  font-size: 30rpx;
  border: none;
}
</style>
  
