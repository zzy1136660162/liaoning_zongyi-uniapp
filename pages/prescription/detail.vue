<template>
  <view
    class="page"
    :class="{ 'has-bottom-bar': canBuyMedicine }"
  >
    <view class="top-header">
      <view class="status-heading">
        <view class="status-content">
          <text class="status-label">
            处方状态
          </text>
          <text class="status-main">
            {{ statusMainText }}
          </text>
          <text class="status-sub">
            {{ statusSubText }}
          </text>
        </view>
        <view class="status-mark">
          Rp
        </view>
      </view>
      <view
        v-if="orderStatus.logisticsNo"
        class="logistics-info"
      >
        <text class="logistics-label">
          {{ orderStatus.logisticsCompany || '快递' }}单号
        </text>
        <text
          class="logistics-value"
          selectable
        >
          {{ orderStatus.logisticsNo }}
        </text>
      </view>
    </view>

    <view class="card-wrapper">
      <view
        v-if="prescriptionError || orderStatusError"
        class="card reload-action"
      >
        <view class="reload-copy">
          <text class="reload-title">
            信息暂未完整加载
          </text>
          <text class="reload-description">
            请重试以获取最新处方与订单状态
          </text>
        </view>
        <button
          class="reload-btn"
          @tap="retryReload"
        >
          重新加载
        </button>
      </view>

      <view
        v-if="!prescriptionLoaded && !prescriptionError"
        class="card loading-card"
      >
        <text class="loading-text">
          正在加载处方详情…
        </text>
        <view class="loading-line" />
        <view class="loading-line loading-line-short" />
      </view>

      <view
        v-if="prescriptionLoaded"
        class="card patient-card"
      >
        <view class="section-header">
          <text class="section-title">
            就诊信息
          </text>
        </view>

        <view
          v-if="detail.patientSnapshotAvailable"
          class="patient-summary"
        >
          <view class="patient-heading">
            <text class="patient-name">
              {{ detail.name || '姓名未提供' }}
            </text>
            <view class="patient-tags">
              <text
                v-if="detail.gender"
                class="patient-tag"
              >
                {{ detail.gender }}
              </text>
              <text class="patient-tag">
                {{ detail.age }}岁
              </text>
            </view>
          </view>
          <view
            v-if="detail.idNumberMasked"
            class="patient-id"
          >
            <text class="patient-id-label">
              证件号
            </text>
            <text class="patient-id-value">
              {{ detail.idNumberMasked }}
            </text>
          </view>
        </view>
        <view
          v-else
          class="snapshot-empty"
        >
          历史记录未关联就诊人
        </view>

        <view class="info-list">
          <view class="info-row">
            <text class="info-label">
              开方医师
            </text>
            <text class="info-value">
              {{ detail.doctorName || '未提供' }}
            </text>
          </view>
          <view class="info-row">
            <text class="info-label">
              开方日期
            </text>
            <text class="info-value">
              {{ formatNullableDate(detail.date) }}
            </text>
          </view>
        </view>
        <view
          v-if="detail.diagnosis"
          class="diagnosis-block"
        >
          <text class="block-label">
            临床诊断
          </text>
          <text class="block-text">
            {{ detail.diagnosis }}
          </text>
        </view>
      </view>

      <view
        v-if="prescriptionLoaded"
        class="card prescription-card"
      >
        <view class="section-header">
          <view class="prescription-heading">
            <text class="rp-title">
              Rp
            </text>
            <text class="section-title section-title-plain">
              处方明细
            </text>
          </view>
          <text class="section-caption">
            共 {{ detail.prescriptionItems.length }} 项
          </text>
        </view>

        <view
          v-if="detail.prescriptionItems.length > 0"
          class="rp-items"
        >
          <view
            v-for="(item, index) in detail.prescriptionItems"
            :key="item.id"
            class="rp-item"
          >
            <view class="rp-item-heading">
              <text class="rp-index">
                {{ index + 1 }}
              </text>
              <text class="rp-drug-name">
                {{ item.drugName || '药品名称未提供' }}
              </text>
            </view>
            <view
              v-if="item.dosage || item.frequency || item.days"
              class="rp-meta"
            >
              <view
                v-if="item.dosage"
                class="rp-meta-item"
              >
                <text class="rp-meta-label">
                  用量
                </text>
                <text class="rp-meta-value">
                  {{ item.dosage }}
                </text>
              </view>
              <view
                v-if="item.frequency"
                class="rp-meta-item"
              >
                <text class="rp-meta-label">
                  频次
                </text>
                <text class="rp-meta-value">
                  {{ item.frequency }}
                </text>
              </view>
              <view
                v-if="item.days"
                class="rp-meta-item"
              >
                <text class="rp-meta-label">
                  天数
                </text>
                <text class="rp-meta-value">
                  {{ item.days }}天
                </text>
              </view>
            </view>
            <view
              v-if="item.remark"
              class="rp-usage-desc"
            >
              <text class="usage-label">
                明细说明
              </text>
              <text class="usage-text">
                {{ item.remark }}
              </text>
            </view>
          </view>
        </view>
        <view
          v-else
          class="rp-empty"
        >
          未提供处方明细
        </view>
      </view>

      <view
        v-if="prescriptionLoaded && detail.usageNote"
        class="card instruction-card"
      >
        <view class="section-header">
          <text class="section-title">
            处方医嘱
          </text>
        </view>
        <text class="instruction-text">
          {{ detail.usageNote }}
        </text>
      </view>

      <view
        v-if="prescriptionLoaded"
        class="card signature-card"
      >
        <view class="section-header">
          <text class="section-title">
            签名信息
          </text>
        </view>
        <view class="sign-row">
          <view class="sign-item">
            <text class="sign-label">
              医师签名
            </text>
            <image
              v-if="detail.doctorSignatureUrl"
              class="sign-image"
              :src="detail.doctorSignatureUrl"
              mode="aspectFit"
              @error="detail.doctorSignatureUrl = ''"
            />
            <text
              v-else
              class="sign-text"
            >
              未提供
            </text>
          </view>
          <view class="sign-item">
            <text class="sign-label">
              药师签名
            </text>
            <text class="sign-text">
              未提供
            </text>
          </view>
        </view>
      </view>
    </view>

    <view
      v-if="canBuyMedicine"
      class="bottom-bar"
    >
      <view class="bottom-copy">
        <text class="bottom-title">
          处方购药
        </text>
        <text class="bottom-description">
          核对处方后继续购药
        </text>
      </view>
      <button
        class="bottom-btn"
        @tap="goBuy"
      >
        去购药
      </button>
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
import { logPageView, logButtonClick } from '@/utils/accessLog.js'

const PAGE_LOG = { moduleCode: 'PRESCRIPTION', accessType: '处方', pageType: 'PRESCRIPTION_DETAIL', requestUri: '/pages/prescription/detail' }

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
  },
  onShow() {
    if (this.isCurrentLoad(this.loadGeneration)) logPageView({ ...PAGE_LOG, pageId: this.pageOptions.prescriptionId || '', actionCode: 'PRESCRIPTION_DETAIL_VIEW', accessTitle: '处方详情', accessDescription: '进入处方详情，查看处方与关联订单状态', extraData: { orderId: this.pageOptions.orderId || '' } })
    return this.reload()
  },
  onUnload() {
    this.pageActive = false
    this.loadGeneration += 1
  },
  methods: {
    retryReload() {
      if (!this.isCurrentLoad(this.loadGeneration)) return
      logButtonClick({ ...PAGE_LOG, pageId: this.pageOptions.prescriptionId || '', actionCode: 'PRESCRIPTION_RETRY', accessTitle: '重新加载处方', accessDescription: '处方加载未完成，用户主动重新加载', extraData: { orderId: this.pageOptions.orderId || '' } })
      return this.reload()
    },
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
      logButtonClick({ ...PAGE_LOG, pageId: this.pageOptions.prescriptionId || '', actionCode: 'PRESCRIPTION_BUY', accessTitle: '去购药', accessDescription: order?.id ? '从处方详情进入已有订单，继续查看或付款' : '从处方详情进入确认订单页面', extraData: { orderId: order?.id || '', destination: order?.id ? 'EXISTING_ORDER' : 'NEW_CHECKOUT' } })
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
  padding-bottom: 32rpx;
  box-sizing: border-box;
  background: #f5f7fb;
  color: #293447;
}

.page.has-bottom-bar {
  padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
}

.top-header {
  padding: 36rpx 32rpx 76rpx;
  background: linear-gradient(135deg, #4a8cff, #4aa0ff);
  color: #fff;
}

.status-heading {
  display: flex;
  align-items: center;
}

.status-content {
  flex: 1;
  min-width: 0;
}

.status-label,
.status-main,
.status-sub {
  display: block;
}

.status-label {
  margin-bottom: 12rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

.status-main {
  font-size: 42rpx;
  line-height: 1.4;
  font-weight: 600;
  word-break: break-all;
}

.status-sub {
  margin-top: 12rpx;
  font-size: 25rpx;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.92);
  word-break: break-all;
}

.status-mark {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100rpx;
  height: 100rpx;
  margin-left: 24rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.25);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.12);
  font-family: Georgia, serif;
  font-size: 52rpx;
  font-style: italic;
}

.logistics-info {
  margin-top: 24rpx;
  padding: 18rpx 22rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.12);
  font-size: 24rpx;
  line-height: 1.6;
}

.logistics-label {
  display: block;
  margin-bottom: 4rpx;
  color: rgba(255, 255, 255, 0.8);
}

.logistics-value {
  display: block;
  word-break: break-all;
}

.card-wrapper {
  position: relative;
  margin-top: -40rpx;
  padding: 0 24rpx;
}

.card {
  margin-bottom: 24rpx;
  padding: 28rpx;
  border: 1rpx solid #edf1f7;
  border-radius: 24rpx;
  background: #fff;
  box-shadow: 0 4rpx 18rpx rgba(43, 74, 123, 0.035);
}

.card:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.section-title {
  padding-left: 16rpx;
  border-left: 6rpx solid #4a8cff;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.3;
}

.section-title-plain {
  padding-left: 0;
  border-left: 0;
}

.section-caption {
  flex-shrink: 0;
  margin-left: 16rpx;
  font-size: 24rpx;
  color: #8b96a8;
}

.patient-summary {
  padding: 24rpx;
  border-radius: 16rpx;
  background: #f3f7ff;
}

.patient-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.patient-name {
  max-width: 100%;
  margin-right: 20rpx;
  padding: 4rpx 0;
  font-size: 34rpx;
  font-weight: 600;
  line-height: 1.5;
  word-break: break-all;
}

.patient-tags {
  display: flex;
  flex-wrap: wrap;
}

.patient-tag {
  margin: 4rpx 12rpx 4rpx 0;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  background: #e7efff;
  color: #5275ac;
  font-size: 23rpx;
  line-height: 1.5;
}

.patient-id {
  display: flex;
  align-items: flex-start;
  margin-top: 14rpx;
  font-size: 24rpx;
  line-height: 1.6;
}

.patient-id-label {
  flex-shrink: 0;
  margin-right: 20rpx;
  color: #8391a8;
}

.patient-id-value {
  flex: 1;
  min-width: 0;
  color: #61718b;
  word-break: break-all;
}

.snapshot-empty,
.rp-empty {
  padding: 32rpx 24rpx;
  border-radius: 16rpx;
  background: #f7f9fc;
  color: #8b96a8;
  font-size: 26rpx;
  line-height: 1.6;
  text-align: center;
}

.info-list {
  margin-top: 16rpx;
}

.info-row {
  display: flex;
  align-items: flex-start;
  padding: 12rpx 0;
  font-size: 26rpx;
  line-height: 1.6;
}

.info-label {
  flex: 0 0 132rpx;
  color: #8390a3;
}

.info-value {
  flex: 1;
  min-width: 0;
  text-align: right;
  word-break: break-all;
}

.diagnosis-block {
  margin-top: 12rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid #edf1f7;
}

.block-label {
  display: block;
  margin-bottom: 12rpx;
  color: #8390a3;
  font-size: 26rpx;
}

.block-text,
.instruction-text {
  display: block;
  font-size: 28rpx;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-all;
}

.prescription-heading {
  display: flex;
  align-items: center;
}

.rp-title {
  margin-right: 14rpx;
  color: #4a8cff;
  font-family: Georgia, serif;
  font-size: 38rpx;
  font-weight: 600;
  font-style: italic;
  line-height: 1;
}

.rp-item {
  padding: 24rpx;
  border: 1rpx solid #edf1f7;
  border-radius: 16rpx;
  background: #f8faff;
}

.rp-item + .rp-item {
  margin-top: 20rpx;
}

.rp-item-heading {
  display: flex;
  align-items: flex-start;
}

.rp-index {
  flex-shrink: 0;
  min-width: 36rpx;
  margin: 4rpx 14rpx 0 0;
  padding: 0 4rpx;
  box-sizing: border-box;
  border-radius: 8rpx;
  background: #e8f0ff;
  color: #4a8cff;
  font-size: 22rpx;
  line-height: 36rpx;
  text-align: center;
}

.rp-drug-name {
  flex: 1;
  min-width: 0;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.5;
  word-break: break-all;
}

.rp-meta {
  display: flex;
  flex-wrap: wrap;
  margin-top: 12rpx;
}

.rp-meta-item {
  display: flex;
  align-items: flex-start;
  max-width: 100%;
  margin: 8rpx 24rpx 0 0;
  font-size: 24rpx;
  line-height: 1.6;
}

.rp-meta-label {
  flex-shrink: 0;
  margin-right: 10rpx;
  color: #8b96a8;
}

.rp-meta-value {
  min-width: 0;
  color: #53627a;
  word-break: break-all;
}

.rp-usage-desc {
  margin-top: 20rpx;
  padding-top: 18rpx;
  border-top: 1rpx dashed #dfe6f1;
}

.usage-label {
  display: block;
  margin-bottom: 8rpx;
  font-size: 23rpx;
  color: #8b96a8;
}

.usage-text {
  display: block;
  color: #58677d;
  font-size: 26rpx;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
}

.instruction-text {
  padding: 22rpx 24rpx;
  border-radius: 16rpx;
  background: #f3f7ff;
  color: #4c6183;
}

.sign-row {
  display: flex;
}

.sign-item {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 12rpx;
  border-radius: 16rpx;
  background: #f7f9fc;
}

.sign-item + .sign-item {
  margin-left: 20rpx;
}

.sign-label {
  font-size: 24rpx;
  line-height: 1.5;
  color: #8390a3;
}

.sign-image {
  width: 100%;
  max-width: 220rpx;
  height: 88rpx;
  margin-top: 12rpx;
}

.sign-text {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #a2adbc;
}

.reload-action {
  display: flex;
  align-items: center;
}

.reload-copy {
  flex: 1;
  min-width: 0;
  margin-right: 20rpx;
}

.reload-title,
.reload-description {
  display: block;
  word-break: break-all;
}

.reload-title {
  font-size: 27rpx;
  font-weight: 500;
  line-height: 1.5;
}

.reload-description {
  margin-top: 8rpx;
  font-size: 23rpx;
  line-height: 1.6;
  color: #8390a3;
}

.reload-btn {
  flex-shrink: 0;
  margin: 0;
  padding: 0 22rpx;
  border-radius: 32rpx;
  background: #edf4ff;
  color: #4a8cff;
  font-size: 24rpx;
  line-height: 64rpx;
}

.loading-text {
  display: block;
  margin-bottom: 24rpx;
  color: #8390a3;
  font-size: 26rpx;
}

.loading-line {
  height: 24rpx;
  margin-top: 20rpx;
  border-radius: 8rpx;
  background: #f0f3f8;
}

.loading-line-short {
  width: 60%;
}

.bottom-bar {
  position: fixed;
  z-index: 10;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #edf1f7;
  box-sizing: border-box;
  background: #fff;
  box-shadow: 0 -4rpx 20rpx rgba(43, 74, 123, 0.04);
}

.bottom-copy {
  flex: 1;
  min-width: 0;
  margin-right: 24rpx;
}

.bottom-title,
.bottom-description {
  display: block;
}

.bottom-title {
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.5;
}

.bottom-description {
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.5;
  color: #8b96a8;
}

.bottom-btn {
  flex-shrink: 0;
  width: 264rpx;
  height: 88rpx;
  margin: 0;
  padding: 0;
  border-radius: 44rpx;
  background: #4a8cff;
  color: #fff;
  font-size: 30rpx;
  font-weight: 500;
  line-height: 88rpx;
  text-align: center;
}

.bottom-btn::after,
.reload-btn::after {
  border: none;
}
</style>
