<template>
  <view class="page">
    <!-- 椤堕儴钃濊壊鐘舵€佹潯 -->
    <view class="top-header">
      <view class="status-main">
        {{ statusMainText }}
      </view>
      <view class="status-sub">
        {{ statusSubText }}
      </view>
    </view>

    <!-- 鐧借壊鍐呭鍗＄墖锛堣鐩栧湪钃濊壊鍧椾笂锛?-->
    <view class="card-wrapper">
      <view class="card">
        <!-- 鏍囬 -->
        <view class="card-title">
          澶勬柟鍗曡鎯?
        </view>

        <!-- 闂ㄨ瘖鍙?-->
        <!--        <view class="field-row">
          <text class="field-label">闂ㄨ瘖鍙凤細</text>
          <text class="field-value">{{ detail.visitNo }}</text>
        </view>-->

        <!-- 鍩烘湰淇℃伅涓ゅ垪甯冨眬 -->
        <view class="info-grid">
          <view class="info-col">
            <text class="info-label">
              濮撳悕锛?
            </text>
            <text class="info-value">
              {{ detail.name }}
            </text>
          </view>
          <view class="info-col">
            <text class="info-label">
              鎬у埆锛?
            </text>
            <text class="info-value">
              {{ detail.gender }}
            </text>
          </view>

          <view class="info-col">
            <text class="info-label">
              骞撮緞锛?
            </text>
            <text class="info-value">
              {{ detail.age }}宀?
            </text>
          </view>
          <!--          <view class="info-col">
            <text class="info-label">涓村簥璇婃柇锛?/text>
            <text class="info-value">{{ detail.diagnosis }}</text>
          </view>

          <view class="info-col">
            <text class="info-label">绉戝锛?/text>
            <text class="info-value">{{ detail.department }}</text>
          </view>-->
          <view class="info-col">
            <text class="info-label">
              寮€鏂瑰尰甯堬細
            </text>
            <text class="info-value">
              {{ detail.doctorName || '鈥? }}
            </text>
          </view>
          <view class="info-col">
            <text class="info-label">
              寮€鏂规棩鏈燂細
            </text>
            <text class="info-value">
              {{ formatNullableDate(detail.date) }}
            </text>
          </view>
        </view>

        <view class="dash-line big-space" />

        <!-- Rp 鍖哄煙 -->
        <view class="rp-block">
          <view class="card-title">
            鏄庣粏
          </view>
          <view class="rp-content">
            <!-- 鏄剧ず澶勬柟鑽搧鍒楄〃 -->
            <view
              v-if="detail.prescriptionItems && detail.prescriptionItems.length > 0"
              class="rp-items"
            >
              <view
                v-for="item in detail.prescriptionItems"
                :key="item.id"
                class="rp-item"
              >
                <view class="rp-item-main">
                  <text class="rp-drug-name">
                    {{ item.drugName }}
                  </text>
                  <text class="rp-dosage">
                    {{ item.dosage }}
                  </text>
                  <text
                    v-if="item.frequency"
                    class="rp-frequency"
                  >
                    {{ item.frequency }}
                  </text>
                  <text
                    v-if="item.days"
                    class="rp-days"
                  >
                    {{ item.days }}澶?
                  </text>
                </view>
                <!-- 浣跨敤/鐢ㄩ噺璇存槑锛堟潵鑷?lnzy_product.usage_desc锛?-->
                <view
                  v-if="item.usageDesc"
                  class="rp-usage-desc"
                >
                  <text class="usage-label">
                    鐢ㄦ硶鐢ㄩ噺璇存槑锛?
                  </text>
                  <text class="usage-text">
                    {{ item.usageDesc }}
                  </text>
                </view>
              </view>
            </view>
            <!-- 濡傛灉娌℃湁鑽搧鍒楄〃锛屾樉绀哄鏂瑰悕绉?-->
            <view
              v-else
              class="rp-name-fallback"
            >
              <text class="rp-name">
                {{ detail.formulaName }}
              </text>
            </view>
          </view>
          <view class="dash-line big-space" />


          <!-- 绛惧悕鍖哄煙锛氭樉绀轰笌澶勬柟鐩稿叧鐨勫尰鐢熴€佽嵂甯堢鍚嶏紙鑻ユ湁澶氫釜锛屼細鍚勮嚜鍒楀嚭锛?->
          <view class="sign-row">
            <view
              v-if="Object.keys(detail.associatedDoctors || {}).length > 0"
              class="sign-list"
            >
              <view class="card-title">
                鍖荤敓绛惧悕
              </view>
              <view class="sign-columns" />
            </view>
          </view>



          <!-- 绛惧悕鍖哄煙 -->
          <view class="sign-row">
            <view class="sign-item">
              <text class="sign-label">
                鍖诲笀绛惧悕锛?
              </text>
              <image
                class="sign-image"
                :src="detail.doctorSignatureUrl || getImageUrl('/profile/liaoning_zongyi/zhongyi_qianming.png')"
                mode="heightFix"
              />
            </view>
            <view class="sign-item">
              <text class="sign-label">
                鑽笀绛惧悕锛?
              </text>
              <image
                class="sign-image"
                :src="detail.pharmacistSignatureUrl || getImageUrl('/profile/liaoning_zongyi/zhongyi_qianming.png')"
                mode="heightFix"
              />
            </view>
          </view>
        </view>
      </view>

      <!-- 搴曢儴鎸夐挳 -->
    </view>
    <view
      v-if="orderStatus.status === 0"
      class="bottom-bar"
    >
      <button
        class="bottom-btn"
        @tap="goBuy"
      >
        鍘昏喘鑽?
      </button>
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
import { getOrderByPrescriptionId, getMyOrders, getOrderDetail } from '@/api/order.js'
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
        department: '渚挎嵎閰嶈嵂闂ㄨ瘖',
        date: '',
        formulaName: '',
        packCount: 1,
        usage: '',
        doctorName: '',
        pharmacistName: '',
        productPrice: 0,
        prescriptionItems: [], // 澶勬柟鑽搧鍒楄〃
        // 绛惧悕涓庡叧鑱斿尰鐢?鑽笀淇℃伅锛堟寜 id 鏄犲皠锛?
        associatedDoctors: {}, // { [doctorId]: { name, signatureUrl, title, hospital } }
        associatedPharmacists: {}, // { [pharmacistId]: { name, signatureUrl, title, hospital } }
        doctorId: null,
        doctorSignatureUrl: '' // 鍖诲笀绛惧悕鍥剧墖
      },
      // 璁㈠崟鐘舵€佺浉鍏充俊鎭?
      orderStatus: {
        status: 0, // 璁㈠崟鐘舵€侊細0寰呮敮浠橈紝1寰呭彂璐э紝2寰呮敹璐э紝3宸插畬鎴愶紝4宸插彇娑?
        orderNo: '', // 璁㈠崟鍙?
        logisticsNo: '', // 蹇€掑崟鍙?
        logisticsCompany: '' // 蹇€掑叕鍙?
      },
      // 淇濆瓨椤甸潰鍙傛暟锛岀敤浜庤鍗曟煡璇?
      pageOptions: {
        prescriptionNo: null, // 淇濆瓨鍘熷鐨?prescriptionNo 鍙傛暟
        orderId: null
      }
    }
  },
  computed: {
    // 鏍规嵁璁㈠崟鐘舵€佽绠楁樉绀虹殑鏂囨湰
    statusMainText() {
      const statusMap = {
        0: '寰呮敮浠?,
        1: '宸叉敮浠?,
        2: '閰嶉€佷腑',
        3: '宸插畬鎴?,
        4: '宸插彇娑?
      }
      return statusMap[this.orderStatus.status] || '寰呬笅鍗?
    },
    statusSubText() {
      switch (this.orderStatus.status) {
        case 0:
          return '绛夊緟涓嬪崟鏀粯'
        case 1:
          return '璁㈠崟鍑嗗涓?
        case 2:
          if (this.orderStatus.logisticsNo) {
            return `${this.orderStatus.logisticsCompany || '蹇€?}鍗曞彿锛?{this.orderStatus.logisticsNo}`
          }
          return '璁㈠崟閰嶉€佷腑'
        case 3:
          return '璁㈠崟宸插畬鎴?
        case 4:
          return '璁㈠崟宸插彇娑?
        default:
          return '绛夊緟涓嬪崟鏀粯'
      }
    }
  },
  async onLoad(options) {
    this.pageOptions.prescriptionNo = this.isValidPrescriptionId(options.prescriptionNo) ? options.prescriptionNo : null
    this.pageOptions.orderId = this.isUsableId(options.orderId) ? options.orderId : null
    this.loadUserInfo()

    if (this.pageOptions.prescriptionNo) {
      await this.loadPrescriptionById(this.pageOptions.prescriptionNo)
    } else if (this.pageOptions.orderId) {
      await this.loadOrderFromOrderId(this.pageOptions.orderId)
    }

    // 鎺ユ敹澶勬柟鏁版嵁鍙傛暟锛堜笌澶嶈瘖璇︽儏椤典繚鎸佷竴鑷达級
    if (options.prescription) {
      try {
        const prescriptionData = JSON.parse(decodeURIComponent(options.prescription))
        console.log('鎺ユ敹鍒扮殑澶勬柟鏁版嵁:', prescriptionData)

        // 鏇存柊澶勬柟淇℃伅
        this.detail.visitNo = prescriptionData.id || prescriptionData.visitNo || this.detail.visitNo
        this.detail.formulaName = prescriptionData.details || prescriptionData.medicineName || prescriptionData.formulaName || prescriptionData.name || this.detail.formulaName
        this.detail.packCount = prescriptionData.doses || prescriptionData.quantity || prescriptionData.packCount || this.detail.packCount
        this.detail.productPrice = prescriptionData.productPrice || this.detail.productPrice
        this.detail.name = prescriptionData.patientName || prescriptionData.name || this.detail.name
        // 娉ㄦ剰锛氭€у埆鍜屽勾榫勪紭鍏堜粠韬唤璇佸彿璇嗗埆锛屽彧鏈夊湪娌℃湁韬唤璇佸彿鏃舵墠浣跨敤鍙傛暟涓殑鍊?
        // 杩欓噷鍏堣缃弬鏁颁腑鐨勫€硷紝浣嗗悗闈細浠庤韩浠借瘉鍙烽噸鏂拌瘑鍒紙濡傛灉鏈夎韩浠借瘉鍙凤級
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

            // 濡傛灉浼犲叆鏁版嵁涓寘鍚尰鐢烮D锛屽皾璇曠敤鍖荤敓琛ㄧ殑 outpatient_no 瑕嗙洊 visitNo
            await (async () => {
              try {
                const doctorId = prescriptionData.doctorId || prescriptionData.doctor_id || prescriptionData.doctor || null
                if (doctorId) {
                  const doc = await getDoctorDetail(doctorId)
                  if (doc) {
                    this.detail.visitNo = doc.outpatientNo || doc.outpatient_no || this.detail.visitNo
                    console.log('浠庡尰鐢熻〃鑾峰彇闂ㄨ瘖鍙峰苟璁剧疆 visitNo:', this.detail.visitNo)
                  }
                }
              } catch (e) {
                console.warn('閫氳繃 doctorId 鑾峰彇鍖荤敓闂ㄨ瘖鍙峰け璐?, e)
              }
            })()
      } catch (e) {
        console.error('瑙ｆ瀽澶勬柟鏁版嵁澶辫触:', e)
      }
    }

    // 纭繚鎬у埆鍜屽勾榫勪紭鍏堜粠韬唤璇佸彿璇嗗埆锛堝鏋滄湁韬唤璇佸彿锛?
    // 杩欐牱鍙互瑕嗙洊 URL 鍙傛暟涓殑鎬у埆鍜屽勾榫勶紝纭繚韬唤璇佸彿鐨勪俊鎭紭鍏堢骇鏈€楂?
    this.ensureGenderAndAgeFromIdCard()

    await this.loadOrderStatus()

    logPageView('澶勬柟璇︽儏', '鐢ㄦ埛杩涘叆澶勬柟璇︽儏椤甸潰')
  },
  methods: {
    // 鍥剧墖URL澶勭悊鍑芥暟
    getImageUrl,

    isUsableId(value) {
      if (value === null || value === undefined) {
        return false
      }
      const text = String(value).trim()
      return text !== '' && text !== 'null' && text !== 'undefined'
    },

    isValidPrescriptionId(value) {
      return this.isUsableId(value) && /^\d+$/.test(String(value).trim())
    },

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
          console.warn('浠庡鏂?doctorId 鑾峰彇鍖诲笀澶辫触', e)
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
          console.warn('浠庡挩璇㈣褰曡ˉ鍏ㄥ尰甯堜俊鎭け璐?, e)
        }
      }
    },

    // 浠庤鍗曚俊鎭洿鏂板鏂硅鎯?
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

      // 鏇存柊澶勬柟ID锛堝鏋滆繕娌℃湁璁剧疆锛?
      if (!this.detail.visitNo && orderInfo.prescriptionId) {
        this.detail.visitNo = orderInfo.prescriptionId.toString()
      }

      // 浠庤鍗曞晢鍝佸垪琛ㄦ瀯寤哄鏂硅嵂鍝佸垪琛?
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

        // 浣跨敤绗竴涓晢鍝佺殑淇℃伅浣滀负涓昏鍟嗗搧淇℃伅
        const firstItem = orderInfo.items[0]
        this.detail.formulaName = firstItem.productName || this.detail.formulaName
        this.detail.productPrice = firstItem.price || this.detail.productPrice
        this.detail.packCount = firstItem.quantity || this.detail.packCount
      }

      // 璁剧疆鍖荤敓ID锛堝鏋滄湁鐨勮瘽锛?
      if (orderInfo.doctorId) {
        this.detail.doctorId = orderInfo.doctorId
      }
    },

    // 鑾峰彇璁㈠崟鐘舵€佷俊鎭?
    async loadOrderStatus() {
      try {
        // 棣栧厛灏濊瘯浠庡瓨鍌ㄧ殑璁㈠崟淇℃伅涓幏鍙栵紙澶勭悊姝ｅ湪鍒涘缓鐨勮鍗曪級
        const currentOrder = uni.getStorageSync(STORAGE_KEY_CURRENT_ORDER)
        if (currentOrder && currentOrder.prescriptions && currentOrder.prescriptions.includes(this.detail.visitNo)) {
          // 濡傛灉褰撳墠璁㈠崟鍖呭惈姝ら棬璇婂彿锛岃鏄庤繖鏄竴涓鍦ㄥ鐞嗙殑璁㈠崟
          this.orderStatus.status = 0 // 寰呮敮浠?
          this.orderStatus.orderNo = currentOrder.orderNo || ''
          console.log('浠庢湰鍦板瓨鍌ㄨ幏鍙栬鍗曠姸鎬侊紙寰呮敮浠橈級:', this.orderStatus)
          return
        }

        // 閫氳繃澶勬柟ID鏌ヨ璁㈠崟淇℃伅
        // 浼樺厛浣跨敤鍘熷鐨?prescriptionNo 鍙傛暟锛屽叾娆′娇鐢?detail.visitNo
        const prescriptionId = this.pageOptions.prescriptionNo || (this.isValidPrescriptionId(this.detail.visitNo) ? this.detail.visitNo : null)
        if (!this.isValidPrescriptionId(prescriptionId)) {
          console.log('澶勬柟璇︽儏鏃犳湁鏁堝鏂笽D锛岃烦杩囨寜澶勬柟鏌ヨ璁㈠崟')
          return
        }
        console.log('鏌ヨ璁㈠崟浣跨敤鐨勫鏂笽D:', prescriptionId)
        const orderInfo = await getOrderByPrescriptionId(prescriptionId)

        if (orderInfo && orderInfo.id) {
          // 鏇存柊璁㈠崟鐘舵€佷俊鎭?
          this.orderStatus.status = orderInfo.orderStatus !== null && orderInfo.orderStatus !== undefined
            ? orderInfo.orderStatus
            : (orderInfo.status || 0)
          this.orderStatus.orderNo = orderInfo.orderNo || orderInfo.id || ''

          // 濡傛灉鏄厤閫佷腑鐘舵€侊紝灏濊瘯鑾峰彇鐗╂祦淇℃伅
          if (this.orderStatus.status === 2 && orderInfo.logisticsNo) {
            this.orderStatus.logisticsNo = orderInfo.logisticsNo
            this.orderStatus.logisticsCompany = orderInfo.logisticsCompany || '椤轰赴蹇€?
          }

          this.updateDetailFromOrder(orderInfo)
          if (!this.detail.doctorName && orderInfo.doctorId) {
            await this.applyDoctorFromPrescription({ doctorId: orderInfo.doctorId })
          }

          console.log('閫氳繃澶勬柟ID鏌ヨ鍒拌鍗曠姸鎬?', this.orderStatus)
          console.log('浠庤鍗曟洿鏂板鏂硅鎯?', this.detail)
        } else {
          console.log('鏈壘鍒板搴旂殑璁㈠崟淇℃伅锛屼繚鎸侀粯璁ょ姸鎬?)
        }
      } catch (error) {
        console.error('鑾峰彇璁㈠崟鐘舵€佸け璐?', error)
        // 濡傛灉API鏌ヨ澶辫触锛屽皾璇曞鐢ㄦ柟妗堬細浠庤鍗曞垪琛ㄤ腑鏌ユ壘
        try {
          const orders = await getMyOrders()

          if (orders && orders.length > 0) {
            // 鏌ユ壘鍖呭惈姝ら棬璇婂彿鐨勮鍗?
            const prescriptionId = this.pageOptions.prescriptionNo || (this.isValidPrescriptionId(this.detail.visitNo) ? this.detail.visitNo : null)
            if (!this.isValidPrescriptionId(prescriptionId)) {
              return
            }
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

              // 濡傛灉鏄厤閫佷腑鐘舵€侊紝灏濊瘯鑾峰彇鐗╂祦淇℃伅
              if (this.orderStatus.status === 2 && relatedOrder.logisticsNo) {
                this.orderStatus.logisticsNo = relatedOrder.logisticsNo
                this.orderStatus.logisticsCompany = relatedOrder.logisticsCompany || '椤轰赴蹇€?
              }

              // 浠庤鍗曚俊鎭洿鏂板鏂硅鎯?
              this.updateDetailFromOrder(relatedOrder)

              console.log('澶囩敤鏂规锛氫粠璁㈠崟鍒楄〃涓壘鍒拌鍗曠姸鎬?', this.orderStatus)
              console.log('浠庤鍗曟洿鏂板鏂硅鎯?', this.detail)
            }
          }
        } catch (backupError) {
          console.error('澶囩敤鏂规涔熷け璐?', backupError)
          // 鍑洪敊鏃朵繚鎸侀粯璁ょ姸鎬?
        }
      }
    },

    // 浠庤韩浠借瘉鍙疯绠楀勾榫?
    calculateAgeFromIdCard(idCard) {
      if (!idCard || idCard.length < 15) {
        return 0
      }

      let birthDateStr = ''
      // 18浣嶈韩浠借瘉锛氱7-14浣嶄负鍑虹敓鏃ユ湡 YYYYMMDD
      if (idCard.length === 18) {
        birthDateStr = idCard.substring(6, 14)
      }
      // 15浣嶈韩浠借瘉锛氱7-12浣嶄负鍑虹敓鏃ユ湡 YYMMDD锛屽勾浠藉墠涓や綅闇€瑕佸垽鏂?
      else if (idCard.length === 15) {
        const year = idCard.substring(6, 8)
        const month = idCard.substring(8, 10)
        const day = idCard.substring(10, 12)
        // 绠€鍗曞垽鏂細濡傛灉骞翠唤澶т簬褰撳墠骞翠唤鍚庝袱浣嶏紝鍒欒涓烘槸19xx骞达紝鍚﹀垯鏄?0xx骞?
        const currentYear = new Date().getFullYear() % 100
        const birthYear = parseInt(year) > currentYear ? `19${year}` : `20${year}`
        birthDateStr = `${birthYear}${month}${day}`
      } else {
        return 0
      }

      // 瑙ｆ瀽鍑虹敓鏃ユ湡
      const birthYear = parseInt(birthDateStr.substring(0, 4))
      const birthMonth = parseInt(birthDateStr.substring(4, 6))
      const birthDay = parseInt(birthDateStr.substring(6, 8))

      const birthDate = new Date(birthYear, birthMonth - 1, birthDay)
      const today = new Date()

      let age = today.getFullYear() - birthYear
      const monthDiff = today.getMonth() - (birthMonth - 1)
      const dayDiff = today.getDate() - birthDay

      // 濡傛灉杩樻病杩囩敓鏃ワ紝骞撮緞鍑?
      if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age--
      }

      return age > 0 ? age : 0
    },

    // 浠庤韩浠借瘉鍙峰垽鏂€у埆
    getGenderFromIdCard(idCard) {
      if (!idCard || idCard.length < 15) {
        return '鏈煡'
      }

      let genderCode = ''
      // 18浣嶈韩浠借瘉锛氬€掓暟绗簩浣嶄负鎬у埆鐮侊紝濂囨暟涓虹敺锛屽伓鏁颁负濂?
      if (idCard.length === 18) {
        genderCode = idCard.substring(16, 17)
      }
      // 15浣嶈韩浠借瘉锛氭渶鍚庝竴浣嶄负鎬у埆鐮侊紝濂囨暟涓虹敺锛屽伓鏁颁负濂?
      else if (idCard.length === 15) {
        genderCode = idCard.substring(14, 15)
      } else {
        return '鏈煡'
      }

      return parseInt(genderCode) % 2 === 1 ? '鐢? : '濂?
    },

    // 鏍煎紡鍖栨棩鏈燂紝鍙樉绀哄勾鏈堟棩
    formatDate(dateStr) {
      if (!dateStr) {
        return ''
      }

      try {
        // 濡傛灉鏄椂闂存埑锛堟暟瀛楋級
        if (typeof dateStr === 'number') {
          const date = new Date(dateStr)
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }

        // 濡傛灉鏄瓧绗︿覆
        if (typeof dateStr === 'string') {
          // 澶勭悊 ISO 鏍煎紡锛?024-01-01T10:30:00 鎴?2024-01-01 10:30:00
          const datePart = dateStr.split('T')[0].split(' ')[0]
          // 楠岃瘉鏍煎紡鏄惁涓?YYYY-MM-DD
          if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            return datePart
          }

          // 灏濊瘯瑙ｆ瀽涓烘棩鏈熷璞?
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
        console.error('鏍煎紡鍖栨棩鏈熷け璐?', e)
        return dateStr
      }
    },

    formatNullableDate(dateStr) {
      return this.formatDate(dateStr) || '鈥?
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

    // 浠?storage 鍔犺浇鐢ㄦ埛淇℃伅
    loadUserInfo() {
      try {
        const userInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
        if (userInfo) {
          this.detail.name = userInfo.realName || this.detail.name

          // 浠庤韩浠借瘉鍙疯绠楀勾榫勫拰鎬у埆
          if (userInfo.idNumber) {
            this.detail.age = this.calculateAgeFromIdCard(userInfo.idNumber)
            this.detail.gender = this.getGenderFromIdCard(userInfo.idNumber)

            console.log('浠?storage 鍔犺浇鐢ㄦ埛淇℃伅:', {
              name: userInfo.realName,
              idNumber: userInfo.idNumber,
              age: this.detail.age,
              gender: this.detail.gender
            })
          }
        }
      } catch (e) {
        console.error('鍔犺浇鐢ㄦ埛淇℃伅澶辫触:', e)
      }
    },

    // 纭繚鎬у埆鍜屽勾榫勪粠韬唤璇佸彿璇嗗埆锛堜紭鍏堢骇鏈€楂橈級
    ensureGenderAndAgeFromIdCard() {
      try {
        const userInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
        if (userInfo && userInfo.idNumber) {
          // 浼樺厛浣跨敤韬唤璇佸彿璇嗗埆鐨勬€у埆鍜屽勾榫?
          const ageFromIdCard = this.calculateAgeFromIdCard(userInfo.idNumber)
          const genderFromIdCard = this.getGenderFromIdCard(userInfo.idNumber)

          if (ageFromIdCard > 0) {
            this.detail.age = ageFromIdCard
          }
          if (genderFromIdCard !== '鏈煡') {
            this.detail.gender = genderFromIdCard
          }

          console.log('浠庤韩浠借瘉鍙烽噸鏂拌瘑鍒€у埆鍜屽勾榫?', {
            idNumber: userInfo.idNumber,
            age: this.detail.age,
            gender: this.detail.gender
          })
        }
      } catch (e) {
        console.error('浠庤韩浠借瘉鍙疯瘑鍒€у埆鍜屽勾榫勫け璐?', e)
      }
    },

    // 鏍规嵁澶勬柟ID浠?storage 鍔犺浇澶勬柟淇℃伅
    // 鉁?浠嶢PI鍔犺浇澶勬柟璇︽儏
    async loadPrescriptionById(id) {
      if (!this.isValidPrescriptionId(id)) {
        console.warn('澶勬柟ID鏃犳晥锛岃烦杩囧鏂硅鎯呭姞杞?', id)
        return
      }
      try {
        uni.showLoading({ title: '鍔犺浇涓?..' })

        // 璋冪敤鍚庣API鑾峰彇澶勬柟璇︽儏
        const prescriptionData = await getPrescriptionDetail(id)

        console.log('澶勬柟璇︽儏:', prescriptionData)

        if (prescriptionData) {
          // 浼樺厛灏濊瘯浠庡鏂硅褰曞叧鑱旂殑 doctor_id 鑾峰彇鍖荤敓闂ㄨ瘖鍙凤紙lnzy_doctor.outpatient_no锛?
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
            console.warn('鑾峰彇鍖荤敓闂ㄨ瘖鍙峰け璐?, e)
          }
          this.detail.visitNo = visitNoFromDoctor || prescriptionData.consultationNo || prescriptionData.id || id
          this.detail.formulaName = prescriptionData.formulaName || prescriptionData.medicineName || ''
          this.detail.packCount = prescriptionData.doses || prescriptionData.quantity || 1
          this.detail.productPrice = prescriptionData.totalAmount || 0
          this.detail.diagnosis = prescriptionData.diagnosis || ''
          this.detail.department = prescriptionData.department || '渚挎嵎閰嶈嵂闂ㄨ瘖'
          this.detail.doctorName = this.resolvePrescriptionDoctorName(prescriptionData) || this.detail.doctorName
          this.detail.date = this.formatDate(this.resolvePrescriptionDate(prescriptionData)) || this.detail.date

          this.detail.doctorId = prescriptionData.doctorId || null
          await this.applyDoctorFromPrescription(prescriptionData)

          // 鑾峰彇澶勬柟鑽搧鍒楄〃
          try {
            const prescriptionItems = await getPrescriptionItems(id)
            this.detail.prescriptionItems = prescriptionItems || []
            console.log('澶勬柟鑽搧鍒楄〃:', prescriptionItems)
            if (this.detail.prescriptionItems.length > 0) {
              const firstItem = this.detail.prescriptionItems[0]
              if (firstItem.price) {
                this.detail.productPrice = Number(firstItem.price)
              }
              if (firstItem.quantity) {
                this.detail.packCount = Number(firstItem.quantity) || this.detail.packCount
              }
            }

            // 閽堝姣忎釜澶勬柟椤癸紝鏌ヨ鍟嗗搧璇︽儏浠ヨ幏寰?usage_desc銆乨octor_id銆乸harmacist_id 绛変俊鎭?
            const doctorIds = new Set()
            const pharmacistIds = new Set()
            for (const item of this.detail.prescriptionItems) {
              try {
                // 澶勬柟鏄庣粏涓繚瀛樼殑鏄?prescription_item.id 涓?product_id
                const productId = item.productId || item.product_id || item.product || null
                console.log('澶勭悊澶勬柟椤癸紝prescription_item.id=', item.id, 'productId=', productId)
                if (!productId) {
                  // 娌℃湁鍏宠仈鍟嗗煄鍟嗗搧锛岃烦杩囦絾淇濈暀澶勬柟鏄庣粏鏂囨湰淇℃伅
                  console.log('澶勬柟椤规病鏈夊叧鑱斿晢鍩庡晢鍝侊紝璺宠繃 product fetch for item.id=', item.id)
                  continue
                }
                const product = await getProductDetail(productId)
                console.log('鍟嗗搧璇︽儏杩斿洖', productId, product)
                if (product) {
                  // 鍏煎涓嶅悓瀛楁鍛藉悕
                  item.usageDesc = product.usageDesc || product.usage_desc || product.usage || ''
                  const pDoctorId = product.doctorId || product.doctor_id || product.doctor || null
                  const pPharmacistId = product.pharmacistId || product.pharmacist_id || product.pharmacist || null
                  item.productDetail = product
                  console.log('浠庡晢鍝佷腑璇诲彇 doctorId, pharmacistId:', pDoctorId, pPharmacistId)
                  if (pDoctorId) doctorIds.add(pDoctorId)
                  if (pPharmacistId) pharmacistIds.add(pPharmacistId)
                }
              } catch (prodErr) {
                console.warn('get product detail failed:', item.id || item.product_id || item.productId, prodErr)
              }
            }

            // 浣跨敤 doctorId/pharmacistId 鍒楄〃鍘绘媺鍙栧搴斿尰鐢?鑽笀璇︽儏锛堝幓閲嶏級
            for (const docId of Array.from(doctorIds)) {
              try {
                console.log('鑾峰彇鍏宠仈鍖荤敓璇︽儏 docId=', docId)
                const doc = await getDoctorDetail(docId)
                console.log('鍏宠仈鍖荤敓璇︽儏杩斿洖', doc)
                if (doc) {
                  const sig = getImageUrl(doc.signatureUrl || doc.signature_url || doc.signature || doc.signUrl || '')
                  console.log('瑙ｆ瀽鍒板尰鐢熺鍚峴ig=', sig, '鍖荤敓avatar/澶村儚鍏煎瀛楁:', doc.avatarUrl || doc.avatar || doc.avatar_url)
                  this.detail.associatedDoctors[docId] = {
                    name: doc.name || '',
                    title: doc.title || '',
                    hospital: doc.hospitalName || doc.hospital || '',
                    signatureUrl: sig
                  }
                }
              } catch (e) {
                console.warn('鑾峰彇鍏宠仈鍖荤敓璇︽儏澶辫触:', docId, e)
              }
            }
            for (const phId of Array.from(pharmacistIds)) {
              try {
                // 鍋囪鑽笀涔熷湪鍖荤敓琛ㄦ垨鍚屼竴鎺ュ彛鍙煡璇?
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
                console.warn('鑾峰彇鍏宠仈鑽笀璇︽儏澶辫触:', phId, e)
              }
            }


          } catch (itemError) {
            console.warn('鑾峰彇澶勬柟鑽搧鍒楄〃澶辫触:', itemError)
            this.detail.prescriptionItems = []
          }

          // 浣跨敤绗竴涓鏂归」鍏宠仈鐨勫晢鍝佺殑 doctor_id / pharmacist_id 鑾峰彇鍖荤敓/鑽笀淇℃伅骞舵樉绀?avatarUrl锛堥椤逛紭鍏堬級
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
                  console.warn('鑾峰彇棣栭」鍟嗗搧鍏宠仈鍖荤敓淇℃伅澶辫触:', docErr)
                }
              }

              if (firstPharmacistId) {
                try {
                  console.log('浣跨敤棣栭」product鐨刾harmacistId鍘昏幏鍙栬嵂甯堣鎯?', firstPharmacistId)
                  const ph = await getDoctorDetail(firstPharmacistId)
                  console.log('棣栭」鍏宠仈鑽笀璇︽儏杩斿洖', ph)
                  if (ph) {
                    const signatureUrl = ph.signatureUrl
                    this.detail.pharmacistSignatureUrl = getImageUrl(signatureUrl)
                    console.log('set detail.pharmacistSignatureUrl =', this.detail.pharmacistSignatureUrl, 'raw avatar field=', signatureUrl)
                    this.detail.pharmacistName = this.detail.pharmacistName || ph.name || this.detail.pharmacistName
                  }
                } catch (phErr) {
                  console.warn('鑾峰彇棣栭」鍟嗗搧鍏宠仈鑽笀淇℃伅澶辫触:', phErr)
                }
              }
            }
          } catch (e) {
            console.warn('澶勭悊棣栭」鍟嗗搧鍏宠仈鍖诲笀/鑽笀淇℃伅澶辫触', e)
          }

          // 缂撳瓨鍒版湰鍦?
          const prescriptions = uni.getStorageSync(STORAGE_KEY_PRESCRIPTION_ORDERS) || []
          const index = prescriptions.findIndex(p => p.id === id)
          if (index > -1) {
            prescriptions[index] = { ...prescriptions[index], ...prescriptionData }
            uni.setStorageSync(STORAGE_KEY_PRESCRIPTION_ORDERS, prescriptions)
          }
        }

        uni.hideLoading()
      } catch (error) {
        console.error('鍔犺浇澶勬柟璇︽儏澶辫触:', error)
        uni.hideLoading()

        // 鏄剧ず鐢ㄦ埛鍙嬪ソ鐨勯敊璇彁绀?
        let errorMessage = '鍔犺浇澶勬柟璇︽儏澶辫触'
        if (error && error.message) {
          if (error.message.includes('鏃犳潈闄?)) {
            errorMessage = '鎮ㄦ病鏈夋潈闄愭煡鐪嬫澶勬柟'
          } else if (error.message.includes('涓嶅瓨鍦?)) {
            errorMessage = '澶勬柟淇℃伅涓嶅瓨鍦?
          } else {
            errorMessage = error.message
          }
        }

        uni.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 3000
        })

        // API澶辫触鏃朵粠鏈湴鍔犺浇
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
          // 濡傛灉 storage 涓病鏈夋壘鍒帮紝浣跨敤 prescriptionNo 浣滀负 visitNo
          this.detail.visitNo = id
          console.warn('鏈湪 storage 涓壘鍒板鏂逛俊鎭紝浣跨敤榛樿鍊?)
        }
      }
    },

    async loadOrderFromOrderId(orderId) {
      if (!this.isUsableId(orderId)) {
        return
      }
      try {
        const orderInfo = await getOrderDetail(orderId, { showLoading: false })
        if (!orderInfo) {
          return
        }

        this.orderStatus.status = orderInfo.orderStatus !== null && orderInfo.orderStatus !== undefined
          ? orderInfo.orderStatus
          : (orderInfo.status || 0)
        this.orderStatus.orderNo = orderInfo.orderNo || orderInfo.id || ''
        this.orderStatus.logisticsNo = orderInfo.logisticsNo || ''
        this.orderStatus.logisticsCompany = orderInfo.logisticsCompany || ''
        this.updateDetailFromOrder(orderInfo)

        const prescriptionId = orderInfo.prescriptionId || orderInfo.prescription_id
        if (this.isValidPrescriptionId(prescriptionId)) {
          this.pageOptions.prescriptionNo = String(prescriptionId)
          await this.loadPrescriptionById(prescriptionId)
        }
      } catch (error) {
        console.error('閫氳繃璁㈠崟ID鍔犺浇澶勬柟璇︽儏澶辫触:', error)
        uni.showToast({
          title: error.message || '鍔犺浇璁㈠崟澶勬柟澶辫触',
          icon: 'none'
        })
      }
    },

    goBuy() {
      // 楠岃瘉璁㈠崟鐘舵€侊紝鍙湁寰呮敮浠樼姸鎬佹墠鑳借喘鑽?
      if (this.orderStatus.status !== 0) {
        const statusText = this.statusMainText || '闈炲緟鏀粯鐘舵€?
        uni.showToast({
          title: `璁㈠崟鐘舵€佷负${statusText}锛屾棤娉曡喘鑽痐,
          icon: 'none'
        })
        return
      }

      // 楠岃瘉蹇呰鏁版嵁
      if (!this.detail.visitNo) {
        uni.showToast({
          title: '澶勬柟淇℃伅涓嶅畬鏁?,
          icon: 'none'
        })
        return
      }

      // 鏋勫缓璁㈠崟淇℃伅
      // 浣跨敤缁熶竴鐨勫崟浠峰拰鏁伴噺璁＄畻鎬讳环锛堜笌鍟嗗搧璇︽儏椤靛拰澶嶈瘖璇︽儏椤典繚鎸佷竴鑷达級
      const unitPrice = this.detail.productPrice
        || (this.detail.prescriptionItems[0] && this.detail.prescriptionItems[0].price)
        || 0
      const quantity = this.detail.packCount || 1
      const totalPrice = parseFloat((unitPrice * quantity).toFixed(2))

      const orderItems = [{
        id: this.detail.visitNo,
        name: this.detail.formulaName || '涓嵂澶勬柟',
        type: '鍒跺墏',
        price: totalPrice,
        quantity: quantity
      }]

      const medicineCost = parseFloat(orderItems.reduce((sum, item) => sum + item.price, 0).toFixed(2))

      const orderInfo = {
        prescriptions: [this.detail.visitNo],
        items: orderItems,
        deliveryInfo: {
          distributor: '杈藉畞涓尰鑽ぇ瀛﹂檮灞炲尰闄?,
          logistics: '椤轰赴蹇€?,
          purchaseMethod: '鑽搧閰嶉€?鍦ㄧ嚎鏀粯',
          shippingPaymentMethod: '鍦ㄧ嚎鏀粯'
        },
        cost: {
          medicineCost: medicineCost,
          isDecocted: false,
          shippingFee: 0 // 纭椤甸潰浼氳嚜鍔ㄨ缃负18鍏?
        },
        total: medicineCost // 纭椤甸潰浼氶噸鏂拌绠楀寘鍚揩閫掕垂鐨勬€讳环
      }

      // 淇濆瓨璁㈠崟淇℃伅
      try {
        // 鍚屾鍒拌喘鐗╄溅/宸查獙璇佷骇鍝侊紝纭繚 confirm 椤甸潰鑳芥纭姞杞藉晢鍝佹槑缁?
        try {
          const verified = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
          const quantities = uni.getStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES) || {}
          const selected = uni.getStorageSync(STORAGE_KEY_SELECTED_PRODUCTS) || []

          // 濡傛灉澶勬柟閲屽寘鍚鏂规槑缁嗕笖鏈夊叧鑱斿晢鍩庡晢鍝両D锛屽垯浼樺厛鎶婅繖浜涘晢鍝佸姞鍏ュ埌宸查獙璇佸垪琛?
          const associatedProductIds = []
          if (this.detail.prescriptionItems && this.detail.prescriptionItems.length > 0) {
            for (const pi of this.detail.prescriptionItems) {
              const pid = pi.productId || pi.product_id || pi.product || null
              if (pid) {
                const key = String(pid)
                verified[key] = true
                // 澶勬柟鏄庣粏閲屾病鏈夋槑纭暟閲忔椂锛屼娇鐢ㄥ鏂归〉鐨?packCount 鎴栨槑缁嗙殑 days 浣滀负鍏滃簳
                quantities[key] = quantities[key] || pi.quantity || pi.days || this.detail.packCount || 1
                if (!selected.includes(key)) selected.push(key)
                associatedProductIds.push(key)
              }
            }
          } else {
            // 濡傛灉娌℃湁澶勬柟鍟嗗搧鍏宠仈鍒板晢鍩庡晢鍝侊紝鎶婂鏂规湰韬綔涓轰竴涓櫄鎷熷晢鍝佹斁鍏ュ凡閫夊垪琛紙id 浣跨敤 visitNo锛宑onfirm 浼氫娇鐢?current_order 鐨?items锛?
            // 杩欓噷浠嶇劧鏍囪 visitNo 鍦ㄥ凡閫夐」涓紝閬垮厤 confirm 椤靛嚭鐜扮┖鍟嗗搧鍒楄〃锛堟煇浜涙祦绋嬩細鐢ㄥ埌 selected_products锛?
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
          console.log('鍚屾璐墿杞﹀凡楠岃瘉鍟嗗搧:', associatedProductIds.length ? associatedProductIds : (this.detail.visitNo || 'visitNo'), verified, quantities)
        } catch (syncErr) {
          console.warn('鍚屾璐墿杞︿俊鎭け璐?', syncErr)
        }

        uni.setStorageSync(STORAGE_KEY_CURRENT_ORDER, orderInfo)

        // 璺宠浆鍒拌鍗曠‘璁ら〉闈?
        uni.navigateTo({
          url: '/pages/order/confirm',
          success: () => {
            console.log('璺宠浆鍒拌鍗曠‘璁ら〉闈㈡垚鍔?)
          },
          fail: (err) => {
            console.error('璺宠浆澶辫触:', err)
            uni.showToast({
              title: '璺宠浆澶辫触锛岃閲嶈瘯',
              icon: 'none'
            })
          }
        })
      } catch (e) {
        console.error('淇濆瓨璁㈠崟淇℃伅澶辫触:', e)
        uni.showToast({
          title: '淇濆瓨璁㈠崟淇℃伅澶辫触',
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
  padding-bottom: 140rpx; // 棰勭暀搴曢儴鎸夐挳绌洪棿
  box-sizing: border-box;
}

/* 椤堕儴钃濊壊娓愬彉鍧?*/
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

/* 鐧藉崱鐗囨暣浣撳線涓娾€滈《鈥濅竴鐐癸紝褰㈡垚鎮诞鎰?*/
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

/* 鏍囬 */
.card-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333333;
  margin-bottom: 30rpx;
}

/* 琛屾牱寮?*/
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

/* 铏氱嚎鍒嗗壊 */
.dash-line {
  border-bottom: 1px dashed #e0e0e0;
  margin: 18rpx 0;
}

.big-space {
  margin-top: 40rpx;
}

/* 涓ゅ垪淇℃伅 */
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

/* Rp 鍖哄煙 */
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

/* 绛惧悕鍖哄煙 */
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

/* 搴曢儴鎸夐挳鏉?*/
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
