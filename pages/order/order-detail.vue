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

      <!-- 医生信息（参考 consultation_detail.vue 的展示） -->
      <view class="doctor-row">
        <image
          class="doctor-avatar"
          :src="doctorAvatar"
          mode="aspectFill"
        />
        <view class="doctor-info">
          <view class="doctor-name-row">
            <text class="doctor-name">
              {{ order.doctorName || order.doctor || '线上医生' }}
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
  
      <!-- 信息区域 -->
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
      </view>

      <!-- 操作按钮 -->
      <view class="action-buttons">
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
      </view>

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
            v-for="item in allCartItems"
            :key="item.id" 
            class="medicine-item"
          >
            <view class="medicine-content">
              <view class="medicine-left">
                <image
                  class="medicine-thumb"
                  :src="item.image"
                  mode="aspectFill"
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
                <view class="medicine-price">
                  ¥{{ ((item.price || 0) * (Number(item.quantity) || 1)).toFixed(2) }}
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
                    核销券 {{ voucher.sequenceNo || voucherIndex + 1 }}
                  </text>
                  <text
                    class="therapy-voucher-status"
                    :class="{ redeemed: Number(voucher.redeemStatus) === 1 }"
                  >
                    {{ formatRedeemStatus(voucher) }}
                  </text>
                </view>
                <image
                  v-if="voucher.verifyQrBase64 && Number(voucher.redeemStatus) !== 1"
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
                  v-else
                  class="therapy-voucher-empty"
                >
                  暂无核销码
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 底部按钮 -->
      <view class="btn-row">
        <button
          class="primary-btn"
          @tap="handleView"
        >
          点击查看
        </button>
        <button
          v-if="canApplyRefund"
          class="secondary-btn refund-btn"
          @tap="applyRefund"
        >
          申请退货
        </button>
      </view>
    </view>
  </view>
</template>
  
  <script>
  import { getProductDetail } from '@/api/product.js'
  import { getDoctorDetail } from '@/api/hospital.js'
  import { getConsultationDetail, getPrescriptionByConsultation, getPrescriptionDetail } from '@/api/consultation.js'
  import { resolveConsultationDoctorName } from '@/utils/consultation-mode.js'
  import { getOrderDetail } from '@/api/order.js'
  import { checkCanApplyRefund } from '@/api/refund.js'
  import { getImageUrl } from '@/utils/config.js'
  import { logPageView, logButtonClick } from '@/utils/accessLog.js'
  
  export default {
    name: 'OrderDetail',
    data() {
      return {
        order: {
          id: null,
          amount: '0.00',
          statusText: '',
          time: '',
          orderNo: '',
          // 页面展示用的"处方单号"（沿用原来的订单号/处方号文案）
          prescriptionNo: '',
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
          routeStatusDesc: '', // 顺丰最新路由描述
          logisticsNo: '', // 运单号
          shippingPaymentMethod: '' // 运费支付方式（到付）
        },
        allCartItems: [] // 订单商品列表
      }
    },
    async onLoad(options) {
      logPageView('ORDER_DETAIL', options?.orderId || options?.id || '')
      console.log('OrderDetail onLoad options:', options)

      const orderId = options.orderId || options.id
      if (orderId) {
        this.order.id = orderId
        // 优先从API获取订单详情
        await this.loadOrderDetail(orderId)
      } else if (options && options.order) {
        // 从其它页面传来的序列化订单对象（例如 consultation_detail.vue 的 encoded order）
        try {
          const orderData = JSON.parse(decodeURIComponent(options.order))
          console.log('接收到的订单数据:', orderData)

          // 映射常用字段（只映射必要用于展示/后续查询的字段）
          this.order.id = orderData.id || orderData.orderId || orderData.order_id || this.order.id
          this.order.orderNo = orderData.orderNo || orderData.order_no || this.order.orderNo
          this.order.prescriptionId = orderData.prescriptionId || orderData.prescription_id || orderData.prescriptionNo || orderData.prescription_no || this.order.prescriptionId
          this.order.prescriptionNo = orderData.prescriptionNo || orderData.prescription_no || this.order.prescriptionNo
          this.order.diagnosis = orderData.diagnosis || this.order.diagnosis
          this.order.doctor = orderData.doctor || orderData.doctorName || this.order.doctor
          this.order.doctorName = orderData.doctorName || this.order.doctorName
          this.order.hospital = orderData.hospital || this.order.hospital
          this.order.amount = orderData.amount || this.order.amount
          this.order.statusText = orderData.statusText || this.order.statusText
          this.order.time = orderData.time || this.order.time

          // 如果获得了处方标识（可能是处方ID或咨询ID），尝试填充处方详情
          const presId = this.order.prescriptionId || this.order.prescriptionNo
          console.log('解析后 presId:', presId)
          if (presId) {
            await this.fillPrescriptionInfo(presId)
          } else {
            // 否则回退到本地加载
            await this.loadOrderFromStorage()
          }
        } catch (e) {
          console.warn('解析订单参数失败，回退到本地加载', e)
          await this.loadOrderFromStorage()
        }
      } else {
        // 如果没有订单ID也没有序列化订单对象，回退到旧的逻辑
        console.warn('未提供订单ID，使用本地数据')
        await this.loadOrderFromStorage()
      }
    },
    computed: {
      displayPrescriptionNo() {
        const value = this.order.prescriptionId ?? this.order.prescriptionNo
        if (value === null || value === undefined || value === '') {
          return '无'
        }
        return String(value)
      },
      infoList() {
        // 判断是否是传统疗法订单
        const isTherapyOrder = this.allCartItems && this.allCartItems.some(item => item.redeemVouchers && item.redeemVouchers.length > 0)
        const list = [
          // 优先展示 lnzy_prescription 表的 id（prescriptionId），回退到 prescriptionNo 文案
          { label: '处方单号', labelKey: 'prescriptionId', value: this.displayPrescriptionNo },
          { label: '订单号', labelKey: 'orderNo', value: this.order.orderNo },
          { label: '开方医生', labelKey: 'doctor', value: this.order.doctor },
          { label: '订单金额', labelKey: 'payableAmount', value: this.order.payableAmount ? Number(this.order.payableAmount).toFixed(2) : '' },
          { label: '支付时间', labelKey: 'payTime', value: this.order.payTime },
          { label: '运费', labelKey: 'shippingPaymentMethod', value: isTherapyOrder ? '无' : (this.order.shippingPaymentMethod || '到付，以实际为准') }
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
        return getImageUrl(this.order.doctorAvatar || '/liaoning_zongyi/zaixian_mingyi_logo.png')
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

      // 是否可以申请退货：订单状态为已完成（3）
      canApplyRefund() {
        return this.order.orderStatus === 3
      }
    },
    methods: {
      // 格式化日期时间为 YYYY-MM-DD HH:mm:ss
      formatDateTime(dateTimeStr) {
        if (!dateTimeStr) {
          return ''
        }
        
        try {
          // 如果已经是 YYYY-MM-DD HH:mm:ss 格式，直接返回
          if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateTimeStr)) {
            return dateTimeStr
          }
          
          let date
          
          // 如果是时间戳（数字）
          if (typeof dateTimeStr === 'number') {
            date = new Date(dateTimeStr)
          }
          // 如果是字符串
          else if (typeof dateTimeStr === 'string') {
            // 尝试解析为日期对象
            date = new Date(dateTimeStr)
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
          console.error('格式化日期时间失败:', e)
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
            // 判断是否是传统疗法：有 redeemVouchers 的走传统疗法详情页
            const hasRedeemVouchers = firstItem.redeemVouchers && firstItem.redeemVouchers.length > 0
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

      buildRedeemVouchers(item = {}, orderDetail = {}, itemIndex = 0) {
        const rawVouchers = item.redeemVouchers || item.redeem_vouchers || []
        if (Array.isArray(rawVouchers) && rawVouchers.length > 0) {
          return rawVouchers.map((voucher, index) => ({
            id: voucher.id,
            sequenceNo: voucher.sequenceNo || voucher.sequence_no || index + 1,
            redeemStatus: voucher.redeemStatus ?? voucher.redeem_status ?? 0,
            redeemTime: voucher.redeemTime || voucher.redeem_time || '',
            redeemedBy: voucher.redeemedBy || voucher.redeemed_by || '',
            redeemerName: voucher.redeemerName || voucher.redeemer_name || '',
            verifyToken: voucher.verifyToken || voucher.verify_token || '',
            verifyQrBase64: voucher.verifyQrBase64 || voucher.verify_qr_base64 || ''
          }))
        }

        const fallbackQr = orderDetail.verifyQrBase64 || orderDetail.verify_qr_base64 || ''
        const fallbackToken = orderDetail.verifyToken || orderDetail.verify_token || ''
        if (itemIndex === 0 && fallbackQr) {
          return [{
            id: 'order-level-voucher',
            sequenceNo: 1,
            redeemStatus: orderDetail.redeemStatus ?? orderDetail.redeem_status ?? 0,
            redeemTime: orderDetail.redeemTime || orderDetail.redeem_time || '',
            redeemedBy: orderDetail.redeemedBy || orderDetail.redeemed_by || '',
            redeemerName: orderDetail.redeemerName || orderDetail.redeemer_name || '',
            verifyToken: fallbackToken,
            verifyQrBase64: fallbackQr
          }]
        }

        return []
      },

      formatRedeemStatus(voucher = {}) {
        return Number(voucher.redeemStatus) === 1 ? '已核销' : '待核销'
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

      isNumericId(value) {
        return this.isUsableId(value) && /^\d+$/.test(String(value).trim())
      },

      resolvePrescriptionNavigationParams() {
        if (this.isNumericId(this.order.prescriptionId)) {
          return `prescriptionNo=${encodeURIComponent(this.order.prescriptionId)}`
        }
        if (this.isNumericId(this.order.prescriptionNo)) {
          return `prescriptionNo=${encodeURIComponent(this.order.prescriptionNo)}`
        }
        if (this.isUsableId(this.order.id)) {
          return `orderId=${encodeURIComponent(this.order.id)}`
        }
        return ''
      },

      // 从API加载订单详情
      async loadOrderDetail(orderId) {
        try {
          uni.showLoading({ title: '加载中...' })

          const orderDetail = await getOrderDetail(orderId, { showLoading: false })
          console.log('订单详情:', orderDetail)
          // 调试日志：打印 items 的原始结构与每个字段，便于定位 quantity 问题
          try {
            console.log('orderDetail.items raw:', orderDetail.items)
            if (orderDetail.items && orderDetail.items.length > 0) {
              orderDetail.items.forEach((it, idx) => {
                try {
                  console.log(`orderDetail.items[${idx}] keys:`, Object.keys(it), 'values:', it)
                } catch (e) {
                  console.log(`orderDetail.items[${idx}]`, it)
                }
              })
            } else {
              console.log('orderDetail.items is empty or undefined')
            }
          } catch (logErr) {
            console.warn('打印 orderDetail.items 调试信息失败', logErr)
          }

          if (orderDetail) {
            // 设置订单基本信息
            this.order.id = orderDetail.id || orderId || this.order.id
            this.order.amount = orderDetail.payableAmount || orderDetail.totalAmount || orderDetail.amount || '0.00'
            this.order.payableAmount = orderDetail.payableAmount || this.order.amount
            this.order.payTime = orderDetail.payTime || orderDetail.pay_time || ''
            this.order.orderStatus = orderDetail.orderStatus
            // 检查是否是制剂订单（有待核销券），待发货改为待核销
            const hasRedeemVouchers = (orderDetail.items && orderDetail.items.some(item => (item.redeemVouchers && item.redeemVouchers.length > 0) || (item.redeem_vouchers && item.redeem_vouchers.length > 0)))
            this.order.statusText = this.getStatusText(orderDetail.orderStatus, hasRedeemVouchers)
            this.order.time = this.formatDateTime(orderDetail.createdAt || orderDetail.createTime)
            this.order.orderNo = orderDetail.orderNo || orderDetail.order_no || this.order.orderNo
            // 物流/运费（到付）信息
            this.order.shippingPaymentMethod = orderDetail.shippingPaymentMethod || '到付，以实际为准'
            this.order.routeStatusDesc = orderDetail.routeStatusDesc || ''
            this.order.logisticsNo = orderDetail.logisticsNo || ''

            // 设置处方信息
            const prescriptionId = orderDetail.prescriptionId || orderDetail.prescription_id
            const prescriptionNo = orderDetail.prescriptionNo || orderDetail.prescription_no
            if (prescriptionId) {
              this.order.prescriptionId = prescriptionId
              this.order.prescriptionNo = prescriptionNo || String(prescriptionId)
            }
            if (prescriptionNo) {
              this.order.prescriptionNo = prescriptionNo
            }

            // 如果订单中包含 doctorId（直接来自订单或处方），优先从医生表获取头像/职称等信息
            if (orderDetail.doctorId) {
              this.order.doctorId = orderDetail.doctorId
              try {
                const doctorFromOrder = await getDoctorDetail(orderDetail.doctorId)
                if (doctorFromOrder) {
                  this.order.doctorTitle = doctorFromOrder.title || this.order.doctorTitle
                  this.order.doctorAvatar = doctorFromOrder.avatarUrl || this.order.doctorAvatar
                  this.order.hospital = doctorFromOrder.hospitalName || this.order.hospital
                  this.order.department = doctorFromOrder.department || this.order.department
                  this.order.doctorName = doctorFromOrder.name || this.order.doctorName
                  this.order.doctor = this.order.doctorName
                }
              } catch (e) {
                console.warn('从订单 doctorId 获取医生信息失败', e)
              }
            }

            // 设置商品列表
            if (orderDetail.items && orderDetail.items.length > 0) {
              
              this.allCartItems = orderDetail.items.map((item, index) => ({
                id: item.productId || item.product_id || item.goodsId || item.goods_id || item.id,
                name: item.productName || item.product_name || item.name,
                price: parseFloat(item.price || 0),
                // 兼容不同后端字段命名并确保为数值
                quantity: (function () {
                  const q = item.quantity || item.qty || item.count || item.number || 0
                  const n = Number(String(q).replace(/[^\d.-]/g, ''))
                  return !isNaN(n) && n > 0 ? n : 1
                })(),
                image: getImageUrl(item.productImage || item.product_image || item.coverImage || item.cover_image || item.image || ''),
                redeemVouchers: this.buildRedeemVouchers(item, orderDetail, index)
              }))
              console.log('从订单设置 allCartItems:', this.allCartItems)
            }

            await this.enrichDiagnosisFromAllProducts()
            if (this.order.prescriptionId) {
              await this.applyDoctorFromPrescription(this.order.prescriptionId)
            }
            const productId = (this.allCartItems[0] && this.allCartItems[0].id) || null
            if (productId) {
              await this.enrichByProduct(productId)
            }
            if (this.order.prescriptionId) {
              await this.fillPrescriptionInfo(this.order.prescriptionId)
            }
          }

          uni.hideLoading()
        } catch (error) {
          console.error('加载订单详情失败:', error)
          uni.hideLoading()

          // API失败时回退到本地数据
          console.warn('API加载失败，使用本地数据')
          await this.loadOrderFromStorage()
        }
      },

      // 从本地存储加载订单数据（回退方案）
      async loadOrderFromStorage() {
        // 加载购物车商品并补全医生/处方信息
        await this.loadCartFromStorage().then(async () => {
          // 从所有商品中收集诊断信息
          await this.enrichDiagnosisFromAllProducts()
          const productId = (this.allCartItems[0] && this.allCartItems[0].id) || null
          if (productId) {
            await this.enrichByProduct(productId)
          } else {
            console.warn('未找到商品ID，跳过商品/医生信息补全')
          }
          const prescriptionId = this.$options?.data?.order?.prescriptionId || null
          if (prescriptionId) {
            console.log(prescriptionId,'prescriptionId');
            
            await this.fillPrescriptionInfo(prescriptionId)
          }
        })
      },

      // 从 storage 读取购物车商品并补全基本信息
      async loadCartFromStorage() {
        try {
          const verifiedProducts = uni.getStorageSync('verifiedProducts') || {}
          const productQuantities = uni.getStorageSync('productQuantities') || {}
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
                  quantity: productQuantities[id] || 1,
                  image: getImageUrl(detail.coverImage || detail.image || '')
                })
              }
            } catch (e) {
              console.warn('获取商品详情失败:', id, e)
            }
          }
          this.allCartItems = items
        } catch (e) {
          console.error('加载购物车失败:', e)
          this.allCartItems = []
        }
      },

      // 从所有商品中收集诊断信息（用逗号拼接）
      async enrichDiagnosisFromAllProducts() {
        if (!this.allCartItems || this.allCartItems.length === 0) {
          return
        }

        try {
          const diagnoses = []
          const productIds = this.allCartItems.map(item => item.id).filter(Boolean)
          
          console.log('enrichDiagnosisFromAllProducts productIds:', productIds)
          // 遍历所有商品，获取每个商品的 prescription_diagnosis（兼容 snake_case/camelCase）
          for (const productId of productIds) {
            try {
              const product = await getProductDetail(productId)
              if (product) {
                const pd = product.prescription_diagnosis || product.prescriptionDiagnosis || product.prescription_diagnosis
                if (pd) {
                // 去重，避免重复的诊断信息
                  if (!diagnoses.includes(pd)) {
                    diagnoses.push(pd)
                  }
                }
              }
            } catch (e) {
              console.warn(`获取商品${productId}的诊断信息失败:`, e)
            }
          }

          // 用逗号拼接所有诊断信息
          if (diagnoses.length > 0) {
            const joined = diagnoses.join('，')
            this.order.diagnosis = joined
            this.order.prescriptionDiagnosis = joined
            console.log('收集到的诊断信息:', diagnoses, 'joined:', joined)
          }
        } catch (e) {
          console.error('收集商品诊断信息失败:', e)
        }
      },

      // 基于首件商品补全医生/诊断信息
      async enrichByProduct(productId) {
        try {
          uni.showLoading({ title: '加载中...' })
          const product = await getProductDetail(productId)
          if (product) {
            // 诊断信息已通过 enrichDiagnosisFromAllProducts 处理，这里不再覆盖
            if (!this.order.doctorName) {
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
              const doctor = await getDoctorDetail(this.order.doctorId)
              if (doctor) {
                this.order.doctorName = doctor.name || this.order.doctorName
                this.order.doctor = doctor.name || this.order.doctor
                // 使用医生表的头像/职称等信息补全（参考 consultation_detail.vue）
                this.order.doctorTitle = doctor.title || this.order.doctorTitle
                this.order.doctorAvatar = doctor.avatarUrl || this.order.doctorAvatar
                this.order.hospital = doctor.hospitalName || this.order.hospital
                console.log('enrichByProduct fetched doctor:', doctor)
              }
            } catch (e) {
              console.warn('获取医生信息失败', e)
            }
          }
        } catch (e) {
          console.error('补全商品/医生信息失败:', e)
        } finally {
          uni.hideLoading()
        }
      },

      // 根据咨询ID获取 created_at 作为开具时间
      async fillPrescriptionInfo(prescriptionId) {
        if (!prescriptionId) return
        try {
          // 处理 ID 语义混淆：传入的 id 可能是 consultationId，也可能是 lnzy_prescription.id
          let consultationDetail = null

          // 1) 先尝试把传入 id 当作 consultationId 去读取咨询详情
          try {
            consultationDetail = await getConsultationDetail(prescriptionId)
            console.log('fillPrescriptionInfo: treated id as consultationId, fetched consultation:', consultationDetail)
          } catch (consultErr) {
            console.log('fillPrescriptionInfo: treating id as consultationId failed, will try as prescriptionId', consultErr && consultErr.message)
          }

          // 2) 如果没有拿到 consultationDetail，再把 id 当作处方表 id 去读取处方详情，获得 consultationId 后再读咨询详情
          if (!consultationDetail) {
            try {
              const pres = await getPrescriptionDetail(prescriptionId)
              console.log('fillPrescriptionInfo: treated id as prescriptionId, fetched prescription:', pres)
              if (pres) {
                // 记录处方表 id 到页面状态（用于后续跳转等）
                this.order.prescriptionId = pres.id || this.order.prescriptionId
                // 尝试从处方记录中取 consultation id 字段（兼容命名）
                const consultId = pres.consultationId || pres.consultation_id || pres.consultation || null
                if (consultId) {
                  try {
                    consultationDetail = await getConsultationDetail(consultId)
                    console.log('fillPrescriptionInfo: fetched consultation by prescription.consultationId:', consultationDetail)
                  } catch (e) {
                    console.warn('fillPrescriptionInfo: failed to fetch consultation by prescription.consultationId', e)
                  }
                }
              }
            } catch (presErr) {
              console.warn('fillPrescriptionInfo: getPrescriptionDetail failed', presErr)
            }
          }

          // 如果仍然没有 consultationDetail，则直接返回（无进一步信息可补）
          if (!consultationDetail) {
            console.warn('fillPrescriptionInfo: no consultation detail available for id:', prescriptionId)
            return
          }

          const detail = consultationDetail
          console.log('fillPrescriptionInfo - consultation detail fetched:', detail)

            // 设置咨询时间（如果还没有设置）
            if (!this.order.time && detail.createdAt) {
              this.order.time = this.formatDateTime(detail.createdAt)
            }
            // 设置处方单号（用于显示）
            if (detail.consultationNo && !this.order.prescriptionNo) {
              this.order.prescriptionNo = detail.consultationNo
            }
          // 根据 consultation 详情，查询 lnzy_prescription 表以获取对应处方记录的 id
          // 优先使用后端提供的通过 consultationId 获取处方接口
          try {
            const prescriptionRecord = await getPrescriptionByConsultation(detail.id)
            console.log('getPrescriptionByConsultation result:', prescriptionRecord)
            if (prescriptionRecord && prescriptionRecord.id) {
              // 将 lnzy_prescription 表的 id 作为页面使用的处方ID（用于跳转到处方详情）
              this.order.prescriptionId = prescriptionRecord.id
              this.order.prescriptionNo = String(prescriptionRecord.id)
              console.log('设置 order.prescriptionId 为 lnzy_prescription.id:', this.order.prescriptionId)

              // 进一步获取 lnzy_prescription 表的详细记录，优先使用处方表的 diagnosis 作为临床诊断
              try {
                const presDetail = await getPrescriptionDetail(this.order.prescriptionId)
                console.log('lnzy_prescription detail:', presDetail)
                if (presDetail && presDetail.diagnosis) {
                  this.order.diagnosis = presDetail.diagnosis
                  this.order.prescriptionDiagnosis = presDetail.diagnosis
                  console.log('使用处方表 diagnosis 填充 order.diagnosis:', presDetail.diagnosis)
                }
              } catch (presErr) {
                console.warn('获取 lnzy_prescription 详情失败，继续使用 consultation.diagnosis 回退', presErr)
              }
            }
          } catch (e) {
            console.warn('通过 consultationId 查询处方记录失败，无法获取 lnzy_prescription.id', e)
          }
            // 设置诊断信息（优先使用从商品中收集的诊断信息，如果没有则使用咨询详情中的）
            if (detail.diagnosis && !this.order.diagnosis) {
              this.order.diagnosis = detail.diagnosis
            }
            // 设置医生信息
            if (detail.doctorName) {
              this.order.doctor = detail.doctorName
              this.order.doctorName = detail.doctorName
            }
            // 暂时使用默认医生头像，不从API获取
            // this.order.doctorAvatar = detail.doctorAvatar || this.order.doctorAvatar
            // 设置医院信息
            if (detail.hospitalName) {
              this.order.hospital = detail.hospitalName
            }
            // 设置科室信息
            if (detail.department) {
              this.order.department = detail.department
            }
            // 如果处方/咨询详情中带有 doctorId，则从医生表补全医生头衔/头像等信息（参考 consultation_detail.vue）
            if (detail.doctorId) {
              this.order.doctorId = detail.doctorId
              try {
                const doctor = await getDoctorDetail(detail.doctorId)
                if (doctor) {
                  this.order.doctorTitle = doctor.title || this.order.doctorTitle
                  this.order.doctorAvatar = doctor.avatarUrl || this.order.doctorAvatar
                  this.order.hospital = doctor.hospitalName || this.order.hospital
                  this.order.department = doctor.department || this.order.department
                  this.order.doctorName = doctor.name || this.order.doctorName
                  this.order.doctor = this.order.doctorName
                }
              } catch (e) {
                console.warn('获取医生信息失败', e)
            }
          }
        } catch (e) {
          console.warn('查询处方/咨询相关信息失败', e)
        }
      },
      
      async applyDoctorFromPrescription(prescriptionId) {
        if (!prescriptionId) {
          return
        }
        try {
          const prescription = await getPrescriptionDetail(prescriptionId)
          if (!prescription) {
            return
          }
          const doctorId = prescription.doctorId || prescription.doctor_id
          if (doctorId) {
            const doctor = await getDoctorDetail(doctorId)
            if (doctor) {
              this.order.doctorId = doctorId
              this.order.doctorName = doctor.name || this.order.doctorName
              this.order.doctor = doctor.name || this.order.doctor
              this.order.doctorTitle = doctor.title || this.order.doctorTitle
              this.order.doctorAvatar = doctor.avatarUrl || this.order.doctorAvatar
              this.order.hospital = doctor.hospitalName || this.order.hospital
              this.order.department = doctor.department || this.order.department
              return
            }
          }
          const consultationId = prescription.consultationId || prescription.consultation_id
          if (consultationId) {
            const consultation = await getConsultationDetail(consultationId)
            const displayName = resolveConsultationDoctorName(consultation)
            if (displayName) {
              this.order.doctorName = displayName
              this.order.doctor = displayName
            }
          }
        } catch (e) {
          console.warn('从处方补全医师信息失败', e)
        }
      },

      getStatusText(status, hasRedeemVouchers = false) {
        // 如果是制剂订单且是待发货状态，显示待核销
        if (hasRedeemVouchers && status === 1) {
          return '待核销'
        }
        const statusMap = {
          0: '待支付',
          1: '待发货',
          2: '待收货',
          3: '已完成',
          4: '已取消'
        }
        return statusMap[status] || '未知状态'
      },
      
      handleView() {
        const query = this.resolvePrescriptionNavigationParams()
        if (!query) {
          uni.showToast({
            title: '暂无关联处方或订单',
            icon: 'none'
          })
          return
        }

        console.log('跳转到处方详情，query:', query)
        uni.navigateTo({
          url: `/pages/prescription/detail?${query}`
        })
      },
      
      // 加载购物车数据
      loadCartItems() {
        this.allCartItems = []
        console.log('loadCartItems is not used on this page')
      },



      // 申请退货
      async applyRefund() {
        try {
          logButtonClick('申请退货', 'ORDER_DETAIL', this.order.prescriptionId?.toString())

          // 检查是否可以申请退货
          const checkResult = await checkCanApplyRefund(this.order.prescriptionId)
          if (!checkResult) {
            uni.showToast({
              title: '该订单不符合退货条件',
              icon: 'none'
            })
            return
          }

          // 跳转到退货申请页面
          uni.navigateTo({
            url: `/pages/order/refund_apply?orderId=${this.order.prescriptionId}`
          })

        } catch (error) {
          console.error('检查退货条件失败:', error)
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
  }
  
  .info-value {
    font-size: 28rpx;
    color: #333333;
    flex: 1;
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
    margin: 0 32rpx;
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
  
  .medicine-price {
    color: #e64340;
    font-size: 26rpx;
    font-weight: 600;
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
