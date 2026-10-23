<template>
  <view class="page">
    <!-- 顶部导航用原生小程序导航栏即可，这里不重复写 -->

    <!-- 订单卡片 -->
    <view class="order-card">
      <!-- 上半部分：标题 + 金额 + 状态 -->
      <view class="order-header">
        <view class="order-header-left">
          <view class="title-row">
            <text class="title-text">
              订单状态
            </text>
          </view>
          <!-- <text class="amount-text">
            ¥{{ totalAmount.toFixed(2) }}
          </text> -->
        </view>

        <view class="order-header-right">
          <view class="status-row">
            <text
              v-if="order.statusText"
              class="status-text"
            >
              {{ order.statusText }}
            </text>
          </view>
          <!-- <text
            v-if="order.time"
            class="time-text"
          >
            {{ formatDateTime(order.time) }}
          </text> -->
        </view>
      </view>

      <view class="divider" />

      <!-- 医生信息使用当前订单关联的真实处方/商品资料 -->
      <view class="doctor-row">
        <image
          class="doctor-avatar"
          :src="doctorAvatar"
          mode="aspectFill"
        />
        <view class="doctor-info">
          <view class="doctor-name-row">
            <text class="doctor-name">
              {{ displayDoctorName }}
            </text>
            <text class="doctor-title">
              {{ order.doctorTitle }}
            </text>
          </view>
          <text
            v-if="order.department"
            class="doctor-department"
          >
            {{ order.department }}
          </text>
        </view>
      </view>

      <view v-if="order.prescriptionId" class="patient-snapshot">
        <text class="patient-snapshot-label">就诊人</text>
        <view v-if="order.patientSnapshotAvailable" class="patient-snapshot-content">
          <text>{{ order.patientName }} {{ order.patientGender }} {{ order.patientAge }}岁</text>
          <text v-if="order.patientIdNumberMasked" class="patient-snapshot-id">
            {{ order.patientIdNumberMasked }}
          </text>
        </view>
        <text v-else class="patient-snapshot-empty">历史记录未关联就诊人</text>
      </view>

      <!-- 信息区域 -->
      <view
        v-if="receiptConfirmText"
        class="info-row"
      >
        <text class="info-label">
          确认收货分类
        </text>
        <text class="info-value">
          {{ receiptConfirmText }}
        </text>
      </view>
      <view
        v-for="item in infoList"
        :key="item.label"
        class="info-row"
      >
        <text class="info-label">
          {{ item.label }}
        </text>
        <text class="info-value">
          {{ item.value }}
        </text>
        <text
          v-if="item.labelKey === 'orderNo' && item.value"
          class="copy-order-no"
          @click.stop="copyOrderNo"
        >
          复制
        </text>
      </view>

      <!-- 操作按钮 -->
<!--      <view
        v-if="order.statusText === '已完成'"
        class="action-buttons"
      >
        <button
          class="action-btn delete-btn"
          @click="deleteOrder"
        >
          删除订单
        </button>
        <button
          class="action-btn review-btn"
          @click="reviewOrder"
        >
          评价
        </button>
        <button
          class="action-btn rebuy-btn"
          @click="rebuyOrder"
        >
          再次复诊
        </button>
      </view> -->

      <!-- 所有选择的药品列表 -->
      <view
        v-if="allCartItems.length > 0"
        class="medicines-section"
      >
        <view class="medicines-header">
          <text class="medicines-title">
            已选择的商品 ({{ allCartItems.length }}种)
          </text>
        </view>
        <view class="medicines-list">
          <view
            v-for="item in displayCartItems"
            :key="item.orderItemId || item.id"
            class="medicine-item"
          >
            <view class="medicine-content">
              <view class="medicine-left">
                <image
                  class="medicine-thumb"
                  :src="getProductImageUrl(item.image)"
                  mode="aspectFill"
                  @error="handleProductImageError(item.image)"
                />
                <view
                  v-if="Number(item.quantity) > 0"
                  class="medicine-qty"
                >
                  ×{{ Number(item.quantity) }}
                </view>
              </view>
              <view class="medicine-right">
                <view class="medicine-name">
                  {{ item.name }}
                </view>
                <view
                  v-if="item.specText"
                  class="medicine-spec"
                >
                  {{ item.specText }}
                </view>
                <view class="medicine-price">
                  ¥{{ ((item.price || 0) * (Number(item.quantity) || 1)).toFixed(2) }}
                </view>
                <view
                  v-if="getOrderItemRefundText(item)"
                  class="medicine-refund-summary"
                >
                  {{ getOrderItemRefundText(item) }}
                </view>
              </view>
            </view>

            <view
              v-if="item.redeemVouchers && item.redeemVouchers.length > 0"
              class="therapy-vouchers"
            >
              <view
                v-for="(voucher, voucherIndex) in item.redeemVouchers"
                :key="voucher.id || voucher.verifyToken || voucherIndex"
                class="therapy-voucher-card"
              >
                <view class="therapy-voucher-head">
                  <text class="therapy-voucher-title">
                    核销券 {{ voucher.displayNo }}
                  </text>
                  <text
                    class="therapy-voucher-status"
                    :class="{ redeemed: Number(voucher.redeemStatus) === 1 }"
                  >
                    {{ formatRedeemStatus(voucher) }}
                  </text>
                </view>
                <view
                  v-if="canShowVoucherCode(voucher)"
                  class="therapy-voucher-code"
                >
                  <text class="therapy-voucher-code-label">核销码</text>
                  <text class="therapy-voucher-code-value">{{ voucher.verifyCode }}</text>
                </view>
                <image
                  v-if="canShowVoucherQr(voucher)"
                  class="therapy-voucher-qr"
                  :src="normalizeQrImageSrc(voucher.verifyQrBase64)"
                  mode="aspectFit"
                  show-menu-by-longpress
                />
                <view
                  v-else-if="Number(voucher.redeemStatus) === 1"
                  class="therapy-voucher-redeemed"
                >
                  <text>核销时间：{{ formatDateTime(voucher.redeemTime) || '—' }}</text>
                  <text>核销人：{{ voucher.redeemerName || voucher.redeemedBy || '—' }}</text>
                </view>
                <view
                  v-else-if="Number(voucher.redeemStatus) === 2"
                  class="therapy-voucher-empty"
                >
                  核销券已退款/已失效
                </view>
                <view
                  v-else
                  class="therapy-voucher-empty"
                >
                  {{ Number(voucher.redeemStatus) === 3 ? '退款处理中，暂不可核销' : '暂无核销码' }}
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view v-if="showOfflineRefundNotice" class="refund-contact-tip">
        实物商品已发货，如需退款请线下联系客服。
      </view>
      <!-- 底部按钮 -->
      <view class="btn-row">
        <button
          v-if="canPay"
          class="primary-btn"
          :loading="paying"
          :disabled="paying"
          @tap="handlePayOrder"
        >
          {{ paying ? '正在支付...' : '去支付' }}
        </button>
        <!-- 只有订单实际关联处方时才显示入口；健康产品、疗法及混合订单均使用同一判断。 -->
        <button
          v-if="canViewPrescription"
          class="primary-btn"
          @tap="handleView"
        >
          查看处方
        </button>
        <button
          v-if="canApplyRefund"
          class="secondary-btn refund-btn"
          @tap="applyRefund"
        >
          {{ refundActionText }}
        </button>
      </view>
    </view>
  </view>
</template>

  <script>
  import { loadPrescriptionContext } from '@/utils/consultation-checkout.js'
  import { getProductDetail } from '@/api/product.js'
  import { getDoctorDetail } from '@/api/hospital.js'
  import { getConsultationDetail, getPrescriptionByConsultation, getPrescriptionDetail } from '@/api/consultation.js'
  import { AI_DOCTOR, resolveConsultationDoctorName } from '@/utils/consultation-mode.js'
  import { getOrderDetail } from '@/api/order.js'
  import { wechatSinglePay } from '@/api/payment.js'
  import { formatFreightEstimate } from '@/utils/freight.js'
  import { checkCanApplyRefund } from '@/api/refund.js'
  import { getOrderItemRefundText, canOrderApplyRefund, shouldContactForPhysicalRefund } from '@/utils/refund.js'
  import { getImageUrl } from '@/utils/config.js'
  import { useProductImages } from '@/utils/product-image.js'
  import { logPageView, logButtonClick, logAccess, getActionFailureResult } from '@/utils/accessLog.js'
  import { isTherapyOrder } from '@/utils/therapy.js'
  import { buildItemRedeemVouchers } from '@/utils/order-redeem-vouchers.js'
  import { canPayOrder, canShowRedeemCode, getOrderStatusText, getRedeemStatusText, getReceiptConfirmText } from '@/utils/order-status.js'
  import { getSessionGeneration, isCurrentSession, assertCurrentSession } from '@/utils/session.js'

  const PAGE_LOG = { moduleCode: 'ORDER', accessType: '订单', pageType: 'ORDER_DETAIL', requestUri: '/pages/order/order-detail' }

  export default {
    name: 'OrderDetail',
    setup: useProductImages,
    data() {
      return {
        order: {
          id: null,
          amount: '0.00',
          statusText: '',
          time: '',
          orderNo: '',
          // 页面展示用的"处方单号"（沿用原来的订单号/处方号文案）
          // 真正用于跳转处方详情接口的处方ID（数字）
          prescriptionId: null,
          diagnosis: '',
          doctor: '',
          hospital: '',
          doctorAvatar: '',
          prescriptionDiagnosis: '',
          doctorTitle: '',
          department: '',
          doctorId: null,
          orderStatus: null, // 订单状态：3为已完成
          receiptConfirmType: null,
          orderType: null,
          payStatus: null,
          paymentFulfillmentStatus: null,
          redeemStatus: null,
          refundStatus: null,
          refundApplicationId: null,
          routeStatusDesc: '', // 顺丰最新路由描述
          logisticsNo: '', // 运单号
          shippingPaymentMethod: '', // 运费支付方式（到付）
          estimatedFreight: null,
          freightQuoteSource: null,
          patientId: null,
          patientName: '',
          patientGender: '',
          patientAge: 0,
          patientIdType: '',
          patientIdNumberMasked: '',
          patientSnapshotAvailable: false
        },
        paying: false,
        orderLoaded: false,
        detailRequestSequence: 0,
        detailLoading: false,
        paymentPageActive: true,
        pageSession: getSessionGeneration(),
        hasShown: false,
        allCartItems: [], // 订单商品列表
        prescriptionInfoLoaded: false
      }
    },
    async onLoad(options) {
      console.debug('event=ui_order_order_detail stage=page_load result=started')

      const orderId = options.orderId || options.id
      if (orderId) {
        this.order.id = orderId
        // 优先从API获取订单详情
        await this.loadOrderDetail(orderId)
      } else {
        uni.showToast({ title: '缺少订单编号，请从订单列表进入', icon: 'none' })
      }
    },
    onShow() {
      if (!this.paymentPageActive || !isCurrentSession(this.pageSession)) return
      logPageView({ ...PAGE_LOG, pageId: this.order.id || '', actionCode: 'ORDER_DETAIL_VIEW', accessTitle: '订单详情', accessDescription: '进入订单详情，查看订单、支付与履约信息' })
      if (this.hasShown && this.order.id && !this.paying) {
        this.loadOrderDetail(this.order.id)
      }
      this.hasShown = true
    },
    onUnload() {
      if (this.detailLoading && isCurrentSession(this.pageSession)) uni.hideLoading()
      this.detailLoading = false
      this.paymentPageActive = false
      this.detailRequestSequence++
    },
    computed: {
      receiptConfirmText() {
        return getReceiptConfirmText(this.order)
      },
      displayCartItems() {
        let displayNo = 0
        return this.allCartItems.map(item => ({
          ...item,
          // sequenceNo 属于单条商品明细；页面按整单顺序连续编号。
          redeemVouchers: (item.redeemVouchers || []).map(voucher => ({
            ...voucher,
            displayNo: ++displayNo
          }))
        }))
      },
      canPay() {
        return this.orderLoaded && canPayOrder(this.order)
      },
      canViewPrescription() {
        // 以本次订单接口返回的处方关联为准，不按商品分类或是否混购推断。
        // 加载中、加载失败时不开放入口，避免用户打开上一次响应留下的处方。
        // 处方主键必须是正整数；兼容接口返回数字或字符串，排除空值、0 和无效标识。
        return this.orderLoaded && /^[1-9]\d*$/.test(String(this.order.prescriptionId || ''))
      },
      displayPrescriptionNo() {
        const value = this.order.prescriptionId
        if (value === null || value === undefined || value === '') {
          return '无'
        }
        return String(value)
      },
      displayDoctorName() {
        if (!this.isUsableId(this.order.doctorId)) {
          return AI_DOCTOR.name
        }
        return this.order.doctorName || this.order.doctor || AI_DOCTOR.name
      },
      infoList() {
        // 新快照含实物就显示配送；历史纯疗法沿已存订单类型保留无需物流的原履约方式。
        const therapyOnly = isTherapyOrder({ ...this.order, items: this.allCartItems })
        const list = [
          // 处方单号只使用真实处方表主键 prescriptionId。
          // { label: '处方单号', labelKey: 'prescriptionId', value: this.displayPrescriptionNo },
          { label: '订单号', labelKey: 'orderNo', value: this.order.orderNo },
          { label: '开方医生', labelKey: 'doctor', value: this.displayDoctorName },
          { label: '订单金额', labelKey: 'payableAmount', value: this.order.payableAmount ? Number(this.order.payableAmount).toFixed(2) : '' },
          { label: '支付时间', labelKey: 'payTime', value: this.formatDateTime(this.order.payTime) || '未支付' },
          { label: '预估运费', labelKey: 'shippingPaymentMethod', value: therapyOnly ? '无' : formatFreightEstimate(this.order.estimatedFreight, this.order.freightQuoteSource) }
        ]
        if (this.order.routeStatusDesc) {
          list.push({ label: '物流状态', labelKey: 'routeStatusDesc', value: this.order.routeStatusDesc })
        }
        if (this.order.logisticsNo) {
          list.push({ label: '运单号', labelKey: 'logisticsNo', value: this.order.logisticsNo })
        }
        return list
      },
      doctorAvatar() {
        return getImageUrl(this.order.doctorAvatar || AI_DOCTOR.avatar)
      },
      // 计算订单总金额：优先使用API返回的金额，否则基于商品列表计算
      totalAmount() {
        // 优先使用API返回的订单金额
        if (this.order.amount && this.order.amount !== '0.00') {
          const amount = parseFloat(this.order.amount)
          if (!isNaN(amount) && amount > 0) {
            return amount
          }
        }
        // 如果API金额无效，则基于商品列表计算
        const calculated = this.allCartItems.reduce((total, item) => {
          const price = parseFloat(item.price) || 0
          const quantity = parseInt(item.quantity) || 1
          return total + (price * quantity)
        }, 0)
        return calculated > 0 ? calculated : 0
      },

      canApplyRefund() {
        return canOrderApplyRefund({ ...this.order, items: this.allCartItems })
      },
      showOfflineRefundNotice() {
        return shouldContactForPhysicalRefund({ ...this.order, items: this.allCartItems })
      },
      refundActionText() {
        const hasRefundApplication = !!this.order.refundApplicationId || Number(this.order.refundStatus) > 0
        return hasRefundApplication ? '继续退款' : '申请退款'
      }
    },
    methods: {
      getOrderItemRefundText,
      isDetailRequestCurrent(sequence) {
        return this.paymentPageActive && sequence === this.detailRequestSequence && isCurrentSession(this.pageSession)
      },
      copyOrderNo() {
        const orderNo = String(this.order.orderNo ?? '').trim()
        if (!orderNo) return
        uni.setClipboardData({
          data: orderNo,
          fail: () => uni.showToast({ title: '复制失败，请重试', icon: 'none' })
        })
      },
      async handlePayOrder() {
        if (!this.canPay || this.paying || !this.paymentPageActive) return
        const session = getSessionGeneration()
        const orderId = this.order.id
        this.paying = true
        try {
          // 列表可能停留较久，先核对服务端状态，再复用已有订单发起支付。
          const latest = await getOrderDetail(orderId, { showLoading: false })
          assertCurrentSession(session)
          if (!this.paymentPageActive) return
          if (!canPayOrder(latest)) {
            logAccess({ ...PAGE_LOG, pageId: orderId, actionType: 'BEHAVIOR', actionCode: 'ORDER_PAYMENT_CLIENT_RESULT', actionResult: 'FAILED', accessTitle: '发起订单支付', accessDescription: '订单状态已变化，本次未发起支付', extraData: { reason: 'ORDER_NOT_PAYABLE' } })
            await this.loadOrderDetail(orderId)
            if (this.paymentPageActive && isCurrentSession(session)) {
              uni.showToast({ title: '订单状态已更新，请查看详情', icon: 'none' })
            }
            return
          }
          logButtonClick({ ...PAGE_LOG, pageId: orderId, actionCode: 'ORDER_PAYMENT_START', accessTitle: '发起订单支付', accessDescription: '为当前待支付订单发起微信支付' })
          const result = await wechatSinglePay(orderId)
          assertCurrentSession(session)
          if (!this.paymentPageActive) return
          logAccess({ ...PAGE_LOG, pageId: orderId, actionType: 'BEHAVIOR', actionCode: 'ORDER_PAYMENT_CLIENT_RESULT', actionResult: 'UNKNOWN', accessTitle: '客户端付款已提交', accessDescription: '微信客户端付款提交已返回，实际支付结果仍需服务端确认', extraData: { sdkState: 'SUBMITTED' } })
          // SDK 成功仅代表付款已提交，结果页继续由服务端查单确认。
          const query = Object.entries({ orderId, outTradeNo: result.outTradeNo || '', paymentType: 'single' })
            .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&')
          uni.redirectTo({ url: `/pages/order/payment_success?${query}` })
        } catch (error) {
          if (!this.paymentPageActive || !isCurrentSession(session) || error.code === 'SESSION_CHANGED') return
          logAccess({ ...PAGE_LOG, pageId: orderId, actionType: 'BEHAVIOR', actionCode: 'ORDER_PAYMENT_CLIENT_RESULT', actionResult: getActionFailureResult(error), accessTitle: '发起订单支付', accessDescription: '本次支付流程未取得服务端支付成功确认', extraData: { reason: error.message === '用户取消支付' ? 'USER_CANCELLED' : 'PAYMENT_NOT_CONFIRMED' } })
          if (error.message !== '用户取消支付') {
            uni.showToast({ title: error.message || '支付未完成，请稍后重试', icon: 'none' })
          }
        } finally {
          this.paying = false
        }
      },
      // 格式化日期时间为 YYYY-MM-DD HH:mm:ss
      formatDateTime(dateTimeStr) {
        if (!dateTimeStr) {
          return ''
        }

        try {
          const rawText = String(dateTimeStr).trim()
          if (!rawText || rawText === 'null' || rawText === 'undefined') {
            return ''
          }
          // 如果已经是 YYYY-MM-DD HH:mm:ss 格式，直接返回
          if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rawText)) {
            return rawText
          }

          let date

          // 如果是时间戳（数字）
          if (typeof dateTimeStr === 'number') {
            date = new Date(dateTimeStr < 10000000000 ? dateTimeStr * 1000 : dateTimeStr)
          }
          // 如果是字符串
          else if (typeof dateTimeStr === 'string') {
            if (/^\d+$/.test(rawText)) {
              const timestamp = Number(rawText)
              date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp)
            } else {
              const normalized = rawText
                .replace('T', ' ')
                .replace(/\.\d+$/, '')
                .replace(/([+-]\d{2}:?\d{2}|Z)$/i, '')
                .replace(/-/g, '/')
              date = new Date(normalized)
            }
          } else {
            return dateTimeStr
          }

          // 验证日期是否有效
          if (isNaN(date.getTime())) {
            return dateTimeStr
          }

          // 格式化为 YYYY-MM-DD HH:mm:ss
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          const hours = String(date.getHours()).padStart(2, '0')
          const minutes = String(date.getMinutes()).padStart(2, '0')
          const seconds = String(date.getSeconds()).padStart(2, '0')

          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
        } catch (e) {
          console.error('event=ui_order_order_detail stage=format_date_time result=failed reason=operation_incomplete')
          return dateTimeStr
        }
      },

      // 删除订单
      deleteOrder() {
        uni.showModal({
          title: '提示',
          content: '确定要删除该订单吗？',
          success: (res) => {
            if (res.confirm) {
              uni.showToast({
                title: '功能开发中',
                icon: 'none'
              })
            }
          }
        })
      },

      // 评价订单
      reviewOrder() {
        uni.showToast({
          title: '功能开发中',
          icon: 'none'
        })
      },

      // 再买一单
      rebuyOrder() {
        if (this.allCartItems && this.allCartItems.length > 0) {
          const firstItem = this.allCartItems[0]
          const productId = firstItem.id
          if (productId) {
            // 订单商品详情入口使用下单分类快照；无分类快照时不猜配历史分类。
            const hasRedeemVouchers = Number(firstItem.productCategorySnapshot) === 3
            const targetPage = hasRedeemVouchers ? 'therapy_detail' : 'medicine_detail'
            uni.navigateTo({
              url: `/pages/products/${targetPage}?id=${productId}`
            })
          } else {
            uni.showToast({
              title: '商品信息有误',
              icon: 'none'
            })
          }
        } else {
          uni.showToast({
            title: '暂无商品信息',
            icon: 'none'
          })
        }
      },

      buildRedeemVouchers(item = {}) {
        return buildItemRedeemVouchers(item)
      },

      formatRedeemStatus(voucher = {}) {
        if (Number(voucher.redeemStatus) === 3) return getRedeemStatusText(voucher)
        return voucher.redeemStatusText || getRedeemStatusText(voucher)
      },

      canShowVoucherCode(voucher = {}) {
        return canShowRedeemCode(this.order, voucher) && !!voucher.verifyCode
      },

      canShowVoucherQr(voucher = {}) {
        return canShowRedeemCode(this.order, voucher) && !!voucher.verifyQrBase64
      },

      normalizeQrImageSrc(value) {
        const text = String(value || '').trim()
        if (!text) {
          return ''
        }

        const dataUriMatch = text.match(/^(data:image\/[a-zA-Z0-9.+-]+;base64)[,;]/i)
        if (dataUriMatch) {
          const payload = text.slice(dataUriMatch[0].length).trim()
          const nestedDataUriIndex = payload.search(/data:image\/[a-zA-Z0-9.+-]+;base64[,;]/i)
          if (nestedDataUriIndex >= 0) {
            return this.normalizeQrImageSrc(payload.slice(nestedDataUriIndex))
          }
          return `${dataUriMatch[1]},${payload}`
        }

        const nestedDataUriIndex = text.search(/data:image\/[a-zA-Z0-9.+-]+;base64[,;]/i)
        if (nestedDataUriIndex >= 0) {
          return this.normalizeQrImageSrc(text.slice(nestedDataUriIndex))
        }

        return `data:image/png;base64,${text.replace(/^base64[,;]/i, '').trim()}`
      },

      isUsableId(value) {
        if (value === null || value === undefined) {
          return false
        }
        const text = String(value).trim()
        return text !== '' && text !== 'null' && text !== 'undefined'
      },

      applyPatientSnapshot(source = {}) {
        if (!Object.prototype.hasOwnProperty.call(source, 'patientSnapshotAvailable')) {
          return
        }
        const available = source.patientSnapshotAvailable === true
        this.order.patientSnapshotAvailable = available
        this.order.patientId = available ? (source.patientId || null) : null
        this.order.patientName = available ? (source.patientName || '') : ''
        this.order.patientGender = available ? (source.patientGender || '') : ''
        this.order.patientAge = available ? (source.patientAge || 0) : 0
        this.order.patientIdType = available ? (source.patientIdType || '') : ''
        this.order.patientIdNumberMasked = available ? (source.patientIdNumberMasked || '') : ''
      },

      resolvePrescriptionNavigationParams() {
        // 点击时复用按钮的显示条件，防止刷新期间或旧事件继续打开无效处方。
        // 没有真实处方 ID 就停止，不再用订单 ID 进入处方页后尝试查找。
        if (!this.canViewPrescription) return ''
        return `prescriptionId=${encodeURIComponent(this.order.prescriptionId)}`
      },

      async loadProductDetail(productId) {
        if (!productId) {
          return null
        }
        return getProductDetail(productId, { showLoading: false, silent: true })
      },

      async loadDoctorDetail(doctorId) {
        if (!doctorId) {
          return null
        }
        return getDoctorDetail(doctorId, { showLoading: false, silent: true })
      },

      applyDoctorInfo(doctor, doctorId = null) {
        if (!doctor) {
          return
        }
        this.order.doctorId = doctorId || this.order.doctorId
        this.order.doctorName = doctor.name || this.order.doctorName
        this.order.doctor = doctor.name || this.order.doctor
        this.order.doctorTitle = doctor.title || this.order.doctorTitle
        this.order.doctorAvatar = doctor.avatarUrl || this.order.doctorAvatar
        this.order.hospital = doctor.hospitalName || this.order.hospital
        this.order.department = doctor.department || this.order.department
      },

      applyAiDoctorInfo() {
        this.order.doctorId = null
        this.order.doctorName = AI_DOCTOR.name
        this.order.doctor = AI_DOCTOR.name
        this.order.doctorTitle = ''
        this.order.department = ''
        this.order.hospital = ''
        this.order.doctorAvatar = AI_DOCTOR.avatar
      },

      needsProductEnrichment() {
        if (!this.allCartItems || this.allCartItems.length === 0) {
          return false
        }
        return !this.order.diagnosis ||
          (!this.order.prescriptionId && !this.order.doctorName) ||
          this.allCartItems.some(item => item.id && !item.image)
      },

      needsPrescriptionEnrichment() {
        return !!this.order.prescriptionId &&
          !this.prescriptionInfoLoaded
      },

      // 从API加载订单详情
      async loadOrderDetail(orderId) {
        if (!this.paymentPageActive || !isCurrentSession(this.pageSession)) return
        const sequence = ++this.detailRequestSequence
        this.detailLoading = true
        this.orderLoaded = false
        this.prescriptionInfoLoaded = false
        try {
          uni.showLoading({ title: '加载中...' })

          // 本轮加载统一管理提示，公共请求层不能替旧请求弹错或结束新请求的 Loading。
          const orderDetail = await getOrderDetail(orderId, { showLoading: false, silent: true })
          if (!this.isDetailRequestCurrent(sequence)) return
          console.debug('event=ui_order_order_detail stage=order_detail result=received')

          if (orderDetail) {
            this.applyPatientSnapshot(orderDetail)
            // 设置订单基本信息
            this.order.id = orderDetail.id || orderId || this.order.id
            this.order.amount = orderDetail.payableAmount ?? orderDetail.totalAmount ?? '0.00'
          this.order.payableAmount = orderDetail.payableAmount || this.order.amount
          this.order.payTime = this.formatDateTime(orderDetail.payTime || '')
          this.order.orderStatus = orderDetail.orderStatus
          // 每次以当前接口值覆盖；历史未记录时清空，避免沿用上一次详情响应的确认来源。
          this.order.receiptConfirmType = orderDetail.receiptConfirmType ?? null
          this.order.orderType = orderDetail.orderType ?? this.order.orderType
          this.order.payStatus = orderDetail.payStatus ?? this.order.payStatus
          this.order.paymentFulfillmentStatus = orderDetail.paymentFulfillmentStatus ?? null
          this.order.refundStatus = orderDetail.refundStatus ?? this.order.refundStatus
          this.order.redeemStatus = orderDetail.redeemStatus ?? this.order.redeemStatus
          this.order.refundApplicationId = orderDetail.refundApplicationId ?? this.order.refundApplicationId
            // 检查是否是制剂订单（有待核销券），待发货改为待核销
            const hasRedeemVouchers = (orderDetail.items && orderDetail.items.some(item => item.redeemVouchers && item.redeemVouchers.length > 0))
            this.order.statusText = getOrderStatusText({
              displayStatusText: orderDetail.displayStatusText,
              orderStatus: this.order.orderStatus,
              orderType: this.order.orderType,
              payStatus: this.order.payStatus,
          paymentFulfillmentStatus: this.order.paymentFulfillmentStatus,
              refundStatus: this.order.refundStatus,
              redeemStatus: this.order.redeemStatus,
              hasRedeemVouchers,
              items: orderDetail.items || []
            })
            this.order.time = this.formatDateTime(orderDetail.createdAt)
            this.order.orderNo = orderDetail.orderNo || this.order.orderNo
            // 物流/运费（到付）信息
            this.order.shippingPaymentMethod = orderDetail.shippingPaymentMethod || '到付，以实际为准'
            this.order.estimatedFreight = orderDetail.estimatedFreight ?? null
            this.order.freightQuoteSource = orderDetail.freightQuoteSource ?? null
            this.order.routeStatusDesc = orderDetail.routeStatusDesc || ''
            this.order.logisticsNo = orderDetail.logisticsNo || ''

            // 每次成功响应都覆盖处方关联；服务端未返回关联时清空旧值，避免刷新后入口残留。
            this.order.prescriptionId = orderDetail.prescriptionId || null
            if (this.order.prescriptionId) {
              this.applyAiDoctorInfo()
            }

            // 如果订单中包含 doctorId（直接来自订单或处方），优先从医生表获取头像/职称等信息
            if (orderDetail.doctorId && !this.order.prescriptionId) {
              this.order.doctorId = orderDetail.doctorId
              try {
                const doctor = await this.loadDoctorDetail(orderDetail.doctorId)
                if (!this.isDetailRequestCurrent(sequence)) return
                this.applyDoctorInfo(doctor, orderDetail.doctorId)
              } catch (e) {
                if (!this.isDetailRequestCurrent(sequence)) return
                console.warn('event=ui_order_order_detail stage=doctor_info result=failed reason=request_failed')
              }
            }

            // 设置商品列表
            if (orderDetail.items && orderDetail.items.length > 0) {

              this.allCartItems = orderDetail.items.map(item => ({
                id: item.productId,
                orderItemId: item.id,
                productCategorySnapshot: item.productCategorySnapshot,
                redeemRequiredSnapshot: item.redeemRequiredSnapshot,
                skuId: item.skuId || null,
                skuCode: item.skuCode || '',
                skuName: item.skuName || '',
                specText: item.skuSpecText || item.specText || '',
                name: item.productName,
                price: parseFloat(item.price || 0),
                quantity: Number(item.quantity),
                refundedQuantity: Number(item.refundedQuantity || 0),
                redeemedQuantity: Number(item.redeemedQuantity || 0),
                refundCompletedQuantity: Number(item.refundCompletedQuantity || 0),
                refundFrozenQuantity: Number(item.refundFrozenQuantity || 0),
                refundableQuantity: Number(item.refundableQuantity || 0),
                refundable: Boolean(item.refundable),
                refundBlockedReason: item.refundBlockedReason || '',
                image: getImageUrl(item.productImage || ''),
                redeemVouchers: this.buildRedeemVouchers(item)
              }))
              console.debug('event=ui_order_order_detail stage=order_items result=applied')
            }

            if (this.needsProductEnrichment()) {
              await this.enrichDiagnosisFromAllProducts(sequence)
              if (!this.isDetailRequestCurrent(sequence)) return
            }
            if (this.needsPrescriptionEnrichment()) {
              await this.applyDoctorFromPrescription(this.order.prescriptionId, sequence)
              if (!this.isDetailRequestCurrent(sequence)) return
            }
            const productId = (this.allCartItems[0] && this.allCartItems[0].id) || null
            if (productId && this.needsProductEnrichment()) {
              await this.enrichByProduct(productId, sequence)
              if (!this.isDetailRequestCurrent(sequence)) return
            }
            if (this.needsPrescriptionEnrichment()) {
              await this.fillPrescriptionInfo(this.order.prescriptionId, sequence)
              if (!this.isDetailRequestCurrent(sequence)) return
            }
            this.orderLoaded = true
          }

        } catch (error) {
          if (!this.isDetailRequestCurrent(sequence)) return
          console.error('event=ui_order_order_detail stage=order_detail result=failed reason=request_failed')

          this.orderLoaded = false
          this.allCartItems = []
          uni.showToast({ title: '订单加载失败，请重试', icon: 'none' })
        } finally {
          if (this.isDetailRequestCurrent(sequence)) {
            this.detailLoading = false
            uni.hideLoading()
          }
        }
      },

      // 从所有商品中收集诊断信息（用逗号拼接）
      async enrichDiagnosisFromAllProducts(sequence = this.detailRequestSequence) {
        if (!this.isDetailRequestCurrent(sequence)) return
        if (!this.allCartItems || this.allCartItems.length === 0) {
          return
        }

        try {
          const diagnoses = []
          const productIds = this.allCartItems.map(item => item.id).filter(Boolean)

          console.debug('event=ui_order_order_detail stage=diagnosis_enrichment result=started')
          // 诊断仅补当前真实商品的 prescriptionDiagnosis，不猜测旧字段。
          for (const productId of productIds) {
            try {
              const product = await this.loadProductDetail(productId)
              if (!this.isDetailRequestCurrent(sequence)) return
              if (product) {
                const pd = product.prescriptionDiagnosis
                if (pd) {
                // 去重，避免重复的诊断信息
                  if (!diagnoses.includes(pd)) {
                    diagnoses.push(pd)
                  }
                }
              }
            } catch (e) {
              if (!this.isDetailRequestCurrent(sequence)) return
              console.warn('event=ui_order_order_detail stage=enrich_diagnosis_from_all_products result=warning reason=operation_incomplete')
            }
          }

          // 用逗号拼接所有诊断信息
          if (diagnoses.length > 0) {
            const joined = diagnoses.join('，')
            this.order.diagnosis = joined
            this.order.prescriptionDiagnosis = joined
            console.debug('event=ui_order_order_detail stage=diagnosis_enrichment result=applied')
          }
        } catch (e) {
          if (!this.isDetailRequestCurrent(sequence)) return
          console.error('event=ui_order_order_detail stage=enrich_diagnosis_from_all_products result=failed reason=operation_incomplete')
        }
      },

      // 基于首件商品补全医生/诊断信息
      async enrichByProduct(productId, sequence = this.detailRequestSequence) {
        if (!this.isDetailRequestCurrent(sequence)) return
        try {
          const product = await this.loadProductDetail(productId)
          if (!this.isDetailRequestCurrent(sequence)) return
          if (product) {
            // 诊断信息已通过 enrichDiagnosisFromAllProducts 处理，这里不再覆盖
            if (!this.order.prescriptionId && !this.order.doctorName) {
              this.order.doctorId = product.doctorId || this.order.doctorId
              this.order.doctorName = product.doctorName || this.order.doctorName
              this.order.doctor = this.order.doctorName
            }
            // 补齐商品列表首项图片
            if (!this.allCartItems.length) {
              this.allCartItems = [{
                id: product.id,
                name: product.productName || '商品',
                price: Number(product.price) || 0,
                quantity: 1,
                image: getImageUrl(product.coverImage || product.image || '')
              }]
            } else if (this.allCartItems[0] && !this.allCartItems[0].image) {
              this.allCartItems[0].image = getImageUrl(product.coverImage || product.image || '')
            }
          }

          if (this.order.doctorId) {
            try {
              const doctor = await this.loadDoctorDetail(this.order.doctorId)
              if (!this.isDetailRequestCurrent(sequence)) return
              this.applyDoctorInfo(doctor, this.order.doctorId)
              console.debug('event=ui_order_order_detail stage=enrich_by_product result=observed')
            } catch (e) {
              if (!this.isDetailRequestCurrent(sequence)) return
              console.warn('event=ui_order_order_detail stage=enrich_by_product result=warning reason=operation_incomplete')
            }
          }
        } catch (e) {
          if (!this.isDetailRequestCurrent(sequence)) return
          console.error('event=ui_order_order_detail stage=enrich_by_product result=failed reason=operation_incomplete')
        }
      },

      // 根据咨询ID获取 created_at 作为开具时间
      async fillPrescriptionInfo(prescriptionId, sequence = this.detailRequestSequence) {
        if (!prescriptionId || !this.isDetailRequestCurrent(sequence)) return
        try {
          const { prescription, consultation } = await loadPrescriptionContext(prescriptionId, {
            getPrescriptionDetail: id => getPrescriptionDetail(id, { showLoading: false, silent: true }),
            getConsultationDetail: id => this.isDetailRequestCurrent(sequence)
              ? getConsultationDetail(id, { showLoading: false, silent: true }) : null
          })
          if (!this.isDetailRequestCurrent(sequence)) return
          this.applyPatientSnapshot(prescription)
          this.order.prescriptionId = prescription.id
          this.order.diagnosis = prescription.diagnosis || consultation?.diagnosis || ''
          this.order.prescriptionDiagnosis = prescription.diagnosis || ''
          if (consultation) {
            const doctorName = resolveConsultationDoctorName(consultation)
            this.order.doctor = doctorName
            this.order.doctorName = doctorName
          }
          this.prescriptionInfoLoaded = true
        } catch (error) {
          if (!this.isDetailRequestCurrent(sequence)) return
          console.warn('event=ui_order_order_detail stage=fill_prescription_info result=warning reason=operation_incomplete')
        }
      },

      async applyDoctorFromPrescription(prescriptionId, sequence = this.detailRequestSequence) {
        if (!prescriptionId || !this.isDetailRequestCurrent(sequence)) {
          return
        }
        try {
          const prescription = await getPrescriptionDetail(prescriptionId, { showLoading: false, silent: true })
          if (!this.isDetailRequestCurrent(sequence)) return
          if (!prescription) {
            return
          }
          this.applyPatientSnapshot(prescription)
          const doctorId = prescription.doctorId
          if (!doctorId) {
            this.applyAiDoctorInfo()
            return
          }
          if (doctorId) {
            const doctor = await this.loadDoctorDetail(doctorId)
            if (!this.isDetailRequestCurrent(sequence)) return
            if (doctor) {
              this.applyDoctorInfo(doctor, doctorId)
              return
            }
          }
          const consultationId = prescription.consultationId
          if (consultationId) {
            const consultation = await getConsultationDetail(consultationId, { showLoading: false, silent: true })
            if (!this.isDetailRequestCurrent(sequence)) return
            const displayName = resolveConsultationDoctorName(consultation)
            if (displayName) {
              this.order.doctorName = displayName
              this.order.doctor = displayName
            }
          }
        } catch (e) {
          if (!this.isDetailRequestCurrent(sequence)) return
          console.warn('event=ui_order_order_detail stage=apply_doctor_from_prescription result=warning reason=operation_incomplete')
        }
      },

      getStatusText(status, hasRedeemVouchers = false) {
        return getOrderStatusText({
          orderStatus: status,
          orderType: this.order.orderType,
          payStatus: this.order.payStatus,
          paymentFulfillmentStatus: this.order.paymentFulfillmentStatus,
          refundStatus: this.order.refundStatus,
          redeemStatus: this.order.redeemStatus,
          hasRedeemVouchers
        })
      },

      handleView() {
        // 页面隐藏按钮之外，方法入口也校验一次，避免无处方订单进入报错页。
        const query = this.resolvePrescriptionNavigationParams()
        if (!query) {
          uni.showToast({
            title: '暂无关联处方',
            icon: 'none'
          })
          return
        }

        console.debug('event=ui_order_order_detail stage=handle_view result=observed')
        logButtonClick({ ...PAGE_LOG, pageId: this.order.id || '', actionCode: 'ORDER_PRESCRIPTION_OPEN', accessTitle: '查看关联处方', accessDescription: '从订单详情打开关联处方', extraData: { prescriptionId: this.order.prescriptionId || '' } })
        uni.navigateTo({
          url: `/pages/prescription/detail?${query}`
        })
      },

      // 加载购物车数据
      loadCartItems() {
        this.allCartItems = []
        console.debug('event=ui_order_order_detail stage=load_cart_items result=observed')
      },



      // 申请退货
      async applyRefund() {
        const session = getSessionGeneration()
        try {
          const orderId = this.order.id
          logButtonClick({ ...PAGE_LOG, pageId: orderId || '', actionCode: 'ORDER_REFUND_OPEN', accessTitle: '申请退款售后', accessDescription: '检查当前订单是否允许申请退款售后' })

          // 检查是否可以申请退货
          const checkResult = await checkCanApplyRefund(orderId)
          if (!this.paymentPageActive || !isCurrentSession(session)) return
          if (!checkResult) {
            logAccess({ ...PAGE_LOG, pageId: orderId || '', actionType: 'BEHAVIOR', actionCode: 'ORDER_REFUND_OPEN_RESULT', actionResult: 'FAILED', accessTitle: '申请退款售后', accessDescription: '当前订单不符合申请条件，未进入退款申请', extraData: { reason: 'REFUND_NOT_ALLOWED' } })
            uni.showToast({
              title: '该订单不符合退货条件',
              icon: 'none'
            })
            return
          }

          // 跳转到退货申请页面
          uni.navigateTo({
            url: `/pages/order/refund_apply?orderId=${orderId}`
          })

        } catch (error) {
          if (!this.paymentPageActive || !isCurrentSession(session)) return
          logAccess({ ...PAGE_LOG, pageId: this.order.id || '', actionType: 'BEHAVIOR', actionCode: 'ORDER_REFUND_OPEN_RESULT', actionResult: getActionFailureResult(error), accessTitle: '申请退款售后', accessDescription: '未能确认当前订单的退款申请条件', extraData: { reason: 'ELIGIBILITY_NOT_CONFIRMED' } })
          console.error('event=ui_order_order_detail stage=apply_refund result=failed reason=operation_incomplete')
          uni.showToast({
            title: error.message || '操作失败',
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
    background-color: #f5f5f5;
    padding: 24rpx 24rpx 40rpx;
    box-sizing: border-box;
  }

  /* 白色订单卡片 */
  .order-card {
    background-color: #ffffff;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.04);
    overflow: hidden;
  }

  /* 顶部区域 */
  .order-header {
    padding: 32rpx 32rpx 24rpx;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .order-header-left {
    display: flex;
    flex-direction: column;
  }

  .title-row {
    display: flex;
    align-items: center;
  }

  .icon-circle {
    line-height: 1;
    width: 48rpx;
    height: 48rpx;
    border-radius: 50%;
    background-color: #eef3ff;
    justify-content: center;
    align-items: center;
    display: flex;
    margin-right: 12rpx;
  }

  .icon-plus {
    margin: 0;
    font-size: 32rpx;
    color: #2f7cf6;
  }

  .title-text {
    font-size: 30rpx;
    color: #333333;
  }

  .amount-text {
    margin-top: 28rpx;
    font-size: 52rpx;
    font-weight: 600;
    color: #111111;
  }

  /* 右侧状态区域 */
  .order-header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 8rpx;
  }

  .status-text {
    font-size: 28rpx;
    color: #2f7cf6;
    font-weight: bold;
  }

  .time-text {
    font-size: 24rpx;
    color: #999999;
  }

  /* 分割线 */
  .divider {
    height: 1px;
    background-color: #f1f1f1;
    margin: 0 32rpx;
  }

  .doctor-row {
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 20rpx 32rpx;
  }

  .doctor-avatar {
  width: 100rpx;
  height: 100rpx;
    border-radius: 50%;
    background: #f5f5f5;
  }

  .doctor-info {
    display: flex;
    flex-direction: column;
  gap: 8rpx;
  min-width: 0;
  }

.doctor-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  }

  .doctor-name {
  font-size: 30rpx;
    font-weight: 600;
    color: #333;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.doctor-title {
  font-size: 24rpx;
  color: #666;
  background: #f5f5f5;
  padding: 4rpx 10rpx;
  border-radius: 6rpx;
  white-space: nowrap;
  }

.doctor-department {
    font-size: 24rpx;
    color: #666;
  line-height: 1.2;
  margin-top: 2rpx;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  }

  .patient-snapshot {
    padding: 8rpx 32rpx 16rpx;
    display: flex;
    align-items: flex-start;
  }

  .patient-snapshot-label {
    width: 160rpx;
    font-size: 26rpx;
    color: #999999;
  }

  .patient-snapshot-content {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6rpx;
    font-size: 28rpx;
    color: #333333;
  }

  .patient-snapshot-id,
  .patient-snapshot-empty {
    font-size: 24rpx;
    color: #999999;
  }

  /* 信息行 */
  .info-row {
    padding: 8rpx 32rpx;
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  .info-label {
    font-size: 26rpx;
    color: #999999;
    width: 160rpx;
    flex-shrink: 0;
  }

  .info-value {
    font-size: 28rpx;
    color: #333333;
    flex: 1;
    min-width: 0;
    word-break: break-all;
  }

  .copy-order-no {
    flex-shrink: 0;
    margin-left: 16rpx;
    font-size: 22rpx;
    line-height: 1.5;
    color: #2f7cf6;
  }

  /* 操作按钮 */
  .action-buttons {
    display: flex;
    gap: 20rpx;
    padding: 24rpx 32rpx;
  }

  .action-btn {
    flex: 1;
    height: 72rpx;
    line-height: 72rpx;
    font-size: 26rpx;
    color: #666666;
    background: #f5f5f5;
    border-radius: 8rpx;
    margin: 0;
    padding: 0;
  }

  .action-btn::after {
    border: none;
  }

  /* 按钮区域 */
  .btn-row {
    padding: 32rpx 32rpx 40rpx;
    display: flex;
    justify-content: flex-end;
    gap: 16rpx;
  }

  .primary-btn {
    width: 420rpx;
    height: 88rpx;
    line-height: 88rpx;
    background-color: #2f7cf6;
    color: #ffffff;
    font-size: 30rpx;
    border-radius: 999rpx;
    text-align: center;
    padding: 0;
    border: none;
  }

  /* 去掉默认边框/背景（小程序端） */
  .primary-btn::after {
    border: none;
  }

  .secondary-btn {
    width: 200rpx;
    height: 88rpx;
    line-height: 88rpx;
    background-color: #ffffff;
    color: #666666;
    font-size: 28rpx;
    border-radius: 999rpx;
    text-align: center;
    padding: 0;
    border: 2rpx solid #e5e5e5;
  }

  .secondary-btn::after {
    border: none;
  }

  .refund-btn {
    background-color: #ff6b35;
    color: #ffffff;
    border-color: #ff6b35;
  }

  /* 药品列表区域 */
  .medicines-section {
    margin: 20rpx 32rpx;
    padding: 24rpx 0;
    border-top: 1px solid #f1f1f1;
  }

  .medicines-header {
    margin-bottom: 20rpx;
    padding-bottom: 16rpx;
    border-bottom: 1rpx solid #f0f0f0;
  }

  .medicines-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #333333;
  }

  .medicines-list {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
  }

  .medicine-item {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    position: relative;
    padding: 16rpx;
    background: #f9f9f9;
    border-radius: 8rpx;
  }

  .medicine-content {
    display: flex;
    align-items: center;
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
    color: #333333;
  }

  .medicine-spec {
    margin-top: 6rpx;
    font-size: 24rpx;
    color: #64748b;
    line-height: 1.4;
  }

  .medicine-price {
    color: #e64340;
    font-size: 26rpx;
    font-weight: 600;
  }

  .medicine-refund-summary {
    font-size: 24rpx;
    color: #b45309;
    line-height: 1.4;
  }

  .refund-contact-tip {
    margin: 24rpx 0;
    font-size: 26rpx;
    color: #64748b;
    line-height: 1.5;
    text-align: center;
  }

  .therapy-vouchers {
    margin-top: 18rpx;
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  .therapy-voucher-card {
    padding: 18rpx;
    background: #ffffff;
    border: 1rpx solid #e5edff;
    border-radius: 8rpx;
  }

  .therapy-voucher-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14rpx;
  }

  .therapy-voucher-title {
    font-size: 26rpx;
    font-weight: 600;
    color: #1f2937;
  }

  .therapy-voucher-status {
    padding: 4rpx 14rpx;
    border-radius: 999rpx;
    background: #eaf2ff;
    color: #2f7cf6;
    font-size: 22rpx;
  }

  .therapy-voucher-status.redeemed {
    background: #f1f5f9;
    color: #64748b;
  }

  .therapy-voucher-code {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12rpx;
    margin: 0 0 14rpx;
    padding: 12rpx 16rpx;
    background: #f8fafc;
    border: 1rpx solid #e2e8f0;
    border-radius: 8rpx;
  }

  .therapy-voucher-code-label {
    color: #64748b;
    font-size: 24rpx;
  }

  .therapy-voucher-code-value {
    color: #111827;
    font-size: 30rpx;
    font-weight: 700;
    letter-spacing: 0;
  }

  .therapy-voucher-qr {
    width: 280rpx;
    height: 280rpx;
    margin: 0 auto;
    display: block;
    background: #f8fafc;
    border-radius: 8rpx;
  }

  .therapy-voucher-redeemed {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    color: #64748b;
    font-size: 24rpx;
    line-height: 1.5;
  }

  .therapy-voucher-empty {
    color: #94a3b8;
    font-size: 24rpx;
  }
  </style>
