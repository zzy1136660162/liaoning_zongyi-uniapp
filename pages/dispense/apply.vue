<template>
  <view class="page">
    <!-- 状态栏占位（适配刘海等）-->
    <view class="safe-top" />


    <view style="padding: 20rpx;">
      <!-- 页面内容 -->
      <scroll-view
        class="body body-scroll"
        scroll-y
      >
        <!-- 指定药品 卡片 -->
        <view class="card">
          <view
            v-for="(item, index) in cartItems"
            :key="item.id"
            class="card-body"
            :style="{marginBottom: index < cartItems.length - 1 ? '20rpx' : '0'}"
          >
            <view class="med-left">
              <image
                class="med-thumb"
                :src="getImageUrl(item.image)"
                mode="aspectFill"
              />
              <view
                v-if="item.quantity"
                class="med-qty"
              >
                {{ item.quantity }}
              </view>
            </view>

            <view class="med-right">
              <view class="med-name">
                {{ item.name }}
              </view>
              <view class="med-price-row">
                <view class="med-price">
                  ¥{{ item.price.toFixed(2) }}
                </view>
                <uni-number-box
                  :value="item.quantity || 1"
                  :min="1"
                  :max="99"
                  size="small"
                  @change="(val) => onQuantityChange(item, val)"
                />
              </view>
            </view>
          </view>
        </view>

        <!-- 就诊人信息 -->
        <view class="section">
          <view class="section-title">
            就诊人信息
          </view>

          <view class="patient-row">
            <view class="label">
              <text class="required">
                *
              </text> 就诊人
            </view>

            <view class="patients">
              <view
                v-for="p in patients"
                :key="p.id"
                class="patient-item"
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
                    v-if="p.id"
                    class="delete-icon"
                    @click.stop="onDeletePatient(p.id)"
                  >
                    <uni-icons
                      type="close"
                      size="14"
                      color="#fff"
                    />
                  </view>
                </view>
              </view>

              <view
                class="patient-add"
                @click="onAddPatient"
              >
                ＋ 添加就诊人
              </view>
            </view>
          </view>
        </view>

        <!-- 占位（让页面更接近你示意图的空白） -->
        <view style="height: 40vh" />
      </scroll-view>
    </view>
    <!-- 底部固定提交栏 -->
    <view class="footer">
      <view class="footer-left">
        <view class="icon-bag">
          <uni-icons
            type="cart"
            size="24"
            color="#4a90e2"
          />
          <text
            v-if="totalQuantity > 0"
            class="badge"
          >
            {{ totalQuantity }}
          </text>
        </view>
        <view class="total">
          <text class="price">
            ¥{{ totalPrice.toFixed(2) }}
          </text>
          <text class="note">
            不含邮费，实际金额以结算为准
          </text>
        </view>
      </view>

      <button
        class="submit-btn"
        type="primary"
        @click="onSubmit"
      >
        提&nbsp;交
      </button>
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

const onQuantityChange = (item, val) => {
  if (item) {
    item.quantity = val
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
  background: linear-gradient(135deg, #4a90e2, #67c6ff);
}

/* 整体背景 */
.page {
  background: linear-gradient(180deg, #f0f6ff 0%, #f6f7fb 30%, #f6f7fb 100%);
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
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}

/* 卡片 */
.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 30rpx rgba(74,144,226,0.1);
  border: 1rpx solid rgba(74,144,226,0.08);
}
.card-title {
  font-size: 32rpx;
  font-weight: 600;
  text-align: center;
  margin-bottom: 24rpx;
  color: #333;
  position: relative;
  padding-bottom: 16rpx;
}
.card-title::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 80rpx;
  height: 6rpx;
  background: linear-gradient(90deg, #4a90e2, #67c6ff);
  border-radius: 3rpx;
}
.card-body {
  display: flex;
  align-items: flex-start;
  position: relative;
  padding: 20rpx;
  background: linear-gradient(135deg, #fafbfc, #f5f7fa);
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  transition: all 0.3s;
}
.card-body:last-of-type {
  border-bottom: none;
  padding-bottom: 20rpx;
  margin-bottom: 0;
}
.modify-wrapper {
  text-align: right;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx dashed #e0e6f0;
}
.med-left {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  margin-right: 20rpx;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 6rpx 16rpx rgba(0,0,0,0.1);
}
.med-thumb {
  width: 100%;
  height: 100%;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #f0f0f0, #e8e8e8);
}
.med-qty {
  position: absolute;
  right: 0rpx;
  top: 0rpx;
  background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
  color: #fff;
  min-width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  font-size: 24rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10rpx;
  box-sizing: border-box;
  box-shadow: 0 4rpx 12rpx rgba(255,107,107,0.4);
}

.med-right {
  flex: 1;
}
.med-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 10rpx;
  line-height: 1.4;
}
.med-spec {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 12rpx;
  background: linear-gradient(135deg, #f0f4ff, #e8f0fe);
  padding: 6rpx 14rpx;
  border-radius: 8rpx;
  display: inline-block;
}
.med-price {
  color: #ff6b6b;
  font-size: 34rpx;
  font-weight: 700;
}

.med-price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14rpx;
}

.modify {
  position: absolute;
  right: 14rpx;
  top: 14rpx;
  color: #4a90e2;
  font-size: 26rpx;
  padding: 10rpx 20rpx;
  background: linear-gradient(135deg, #f0f6ff, #e8f0fe);
  border-radius: 24rpx;
}

/* section */
.section {
  margin-top: 24rpx;
  background: #fff;
  padding: 28rpx;
  border-radius: 20rpx;
  box-shadow: 0 8rpx 30rpx rgba(74,144,226,0.1);
  border: 1rpx solid rgba(74,144,226,0.08);
}
.section-title {
  font-size: 32rpx;
  font-weight: 700;
  text-align: center;
  margin-bottom: 24rpx;
  color: #333;
  position: relative;
  padding-bottom: 16rpx;
}
.section-title::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 80rpx;
  height: 6rpx;
  background: linear-gradient(90deg, #4a90e2, #67c6ff);
  border-radius: 3rpx;
}
.patient-row {
  display: flex;
  flex-direction: column;
}
.label {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 20rpx;
  font-weight: 500;
}
.required { color: #ff6b6b; margin-right: 6rpx; }

/* 就诊人 chips */
.patients {
  display: flex;
  align-items: center;
  gap: 16rpx;
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
  padding: 14rpx 32rpx;
  border-radius: 40rpx;
  background: linear-gradient(135deg, #f0f6ff, #e8f0fe);
  color: #4a90e2;
  font-size: 28rpx;
  border: 2rpx solid #d4e4ff;
  transition: all 0.3s;
}
.patient-chip.active {
  background: linear-gradient(135deg, #4a90e2, #67c6ff);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 6rpx 20rpx rgba(74,144,226,0.35);
  transform: scale(1.05);
}

.delete-icon {
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff6b6b, #ff4757);
  margin-left: -14rpx;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2rpx 8rpx rgba(255,107,107,0.4);
}
.delete-icon:hover {
  transform: scale(1.15);
}

.patient-add {
  padding: 14rpx 24rpx;
  color: #4a90e2;
  font-size: 28rpx;
  background: linear-gradient(135deg, #f0f6ff, #e8f0fe);
  border-radius: 40rpx;
  border: 2rpx dashed #4a90e2;
}

/* footer 固定底部 */
.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  min-height: 130rpx;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 30rpx;
  padding-top: 0;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -8rpx 30rpx rgba(0,0,0,0.08);
  z-index: 100;
}

/* footer 左侧包裹 */
.footer-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.icon-bag {
  width: 80rpx;
  height: 80rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #f0f6ff, #e8f4ff);
  display:flex;
  align-items:center;
  justify-content:center;
  position: relative;
  box-shadow: 0 6rpx 16rpx rgba(74,144,226,0.15);
}
.badge {
  position: absolute;
  top: -6rpx;
  right: -6rpx;
  background: linear-gradient(135deg, #ff6b6b, #ff4757);
  color: #fff;
  padding: 4rpx 10rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  font-weight: 600;
  box-shadow: 0 2rpx 10rpx rgba(255,75,87,0.4);
}
.total .price {
  font-size: 38rpx;
  color: #ff6b6b;
  font-weight: 700;
}
.total .note {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
}

/* 提交按钮 */
.submit-btn {
  margin: 0;
  background: linear-gradient(135deg, #4a90e2, #67c6ff);
  color: #fff;
  padding: 0 56rpx;
  height: 88rpx;
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: 600;
  border: none;
  box-shadow: 0 8rpx 24rpx rgba(74,144,226,0.35);
  letter-spacing: 2rpx;
}
</style>
  
