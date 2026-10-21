<template>
  <view class="page">
    <!-- 顶部蓝色状态条 -->
    <view class="top-header">
      <view class="status-main">{{ statusMainText }}</view>
      <view class="status-sub">{{ statusSubText }}</view>
      <view v-if="orderStatus.logisticsNo" class="status-sub">
        {{ orderStatus.logisticsCompany || '快递' }}单号：{{ orderStatus.logisticsNo }}
      </view>
    </view>

    <!-- 白色内容卡片（覆盖在蓝色块上） -->
    <view class="card-wrapper">
      <view v-if="prescriptionError || orderStatusError" class="reload-action">
        <button size="mini" @tap="reload">重新加载</button>
      </view>
      <view v-if="prescriptionLoaded" class="card">
        <!-- 标题 -->
        <view class="card-title">处方单详情</view>

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
          <view v-if="detail.diagnosis" class="info-col">
            <text class="info-label">临床诊断：</text>
            <text class="info-value">{{ detail.diagnosis }}</text>
          </view>
          <view class="info-col">
            <text class="info-label">开方医师：</text>
            <text class="info-value">{{ detail.doctorName }}</text>
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
                <view v-if="item.remark" class="rp-usage-desc">
                  <text class="usage-label">处方明细说明：</text>
                  <text class="usage-text">{{ item.remark }}</text>
                </view>
              </view>
            </view>
            <view v-else class="rp-name-fallback">
              <text class="rp-name">未提供处方明细</text>
            </view>
          </view>
          <view v-if="detail.usageNote" class="rp-usage-desc">
            <text class="usage-label">处方医嘱：</text>
            <text class="usage-text">{{ detail.usageNote }}</text>
          </view>

          <view class="dash-line big-space"></view>

          <!-- 签名区域 -->
          <view class="sign-row">
            <view class="sign-item">
              <text class="sign-label">医师签名：</text>
              <image
                  v-if="detail.doctorSignatureUrl"
                  class="sign-image"
                  :src="detail.doctorSignatureUrl"
                  mode="heightFix"
                  @error="detail.doctorSignatureUrl = ''"
              />
              <text v-else class="sign-text">未提供</text>
            </view>
            <view class="sign-item">
              <text class="sign-label">药师签名：</text>
              <text class="sign-text">未提供</text>
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
import { getOrderByPrescriptionId, getOrderDetail, getOrderPage } from '@/api/order.js'
import { getImageUrl } from '@/utils/config.js'
import { canPayOrder, getOrderStatusText } from '@/utils/order-status.js'
import { canCreatePrescriptionOrder, getPrescriptionStatusText, resolvePrescriptionDoctorName } from '@/utils/prescription.js'
import { getDoctorDetail } from '@/api/hospital.js'
import { logPageView } from '@/api/access-log.js'

export default {
  name: 'PrescriptionDetail',
  data() {
    return {
      sessionGeneration: getSessionGeneration(),
      pageActive: true,
      loadGeneration: 0,
      prescriptionLoaded: false,
      orderStatusLoaded: false,
      prescription: null,
      prescriptionError: '',
      orderStatusError: '',
      pageOptions: { prescriptionId: null, orderId: null },
      detail: {
        name: '', gender: '', age: 0, idNumberMasked: '', patientSnapshotAvailable: false,
        diagnosis: '', usageNote: '', date: '', doctorName: '', doctorSignatureUrl: '', prescriptionItems: []
      },
      orderStatus: { status: null, orderNo: '', logisticsNo: '', logisticsCompany: '', order: null }
    }
  },
  computed: {
    statusMainText() {
      return this.prescriptionError ? '处方加载失败' : getPrescriptionStatusText(this.prescription)
    },
    statusSubText() {
      if (this.prescriptionError) return this.prescriptionError
      if (!this.prescriptionLoaded) return '正在加载处方'
      if (this.orderStatusError) return this.orderStatusError
      if (!this.orderStatusLoaded) return '正在查询订单状态'
      return this.orderStatus.order ? `订单：${getOrderStatusText(this.orderStatus.order)}` : '尚未关联订单'
    },
    canBuyMedicine() {
      if (!this.prescriptionLoaded || !this.orderStatusLoaded) return false
      return this.orderStatus.order ? canPayOrder(this.orderStatus.order) : canCreatePrescriptionOrder(this.prescription)
    }
  },
  onLoad(options) {
    this.pageOptions.prescriptionId = this.isValidPrescriptionId(options.prescriptionId) ? options.prescriptionId : null
    this.pageOptions.orderId = this.isValidPrescriptionId(options.orderId) ? options.orderId : null
    logPageView('处方详情', '用户进入处方详情页面')
  },
  onShow() {
    return this.reload()
  },
  onUnload() {
    this.pageActive = false
    this.loadGeneration += 1
  },
  methods: {
    isValidPrescriptionId(value) { return /^[1-9]\d*$/.test(String(value || '')) },
    isCurrentLoad(generation) {
      return this.pageActive && generation === this.loadGeneration && isCurrentSession(this.sessionGeneration)
    },
    async reload() {
      if (!this.isCurrentLoad(this.loadGeneration)) return
      const generation = ++this.loadGeneration
      if (this.pageOptions.prescriptionId) {
        await Promise.all([
          this.loadPrescriptionById(this.pageOptions.prescriptionId, generation),
          this.loadOrderStatus(generation)
        ])
      } else if (this.pageOptions.orderId) {
        await this.loadOrderFromOrderId(this.pageOptions.orderId, generation)
      } else this.prescriptionError = '缺少有效的处方标识，请返回重试'
    },
    applyPatientSnapshot(source = {}) {
      const available = source.patientSnapshotAvailable === true
      this.detail.patientSnapshotAvailable = available
      this.detail.name = available ? source.patientName || '' : ''
      this.detail.gender = available ? source.patientGender || '' : ''
      this.detail.age = available ? source.patientAge || 0 : 0
      this.detail.idNumberMasked = available ? source.patientIdNumberMasked || '' : ''
    },
    formatNullableDate(value) {
      // 后端LocalDateTime直接取日期部分，不依赖微信运行时的时区和字符串日期解析。
      return String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '—'
    },
    async applyDoctorFromPrescription(prescription, generation = this.loadGeneration) {
      this.detail.doctorName = resolvePrescriptionDoctorName(prescription)
      this.detail.doctorSignatureUrl = ''
      if (!prescription.doctorId) return
      this.detail.doctorName = '医师资料加载中'
      try {
        const doctor = await getDoctorDetail(prescription.doctorId)
        if (!this.isCurrentLoad(generation)) return
        this.detail.doctorName = doctor.name || '医师姓名未提供'
        this.detail.doctorSignatureUrl = getImageUrl(doctor.signatureUrl || '')
      } catch (_) {
        if (this.isCurrentLoad(generation)) this.detail.doctorName = resolvePrescriptionDoctorName(prescription)
      }
    },
    async loadPrescriptionById(id, generation = this.loadGeneration) {
      if (!this.isCurrentLoad(generation)) return
      this.prescriptionLoaded = false
      this.prescription = null
      this.prescriptionError = ''
      this.detail.doctorSignatureUrl = ''
      if (!this.isValidPrescriptionId(id)) {
        this.prescriptionError = '处方标识不正确，请返回重试'
        return
      }
      try {
        const [prescription, items] = await Promise.all([getPrescriptionDetail(id), getPrescriptionItems(id)])
        if (!this.isCurrentLoad(generation)) return
        if (String(prescription?.id) !== String(id)) throw new Error('处方信息不匹配')
        if (!Array.isArray(items)) throw new Error('处方明细格式不正确')
        this.pageOptions.prescriptionId = prescription.id
        this.prescription = prescription
        this.applyPatientSnapshot(prescription)
        this.detail.date = prescription.createdAt || ''
        this.detail.diagnosis = prescription.diagnosis || ''
        this.detail.usageNote = prescription.usageNote || ''
        this.detail.prescriptionItems = items
        this.prescriptionLoaded = true
        await this.applyDoctorFromPrescription(prescription, generation)
      } catch (error) {
        if (!this.isCurrentLoad(generation)) return
        this.prescription = null
        this.detail.prescriptionItems = []
        this.prescriptionError = error.message || '加载处方详情失败'
        uni.showToast({ title: this.prescriptionError, icon: 'none' })
      }
    },
    updateDetailFromOrder(order) {
      this.orderStatusLoaded = true
      this.orderStatus = { status: order.orderStatus, orderNo: order.orderNo || '',
        logisticsNo: order.logisticsNo || '', logisticsCompany: order.logisticsCompany || '', order }
    },
    // 查询失败不恢复本地旧订单，也不将“未知”当成可再次购药。
    async loadOrderStatus(generation = this.loadGeneration) {
      if (!this.isCurrentLoad(generation)) return
      this.orderStatusLoaded = false
      this.orderStatusError = ''
      this.orderStatus = { status: null, orderNo: '', logisticsNo: '', logisticsCompany: '', order: null }
      const prescriptionId = this.pageOptions.prescriptionId
      if (!this.isValidPrescriptionId(prescriptionId)) {
        this.orderStatusError = '无法核对关联订单，请返回重试'
        return
      }
      try {
        const order = await getOrderByPrescriptionId(prescriptionId)
        if (!this.isCurrentLoad(generation)) return
        if (order?.id) this.updateDetailFromOrder(order)
        else this.orderStatusLoaded = true
      } catch (_) {
        if (!this.isCurrentLoad(generation)) return
        // 主查询暂不可用时仍只向后台按同一处方ID查询，不能读取本地订单草稿。
        try {
          const { rows } = await getOrderPage({ prescriptionId, pageNum: 1, pageSize: 1 })
          if (!this.isCurrentLoad(generation)) return
          const order = rows.find(row => String(row.prescriptionId) === String(prescriptionId))
          if (order) this.updateDetailFromOrder(order)
          else this.orderStatusLoaded = true
        } catch (_) {
          if (this.isCurrentLoad(generation)) this.orderStatusError = '订单状态读取失败，请重新加载'
        }
      }
    },
    async loadOrderFromOrderId(orderId, generation = this.loadGeneration) {
      if (!this.isCurrentLoad(generation)) return
      this.prescriptionLoaded = false
      this.prescription = null
      this.prescriptionError = ''
      this.orderStatusLoaded = false
      this.orderStatusError = ''
      this.orderStatus = { status: null, orderNo: '', logisticsNo: '', logisticsCompany: '', order: null }
      try {
        const order = await getOrderDetail(orderId, { showLoading: false })
        if (!this.isCurrentLoad(generation)) return
        if (!this.isValidPrescriptionId(order?.prescriptionId)) throw new Error('此订单没有关联处方')
        await this.loadPrescriptionById(order.prescriptionId, generation)
        if (this.isCurrentLoad(generation)) this.updateDetailFromOrder(order)
      } catch (error) {
        if (!this.isCurrentLoad(generation)) return
        this.prescriptionError = error.message || '加载订单处方失败'
        uni.showToast({ title: this.prescriptionError, icon: 'none' })
      }
    },
    goBuy() {
      if (!this.canBuyMedicine || !this.isCurrentLoad(this.loadGeneration)) return
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

.reload-action {
  margin-bottom: 24rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: 24rpx;
}

/* 标题 */
.card-title {
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  color: #333333;
  margin-bottom: 30rpx;
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
