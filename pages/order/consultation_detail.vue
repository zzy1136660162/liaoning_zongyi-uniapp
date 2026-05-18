<template>
  <view class="page">
    <!-- 状态横幅 -->
    <view class="status-banner">
      <view class="status-content">
        <view class="status-info">
          <text class="status-title">已完成</text>
          <text class="status-desc">复诊已完成</text>
        </view>
      </view>
    </view>

    <!-- 已开项目 -->
    <view class="section">
      <view class="section-title">已开项目</view>
      <view class="prescription-notice">
        <view class="notice-content">
          <text class="notice-text">已有开具处方</text>
        </view>
        <button class="view-btn" @click="onViewPrescription">立即查看</button>
      </view>
    </view>

    <!-- 复诊医生 -->
    <view class="section">
      <view class="section-title">复诊医生</view>
      <view class="doctor-card" @click="onDoctorClick">
        <image class="doctor-avatar" :src="doctorAvatarUrl" mode="aspectFill"></image>
        <view class="doctor-info">
          <view class="doctor-name-row">
            <text class="doctor-name">{{ consultation.doctorName }}</text>
            <text class="doctor-title">{{ consultation.doctorTitle }}</text>
          </view>
          <text class="doctor-department">{{ consultation.department }} {{ consultation.hospital }}</text>
        </view>
        <text class="card-arrow">›</text>
      </view>
    </view>

    <!-- 指定药品信息 -->
    <view class="section">
      <view class="section-title">指定药品信息</view>
      <view class="medicines-list" v-if="allCartItems.length > 0">
        <view 
          class="medicine-item"
          v-for="item in allCartItems" 
          :key="item.id"
        >
          <view class="medicine-info-row">
            <view class="medicine-name">{{ item.name }}</view>
            <view class="medicine-quantity">×{{ item.quantity }}</view>
          </view>
        </view>
      </view>
      <view class="medicine-info" v-else>
        <text class="medicine-name">{{ consultation.medicineName || '暂无药品信息' }}</text>
        <text class="medicine-quantity" v-if="consultation.medicineQuantity">×{{ consultation.medicineQuantity }}</text>
      </view>
    </view>

    <!-- 申请人信息 -->
    <view class="section">
      <view class="section-title">申请人信息</view>
      <view class="patient-info">
        <text class="info-label">就诊人</text>
        <text class="info-value">
          <text v-if="consultation.patientName">{{ consultation.patientName }}</text>
          <text v-if="consultation.patientGender"> {{ consultation.patientGender }}</text>
          <text v-if="consultation.patientAge > 0"> {{ consultation.patientAge }}岁</text>
          <text v-if="!consultation.patientName && !consultation.patientGender && consultation.patientAge === 0">未设置</text>
        </text>
      </view>
    </view>

    <!-- 订单信息 -->
    <view class="section">
      <view class="order-header" @click="toggleOrderExpand">
        <view class="section-title">订单信息</view>
        <view class="expand-btn">
          <text class="expand-text">{{ orderExpanded ? '收起' : '展开' }}</text>
          <text class="expand-icon" :class="{ 'expanded': orderExpanded }">▼</text>
        </view>
      </view>
      <view class="order-content" v-if="orderExpanded">
        <view class="order-row">
          <text class="order-label">订单总额</text>
          <text class="order-value">¥{{ orderTotal }}</text>
        </view>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view class="footer">
      <button class="footer-btn" @click="onRefresh">刷新</button>
      <button class="footer-btn" @click="onEvaluate">立即评价</button>
      <button class="footer-btn" @click="onViewConversation">查看会话</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { 
  STORAGE_KEY_USER_REGISTER,
  STORAGE_KEY_VERIFIED_PRODUCTS,
  STORAGE_KEY_PRODUCT_QUANTITIES
} from '@/utils/storage.js'
import { getConsultationDetail } from '@/api/consultation.js'
import { logPageView } from '@/api/access-log.js'
import { getImageUrl } from '@/utils/config.js'
import { getProductDetail } from '@/api/product.js'
import { getDoctorDetail } from '@/api/hospital.js'

const consultation = ref({
  id: '',
  doctorName: '',
  doctorId: null, // 医生ID，用于获取医生详情
  doctorTitle: '副主任医师',
  doctorAvatar: '', // 医生头像URL，从医生表获取
  department: '便捷配药门诊',
  hospital: '辽宁中医药大学附属医院',
  medicineName: '',
  medicineQuantity: 0,
  patientName: '',
  patientGender: '',
  patientAge: 0,
  productPrice: 4.51 // 单价，与商品详情页和处方详情页保持一致
})

// 默认头像路径（与 prescription_detail.vue 保持一致）
const DEFAULT_DOCTOR_AVATAR = '/liaoning_zongyi/zaixian_mingyi_logo.png'

// 计算医生头像：优先使用医生表的avatarUrl，如果没有则使用默认头像
const doctorAvatarUrl = computed(() => {
  if (consultation.value.doctorAvatar) {
    return getImageUrl(consultation.value.doctorAvatar)
  }
  return getImageUrl(DEFAULT_DOCTOR_AVATAR)
})

const orderExpanded = ref(false)
const allCartItems = ref([]) // 所有购物车商品

// 计算订单总额：所有商品的价格 * 数量之和
const orderTotal = computed(() => {
  if (allCartItems.value.length > 0) {
    const total = allCartItems.value.reduce((sum, item) => {
      const price = Number(item.price) || 0
      const quantity = Number(item.quantity) || 1
      return sum + (price * quantity)
    }, 0)
    return total.toFixed(2)
  }
  // 如果没有商品列表，使用 consultation 中的订单总额
  return consultation.value.orderTotal || '0.00'
})

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

// ✅ 从API加载咨询详情
const loadConsultationDetail = async (id) => {
  try {
    uni.showLoading({ title: '加载中...' })
    
    const consultationData = await getConsultationDetail(id)
    
    console.log('咨询详情:', consultationData)
    
    if (consultationData) {
      consultation.value.id = consultationData.id
      consultation.value.doctorName = consultationData.doctorName || '线上医生'
      consultation.value.doctorId = consultationData.doctorId || null
      consultation.value.department = consultationData.department || '便捷配药门诊'
      consultation.value.hospital = consultationData.hospitalName || consultation.value.hospital
      consultation.value.medicineName = consultationData.medicineName || consultationData.symptoms
      consultation.value.medicineQuantity = consultationData.quantity || 0
      
      // 如果有医生ID，从医生表获取医生详情（包括头像）
      if (consultation.value.doctorId) {
        await loadDoctorDetail(consultation.value.doctorId)
      } else if (consultationData.doctorAvatar) {
        // 如果咨询详情中有医生头像，直接使用
        consultation.value.doctorAvatar = consultationData.doctorAvatar
      }
    }
    
    uni.hideLoading()
  } catch (error) {
    console.error('加载咨询详情失败:', error)
    uni.hideLoading()
  }
}

// 从医生表获取医生详情（包括头像）
const loadDoctorDetail = async (doctorId) => {
  if (!doctorId) return
  
  try {
    const doctor = await getDoctorDetail(doctorId)
    if (doctor) {
      // 优先使用医生表的avatarUrl
      if (doctor.avatarUrl) {
        consultation.value.doctorAvatar = doctor.avatarUrl
      }
      // 如果医生详情中有其他信息，也可以更新
      if (doctor.name) {
        consultation.value.doctorName = doctor.name
      }
      if (doctor.department) {
        consultation.value.department = doctor.department
      }
      if (doctor.hospitalName) {
        consultation.value.hospital = doctor.hospitalName
      }
      if (doctor.title) {
        consultation.value.doctorTitle = doctor.title
      }
    }
  } catch (error) {
    console.warn('获取医生详情失败:', error)
  }
}

// 基于商品信息补全医生信息（参考 prescription_detail.vue）
const enrichByProduct = async (productId) => {
  if (!productId) return
  try {
    // 获取商品详情（含 doctorId）
    const product = await getProductDetail(productId)
    if (product && product.doctorId) {
      // 如果有 doctorId，从医生表获取医生详情（包括头像）
      await loadDoctorDetail(product.doctorId)
    }
  } catch (e) {
    console.warn('基于商品补全医生信息失败:', e)
  }
}

// 从 storage 读取已验证商品ID与数量，逐个获取商品详情
const loadCartFromStorage = async () => {
  try {
    const verifiedProducts = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
    const productQuantities = uni.getStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES) || {}
    const ids = Object.keys(verifiedProducts).filter(id => verifiedProducts[id])

    const items = []
    for (const id of ids) {
      try {
        const detail = await getProductDetail(id)
        if (detail) {
          items.push({
            id: detail.id,
            name: detail.productName || detail.name || '商品',
            price: Number(detail.price) || 0,
            quantity: productQuantities[id] || 1
          })
        }
      } catch (err) {
        console.warn('加载商品详情失败:', id, err)
      }
    }
    allCartItems.value = items
    console.log('加载的商品列表:', allCartItems.value)
    
  } catch (e) {
    console.error('从 storage 加载购物车失败', e)
    allCartItems.value = []
  }
}

// 从 storage 加载用户信息
const loadUserInfo = () => {
  try {
    const userInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
    if (userInfo) {
      // 从身份证号计算年龄和性别
      let age = 0
      let gender = '未知'
      
      if (userInfo.idNumber) {
        age = calculateAgeFromIdCard(userInfo.idNumber)
        gender = getGenderFromIdCard(userInfo.idNumber)
      }
      
      // 更新就诊人信息
      consultation.value.patientName = userInfo.realName || ''
      consultation.value.patientGender = gender
      consultation.value.patientAge = age
      
      console.log('从 storage 加载用户信息:', {
        name: userInfo.realName,
        idNumber: userInfo.idNumber,
        age,
        gender
      })
    } else {
      console.warn('未找到用户注册信息')
    }
  } catch (e) {
    console.error('加载用户信息失败:', e)
  }
}

onLoad(async (options) => {
  // 先加载用户信息
  loadUserInfo()
  
  // 从 storage 加载购物车商品（使用已验证商品ID）
  await loadCartFromStorage()
  
  // 如果有ID，从API加载
  if (options.id) {
    await loadConsultationDetail(options.id)
  } else if (options.consultation) {
    try {
      const consultationData = JSON.parse(decodeURIComponent(options.consultation))
      console.log('接收到的复诊数据:', consultationData)
      
      // 映射数据（保留从 storage 加载的用户信息，除非 consultationData 中有明确提供）
      consultation.value = {
        id: consultationData.id || consultationData.prescriptionId || '',
        doctorName: consultationData.doctorName || '线上名医',
        doctorId: consultationData.doctorId || null,
        doctorTitle: consultationData.doctorTitle || '副主任医师',
        doctorAvatar: consultationData.doctorAvatar || '', // 优先从医生表获取
        department: consultationData.department || '便捷配药门诊',
        hospital: consultationData.hospital || '辽宁中医药大学附属医院',
        medicineName: consultationData.details || consultationData.medicineName || consultationData.name || consultationData.formulaName || '',
        medicineQuantity: consultationData.doses || consultationData.quantity || consultationData.medicineQuantity || consultationData.packCount || 0,
        // 如果 consultationData 中有提供患者信息，则使用，否则使用从 storage 加载的信息
        patientName: consultationData.patientName || consultation.value.patientName || '',
        patientGender: consultationData.patientGender || consultation.value.patientGender || '',
        patientAge: consultationData.patientAge || consultation.value.patientAge || 0,
        // 统一价格计算：单价 * 数量 = 总价（与处方详情页和商品详情页保持一致）
        productPrice: consultationData.productPrice || 4.51 // 单价
      }
      
      console.log('解析后的复诊信息:', consultation.value)
      
      // 如果有医生ID，从医生表获取医生详情（包括头像）
      if (consultation.value.doctorId) {
        await loadDoctorDetail(consultation.value.doctorId)
      } else {
        // 如果没有医生ID，尝试从商品中获取 doctorId
        const productId = (allCartItems.value[0] && allCartItems.value[0].id) || null
        if (productId) {
          await enrichByProduct(productId)
        }
      }
    } catch (e) {
      console.error('解析复诊数据失败:', e)
      uni.showToast({
        title: '加载复诊信息失败',
        icon: 'none'
      })
    }
  } else {
    console.warn('未接收到复诊参数')
  }

  // 记录页面访问日志
  logPageView('咨询详情', '用户进入咨询详情页面')
})

const toggleOrderExpand = () => {
  orderExpanded.value = !orderExpanded.value
}

const onViewPrescription = () => {
  // 跳转到订单详情页
  if (consultation.value.id) {
    const orderData = {
      prescriptionNo: consultation.value.id,
      diagnosis: '虚劳类病', // 可以从 consultation 数据中获取
      doctor: `${consultation.value.doctorName} ${consultation.value.department}`,
      hospital: consultation.value.hospital,
      amount: orderTotal.value,
      statusText: '待下单',
      time: new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    const encodedData = encodeURIComponent(JSON.stringify(orderData))
    uni.navigateTo({
      url: `/pages/order/order-detail?order=${encodedData}`
    })
  } else {
    uni.showToast({
      title: '处方信息缺失',
      icon: 'none'
    })
  }
}

const onDoctorClick = () => {
  // uni.showToast({
  //   title: '查看医生详情',
  //   icon: 'none'
  // })
}

const onRefresh = () => {
  uni.showToast({
    title: '刷新中...',
    icon: 'loading',
    duration: 1000
  })
  // 可以在这里添加刷新数据的逻辑
  setTimeout(() => {
    uni.showToast({
      title: '刷新完成',
      icon: 'success'
    })
  }, 1000)
}

const onEvaluate = () => {
  uni.showToast({
    title: '评价功能',
    icon: 'none'
  })
}

const onViewConversation = () => {
  uni.showToast({
    title: '查看会话',
    icon: 'none'
  })
}
</script>

<style scoped>
.page {
  background: #f6f7fb;
  min-height: 100vh;
  padding-bottom: 160rpx;
}

.status-banner {
  background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
  padding: 40rpx 20rpx;
  color: #fff;
}

.status-content {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.status-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.status-title {
  font-size: 40rpx;
  font-weight: 600;
}

.status-desc {
  font-size: 26rpx;
  opacity: 0.9;
}

.section {
  background: #fff;
  margin: 20rpx;
  border-radius: 12rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.05);
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
}

/* 已开项目 */
.prescription-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #e8f5e9;
  border-radius: 8rpx;
  padding: 24rpx;
  position: relative;
  border: 1rpx solid #c8e6c9;
}

.prescription-notice::before {
  content: '';
  position: absolute;
  left: 20rpx;
  top: -12rpx;
  width: 0;
  height: 0;
  border-left: 12rpx solid transparent;
  border-right: 12rpx solid transparent;
  border-bottom: 12rpx solid #c8e6c9;
}

.prescription-notice::after {
  content: '';
  position: absolute;
  left: 22rpx;
  top: -10rpx;
  width: 0;
  height: 0;
  border-left: 10rpx solid transparent;
  border-right: 10rpx solid transparent;
  border-bottom: 10rpx solid #e8f5e9;
}

.notice-content {
  flex: 1;
}

.notice-text {
  font-size: 28rpx;
  color: #2e7d32;
  font-weight: 500;
}

.view-btn {
  background: #4A90E2;
  color: #fff;
  border: none;
  border-radius: 6rpx;
  padding: 0rpx 24rpx;
  border-radius: 50rpx;
  font-size: 26rpx;
  margin: 0;
  white-space: nowrap;
}

/* 复诊医生 */
.doctor-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 0;
}

.doctor-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: #f0f0f0;
}

.doctor-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.doctor-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.doctor-name {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
}

.doctor-title {
  font-size: 24rpx;
  color: #666;
  background: #f5f5f5;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
}

.doctor-department {
  font-size: 26rpx;
  color: #666;
}

.card-arrow {
  font-size: 32rpx;
  color: #ccc;
}

/* 指定药品信息 */
.medicines-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.medicine-item {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.medicine-item:last-child {
  border-bottom: none;
}

.medicine-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.medicine-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
}

.medicine-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  flex: 1;
}

.medicine-quantity {
  font-size: 28rpx;
  color: #666;
  margin-left: 20rpx;
}

/* 申请人信息 */
.patient-info {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 0;
}

.info-label {
  font-size: 26rpx;
  color: #666;
  min-width: 120rpx;
}

.info-value {
  font-size: 26rpx;
  color: #333;
  flex: 1;
}

/* 订单信息 */
.order-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
}

.expand-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  color: #4A90E2;
  font-size: 26rpx;
}

.expand-icon {
  font-size: 20rpx;
  transition: transform 0.3s;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.order-content {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.order-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 26rpx;
}

.order-label {
  color: #666;
}

.order-value {
  color: #333;
  font-weight: 500;
}


/* 底部操作栏 */
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
  font-size: 28rpx;
  border: 2rpx solid #4A90E2;
  background: #fff;
  color: #4A90E2;
}
</style>

