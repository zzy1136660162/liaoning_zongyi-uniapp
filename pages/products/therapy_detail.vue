<template>
  <view
    class="page"
    :class="{ 'page-lock': showManual || showPolicy }"
  >
    <view class="banner-wrapper">
      <swiper
        class="banner"
        :indicator-dots="true"
        :autoplay="productImages.length > 1"
        :interval="3000"
        indicator-color="rgba(255,255,255,0.4)"
        indicator-active-color="#fff"
        @change="handleBannerChange"
      >
        <swiper-item
          v-for="(img, idx) in productImages"
          :key="idx"
        >
          <image
            class="banner-img"
            :src="img"
            mode="aspectFill"
          />
        </swiper-item>
      </swiper>
      <view class="banner-index">
        {{ currentIndex }}/{{ productImages.length }}
      </view>
    </view>
    <view class="price-box">
      <view class="price-main">
        <view class="price-left">
          <view class="price-tag">
            传统疗法价格
          </view>
          <view class="price-info">
            <text class="price-unit" selectable="true">
              ￥
            </text>
            <text class="price-num" selectable="true">
              {{ priceInteger }}
            </text>
            <text class="price-decimal" selectable="true">
              .{{ priceDecimal }}
            </text>
          </view>
        </view>
        <view class="price-right">
          <view class="sales-box">
            <text class="sales-icon" selectable="true">
              🔥
            </text>
            <text class="sales-count" selectable="true">
              已售 {{ product.salesVolume || 0 }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <view class="goods-info">
      <view class="goods-name-row">
        <text class="therapy-tag" selectable="true">
          传统疗法
        </text>
        <text
          v-if="product.limitInfo && product.limitInfo.enabled && product.limitInfo.text"
          class="limit-tag"
        >
          {{ product.limitInfo.text }}
        </text>
        <text
          class="goods-name"
          selectable="true"
        >
          {{ product.name }}&nbsp;{{ product.description }}
        </text>
      </view>
      <text
        v-if="product.subtitle || product.indications"
        class="goods-sub"
        selectable="true"
      >
        {{ product.indications }}
      </text>
      <view
        v-if="product.limitInfo && product.limitInfo.enabled"
        class="limit-reminder"
      >
        <view v-if="product.limitInfo.text">
          <text selectable="true">
            {{ product.limitInfo.text }}
          </text>
        </view>
        <view v-if="product.limitInfo.periodLabel != null">
          <text selectable="true">
            限购周期：{{ product.limitInfo.periodLabel }}
          </text>
        </view>
        <view v-if="product.limitInfo.limitQuantity != null">
          <text selectable="true">
            限购上限：{{ product.limitInfo.limitQuantity }}件
          </text>
        </view>
        <view v-if="product.limitInfo.purchasedQuantity != null">
          <text selectable="true">
            已购数量：{{ product.limitInfo.purchasedQuantity }}件
          </text>
        </view>
        <view v-if="product.limitInfo.remainingQuantity != null">
          <text selectable="true">
            剩余可购：{{ product.limitInfo.remainingQuantity }}件
          </text>
        </view>
      </view>
    </view>

    <view
      v-if="showPolicy"
      class="policy-overlay"
      @click="closePolicyDrawer"
    >
      <view
        class="policy-drawer"
        @click.stop
      >
        <view class="policy-header">
          <text class="policy-title" selectable="true">
            退换货说明
          </text>
          <view
            class="policy-close"
            @click="closePolicyDrawer"
          >
            ×
          </view>
        </view>
        <view class="policy-body">
          <view class="policy-section">
            <text class="policy-section-title" selectable="true">
              <text class="check-icon" selectable="true">
                ✓
              </text> 支持七天无理由退换
            </text>
            <text class="policy-content" selectable="true">
              支持七天无理由退换，随时可退。
            </text>
          </view>
          <view class="policy-section">
            <text class="policy-section-title" selectable="true">
              <text class="check-icon" selectable="true">
                ✓
              </text> 售后保障
            </text>
            <text class="policy-content" selectable="true">
              如需了解相关问题，可联系平台医生或医院相关科室咨询。
            </text>
          </view>
        </view>
        <view class="policy-footer">
          <view
            class="policy-confirm-btn"
            @click="closePolicyDrawer"
          >
            我知道了
          </view>
        </view>
      </view>
    </view>

    <view class="select-section">
      <view class="select-label">
        已选
      </view>
      <view class="select-value">
        <text selectable="true">
          {{ selectedSpec }}
        </text>
      </view>
      <view class="quantity-stepper">
        <button
          class="quantity-button"
          :class="{ disabled: !canDecreaseQuantity }"
          :disabled="!canDecreaseQuantity"
          aria-label="减少数量"
          @click="decreaseQuantity"
        >
          −
        </button>
        <text
          class="quantity-value"
          selectable="true"
        >
          {{ quantity }}
        </text>
        <button
          class="quantity-button"
          :class="{ disabled: !canIncreaseQuantity }"
          :disabled="!canIncreaseQuantity"
          aria-label="增加数量"
          @click="increaseQuantity"
        >
          +
        </button>
      </view>
    </view>

    <view
      class="policy-row"
      @click="showPolicyDrawer"
    >
      <image
        class="policy-icon"
        src="https://smf.lntcm.com/static/shop/axg_1.svg"
        mode="aspectFit"
      />
      <text class="policy-text" selectable="true">
        支持七天无理由退换 · 售后服务
      </text>
      <text class="select-arrow" selectable="true">
        ›
      </text>
    </view>
    <view class="delivery-row">
      <image
        class="delivery-icon"
        src="https://smf.lntcm.com/static/shop/spps.svg"
        mode="aspectFit"
      />
      <text class="delivery-label" selectable="true">
        配送
      </text>
      <text class="delivery-text" selectable="true">
        {{ deliverySummary }}
      </text>
    </view>

    <view class="promise-box">
      <view class="promise-item">
        <text class="promise-icon" selectable="true">
          ✓
        </text>
        <text class="promise-text" selectable="true">
          医院自研
        </text>
      </view>
      <view class="promise-item">
        <text class="promise-icon" selectable="true">
          ✓
        </text>
        <text class="promise-text" selectable="true">
          正品保障
        </text>
      </view>
      <view class="promise-item">
        <text class="promise-icon" selectable="true">
          ✓
        </text>
        <text class="promise-text" selectable="true">
          专业医生
        </text>
      </view>
      <view class="promise-item">
        <text class="promise-icon" selectable="true">
          ✓
        </text>
        <text class="promise-text" selectable="true">
          线下体验
        </text>
      </view>
      <view class="promise-item">
        <text class="promise-icon" selectable="true">
          ✓
        </text>
        <text class="promise-text" selectable="true">
          隐私保护
        </text>
      </view>
    </view>

    <view
      v-if="showManual"
      class="drawer-overlay"
      @click="closeManualDrawer"
    >
      <view
        class="drawer-content drawer-green-card"
        @click.stop
      >
        <view class="drawer-header">
          <text class="drawer-title" selectable="true">
            制剂说明
          </text>
          <view
            class="drawer-close"
            @click="closeManualDrawer"
          >
            ×
          </view>
        </view>
        <scroll-view
          class="drawer-body"
          scroll-y
        >
          <view
            v-if="product.ingredients"
            class="drawer-section"
          >
            <text class="drawer-label" selectable="true">
              【成份】
            </text>
            <text class="drawer-text" selectable="true">
              {{ product.ingredients }}
            </text>
          </view>
          <view
            v-if="product.indications"
            class="drawer-section"
          >
            <text class="drawer-label" selectable="true">
              【功能主治】
            </text>
            <text class="drawer-text" selectable="true">
              {{ product.indications }}
            </text>
          </view>
          <view
            v-if="usageText"
            class="drawer-section"
          >
            <text class="drawer-label" selectable="true">
              【用法用量】
            </text>
            <text class="drawer-text" selectable="true">
              {{ usageText }}
            </text>
          </view>
          <view
            v-if="product.adverseReactions"
            class="drawer-section"
          >
            <text class="drawer-label" selectable="true">
              【不良反应】
            </text>
            <text class="drawer-text" selectable="true">
              {{ product.adverseReactions }}
            </text>
          </view>
          <view
            v-if="product.contraindication"
            class="drawer-section"
          >
            <text class="drawer-label" selectable="true">
              【禁忌】
            </text>
            <text class="drawer-text" selectable="true">
              {{ product.contraindication }}
            </text>
          </view>
          <view
            v-if="product.precautions"
            class="drawer-section"
          >
            <text class="drawer-label" selectable="true">
              【注意事项】
            </text>
            <text class="drawer-text" selectable="true">
              {{ product.precautions }}
            </text>
          </view>
          <view
            v-if="product.storageCondition"
            class="drawer-section"
          >
            <text class="drawer-label" selectable="true">
              【贮藏】
            </text>
            <text class="drawer-text" selectable="true">
              {{ product.storageCondition }}
            </text>
          </view>
          <view
            v-if="product.manufacturer"
            class="drawer-section"
          >
            <text class="drawer-label" selectable="true">
              【生产单位】
            </text>
            <text class="drawer-text" selectable="true">
              {{ product.manufacturer }}
            </text>
          </view>
        </scroll-view>
      </view>
    </view>

    <view class="split-line" />

    <view class="pharmacist-card">
      <view class="pharmacist-avatar-wrap">
        <image
          class="pharmacist-avatar"
          :src="pharmacistAvatar"
          mode="aspectFill"
        />
        <view class="online-tag">
          在线
        </view>
      </view>
      <view class="pharmacist-detail">
        <view class="pharmacist-name">
          产品咨询
        </view>
        <view class="pharmacist-desc">
          有问题可咨询专业医生
        </view>
      </view>
      <view
        class="consult-btn"
        @click="showCustomerService"
      >
        咨询
      </view>
    </view>
    <view class="split-line" />
    <view
      class="recommend-section"
      :class="{ 'combo-section': recommendTab === 'combo', 'star-section': recommendTab === 'star' }"
    >
      <view class="recommend-tabs">
        <view
          class="recommend-tab"
          :class="{ active: recommendTab === 'combo' }"
          @click="switchRecommendTab('combo')"
        >
          制剂组合
        </view>
        <view
          class="recommend-tab"
          :class="{ active: recommendTab === 'star' }"
          @click="switchRecommendTab('star')"
        >
          制剂浏览
        </view>
      </view>
      <view class="recommend-content">
        <scroll-view
          v-if="recommendTab === 'combo' && comboProducts.length > 0"
          class="recommend-scroll"
          scroll-x
        >
          <view
            v-for="item in comboProducts"
            :key="item.id"
            class="recommend-item"
            @click="goToDetail(item)"
          >
            <image
              class="recommend-img"
              :src="getImageUrl(item.image)"
              mode="aspectFit"
            />
            <view class="recommend-info">
              <text class="recommend-name" selectable="true">
                {{ item.name }}
              </text>
              <view class="recommend-bottom">
                <text class="recommend-price" selectable="true">
                  ￥{{ Number(item.price || 0).toFixed(2) }}
                </text>
                <view
                  class="recommend-add-btn"
                  :class="{ 'has-quantity': cartQuantities[item.id] > 0 }"
                  @click.stop="flyToCart($event, item)"
                >
                  <text v-if="cartQuantities[item.id]" selectable="true">
                    {{ cartQuantities[item.id] }}
                  </text>
                  <text v-else selectable="true">
                    +
                  </text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
        <view
          v-else-if="recommendTab === 'combo'"
          class="empty-block"
        >
          暂无组合推荐
        </view>
        <scroll-view
          v-else-if="starProducts.length > 0"
          class="recommend-scroll"
          scroll-x
        >
          <view
            v-for="item in starProducts"
            :key="item.id"
            class="recommend-item"
            @click="goToDetail(item)"
          >
            <image
              class="recommend-img"
              :src="getImageUrl(item.image)"
              mode="aspectFit"
            />
            <view class="recommend-info">
              <text class="recommend-name" selectable="true">
                {{ item.name }}
              </text>
              <view class="recommend-bottom">
                <text class="recommend-price" selectable="true">
                  ￥{{ Number(item.price || 0).toFixed(2) }}
                </text>
                <view
                  class="recommend-add-btn"
                  :class="{ 'has-quantity': cartQuantities[item.id] > 0 }"
                  @click.stop="flyToCart($event, item)"
                >
                  <text v-if="cartQuantities[item.id]" selectable="true">
                    {{ cartQuantities[item.id] }}
                  </text>
                  <text v-else selectable="true">
                    +
                  </text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
        <view
          v-else
          class="empty-block"
        >
          暂无其他推荐
        </view>
      </view>
      <view
        v-if="recommendTab === 'combo'"
        class="combo-disclaimer"
      >
        *组合仅供参考，最终以医嘱为准
      </view>

      <view
        v-if="flyingDot.show"
        class="flying-dot"
        :style="{ left: flyingDot.x + 'px', top: flyingDot.y + 'px' }"
      />
    </view>

    <view class="split-line" />

    <view class="detail-header">
      <view
        class="detail-tab"
        :class="{ active: detailTab === 'desc' }"
        @click="switchDetailTab('desc')"
      >
        详情
      </view>
      <view
        class="detail-tab"
        :class="{ active: detailTab === 'review' }"
        @click="switchDetailTab('review')"
      >
        评价
      </view>
    </view>

    <view
      v-if="detailTab === 'desc'"
      class="detail-body"
    >
      <view class="detail-title">
        {{ product.detailTitle || '商品详情' }}
      </view>
      <rich-text
        v-if="product.intro"
        class="detail-richtext"
        :nodes="formatRichText(product.intro)"
      />
      <view
        v-else
        class="empty-block"
      >
        暂无图文详情
      </view>
      <view
        v-if="showDetailImages"
        class="detail-images"
      >
        <image
          v-for="(img, idx) in productImages"
          :key="idx"
          :src="img"
          mode="widthFix"
          class="detail-img"
        />
      </view>

      <!-- <view class="spec-list">
        <view class="spec-title">药品基本信息</view>
        <view class="spec-item" v-for="item in specItems" :key="item.label">
          <text class="spec-label" selectable="true">{{ item.label }}</text>
          <text class="spec-value" selectable="true">{{ item.value }}</text>
        </view>
      </view> -->

      <view
        v-if="specItems.length > 0"
        class="usage-box"
      >
        <view class="usage-title">
          商品基本信息
        </view>
        <view class="usage-list">
          <view
            v-for="item in specItems"
            :key="item.label"
            class="usage-item"
          >
            <text class="usage-label" selectable="true">
              {{ item.label }}
            </text>
            <text class="usage-text" selectable="true">
              {{ item.value }}
            </text>
          </view>
        </view>
      </view>

      <view
        v-if="usageItems.length > 0"
        class="usage-box"
      >
        <view class="usage-title">
          使用说明
        </view>
        <view class="usage-list">
          <view
            v-for="item in usageItems"
            :key="item.label"
            class="usage-item"
          >
            <text
              class="usage-label"
              selectable="true"
            >
              {{ item.label }}
            </text>
            <text
              class="usage-text"
              selectable="true"
            >
              {{ item.value }}
            </text>
          </view>
        </view>
        <view class="usage-tip">
          <text
            class="usage-text"
            selectable="true"
          >
            凭订单中的核销码到医院后，找医院工作人员扫码核销即可体验服务。
          </text>
        </view>
      </view>
    </view>

    <view
      v-if="detailTab === 'review'"
      class="detail-body"
    >
      <view class="empty-block">
        暂无评价
      </view>
    </view>

    <!-- <view class="reminder-bar">
      <text class="reminder-icon" selectable="true">
        !
      </text>
      <text class="reminder-text" selectable="true">
        凭订单中的核销码到医院后，找医院工作人员扫码核销即可体验服务。
      </text>
    </view> -->



    <view class="bottom-space" />

    <view class="bottom-bar">
      <view class="bottom-left">
        <view
          class="action-icon-btn"
          @click="toggleCollect"
        >
          <uni-icons
            :type="isCollected ? 'star-filled' : 'star'"
            size="20"
            :color="isCollected ? '#ff6b35' : '#666'"
          />
          <text class="action-text" selectable="true">
            {{ isCollected ? '已收藏' : '收藏' }}
          </text>
        </view>
        <view
          class="action-icon-btn"
          @click="goCart"
        >
          <uni-icons
            type="cart"
            size="20"
            color="#666"
          />
          <text class="action-text" selectable="true">
            购物车
          </text>
          <view
            v-if="cartCount > 0"
            class="cart-badge"
          >
            {{ cartCount > 99 ? '99+' : cartCount }}
          </view>
        </view>
        <view
          class="action-icon-btn"
          @click="showCustomerService"
        >
          <uni-icons
            type="headphones"
            size="20"
            color="#666"
          />
          <text class="action-text" selectable="true">
            客服
          </text>
        </view>
      </view>
      <view class="bottom-right">
        <view
          class="btn-add-cart"
          :class="{ disabled: !canPurchase }"
          @click="addCart"
        >
          加入购物车
        </view>
        <view
          class="btn-buy"
          :class="{ disabled: !canPurchase }"
          @click="buyNow"
        >
          立即购买
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, getCurrentInstance, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { STORAGE_KEY_CURRENT_CONSULTATION_ID } from '@/utils/storage.js'
import { getProductDetail, mapProductDetail } from '@/api/product.js'
import { getImageUrl } from '@/utils/config.js'
import { openCustomerServiceChat } from '@/utils/customer-service.js'
import {
  addCartItem,
  getCartProductInfo,
  getCartProductQuantity,
  getCartTotalQuantity,
  prepareCheckout,
  resolveCartCompatibility
} from '@/utils/cart.js'
import { logPageView } from '@/api/access-log.js'
import { BIZ_TYPE_HEALTH_GOODS } from '@/utils/product-biz.js'
import { isTraditionalTherapyProduct } from '@/utils/therapy.js'
import {
  isPurchaseAvailable,
  normalizePurchaseQuantity,
  resolvePurchaseQuantityLimit
} from '@/utils/purchase-quantity.js'
import { getToken } from '@/utils/request.js'
import {
  getDeliverySummary,
  getExternalUseLabel,
  isSelfDevelopedProduct,
  shouldShowSfLogo
} from '@/utils/product-display.js'

const createEmptyProduct = () => ({
  id: '',
  name: '',
  subtitle: '',
  description: '',
  price: 0,
  image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png'),
  images: [],
  intro: '',
  unit: '',
  salesVolume: 0,
  bizType: 1,
  goodsMerchantType: 1,
  isPrescription: 0,
  needQuestionnaire: 0,
  questionnaireId: null,
  isHospitalStarFormula: 0,
  isNewProduct: 0,
  detailTitle: '',
  isStarProduct: 0,
  isExternal: 0,
  coldShippingType: 0,
  isSelfDeveloped: 1,
  stock: 0,
  indications: '',
  ingredients: '',
  commonUsage: '',
  usageDesc: '',
  contraindication: '',
  precautions: '',
  storageCondition: '',
  adverseReactions: '',
  appearanceDesc: '',
  dosageForm: '',
  packageSpec: '',
  specText: '',
  validityPeriod: '',
  originType: 0,
  approvalNumber: '',
  manufacturer: '',
  executionStandard: '',
  warmTips: '',
  relatedProducts: [],
  starProducts: []
})

const product = ref(createEmptyProduct())
const quantity = ref(1)
const showManual = ref(false)
const showPolicy = ref(false)
const detailTab = ref('desc')
const currentIndex = ref(1)
const cartCount = ref(0)
const isCollected = ref(false)
const flyingDot = ref({ show: false, x: 0, y: 0 })
const recommendTab = ref('combo')
const cartQuantities = ref({})
const comboProducts = ref([])
const starProducts = ref([])
const pharmacistAvatar = getImageUrl('https://smf.lntcm.com/static/medicine/yaoshi1.svg')

const productImages = computed(() => {
  if (product.value.images && product.value.images.length > 0) {
    return product.value.images
  }
  return product.value.image ? [product.value.image] : [getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')]
})

const showDetailImages = computed(() => !product.value.intro && productImages.value.length > 0)
const usageText = computed(() => product.value.commonUsage || product.value.usageDesc || '')
const requiresQuestionnaire = computed(() => Number(product.value.needQuestionnaire) === 1)
const selectedSpec = computed(() => product.value.specText || product.value.packageSpec || product.value.unit || '默认规格')
const maxPurchaseQuantity = computed(() => resolvePurchaseQuantityLimit(product.value))
const canPurchase = computed(() => isPurchaseAvailable(product.value))
const canDecreaseQuantity = computed(() => canPurchase.value && quantity.value > 1)
const canIncreaseQuantity = computed(() => {
  if (!canPurchase.value) {
    return false
  }
  return maxPurchaseQuantity.value === null || quantity.value < maxPurchaseQuantity.value
})
const priceInteger = computed(() => {
  const [integer = '0'] = Number(product.value.price || 0).toFixed(2).split('.')
  return integer
})
const priceDecimal = computed(() => {
  const [, decimal = '00'] = Number(product.value.price || 0).toFixed(2).split('.')
  return decimal
})
const originTypeText = computed(() => {
  if (product.value.originType === 1) return '国产'
  if (product.value.originType === 2) return '进口'
  return ''
})

const deliverySummary = computed(() => getDeliverySummary(product.value.coldShippingType))
const showSfLogo = computed(() => shouldShowSfLogo(product.value.coldShippingType))

const specItems = computed(() => {
  const externalLabel = product.value.isExternal === 0 || product.value.isExternal === 1
    ? getExternalUseLabel(product.value.isExternal)
    : ''
  return [
    { label: '产品名称', value: product.value.name },
    { label: '是否外用', value: externalLabel },
    { label: '规格', value: product.value.specText },
    { label: '包装', value: product.value.packageSpec },
    { label: '剂型', value: product.value.dosageForm },
    { label: '性状', value: product.value.appearanceDesc },
    { label: '有效期', value: product.value.validityPeriod },
    { label: '产地类型', value: originTypeText.value },
    { label: '批准文号', value: product.value.approvalNumber },
    { label: '生产单位', value: product.value.manufacturer },
    { label: '执行标准', value: product.value.executionStandard },
    { label: '温馨提示', value: product.value.warmTips }
  ].filter(item => item.value)
})

const usageItems = computed(() => {
  return [
    { label: '制剂组成', value: product.value.ingredients },
    { label: '功能主治', value: product.value.indications },
    { label: '适用人群', value: product.value.suitableCrowd },
    { label: '用法用量', value: usageText.value },
    { label: '不良反应', value: product.value.adverseReactions },
    { label: '禁忌', value: product.value.contraindication },
    { label: '注意事项', value: product.value.precautions },
    { label: '药物相互作用', value: product.value.drugInteractions },
    { label: '贮藏', value: product.value.storageCondition }
  ].filter(item => item.value)
})

const loadCartCount = () => {
  cartCount.value = getCartTotalQuantity()
}

const resolveRecommendTab = () => {
  if (comboProducts.value.length > 0) {
    return 'combo'
  }
  if (starProducts.value.length > 0) {
    return 'star'
  }
  return 'combo'
}

const loadQuantityFromStorage = () => {
  if (!product.value.id) {
    quantity.value = 1
    return
  }
  quantity.value = normalizePurchaseQuantity(
    product.value,
    getCartProductQuantity(product.value.id, 1)
  )
}

const getQuantityLimitMessage = (targetProduct = product.value) => {
  const maxQuantity = resolvePurchaseQuantityLimit(targetProduct)
  const limitInfo = targetProduct?.limitInfo || targetProduct?.limit_info || {}
  const limitEnabled = limitInfo.enabled === true || limitInfo.enabled === 1 || limitInfo.enabled === '1'
  const remainingQuantity = Number(limitInfo.remainingQuantity ?? limitInfo.remaining_quantity)
  const stock = Number(targetProduct?.stock)

  if (limitEnabled && Number.isFinite(remainingQuantity) && remainingQuantity <= 0) {
    return '已达到该项目限购数量'
  }
  if (Number.isFinite(stock) && stock <= 0) {
    return '该项目已售罄'
  }
  if (limitEnabled && Number.isFinite(remainingQuantity) && maxQuantity === Math.floor(remainingQuantity)) {
    return `本周期最多还可购买${maxQuantity}件`
  }
  return maxQuantity === null ? '当前数量不可购买' : `库存最多可购买${maxQuantity}件`
}

const showQuantityLimit = (targetProduct = product.value) => {
  uni.showToast({
    title: getQuantityLimitMessage(targetProduct),
    icon: 'none'
  })
}

const decreaseQuantity = () => {
  if (!canDecreaseQuantity.value) {
    return
  }
  quantity.value = normalizePurchaseQuantity(product.value, quantity.value - 1)
}

const increaseQuantity = () => {
  if (!canIncreaseQuantity.value) {
    showQuantityLimit(product.value)
    return
  }
  quantity.value = normalizePurchaseQuantity(product.value, quantity.value + 1)
}

const loadRecommendCartQuantities = () => {
  const nextQuantities = {}
  ;[...comboProducts.value, ...starProducts.value].forEach((item) => {
    const currentQuantity = getCartProductQuantity(item.id, 0)
    if (currentQuantity > 0) {
      nextQuantities[item.id] = currentQuantity
    }
  })
  cartQuantities.value = nextQuantities
}

const applyProduct = (source) => {
  const mapped = mapProductDetail(source)
  product.value = {
    ...createEmptyProduct(),
    ...mapped
  }
  currentIndex.value = 1
  comboProducts.value = Array.isArray(mapped.relatedProducts) ? mapped.relatedProducts : []
  starProducts.value = Array.isArray(mapped.starProducts) ? mapped.starProducts : []
  recommendTab.value = resolveRecommendTab()
  loadQuantityFromStorage()
  loadRecommendCartQuantities()
}

const loadProduct = async (id) => {
  try {
    uni.showLoading({ title: '加载中...' })
    const response = await getProductDetail(id)
    applyProduct(response)
  } catch (error) {
    console.error('loadProduct failed:', error)
    uni.showToast({
      title: error.message || '加载失败',
      icon: 'none'
    })
  } finally {
    uni.hideLoading()
  }
}

const formatRichText = (htmlContent) => {
  if (!htmlContent) return ''
  const normalizeRichText = (content) => content
    .replace(/<img([^>]*)style=(['"])(.*?)\2([^>]*)>/gi, (match, before, quote, styleContent, after) => {
      const sanitizedStyle = styleContent
        .replace(/(?:^|;)\s*width\s*:[^;]*/gi, '')
        .replace(/(?:^|;)\s*height\s*:[^;]*/gi, '')
        .trim()
      const nextStyle = `max-width:100%;width:100%;height:auto;display:block;box-sizing:border-box;${sanitizedStyle ? ` ${sanitizedStyle}` : ''}`.trim()
      return `<img${before}style="${nextStyle}"${after}>`
    })
    .replace(/<img((?:(?!style=)[^>])*)>/gi, '<img$1 style="max-width:100%;width:100%;height:auto;display:block;box-sizing:border-box;">')

  if (typeof htmlContent === 'string') {
    return normalizeRichText(
      htmlContent
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    )
  }
  return normalizeRichText(String(htmlContent))
}

const buildDetailRedirect = () => {
  return product.value.id ? `/pages/products/therapy_detail?id=${product.value.id}` : '/pages/products/therapy_detail'
}

const ensureLogin = () => {
  if (getToken()) {
    return true
  }
  uni.navigateTo({
    url: `/pages/register/register?redirect=${encodeURIComponent(buildDetailRedirect())}`
  })
  return false
}

const ensureCartCompatible = (targetProduct) => {
  const result = resolveCartCompatibility(targetProduct, {
    ignoreProductId: targetProduct?.id
  })
  if (!result.valid) {
    uni.showToast({
      title: result.message,
      icon: 'none'
    })
    return false
  }
  return true
}

const hasQuestionnairePassed = (productId) => {
  const entry = getCartProductInfo(productId)
  return !!(entry && entry.questionnairePassed)
}

const navigateToNotice = (targetProduct, selectedQuantity, action = 'cart') => {
  uni.navigateTo({
    url: `/pages/products/product_notice?id=${targetProduct.id}&quantity=${selectedQuantity}&action=${action}`
  })
  return false
}

const goCheckout = (targetProduct) => {
  const checkout = prepareCheckout([String(targetProduct.id)], [{
    id: 'detail_checkout',
    products: [targetProduct]
  }])

  if (!checkout.valid) {
    uni.showToast({
      title: checkout.message,
      icon: 'none'
    })
    return false
  }

  const selectedItems = checkout.productIds.join(',')
  uni.removeStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID)
  uni.navigateTo({
    url: `/pages/order/confirm?therapy=1&selectedItems=${selectedItems}`
  })
  return true
}

const handlePurchaseAction = async (mode, targetProduct = product.value, selectedQuantity = 1) => {
  if (!targetProduct?.id) {
    return false
  }

  if (!ensureLogin()) {
    return false
  }

  if (!ensureCartCompatible(targetProduct)) {
    return false
  }

  if (!isPurchaseAvailable(targetProduct)) {
    showQuantityLimit(targetProduct)
    return false
  }

  const rawQuantity = Number(selectedQuantity)
  const normalizedRawQuantity = Number.isFinite(rawQuantity)
    ? Math.max(1, Math.floor(rawQuantity))
    : 1
  const requestedQuantity = normalizePurchaseQuantity(targetProduct, normalizedRawQuantity)
  if (requestedQuantity !== normalizedRawQuantity) {
    showQuantityLimit(targetProduct)
    return false
  }

  const alreadyPassed = hasQuestionnairePassed(targetProduct.id)
  if (Number(targetProduct.needQuestionnaire) === 1 && !alreadyPassed) {
    return navigateToNotice(targetProduct, requestedQuantity, mode)
  }

  const saved = addCartItem(targetProduct, requestedQuantity, {
    questionnairePassed: Number(targetProduct.needQuestionnaire) !== 1 || alreadyPassed
  })
  if (!saved) {
    uni.showToast({
      title: '加入购物车失败',
      icon: 'none'
    })
    return false
  }

  loadCartCount()
  loadRecommendCartQuantities()
  if (String(targetProduct.id) === String(product.value.id)) {
    loadQuantityFromStorage()
  }

  if (mode === 'buy') {
    return goCheckout(targetProduct)
  }

  uni.showToast({
    title: '已加入购物车',
    icon: 'success'
  })
  return true
}

const addCart = async () => {
  await handlePurchaseAction('cart', product.value, quantity.value)
}

const buyNow = async () => {
  await handlePurchaseAction('buy', product.value, quantity.value)
}

const handleBannerChange = (event) => {
  currentIndex.value = event.detail.current + 1
}

const showManualDrawer = () => {
  showManual.value = true
}
const closeManualDrawer = () => {
  showManual.value = false
}
const showPolicyDrawer = () => {
  showPolicy.value = true
}
const closePolicyDrawer = () => {
  showPolicy.value = false
}
const switchDetailTab = (tab) => {
  detailTab.value = tab
}
const switchRecommendTab = (tab) => {
  recommendTab.value = tab
}
const goBack = () => {
  uni.navigateBack()
}
const handleMore = () => {
  uni.showActionSheet({
    itemList: ['返回商品列表', '查看购物车'],
    success: ({ tapIndex }) => {
      if (tapIndex === 0) {
        uni.navigateTo({ url: '/pages/products/medicine_list' })
      } else if (tapIndex === 1) {
        goCart()
      }
    }
  })
}
const goConsult = () => {
  uni.showToast({
    title: '在线咨询功能建设中',
    icon: 'none'
  })
}
const showCustomerService = () => {
  console.info('category=CUSTOMER_SERVICE action=open result=pending page=THERAPY_DETAIL productId=%s', product.value.id || '')
  openCustomerServiceChat().then((result) => {
    console.info('category=CUSTOMER_SERVICE action=open result=%s page=THERAPY_DETAIL productId=%s', result ? 'success' : 'failed', product.value.id || '')
  })
}
const toggleCollect = () => {
  isCollected.value = !isCollected.value
}
const goCart = () => {
  uni.navigateTo({
    url: '/pages/cart/cart'
  })
}

const goToDetail = (item) => {
  if (!item?.id || String(item.id) === String(product.value.id)) return
  const page = isTraditionalTherapyProduct(item) ? 'therapy_detail' : 'medicine_detail'
  console.info('category=PRODUCT_NAVIGATION action=go_detail result=pending from=THERAPY_DETAIL targetPage=%s productId=%s', page, item.id)
  uni.navigateTo({
    url: `/pages/products/${page}?id=${item.id}&product=${encodeURIComponent(JSON.stringify(item))}`
  })
}

const animateFlyToCart = () => {
  try {
    const query = uni.createSelectorQuery().in(getCurrentInstance())
    query.select('.action-icon-btn').boundingClientRect((target) => {
      query.select('.recommend-add-btn').boundingClientRect((source) => {
        if (target && source) {
          flyingDot.value.show = true
          flyingDot.value.x = source.left + 10
          flyingDot.value.y = source.top + 10

          setTimeout(() => {
            flyingDot.value.x = 50
            flyingDot.value.y = window.screen.height - 200
            setTimeout(() => {
              flyingDot.value.show = false
            }, 400)
          }, 50)
        }
      }).exec()
    }).exec()
  } catch (error) {
    console.log('animateFlyToCart error:', error)
  }
}

const flyToCart = async (event, item) => {
  const nextQuantity = getCartProductQuantity(item.id, 0) + 1
  const added = await handlePurchaseAction('cart', item, nextQuantity)
  if (added) {
    animateFlyToCart()
  }
}

onLoad((options) => {
  logPageView('MEDICINE_DETAIL', options?.id || '')
  product.value = createEmptyProduct()

  if (options.id) {
    loadProduct(options.id)
  } else if (options.product) {
    try {
      const parsed = JSON.parse(decodeURIComponent(options.product))
      applyProduct(parsed)
      if (parsed.id) {
        loadProduct(parsed.id)
      }
    } catch (error) {
      console.error('parse product failed:', error)
    }
  }

  loadCartCount()
})

onShow(() => {
  loadCartCount()
  loadQuantityFromStorage()
  loadRecommendCartQuantities()
})
</script>

<style lang="scss" scoped>
.page {
  background: #fff;
  min-height: 100vh;
  padding-bottom: calc(100rpx + env(safe-area-inset-bottom));
  z-index: -1;
}

.page-lock {
  overflow: hidden;
  height: 100vh;
  touch-action: none;
}

.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 88rpx;
  background: rgba(255, 255, 255, 0.98);
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  z-index: 100;
  border-bottom: 1rpx solid #eee;
}

.header-left, .header-right {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-back {
  font-size: 48rpx;
  color: #333;
  font-weight: bold;
}

.icon-more {
  font-size: 36rpx;
  color: #333;
}

.header-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
}

.banner-wrapper {
  position: relative;
  background: #fff;
}

.banner {
  height: 750rpx;
}

.banner-img {
  width: 100%;
  height: 100%;
}

.banner-index {
  position: absolute;
  right: 24rpx;
  bottom: 24rpx;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  padding: 8rpx 20rpx;
  border-radius: 30rpx;
  font-size: 24rpx;
}

.price-box {
  margin-bottom: 18rpx;
  background-image: url('https://smf.lntcm.com/static/shop/green.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  padding: 20rpx 30rpx 50rpx;
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
}

.price-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.price-left {
  display: flex;
  flex-direction: column;
}

.price-tag {
  display: inline-block;
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: 18rpx;
  padding: 4rpx 14rpx;
  border-radius: 20rpx;
  margin-bottom: 8rpx;
  width: fit-content;
  font-weight: bold;
}

.price-info {
  display: flex;
  align-items: baseline;
  color: #fff;
}

.price-unit {
  font-size: 22rpx;
  font-weight: bold;
  color: #fff;
}

.price-num {
  font-size: 44rpx;
  font-weight: bold;
  color: #fff;
}

.price-decimal {
  font-size: 26rpx;
  font-weight: bold;
  color: #fff;
}

.price-right {
  display: flex;
  align-items: center;
}

.sales-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.sales-icon {
  font-size: 24rpx;
  margin-bottom: 4rpx;
}

.sales-count {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.9);
}

.trust-badges {
  display: flex;
  justify-content: flex-start;
  gap: 20rpx;
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx dashed rgba(255, 255, 255, 0.3);
  flex-wrap: wrap;
}

.trust-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.trust-icon {
  font-size: 22rpx;
  width: 28rpx;
  height: 28rpx;
  vertical-align: middle;
}

.trust-text {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.95);
}

.goods-info {
  margin-top: -50rpx;
  background: #fff;
  padding: 30rpx 30rpx 2rpx;
  border-radius: 32rpx;
}

.goods-name-row {
  margin-bottom: 10rpx;
  vertical-align: middle;
}

.therapy-tag,
.self-developed-tag,
.external-use-tag,
.limit-tag,
.goods-name {
  vertical-align: middle;
}

.self-developed-tag,
.external-use-tag,
.limit-tag {
  font-size: 20rpx;
  padding: 4rpx 10rpx;
  border-radius: 4rpx;
  font-weight: bold;
  margin-right: 8rpx;
  display: inline;
}

.self-developed-tag {
  background: #ff4b4b;
  color: #fff;
}

.external-use-tag {
  background: #e0f2fe;
  color: #0369a1;
}

.limit-tag {
  background: #fff7ed;
  color: #ea580c;
}

.therapy-tag {
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-weight: 600;
  margin-right: 16rpx;
  margin-bottom: 8rpx;
  display: inline;
  background: linear-gradient(135deg, #4a90e2, #67c6ff);
  color: #fff;
}

.goods-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #222;
  line-height: 1.4;
  word-break: break-all;
}

.goods-sub {
  font-size: 26rpx;
  color: #888;
  margin-top: 8rpx;
}

.limit-reminder {
  font-size: 24rpx;
  color: #ea580c;
  margin-top: 8rpx;
}

.policy-row {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 0rpx 30rpx;
}

.policy-row .policy-text {
  flex: 1;
}

.policy-text {
  font-size: 24rpx;
  color: #666;
}

.policy-icon {
  width: 75rpx;
  height: 75rpx;
  margin-right: 8rpx;
}

.policy-overlay,
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
}

.policy-drawer,
.drawer-content {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  max-height: 85vh;
  height: auto;
}

.policy-header,
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #eee;
  position: relative;
}

.policy-title,
.drawer-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.policy-close,
.drawer-close {
  position: absolute;
  right: 30rpx;
  top: 30rpx;
  font-size: 48rpx;
  color: #999;
}

.policy-body,
.drawer-body {
  width: 690rpx;
  padding: 30rpx;
  max-height: calc(85vh - 120rpx);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.drawer-body::-webkit-scrollbar {
  display: none;
}


.policy-section {
  margin-bottom: 30rpx;
}

.policy-section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 12rpx;
}

.check-icon {
  color: #ff4b4b;
  margin-right: 8rpx;
}

.policy-content {
  font-size: 26rpx;
  color: #666;
  line-height: 1.7;
}

.policy-footer {
  padding: 20rpx 30rpx 40rpx;
}

.policy-confirm-btn {
  background: linear-gradient(135deg, #ffd000, #ffb800);
  color: #333;
  font-size: 32rpx;
  font-weight: bold;
  text-align: center;
  padding: 24rpx 0;
  border-radius: 44rpx;
}

.select-section {
  background: #fff;
  padding: 20rpx 30rpx;
  display: flex;
  align-items: center;
  min-height: 64rpx;
}

.select-label {
  font-size: 28rpx;
  color: #999;
  margin-right: 20rpx;
}

.select-value {
  flex: 1;
  font-size: 28rpx;
  color: #222;
  min-width: 0;
  padding-right: 20rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quantity-stepper {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 16rpx;
}

.quantity-button {
  width: 52rpx;
  height: 52rpx;
  margin: 0;
  padding: 0;
  border: 1rpx solid #d9d9d9;
  border-radius: 50%;
  background: #fff;
  color: #222;
  font-size: 32rpx;
  line-height: 48rpx;
  text-align: center;
}

.quantity-button::after {
  border: none;
}

.quantity-button.disabled {
  border-color: #eee;
  background: #f7f7f7;
  color: #bbb;
}

.quantity-value {
  min-width: 48rpx;
  color: #222;
  font-size: 28rpx;
  font-weight: 600;
  text-align: center;
}

.select-arrow {
  font-size: 36rpx;
  color: #999;
}

.promise-box {
  background: #fff;
  padding: 20rpx 30rpx;
  display: flex;
  flex-wrap: wrap;
}

.promise-item {
  display: flex;
  align-items: center;
  margin-right: 30rpx;
  margin-bottom: 12rpx;
}

.promise-icon {
  font-size: 22rpx;
  color: #00c792;
  margin-right: 6rpx;
}

.promise-text {
  font-size: 22rpx;
  color: #666;
}

.delivery-row {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 5rpx 30rpx 30rpx;
}

.delivery-label {
  font-size: 26rpx;
  color: #222;
  margin-right: 16rpx;
}

.delivery-icon {
  width: 30rpx;
  height: 30rpx;
  margin-right: 8rpx;
}

.delivery-text {
  font-size: 26rpx;
  color: #222;
}

.sf-logo {
  width: 34rpx;
  height: 30rpx;
  margin-right: 12rpx;
}

.drug-manual-card {
  background: #f5f5f5;
  border-radius: 16rpx;
  margin: 20rpx 30rpx;
  padding: 24rpx;
  display: flex;
  align-items: flex-start;
  position: relative;
}

.manual-item {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.manual-item-title {
  font-size: 26rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.manual-item-content {
  font-size: 24rpx;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280rpx;
}

.manual-divider {
  width: 1rpx;
  height: 60rpx;
  background: #ddd;
  margin: 0 24rpx;
}

.manual-arrow {
  font-size: 36rpx;
  color: #999;
  position: absolute;
  right: 24rpx;
}

.drawer-section {
  margin-bottom: 30rpx;
}

.drawer-label {
  font-size: 28rpx;
  color: #333;
  font-weight: bold;
  display: block;
  margin-bottom: 12rpx;
}

.drawer-text {
  font-size: 26rpx;
  color: #666;
  line-height: 1.8;
}

.split-line {
  height: 20rpx;
  background: #f4f4f4;
}

.recommend-section {
  padding: 30rpx 0;
  width: 100%;
}

.recommend-section.combo-section {
  background: linear-gradient(180deg, #c8e6c9, #fff);
}

.recommend-section.star-section {
  background: linear-gradient(180deg, #ffecb3, #fff);
}

.recommend-tabs {
  display: flex;
  justify-content: flex-start;
  gap: 60rpx;
  padding-left: 30rpx;
  margin-bottom: 24rpx;
}

.recommend-tab {
  font-size: 28rpx;
  color: #333;
  padding-bottom: 8rpx;
  position: relative;
}

.recommend-tab.active {
  color: #e63939;
  font-weight: bold;
}

.recommend-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 50rpx;
  height: 4rpx;
  background: #e63939;
  border-radius: 2rpx;
}

.combo-disclaimer {
  font-size: 22rpx;
  color: #999;
  padding: 0 30rpx 16rpx;
  letter-spacing: 1rpx;
}

.recommend-content {
  padding: 20rpx 30rpx;
  border-radius: 16rpx;
  margin: 0;
  width: 100%;
  box-sizing: border-box;
}

.recommend-scroll {
  white-space: nowrap;
  width: 100%;
}

.recommend-item {
  display: inline-block;
  width: 200rpx;
  margin-right: 20rpx;
  vertical-align: top;
}

.recommend-img {
  width: 200rpx;
  height: 200rpx;
  border-radius: 12rpx;
  background: #f5f5f5;
}

.recommend-info {
  padding: 12rpx 0;
}

.recommend-name {
  display: block;
  font-size: 24rpx;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8rpx;
}

.recommend-price {
  font-size: 26rpx;
  color: #e63939;
  font-weight: bold;
}

.recommend-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.recommend-add-btn {
  width: 40rpx;
  height: 40rpx;
  background: linear-gradient(135deg, #e63939, #ff4b4b);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: bold;
  line-height: 1;
}

.recommend-add-btn.has-quantity {
  background: linear-gradient(135deg, #ff4b4b, #ff6b6b);
  font-size: 22rpx;
}

.flying-dot {
  position: fixed;
  width: 20rpx;
  height: 20rpx;
  background: #e63939;
  border-radius: 50%;
  z-index: 9999;
  pointer-events: none;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.pharmacist-card {
  background: linear-gradient(135deg, #f0fdf9, #e6f7f1);
  padding: 28rpx 30rpx;
  display: flex;
  align-items: center;
  border-radius: 20rpx;
  margin: 20rpx 24rpx;
  border: 1rpx solid #d4f0e6;
  box-shadow: 0 4rpx 20rpx rgba(0, 199, 146, 0.08);
}

.pharmacist-avatar-wrap {
  position: relative;
  margin-right: 24rpx;
}

.pharmacist-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  border: 4rpx solid #00c792;
  padding: 4rpx;
  background: #fff;
}

.online-tag {
  position: absolute;
  bottom: 0;
  right: 0;
  background: linear-gradient(135deg, #00c792, #00a676);
  color: #fff;
  font-size: 18rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  font-weight: bold;
  border: 2rpx solid #fff;
}

.pharmacist-detail {
  flex: 1;
}

.pharmacist-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #1a1a1a;
  display: flex;
  align-items: center;
}

.pharmacist-desc {
  font-size: 24rpx;
  color: #666;
  margin-top: 6rpx;
}

.consult-btn {
  background: linear-gradient(135deg, #00c792, #00a676);
  color: #fff;
  padding: 14rpx 36rpx;
  border-radius: 40rpx;
  font-size: 26rpx;
  font-weight: bold;
  box-shadow: 0 4rpx 16rpx rgba(0, 199, 146, 0.3);
}

.detail-header {
  background: #fff;
  display: flex;
  border-bottom: 1rpx solid #eee;
}

.detail-tab {
  flex: 1;
  text-align: center;
  padding: 28rpx 0;
  font-size: 28rpx;
  color: #666;
  position: relative;
}

.detail-tab.active {
  color: #ff4b4b;
  font-weight: bold;
}

.detail-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 48rpx;
  height: 4rpx;
  background: #ff4b4b;
  border-radius: 2rpx;
}

.detail-body {
  background: #fff;
  padding: 30rpx;
}

.detail-title,
.usage-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #222;
  margin-bottom: 24rpx;
}

.detail-richtext {
  font-size: 28rpx;
  color: #555;
  line-height: 1.8;
  width: 100%;
  overflow: hidden;
  word-break: break-word;
}

.detail-images {
  margin-top: 30rpx;
}

.detail-img {
  width: 100%;
  display: block;
  margin-bottom: 20rpx;
}

.spec-list,
.usage-list {
  background: #f9f9f9;
  border-radius: 12rpx;
  padding: 24rpx;
}

.spec-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  padding: 20rpx 0 16rpx;
  border-bottom: 2rpx solid #eee;
  margin-bottom: 8rpx;
}

.spec-item {
  display: flex;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #eee;
}

.spec-item:last-child {
  border-bottom: none;
}

.spec-label {
  width: 160rpx;
  font-size: 26rpx;
  color: #999;
}

.spec-value {
  flex: 1;
  font-size: 26rpx;
  color: #333;
}

.usage-box {
  margin-top: 30rpx;
}

.usage-item {
  margin-bottom: 20rpx;
}

.usage-item:last-child {
  margin-bottom: 0;
}

.usage-label {
  font-size: 26rpx;
  color: #999;
  display: block;
  margin-bottom: 8rpx;
}

.usage-text {
  font-size: 26rpx;
  color: #333;
  line-height: 1.6;
}

.usage-tip {
  margin-top: 20rpx;
}

.empty-block {
  font-size: 28rpx;
  color: #999;
  text-align: center;
  padding: 40rpx 0;
}

.reminder-bar {
  background: #fffbe6;
  padding: 20rpx 30rpx;
  display: flex;
  align-items: center;
  margin: 20rpx 0;
}

.reminder-icon {
  width: 32rpx;
  height: 32rpx;
  background: #faad14;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  margin-right: 12rpx;
}

.reminder-text {
  font-size: 24rpx;
  color: #ad6800;
  flex: 1;
  line-height: 1.6;
}

.bottom-space {
  height: 40rpx;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100rpx;
  background: #fff;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 1rpx solid #eee;
  z-index: 100;
}

.bottom-left {
  display: flex;
  justify-content: space-between;
  flex: 1;
}

.action-icon-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 40rpx;
}

.action-icon {
  font-size: 40rpx;
}

.action-text {
  font-size: 20rpx;
  color: #666;
  margin-top: 4rpx;
}

.cart-badge {
  position: absolute;
  top: -8rpx;
  right: -16rpx;
  min-width: 32rpx;
  height: 32rpx;
  background: #ff4b4b;
  color: #fff;
  border-radius: 16rpx;
  font-size: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6rpx;
}

.bottom-right {
  display: flex;
  margin-left: auto;
}

.btn-add-cart, .btn-buy {
  padding: 20rpx 36rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: bold;
}

.btn-service {
  background: linear-gradient(135deg, #4A90E2, #67B26F);
  color: #fff;
  margin-right: 16rpx;
}

.btn-add-cart {
  background: #ffa940;
  color: #fff;
  margin-right: 16rpx;
}

.btn-add-cart.disabled,
.btn-buy.disabled {
  background: #ccc !important;
  color: #999;
  cursor: not-allowed;
}

.btn-buy {
  background: linear-gradient(135deg, #ff4b4b, #ff6b6b);
  color: #fff;
}
</style>
