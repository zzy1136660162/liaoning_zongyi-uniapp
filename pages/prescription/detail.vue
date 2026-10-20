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

        <view v-if="!detail.patientSnapshotAvailable" class="snapshot-empty">
          历史记录未关联就诊人
        </view>

        <!-- 基本信息两列布局 -->
        <view class="info-grid">
          <view v-if="detail.patientSnapshotAvailable" class="info-col">
            <text class="info-label">姓名：</text>
            <text class="info-value">{{ detail.name }}</text>
          </view>
          <view v-if="detail.patientSnapshotAvailable" class="info-col">
            <text class="info-label">性别：</text>
            <text class="info-value">{{ detail.gender }}</text>
          </view>

          <view v-if="detail.patientSnapshotAvailable" class="info-col">
            <text class="info-label">年龄：</text>
            <text class="info-value">{{ detail.age }}岁</text>
          </view>
          <view v-if="detail.patientSnapshotAvailable && detail.idNumberMasked" class="info-col">
            <text class="info-label">证件号：</text>
            <text class="info-value">{{ detail.idNumberMasked }}</text>
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
            <text class="info-value">{{ detail.doctorName || AI_DOCTOR.name }}</text>
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
    <view class="bottom-bar" v-if="canBuyMedicine">
      <button class="bottom-btn" @tap="goBuy">去购药</button>
    </view>
  </view>
</template>

<script>
import { getSessionGeneration, isCurrentSession } from '@/utils/session.js'
import { getPrescriptionDetail, getPrescriptionItems } from '@/api/consultation.js'
import { AI_DOCTOR } from '@/utils/consultation-mode.js'
import { getProductDetail } from '@/api/product.js'
import { getOrderByPrescriptionId, getOrderDetail, getOrderPage } from '@/api/order.js'
import { getImageUrl } from '@/utils/config.js'
import { getOrderStatusText } from '@/utils/order-status.js'
import { getDoctorDetail } from '@/api/hospital.js'
import { logPageView } from '@/api/access-log.js'

export default {
  name: 'PrescriptionDetail',
  data() {
    return {
      AI_DOCTOR,
      sessionGeneration: getSessionGeneration(),
      prescriptionLoaded: false,
      orderStatusLoaded: false,
      prescriptionStatus: null,
      pageOptions: { prescriptionId: null, orderId: null },
      detail: {
        visitNo: '', name: '', gender: '', age: 0, idNumberMasked: '', patientSnapshotAvailable: false,
        diagnosis: '', department: '便捷配药门诊', date: '', formulaName: '',
        doctorName: AI_DOCTOR.name, doctorSignatureUrl: '', pharmacistName: '', pharmacistSignatureUrl: '',
        prescriptionItems: [], associatedDoctors: {}
      },
      orderStatus: { status: null, orderNo: '', logisticsNo: '', logisticsCompany: '', order: null }
    }
  },
  computed: {
    statusMainText() {
      return this.orderStatus.order ? getOrderStatusText(this.orderStatus.order) : '待下单'
    },
    statusSubText() {
      const order = this.orderStatus.order
      if (!order) return this.prescriptionLoaded ? '等待下单支付' : '正在加载处方'
      if (this.orderStatus.logisticsNo) return `${this.orderStatus.logisticsCompany || '快递'}单号：${this.orderStatus.logisticsNo}`
      return { 0: '等待下单支付', 1: '药品准备中', 2: '药品配送中', 3: '订单已完成', 4: '订单已取消' }[order.orderStatus] || ''
    },
    canBuyMedicine() {
      return this.prescriptionLoaded && this.orderStatusLoaded && this.prescriptionStatus === 1 &&
        (!this.orderStatus.order || Number(this.orderStatus.order.payStatus) === 0 && Number(this.orderStatus.order.orderStatus) === 0)
    }
  },
  onLoad(options) {
    this.pageOptions.prescriptionId = this.isValidPrescriptionId(options.prescriptionId) ? options.prescriptionId : null
    this.pageOptions.orderId = this.isValidPrescriptionId(options.orderId) ? options.orderId : null
    logPageView('处方详情', '用户进入处方详情页面')
  },
  async onShow() {
    if (!isCurrentSession(this.sessionGeneration)) return
    if (this.pageOptions.prescriptionId) {
      await this.loadPrescriptionById(this.pageOptions.prescriptionId)
      await this.loadOrderStatus()
    } else if (this.pageOptions.orderId) await this.loadOrderFromOrderId(this.pageOptions.orderId)
  },
  methods: {
    getImageUrl,
    isValidPrescriptionId(value) { return /^[1-9]\d*$/.test(String(value || '')) },
    applyPatientSnapshot(source = {}) {
      const available = source.patientSnapshotAvailable === true
      this.detail.patientSnapshotAvailable = available
      this.detail.name = available ? source.patientName || '' : ''
      this.detail.gender = available ? source.patientGender || '' : ''
      this.detail.age = available ? source.patientAge || 0 : 0
      this.detail.idNumberMasked = available ? source.patientIdNumberMasked || '' : ''
    },
    resolvePrescriptionDoctorName(source = {}) { return source.doctorId ? source.doctorName || '' : AI_DOCTOR.name },
    resolvePrescriptionDate(source = {}) { return source.prescriptionTime || source.createdAt || '' },
    formatNullableDate(value) {
      // 后端LocalDateTime直接取日期部分，不依赖微信运行时的时区和字符串日期解析。
      return String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '—'
    },
    async applyDoctorFromPrescription(prescription) {
      this.detail.doctorName = this.resolvePrescriptionDoctorName(prescription)
      this.detail.doctorSignatureUrl = ''
      this.detail.associatedDoctors = {}
      if (!prescription.doctorId) return
      const doctor = await getDoctorDetail(prescription.doctorId)
      if (!isCurrentSession(this.sessionGeneration)) return
      this.detail.doctorName = doctor.name || ''
      this.detail.department = doctor.department || '便捷配药门诊'
      this.detail.doctorSignatureUrl = getImageUrl(doctor.signatureUrl || '')
      this.detail.associatedDoctors = { [prescription.doctorId]: { name: doctor.name, signatureUrl: this.detail.doctorSignatureUrl } }
    },
    // 处方患者/医师来自真实处方快照；商品只补用法和药师，不覆盖开方主体。
    async loadPrescriptionById(id) {
      this.prescriptionLoaded = false
      this.orderStatusLoaded = false
      if (!this.isValidPrescriptionId(id)) return
      try {
        const prescription = await getPrescriptionDetail(id)
        if (!isCurrentSession(this.sessionGeneration)) return
        if (String(prescription?.id) !== String(id)) throw new Error('处方信息不匹配')
        this.pageOptions.prescriptionId = prescription.id
        this.prescriptionStatus = prescription.status
        this.detail.visitNo = String(prescription.id)
        this.applyPatientSnapshot(prescription)
        this.detail.date = this.resolvePrescriptionDate(prescription)
        this.detail.diagnosis = prescription.diagnosis || ''
        this.detail.pharmacistSignatureUrl = ''
        this.detail.pharmacistName = ''
        const items = await getPrescriptionItems(id)
        if (!isCurrentSession(this.sessionGeneration)) return
        this.detail.prescriptionItems = Array.isArray(items) ? items.map(item => ({ ...item, usageDesc: '' })) : []
        this.detail.formulaName = this.detail.prescriptionItems.map(item => item.drugName).filter(Boolean).join('、')
        const productRequests = new Map()
        for (const item of this.detail.prescriptionItems) {
          if (!item.productId) continue
          try {
            if (!productRequests.has(item.productId)) productRequests.set(item.productId, getProductDetail(item.productId))
            const product = await productRequests.get(item.productId)
            if (!isCurrentSession(this.sessionGeneration)) return
            item.usageDesc = product.usageDesc || ''
            if (!this.detail.pharmacistSignatureUrl && product.pharmacistId) {
              const pharmacist = await getDoctorDetail(product.pharmacistId)
              if (!isCurrentSession(this.sessionGeneration)) return
              this.detail.pharmacistSignatureUrl = getImageUrl(pharmacist.signatureUrl || '')
              this.detail.pharmacistName = pharmacist.name || ''
            }
          } catch (_) { /* 辅助用法/签名加载失败不丢弃已取得的真实处方明细。 */ }
        }
        try { await this.applyDoctorFromPrescription(prescription) } catch (_) { /* 医师资料暂不可用时保留处方医师身份，不改成商品医师。 */ }
        if (!isCurrentSession(this.sessionGeneration)) return
        this.prescriptionLoaded = true
      } catch (error) {
        if (!isCurrentSession(this.sessionGeneration)) return
        this.detail.prescriptionItems = []
        uni.showToast({ title: error.message || '加载处方详情失败', icon: 'none' })
      }
    },
    updateDetailFromOrder(order) {
      this.orderStatusLoaded = true
      this.orderStatus = { status: order.orderStatus, orderNo: order.orderNo || '',
        logisticsNo: order.logisticsNo || '', logisticsCompany: order.logisticsCompany || '', order }
    },
    // 查询失败不恢复本地旧订单，也不将“未知”当成可再次购药。
    async loadOrderStatus() {
      this.orderStatusLoaded = false
      this.orderStatus = { status: null, orderNo: '', logisticsNo: '', logisticsCompany: '', order: null }
      if (!this.isValidPrescriptionId(this.pageOptions.prescriptionId)) return
      try {
        const order = await getOrderByPrescriptionId(this.pageOptions.prescriptionId)
        if (!isCurrentSession(this.sessionGeneration)) return
        if (order?.id) this.updateDetailFromOrder(order)
        else { this.orderStatus.status = 0; this.orderStatusLoaded = true }
      } catch (_) {
        // 主查询暂不可用时仍只向后台按同一处方ID查询，不能读取本地订单草稿。
        try {
          const { rows } = await getOrderPage({ prescriptionId: this.pageOptions.prescriptionId, pageNum: 1, pageSize: 1 })
          if (!isCurrentSession(this.sessionGeneration)) return
          const order = rows.find(row => String(row.prescriptionId) === String(this.pageOptions.prescriptionId))
          if (order) this.updateDetailFromOrder(order)
          else { this.orderStatus.status = 0; this.orderStatusLoaded = true }
        } catch (_) {
          if (isCurrentSession(this.sessionGeneration)) this.prescriptionLoaded = false
        }
      }
    },
    async loadOrderFromOrderId(orderId) {
      try {
        const order = await getOrderDetail(orderId, { showLoading: false })
        if (!isCurrentSession(this.sessionGeneration)) return
        if (!this.isValidPrescriptionId(order?.prescriptionId)) throw new Error('此订单没有关联处方')
        await this.loadPrescriptionById(order.prescriptionId)
        if (isCurrentSession(this.sessionGeneration)) this.updateDetailFromOrder(order)
      } catch (error) {
        if (isCurrentSession(this.sessionGeneration)) uni.showToast({ title: error.message || '加载订单处方失败', icon: 'none' })
      }
    },
    goBuy() {
      if (!this.canBuyMedicine || !isCurrentSession(this.sessionGeneration)) return
      // 已有待付订单续付原单，避免为同一处方再次创建订单。
      const order = this.orderStatus.order
      const url = order?.id
        ? `/pages/order/order-detail?orderId=${order.id}`
        : `/pages/order/confirm?prescriptionId=${this.pageOptions.prescriptionId}`
      uni.navigateTo({ url })
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

.snapshot-empty {
  padding: 12rpx 0 20rpx;
  font-size: 26rpx;
  color: #999999;
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
