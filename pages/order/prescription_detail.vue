<template>
  <view class="page">
    <!-- 状态栏 -->
    <view class="status-banner">
      <view class="status-content">
        <view class="status-info">
          <text class="status-title">
            待下单
          </text>
          <text class="status-desc">
            等待下单支付
          </text>
        </view>
      </view>
    </view>

    <!-- 复诊信息 -->
    <view
      class="info-card"
      @click="onConsultationClick"
    >
      <view class="card-header">
        <image
          class="card-avatar"
          :src="doctorAvatar"
          mode="aspectFill"
        />
        <view class="card-title">
          <text>{{ prescription.doctorName || '线上医生' }} (门诊号: {{ prescription.outpatientNo || '暂无' }})</text>
          <text class="card-time">
            {{ formattedConsultationTime }}
          </text>
        </view>
        <text class="card-arrow">
          ›
        </text>
      </view>
      
      <view class="card-content">
        <view class="info-row">
          <text class="info-label">
            诊断信息:
          </text>
          <text class="info-value">
            {{ prescription.diagnosis }}
          </text>
        </view>
        <view class="info-row">
          <text class="info-label">
            开方药房:
          </text>
          <text class="info-value">
            协定方
          </text>
        </view>
        <view class="info-row">
          <text class="info-label">
            开具信息:
          </text>
          <text class="info-value">
            {{ prescription.doctorName }} 医生
          </text>
        </view>
        <view class="info-row">
          <text class="info-label">
            医院:
          </text>
          <text class="info-value">
            {{ prescription.hospital }}
          </text>
        </view>
        <view class="info-row">
          <text class="info-label">
            开具时间:
          </text>
          <text class="info-value">
            {{ formattedConsultationTime }}
          </text>
        </view>
      </view>
    </view>

    <!-- 处方详情 -->
    <view class="prescription-card">
      <view class="prescription-header">
        <text class="prescription-title">
          中药处方
        </text>
      </view>
      
      <view class="prescription-tabs">
        <view class="tab-item active">
          普通处方
        </view>
        <view class="tab-item">
          自费
        </view>
      </view>

      <view
        v-if="allCartItems.length > 0"
        class="prescription-content"
      >
        <view class="medicines-list">
          <view 
            v-for="item in allCartItems"
            :key="item.id" 
            class="medicine-item"
          >
            <view class="medicine-left">
              <image
                class="medicine-thumb"
                :src="item.image"
                mode="aspectFill"
              />
              <view
                v-if="item.quantity"
                class="medicine-qty"
              >
                ×{{ item.quantity }}
              </view>
            </view>
            <view class="medicine-right">
              <view class="medicine-name">
                {{ item.name }}
              </view>
              <view class="medicine-price">
                ¥{{ ((item.price || 0) * (item.quantity || 1)).toFixed(2) }}
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view class="footer">
      <button
        class="footer-btn secondary"
        @click="onContinuePrescription"
      >
        续方
      </button>
      <button
        class="footer-btn primary"
        @click="onGoToOrder"
      >
        去下单
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { 
  STORAGE_KEY_CURRENT_ORDER,
  STORAGE_KEY_USER_REGISTER,
  STORAGE_KEY_VERIFIED_PRODUCTS,
  STORAGE_KEY_PRODUCT_QUANTITIES
} from '@/utils/storage.js'
import { buildOrderInfo } from '@/utils/cart.js'
import { logPageView } from '@/api/access-log.js'
import { getProductDetail } from '@/api/product.js'
import { getDoctorDetail } from '@/api/hospital.js'
import { getImageUrl } from '@/utils/config.js'
import { getConsultationDetail } from '@/api/consultation.js'
import dayjs from 'dayjs'

const allCartItems = ref([]) // 所有购物车商品

const prescription = ref({
  id: '',
  doctorId: null,
  doctorName: '',
  doctorTitle: '',
  doctorAvatar: '',
  department: '',
  consultationTime: '',
  diagnosis: '',
  doses: 0,
  details: '',
  status: '',
  tags: [],
  timeLimit: '',
  hospital: '',
  productId: '',
  productPrice: 0,
  quantity: 1,
  outpatientNo: '' // 医生门诊号
})

const totalPrice = computed(() => {
  if (allCartItems.value.length) {
    const sum = allCartItems.value.reduce((acc, item) => {
      const price = Number(item.price) || 0
      const qty = Number(item.quantity) || 1
      return acc + price * qty
    }, 0)
    return sum.toFixed(2)
  }
  const price = (prescription.value.productPrice || 0) * (prescription.value.quantity || 1)
  return price.toFixed(2)
})

const formatDateTime = (value) => {
  if (!value) return ''
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : value
}

const formattedConsultationTime = computed(() => formatDateTime(prescription.value.consultationTime))
const doctorAvatar = computed(() => getImageUrl(prescription.value.doctorAvatar || '/liaoning_zongyi/zaixian_mingyi_logo.png'))

// 从 storage 读取已验证商品ID与数量，逐个获取商品详情
const loadCartFromStorage = async () => {
  try {
    const verifiedProducts = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
    const productQuantities = uni.getStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES) || {}
    const ids = Object.keys(verifiedProducts).filter(id => verifiedProducts[id])

    const items = []
    for (const id of ids) {
      try {
        console.log(id,'id--------');
        
        const detail = await getProductDetail(id)
        if (detail) {
          items.push({
            id: detail.id,
            name: detail.productName || detail.name || '商品',
            price: Number(detail.price) || 0,
            quantity: productQuantities[id] || 1,
            image: getImageUrl(detail.coverImage || detail.image || '')
          })
        }
      } catch (err) {
        console.warn('加载商品详情失败:', id, err)
      }
    }
    allCartItems.value = items
    console.log('allCartItems',allCartItems);
    
  } catch (e) {
    console.error('从 storage 加载购物车失败', e)
    allCartItems.value = []
  }
}

onLoad((options) => {
  (async () => {
    console.log(options,'options');
    
  if (options.prescription) {
    try {
      const prescriptionData = JSON.parse(decodeURIComponent(options.prescription))
      console.log('接收到的处方数据:', prescriptionData)
      
      // 确保所有字段都正确映射
      prescription.value = {
        id: prescriptionData.id || '',
        doctorName: prescriptionData.doctorName || '线上名医',
        doctorAvatar: prescriptionData.doctorAvatar || '',
        department: prescriptionData.department || '便捷配药门诊',
        consultationTime: prescriptionData.consultationTime || '',
        diagnosis: prescriptionData.diagnosis || '虚劳类病',
        doses: prescriptionData.doses || prescriptionData.quantity || 0,
        details: prescriptionData.details || prescriptionData.name || '',
        status: prescriptionData.status || 'pending_payment',
        tags: prescriptionData.tags || [],
        timeLimit: prescriptionData.timeLimit || '',
        hospital: prescriptionData.hospital || '辽宁中医药大学附属医院',
        productId: prescriptionData.productId || prescriptionData.id || '',
        productPrice: prescriptionData.productPrice || 0,
        quantity: prescriptionData.quantity || prescriptionData.doses || 1,
        outpatientNo: prescriptionData.outpatientNo || '' // 医生门诊号
      }
      
      console.log('解析后的处方信息:', prescription.value)

      // 如果有咨询ID，补充开具时间（取 lnzy_consultation.created_at）
      const consultationId = prescriptionData.consultationId || prescriptionData.id
      if (consultationId) {
        await fillConsultationTime(consultationId)
      }
    } catch (e) {
      console.error('解析处方数据失败:', e)
      uni.showToast({
        title: '加载处方信息失败',
        icon: 'none'
      })
    }
  } else {
    console.warn('未接收到处方参数')
    uni.showToast({
      title: '处方信息缺失',
      icon: 'none'
    })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  }

  // 记录页面访问日志
  logPageView('处方详情', '用户进入处方详情页面')

  // 从 storage 加载购物车商品（使用已验证商品ID）
  await loadCartFromStorage()

  // 商品仅取购物车首件的 id（前序页面已写入购物车）
  const productId = (allCartItems.value[0] && allCartItems.value[0].id) || null
  if (productId) {
    enrichByProduct(productId)
  } else {
    console.warn('未找到商品ID，跳过商品/医生信息补全')
  }
  })()
})

// 根据咨询ID获取 created_at 作为开具时间显示
const fillConsultationTime = async (consultationId) => {
  if (!consultationId) return
  try {
    const detail = await getConsultationDetail(consultationId)
    console.log(detail,'detail');
    
    if (detail && detail.createdAt) {
      prescription.value.consultationTime = detail.createdAt
    }
    if (detail && detail.doctorId) {
      prescription.value.doctorId = detail.doctorId
    }
    if (detail && detail.doctorName) {
      prescription.value.doctorName = detail.doctorName
    }
    if (detail && detail.department) {
      prescription.value.department = detail.department
    }
    if (detail && detail.hospitalName) {
      prescription.value.hospital = detail.hospitalName
    }
    if (detail && detail.doctorAvatar) {
      prescription.value.doctorAvatar = detail.doctorAvatar
    }
    if (detail && detail.doctorTitle) {
      prescription.value.doctorTitle = detail.doctorTitle
    }
    if (detail && detail.outpatientNo) {
      prescription.value.outpatientNo = detail.outpatientNo
    }
  } catch (e) {
    console.warn('查询咨询创建时间失败', e)
  }
}

// 基于商品信息补全处方和医生信息（不调用订单接口）
const enrichByProduct = async (productId) => {
  if (!productId) return
  try {
    uni.showLoading({ title: '加载中...' })
    // 1) 获取商品详情（含处方诊断、doctorId、doctorName、封面）
    const product = await getProductDetail(productId)
    if (product) {
      prescription.value.diagnosis = product.prescriptionDiagnosis || prescription.value.diagnosis
      prescription.value.productId = product.id || prescription.value.productId
      if (!prescription.value.doctorId) {
        prescription.value.doctorId = product.doctorId || prescription.value.doctorId
      }
      if (!prescription.value.doctorName) {
        prescription.value.doctorName = product.doctorName || prescription.value.doctorName
      }

      // 如果商品列表为空，用商品数据补齐一条
      if (!allCartItems.value.length) {
        allCartItems.value = [{
          id: product.id,
          name: product.productName || '商品',
          price: Number(product.price) || 0,
          quantity: 1,
          image: getImageUrl(product.coverImage || product.image || '')
        }]
        prescription.value.productPrice = Number(product.price) || 0
        prescription.value.quantity = 1
      } else if (allCartItems.value[0] && !allCartItems.value[0].image) {
        allCartItems.value[0].image = getImageUrl(product.coverImage || product.image || '')
      }
    }

    // 2) 如果有 doctorId，再查医生详情补全头像/职称/医院/门诊号
    if (prescription.value.doctorId) {
      try {
        const doctor = await getDoctorDetail(prescription.value.doctorId)
        if (doctor) {
          prescription.value.doctorName = doctor.name || prescription.value.doctorName
          prescription.value.doctorAvatar = doctor.avatarUrl || prescription.value.doctorAvatar
          prescription.value.department = doctor.department || prescription.value.department
          prescription.value.hospital = doctor.hospitalName || prescription.value.hospital
          prescription.value.doctorTitle = doctor.title || prescription.value.doctorTitle
          prescription.value.outpatientNo = doctor.outpatientNo || prescription.value.outpatientNo // 医生门诊号
        }
      } catch (e) {
        console.warn('获取医生信息失败', e)
      }
    }
  } catch (e) {
    console.error('基于商品补全信息失败', e)
  } finally {
    uni.hideLoading()
  }
}

// 从身份证号计算年龄
const calculateAgeFromIdCard = (idCard) => {
  if (!idCard || idCard.length < 15) {
    return 0
  }
  
  let birthDateStr = ''
  // 18位身份证：第7-14位为出生日期 YYYYMMDD
  if (idCard.length === 18) {
    birthDateStr = idCard.substring(6, 14)
  } 
  // 15位身份证：第7-12位为出生日期 YYMMDD，年份前两位需要判断
  else if (idCard.length === 15) {
    const year = idCard.substring(6, 8)
    const month = idCard.substring(8, 10)
    const day = idCard.substring(10, 12)
    // 简单判断：如果年份大于当前年份后两位，则认为是19xx年，否则是20xx年
    const currentYear = new Date().getFullYear() % 100
    const birthYear = parseInt(year) > currentYear ? `19${year}` : `20${year}`
    birthDateStr = `${birthYear}${month}${day}`
  } else {
    return 0
  }
  
  // 解析出生日期
  const birthYear = parseInt(birthDateStr.substring(0, 4))
  const birthMonth = parseInt(birthDateStr.substring(4, 6))
  const birthDay = parseInt(birthDateStr.substring(6, 8))
  
  const birthDate = new Date(birthYear, birthMonth - 1, birthDay)
  const today = new Date()
  
  let age = today.getFullYear() - birthYear
  const monthDiff = today.getMonth() - (birthMonth - 1)
  const dayDiff = today.getDate() - birthDay
  
  // 如果还没过生日，年龄减1
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--
  }
  
  return age > 0 ? age : 0
}

// 从身份证号判断性别
const getGenderFromIdCard = (idCard) => {
  if (!idCard || idCard.length < 15) {
    return '未知'
  }
  
  let genderCode = ''
  // 18位身份证：倒数第二位为性别码，奇数为男，偶数为女
  if (idCard.length === 18) {
    genderCode = idCard.substring(16, 17)
  } 
  // 15位身份证：最后一位为性别码，奇数为男，偶数为女
  else if (idCard.length === 15) {
    genderCode = idCard.substring(14, 15)
  } else {
    return '未知'
  }
  
  return parseInt(genderCode) % 2 === 1 ? '男' : '女'
}

// 从 storage 获取患者信息
const getPatientInfo = () => {
  let patientName = ''
  let patientGender = '未知'
  let patientAge = 0
  
  try {
    const userInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
    if (userInfo) {
      patientName = userInfo.realName || ''
      
      // 从身份证号计算年龄和性别
      if (userInfo.idNumber) {
        patientAge = calculateAgeFromIdCard(userInfo.idNumber)
        patientGender = getGenderFromIdCard(userInfo.idNumber)
      }
      
      console.log('从 storage 获取患者信息:', {
        name: patientName,
        idNumber: userInfo.idNumber,
        age: patientAge,
        gender: patientGender
      })
    } else {
      console.warn('未找到用户注册信息')
    }
  } catch (e) {
    console.error('获取患者信息失败:', e)
  }
  
  return { patientName, patientGender, patientAge }
}

const onConsultationClick = () => {
  // 从 storage 获取患者信息
  const { patientName, patientGender, patientAge } = getPatientInfo()
  
  // 构建复诊数据
  const consultationData = {
    id: prescription.value.id,
    prescriptionId: prescription.value.id,
    doctorName: prescription.value.doctorName,
    doctorTitle: '副主任医师',
    department: prescription.value.department,
    hospital: prescription.value.hospital,
    medicineName: prescription.value.details,
    medicineQuantity: prescription.value.doses || prescription.value.quantity,
    doses: prescription.value.doses,
    quantity: prescription.value.quantity,
    details: prescription.value.details,
    productPrice: prescription.value.productPrice,
    patientName: patientName,
    patientGender: patientGender,
    patientAge: patientAge
  }
  
  // 跳转到复诊详情页
  const encodedData = encodeURIComponent(JSON.stringify(consultationData))
  uni.navigateTo({
    url: `/pages/order/consultation_detail?consultation=${encodedData}`,
    success: () => {
      console.log('跳转到复诊详情页成功')
    },
    fail: (err) => {
      console.error('跳转失败:', err)
      uni.showToast({
        title: '跳转失败，请重试',
        icon: 'none'
      })
    }
  })
}

const onContinuePrescription = () => {
  uni.showToast({
    title: '续方功能',
    icon: 'none'
  })
}

const onGoToOrder = () => {
  // 验证必要数据
  if (!prescription.value.id) {
    uni.showToast({
      title: '处方信息不完整',
      icon: 'none'
    })
    return
  }
  
  try {
    // 使用已加载的购物车数据
    const cartItems = allCartItems.value || []
    
    // 如果没有购物车商品，提示用户
    if (cartItems.length === 0) {
      uni.showToast({
        title: '购物车为空，请先选择商品',
        icon: 'none'
      })
      return
    }
    
    // 使用统一的工具函数构建订单信息（包含购物车中的所有产品）
    // 不传递 selectedProductIds，这样会包含所有购物车中的商品
    const orderInfo = buildOrderInfo(cartItems, null, prescription.value.hospital || '辽宁中医药大学附属医院')
    
    // 更新处方ID列表（包含当前处方ID，如果购物车中有多个产品，prescriptions 会包含所有产品ID）
    // 如果当前处方有对应的产品ID，确保它被包含在处方列表中
    const currentProductId = prescription.value.productId || prescription.value.id
    if (!orderInfo.prescriptions.includes(currentProductId)) {
      orderInfo.prescriptions.push(currentProductId)
    }
    // 同时确保当前处方ID也在列表中
    if (!orderInfo.prescriptions.includes(prescription.value.id)) {
      orderInfo.prescriptions.push(prescription.value.id)
    }
    
    // 保存订单信息
    uni.setStorageSync(STORAGE_KEY_CURRENT_ORDER, orderInfo)
    
    // 跳转到订单确认页面
    uni.navigateTo({
      url: '/pages/order/confirm',
      success: () => {
        console.log('跳转到订单确认页面成功')
      },
      fail: (err) => {
        console.error('跳转失败:', err)
        uni.showToast({
          title: '跳转失败，请重试',
          icon: 'none'
        })
      }
    })
  } catch (e) {
    console.error('保存订单信息失败:', e)
    uni.showToast({
      title: '保存订单信息失败',
      icon: 'none'
    })
  }
}
</script>

<style scoped>
.page {
  background: #f6f7fb;
  min-height: 100vh;
  padding-bottom: 140rpx;
}

.status-banner {
  background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
  padding: 30rpx 20rpx;
  color: #fff;
}

.status-content {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.status-icon {
  font-size: 40rpx;
}

.status-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.status-title {
  font-size: 36rpx;
  font-weight: 600;
}

.status-desc {
  font-size: 24rpx;
  opacity: 0.9;
}

.info-card {
  background: #fff;
  margin: 20rpx;
  border-radius: 12rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.05);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.card-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #f5f5f5;
}

.card-title {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.card-title text:first-child {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.card-time {
  font-size: 24rpx;
  color: #999;
}

.card-arrow {
  font-size: 32rpx;
  color: #ccc;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.info-row {
  display: flex;
  font-size: 26rpx;
}

.info-label {
  color: #666;
  min-width: 140rpx;
}

.info-value {
  color: #333;
  flex: 1;
}

.prescription-card {
  background: #fff;
  margin: 20rpx;
  border-radius: 12rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.05);
}

.prescription-header {
  margin-bottom: 20rpx;
}

.prescription-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.prescription-tabs {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.tab-item {
  padding: 8rpx 20rpx;
  background: #f5f5f5;
  color: #999;
  font-size: 24rpx;
  border-radius: 4rpx;
}

.tab-item.active {
  background: #e6f2ff;
  color: #4A90E2;
}

.prescription-content {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.medicines-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.medicine-item {
  display: flex;
  align-items: center;
  position: relative;
  padding: 16rpx;
  background: #f9f9f9;
  border-radius: 8rpx;
}

.medicine-left {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.medicine-thumb {
  width: 100%;
  height: 100%;
  border-radius: 8rpx;
  background: #eee;
}

.medicine-qty {
  position: absolute;
  right: -8rpx;
  top: -8rpx;
  background: #fff;
  color: #333;
  padding: 4rpx 10rpx;
  border-radius: 12rpx;
  font-size: 22rpx;
  border: 1rpx solid #ddd;
  font-weight: 600;
}

.medicine-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.medicine-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
}

.medicine-price {
  color: #e64340;
  font-size: 26rpx;
  font-weight: 600;
}

.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  display: flex;
  gap: 20rpx;
  padding: 20rpx;
  box-shadow: 0 -4rpx 12rpx rgba(0,0,0,0.1);
  z-index: 100;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
}

.footer-btn {
  flex: 1;
  margin: 0;
  padding:  0;
  border-radius: 50rpx;
  font-size: 30rpx;
  border: none;
}

.footer-btn.secondary {
  background: #fff;
  color: #666;
  border: 2rpx solid #ddd;
}

.footer-btn.primary {
  background: #4A90E2;
  color: #fff;
}
</style>
