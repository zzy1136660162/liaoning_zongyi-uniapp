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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  STORAGE_KEY_CURRENT_CONSULTATION_ID,
  STORAGE_KEY_USER_REGISTER
} from '@/utils/storage.js'
import {
  calculateTotalPrice,
  calculateTotalQuantity,
  getCurrentCheckoutProductIds,
  loadCartItems,
  setCheckoutProductIds
} from '@/utils/cart.js'
import { getPatientList, deletePatient } from '@/api/patient.js'
import { getProductDetail } from '@/api/product.js'
import { deriveGenderFromId, deriveAgeFromId } from '@/utils/patient.js'
import { logPageView, logButtonClick } from '@/utils/accessLog.js'
import { getImageUrl } from '@/utils/config.js'
import { BIZ_TYPE_HEALTH_GOODS, resolveProductFlow } from '@/utils/product-biz.js'

const cartItems = ref([])
const categories = ref([])
const selectedItems = ref([])
const patients = ref([])
const selectedPatient = ref(null)
const selectedBizType = ref(1)

const totalPrice = computed(() => calculateTotalPrice(cartItems.value))
const totalQuantity = computed(() => calculateTotalQuantity(cartItems.value))

const loadPatientsFromAPI = async () => {
  try {
    uni.showLoading({ title: '加载中...' })
    const currentSelectedId = selectedPatient.value?.id
    const patientList = await getPatientList()

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

      if (currentSelectedId !== null && currentSelectedId !== undefined) {
        const found = patients.value.find(p => p.id === currentSelectedId)
        selectedPatient.value = found || patients.value[0] || null
      } else {
        selectedPatient.value = patients.value[0] || null
      }
    } else {
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
        if (!currentSelectedId) {
          selectedPatient.value = patients.value[0]
        }
      } else {
        patients.value = []
        selectedPatient.value = null
      }
    }
  } catch (error) {
    console.error('loadPatientsFromAPI failed:', error)
    const userRegisterInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
    if (userRegisterInfo && userRegisterInfo.realName) {
      patients.value = [{
        id: null,
        name: userRegisterInfo.realName,
        gender: deriveGenderFromId(userRegisterInfo.idNumber),
        age: deriveAgeFromId(userRegisterInfo.idNumber)
      }]
      if (!selectedPatient.value?.id) {
        selectedPatient.value = patients.value[0]
      }
    } else {
      patients.value = []
      selectedPatient.value = null
    }
  } finally {
    uni.hideLoading()
  }
}

const handlePatientChanged = () => {
  setTimeout(() => {
    loadPatientsFromAPI()
  }, 100)
}

const loadProducts = async () => {
  try {
    const requestedIds = selectedItems.value.length > 0 ? selectedItems.value : getCurrentCheckoutProductIds()
    if (requestedIds.length === 0) {
      uni.showToast({ title: '购物车为空', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 1200)
      return
    }

    const checkoutCategory = {
      id: 'checkout_items',
      name: '待结算商品',
      products: []
    }

    uni.showLoading({ title: '加载商品...' })
    for (const productId of requestedIds) {
      try {
        const productDetail = await getProductDetail(productId)
        if (productDetail) {
          checkoutCategory.products.push({
            id: productDetail.id,
            name: productDetail.productName || productDetail.name,
            description: productDetail.subTitle || productDetail.description,
            image: productDetail.coverImage || productDetail.image,
            price: Number(productDetail.price || 0),
            bizType: productDetail.bizType,
            goodsMerchantType: productDetail.goodsMerchantType,
            unit: productDetail.unit || '件',
            notice: productDetail.usageDesc || productDetail.notice,
            needQuestionnaire: productDetail.needQuestionnaire || 0
          })
        }
      } catch (error) {
        console.error(`load checkout product failed: ${productId}`, error)
      }
    }

    categories.value = [checkoutCategory]
    const selectedSet = new Set(requestedIds.map(id => String(id)))
    cartItems.value = loadCartItems(categories.value).filter(item => selectedSet.has(String(item.id)))

    if (cartItems.value.length === 0) {
      uni.showToast({ title: '购物车为空', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 1200)
      return
    }

    const flow = resolveProductFlow(cartItems.value)
    if (!flow.valid) {
      uni.showToast({ title: flow.message, icon: 'none' })
      setTimeout(() => uni.navigateBack(), 1200)
      return
    }
    selectedBizType.value = flow.bizType
  } catch (error) {
    console.error('loadProducts failed:', error)
    uni.showToast({ title: '加载商品失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

const onModify = () => {
  uni.navigateBack()
}

const selectPatient = (patient) => {
  logButtonClick('选择就诊人', 'DISPENSE_APPLY', patient?.id?.toString() || '', {
    patientName: patient?.name
  })
  selectedPatient.value = patient
}

const onDeletePatient = (patientId) => {
  logButtonClick('删除就诊人', 'DISPENSE_APPLY', patientId.toString())
  uni.showModal({
    title: '提示',
    content: '确定要删除此就诊人吗？',
    success: async (res) => {
      if (!res.confirm) {
        return
      }
      try {
        uni.showLoading({ title: '删除中...' })
        await deletePatient(patientId)
        uni.showToast({ title: '删除成功', icon: 'success' })
        await loadPatientsFromAPI()
      } catch (error) {
        console.error('onDeletePatient failed:', error)
        uni.showToast({
          title: error.message || '删除失败',
          icon: 'none'
        })
      } finally {
        uni.hideLoading()
      }
    }
  })
}

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
    ? selectedItems.value
    : cartItems.value.map(item => String(item.id))
  setCheckoutProductIds(selectedItemIds)

  if (selectedBizType.value === BIZ_TYPE_HEALTH_GOODS) {
    uni.removeStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID)
    uni.navigateTo({
      url: `/pages/order/confirm?selectedItems=${selectedItemIds.join(',')}`
    })
    return
  }

  uni.navigateTo({
    url: `/pages/dispense/consultation?selectedItems=${selectedItemIds.join(',')}`
  })
}

onMounted(() => {
  logPageView('DISPENSE_APPLY')
  uni.$on('patientChanged', handlePatientChanged)

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
  
