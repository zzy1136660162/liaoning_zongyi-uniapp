<template>
  <view class="page">
    <!-- 顶部蓝色状态条 -->
    <view class="top-header">
      <view class="status-main">{{ statusMainText }}</view>
      <view class="status-sub">{{ statusSubText }}</view>
    </view>

    <!-- 白色内容卡片（覆盖在蓝色块上） -->
    <view class="card-wrapper">
      <view class="card">
        <!-- 标题 -->
        <view class="card-title">处方单详情</view>

        <!-- 门诊号 -->
<!--        <view class="field-row">
          <text class="field-label">门诊号：</text>
          <text class="field-value">{{ detail.visitNo }}</text>
        </view>-->

        <view class="dash-line"></view>

        <!-- 基本信息两列布局 -->
        <view class="info-grid">
          <view class="info-col">
            <text class="info-label">姓名：</text>
            <text class="info-value">{{ detail.name }}</text>
          </view>
          <view class="info-col">
            <text class="info-label">性别：</text>
            <text class="info-value">{{ detail.gender }}</text>
          </view>

          <view class="info-col">
            <text class="info-label">年龄：</text>
            <text class="info-value">{{ detail.age }}岁</text>
          </view>
<!--          <view class="info-col">
            <text class="info-label">临床诊断：</text>
            <text class="info-value">{{ detail.diagnosis }}</text>
          </view>

          <view class="info-col">
            <text class="info-label">科室：</text>
            <text class="info-value">{{ detail.department }}</text>
          </view>-->
          <view class="info-col">
            <text class="info-label">开方医师：</text>
            <text class="info-value">{{ detail.doctorName || '—' }}</text>
          </view>
          <view class="info-col">
            <text class="info-label">开方日期：</text>
            <text class="info-value">{{ formatNullableDate(detail.date) }}</text>
          </view>
        </view>

        <view class="dash-line big-space"></view>

        <!-- Rp 区域 -->
        <view class="rp-block">
          <text class="rp-title">Rp</text>
          <view class="rp-content">
            <!-- 显示处方药品列表 -->
            <view v-if="detail.prescriptionItems && detail.prescriptionItems.length > 0" class="rp-items">
              <view
                  v-for="item in detail.prescriptionItems"
                  :key="item.id"
                  class="rp-item"
              >
                <view class="rp-item-main">
                  <text class="rp-drug-name">{{ item.drugName }}</text>
                  <text class="rp-dosage">{{ item.dosage }}</text>
                  <text v-if="item.frequency" class="rp-frequency">{{ item.frequency }}</text>
                  <text v-if="item.days" class="rp-days">{{ item.days }}天</text>
                </view>
                <!-- 使用/用量说明（来自 lnzy_product.usage_desc） -->
                <view v-if="item.usageDesc" class="rp-usage-desc">
                  <text class="usage-label">用法用量说明：</text>
                  <text class="usage-text">{{ item.usageDesc }}</text>
                </view>
              </view>
            </view>
            <!-- 如果没有药品列表，显示处方名称 -->
            <view v-else class="rp-name-fallback">
              <text class="rp-name">{{ detail.formulaName }}</text>
            </view>
          </view>



          <!-- 签名区域：显示与处方相关的医生、药师签名（若有多个，会各自列出）-->
          <view class="sign-row">
            <view class="sign-list" v-if="Object.keys(detail.associatedDoctors || {}).length > 0">
              <view class="sign-list-title">医生签名</view>
              <view class="sign-columns">
              </view>
            </view>
          </view>

          <view class="dash-line big-space"></view>

          <!-- 签名区域 -->
          <view class="sign-row">
            <view class="sign-item">
              <text class="sign-label">医师签名：</text>
              <image
                  class="sign-image"
                  :src="detail.doctorSignatureUrl || getImageUrl('/profile/liaoning_zongyi/zhongyi_qianming.png')"
                  mode="heightFix"
              />
            </view>
            <view class="sign-item">
              <text class="sign-label">药师签名：</text>
              <image
                  class="sign-image"
                  :src="detail.pharmacistSignatureUrl || getImageUrl('/profile/liaoning_zongyi/zhongyi_qianming.png')"
                  mode="heightFix"
              />
            </view>
          </view>
        </view>
      </view>

      <!-- 底部按钮 -->
    </view>
    <view class="bottom-bar" v-if="orderStatus.status === 0">
      <button class="bottom-btn" @tap="goBuy">去购药</button>
    </view>
  </view>
</template>

<script>
import {
  STORAGE_KEY_CURRENT_ORDER,
  STORAGE_KEY_USER_REGISTER,
  STORAGE_KEY_PRESCRIPTION_ORDERS,
  STORAGE_KEY_VERIFIED_PRODUCTS,
  STORAGE_KEY_PRODUCT_QUANTITIES, STORAGE_KEY_SELECTED_PRODUCTS
} from '@/utils/storage.js'
import { getPrescriptionDetail, getPrescriptionItems, getConsultationDetail } from '@/api/consultation.js'
import { resolveConsultationDoctorName } from '@/utils/consultation-mode.js'
import { getProductDetail } from '@/api/product.js'
import { getOrderByPrescriptionId, getMyOrders } from '@/api/order.js'
import { getImageUrl } from '@/utils/config.js'
import { getDoctorDetail, getDoctorByOutpatientNo } from '@/api/hospital.js'
import { logPageView } from '@/api/access-log.js'

export default {
  name: 'PrescriptionDetail',
  data() {
    return {
      detail: {
        visitNo: '',
        name: '',
        gender: '',
        age: 0,
        diagnosis: '',
        department: '便捷配药门诊',
        date: '',
        formulaName: '',
        packCount: 1,
        usage: '',
        doctorName: '',
        pharmacistName: '',
        productPrice: 0,
        prescriptionItems: [], // 处方药品列表
        // 签名与关联医生/药师信息（按 id 映射）
        associatedDoctors: {}, // { [doctorId]: { name, signatureUrl, title, hospital } }
        associatedPharmacists: {}, // { [pharmacistId]: { name, signatureUrl, title, hospital } }
        doctorId: null,
        doctorSignatureUrl: '' // 医师签名图片
      },
      // 订单状态相关信息
      orderStatus: {
        status: 0, // 订单状态：0待支付，1待发货，2待收货，3已完成，4已取消
        orderNo: '', // 订单号
        logisticsNo: '', // 快递单号
        logisticsCompany: '' // 快递公司
      },
      // 保存页面参数，用于订单查询
      pageOptions: {
        prescriptionNo: null // 保存原始的 prescriptionNo 参数
      }
    }
  },
  computed: {
    // 根据订单状态计算显示的文本
    statusMainText() {
      const statusMap = {
        0: '待支付',
        1: '已支付',
        2: '配送中',
        3: '已完成',
        4: '已取消'
      }
      return statusMap[this.orderStatus.status] || '待下单'
    },
    statusSubText() {
      switch (this.orderStatus.status) {
        case 0:
          return '等待下单支付'
        case 1:
          return '药品准备中'
        case 2:
          if (this.orderStatus.logisticsNo) {
            return `${this.orderStatus.logisticsCompany || '快递'}单号：${this.orderStatus.logisticsNo}`
          }
          return '药品配送中'
        case 3:
          return '订单已完成'
        case 4:
          return '订单已取消'
        default:
          return '等待下单支付'
      }
    }
  },
  async onLoad(options) {
    this.pageOptions.prescriptionNo = options.prescriptionNo || null
    this.loadUserInfo()

    if (options.prescriptionNo) {
      await this.loadPrescriptionById(options.prescriptionNo)
    }

    // 接收处方数据参数（与复诊详情页保持一致）
    if (options.prescription) {
      try {
        const prescriptionData = JSON.parse(decodeURIComponent(options.prescription))
        console.log('接收到的处方数据:', prescriptionData)

        // 更新处方信息
        this.detail.visitNo = prescriptionData.id || prescriptionData.visitNo || this.detail.visitNo
        this.detail.formulaName = prescriptionData.details || prescriptionData.medicineName || prescriptionData.formulaName || prescriptionData.name || this.detail.formulaName
        this.detail.packCount = prescriptionData.doses || prescriptionData.quantity || prescriptionData.packCount || this.detail.packCount
        this.detail.productPrice = prescriptionData.productPrice || this.detail.productPrice
        this.detail.name = prescriptionData.patientName || prescriptionData.name || this.detail.name
        // 注意：性别和年龄优先从身份证号识别，只有在没有身份证号时才使用参数中的值
        // 这里先设置参数中的值，但后面会从身份证号重新识别（如果有身份证号）
        this.detail.gender = prescriptionData.patientGender || prescriptionData.gender || this.detail.gender
        this.detail.age = prescriptionData.patientAge || prescriptionData.age || this.detail.age
        this.detail.diagnosis = prescriptionData.diagnosis || this.detail.diagnosis
        this.detail.department = prescriptionData.department || this.detail.department
        const doctorName = this.resolvePrescriptionDoctorName(prescriptionData)
        if (doctorName) {
          this.detail.doctorName = doctorName
        }
        const rawDate = this.resolvePrescriptionDate(prescriptionData) || this.detail.date
        this.detail.date = this.formatDate(rawDate) || this.detail.date

            // 如果传入数据中包含医生ID，尝试用医生表的 outpatient_no 覆盖 visitNo
            await (async () => {
              try {
                const doctorId = prescriptionData.doctorId || prescriptionData.doctor_id || prescriptionData.doctor || null
                if (doctorId) {
                  const doc = await getDoctorDetail(doctorId)
                  if (doc) {
                    this.detail.visitNo = doc.outpatientNo || doc.outpatient_no || this.detail.visitNo
                    console.log('从医生表获取门诊号并设置 visitNo:', this.detail.visitNo)
                  }
                }
              } catch (e) {
                console.warn('通过 doctorId 获取医生门诊号失败', e)
              }
            })()
      } catch (e) {
        console.error('解析处方数据失败:', e)
      }
    }

    // 确保性别和年龄优先从身份证号识别（如果有身份证号）
    // 这样可以覆盖 URL 参数中的性别和年龄，确保身份证号的信息优先级最高
    this.ensureGenderAndAgeFromIdCard()

    await this.loadOrderStatus()

    logPageView('处方详情', '用户进入处方详情页面')
  },
  methods: {
    // 图片URL处理函数
    getImageUrl,

    async applyDoctorFromPrescription(prescriptionData) {
      if (!prescriptionData) {
        return
      }
      const resolvedDoctorName = this.resolvePrescriptionDoctorName(prescriptionData)
      if (resolvedDoctorName && !this.detail.doctorName) {
        this.detail.doctorName = resolvedDoctorName
      }
      const doctorId = prescriptionData.doctorId || prescriptionData.doctor_id || null
      if (doctorId) {
        try {
          const doc = await getDoctorDetail(doctorId)
          if (doc) {
            this.detail.doctorId = doctorId
            this.detail.doctorName = doc.name || this.detail.doctorName
            this.detail.department = doc.department || this.detail.department
            const signatureUrl = doc.signatureUrl || doc.signature_url || doc.signature || ''
            if (signatureUrl) {
              this.detail.doctorSignatureUrl = getImageUrl(signatureUrl)
            }
            return
          }
        } catch (e) {
          console.warn('从处方 doctorId 获取医师失败', e)
        }
      }

      const consultationId = prescriptionData.consultationId || prescriptionData.consultation_id
      if (consultationId) {
        try {
          const consultation = await getConsultationDetail(consultationId)
          const displayName = resolveConsultationDoctorName(consultation)
          if (displayName) {
            this.detail.doctorName = displayName
          }
          if (consultation.department) {
            this.detail.department = consultation.department
          }
          if (consultation.doctorId && !this.detail.doctorSignatureUrl) {
            const doc = await getDoctorDetail(consultation.doctorId)
            if (doc) {
              this.detail.doctorId = consultation.doctorId
              const signatureUrl = doc.signatureUrl || doc.signature_url || ''
              if (signatureUrl) {
                this.detail.doctorSignatureUrl = getImageUrl(signatureUrl)
              }
              if (!this.detail.doctorName) {
                this.detail.doctorName = doc.name || ''
              }
            }
          }
        } catch (e) {
          console.warn('从咨询记录补全医师信息失败', e)
        }
      }
    },

    // 从订单信息更新处方详情
    updateDetailFromOrder(orderInfo) {
      const doctorName = this.resolvePrescriptionDoctorName(orderInfo)
      if (doctorName && !this.detail.doctorName) {
        this.detail.doctorName = doctorName
      }
      if (orderInfo.prescriptionDiagnosis) {
        this.detail.diagnosis = orderInfo.prescriptionDiagnosis
      }
      const prescriptionDate = this.resolvePrescriptionDate(orderInfo)
      if (prescriptionDate) {
        this.detail.date = this.formatDate(prescriptionDate)
      }

      // 更新处方ID（如果还没有设置）
      if (!this.detail.visitNo && orderInfo.prescriptionId) {
        this.detail.visitNo = orderInfo.prescriptionId.toString()
      }

      // 从订单商品列表构建处方药品列表
      if (orderInfo.items && orderInfo.items.length > 0) {
        this.detail.prescriptionItems = orderInfo.items.map(item => ({
          id: item.id,
          drugName: item.productName,
          dosage: item.specText || '',
          frequency: '',
          days: '',
          usageDesc: '',
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          unit: item.unit,
          productDetail: {
            id: item.productId,
            name: item.productName,
            image: item.productImage,
            price: item.price,
            unit: item.unit
          }
        }))

        // 使用第一个商品的信息作为主要商品信息
        const firstItem = orderInfo.items[0]
        this.detail.formulaName = firstItem.productName || this.detail.formulaName
        this.detail.productPrice = firstItem.price || this.detail.productPrice
        this.detail.packCount = firstItem.quantity || this.detail.packCount
      }

      // 设置医生ID（如果有的话）
      if (orderInfo.doctorId) {
        this.detail.doctorId = orderInfo.doctorId
      }
    },

    // 获取订单状态信息
    async loadOrderStatus() {
      try {
        console.log('111111111111111111');
        
        // 首先尝试从存储的订单信息中获取（处理正在创建的订单）
        const currentOrder = uni.getStorageSync(STORAGE_KEY_CURRENT_ORDER)
        if (currentOrder && currentOrder.prescriptions && currentOrder.prescriptions.includes(this.detail.visitNo)) {
          // 如果当前订单包含此门诊号，说明这是一个正在处理的订单
          this.orderStatus.status = 0 // 待支付
          this.orderStatus.orderNo = currentOrder.orderNo || ''
          console.log('从本地存储获取订单状态（待支付）:', this.orderStatus)
          return
        }

        // 通过处方ID查询订单信息
        // 优先使用原始的 prescriptionNo 参数，其次使用 detail.visitNo
        const prescriptionId = this.pageOptions.prescriptionNo 
        console.log('查询订单使用的处方ID:', prescriptionId)
        const orderInfo = await getOrderByPrescriptionId(prescriptionId)

        if (orderInfo && orderInfo.id) {
          // 更新订单状态信息
          this.orderStatus.status = orderInfo.orderStatus !== null && orderInfo.orderStatus !== undefined
            ? orderInfo.orderStatus
            : (orderInfo.status || 0)
          this.orderStatus.orderNo = orderInfo.orderNo || orderInfo.id || ''

          // 如果是配送中状态，尝试获取物流信息
          if (this.orderStatus.status === 2 && orderInfo.logisticsNo) {
            this.orderStatus.logisticsNo = orderInfo.logisticsNo
            this.orderStatus.logisticsCompany = orderInfo.logisticsCompany || '顺丰快递'
          }

          this.updateDetailFromOrder(orderInfo)
          if (!this.detail.doctorName && orderInfo.doctorId) {
            await this.applyDoctorFromPrescription({ doctorId: orderInfo.doctorId })
          }

          console.log('通过处方ID查询到订单状态:', this.orderStatus)
          console.log('从订单更新处方详情:', this.detail)
        } else {
          console.log('未找到对应的订单信息，保持默认状态')
        }
      } catch (error) {
        console.error('获取订单状态失败:', error)
        // 如果API查询失败，尝试备用方案：从订单列表中查找
        try {
          const orders = await getMyOrders()

          if (orders && orders.length > 0) {
            // 查找包含此门诊号的订单
            const prescriptionId = this.pageOptions.prescriptionNo || this.detail.visitNo
            const relatedOrder = orders.find(order =>
              order.items && order.items.some(item =>
                item.id === prescriptionId ||
                (item.prescriptionId && item.prescriptionId === prescriptionId)
              )
            )

            if (relatedOrder) {
              this.orderStatus.status = relatedOrder.orderStatus !== null && relatedOrder.orderStatus !== undefined
                ? relatedOrder.orderStatus
                : (relatedOrder.status || 0)
              this.orderStatus.orderNo = relatedOrder.orderNo || relatedOrder.id || ''

              // 如果是配送中状态，尝试获取物流信息
              if (this.orderStatus.status === 2 && relatedOrder.logisticsNo) {
                this.orderStatus.logisticsNo = relatedOrder.logisticsNo
                this.orderStatus.logisticsCompany = relatedOrder.logisticsCompany || '顺丰快递'
              }

              // 从订单信息更新处方详情
              this.updateDetailFromOrder(relatedOrder)

              console.log('备用方案：从订单列表中找到订单状态:', this.orderStatus)
              console.log('从订单更新处方详情:', this.detail)
            }
          }
        } catch (backupError) {
          console.error('备用方案也失败:', backupError)
          // 出错时保持默认状态
        }
      }
    },

    // 从身份证号计算年龄
    calculateAgeFromIdCard(idCard) {
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
    },

    // 从身份证号判断性别
    getGenderFromIdCard(idCard) {
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
    },

    // 格式化日期，只显示年月日
    formatDate(dateStr) {
      if (!dateStr) {
        return ''
      }

      try {
        // 如果是时间戳（数字）
        if (typeof dateStr === 'number') {
          const date = new Date(dateStr)
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }

        // 如果是字符串
        if (typeof dateStr === 'string') {
          // 处理 ISO 格式：2024-01-01T10:30:00 或 2024-01-01 10:30:00
          const datePart = dateStr.split('T')[0].split(' ')[0]
          // 验证格式是否为 YYYY-MM-DD
          if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            return datePart
          }

          // 尝试解析为日期对象
          const date = new Date(dateStr)
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
          }
        }

        return dateStr
      } catch (e) {
        console.error('格式化日期失败:', e)
        return dateStr
      }
    },

    formatNullableDate(dateStr) {
      return this.formatDate(dateStr) || '—'
    },

    resolvePrescriptionDoctorName(source = {}) {
      return source.doctorName ||
        source.doctor_name ||
        source.doctor ||
        source.openDoctorName ||
        source.open_doctor_name ||
        ''
    },

    resolvePrescriptionDate(source = {}) {
      return source.prescriptionTime ||
        source.prescription_time ||
        source.consultationTime ||
        source.consultation_time ||
        source.createdAt ||
        source.createTime ||
        source.created_at ||
        source.date ||
        ''
    },

    // 从 storage 加载用户信息
    loadUserInfo() {
      try {
        const userInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
        if (userInfo) {
          this.detail.name = userInfo.realName || this.detail.name

          // 从身份证号计算年龄和性别
          if (userInfo.idNumber) {
            this.detail.age = this.calculateAgeFromIdCard(userInfo.idNumber)
            this.detail.gender = this.getGenderFromIdCard(userInfo.idNumber)

            console.log('从 storage 加载用户信息:', {
              name: userInfo.realName,
              idNumber: userInfo.idNumber,
              age: this.detail.age,
              gender: this.detail.gender
            })
          }
        }
      } catch (e) {
        console.error('加载用户信息失败:', e)
      }
    },

    // 确保性别和年龄从身份证号识别（优先级最高）
    ensureGenderAndAgeFromIdCard() {
      try {
        const userInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
        if (userInfo && userInfo.idNumber) {
          // 优先使用身份证号识别的性别和年龄
          const ageFromIdCard = this.calculateAgeFromIdCard(userInfo.idNumber)
          const genderFromIdCard = this.getGenderFromIdCard(userInfo.idNumber)

          if (ageFromIdCard > 0) {
            this.detail.age = ageFromIdCard
          }
          if (genderFromIdCard !== '未知') {
            this.detail.gender = genderFromIdCard
          }

          console.log('从身份证号重新识别性别和年龄:', {
            idNumber: userInfo.idNumber,
            age: this.detail.age,
            gender: this.detail.gender
          })
        }
      } catch (e) {
        console.error('从身份证号识别性别和年龄失败:', e)
      }
    },

    // 根据处方ID从 storage 加载处方信息
    // ✅ 从API加载处方详情
    async loadPrescriptionById(id) {
      try {
        uni.showLoading({ title: '加载中...' })

        // 调用后端API获取处方详情
        const prescriptionData = await getPrescriptionDetail(id)

        console.log('处方详情:', prescriptionData)

        if (prescriptionData) {
          // 优先尝试从处方记录关联的 doctor_id 获取医生门诊号（lnzy_doctor.outpatient_no）
          let visitNoFromDoctor = null
          try {
            const doctorId = prescriptionData.doctorId || prescriptionData.doctor_id || prescriptionData.doctor || null
            if (doctorId) {
              const doc = await getDoctorDetail(doctorId)
              if (doc) {
                visitNoFromDoctor = doc.outpatientNo || doc.outpatient_no || null
              }
            }
          } catch (e) {
            console.warn('获取医生门诊号失败', e)
          }
          this.detail.visitNo = visitNoFromDoctor || prescriptionData.consultationNo || prescriptionData.id || id
          this.detail.formulaName = prescriptionData.formulaName || prescriptionData.medicineName || ''
          this.detail.packCount = prescriptionData.doses || prescriptionData.quantity || 1
          this.detail.productPrice = prescriptionData.totalAmount || 0
          this.detail.diagnosis = prescriptionData.diagnosis || ''
          this.detail.department = prescriptionData.department || '便捷配药门诊'
          this.detail.doctorName = this.resolvePrescriptionDoctorName(prescriptionData) || this.detail.doctorName
          this.detail.date = this.formatDate(this.resolvePrescriptionDate(prescriptionData)) || this.detail.date

          this.detail.doctorId = prescriptionData.doctorId || null
          await this.applyDoctorFromPrescription(prescriptionData)

          // 获取处方药品列表
          try {
            const prescriptionItems = await getPrescriptionItems(id)
            this.detail.prescriptionItems = prescriptionItems || []
            console.log('处方药品列表:', prescriptionItems)
            if (this.detail.prescriptionItems.length > 0) {
              const firstItem = this.detail.prescriptionItems[0]
              if (firstItem.price) {
                this.detail.productPrice = Number(firstItem.price)
              }
              if (firstItem.quantity) {
                this.detail.packCount = Number(firstItem.quantity) || this.detail.packCount
              }
            }

            // 针对每个处方项，查询商品详情以获得 usage_desc、doctor_id、pharmacist_id 等信息
            const doctorIds = new Set()
            const pharmacistIds = new Set()
            for (const item of this.detail.prescriptionItems) {
              try {
                // 处方明细中保存的是 prescription_item.id 与 product_id
                const productId = item.productId || item.product_id || item.product || null
                console.log('处理处方项，prescription_item.id=', item.id, 'productId=', productId)
                if (!productId) {
                  // 没有关联商城商品，跳过但保留处方明细文本信息
                  console.log('处方项没有关联商城商品，跳过 product fetch for item.id=', item.id)
                  continue
                }
                const product = await getProductDetail(productId)
                console.log('商品详情返回', productId, product)
                if (product) {
                  // 兼容不同字段命名
                  item.usageDesc = product.usageDesc || product.usage_desc || product.usage || ''
                  const pDoctorId = product.doctorId || product.doctor_id || product.doctor || null
                  const pPharmacistId = product.pharmacistId || product.pharmacist_id || product.pharmacist || null
                  item.productDetail = product
                  console.log('从商品中读取 doctorId, pharmacistId:', pDoctorId, pPharmacistId)
                  if (pDoctorId) doctorIds.add(pDoctorId)
                  if (pPharmacistId) pharmacistIds.add(pPharmacistId)
                }
              } catch (prodErr) {
                console.warn('get product detail failed:', item.id || item.product_id || item.productId, prodErr)
              }
            }

            // 使用 doctorId/pharmacistId 列表去拉取对应医生/药师详情（去重）
            for (const docId of Array.from(doctorIds)) {
              try {
                console.log('获取关联医生详情 docId=', docId)
                const doc = await getDoctorDetail(docId)
                console.log('关联医生详情返回', doc)
                if (doc) {
                  const sig = getImageUrl(doc.signatureUrl || doc.signature_url || doc.signature || doc.signUrl || '')
                  console.log('解析到医生签名sig=', sig, '医生avatar/头像兼容字段:', doc.avatarUrl || doc.avatar || doc.avatar_url)
                  this.detail.associatedDoctors[docId] = {
                    name: doc.name || '',
                    title: doc.title || '',
                    hospital: doc.hospitalName || doc.hospital || '',
                    signatureUrl: sig
                  }
                }
              } catch (e) {
                console.warn('获取关联医生详情失败:', docId, e)
              }
            }
            for (const phId of Array.from(pharmacistIds)) {
              try {
                // 假设药师也在医生表或同一接口可查询
                const ph = await getDoctorDetail(phId)
                if (ph) {
                  this.detail.associatedPharmacists[phId] = {
                    name: ph.name || '',
                    title: ph.title || '',
                    hospital: ph.hospitalName || ph.hospital || '',
                    signatureUrl: getImageUrl(ph.signatureUrl || ph.signature_url || ph.signature || ph.signUrl || '')
                  }
                }
              } catch (e) {
                console.warn('获取关联药师详情失败:', phId, e)
              }
            }


          } catch (itemError) {
            console.warn('获取处方药品列表失败:', itemError)
            this.detail.prescriptionItems = []
          }

          // 使用第一个处方项关联的商品的 doctor_id / pharmacist_id 获取医生/药师信息并显示 avatarUrl（首项优先）
          try {
            const firstItem = (this.detail.prescriptionItems || []).find(it => it && (it.productDetail || it.productId || it.product_id))
            if (firstItem) {
              const productDetail = firstItem.productDetail || {}
              const firstDoctorId = productDetail.doctorId || productDetail.doctor_id || productDetail.doctor || null
              const firstPharmacistId = productDetail.pharmacistId || productDetail.pharmacist_id || productDetail.pharmacist || null

              if (firstDoctorId && !this.detail.doctorName) {
                try {
                  const doc = await getDoctorDetail(firstDoctorId)
                  if (doc) {
                    const signatureUrl = doc.signatureUrl
                    if (signatureUrl && !this.detail.doctorSignatureUrl) {
                      this.detail.doctorSignatureUrl = getImageUrl(signatureUrl)
                    }
                    this.detail.doctorName = doc.name || this.detail.doctorName
                  }
                } catch (docErr) {
                  console.warn('获取首项商品关联医生信息失败:', docErr)
                }
              }

              if (firstPharmacistId) {
                try {
                  console.log('使用首项product的pharmacistId去获取药师详情:', firstPharmacistId)
                  const ph = await getDoctorDetail(firstPharmacistId)
                  console.log('首项关联药师详情返回', ph)
                  if (ph) {
                    const signatureUrl = ph.signatureUrl
                    this.detail.pharmacistSignatureUrl = getImageUrl(signatureUrl)
                    console.log('set detail.pharmacistSignatureUrl =', this.detail.pharmacistSignatureUrl, 'raw avatar field=', signatureUrl)
                    this.detail.pharmacistName = this.detail.pharmacistName || ph.name || this.detail.pharmacistName
                  }
                } catch (phErr) {
                  console.warn('获取首项商品关联药师信息失败:', phErr)
                }
              }
            }
          } catch (e) {
            console.warn('处理首项商品关联医师/药师信息失败', e)
          }

          // 缓存到本地
          const prescriptions = uni.getStorageSync(STORAGE_KEY_PRESCRIPTION_ORDERS) || []
          const index = prescriptions.findIndex(p => p.id === id)
          if (index > -1) {
            prescriptions[index] = { ...prescriptions[index], ...prescriptionData }
            uni.setStorageSync(STORAGE_KEY_PRESCRIPTION_ORDERS, prescriptions)
          }
        }

        uni.hideLoading()
      } catch (error) {
        console.error('加载处方详情失败:', error)
        uni.hideLoading()

        // 显示用户友好的错误提示
        let errorMessage = '加载处方详情失败'
        if (error && error.message) {
          if (error.message.includes('无权限')) {
            errorMessage = '您没有权限查看此处方'
          } else if (error.message.includes('不存在')) {
            errorMessage = '处方信息不存在'
          } else {
            errorMessage = error.message
          }
        }

        uni.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 3000
        })

        // API失败时从本地加载
        const prescriptions = uni.getStorageSync(STORAGE_KEY_PRESCRIPTION_ORDERS) || []
        const prescription = prescriptions.find(p => p.id === id || p.visitNo === id)

        if (prescription) {
          this.detail.visitNo = prescription.id || prescription.visitNo || this.detail.visitNo
          this.detail.formulaName = prescription.details || prescription.medicineName || prescription.formulaName || prescription.name || this.detail.formulaName
          this.detail.packCount = prescription.doses || prescription.quantity || prescription.packCount || this.detail.packCount
          this.detail.productPrice = prescription.productPrice || this.detail.productPrice
          this.detail.diagnosis = prescription.diagnosis || this.detail.diagnosis
          this.detail.department = prescription.department || this.detail.department
          const doctorName = this.resolvePrescriptionDoctorName(prescription)
          if (doctorName) {
            this.detail.doctorName = doctorName
          }
          const rawDate = this.resolvePrescriptionDate(prescription) || this.detail.date
          this.detail.date = this.formatDate(rawDate) || this.detail.date
        } else {
          // 如果 storage 中没有找到，使用 prescriptionNo 作为 visitNo
          this.detail.visitNo = id
          console.warn('未在 storage 中找到处方信息，使用默认值')
        }
      }
    },

    goBuy() {
      // 验证订单状态，只有待支付状态才能购药
      if (this.orderStatus.status !== 0) {
        const statusText = this.statusMainText || '非待支付状态'
        uni.showToast({
          title: `订单状态为${statusText}，无法购药`,
          icon: 'none'
        })
        return
      }

      // 验证必要数据
      if (!this.detail.visitNo) {
        uni.showToast({
          title: '处方信息不完整',
          icon: 'none'
        })
        return
      }

      // 构建订单信息
      // 使用统一的单价和数量计算总价（与商品详情页和复诊详情页保持一致）
      const unitPrice = this.detail.productPrice
        || (this.detail.prescriptionItems[0] && this.detail.prescriptionItems[0].price)
        || 0
      const quantity = this.detail.packCount || 1
      const totalPrice = parseFloat((unitPrice * quantity).toFixed(2))

      const orderItems = [{
        id: this.detail.visitNo,
        name: this.detail.formulaName || '中药处方',
        type: '中药',
        price: totalPrice,
        quantity: quantity
      }]

      const medicineCost = parseFloat(orderItems.reduce((sum, item) => sum + item.price, 0).toFixed(2))

      const orderInfo = {
        prescriptions: [this.detail.visitNo],
        items: orderItems,
        deliveryInfo: {
          distributor: '辽宁中医药大学附属医院',
          logistics: '顺丰快递',
          purchaseMethod: '药品配送-在线支付',
          shippingPaymentMethod: '在线支付'
        },
        cost: {
          medicineCost: medicineCost,
          isDecocted: false,
          shippingFee: 0 // 确认页面会自动设置为18元
        },
        total: medicineCost // 确认页面会重新计算包含快递费的总价
      }

      // 保存订单信息
      try {
        // 同步到购物车/已验证产品，确保 confirm 页面能正确加载商品明细
        try {
          const verified = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
          const quantities = uni.getStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES) || {}
          const selected = uni.getStorageSync(STORAGE_KEY_SELECTED_PRODUCTS) || []

          // 如果处方里包含处方明细且有关联商城商品ID，则优先把这些商品加入到已验证列表
          const associatedProductIds = []
          if (this.detail.prescriptionItems && this.detail.prescriptionItems.length > 0) {
            for (const pi of this.detail.prescriptionItems) {
              const pid = pi.productId || pi.product_id || pi.product || null
              if (pid) {
                const key = String(pid)
                verified[key] = true
                // 处方明细里没有明确数量时，使用处方页的 packCount 或明细的 days 作为兜底
                quantities[key] = quantities[key] || pi.quantity || pi.days || this.detail.packCount || 1
                if (!selected.includes(key)) selected.push(key)
                associatedProductIds.push(key)
              }
            }
          } else {
            // 如果没有处方商品关联到商城商品，把处方本身作为一个虚拟商品放入已选列表（id 使用 visitNo，confirm 会使用 current_order 的 items）
            // 这里仍然标记 visitNo 在已选项中，避免 confirm 页出现空商品列表（某些流程会用到 selected_products）
            const vkey = String(this.detail.visitNo || '')
            if (vkey) {
              verified[vkey] = true
              quantities[vkey] = quantities[vkey] || (this.detail.packCount || 1)
              if (!selected.includes(vkey)) selected.push(vkey)
            }
          }

          uni.setStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS, verified)
          uni.setStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES, quantities)
          uni.setStorageSync(STORAGE_KEY_SELECTED_PRODUCTS, selected)
          console.log('同步购物车已验证商品:', associatedProductIds.length ? associatedProductIds : (this.detail.visitNo || 'visitNo'), verified, quantities)
        } catch (syncErr) {
          console.warn('同步购物车信息失败:', syncErr)
        }

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
  }
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background-color: #f7f7f7;
  padding-bottom: 140rpx; // 预留底部按钮空间
  box-sizing: border-box;
}

/* 顶部蓝色渐变块 */
.top-header {
  height: 220rpx;
  padding: 40rpx 40rpx 0;
  box-sizing: border-box;
  background: linear-gradient(180deg, #4a8cff, #4aa0ff);
  color: #ffffff;
}

.status-main {
  font-size: 32rpx;
  font-weight: 600;
}

.status-sub {
  margin-top: 8rpx;
  font-size: 26rpx;
  opacity: 0.9;
}

/* 白卡片整体往上“顶”一点，形成悬浮感 */
.card-wrapper {
  margin-top: -60rpx;
  padding: 0 24rpx;
}

.card {
  background-color: #ffffff;
  border-radius: 24rpx;
  padding: 40rpx 32rpx 32rpx;
  box-shadow: 0 6rpx 16rpx rgba(0, 0, 0, 0.06);
}

/* 标题 */
.card-title {
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  color: #333333;
  margin-bottom: 30rpx;
}

/* 行样式 */
.field-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 18rpx;
}

.field-label {
  font-size: 26rpx;
  color: #777777;
  width: 140rpx;
}

.field-value {
  font-size: 28rpx;
  color: #333333;
}

/* 虚线分割 */
.dash-line {
  border-bottom: 1px dashed #e0e0e0;
  margin: 18rpx 0;
}

.big-space {
  margin-top: 40rpx;
}

/* 两列信息 */
.info-grid {
  display: flex;
  flex-wrap: wrap;
  margin-top: 10rpx;
}

.info-col {
  width: 50%;
  flex-direction: row;
  display: flex;
  margin-bottom: 16rpx;
}

.info-label {
  font-size: 26rpx;
  color: #777777;
}

.info-value {
  font-size: 28rpx;
  color: #333333;
}

/* Rp 区域 */
.rp-block {
  margin-top: 20rpx;
}

.rp-title {
  font-size: 40rpx;
  font-weight: 600;
  color: #333333;
}

.rp-content {
  margin-top: 24rpx;
}

.rp-name {
  font-size: 30rpx;
  color: #333333;
}

.rp-items {
  margin-top: 16rpx;
}

.rp-item {
  display: flex;
  flex-direction: column;
  margin-bottom: 12rpx;
  padding: 16rpx;
  background-color: #f8f9fa;
  border-radius: 8rpx;
}

.rp-drug-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #333333;
  margin-bottom: 8rpx;
}

.rp-item-main {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-wrap: wrap;
}

.rp-usage-desc {
  margin-top: 10rpx;
  padding: 12rpx;
  background: #ffffff;
  border-radius: 6rpx;
  border: 1rpx solid #f0f0f0;
}

.usage-label {
  font-size: 26rpx;
  color: #666;
  margin-right: 8rpx;
  font-weight: 500;
}

.usage-text {
  font-size: 26rpx;
  color: #333;
  line-height: 1.6;
}

.sign-row {
  margin-top: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.sign-list-title {
  font-size: 26rpx;
  color: #333;
  font-weight: 600;
  margin-bottom: 8rpx;
}

.sign-columns {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
}

.sign-item-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  width: 220rpx;
}

.sign-label {
  font-size: 24rpx;
  color: #666;
}

.sign-image {
  height: 48rpx;
  max-width: 220rpx;
  object-fit: contain;
}

.outpatient-sign {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.rp-dosage {
  font-size: 28rpx;
  color: #666666;
  margin-bottom: 4rpx;
}

.rp-frequency {
  font-size: 26rpx;
  color: #888888;
  margin-right: 20rpx;
}

.rp-days {
  font-size: 26rpx;
  color: #888888;
}

.rp-name-fallback {
  margin-top: 16rpx;
}

.rp-usage {
  margin-top: 40rpx;
}

.rp-amount {
  font-size: 30rpx;
  color: #333333;
  margin-bottom: 10rpx;
  display: block;
}

.rp-desc {
  font-size: 26rpx;
  color: #777777;
  line-height: 1.6;
}

/* 签名区域 */
.sign-row {
  margin-top: 40rpx;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

.sign-item {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.sign-label {
  font-size: 26rpx;
  color: #777777;
}

.sign-image {
  height: 40rpx;
  margin-left: 12rpx;
}

.sign-text {
  font-size: 26rpx;
  color: #333333;
  margin-left: 12rpx;
}

/* 底部按钮条 */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16rpx 40rpx 40rpx;
  box-sizing: border-box;
  background-color: #f7f7f7;
}

.bottom-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  font-size: 30rpx;
  color: #ffffff;
  border-radius: 999rpx;
  background-color: #4a8cff;
  border: none;
}

.bottom-btn::after {
  border: none;
}
</style>
