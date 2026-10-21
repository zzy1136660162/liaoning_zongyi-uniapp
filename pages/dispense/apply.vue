<template>
  <view class="page">
    <!-- 状态栏占位（适配刘海等）-->
    <view class="safe-top" />


    <view style="padding: 20rpx;">
      <!-- 页面内容 -->
      <scroll-view
        class="body body-scroll"
        scroll-y
      >
        <!-- 指定药品 卡片 -->
        <view class="card">
          <view
            v-for="(item, index) in cartItems"
            :key="item.id"
            class="card-body"
            :style="{marginBottom: index < cartItems.length - 1 ? '20rpx' : '0'}"
          >
            <view class="med-left">
              <image
                class="med-thumb"
                :src="getImageUrl(item.image)"
                mode="aspectFill"
              />
              <view
                v-if="item.quantity"
                class="med-qty"
              >
                {{ item.quantity }}
              </view>
            </view>

            <view class="med-right">
              <view class="med-name">
                {{ item.name }}
              </view>
              <view class="med-price-row">
                <view class="med-price">
                  ¥{{ item.price.toFixed(2) }}
                </view>
                <uni-number-box
                  :key="`${item.id}-${quantityRenderVersion}`"
                  :value="item.quantity || 1"
                  :min="1"
                  :max="99"
                  size="small"
                  @change="(val) => onQuantityChange(item, val)"
                />
              </view>
            </view>
          </view>
        </view>

        <!-- 就诊人信息 -->
        <view class="section">
          <view class="section-title patient-section-title">
            <text>就诊人信息</text>
            <text
              class="patient-manage"
              @click="onManagePatients"
            >
              管理就诊人
            </text>
          </view>

          <view class="patient-row">
            <view class="label">
              <text class="required">
                *
              </text> 本次已选就诊人
            </view>
            <view
              v-if="selectedPatient"
              class="patient-selected"
            >
              <view class="patient-info">
                <text class="patient-name">
                  {{ selectedPatient.name }}
                </text>
                <text class="patient-meta">
                  {{ selectedPatient.gender || '性别待完善' }} · {{ selectedPatient.birthDate ? selectedPatient.age + '岁' : '年龄待完善' }}
                </text>
                <text class="patient-meta">
                  {{ selectedPatient.idType || '证件' }} {{ selectedPatient.idNumberMasked || '未完善' }}
                </text>
                <text
                  v-if="getPatientProfileNotice(selectedPatient)"
                  class="patient-profile-notice"
                >
                  {{ getPatientProfileNotice(selectedPatient) }}
                </text>
              </view>
              <button
                class="patient-remove"
                @click="removeSelectedPatient"
              >
                移除
              </button>
            </view>
            <view
              v-else
              class="patient-note"
            >
              请从下方选择一位就诊人
            </view>
            <view class="patient-note">
              每笔订单仅用于一位就诊人，移除仅取消本次选择。
            </view>

            <view class="label patient-list-title">
              可选就诊人（单选）
            </view>
            <view class="patients">
              <button
                v-for="p in patients"
                :key="p.id"
                class="patient-item"
                :class="{ active: selectedPatient && String(selectedPatient.id) === String(p.id) }"
                @click="selectPatient(p)"
              >
                <view class="patient-info">
                  <text class="patient-name">
                    {{ p.name }}
                  </text>
                  <text class="patient-meta">
                    {{ p.gender || '性别待完善' }} · {{ p.birthDate ? p.age + '岁' : '年龄待完善' }}
                  </text>
                  <text class="patient-meta">
                    {{ p.idType || '证件' }} {{ p.idNumberMasked || '未完善' }}
                  </text>
                  <text
                    v-if="getPatientProfileNotice(p)"
                    class="patient-profile-notice"
                  >
                    待完善：{{ getPatientProfileNotice(p) }}
                  </text>
                </view>
                <uni-icons
                  :type="selectedPatient && String(selectedPatient.id) === String(p.id) ? 'circle-filled' : 'circle'"
                  size="22"
                  color="#4a90e2"
                />
              </button>
              <view
                v-if="!patients.length"
                class="patient-note"
              >
                还没有就诊人，请先添加。
              </view>
              <button
                class="patient-add"
                @click="onAddPatient"
              >
                ＋ 添加就诊人
              </button>
              <view class="patient-note">
                当前账号下同一身份证无需重复添加，请直接选择已有就诊人。
              </view>
            </view>
          </view>

          <view
            v-if="selectedRequiresConsultation"
            class="consultation-mode-row"
          >
            <view class="label">
              接诊方式
            </view>

            <view class="consultation-mode-switch">
              <view
                class="consultation-mode-item"
                :class="{ active: consultationMode === CONSULTATION_MODE_AI }"
                @click="selectConsultationMode(CONSULTATION_MODE_AI)"
              >
                在线实时接诊开方
              </view>
              <view
                class="consultation-mode-item"
                :class="{ active: consultationMode === CONSULTATION_MODE_MANUAL }"
                @click="selectConsultationMode(CONSULTATION_MODE_MANUAL)"
              >
                指定医生接诊开方
              </view>
            </view>
          </view>
        </view>

        <!-- 占位（让页面更接近你示意图的空白） -->
        <view style="height: 40vh" />
      </scroll-view>
    </view>

    <!-- 协议弹窗 -->
    <view
      v-if="showAgreement"
      class="agreement-popup-mask"
      @click="showAgreement = false"
    >
      <view
        class="agreement-popup"
        @click.stop
      >
        <view class="popup-header">
          <text class="popup-title">互联网诊疗风险告知及知情同意书</text>
          <view
            class="popup-close"
            @click="showAgreement = false"
          >
            <uni-icons
              type="close"
              size="20"
              color="#999"
            />
          </view>
        </view>
        <scroll-view
          class="popup-content"
          scroll-y
        >
          <text class="agreement-full">{{ agreementContent }}</text>
        </scroll-view>
        <view class="popup-footer">
          <button
            class="popup-btn"
            @click="showAgreement = false; agreementChecked = true"
          >
            我已阅读并同意
          </button>
        </view>
      </view>
    </view>

    <!-- 底部固定提交栏 -->
    <view class="footer">
      <view class="agreement-wrapper">
        <view
          class="checkbox"
          @click="agreementChecked = !agreementChecked"
        >
          <uni-icons
            :type="agreementChecked ? 'checkbox-filled' : 'circle'"
            :color="agreementChecked ? '#4a90e2' : '#ccc'"
            size="20"
          />
        </view>
        <view class="agreement-text">
          <text>确认已在线下就诊，使用过所购买药品且无过敏或不良反应，当前病情稳定，我已阅读并同意</text>
          <text
            class="agreement-link"
            @click="showAgreementDialog">《互联网诊疗风险告知及知情同意书》</text>
        </view>
      </view>

      <view class="footer-bottom">
        <view class="footer-left">
          <view class="icon-bag">
            <uni-icons
              type="cart"
              size="24"
              color="#4a90e2"
            />
            <text
              v-if="totalQuantity > 0"
              class="badge"
            >
              {{ totalQuantity }}
            </text>
          </view>
          <view class="total">
            <text class="price">
              ¥{{ totalPrice.toFixed(2) }}
            </text>
            <text class="note">
              不含邮费，实际金额以结算为准
            </text>
          </view>
        </view>

        <button
          class="submit-btn"
          :class="{'disabled': !agreementChecked}"
          type="primary"
          @click="onSubmit"
        >
          提&nbsp;交
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { logPageView, logButtonClick, logAccess } from '@/utils/accessLog.js'

const PAGE_LOG = { moduleCode: 'CONSULTATION', accessType: '在线诊疗', pageType: 'DISPENSE_APPLY', requestUri: '/pages/dispense/apply', pageId: '' }
import { getSessionGeneration, assertCurrentSession, isCurrentSession } from '@/utils/session.js'
const pageSession = getSessionGeneration()
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { STORAGE_KEY_CURRENT_CONSULTATION_ID } from '@/utils/storage.js'
import {
  calculateTotalPrice,
  calculateTotalQuantity,
  getCurrentCheckoutProductIds,
  loadCartItems,
  setCheckoutProductIds,
  setCartItemQuantity,
  refreshCart,
} from '@/utils/cart.js'
import { parseDirectPurchase, directPurchaseQuery, checkoutEntries } from '@/utils/checkout.js'
import { getPatientList } from '@/api/patient.js'
import { getPatientProfileNotice } from '@/utils/patient.js'
import { loadCartProducts } from '@/utils/cart-products.js'
import { getProductDetail } from '@/api/product.js'
import { getImageUrl } from '@/utils/config.js'
import { resolveProductFlow } from '@/utils/product-biz.js'
import {
  CONSULTATION_MODE_AI,
  CONSULTATION_MODE_MANUAL,
  getConsultationDoctorByMode
} from '@/utils/consultation-mode.js'

const cartItems = ref([])
const quantityRenderVersion = ref(0)
const categories = ref([])
const selectedItems = ref([])
const directPurchase = ref(null)
const checkoutRouteError = ref('')
const patients = ref([])
const selectedPatient = ref(null)
const selectedRequiresConsultation = ref(true)
const agreementChecked = ref(false)
const showAgreement = ref(false)
const consultationMode = ref(CONSULTATION_MODE_AI)
let pageActive = true
let routeReady = false
let patientRefreshId = 0
let preferredPatientId = null
let patientSelectionInitialized = false
let patientSelectionVersion = 0

const totalPrice = computed(() => calculateTotalPrice(cartItems.value))
const totalQuantity = computed(() => calculateTotalQuantity(cartItems.value))

const loadPatientsFromAPI = async (preferredId = null) => {
  if (!pageActive || !isCurrentSession(pageSession)) return
  const requestId = ++patientRefreshId
  const selectionVersion = patientSelectionVersion
  try {
    uni.showLoading({ title: '加载中...' })
    const patientList = await getPatientList()
    if (!pageActive || requestId !== patientRefreshId) return
    assertCurrentSession(pageSession)
    const currentSelectedId = selectionVersion === patientSelectionVersion
      ? preferredId ?? selectedPatient.value?.id
      : selectedPatient.value?.id
    patients.value = Array.isArray(patientList) ? patientList : []
    selectedPatient.value = patients.value.find(p => String(p.id) === String(currentSelectedId))
      || (!patientSelectionInitialized && currentSelectedId == null && patients.value.length === 1 ? patients.value[0] : null)
    patientSelectionInitialized = true
    if (preferredPatientId === preferredId) preferredPatientId = null
  } catch (error) {
    if (!pageActive || requestId !== patientRefreshId || !isCurrentSession(pageSession)) return
    console.error('loadPatientsFromAPI failed:', error)
    patients.value = []
    selectedPatient.value = null
    uni.showToast({ title: error?.message || '就诊人加载失败', icon: 'none' })
  } finally {
    if (pageActive && requestId === patientRefreshId && isCurrentSession(pageSession)) uni.hideLoading()
  }
}

const handlePatientChanged = (payload = {}) => {
  if (pageActive && isCurrentSession(pageSession)) preferredPatientId = payload.patientId ?? null
}

const loadProducts = async () => {
  if (!pageActive || !isCurrentSession(pageSession)) return
  try {
    if (checkoutRouteError.value) throw new Error(checkoutRouteError.value)
    if (!directPurchase.value) await refreshCart()
    if (!pageActive || !isCurrentSession(pageSession)) return
    const requestedIds = selectedItems.value.length > 0 ? selectedItems.value : getCurrentCheckoutProductIds()
    if (requestedIds.length === 0) {
      uni.showToast({ title: '购物车为空', icon: 'none' })
      setTimeout(() => { if (pageActive && isCurrentSession(pageSession)) uni.navigateBack() }, 1200)
      return
    }

    const checkoutCategory = {
      id: 'checkout_items',
      name: '待结算商品',
      products: []
    }

    uni.showLoading({ title: '加载商品...' })
    const cartEntries = checkoutEntries(requestedIds, directPurchase.value)
    checkoutCategory.products = await loadCartProducts(requestedIds, cartEntries, getProductDetail)
    if (!pageActive) return
    assertCurrentSession(pageSession)
    if (checkoutCategory.products.some(product => product.loadFailure || product.available === false)) {
      throw new Error('所选商品或规格已失效，请返回购物车核对')
    }

    categories.value = [checkoutCategory]
    const selectedSet = new Set(requestedIds.map(id => String(id)))
    cartItems.value = loadCartItems(categories.value, false,
      { entries: cartEntries, preserveQuantity: true }).filter(item => selectedSet.has(String(item.id)))

    if (cartItems.value.length === 0) {
      uni.showToast({ title: '购物车为空', icon: 'none' })
      setTimeout(() => { if (pageActive && isCurrentSession(pageSession)) uni.navigateBack() }, 1200)
      return
    }

    const flow = resolveProductFlow(cartItems.value)
    if (!flow.valid) {
      uni.showToast({ title: flow.message, icon: 'none' })
      setTimeout(() => { if (pageActive && isCurrentSession(pageSession)) uni.navigateBack() }, 1200)
      return
    }
    selectedRequiresConsultation.value = flow.requiresConsultation
    if (!flow.requiresConsultation) {
      const directItemIds = cartItems.value.map(item => String(item.id))
      if (!directPurchase.value) setCheckoutProductIds(directItemIds)
      uni.removeStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID)
      uni.redirectTo({
        url: `/pages/order/confirm?selectedItems=${directItemIds.join(',')}${directPurchaseQuery(directPurchase.value)}`
      })
    }
  } catch (error) {
    if (!pageActive || !isCurrentSession(pageSession)) return
    console.error('loadProducts failed:', error)
    uni.showToast({ title: '加载商品失败', icon: 'none' })
  } finally {
    if (pageActive && isCurrentSession(pageSession)) uni.hideLoading()
  }
}

const onQuantityChange = async (item, val) => {
  const quantity = Number(val)
  if (!item || !Number.isSafeInteger(quantity) || quantity < 1) return
  try {
    if (directPurchase.value) directPurchase.value = { ...directPurchase.value, quantity }
    else if (!(await setCartItemQuantity(item.cartKey || item.id, quantity))) return
    if (pageActive && isCurrentSession(pageSession)) item.quantity = quantity
  } catch (error) {
    if (pageActive && isCurrentSession(pageSession)) {
      quantityRenderVersion.value += 1
      uni.showToast({ title: error.message || '修改数量失败', icon: 'none' })
    }
  }
}

const selectPatient = (patient) => {
  if (!pageActive || !isCurrentSession(pageSession)) return
  logButtonClick({ ...PAGE_LOG, actionCode: 'SELECT_PATIENT', accessTitle: '选择就诊人', accessDescription: '为本次配制剂申请选择就诊人', extraData: { patientId: patient?.id || '' } })
  selectedPatient.value = patients.value.find(p => String(p.id) === String(patient?.id)) || null
  patientSelectionInitialized = true
  patientSelectionVersion += 1
  preferredPatientId = null
}

const removeSelectedPatient = () => {
  if (!pageActive || !isCurrentSession(pageSession) || !selectedPatient.value) return
  logButtonClick({ ...PAGE_LOG, actionCode: 'REMOVE_PATIENT', accessTitle: '移除本次就诊人', accessDescription: '仅取消本次购买选择，保留就诊人资料', extraData: { patientId: selectedPatient.value.id } })
  selectedPatient.value = null
  patientSelectionInitialized = true
  patientSelectionVersion += 1
  preferredPatientId = null
}

const onAddPatient = () => {
  logButtonClick({ ...PAGE_LOG, actionCode: 'ADD_PATIENT', accessTitle: '新增就诊人', accessDescription: '从配制剂申请进入新增就诊人页面' })
  uni.navigateTo({
    url: '/pages/dispense/patient_edit'
  })
}

const onManagePatients = () => {
  logButtonClick({ ...PAGE_LOG, actionCode: 'OPEN_PATIENT_LIST', accessTitle: '管理就诊人', accessDescription: '从配制剂申请进入就诊人管理页面' })
  uni.navigateTo({ url: '/pages/user/patient_list' })
}

const selectConsultationMode = (mode) => {
  if (consultationMode.value === mode) {
    return
  }
  consultationMode.value = mode
  logButtonClick({ ...PAGE_LOG, actionCode: 'SELECT_CONSULTATION_MODE', accessTitle: '切换接诊方式', accessDescription: '用户选择本次复诊的接诊方式', extraData: { consultationMode: mode, productCount: cartItems.value.length } })
}

const agreementContent = `"在线常见病、慢性病复诊"是一项在线诊疗服务（以下简称"本服务"）。本服务由入驻平台的互联网医院及其医务人员向您提供。作为平台方，我们将对平台内的互联网医院及医务人员采取必要的平台管理措施，督促其严格按照医疗卫生法律法规和诊疗规范及互联网在线诊疗规范。您在使用本服务之前，请务必仔细阅读下列文本。在此郑重提示：一旦您使用了本服务，即表示您已经完整、准确的了解了本声明所提示的所有内容，并同意接受本声明全部条款的约束。

根据《互联网诊疗管理办法（试行）》、《互联网医院管理办法（试行）》、《远程医疗服务管理办法（试行）》等法规的要求，您应知晓互联网诊疗相关的执业规则并接受风险告知并签署知情同意书。

1.互联网诊疗相关执业规则

互联网医院开展部分常见病、慢性病复诊时，医师应当掌握您病历资料，确定已有明确诊断后，针对相同诊断进行复诊并开具处方。

互联网医院不能开具麻醉药品、精神类药品处方，以及其他用药风险较高，有其他特殊管理规定的药品处方。为6岁以下的儿童开具用药处方时，应当有监护人和相关专业医师陪伴。

互联网医院不能直接进行体格检查和实施检查、检验等诊查手段，一旦医生认为您出现病情变化且需要医务人员亲自诊查时，或复诊疾病属于疑难杂症、出现危急重症等情形时，医生在在线诊疗过程中能够采取的有效措施较为有限。前述情形下医生有权终止本次诊疗活动，您应积极配合到实体医疗机构就诊。

互联网医院可以提供药品配送相关的服务，但实际服务提供方为合作第三方。相关的服务质量和售后保障由第三方负责。当发生不良事件时，您应积极、主动上报。

2.互联网诊疗潜在风险告知及对策

接受互联网诊疗可能出现如下潜在风险，有些不常见的风险未能一一列出，如果您有疑问应与医生讨论。

2.1 受限于互联网诊疗本身的局限性（如医生不能面诊、触诊等，无法通过相关的诊查手段及检查、检验结果准确判断病情的进展），医生给出的本次诊疗方案依赖于您所上传的资料和描述的症状，以及既往的病历资料、临床诊断。如前述信息不准确或不全面，将对本次诊疗方案的合理制定产生一定的影响，如因此导致误诊误治的不利后果，患者需对此承担相应责任。

2.2 由于疾病本身的特殊性和复杂性，您本身的体质状况，及现有医疗水平条件的限制等，都存在可能发生各种并发症和危害自身生命健康的意外风险。

由于疾病本身的复杂性，以及诊疗措施疗效出现的延后性，诊疗方案、健康管理方案可能不会达到您期许的效果，且有些疾病或并发症是不可根治的，需要您积极配合，医生已经尽力为您制定合理的在线诊疗方案，致力减少药物治疗不良反应的发生，但不可能完全避免，且不可预测，需要在您的配合下，且根据临床情况不断调整方案。如果您在在线诊疗中或在线诊疗后，发现自身的症状和体征发生改变或恶化，或有明显的身体不适，请您立即告知医生，并及时就近急诊就医，以免贻误病情。

2.3 您确认为患者本人或监护人，虽然我们对患者的实名信息进行搜集和核验，但平台受限于线上问诊环境，不同于线下现场诊疗，无法实时核验患者的身份。平台及为您提供在线复诊服务的互联网医院将视同您为患者本人或作为患者的监护人。您在在线问诊过程中进行的任何操作行为，对患者均具有对应的法律效力。

2.4 疾病的治愈需要您谨遵医嘱、健康管理方案，并积极配合。如果您未完全遵守和配合，则可能导致诊疗效果不理想，甚至出现病情反复、恶化等不良后果。

2.5 如您正在用药物或手术等治疗其他疾病，也可能存在延时用药、联合用药等风险，此类情形请务必提前告知医生。

2.6您自采药品的品牌、规格、性状、使用方法等可能影响本次诊疗方案的效果，同时还可能出现危害生命健康的风险。

2.7 医生主要解决本专业领域的医疗问题，非本专业的疾病需要到其他专业科室进行诊治或接受远程医疗服务。

本风险告知及知情同意书未能一一列出在线问诊场景下其他可能存在的风险，如果您有疑问请与医生进行沟通。

3.我们非常重视对您个人健康信息的保护，并遵循合法、正当、必要原则来收集您提交的各项个人健康信息，用于线上医生为您提供服务。

您已充分知晓上述内容并作如下确认：

由于医生仅通在线沟通收集病情资料，您确认如实、完整反馈个人情况（基本信息（真实的姓名、性别、年龄、身份证号）和病症信息（病情描述、过敏史、特殊体质备注等），并对提供信息的真实性准确性负责。

您确认将严格按照医嘱用药，如遇到病情病情加重或其他严重不适症状应及时线下就医。

在接受在线诊疗服务过程中，请您真实回答医生提出的问题，切勿故意隐瞒或虚报。由此造成的不良后果，由您本人负责。

如您有药物过敏史，您须提前填写清楚，或告知医生或医生团队，同时用药过程中如有不适反应要主动、积极告知平台、医生或医生团队。

您确认在互联网医院上问诊的疾病，已经在实体医疗机构明确诊断，您已经填写或上传相关的病历资料，愿意互联网诊疗。

您确认既往发生过与本次发病类似的常见病、慢性病病症，并曾经在实体医院诊疗。

您确认愿意接受医生根据诊疗经验为您提供的在线医疗服务。

您确认已经知晓并同意以上内容，理解相关的风险，愿意接受互联网医院的服务以及接受疾病诊疗服务，并签署知情同意书。`

const showAgreementDialog = () => {
  showAgreement.value = true
}

const navigateToConsultation = (selectedItemIds, mode) => {
  const query = [
    `selectedItems=${selectedItemIds.join(',')}`,
    `consultationMode=${mode}`,
    `patientId=${encodeURIComponent(selectedPatient.value.id)}`
  ]

  const doctor = getConsultationDoctorByMode(mode)
  if (doctor.id !== null) query.push(`doctorId=${doctor.id}`)
  query.push(`doctorName=${encodeURIComponent(doctor.name)}`)
  query.push(`doctorAvatar=${encodeURIComponent(doctor.avatar)}`)

  uni.navigateTo({
    url: `/pages/dispense/consultation?${query.join('&')}${directPurchaseQuery(directPurchase.value)}`
  })
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
        onManagePatients()
      }
    }
  })
  return true
}

const onSubmit = () => {
  if (!pageActive || !isCurrentSession(pageSession)) return
  const actionLog = { ...PAGE_LOG, actionCode: 'CONTINUE_PURCHASE', accessTitle: '继续配制剂流程', accessDescription: '根据商品复诊要求进入在线复诊或订单确认', extraData: { patientId: selectedPatient.value?.id || '', productCount: cartItems.value.length, consultationMode: consultationMode.value, destination: selectedRequiresConsultation.value ? 'consultation' : 'order_confirm' } }
  logButtonClick(actionLog)
  if (checkoutRouteError.value) {
    logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED', accessTitle: '购买上下文校验未通过', accessDescription: '本次购买信息无效，未继续购买流程', extraData: { ...actionLog.extraData, reason: 'INVALID_CHECKOUT_CONTEXT' } })
    uni.showToast({ title: checkoutRouteError.value, icon: 'none' })
    return
  }
  if (selectedRequiresConsultation.value && !selectedPatient.value?.id) {
    logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED', accessTitle: '尚未选择就诊人', accessDescription: '本次复诊需要有效就诊人，未继续购买流程', extraData: { ...actionLog.extraData, reason: 'PATIENT_REQUIRED' } })
    uni.showToast({ title: '请先选择就诊人', icon: 'none' })
    return
  }
  if (promptPatientCompletion()) {
    logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'FAILED', accessTitle: '就诊人资料待完善', accessDescription: '缺少下单必需的就诊人资料，提示前往管理页完善', extraData: { ...actionLog.extraData, reason: 'PATIENT_PROFILE_INCOMPLETE' } })
    return
  }

  const selectedItemIds = selectedItems.value.length > 0
    ? selectedItems.value
    : cartItems.value.map(item => String(item.id))
  if (!directPurchase.value) setCheckoutProductIds(selectedItemIds)

  if (!selectedRequiresConsultation.value) {
    uni.removeStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID)
    uni.navigateTo({
      url: `/pages/order/confirm?selectedItems=${selectedItemIds.join(',')}${directPurchaseQuery(directPurchase.value)}`
    })
    return
  }

  navigateToConsultation(selectedItemIds, consultationMode.value)
}

onMounted(() => {

  uni.$on('patientChanged', handlePatientChanged)

  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  try { directPurchase.value = parseDirectPurchase(currentPage.options) }
  catch (error) { checkoutRouteError.value = error.message }
  const selectedItemsParam = currentPage.options.selectedItems
  if (directPurchase.value && !selectedItemsParam) checkoutRouteError.value = '购买信息无效，请返回商品页重新选择'
  if (selectedItemsParam) {
    selectedItems.value = selectedItemsParam.split(',').filter(id => id.trim())
  } else {
    selectedItems.value = getCurrentCheckoutProductIds()
  }

  if (selectedItems.value.length > 0) {
    if (!directPurchase.value) setCheckoutProductIds(selectedItems.value)
  }

  routeReady = true
  loadProducts()
})


onUnmounted(() => {
  pageActive = false
  patientRefreshId += 1
  uni.$off('patientChanged', handlePatientChanged)
})
onShow(() => {
  logPageView({ ...PAGE_LOG, actionCode: 'VIEW_PAGE', accessTitle: '访问配制剂申请', accessDescription: '核对选购商品并选择就诊人及接诊方式' })
  return Promise.all([loadPatientsFromAPI(preferredPatientId), routeReady ? loadProducts() : Promise.resolve()])
})
</script>

<style scoped>
/* Safe area 顶部填充（适配状态栏高度）*/
.safe-top {
  height: env(safe-area-inset-top);
  background: linear-gradient(135deg, #4a90e2, #67c6ff);
}

/* 整体背景 */
.page {
  background: linear-gradient(180deg, #f0f6ff 0%, #f6f7fb 30%, #f6f7fb 100%);
  min-height: 100vh;
}

/* 白色导航栏 */
.nav-bar {
  height: 88rpx;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0 20rpx;
  border-bottom: 1rpx solid #eee;
}
.nav-left, .nav-right {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 120rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  font-size: 36rpx;
}
.nav-left { left: 0; }
.nav-right { right: 0; }
.nav-title {
  font-size: 34rpx;
  font-weight: 600;
}

/* 页面滚动区 */
.body-scroll {
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}

/* 卡片 */
.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 30rpx rgba(74,144,226,0.1);
  border: 1rpx solid rgba(74,144,226,0.08);
}
.card-title {
  font-size: 32rpx;
  font-weight: 600;
  text-align: center;
  margin-bottom: 24rpx;
  color: #333;
  position: relative;
  padding-bottom: 16rpx;
}
.card-title::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 80rpx;
  height: 6rpx;
  background: linear-gradient(90deg, #4a90e2, #67c6ff);
  border-radius: 3rpx;
}
.card-body {
  display: flex;
  align-items: flex-start;
  position: relative;
  padding: 20rpx;
  background: linear-gradient(135deg, #fafbfc, #f5f7fa);
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  transition: all 0.3s;
}
.card-body:last-of-type {
  border-bottom: none;
  padding-bottom: 20rpx;
  margin-bottom: 0;
}
.modify-wrapper {
  text-align: right;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx dashed #e0e6f0;
}
.med-left {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  margin-right: 20rpx;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 6rpx 16rpx rgba(0,0,0,0.1);
}
.med-thumb {
  width: 100%;
  height: 100%;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #f0f0f0, #e8e8e8);
}
.med-qty {
  position: absolute;
  right: 0rpx;
  top: 0rpx;
  background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
  color: #fff;
  min-width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  font-size: 24rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10rpx;
  box-sizing: border-box;
  box-shadow: 0 4rpx 12rpx rgba(255,107,107,0.4);
}

.med-right {
  flex: 1;
}
.med-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 10rpx;
  line-height: 1.4;
}
.med-spec {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 12rpx;
  background: linear-gradient(135deg, #f0f4ff, #e8f0fe);
  padding: 6rpx 14rpx;
  border-radius: 8rpx;
  display: inline-block;
}
.med-price {
  color: #ff6b6b;
  font-size: 34rpx;
  font-weight: 700;
}

.med-price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14rpx;
}

.modify {
  position: absolute;
  right: 14rpx;
  top: 14rpx;
  color: #4a90e2;
  font-size: 26rpx;
  padding: 10rpx 20rpx;
  background: linear-gradient(135deg, #f0f6ff, #e8f0fe);
  border-radius: 24rpx;
}

/* section */
.section {
  margin-top: 24rpx;
  background: #fff;
  padding: 28rpx;
  border-radius: 20rpx;
  box-shadow: 0 8rpx 30rpx rgba(74,144,226,0.1);
  border: 1rpx solid rgba(74,144,226,0.08);
}
.section-title {
  font-size: 32rpx;
  font-weight: 700;
  text-align: center;
  margin-bottom: 24rpx;
  color: #333;
  position: relative;
  padding-bottom: 16rpx;
}
.section-title::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 80rpx;
  height: 6rpx;
  background: linear-gradient(90deg, #4a90e2, #67c6ff);
  border-radius: 3rpx;
}

.patient-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;
}

.patient-section-title::after {
  right: auto;
  left: 0;
  transform: none;
}

.patient-manage {
  color: #2a82e4;
  font-size: 25rpx;
  font-weight: 500;
}
.patient-row {
  display: flex;
  flex-direction: column;
}
.label {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 20rpx;
  font-weight: 500;
}
.required { color: #ff6b6b; margin-right: 6rpx; }

/* 就诊人选择 */
.patients {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.patient-selected,
.patient-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: #f4f8ff;
  border: 2rpx solid #d4e4ff;
}
.patient-item {
  width: 100%;
  margin: 0;
  text-align: left;
  line-height: 1.5;
}
.patient-item.active {
  border-color: #4a90e2;
  background: #e8f2ff;
}
.patient-info {
  flex: 1;
  min-width: 0;
}
.patient-name,
.patient-meta {
  display: block;
  overflow-wrap: anywhere;
}
.patient-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
}
.patient-meta,
.patient-note {
  font-size: 24rpx;
  color: #888;
  line-height: 1.6;
}
.patient-note {
  margin-top: 12rpx;
}
.patient-profile-notice {
  display: block;
  margin-top: 8rpx;
  color: #a15c00;
  font-size: 24rpx;
  line-height: 1.6;
}
.patient-list-title {
  margin-top: 24rpx;
}
.patient-remove {
  margin: 0;
  padding: 8rpx 20rpx;
  color: #d85757;
  font-size: 26rpx;
  background: #fff;
  line-height: 1.5;
  flex-shrink: 0;
}
.patient-add {
  width: 100%;
  margin: 0;
  padding: 14rpx 24rpx;
  color: #4a90e2;
  font-size: 28rpx;
  background: #f0f6ff;
  border-radius: 16rpx;
  border: 2rpx dashed #4a90e2;
}
.patient-item::after,
.patient-remove::after,
.patient-add::after {
  border: none;
}

.consultation-mode-row {
  margin-top: 28rpx;
}

.consultation-mode-switch {
  display: flex;
  gap: 16rpx;
  padding: 12rpx;
  background: linear-gradient(135deg, #f4f8ff, #edf4ff);
  border-radius: 24rpx;
  border: 2rpx solid rgba(74,144,226,0.12);
}

.consultation-mode-item {
  flex: 1;
  text-align: center;
  padding: 22rpx 16rpx;
  border-radius: 18rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #5f6f86;
  transition: all 0.25s ease;
}

.consultation-mode-item.active {
  background: linear-gradient(135deg, #4a90e2, #67c6ff);
  color: #fff;
  box-shadow: 0 10rpx 24rpx rgba(74,144,226,0.22);
}

/* 协议弹窗 */
.agreement-popup-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}
.agreement-popup {
  width: 90%;
  max-height: 85vh;
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 24rpx;
  border-bottom: 1rpx solid #eee;
}
.popup-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  flex: 1;
}
.popup-close {
  padding: 10rpx;
}
.popup-content {
  width: 95%;
  flex: 1;
  padding: 24rpx;
  max-height: 60vh;
  overflow: hidden;
}
.popup-content ::-webkit-scrollbar {
  display: none;
}
.agreement-full {
  font-size: 26rpx;
  color: #333;
  line-height: 1.8;
  white-space: pre-wrap;
  text-align: left;
  word-break: break-all;
}
.popup-footer {
  padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #eee;
}
.popup-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #4a90e2, #67c6ff);
  color: #fff;
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: 600;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* footer 固定底部 */
.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -8rpx 30rpx rgba(0,0,0,0.08);
  z-index: 100;
}

.agreement-wrapper {
  display: flex;
  align-items: flex-start;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #eee;
  margin-bottom: 16rpx;
}
.checkbox {
  flex-shrink: 0;
  padding-right: 8rpx;
  padding-top: 2rpx;
}
.agreement-text {
  flex: 1;
  font-size: 24rpx;
  color: #666;
  line-height: 1.5;
}
.agreement-link {
  color: #4a90e2;
}

.footer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* footer 左侧包裹 */
.footer-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.icon-bag {
  width: 80rpx;
  height: 80rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #f0f6ff, #e8f4ff);
  display:flex;
  align-items:center;
  justify-content:center;
  position: relative;
  box-shadow: 0 6rpx 16rpx rgba(74,144,226,0.15);
}
.badge {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  background: linear-gradient(135deg, #ff6b6b, #ff4757);
  color: #fff;
  min-width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  font-size: 22rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2rpx 10rpx rgba(255,75,87,0.4);
}
.total .price {
  font-size: 38rpx;
  color: #ff6b6b;
  font-weight: 700;
}
.total .note {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
}

/* 提交按钮 */
.submit-btn {
  margin: 0;
  background: linear-gradient(135deg, #4a90e2, #67c6ff);
  color: #fff;
  padding: 0 56rpx;
  height: 88rpx;
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: 600;
  border: none;
  box-shadow: 0 8rpx 24rpx rgba(74,144,226,0.35);
  letter-spacing: 2rpx;
}
.submit-btn.disabled {
  background: linear-gradient(135deg, #ccc, #ddd);
  box-shadow: none;
}
</style>

