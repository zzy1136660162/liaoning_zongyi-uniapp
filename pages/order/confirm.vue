<template>
  <view class="page">
    <view style="padding: 20rpx;">
      <!-- 页面内容 -->
      <scroll-view
        class="body"
        scroll-y
      >
        <!-- 传统疗法：到店核销提示 -->
        <view
          v-if="isTherapyOrder"
          class="section therapy-tip-section"
        >
          <view class="therapy-tip-badge">
            传统疗法
          </view>
          <view class="therapy-tip-title">
            到院核销，无需物流
          </view>
          <view class="therapy-tip-desc">
            支付成功后将在订单列表生成核销二维码，到院出示即可使用。
          </view>
        </view>

        <view class="section">
          <view class="section-title patient-section-title">
            <text>就诊人</text>
            <text
              class="patient-manage"
              @click="managePatients"
            >
              管理就诊人
            </text>
          </view>
          <view class="patient-selector">
            <view>
              <text class="patient-label">
                本次已选
              </text>
              <text>{{ selectedPatient ? selectedPatient.name : '请选择就诊人' }}</text>
            </view>
            <button
              v-if="selectedPatient"
              class="patient-remove"
              :disabled="loadingPatients || submitting"
              @click="removeSelectedPatient"
            >
              移除
            </button>
          </view>
          <text class="patient-note">
            {{ requiresConsultationPatient ? '本次复诊仅可选择对应就诊人，更换请返回重新申请。' : '每笔订单仅选择一位就诊人。移除仅取消本次选择，不删除就诊人资料。' }}
          </text>
          <button
            v-if="getPatientProfileNotice(selectedPatient)"
            class="patient-profile-notice"
            :disabled="submitting"
            @click="promptPatientCompletion"
          >
            {{ getPatientProfileNotice(selectedPatient) }}，去完善信息
          </button>
          <text
            v-if="selectedPatient && patientHisSyncNotice(selectedPatient.hisBindingStatus)"
            class="patient-note"
          >
            医院信息待同步，可先核对就诊人资料。
          </text>
          <view class="patient-list-title">
            可选就诊人（单选）
          </view>
          <text
            v-if="loadingPatients"
            class="patient-note"
          >
            加载中...
          </text>
          <button
            v-for="patient in patients"
            :key="patient.id"
            class="patient-option"
            :class="{ active: selectedPatient && String(selectedPatient.id) === String(patient.id) }"
            :disabled="loadingPatients || submitting || (requiresConsultationPatient && String(patient.id) !== String(checkoutContext && checkoutContext.patientId))"
            @click="selectPatient(patient)"
          >
            <view class="patient-option-info">
              <text>{{ patient.name }}</text>
              <text class="patient-meta">
                {{ patient.gender || '性别待完善' }} {{ patient.birthDate ? patient.age + '岁' : '年龄待完善' }} {{ patient.idNumberMasked }}
              </text>
              <text
                v-if="getPatientProfileNotice(patient)"
                class="patient-profile-note"
              >
                待完善：{{ getPatientProfileNotice(patient) }}
              </text>
            </view>
            <uni-icons
              :type="selectedPatient && String(selectedPatient.id) === String(patient.id) ? 'circle-filled' : 'circle'"
              size="22"
              :color="selectedPatient && String(selectedPatient.id) === String(patient.id) ? '#2a82e4' : '#999'"
            />
          </button>
          <text
            v-if="!loadingPatients && !patients.length"
            class="patient-note"
          >
            暂无就诊人，请先添加。
          </text>
          <button
            class="patient-add"
            :disabled="submitting"
            @click="addCheckoutPatient"
          >
            ＋ 添加就诊人
          </button>
          <text class="patient-note">
            当前账号下同一身份证无需重复添加，请直接选择已有就诊人。
          </text>
        </view>

        <!-- 收货地址 -->
        <view
          v-if="requiresShipping"
          class="section address-section"
          @click="selectAddress"
        >
          <view
            v-if="selectedAddress"
            class="address-content"
          >
            <view class="address-header">
              <text class="name">
                {{ selectedAddress.receiverName }}
              </text>
              <text class="phone">
                {{ selectedAddress.receiverPhone }}
              </text>
            </view>
            <view class="address-detail">
              {{ selectedAddress.province }}{{ selectedAddress.city }}{{ selectedAddress.district }}{{ selectedAddress.addressDetail || (selectedAddress.street || '') + (selectedAddress.detail || '') }}
            </view>
          </view>
          <view
            v-else
            class="address-empty"
          >
            <text>请选择收货地址</text>
          </view>
          <view class="address-arrow">
            <uni-icons
              type="right"
              size="24"
              color="#999"
            />
          </view>
        </view>

        <!-- 配送信息 -->
        <view
          v-if="requiresShipping"
          class="section"
        >
          <view class="section-title">
            配送信息
          </view>
          <view class="info-row">
            <text class="label">
              配送方
            </text>
            <text class="value">
              {{ orderInfo.deliveryInfo.distributor }}
            </text>
          </view>
          <view class="info-row">
            <text class="label">
              物流公司
            </text>
            <text class="value">
              {{ orderInfo.deliveryInfo.logistics }}
            </text>
          </view>
          <view class="info-row">
            <text class="label">
              购药方式
            </text>
            <text class="value">
              {{ orderInfo.deliveryInfo.purchaseMethod }}
            </text>
          </view>
          <view class="info-row">
            <text class="label">
              快递费支付方式
            </text>
            <text class="value">
              {{ orderInfo.deliveryInfo.shippingPaymentMethod }}
            </text>
          </view>
        </view>

        <view v-if="selectionIssue" class="section">
          <text>{{ selectionIssue }}</text>
          <button size="mini" @click="reloadSelection">重新加载商品</button>
        </view>
        <!-- 订单商品 -->
        <view class="section">
          <view class="section-title">
            订单商品
          </view>
          <view
            v-for="item in orderInfo.items"
            :key="item.id"
            class="order-item"
          >
            <view class="item-info">
              <text class="item-name">
                {{ item.name }}
              </text>
              <text class="item-type">
                {{ item.type }} ×{{ item.quantity || 1 }}
              </text>
            </view>
            <text class="item-price">
              ¥{{ item.price.toFixed(2) }}
            </text>
          </view>
        </view>

        <!-- 订单备注 -->
        <view class="section">
          <view class="section-title">
            订单备注
          </view>
          <view class="remark-field">
            <textarea
              v-model="orderRemark"
              class="remark-input"
              maxlength="255"
              placeholder="选填，请填写订单备注"
              placeholder-class="remark-placeholder"
            />
            <text class="remark-count">
              {{ orderRemark.length }}/255
            </text>
          </view>
        </view>

        <!-- 费用明细 -->
        <view class="section">
          <view class="section-title">
            费用明细
          </view>
          <view class="cost-row">
            <text class="label">
              商品合计
            </text>
            <text class="value">
              ¥{{ orderInfo.cost.medicineCost.toFixed(2) }}
            </text>
          </view>
          <!-- <view class="cost-row">
          <view class="label-with-checkbox">
            <text class="label">代煎</text>
            <view class="checkbox" :class="{ checked: orderInfo.cost.isDecocted }" @click="toggleDecocted"></view>
          </view>
          <text class="value">¥0.00</text>
        </view> -->
          <view
            v-if="requiresShipping"
            class="cost-row"
          >
            <view class="label-with-note">
              <text class="label">
                运费（到付）
              </text>
              <text class="freight-note">
                运费计算供参考，以实际支付为准
              </text>
            </view>
            <view class="value-container">
              <text
                v-if="calculatingFreight"
                class="value calculating"
              >
                计算中...
              </text>
              <text
                v-else
                class="value freight-ref"
              >
                约¥{{ orderInfo.cost.shippingFee.toFixed(2) }}
              </text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
    <!-- 底部操作栏 -->
    <view class="footer">
      <view class="footer-left">
        <text class="total-label">
          合计:
        </text>
        <text class="total-price">
          ¥{{ orderInfo.total.toFixed(2) }}
        </text>
      </view>
      <button
        class="submit-btn"
        :class="{ disabled: !canSubmit }"
        @click="submitOrder"
      >
        {{ isTherapyOrder ? '立即支付' : '提交订单' }}
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import {
  STORAGE_KEY_CURRENT_ORDER,
  STORAGE_KEY_DEFAULT_ADDRESS_ID
} from '@/utils/storage.js'
import { refreshCart, buildOrderInfo, getCurrentCheckoutProductIds, loadCartItems, setCheckoutProductIds, validateCheckoutStock } from '@/utils/cart.js'
import { parseDirectPurchase, directPurchaseQuery, checkoutEntries } from '@/utils/checkout.js'
import { getOrderSubmission, rememberCreatedOrder, releaseOrderSubmission, forgetOrderSubmission } from '@/utils/order-submission.js'
import { createOrder, createOrderFromPrescription, getOrderByPrescriptionId } from '@/api/order.js'
import { getConsultationDetail, getPrescriptionDetail, getPrescriptionItems } from '@/api/consultation.js'
import { parseConsultationContext, requireConsultationPatient } from '@/utils/consultation-checkout.js'
import { getSessionGeneration, assertCurrentSession, isCurrentSession } from '@/utils/session.js'
import { getAddressList } from '@/api/address.js'
import { getPatientList } from '@/api/patient.js'
import { getPatientProfileNotice, patientHisSyncNotice } from '@/utils/patient.js'
import { wechatSinglePay } from '@/api/payment.js'
import { getProductDetail } from '@/api/product.js'
import { loadCartProducts } from '@/utils/cart-products.js'
import { resolveProductSku, withProductSku } from '@/utils/product-sku.js'
import { ensureWeChatIdentity } from '@/api/auth.js'
import { queryFreight } from '@/api/express.js'
import { logPageView, logButtonClick, logAccess, getActionFailureResult } from '@/utils/accessLog.js'
import { resolveProductFlow } from '@/utils/product-biz.js'
import { resolveCheckoutQuestionnaire, buildQuestionnaireNoticeUrl } from '@/utils/questionnaire-state.js'
import { canCreatePrescriptionOrder } from '@/utils/prescription.js'
import { canPayOrder } from '@/utils/order-status.js'

const PAGE_LOG = { moduleCode: 'ORDER', accessType: '订单', pageType: 'ORDER_CONFIRM', requestUri: '/pages/order/confirm' }

const isTherapyOrder = ref(false)
const checkoutContext = ref(null)
const directPurchase = ref(null)
const checkoutRouteError = ref('')
const selectionEntries = ref({})
const prescriptionId = ref(null)
const prescription = ref(null)
const prescriptionLoadError = ref('')
const submitting = ref(false)
const completedOrderId = ref(null)
const pageSession = getSessionGeneration()
let pageActive = true
onUnload(() => {
  pageActive = false
  if (submitting.value && isCurrentSession(pageSession)) uni.hideLoading()
})

const orderInfo = ref({
  prescriptions: [],
  items: [],
  deliveryInfo: {
    distributor: '辽宁中医药大学附属医院',
    logistics: '顺丰快递',
    purchaseMethod: '药品配送-在线支付',
    shippingPaymentMethod: '到付（货到付款给快递员）'
  },
  cost: {
    medicineCost: 0,
    isDecocted: false,
    shippingFee: 0
  },
  total: 0
})

const addresses = ref([])
const selectedAddress = ref(null)
const categories = ref([])
const calculatingFreight = ref(false)
const selectedProductIds = ref([])
const selectedRequiresConsultation = ref(false)
const selectedRequiresShipping = ref(false)
const orderRemark = ref('')
const patients = ref([])
const selectedPatient = ref(null)
const loadingPatients = ref(false)
let patientSelectionCleared = false
let patientRefreshId = 0

const requiresShipping = computed(() => selectedRequiresShipping.value)
const requiresConsultationPatient = computed(() => selectedRequiresConsultation.value)
const selectionIssue = computed(() => {
  if (checkoutRouteError.value) return checkoutRouteError.value
  if (prescriptionLoadError.value) return prescriptionLoadError.value
  const products = categories.value.flatMap(category => category.products || [])
  if (products.some(product => product.selectionInvalid)) return '所选规格已失效或尚未选择，请返回商品页重新选择'
  if (products.some(product => product.loadFailure)) return '暂时无法确认商品信息，请重新加载后再提交'
  const flow = resolveProductFlow(products)
  if (!flow.valid) return flow.message
  return ''
})

const canSubmit = computed(() => {
  if (submitting.value || loadingPatients.value || !selectedPatient.value || selectionIssue.value || !orderInfo.value.items.length) return false
  if (!requiresShipping.value) {
    return orderInfo.value.items && orderInfo.value.items.length > 0
  }
  return !!selectedAddress.value
})

onLoad((options) => {
  try { directPurchase.value = parseDirectPurchase(options) }
  catch (error) { checkoutRouteError.value = error.message }
  prescriptionId.value = /^[1-9]\d*$/.test(String(options?.prescriptionId || '')) ? Number(options.prescriptionId) : null
  if (directPurchase.value && (!options?.selectedItems || prescriptionId.value)) {
    checkoutRouteError.value = '购买信息无效，请返回商品页重新选择'
  }
  checkoutContext.value = parseConsultationContext(options)
  if (options?.selectedItems) {
    selectedProductIds.value = options.selectedItems.split(',').filter(id => id.trim())
    if (!directPurchase.value) setCheckoutProductIds(selectedProductIds.value)
  } else if (!prescriptionId.value) {
    selectedProductIds.value = getCurrentCheckoutProductIds()
  }
})

onShow(async () => {
  if (pageActive && isCurrentSession(pageSession)) logPageView({ ...PAGE_LOG, pageId: prescriptionId.value || '', actionCode: 'ORDER_CONFIRM_VIEW', accessTitle: '确认订单', accessDescription: '进入订单确认页，核对商品、就诊人和配送信息', extraData: { checkoutSource: prescriptionId.value ? 'PRESCRIPTION' : directPurchase.value ? 'DIRECT' : 'CART', consultationId: checkoutContext.value?.consultationId || '', selectedCount: selectedProductIds.value.length } })
  await loadProducts()
  loadOrderInfo()
  await loadAddresses()
  await loadCheckoutPatients()
})

const loadCheckoutPatients = async () => {
  if (!pageActive || !isCurrentSession(pageSession)) return
  const requestId = ++patientRefreshId
  loadingPatients.value = true
  try {
    const result = await getPatientList()
    if (!pageActive || requestId !== patientRefreshId) return
    assertCurrentSession(pageSession)
    patients.value = Array.isArray(result) ? result : []
    const patientId = requiresConsultationPatient.value
      ? checkoutContext.value?.patientId
      : selectedPatient.value?.id
    selectedPatient.value = patientSelectionCleared ? null : patients.value.find(patient => String(patient.id) === String(patientId))
      || (!requiresConsultationPatient.value && patientId == null && patients.value.length === 1 ? patients.value[0] : null)
    if (!selectedPatient.value) patientSelectionCleared = true
  } catch (error) {
    if (!pageActive || requestId !== patientRefreshId || !isCurrentSession(pageSession)) return
    patients.value = []
    selectedPatient.value = null
    patientSelectionCleared = true
    uni.showToast({ title: error?.message || '就诊人加载失败，请重试', icon: 'none' })
  } finally {
    if (pageActive && requestId === patientRefreshId && isCurrentSession(pageSession)) loadingPatients.value = false
  }
}

const selectPatient = (patient) => {
  if (!pageActive || !isCurrentSession(pageSession) || loadingPatients.value || submitting.value) return
  const option = patients.value.find(item => String(item.id) === String(patient?.id))
  if (!option || (requiresConsultationPatient.value && String(option.id) !== String(checkoutContext.value?.patientId))) return
  selectedPatient.value = option
  patientSelectionCleared = false
  logButtonClick({ ...PAGE_LOG, pageId: prescriptionId.value || '', actionCode: 'CHECKOUT_PATIENT_SELECT', accessTitle: '选择就诊人', accessDescription: '在订单确认页切换本次购买对应的就诊人' })
}

const removeSelectedPatient = () => {
  if (!pageActive || !isCurrentSession(pageSession) || loadingPatients.value || submitting.value) return
  selectedPatient.value = null
  patientSelectionCleared = true
  logButtonClick({ ...PAGE_LOG, pageId: prescriptionId.value || '', actionCode: 'CHECKOUT_PATIENT_REMOVE', accessTitle: '移除本次就诊人', accessDescription: '仅取消本次订单的就诊人选择，保留就诊人资料' })
}

const addCheckoutPatient = () => {
  if (!pageActive || !isCurrentSession(pageSession) || submitting.value) return
  logButtonClick({ ...PAGE_LOG, pageId: prescriptionId.value || '', actionCode: 'CHECKOUT_PATIENT_ADD', accessTitle: '添加就诊人', accessDescription: '从订单确认页新增就诊人，保存后可在列表选择' })
  uni.navigateTo({ url: '/pages/dispense/patient_edit' })
}

const managePatients = () => {
  logButtonClick({ ...PAGE_LOG, pageId: prescriptionId.value || '', actionCode: 'CHECKOUT_PATIENT_MANAGE', accessTitle: '管理就诊人', accessDescription: '从订单确认页进入就诊人管理' })
  uni.navigateTo({ url: '/pages/user/patient_list' })
}

const promptPatientCompletion = () => {
  const notice = getPatientProfileNotice(selectedPatient.value)
  if (!notice) return false

  uni.showModal({
    title: '请完善就诊人信息',
    content: `${notice}，请前往就诊人管理完善后继续下单。`,
    confirmText: '去完善',
    success: (result) => {
      if (result.confirm && pageActive && isCurrentSession(pageSession)) {
        managePatients()
      }
    }
  })
  return true
}

// 加载产品数据（只加载购物车中选中的商品）
const loadProducts = async () => {
  if (!isCurrentSession(pageSession)) return []
  if (checkoutRouteError.value) { categories.value = []; return [] }
  if (prescriptionId.value) return loadPrescriptionProducts()
  try {
    if (!directPurchase.value && !prescriptionId.value) await refreshCart()
    assertCurrentSession(pageSession)
    const currentSelectedIds = selectedProductIds.value.length > 0
      ? selectedProductIds.value
      : getCurrentCheckoutProductIds()

    if (currentSelectedIds.length === 0) {
      // 如果没有选中的商品，清空分类数据
      categories.value = []
      return []
    }
    if (!directPurchase.value) setCheckoutProductIds(currentSelectedIds)

    console.debug('event=ui_order_confirm stage=products result=started source=server')
    uni.showLoading({ title: '加载商品...' })

    // 为选中的商品创建虚拟分类结构
    const cartCategory = {
      id: 'selected_items',
      name: '订单商品',
      products: []
    }
    const cartEntries = checkoutEntries(currentSelectedIds, directPurchase.value)

    cartCategory.products = await loadCartProducts(currentSelectedIds, cartEntries, getProductDetail)

    if (!pageActive) return []
    assertCurrentSession(pageSession)
    selectionEntries.value = cartEntries
    categories.value = [cartCategory]
    const flow = resolveProductFlow(cartCategory.products)
    if (!flow.valid) {
      uni.showToast({ title: flow.message, icon: 'none' })
      setTimeout(() => uni.navigateBack(), 1500)
      return []
    }
    selectedRequiresConsultation.value = flow.requiresConsultation
    selectedRequiresShipping.value = flow.requiresShipping
    isTherapyOrder.value = flow.allTraditionalTherapy
    return [cartCategory]
  } catch (error) {
    if (pageActive && error.code !== 'SESSION_CHANGED') uni.showToast({ title: error.message || '商品加载失败，请重试', icon: 'none' })
    console.error('event=ui_order_confirm stage=products result=failed reason=load_failed')
    categories.value = []
    return []
  } finally {
    if (pageActive) uni.hideLoading()
  }
}

// 处方下单遵循当前后端契约：每条处方明细一件，规格按默认标记、排序和ID选择；days是疗程天数。
const loadPrescriptionProducts = async () => {
  prescription.value = null
  prescriptionLoadError.value = ''
  try {
    const detail = await getPrescriptionDetail(prescriptionId.value)
    assertCurrentSession(pageSession)
    if (Number(detail?.id) !== prescriptionId.value || detail.status !== 1 || !detail.patientId || !detail.consultationId) {
      throw new Error('处方尚未审核通过或就诊信息不完整')
    }
    if (!canCreatePrescriptionOrder(detail)) throw new Error('处方已过期或有效性未确认，请重新复诊')
    const context = { consultationId: Number(detail.consultationId), patientId: Number(detail.patientId) }
    requireConsultationPatient(await getConsultationDetail(context.consultationId), context)
    assertCurrentSession(pageSession)
    const items = await getPrescriptionItems(detail.id)
    assertCurrentSession(pageSession)
    if (!Array.isArray(items) || !items.length || items.some(item => !item.productId)) throw new Error('处方无有效商品明细')
    const productRequests = new Map(), products = new Map()
    for (const item of items) {
      if (!productRequests.has(item.productId)) productRequests.set(item.productId, getProductDetail(item.productId))
      const product = await productRequests.get(item.productId)
      assertCurrentSession(pageSession)
      if (Number(product.productCategory) !== 1) throw new Error('处方商品不属于制剂，请联系医生重新确认')
      const skus = (product.skus || []).filter(sku => sku.status === 1 && sku.delSign === 0)
        .sort((a, b) => Number(b.defaultFlag === 1) - Number(a.defaultFlag === 1) ||
          (a.sort ?? Number.MAX_SAFE_INTEGER) - (b.sort ?? Number.MAX_SAFE_INTEGER) || Number(a.id) - Number(b.id))
      if (!skus.length) throw new Error('处方商品规格已下架')
      const saleProduct = withProductSku(product, resolveProductSku(product, skus[0].id))
      const key = `${product.id}:${skus[0].id}`
      const quantity = (products.get(key)?.quantity || 0) + 1
      if (saleProduct.available === false || saleProduct.stock !== null && quantity > saleProduct.stock) throw new Error('处方商品已下架或库存不足')
      products.set(key, { ...saleProduct, id: key, productId: product.id, name: product.productName,
        image: saleProduct.coverImage, quantity, selected: true })
    }
    prescription.value = detail
    checkoutContext.value = context
    selectedRequiresConsultation.value = true
    isTherapyOrder.value = false
    selectedRequiresShipping.value = true
    categories.value = [{ id: 'prescription_items', products: [...products.values()] }]
    return categories.value
  } catch (error) {
    if (!isCurrentSession(pageSession)) return []
    prescriptionLoadError.value = error.message || '处方商品加载失败，请重试'
    categories.value = []
    return []
  }
}

const reloadSelection = async () => { await loadProducts(); loadOrderInfo() }

const loadOrderInfo = () => {
  if (!isCurrentSession(pageSession)) return
  try {
    const saved = uni.getStorageSync(STORAGE_KEY_CURRENT_ORDER)
    const cartItems = prescriptionId.value
      ? categories.value.flatMap(category => category.products || [])
      : categories.value.length > 0 ? loadCartItems(categories.value, false,
        { entries: selectionEntries.value, preserveQuantity: true }) : []
    const currentSelectedIds = cartItems.map(item => String(item.id))
    const distributor = !selectedRequiresConsultation.value
      ? '健康产品服务'
      : '辽宁中医药大学附属医院'
    const rebuiltOrder = cartItems.length > 0
      ? buildOrderInfo(cartItems, currentSelectedIds, distributor)
      : null

    orderInfo.value = rebuiltOrder || { ...orderInfo.value, prescriptions: [], items: [], total: 0 }

    if (!orderInfo.value.cost) {
      orderInfo.value.cost = { medicineCost: 0, isDecocted: false, shippingFee: 0 }
    }
    orderInfo.value.cost.isDecocted = !!saved?.cost?.isDecocted

    if (rebuiltOrder) {
      orderInfo.value.prescriptions = rebuiltOrder.prescriptions
      orderInfo.value.items = rebuiltOrder.items
      orderInfo.value.deliveryInfo = {
        ...(orderInfo.value.deliveryInfo || rebuiltOrder.deliveryInfo),
        distributor,
        logistics: '顺丰快递',
        purchaseMethod: !selectedRequiresConsultation.value
          ? '健康产品-在线支付'
          : '药品配送-在线支付',
        shippingPaymentMethod: '到付（货到付款给快递员）'
      }
      orderInfo.value.cost = {
        ...orderInfo.value.cost,
        medicineCost: rebuiltOrder.cost.medicineCost,
        isDecocted: !!orderInfo.value.cost.isDecocted,
        shippingFee: orderInfo.value.cost.shippingFee
      }
    }

    if (orderInfo.value.cost.shippingFee === undefined || orderInfo.value.cost.shippingFee === null) {
      orderInfo.value.cost.shippingFee = 18
    }
    if (!requiresShipping.value) {
      orderInfo.value.cost.shippingFee = 0
    }
    calculateTotal()
    uni.setStorageSync(STORAGE_KEY_CURRENT_ORDER, orderInfo.value)
  } catch (e) {
    console.error('event=ui_order_confirm stage=load_order_info result=failed reason=operation_incomplete')
    uni.showToast({ title: '加载订单失败', icon: 'none' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  }
}

const loadAddresses = async () => {
  if (!isCurrentSession(pageSession)) return
  const addressSelection = uni.getStorageSync('temp_selected_address')
  const selectedId = addressSelection?.id || addressSelection || selectedAddress.value?.id
  uni.removeStorageSync('temp_selected_address')
  if (!requiresShipping.value) {
    selectedAddress.value = null
    return
  }

  try {
    const remoteAddresses = await getAddressList()
    assertCurrentSession(pageSession)
    addresses.value = Array.isArray(remoteAddresses) ? remoteAddresses : []
    selectedAddress.value = null

    // 加载默认地址
    const defaultId = selectedId || uni.getStorageSync(STORAGE_KEY_DEFAULT_ADDRESS_ID)
    let defaultAddr = null

    // 优先使用存储的默认地址ID
    if (defaultId) {
      defaultAddr = addresses.value.find(a => String(a.id) === String(defaultId))
    }

    // 如果没有找到默认地址，尝试从地址列表中找标记为默认的地址
    if (!defaultAddr) {
      defaultAddr = addresses.value.find(a => a.isDefault)
      if (defaultAddr) {
        // 更新默认地址ID到本地存储
        uni.setStorageSync(STORAGE_KEY_DEFAULT_ADDRESS_ID, defaultAddr.id)
      }
    }

    // 如果找到了默认地址，设置为选中状态
    if (defaultAddr) {
      selectedAddress.value = defaultAddr
      // 加载地址后计算快递费
      await calculateShippingFee()
    } else if (addresses.value.length > 0) {
      // 如果没有默认地址，使用第一个
      selectedAddress.value = addresses.value[0]
      // 加载地址后计算快递费
      await calculateShippingFee()
    }
  } catch (e) {
    if (!isCurrentSession(pageSession)) return
    addresses.value = []
    selectedAddress.value = null
    uni.showToast({ title: '地址加载失败，请重试', icon: 'none' })
  }
}

// 计算快递费
const calculateShippingFee = async () => {
  if (!isCurrentSession(pageSession)) return
  if (!requiresShipping.value) {
    console.debug('event=ui_order_confirm stage=shipping_fee result=skipped reason=no_shipping_required')
    orderInfo.value.cost.shippingFee = 0
    calculateTotal()
    uni.setStorageSync(STORAGE_KEY_CURRENT_ORDER, orderInfo.value)
    return
  }
  if (!selectedAddress.value) {
    return
  }

  try {
    calculatingFreight.value = true

    // 调用后端查询运费接口（寄件人信息由后端配置提供）
    const freightParams = {
      expressType: '2', // 2-顺丰标快
      parcelWeight: '1.0', // 默认1kg
      // 只传递收件人信息，寄件人信息由后端配置提供
      destProvince: selectedAddress.value.province,
      destCity: selectedAddress.value.city,
      destDistrict: selectedAddress.value.district,
      destAddress: selectedAddress.value.addressDetail || selectedAddress.value.detail || ''
    }

    console.debug('event=ui_order_confirm stage=shipping_fee result=started')

    const freightResult = await queryFreight(freightParams)

    // 检查响应并提取运费
    if (freightResult && freightResult.freight != null && freightResult.freight !== undefined) {
      // 更新快递费（后端返回的是元，直接使用）
      const freight = parseFloat(freightResult.freight)
      if (!isNaN(freight) && freight >= 0) {
        orderInfo.value.cost.shippingFee = parseFloat(freight.toFixed(2))
        // 重新计算总价
        calculateTotal()
        // 保存更新后的订单信息
        uni.setStorageSync(STORAGE_KEY_CURRENT_ORDER, orderInfo.value)

        console.debug('event=ui_order_confirm stage=shipping_fee result=calculated')
      } else {
        console.warn('event=ui_order_confirm stage=shipping_fee result=fallback reason=invalid_freight_value')
        orderInfo.value.cost.shippingFee = 18
        calculateTotal()
      }
    } else {
      console.warn('event=ui_order_confirm stage=shipping_fee result=fallback reason=missing_freight_value')
      orderInfo.value.cost.shippingFee = 18
      calculateTotal()
    }

  } catch (error) {
    console.error('event=ui_order_confirm stage=shipping_fee result=failed reason=request_failed')
    // 失败时使用默认值
    orderInfo.value.cost.shippingFee = 18
    calculateTotal()
    uni.showToast({
      title: '运费计算失败，使用默认运费',
      icon: 'none',
      duration: 2000
    })
  } finally {
    calculatingFreight.value = false
  }
}

const calculateTotal = () => {
  let total = orderInfo.value.cost.medicineCost
  if (orderInfo.value.cost.isDecocted) {
    // 代煎费用（示例）
    total += 0
  }
  // 到付：运费不计入合计，仅作参考展示
  orderInfo.value.total = total
}

const toggleDecocted = () => {
  orderInfo.value.cost.isDecocted = !orderInfo.value.cost.isDecocted
  calculateTotal()
  // 保存订单信息
  uni.setStorageSync(STORAGE_KEY_CURRENT_ORDER, orderInfo.value)
}

const selectAddress = () => {
  logButtonClick({ ...PAGE_LOG, pageId: prescriptionId.value || '', actionCode: 'CHECKOUT_ADDRESS_SELECT', accessTitle: '选择收货地址', accessDescription: '从订单确认页进入地址列表，为当前订单选择配送地址' })
  uni.navigateTo({
    url: '/pages/order/address_list?select=true'
  })
}

const logCheckoutBlocked = (reason) => logAccess({ ...PAGE_LOG, pageId: prescriptionId.value || '', actionType: 'BEHAVIOR', actionCode: 'ORDER_SUBMIT_RESULT', actionResult: 'FAILED', accessTitle: '提交订单', accessDescription: '订单校验未通过，本次未创建新订单', extraData: { reason } })

const submitOrder = async () => {
  if (submitting.value || !pageActive) return
  submitting.value = true
  let submissionStage = 'VALIDATION'
  try {
    assertCurrentSession(pageSession)
    if (completedOrderId.value) {
      uni.redirectTo({ url: `/pages/order/payment_success?orderId=${completedOrderId.value}` })
      return
    }
    // 记录按钮点击日志
    logButtonClick({ ...PAGE_LOG, pageId: prescriptionId.value || '', actionCode: 'ORDER_SUBMIT', accessTitle: '提交订单', accessDescription: '用户提交订单，开始核对商品、库存与购买条件', extraData: { selectedCount: selectedProductIds.value.length } })

    console.debug('event=ui_order_confirm stage=submit_order result=started')

    // 已生成订单按订单状态续付，不受处方此后过期或商品变更影响。
    if (prescriptionId.value) {
      if (checkoutRouteError.value) throw new Error(checkoutRouteError.value)
      const existing = await getOrderByPrescriptionId(prescriptionId.value)
      if (!pageActive) return
      assertCurrentSession(pageSession)
      if (existing?.id) {
        logAccess({ ...PAGE_LOG, pageId: prescriptionId.value || '', actionType: 'BEHAVIOR', actionCode: 'ORDER_REUSE_RESULT', actionResult: 'SUCCESS', accessTitle: '复用已有处方订单', accessDescription: '当前处方已有订单，本次未重复创建订单', extraData: { orderId: existing.id } })
        if (canPayOrder(existing)) {
          uni.redirectTo({ url: `/pages/order/order-detail?orderId=${existing.id}` })
        } else uni.showToast({ title: '此处方已有订单，请到订单列表查看', icon: 'none' })
        return
      }
    }

    if (promptPatientCompletion()) {
      logCheckoutBlocked('PATIENT_PROFILE_INCOMPLETE')
      return
    }

    const displayedItems = orderInfo.value.items
    await loadProducts()
    if (!pageActive) return
    if (checkoutRouteError.value) throw new Error(checkoutRouteError.value)
    if (!prescriptionId.value && displayedItems.some(item => {
      const entry = selectionEntries.value[item.cartKey || item.id]
      return !entry || Number(entry.quantity) !== Number(item.quantity)
    })) {
      loadOrderInfo()
      logCheckoutBlocked('SELECTION_CHANGED')
      uni.showToast({ title: '购买数量已变化，请核对后重新提交', icon: 'none' })
      return
    }
    // 提交前按最新商品绑定再检查一次；混合结算仍只验证最小商品 ID 的问卷。
    if (!prescriptionId.value) {
      const questionnaireCheck = resolveCheckoutQuestionnaire(loadCartItems(categories.value, false,
        { entries: selectionEntries.value, preserveQuantity: true }))
      if (!questionnaireCheck.valid) {
        logCheckoutBlocked(questionnaireCheck.state === 'required' ? 'QUESTIONNAIRE_REQUIRED' : 'QUESTIONNAIRE_UNAVAILABLE')
        if (questionnaireCheck.state === 'required') {
          uni.navigateTo({ url: buildQuestionnaireNoticeUrl(questionnaireCheck.item, {
            // 答完返回本确认页，保留已选患者、备注及已完成的复诊。
            action: 'repair', quantity: directPurchase.value?.quantity
          }) + directPurchaseQuery(directPurchase.value),
          success: result => result.eventChannel?.on('directPurchaseQuestionnaireAnswered', answer => {
            if (!pageActive || !isCurrentSession(pageSession) || !directPurchase.value) return
            const key = `${answer.productId}:${answer.skuId}`
            if (selectedProductIds.value.length === 1 && selectedProductIds.value[0] === key) {
              directPurchase.value = { ...directPurchase.value, questionnaireId: answer.questionnaireId, answerId: answer.answerId }
            }
          }) })
        } else uni.showToast({ title: questionnaireCheck.message, icon: 'none' })
        return
      }
    }
    loadOrderInfo()
    await loadAddresses()
    await loadCheckoutPatients()
    if (!pageActive) return
    assertCurrentSession(pageSession)
    if (promptPatientCompletion()) {
      logCheckoutBlocked('PATIENT_PROFILE_INCOMPLETE')
      return
    }
    if (requiresShipping.value) {
      if ((!orderInfo.value.cost || orderInfo.value.cost.shippingFee === undefined || orderInfo.value.cost.shippingFee === null)
          && selectedAddress.value) {
        await calculateShippingFee()
        if (!pageActive) return
      }
      if (!selectedAddress.value) {
        logCheckoutBlocked('ADDRESS_REQUIRED')
        uni.showToast({ title: '请选择收货地址', icon: 'none' })
        return
      }
    } else {
      orderInfo.value.cost.shippingFee = 0
    }

    if (!orderInfo.value.items || orderInfo.value.items.length === 0) {
      logCheckoutBlocked('EMPTY_ITEMS')
      uni.showToast({ title: '订单商品不能为空', icon: 'none' })
      return
    }

    const stockCheck = prescriptionId.value
      ? { valid: !!prescription.value && !selectionIssue.value, message: selectionIssue.value }
      : validateCheckoutStock(selectedProductIds.value, categories.value, selectionEntries.value)
    if (!stockCheck.valid) {
      logCheckoutBlocked('STOCK_OR_SELECTION_INVALID')
      console.warn('category=CHECKOUT_STOCK_GUARD action=submit_order result=blocked reason=%s productId=%s quantity=%s latestStock=%s',
        stockCheck.reason,
        stockCheck.productId,
        stockCheck.quantity,
        stockCheck.latestStock
      )
      uni.showToast({ title: stockCheck.message || '商品库存不足，请调整购物车后重试', icon: 'none' })
      return
    }
    loadOrderInfo()

    if (!selectedPatient.value?.id) {
      logCheckoutBlocked('PATIENT_REQUIRED')
      uni.showToast({ title: '请选择就诊人', icon: 'none' })
      return
    }

    try {
      uni.showLoading({ title: '获取支付信息...' })

      if (selectedRequiresConsultation.value) {
        if (!checkoutContext.value) throw new Error('缺少本次复诊和就诊人信息，请返回重新申请')
        const consultation = await getConsultationDetail(checkoutContext.value.consultationId)
        if (!pageActive) return
        requireConsultationPatient(consultation, checkoutContext.value)
      }
      assertCurrentSession(pageSession)
      const wechatInfo = await ensureWeChatIdentity()
      if (!pageActive) return
      assertCurrentSession(pageSession)
      const openid = wechatInfo && wechatInfo.openid
      if (!openid) {
        throw new Error('未获取到微信支付信息，请稍后重试')
      }

      uni.showLoading({ title: '提交中...' })

      // ✅ 调用后端API创建订单
      const orderData = {
        patientId: selectedPatient.value.id,
        items: orderInfo.value.items.map(item => ({
          productId: item.productId,
          skuId: item.skuId || null,
          quantity: item.quantity
        })),
        remark: orderRemark.value.trim(),
      }
      // 实物与疗法同单时仍配送；复诊只约束其中的制剂，其他商品随同结算。
      if (requiresShipping.value) orderData.addressId = selectedAddress.value.id
      if (selectedRequiresConsultation.value) {
        orderData.consultationId = checkoutContext.value.consultationId
        orderData.patientId = checkoutContext.value.patientId
      }
      console.debug('event=ui_order_confirm stage=order_create_request result=prepared')
      assertCurrentSession(pageSession)
      const requestData = prescriptionId.value
        ? { prescriptionId: prescriptionId.value, addressId: selectedAddress.value.id, remark: orderRemark.value.trim() }
        : orderData
      const cartSnapshot = prescriptionId.value || directPurchase.value ? null
        : Object.fromEntries(orderInfo.value.items.map(item => {
          const key = item.cartKey || item.id, entry = selectionEntries.value[key]
          return [key, { revision: entry.revision, quantity: entry.quantity, timestamp: entry.timestamp,
            serverCartItemId: entry.serverCartItemId, serverCartVersion: entry.serverCartVersion }]
        }))
      const attempt = getOrderSubmission(prescriptionId.value ? 'prescription' : 'goods', requestData, cartSnapshot)
      submissionStage = 'ORDER_CREATE'
      const order = prescriptionId.value
        ? await createOrderFromPrescription({ ...requestData, requestId: attempt.requestId })
        : await createOrder({ ...requestData, requestId: attempt.requestId })
      if (!pageActive) return
      assertCurrentSession(pageSession)

      console.debug('event=ui_order_confirm stage=order_create_response result=received')

      uni.hideLoading()

      const orderId = order.id
      rememberCreatedOrder(orderId, attempt)
      if (Number(order.orderStatus) === 4) {
        logAccess({ ...PAGE_LOG, pageId: prescriptionId.value || '', actionType: 'BEHAVIOR', actionCode: 'ORDER_CREATE_RESULT', actionResult: 'FAILED', accessTitle: '提交订单', accessDescription: '服务端返回的原订单已取消，本次无法继续付款', extraData: { orderId: orderId || '', reason: 'ORDER_CANCELLED' } })
        forgetOrderSubmission(orderId)
        uni.showToast({ title: '原订单已取消，请重新提交', icon: 'none' })
        return
      }
      if (Number(order.payStatus) === 1) {
        logAccess({ ...PAGE_LOG, pageId: prescriptionId.value || '', actionType: 'BEHAVIOR', actionCode: 'ORDER_CREATE_RESULT', actionResult: 'SUCCESS', accessTitle: '订单已确认', accessDescription: '服务端已返回已有付款记录的订单，进入结果页继续确认履约状态', extraData: { orderId: orderId || '' } })
        releaseOrderSubmission(orderId)
        completedOrderId.value = orderId
        uni.redirectTo({ url: `/pages/order/payment_success?orderId=${orderId}` })
        return
      }
      // 创建成功后的应付金额以后台成交金额为准，支付页仍需确认服务端支付状态。
      orderInfo.value.total = Number(order.payableAmount ?? orderInfo.value.total)

      if (!orderId) {
        logAccess({ ...PAGE_LOG, pageId: prescriptionId.value || '', actionType: 'BEHAVIOR', actionCode: 'ORDER_CREATE_RESULT', actionResult: 'UNKNOWN', accessTitle: '提交订单', accessDescription: '服务端响应未包含订单标识，创建结果尚待确认', extraData: { reason: 'ORDER_ID_MISSING' } })
        console.error('event=ui_order_confirm stage=payment_prepare result=rejected reason=missing_order_id')
        uni.showToast({ title: '订单创建失败，请重试', icon: 'none' })
        return
      }

      console.debug('event=ui_order_confirm stage=payment_prepare result=started')
      logAccess({ ...PAGE_LOG, pageId: prescriptionId.value || '', actionType: 'BEHAVIOR', actionCode: 'ORDER_CREATE_RESULT', actionResult: 'SUCCESS', accessTitle: '订单已创建', accessDescription: '服务端已返回可继续付款的订单，尚不代表付款完成', extraData: { orderId } })

      try {
        submissionStage = 'PAYMENT'
        console.debug('event=ui_order_confirm stage=payment_request result=started')

        const payResult = await wechatSinglePay(orderId, {
          openid,
          totalAmount: orderInfo.value.total
        })
        if (!pageActive) return
        assertCurrentSession(pageSession)
        console.debug('event=ui_order_confirm stage=payment_client result=completed')
        logAccess({ ...PAGE_LOG, pageId: prescriptionId.value || '', actionType: 'BEHAVIOR', actionCode: 'CHECKOUT_PAYMENT_CLIENT_RESULT', actionResult: 'UNKNOWN', accessTitle: '客户端付款已提交', accessDescription: '微信客户端付款提交已返回，实际到账和履约状态仍需服务端确认', extraData: { orderId, sdkState: 'SUBMITTED' } })
        const itemCount = (orderInfo.value.items || []).reduce((sum, item) => {
          const quantity = Number(item.quantity || 1)
          return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1)
        }, 0)
        // 支付成功页重新查询订单快照，不使用路由标记决定配送或核销。
        const paymentSuccessParams = {
          orderId,
          amount: orderInfo.value.total,
          outTradeNo: payResult.outTradeNo || '',
          paymentType: 'single',
          orderNo: order.orderNo || '',
          itemCount
        }
        const paymentSuccessUrl = '/pages/order/payment_success?' + Object.entries(paymentSuccessParams)
          .filter(([, value]) => value !== undefined && value !== null && value !== '')
          .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
          .join('&')
        console.debug('event=ui_order_confirm stage=payment_navigation result=prepared')
        uni.redirectTo({
          url: paymentSuccessUrl,
          success: () => {
            console.debug('event=ui_order_confirm stage=payment_navigation result=success')
          },
          fail: () => {
            console.error('event=ui_order_confirm stage=payment_navigation result=failed reason=navigation_failed')
          },
          complete: () => {
            console.debug('event=ui_order_confirm stage=payment_navigation result=completed')
          }
        })
      } catch (error) {
        if (!pageActive || error.code === 'SESSION_CHANGED') return
        if (!isCurrentSession(pageSession)) return
        logAccess({ ...PAGE_LOG, pageId: prescriptionId.value || '', actionType: 'BEHAVIOR', actionCode: 'CHECKOUT_PAYMENT_CLIENT_RESULT', actionResult: getActionFailureResult(error), accessTitle: '发起订单支付', accessDescription: '本次付款未获得服务端支付成功确认', extraData: { orderId, reason: error.message === '用户取消支付' ? 'USER_CANCELLED' : 'PAYMENT_NOT_CONFIRMED' } })
        console.error('event=ui_order_confirm stage=payment_request result=failed reason=payment_call_failed')

        // 判断是否是用户取消
        if (error.message === '用户取消支付') {
          // 用户取消，跳转到订单详情
          uni.showModal({
            title: '支付已取消',
            content: '订单尚未支付，可在订单详情查看或取消后重新下单',
            showCancel: false,
            success: () => {
              if (!isCurrentSession(pageSession)) return
              uni.redirectTo({
                url: `/pages/order/order-detail?orderId=${orderId}`
              })
            }
          })
        } else {
          // 支付失败，跳转到订单详情
          uni.showModal({
            title: '支付失败',
            content: error.message || '支付过程中出现错误，请稍后重试',
            showCancel: false,
            success: () => {
              if (!isCurrentSession(pageSession)) return
              uni.redirectTo({
                url: `/pages/order/order-detail?orderId=${orderId}`
              })
            }
          })
        }
      }

    } catch (error) {
      if (!pageActive || error.code === 'SESSION_CHANGED') return
      if (!isCurrentSession(pageSession)) return
      logAccess({ ...PAGE_LOG, pageId: prescriptionId.value || '', actionType: 'BEHAVIOR', actionCode: submissionStage === 'ORDER_CREATE' ? 'ORDER_CREATE_RESULT' : 'ORDER_SUBMIT_RESULT', actionResult: submissionStage === 'VALIDATION' ? 'FAILED' : getActionFailureResult(error), accessTitle: '提交订单', accessDescription: submissionStage === 'VALIDATION' ? '订单创建前的购买条件校验未通过' : '订单创建未获得服务端成功确认', extraData: { reason: submissionStage === 'VALIDATION' ? 'CHECKOUT_VALIDATION_FAILED' : 'CREATE_NOT_CONFIRMED' } })
      console.error('event=ui_order_confirm stage=submit_order result=failed reason=order_or_payment_failed')
      uni.hideLoading()
      uni.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'none'
      })
    }
  } catch (error) {
    if (pageActive && isCurrentSession(pageSession) && error?.code !== 'SESSION_CHANGED') logCheckoutBlocked('CHECKOUT_VALIDATION_FAILED')
    if (pageActive && error?.code !== 'SESSION_CHANGED') uni.showToast({ title: error.message || '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.page {
  background: #f6f7fb;
  min-height: 100vh;
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}

.body {
  flex: 1;
}

.section {
  background: #fff;
  border-radius: 8rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.therapy-tip-section {
  background: linear-gradient(135deg, #f0f9ff 0%, #ecfeff 100%);
  border: 1rpx solid rgba(37, 99, 235, 0.12);
}

.therapy-tip-badge {
  display: inline-block;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
  font-size: 22rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
}

.therapy-tip-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 8rpx;
}

.therapy-tip-desc {
  font-size: 24rpx;
  color: #64748b;
  line-height: 1.6;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
}

.patient-section-title,
.patient-selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.patient-selector {
  padding: 12rpx 0;
  color: #333;
  font-size: 28rpx;
}

.patient-manage {
  color: #2a82e4;
  font-size: 24rpx;
  font-weight: 400;
}

.patient-label {
  margin-right: 20rpx;
  color: #64748b;
  font-size: 24rpx;
}

.patient-remove {
  margin: 0;
  padding: 0 16rpx;
  background: transparent;
  color: #d4380d;
  font-size: 24rpx;
  line-height: 2;
}

.patient-list-title {
  margin-top: 24rpx;
  font-size: 26rpx;
  color: #333;
}

.patient-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin: 16rpx 0 0;
  padding: 18rpx 20rpx;
  border: 1rpx solid #e5e5e5;
  border-radius: 12rpx;
  background: #fafafa;
  text-align: left;
  font-size: 28rpx;
  line-height: 1.6;
}

.patient-option.active {
  border-color: #2a82e4;
  background: #eef6ff;
}

.patient-option-info {
  display: flex;
  flex-direction: column;
}

.patient-meta {
  color: #64748b;
  font-size: 24rpx;
}

.patient-profile-notice,
.patient-profile-note {
  color: #a15c00;
  font-size: 24rpx;
  line-height: 1.6;
}

.patient-profile-notice {
  margin-top: 12rpx;
  padding: 12rpx 16rpx;
  background: #fff6e5;
  text-align: left;
}

.patient-profile-notice::after {
  border: none;
}

.patient-add {
  margin-top: 20rpx;
  color: #2a82e4;
  background: #eef6ff;
  font-size: 26rpx;
}

.patient-option::after,
.patient-remove::after,
.patient-add::after {
  border: none;
}

.patient-note {
  display: block;
  margin-top: 12rpx;
  color: #64748b;
  font-size: 24rpx;
  line-height: 1.6;
}

.remark-field {
  position: relative;
}

.remark-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 160rpx;
  padding: 20rpx 20rpx 52rpx;
  border: 1rpx solid #e5e5e5;
  border-radius: 8rpx;
  background: #fafafa;
  color: #333;
  font-size: 28rpx;
  line-height: 1.5;
}

.remark-placeholder {
  color: #aaa;
}

.remark-count {
  position: absolute;
  right: 16rpx;
  bottom: 14rpx;
  color: #999;
  font-size: 22rpx;
}

.address-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  padding-right: 60rpx;
}

.address-content {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.address-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx 20rpx;
  margin-bottom: 12rpx;
}

.name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  max-width: 100%;
  word-break: break-all;
}

.phone {
  font-size: 28rpx;
  color: #666;
  white-space: nowrap;
}

.address-detail {
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
  word-break: break-all;
}

.address-empty {
  flex: 1;
  font-size: 28rpx;
  color: #999;
}

.address-arrow {
  position: absolute;
  right: 20rpx;
  top: 50%;
  transform: translateY(-50%);
  color: #999;
  font-size: 28rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.info-row:last-child {
  border-bottom: none;
}

.label {
  font-size: 28rpx;
  color: #666;
}

.value {
  font-size: 28rpx;
  color: #333;
}

.value-container {
  display: flex;
  align-items: center;
}

.value.calculating {
  color: #999;
  font-size: 24rpx;
}

.label-with-note {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.freight-note {
  font-size: 20rpx;
  color: #ff9900;
}

.freight-ref {
  color: #999;
}

.order-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.order-item:last-child {
  border-bottom: none;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.item-name {
  font-size: 28rpx;
  color: #333;
}

.item-type {
  font-size: 24rpx;
  color: #999;
}

.item-price {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
}

.cost-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.cost-row:last-child {
  border-bottom: none;
}

.label-with-checkbox {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #ddd;
  border-radius: 50%;
  position: relative;
}

.checkbox.checked {
  background: #2a82e4;
  border-color: #2a82e4;
}

.checkbox.checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  font-size: 24rpx;
}

.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -4rpx 12rpx rgba(0,0,0,0.1);
  z-index: 100;
}

.footer-left {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.total-label {
  font-size: 28rpx;
  color: #666;
}

.total-price {
  font-size: 36rpx;
  font-weight: 600;
  color: #ff4d4f;
}

.submit-btn {
  background: #2a82e4;
  color: #fff;
  font-size: 30rpx;
  padding: 0rpx 40rpx;
  border-radius: 50rpx;
  border: none;
  margin: 0;

}

.submit-btn.disabled {
  background: #ccc;
  color: #999;
  pointer-events: auto;
}
</style>
