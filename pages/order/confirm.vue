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
          <picker
            :range="patients"
            range-key="name"
            :value="patientIndex"
            :disabled="requiresConsultationPatient || loadingPatients"
            @change="selectPatient"
          >
            <view class="patient-selector">
              <text>{{ selectedPatient ? selectedPatient.name : (loadingPatients ? '加载中...' : '请选择就诊人') }}</text>
              <uni-icons
                v-if="!requiresConsultationPatient"
                type="right"
                size="20"
                color="#999"
              />
            </view>
          </picker>
          <text class="patient-note">
            {{ requiresConsultationPatient ? '使用本次复诊的就诊人' : '每笔订单仅用于一位就诊人，请核对后提交。' }}
          </text>
          <text
            v-if="selectedPatient && patientHisSyncNotice(selectedPatient.hisBindingStatus)"
            class="patient-note"
          >
            医院信息待同步，可先核对就诊人资料。
          </text>
          <text
            v-if="!loadingPatients && !patients.length"
            class="patient-note"
          >
            请先在“管理就诊人”中添加就诊人。
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
import { ref, computed, onMounted } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import {
  STORAGE_KEY_CURRENT_ORDER,
  STORAGE_KEY_DEFAULT_ADDRESS_ID
} from '@/utils/storage.js'
import { buildOrderInfo, getCartEntries, getCurrentCheckoutProductIds, loadCartItems, setCheckoutProductIds, validateCheckoutStock } from '@/utils/cart.js'
import { createOrder, createOrderFromPrescription, getOrderByPrescriptionId } from '@/api/order.js'
import { getConsultationDetail, getPrescriptionDetail, getPrescriptionItems } from '@/api/consultation.js'
import { parseConsultationContext, requireConsultationPatient } from '@/utils/consultation-checkout.js'
import { getSessionGeneration, assertCurrentSession, isCurrentSession } from '@/utils/session.js'
import { getAddressList } from '@/api/address.js'
import { getPatientList } from '@/api/patient.js'
import { patientHisSyncNotice } from '@/utils/patient.js'
import { wechatSinglePay } from '@/api/payment.js'
import { getProductDetail } from '@/api/product.js'
import { loadCartProducts } from '@/utils/cart-products.js'
import { resolveProductSku, withProductSku } from '@/utils/product-sku.js'
import { ensureWeChatIdentity } from '@/api/auth.js'
import { queryFreight } from '@/api/express.js'
import { logPageView, logButtonClick } from '@/api/access-log.js'
import { resolveProductFlow } from '@/utils/product-biz.js'
import { resolveCheckoutQuestionnaire, buildQuestionnaireNoticeUrl } from '@/utils/questionnaire-state.js'

const isTherapyOrder = ref(false)
const checkoutContext = ref(null)
const prescriptionId = ref(null)
const prescription = ref(null)
const prescriptionLoadError = ref('')
const submitting = ref(false)
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

const requiresShipping = computed(() => selectedRequiresShipping.value)
const requiresConsultationPatient = computed(() => selectedRequiresConsultation.value)
const patientIndex = computed(() => Math.max(0, patients.value.findIndex(patient => String(patient.id) === String(selectedPatient.value?.id))))
const selectionIssue = computed(() => {
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
  prescriptionId.value = /^[1-9]\d*$/.test(String(options?.prescriptionId || '')) ? Number(options.prescriptionId) : null
  checkoutContext.value = parseConsultationContext(options)
  if (options?.selectedItems) {
    selectedProductIds.value = options.selectedItems.split(',').filter(id => id.trim())
    setCheckoutProductIds(selectedProductIds.value)
  } else if (!prescriptionId.value) {
    selectedProductIds.value = getCurrentCheckoutProductIds()
  }
})

onMounted(() => {
  // 记录页面访问日志
  logPageView('下单页面', '用户进入下单页面')

})

onShow(async () => {
  await loadProducts()
  loadOrderInfo()
  await loadAddresses()
  await loadCheckoutPatients()
})

const loadCheckoutPatients = async () => {
  if (!isCurrentSession(pageSession)) return
  loadingPatients.value = true
  try {
    const result = await getPatientList()
    assertCurrentSession(pageSession)
    patients.value = Array.isArray(result) ? result : []
    const patientId = requiresConsultationPatient.value
      ? checkoutContext.value?.patientId
      : selectedPatient.value?.id
    selectedPatient.value = patients.value.find(patient => String(patient.id) === String(patientId))
      || (!requiresConsultationPatient.value && patientId == null && patients.value.length === 1 ? patients.value[0] : null)
  } catch (error) {
    if (!isCurrentSession(pageSession)) return
    patients.value = []
    selectedPatient.value = null
    uni.showToast({ title: error?.message || '就诊人加载失败，请重试', icon: 'none' })
  } finally {
    if (isCurrentSession(pageSession)) loadingPatients.value = false
  }
}

const selectPatient = (event) => {
  if (requiresConsultationPatient.value) return
  selectedPatient.value = patients.value[Number(event.detail.value)] || null
}

const managePatients = () => uni.navigateTo({ url: '/pages/user/patient_list' })

// 加载产品数据（只加载购物车中选中的商品）
const loadProducts = async () => {
  if (!isCurrentSession(pageSession)) return []
  if (prescriptionId.value) return loadPrescriptionProducts()
  try {
    const currentSelectedIds = selectedProductIds.value.length > 0
      ? selectedProductIds.value
      : getCurrentCheckoutProductIds()

    if (currentSelectedIds.length === 0) {
      // 如果没有选中的商品，清空分类数据
      categories.value = []
      return []
    }
    setCheckoutProductIds(currentSelectedIds)

    console.debug('event=ui_order_confirm stage=products result=started source=server')
    uni.showLoading({ title: '加载商品...' })

    // 为选中的商品创建虚拟分类结构
    const cartCategory = {
      id: 'selected_items',
      name: '订单商品',
      products: []
    }
    const cartEntries = getCartEntries()

    cartCategory.products = await loadCartProducts(currentSelectedIds, cartEntries, getProductDetail)

    if (!pageActive) return []
    assertCurrentSession(pageSession)
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
      : categories.value.length > 0 ? loadCartItems(categories.value) : []
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
  uni.navigateTo({
    url: '/pages/order/address_list?select=true'
  })
}

const submitOrder = async () => {
  if (submitting.value || !pageActive) return
  submitting.value = true
  try {
    assertCurrentSession(pageSession)
    // 记录按钮点击日志
    logButtonClick('下单页面', '用户点击下单按钮')

    console.debug('event=ui_order_confirm stage=submit_order result=started')

    await loadProducts()
    if (!pageActive) return
    // 提交前按最新商品绑定再检查一次；混合结算仍只验证最小商品 ID 的问卷。
    if (!prescriptionId.value) {
      const questionnaireCheck = resolveCheckoutQuestionnaire(loadCartItems(categories.value))
      if (!questionnaireCheck.valid) {
        if (questionnaireCheck.state === 'required') {
          uni.navigateTo({ url: buildQuestionnaireNoticeUrl(questionnaireCheck.item, {
            // 答完返回本确认页，保留已选患者、备注及已完成的复诊。
            action: 'repair'
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
    if (requiresShipping.value) {
      if ((!orderInfo.value.cost || orderInfo.value.cost.shippingFee === undefined || orderInfo.value.cost.shippingFee === null)
          && selectedAddress.value) {
        await calculateShippingFee()
        if (!pageActive) return
      }
      if (!selectedAddress.value) {
        uni.showToast({ title: '请选择收货地址', icon: 'none' })
        return
      }
    } else {
      orderInfo.value.cost.shippingFee = 0
    }

    if (!orderInfo.value.items || orderInfo.value.items.length === 0) {
      uni.showToast({ title: '订单商品不能为空', icon: 'none' })
      return
    }

    const stockCheck = prescriptionId.value
      ? { valid: !!prescription.value && !selectionIssue.value, message: selectionIssue.value }
      : validateCheckoutStock(selectedProductIds.value, categories.value)
    if (!stockCheck.valid) {
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
      uni.showToast({ title: '请选择就诊人', icon: 'none' })
      return
    }

    try {
      // 从旧链接进入确认页也先核实已有订单；待付续付原单，已付款不重复创建。
      if (prescriptionId.value) {
        const existing = await getOrderByPrescriptionId(prescriptionId.value)
        if (!pageActive) return
        assertCurrentSession(pageSession)
        if (existing?.id) {
          if (Number(existing.payStatus) === 0 && Number(existing.orderStatus) === 0) {
            uni.redirectTo({ url: `/pages/order/order-detail?orderId=${existing.id}` })
          } else uni.showToast({ title: '此处方已有订单，请到订单列表查看', icon: 'none' })
          return
        }
      }
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
        shippingFee: 0,
        patientId: selectedPatient.value.id,
        items: orderInfo.value.items.map(item => ({
          productId: item.productId,
          skuId: item.skuId || null,
          quantity: item.quantity || 1,
          price: item.price
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
      const order = prescriptionId.value
        ? await createOrderFromPrescription({ prescriptionId: prescriptionId.value, addressId: selectedAddress.value.id, remark: orderRemark.value.trim() })
        : await createOrder(orderData)
      if (!pageActive) return
      assertCurrentSession(pageSession)

      console.debug('event=ui_order_confirm stage=order_create_response result=received')

      uni.hideLoading()

      const orderId = order.id
      // 创建成功后的应付金额以后台成交金额为准，支付页仍需确认服务端支付状态。
      orderInfo.value.total = Number(order.payableAmount ?? orderInfo.value.total)

      if (!orderId) {
        console.error('event=ui_order_confirm stage=payment_prepare result=rejected reason=missing_order_id')
        uni.showToast({ title: '订单创建失败，请重试', icon: 'none' })
        return
      }

      console.debug('event=ui_order_confirm stage=payment_prepare result=started')

      try {
        console.debug('event=ui_order_confirm stage=payment_request result=started')

        const payResult = await wechatSinglePay(orderId, {
          openid,
          totalAmount: orderInfo.value.total
        })
        if (!pageActive) return
        assertCurrentSession(pageSession)
        console.debug('event=ui_order_confirm stage=payment_client result=completed')
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
      console.error('event=ui_order_confirm stage=submit_order result=failed reason=order_or_payment_failed')
      uni.hideLoading()
      uni.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'none'
      })
    }
  } catch (error) {
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
