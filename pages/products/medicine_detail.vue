<template>
  <view class="page" :class="{ 'page-lock': showManual || showPolicy }">
    <!-- 顶部导航 -->
    <view class="header">
      <view class="header-left" @click="goBack">
        <text class="icon-back">‹</text>
      </view>
      <view class="header-title">药品详情</view>
      <view class="header-right" @click="handleMore">
        <text class="icon-more">⋮</text>
      </view>
    </view>

    <!-- 商品轮播图 -->
    <view class="banner-wrapper">
      <swiper class="banner" :indicator-dots="true" :autoplay="true" :interval="3000" indicator-color="rgba(255,255,255,0.4)" indicator-active-color="#fff">
        <swiper-item v-for="(img, idx) in productImages" :key="idx">
          <image class="banner-img" :src="img" mode="aspectFill" />
        </swiper-item>
      </swiper>
      <view class="banner-index">{{ currentIndex }}/{{ productImages.length }}</view>
    </view>

    <!-- 价格区域 -->
    <view class="price-box">
      <view class="price-info">
        <text class="price-unit">¥</text>
        <text class="price-num">{{ priceInteger }}</text>
        <text class="price-decimal">.{{ priceDecimal }}</text>
      </view>
      <view class="price-right">
        <text class="sales-count">累计销售 {{ product.salesCount || 9526 }}</text>
      </view>
    </view>

    <!-- 商品标题 -->
    <view class="goods-info">
      <view class="goods-name-row">
        <view class="self-developed-tag">自研</view>
        <view class="new-product-tag">院藏王牌制剂</view>
        <view class="star-product-tag">重磅新品</view>
        <view class="goods-name">{{ product.name }}</view>
      </view>
      <view class="goods-sub">{{ product.subName || product.specification }}</view>
      <view class="drug-reminder">非处方药 请依说明书进行使用</view>
      <!-- <view class="drug-reminder">处方药 处方药须凭处方在药师指导下购买和使用</view> -->
    </view>

    <!-- 退换政策说明抽屉 -->
    <view class="policy-overlay" v-if="showPolicy" @click="closePolicyDrawer">
      <view class="policy-drawer" @click.stop>
        <view class="policy-header">
          <text class="policy-title">退换货说明</text>
          <view class="policy-close" @click="closePolicyDrawer">×</view>
        </view>
        <view class="policy-body">
          <view class="policy-section">
            <text class="policy-section-title"><text class="check-icon">✓</text> 不支持七天无理由退换</text>
            <text class="policy-content">此商品不支持7天无理由退换货(药品属于特殊品类，根据《药品经营质量管理规范》规定，除药品质量原因外，药品一经售出，不得退换)</text>
          </view>
          <view class="policy-section">
            <text class="policy-section-title"><text class="check-icon">✓</text> 售后保障</text>
            <text class="policy-content">用药关怀 认证药师，24小时专业用药咨询</text>
          </view>
        </view>
        <view class="policy-footer">
          <view class="policy-confirm-btn" @click="closePolicyDrawer">我知道了</view>
        </view>
      </view>
    </view>
    <!-- 选择区域 -->
    <view class="select-section" @click="showSkuPopup">
      <view class="select-label">已选</view>
      <view class="select-value">
        <text>{{ selectedSku || product.defaultSku }}</text>
        <text class="select-num"> ×{{ quantity }}</text>
      </view>
      <text class="select-arrow">›</text>
    </view>

    <!-- 药品说明书入口 -->
    <view class="drug-manual-card" @click="showManualDrawer">
      <view class="manual-item">
        <view class="manual-item-title">💊 药物组成</view>
        <view class="manual-item-content">{{ product.subName2 || product.specification2 || '暂无信息' }}</view>
      </view>
      <view class="manual-divider"></view>
      <view class="manual-item">
        <view class="manual-item-title">📋 用法用量</view>
        <view class="manual-item-content">{{ product.dosage || '详见说明书' }}</view>
      </view>
      <view class="manual-arrow">›</view>
    </view>
      <view class="policy-row" @click="showPolicyDrawer">
        <text class="policy-text">不支持七天无理由退换 · 售后服务</text>
        <text class="select-arrow">›</text>
      </view>
      <view class="delivery-row">
        <text class="delivery-label">配送</text>
        <image class="sf-logo" src="https://smf.lntcm.com/static/logo/sf.png" mode="aspectFit" />
        <text class="delivery-text">顺丰配送约1-2天送达</text>
      </view>
	  <!-- 承诺标识 -->
	  <view class="promise-box">
	    <view class="promise-item">
	      <text class="promise-icon">✓</text>
	      <text class="promise-text">医院自研</text>
	    </view>
	    <view class="promise-item">
	      <text class="promise-icon">✓</text>
	      <text class="promise-text">正品保证</text>
	    </view>
	    <view class="promise-item">
	      <text class="promise-icon">✓</text>
	      <text class="promise-text">专业药师</text>
	    </view>
	    <view class="promise-item">
	      <text class="promise-icon">✓</text>
	      <text class="promise-text">顺丰物流</text>
	    </view>
		<view class="promise-item">
		  <text class="promise-icon">✓</text>
		  <text class="promise-text">隐私保护</text>
		</view>
	  </view>

    <!-- 药品说明书抽屉 -->
    <view class="drawer-overlay" v-if="showManual" @click="closeManualDrawer">
      <view class="drawer-content drawer-green-card" @click.stop>
        <view class="drawer-header">
          <text class="drawer-title">
            <text class="drawer-title-icon">📄</text>
            用药说明书
          </text>
          <view class="drawer-close" @click="closeManualDrawer">×</view>
        </view>
        <scroll-view class="drawer-body" scroll-y>
          <view class="drawer-section" v-if="product.subName2">
            <text class="drawer-label">【成份】</text>
            <text class="drawer-text">{{ product.subName2 }}</text>
          </view>
          <view class="drawer-section" v-if="product.subName">
            <text class="drawer-label">【功能主治】</text>
            <text class="drawer-text">{{ product.subName }}</text>
          </view>
          <view class="drawer-section" v-if="product.dosage">
            <text class="drawer-label">【用法用量】</text>
            <text class="drawer-text">{{ product.dosage }}</text>
          </view>
          <view class="drawer-section" v-if="product.adverseReactions">
            <text class="drawer-label">【不良反应】</text>
            <text class="drawer-text">{{ product.adverseReactions }}</text>
          </view>
          <view class="drawer-section" v-if="product.contraindications">
            <text class="drawer-label">【禁忌】</text>
            <text class="drawer-text">{{ product.contraindications }}</text>
          </view>
          <view class="drawer-section" v-if="product.attention">
            <text class="drawer-label">【注意事项】</text>
            <text class="drawer-text">{{ product.attention }}</text>
          </view>
          <view class="drawer-section" v-if="product.storage">
            <text class="drawer-label">【贮藏】</text>
            <text class="drawer-text">{{ product.storage }}</text>
          </view>
          <view class="drawer-section" v-if="product.manufacturer">
            <text class="drawer-label">【生产企业】</text>
            <text class="drawer-text">{{ product.manufacturer }}</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <view class="split-line"></view>

    <!-- 药师咨询 -->
    <view class="pharmacist-card">
      <view class="pharmacist-avatar-wrap">
        <image class="pharmacist-avatar" :src="pharmacistAvatar" mode="aspectFill" />
        <view class="online-tag">在线</view>
      </view>
      <view class="pharmacist-detail">
        <view class="pharmacist-name">用药咨询</view>
        <view class="pharmacist-desc">有问题随时问专业药师</view>
      </view>
      <view class="consult-btn" @click.stop="goConsult">咨询</view>
    </view>

     <view class="split-line"></view>
    <!-- 用药推荐 -->
    <view class="recommend-section" :class="{ 'gold-bg': recommendTab === 'star' }">
      <view class="recommend-header">
        <view class="recommend-tabs">
          <view class="recommend-tab" :class="{ active: recommendTab === 'combo' }" @click="switchRecommendTab('combo')">用药组合</view>
          <view class="recommend-tab" :class="{ active: recommendTab === 'star' }" @click="switchRecommendTab('star')">明星产品</view>
        </view>
      </view>
      <scroll-view class="recommend-scroll" scroll-x enable-flex>
        <view class="recommend-list">
          <view class="recommend-item" v-for="item in currentRecommendList" :key="item.id">
            <image class="recommend-image" :src="item.image" mode="aspectFill" />
            <view class="recommend-name">{{ item.name }}</view>
            <view class="recommend-spec">{{ item.specification }}</view>
            <view class="recommend-bottom">
              <view class="recommend-price">¥{{ item.price }}</view>
              <view class="recommend-add-btn" @click.stop="addToCart(item, $event)">
                <text v-if="getItemCartQty(item.id) > 0">{{ getItemCartQty(item.id) }}</text>
                <text v-else>+</text>
              </view>
            </view>
          </view>
        </view>
        </scroll-view>
      </view>

    <!-- 飞入购物车动画 -->
    <view class="fly-ball" :class="{ flying: isFlying }" :style="flyStyle">
      <text class="fly-ball-text">+1</text>
    </view>

    <!-- 购物车详情弹窗 -->
    <view class="cart-overlay" v-if="showCart" @click="closeCart">
      <view class="cart-popup" @click.stop>
        <view class="cart-header">
          <text class="cart-title">购物车</text>
          <view class="cart-header-right">
            <text class="cart-clear" @click.stop="clearCart">清空购物车</text>
          </view>
        </view>
        <scroll-view class="cart-body" scroll-y>
          <view class="cart-item" v-for="item in cartItems" :key="item.id">
            <image class="cart-item-img" :src="item.image" mode="aspectFill" />
            <view class="cart-item-info">
              <view class="cart-item-name">{{ item.name }}</view>
              <view class="cart-item-spec">{{ item.sku }}</view>
              <view class="cart-item-bottom">
                <view class="cart-item-price">¥{{ item.price }}</view>
                <view class="cart-item-qty">
                  <view class="qty-btn-small" @click.stop="updateCartItemQty(item, -1)">−</view>
                  <text class="qty-num">{{ item.quantity }}</text>
                  <view class="qty-btn-small" @click.stop="updateCartItemQty(item, 1)">+</view>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
        <view class="cart-footer">
          <view class="cart-total">
            <text class="cart-total-label">共{{ cartCount }}件</text>
            <text class="cart-total-price">¥{{ cartItems.reduce((sum, c) => sum + c.price * c.quantity, 0).toFixed(2) }}</text>
          </view>
          <view class="cart-checkout-btn" @click="goToCheckout">去结算</view>
        </view>
      </view>
    </view>


    <view class="split-line"></view>

    <!-- 详情Tab -->
    <view class="detail-header">
      <view class="detail-tab" :class="{ active: detailTab === 'desc' }" @click="switchDetailTab('desc')">详情</view>
      <view class="detail-tab" :class="{ active: detailTab === 'spec' }" @click="switchDetailTab('spec')">说明书</view>
      <view class="detail-tab" :class="{ active: detailTab === 'review' }" @click="switchDetailTab('review')">评价</view>
    </view>

    <!-- 商品详情内容 -->
    <view class="detail-body" v-if="detailTab === 'desc'">
      <view class="detail-title">商品详情</view>
      <rich-text class="detail-richtext" :nodes="product.intro"></rich-text>
      <view class="detail-images" v-if="product.detailImages">
        <image v-for="(img, idx) in product.detailImages" :key="idx" :src="img" mode="widthFix" class="detail-img" />
      </view>
    </view>

    <!-- 规格参数 -->
    <view class="detail-body" v-if="detailTab === 'spec'">
      <view class="spec-list">
        <view class="spec-item" v-if="product.specification">
          <text class="spec-label">药品名称</text>
          <text class="spec-value">{{ product.name }}</text>
        </view>
        <view class="spec-item" v-if="product.manufacturer">
          <text class="spec-label">剂型</text>
          <text class="spec-value">{{ product.manufacturer }}</text>
        </view>
        <view class="spec-item" v-if="product.manufacturer">
          <text class="spec-label">包装</text>
          <text class="spec-value">{{ product.manufacturer }}</text>
        </view>
        <view class="spec-item" v-if="product.approvalNumber">
          <text class="spec-label">有效期</text>
          <text class="spec-value">{{ product.approvalNumber }}</text>
        </view>
        <view class="spec-item" v-if="product.storage">
          <text class="spec-label">产地类型</text>
          <text class="spec-value">{{ product.storage }}</text>
        </view>
        <view class="spec-item" v-if="product.packSize">
          <text class="spec-label">批准文号</text>
          <text class="spec-value">{{ product.packSize }}</text>
        </view>
        <view class="spec-item" v-if="product.packSize">
          <text class="spec-label">生产单位</text>
          <text class="spec-value">{{ product.packSize }}</text>
        </view>
      </view>

      <!-- 用药说明 -->
      <view class="usage-box">
        <view class="usage-title">用药说明</view>
        <view class="usage-list">
          <view class="usage-item" v-if="product.dosage">
            <text class="usage-label">用法用量</text>
            <text class="usage-text">{{ product.dosage }}</text>
          </view>
          <view class="usage-item" v-if="product.adverseReactions">
            <text class="usage-label">不良反应</text>
            <text class="usage-text">{{ product.adverseReactions }}</text>
          </view>
          <view class="usage-item" v-if="product.contraindications">
            <text class="usage-label">禁忌</text>
            <text class="usage-text">{{ product.contraindications }}</text>
          </view>
          <view class="usage-item" v-if="product.attention">
            <text class="usage-label">注意事项</text>
            <text class="usage-text">{{ product.attention }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 评价 -->
    <view class="detail-body" v-if="detailTab === 'review'">
      <view class="review-summary">
        <view class="review-score-wrap">
          <text class="review-score-num">{{ reviewScore }}</text>
          <text class="review-score-label">分</text>
        </view>
        <view class="review-meta">
          <text class="review-total">{{ reviewCount }}条评价</text>
          <text class="review-good-rate">好评率 {{ goodRate }}%</text>
        </view>
      </view>
      <view class="review-list">
        <view class="review-item" v-for="item in reviews" :key="item.id">
          <view class="review-top">
            <image class="review-avatar" :src="item.avatar || defaultAvatar" mode="aspectFill" />
            <view class="review-user-info">
              <text class="review-user-name">{{ item.userName }}</text>
              <view class="review-stars">
                <text v-for="n in 5" :key="n" class="star" :class="{ on: n <= item.rating }">★</text>
              </view>
            </view>
            <text class="review-time">{{ item.time }}</text>
          </view>
          <view class="review-content">{{ item.content }}</view>
        </view>
      </view>
    </view>

    <!-- 用药提醒 -->
    <view class="reminder-bar">
      <text class="reminder-icon">!</text>
      <text class="reminder-text">请仔细阅读药品说明书或在医师指导下使用.1.OTC药品请按药品说明书或在药师指导下购买和使用，请将药品置于儿童无法触及位置;2.依据《药品经营质量管理规范》，除药品质量原因外药品一经售出，不得退换;3.由于厂家不定期更换产品包装或修订说明书，请以实际收到的产品包装及其附带的说明书为准。</text>
    </view>

    <!-- 底部占位 -->
    <view class="bottom-space"></view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar">
      <view class="bottom-left">
        <view class="action-icon-btn" @click="toggleCollect">
          <text class="action-icon">{{ isCollected ? '❤️' : '🤍' }}</text>
          <text class="action-text">{{ isCollected ? '已收藏' : '收藏' }}</text>
        </view>
        <view class="action-icon-btn" @click="goCart">
          <text class="action-icon" :class="{ shake: cartShake }">🛒</text>
          <text class="action-text">购物车</text>
          <view class="cart-badge" :class="{ shake: cartShake }" v-if="cartCount > 0">{{ cartCount > 99 ? '99+' : cartCount }}</view>
        </view>
      </view>
      <view class="bottom-right">
        <view class="btn-add-cart" @click="addCart">加入购物车</view>
        <view class="btn-buy" @click="buyNow">立即购买</view>
      </view>
    </view>

    <!-- SKU选择弹窗 -->
    <view class="sku-overlay" v-if="showSku" @click="closeSku">
      <view class="sku-popup" @click.stop>
        <view class="sku-header">
          <image class="sku-img" :src="productImages[0]" mode="aspectFill" />
          <view class="sku-info">
            <view class="sku-price">¥{{ product.price }}</view>
            <view class="sku-stock">库存 {{ product.stock || 99 }} 件</view>
            <view class="sku-selected">已选：{{ selectedSku }}</view>
          </view>
          <view class="sku-close" @click="closeSku">×</view>
        </view>
        <view class="sku-body">
          <view class="sku-spec-section" v-if="product.skus && product.skus.length > 0">
            <view class="sku-spec-title">规格</view>
            <view class="sku-spec-list">
              <view 
                class="sku-spec-item" 
                :class="{ active: sku === selectedSku }"
                v-for="sku in product.skus" 
                :key="sku"
                @click="selectSku(sku)"
              >{{ sku }}</view>
            </view>
          </view>
          <view class="sku-quantity-section">
            <view class="sku-qty-title">数量</view>
            <view class="sku-qty-control">
              <view class="qty-btn" @click="decQty">
                <text class="qty-symbol">−</text>
              </view>
              <input class="qty-input" type="number" v-model="quantity" />
              <view class="qty-btn" @click="incQty">
                <text class="qty-symbol">+</text>
              </view>
            </view>
          </view>
        </view>
        <view class="sku-footer">
          <view class="sku-add-cart" @click="confirmAddCart">加入购物车</view>
          <view class="sku-buy" @click="confirmBuy">立即购买</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getImageUrl } from '@/utils/config.js'
import { logPageView } from '@/api/access-log.js'

const product = ref({
  id: '1',
  name: '吹喉消炎散',
  subName: '清热解毒，消炎止痛。用于重舌，木舌，鹅口疮及口舌破烂，咽喉肿痛。',
  subName2: '青黛、硼砂、栀子等',
  price: 28.50,
  originalPrice: 36.00,
  specification: '10g×9袋/盒',
  defaultSku: '10g×9袋/盒',
  manufacturer: '辽宁中医药大学附属医院',
  approvalNumber: '国药准字Z44023456',
  storage: '密封，置阴凉干燥处保存',
  packSize: '10g×9袋/盒',
  dosage: '开水冲服，一次14克，一日3次',
  adverseReactions: '偶见皮疹、荨麻疹、药热及粒细胞减少',
  contraindications: '严重肝肾功能不全者禁用',
  attention: '忌烟、酒及辛辣、生冷、油腻食物',
  deliveryCity: '沈阳市',
  deliveryDays: '1-2',
  freight: 0,
  stock: 168,
  skus: ['10g×9袋/盒', '10g×12袋/盒', '10g×18袋/盒'],
  intro: '复方感冒灵颗粒是一种用于治疗风热感冒的中成药，主要成分包括金银花、野菊花、岗梅、对乙酰氨基酚等。本品为浅棕黄色至棕色的颗粒，味甜、微苦。具有辛凉解表，清热解毒的功效，适用于风热感冒之发热、微恶风寒、头身痛、口干而渴、鼻塞涕浊、咽喉红肿疼痛、咳嗽、痰黄粘稠等症状。',
  detailImages: [
    'https://smf.lntcm.com/static/medicine/2S7A5409.JPG'
  ]
})

const quantity = ref(1)
const currentIndex = ref(1)
const detailTab = ref('desc')
const isCollected = ref(false)
const cartCount = ref(0)
const showSku = ref(false)
const selectedSku = ref('')
const showManual = ref(false)
const showPolicy = ref(false)
const isFlying = ref(false)
const flyStyle = ref({})
const cartShake = ref(false)
const showCart = ref(false)

const reviewScore = ref(4.8)
const reviewCount = ref(236)
const goodRate = ref(98)
const reviews = ref([
  { id: 1, userName: '张女士', avatar: '', rating: 5, time: '2024-01-15', content: '效果很好，感冒吃了两天就好了，物流也很快。' },
  { id: 2, userName: '李先生', avatar: '', rating: 5, time: '2024-01-10', content: '一直在用这个牌子的感冒药，大品牌值得信赖。' },
  { id: 3, userName: '王同学', avatar: '', rating: 4, time: '2024-01-05', content: '还可以，见效挺快的，就是有点苦。' }
])

const pharmacistAvatar = getImageUrl('https://smf.lntcm.com/static/logo/zixun.svg')
const defaultAvatar = getImageUrl('/static/logo.png')

const recommendedMedicines = ref([
  {
    id: 1,
    name: '复方氨酚烷胺胶囊',
    specification: '12粒/盒',
    price: '15.80',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')
  },
  {
    id: 2,
    name: '板蓝根颗粒',
    specification: '10g×20袋',
    price: '22.50',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_zhou1.png')
  },
  {
    id: 3,
    name: '金银花口服液',
    specification: '10ml×12支',
    price: '28.00',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')
  },
  {
    id: 4,
    name: '复方氨酚烷胺胶囊',
    specification: '12粒/盒',
    price: '15.80',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')
  },
  {
    id: 5,
    name: '板蓝根颗粒',
    specification: '10g×20袋',
    price: '22.50',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_zhou1.png')
  },
  {
    id: 6,
    name: '金银花口服液',
    specification: '10ml×12支',
    price: '28.00',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')
  }
])

const recommendTab = ref('combo')

const comboMedicines = ref([
  {
    id: 1,
    name: '复方氨酚烷胺胶囊',
    specification: '12粒/盒',
    price: '15.80',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')
  },
  {
    id: 2,
    name: '板蓝根颗粒',
    specification: '10g×20袋',
    price: '22.50',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_zhou1.png')
  },
  {
    id: 3,
    name: '金银花口服液',
    specification: '10ml×12支',
    price: '28.00',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')
  },
  {
    id: 4,
    name: '维生素C泡腾片',
    specification: '10片/盒',
    price: '18.50',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')
  }
])

const starMedicines = ref([
  {
    id: 5,
    name: '川贝清肺糖浆',
    specification: '120ml/瓶',
    price: '35.00',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')
  },
  {
    id: 6,
    name: '金银花露',
    specification: '250ml/瓶',
    price: '12.00',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_zhou1.png')
  },
  {
    id: 7,
    name: '枇杷膏',
    specification: '180g/瓶',
    price: '42.00',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')
  },
  {
    id: 8,
    name: '感冒灵颗粒',
    specification: '10g×9袋',
    price: '16.80',
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png')
  }
])

const currentRecommendList = computed(() => {
  return recommendTab.value === 'combo' ? comboMedicines.value : starMedicines.value
})

const cartItems = computed(() => {
  return uni.getStorageSync('medicine_cart') || []
})

const switchRecommendTab = (tab) => {
  recommendTab.value = tab
}

const getItemCartQty = (id) => {
  const cart = uni.getStorageSync('medicine_cart') || []
  const item = cart.find(c => c.id === id)
  return item ? item.quantity : 0
}

const addToCart = (item, event) => {
  let cart = uni.getStorageSync('medicine_cart') || []
  const existIdx = cart.findIndex(c => c.id === item.id)
  
  if (existIdx > -1) {
    cart[existIdx].quantity += 1
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: parseFloat(item.price),
      sku: item.specification,
      quantity: 1,
      image: item.image
    })
  }
  
  uni.setStorageSync('medicine_cart', cart)
  cartCount.value = cart.reduce((sum, c) => sum + c.quantity, 0)
  cartShake.value = true
  setTimeout(() => { cartShake.value = false }, 500)
  
  if (event) {
    startFlyAnimation(event)
  }
}

const startFlyAnimation = (event) => {
  const query = uni.createSelectorQuery()
  query.select('.action-icon-btn:last-child').boundingClientRect((cartRect) => {
    if (!cartRect || !event) return
    
    const touch = event.touches ? event.touches[0] : event
    const startX = touch.clientX || event.detail?.x || 0
    const startY = touch.clientY || event.detail?.y || 0
    
    flyStyle.value = {
      left: startX + 'px',
      top: startY + 'px',
      opacity: 1
    }
    
    isFlying.value = true
    
    setTimeout(() => {
      flyStyle.value = {
        left: cartRect.left + cartRect.width / 2 + 'px',
        top: cartRect.top + cartRect.height / 2 + 'px',
        opacity: 0,
        transition: 'all 0.6s cubic-bezier(0.5, -0.5, 0.3, 1)'
      }
    }, 50)
    
    setTimeout(() => {
      isFlying.value = false
      flyStyle.value = {}
    }, 700)
  }).exec()
}

const productImages = computed(() => {
  if (product.value.detailImages && product.value.detailImages.length > 0) {
    return product.value.detailImages
  }
  return [getImageUrl('https://smf.lntcm.com/static/medicine/2S7A5409.JPG')]
})

const priceInteger = computed(() => Math.floor(product.value.price || 0))
const priceDecimal = computed(() => {
  const dec = (product.value.price || 0).toFixed(2).split('.')[1]
  return dec || '00'
})

const goBack = () => uni.navigateBack()

const handleMore = () => {
  uni.showActionSheet({
    itemList: ['分享', '首页', '客服'],
    success: (res) => {
      if (res.tapIndex === 0) {
        uni.showToast({ title: '分享功能开发中', icon: 'none' })
      } else if (res.tapIndex === 1) {
        uni.switchTab({ url: '/pages/index/index' })
      }
    }
  })
}

const showSkuPopup = () => {
  selectedSku.value = product.value.skus && product.value.skus.length > 0 
    ? product.value.skus[0] 
    : product.value.defaultSku
  showSku.value = true
}

const closeSku = () => {
  showSku.value = false
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

const selectSku = (sku) => {
  selectedSku.value = sku
}

const incQty = () => {
  if (quantity.value < (product.value.stock || 99)) {
    quantity.value++
  }
}

const decQty = () => {
  if (quantity.value > 1) {
    quantity.value--
  }
}

const switchDetailTab = (tab) => {
  detailTab.value = tab
}

const goConsult = () => {
  uni.showModal({
    title: '药师咨询',
    content: '是否拨打客服热线 400-888-9999？',
    success: (res) => {
      if (res.confirm) {
        uni.makePhoneCall({ phoneNumber: '400-888-9999' })
      }
    }
  })
}

const toggleCollect = () => {
  isCollected.value = !isCollected.value
  uni.showToast({
    title: isCollected.value ? '已收藏' : '已取消收藏',
    icon: 'success'
  })
}

const goCart = () => {
  if (cartCount.value > 0) {
    showCart.value = true
  } else {
    uni.showToast({ title: '购物车是空的', icon: 'none' })
  }
}

const closeCart = () => {
  showCart.value = false
}

const clearCart = () => {
  uni.showModal({
    title: '提示',
    content: '确定要清空购物车吗？',
    success: (res) => {
      if (res.confirm) {
        uni.removeStorageSync('medicine_cart')
        cartCount.value = 0
        showCart.value = false
        uni.showToast({ title: '购物车已清空', icon: 'success' })
      }
    }
  })
}

const updateCartItemQty = (item, delta) => {
  let cart = uni.getStorageSync('medicine_cart') || []
  const existIdx = cart.findIndex(c => c.id === item.id)
  
  if (existIdx > -1) {
    cart[existIdx].quantity += delta
    if (cart[existIdx].quantity <= 0) {
      cart.splice(existIdx, 1)
    }
  }
  
  uni.setStorageSync('medicine_cart', cart)
  cartCount.value = cart.reduce((sum, c) => sum + c.quantity, 0)
}

const removeCartItem = (item) => {
  let cart = uni.getStorageSync('medicine_cart') || []
  cart = cart.filter(c => c.id !== item.id)
  uni.setStorageSync('medicine_cart', cart)
  cartCount.value = cart.reduce((sum, c) => sum + c.quantity, 0)
}

const goToCheckout = () => {
  if (cartCount.value === 0) {
    uni.showToast({ title: '购物车是空的', icon: 'none' })
    return
  }
  showCart.value = false
  uni.switchTab({ url: '/pages/cart/cart' })
}

const addCart = () => {
  if (product.value.skus && product.value.skus.length > 0) {
    showSkuPopup()
  } else {
    doAddCart()
  }
}

const buyNow = () => {
  if (product.value.skus && product.value.skus.length > 0) {
    showSkuPopup()
  } else {
    doBuy()
  }
}

const confirmAddCart = () => {
  doAddCart()
  closeSku()
}

const confirmBuy = () => {
  doBuy()
  closeSku()
}

const doAddCart = () => {
  let cart = uni.getStorageSync('medicine_cart') || []
  const existIdx = cart.findIndex(item => item.id === product.value.id && item.sku === selectedSku.value)
  
  if (existIdx > -1) {
    cart[existIdx].quantity += quantity.value
  } else {
    cart.push({
      id: product.value.id,
      name: product.value.name,
      price: product.value.price,
      sku: selectedSku.value,
      quantity: quantity.value,
      image: productImages.value[0]
    })
  }
  
  uni.setStorageSync('medicine_cart', cart)
  cartCount.value = cart.reduce((sum, item) => sum + item.quantity, 0)
  
  uni.showToast({ title: '已加入购物车', icon: 'success' })
}

const doBuy = () => {
  const orderData = {
    id: product.value.id,
    name: product.value.name,
    price: product.value.price,
    sku: selectedSku.value,
    quantity: quantity.value,
    image: productImages.value[0]
  }
  
  uni.navigateTo({
    url: `/pages/order/confirm?medicine=${encodeURIComponent(JSON.stringify(orderData))}`
  })
}

const loadCartCount = () => {
  const cart = uni.getStorageSync('medicine_cart') || []
  cartCount.value = cart.reduce((sum, item) => sum + item.quantity, 0)
}

onLoad((options) => {
  logPageView('MEDICINE_DETAIL', options?.id || '')
  
  if (options.id) {
    product.value.id = options.id
  }
  
  if (options.product) {
    try {
      const data = JSON.parse(decodeURIComponent(options.product))
      product.value = { ...product.value, ...data }
    } catch (e) {
      console.error('解析商品数据失败', e)
    }
  }
  
  loadCartCount()
})
</script>

<style lang="scss" scoped>
.page {
  background: #fff;
  min-height: 100vh;
  padding-bottom: calc(100rpx + env(safe-area-inset-bottom));
}

.page-lock {
  overflow: hidden;
  height: 100vh;
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
  background: #fff;
  padding: 24rpx 30rpx;
  display: flex;
  align-items: baseline;
}

.price-info {
  display: flex;
  align-items: baseline;
  color: #ff4b4b;
}

.price-unit {
  font-size: 28rpx;
  font-weight: bold;
}

.price-num {
  font-size: 56rpx;
  font-weight: bold;
}

.price-decimal {
  font-size: 32rpx;
  font-weight: bold;
}

.price-right {
  margin-left: auto;
  display: flex;
  align-items: center;
}

.sales-count {
  font-size: 22rpx;
  color: #999;
}

.goods-info {
  background: #fff;
  padding: 0 30rpx 2rpx;
}

.goods-name-row {
  display: flex;
  align-items: center;
}

.self-developed-tag {
  background: #ff4b4b;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 10rpx;
  border-radius: 4rpx;
  margin-right: 12rpx;
  font-weight: bold;
}

.new-product-tag {
  background: #4a4a4a;
  color: #d4af37;
  font-size: 20rpx;
  padding: 4rpx 10rpx;
  border-radius: 4rpx;
  margin-right: 12rpx;
  font-weight: bold;
}

.star-product-tag {
  background: #00c792;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 10rpx;
  border-radius: 4rpx;
  margin-right: 12rpx;
  font-weight: bold;
}

.goods-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #222;
  line-height: 1.4;
  flex: 1;
}

.goods-sub {
  font-size: 26rpx;
  color: #888;
  margin-top: 8rpx;
}

.drug-reminder {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
}

.policy-row {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 16rpx 30rpx;
}

.policy-row .policy-text {
  flex: 1;
}

.policy-text {
  font-size: 24rpx;
  color: #666;
}

.policy-arrow {
  font-size: 28rpx;
  color: #999;
  margin-left: 8rpx;
}

.policy-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 300;
}

.policy-drawer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
}

.policy-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #eee;
  position: relative;
}

.policy-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.policy-close {
  position: absolute;
  right: 30rpx;
  top: 30rpx;
  font-size: 48rpx;
  color: #999;
}

.policy-body {
  padding: 30rpx;
}

.policy-section {
  margin-bottom: 30rpx;
}

.policy-section:last-child {
  margin-bottom: 0;
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

.select-section {
  background: #fff;
  padding: 20rpx 30rpx;
  display: flex;
  align-items: center;
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
}

.select-num {
  color: #ff4b4b;
}

.select-arrow {
  font-size: 36rpx;
  color: #999;
}

.delivery-section {
  background: #fff;
  padding: 20rpx 30rpx;
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

.delivery-text {
  font-size: 26rpx;
  color: #222;
  display: flex;
  align-items: center;
}

.sf-logo {
  width: 34rpx;
  height: 30rpx;
}

.delivery-icon {
  font-size: 28rpx;
  margin-right: 10rpx;
}

.delivery-content {
  flex: 1;
}

.delivery-city {
  font-size: 28rpx;
  color: #222;
}

.delivery-time {
  font-size: 26rpx;
  color: #888;
}

.freight-row {
  display: flex;
  justify-content: space-between;
  margin-top: 16rpx;
  padding-left: 38rpx;
}

.freight-label {
  font-size: 26rpx;
  color: #999;
}

.freight-value {
  font-size: 26rpx;
  color: #ff4b4b;
}

.freight-value.free {
  color: #00c792;
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

.drug-manual-entry {
  background: #fff;
  padding: 5rpx 30rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.entry-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.entry-icon {
  font-size: 36rpx;
  margin-right: 16rpx;
}

.entry-info {
  display: flex;
  flex-direction: column;
}

.entry-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #222;
}

.entry-brief {
  font-size: 24rpx;
  color: #888;
  margin-top: 4rpx;
}

.entry-arrow {
  font-size: 36rpx;
  color: #999;
}

.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 300;
}

.drawer-content {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 80vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
}

.drawer-green-card {
  border-radius: 24rpx 24rpx 0 0;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.1);
  position: relative;
}

.drawer-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  display: flex;
  align-items: center;
}

.drawer-title-icon {
  margin-right: 10rpx;
  font-size: 36rpx;
}

.drawer-close {
  position: absolute;
  right: 30rpx;
  top: 30rpx;
  font-size: 48rpx;
  color: #999;
}

.drawer-body {
  flex: 1;
  padding: 30rpx;
  max-height: calc(80vh - 120rpx);
}

.drawer-section {
  margin-bottom: 30rpx;
  width: 92%;
}

.drawer-section:last-child {
  margin-bottom: 0;
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

.recommend-section {
  background: linear-gradient(180deg, #e8f5e9 0%, #ffffff 30%);
  padding: 24rpx 30rpx;
}

.gold-bg {
  background: linear-gradient(180deg, #fff8e1 0%, #ffffff 30%);
}

.recommend-header {
  margin-bottom: 20rpx;
}

.recommend-tabs {
  display: flex;
  gap: 24rpx;
}

.recommend-tab {
  font-size: 28rpx;
  color: #666;
  padding-bottom: 8rpx;
  position: relative;
}

.recommend-tab.active {
  color: #ff4c4c;
  font-weight: bold;
}

.recommend-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 48rpx;
  height: 4rpx;
  background: #ff4c4c;
  border-radius: 2rpx;
}

.recommend-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #222;
}

.recommend-scroll {
  white-space: nowrap;
}

.recommend-list {
  display: inline-flex;
}

.recommend-item {
  width: 200rpx;
  margin-right: 16rpx;
  display: inline-block;
  vertical-align: top;
}

.recommend-item:last-child {
  margin-right: 0;
}

.recommend-image {
  width: 100%;
  height: 160rpx;
  border-radius: 8rpx;
  background: #f5f5f5;
}

.recommend-name {
  font-size: 26rpx;
  color: #222;
  margin-top: 12rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recommend-spec {
  font-size: 22rpx;
  color: #999;
  margin-top: 6rpx;
}

.recommend-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8rpx;
}

.recommend-price {
  font-size: 26rpx;
  color: #ff4b4b;
  font-weight: bold;
}

.recommend-add-btn {
  min-width: 44rpx;
  height: 44rpx;
  background: #ff4b4b;
  color: #fff;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  font-size: 28rpx;
  font-weight: bold;
}

.split-line {
  height: 20rpx;
  background: #f4f4f4;
}

.pharmacist-card {
  background: #fff;
  padding: 24rpx 30rpx;
  display: flex;
  align-items: center;
}

.pharmacist-avatar-wrap {
  position: relative;
  margin-right: 20rpx;
}

.pharmacist-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
}

.online-tag {
  position: absolute;
  bottom: -4rpx;
  right: -4rpx;
  background: #00c792;
  color: #fff;
  font-size: 18rpx;
  padding: 2rpx 8rpx;
  border-radius: 10rpx;
}

.pharmacist-detail {
  flex: 1;
}

.pharmacist-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #222;
}

.pharmacist-desc {
  font-size: 24rpx;
  color: #888;
  margin-top: 4rpx;
}

.consult-btn {
  background: linear-gradient(135deg, #00c792, #00a676);
  color: #fff;
  padding: 12rpx 32rpx;
  border-radius: 40rpx;
  font-size: 26rpx;
  font-weight: bold;
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

.detail-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #222;
  margin-bottom: 24rpx;
}

.detail-richtext {
  font-size: 28rpx;
  color: #555;
  line-height: 1.8;
}

.detail-images {
  margin-top: 30rpx;
}

.detail-img {
  width: 100%;
  display: block;
  margin-bottom: 20rpx;
}

.spec-list {
  background: #f9f9f9;
  border-radius: 12rpx;
  padding: 24rpx;
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

.usage-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #222;
  margin-bottom: 20rpx;
}

.usage-list {
  background: #f9f9f9;
  border-radius: 12rpx;
  padding: 24rpx;
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

.review-summary {
  background: #fff8f8;
  padding: 30rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  margin-bottom: 30rpx;
}

.review-score-wrap {
  display: flex;
  align-items: baseline;
  margin-right: 40rpx;
}

.review-score-num {
  font-size: 60rpx;
  font-weight: bold;
  color: #ff4b4b;
}

.review-score-label {
  font-size: 24rpx;
  color: #ff4b4b;
}

.review-meta {
  display: flex;
  flex-direction: column;
}

.review-total {
  font-size: 26rpx;
  color: #333;
}

.review-good-rate {
  font-size: 24rpx;
  color: #888;
  margin-top: 6rpx;
}

.review-item {
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.review-item:last-child {
  border-bottom: none;
}

.review-top {
  display: flex;
  align-items: center;
}

.review-avatar {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  margin-right: 16rpx;
}

.review-user-info {
  flex: 1;
}

.review-user-name {
  font-size: 28rpx;
  color: #333;
  display: block;
}

.review-stars {
  display: flex;
  margin-top: 4rpx;
}

.star {
  font-size: 24rpx;
  color: #ddd;
  margin-right: 2rpx;
}

.star.on {
  color: #ffb800;
}

.review-time {
  font-size: 24rpx;
  color: #999;
}

.review-content {
  font-size: 28rpx;
  color: #555;
  line-height: 1.6;
  margin-top: 16rpx;
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

.btn-add-cart {
  background: #ffa940;
  color: #fff;
  margin-right: 16rpx;
}

.btn-buy {
  background: linear-gradient(135deg, #ff4b4b, #ff6b6b);
  color: #fff;
}

.sku-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
}

.sku-popup {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding-bottom: env(safe-area-inset-bottom);
}

.sku-header {
  display: flex;
  padding: 30rpx;
  border-bottom: 1rpx solid #eee;
  position: relative;
}

.sku-img {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  margin-right: 24rpx;
}

.sku-info {
  flex: 1;
  padding-top: 10rpx;
}

.sku-price {
  font-size: 40rpx;
  font-weight: bold;
  color: #ff4b4b;
}

.sku-stock {
  font-size: 24rpx;
  color: #888;
  margin-top: 8rpx;
}

.sku-selected {
  font-size: 26rpx;
  color: #333;
  margin-top: 8rpx;
}

.sku-close {
  position: absolute;
  right: 30rpx;
  top: 30rpx;
  font-size: 48rpx;
  color: #999;
}

.sku-body {
  padding: 30rpx;
  max-height: 500rpx;
  overflow-y: auto;
}

.sku-spec-section {
  margin-bottom: 30rpx;
}

.sku-spec-title {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 16rpx;
}

.sku-spec-list {
  display: flex;
  flex-wrap: wrap;
}

.sku-spec-item {
  padding: 16rpx 28rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  font-size: 26rpx;
  color: #333;
  margin-right: 16rpx;
  margin-bottom: 16rpx;
}

.sku-spec-item.active {
  background: #ffe8e8;
  color: #ff4b4b;
  border: 1rpx solid #ff4b4b;
}

.sku-quantity-section {
  display: flex;
  align-items: center;
}

.sku-qty-title {
  font-size: 28rpx;
  color: #333;
}

.sku-qty-control {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.qty-btn {
  width: 56rpx;
  height: 56rpx;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
}

.qty-symbol {
  font-size: 32rpx;
  color: #333;
}

.qty-input {
  width: 80rpx;
  height: 56rpx;
  text-align: center;
  background: #f5f5f5;
  margin: 0 16rpx;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.sku-footer {
  display: flex;
  padding: 20rpx 30rpx;
  border-top: 1rpx solid #eee;
}

.sku-add-cart, .sku-buy {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: bold;
}

.sku-add-cart {
  background: #ffa940;
  color: #fff;
  margin-right: 16rpx;
}

.sku-buy {
  background: linear-gradient(135deg, #ff4b4b, #ff6b6b);
  color: #fff;
}

.fly-ball {
  position: fixed;
  width: 40rpx;
  height: 40rpx;
  background: #ff4b4b;
  border-radius: 50%;
  z-index: 999;
  pointer-events: none;
  transform: scale(0);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cart-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
}

.cart-popup {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 70vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
}

.cart-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #eee;
  position: relative;
}

.cart-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.cart-header-right {
  position: absolute;
  right: 30rpx;
  top: 30rpx;
  display: flex;
  align-items: center;
}

.cart-clear {
  font-size: 26rpx;
  color: #ff4b4b;
  margin-right: 20rpx;
}

.cart-close {
  font-size: 48rpx;
  color: #999;
}

.cart-body {
  flex: 1;
  padding: 20rpx 30rpx;
  max-height: 50vh;
  width: 92%;
}

.cart-item {
  display: flex;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
  position: relative;
}

.cart-item:last-child {
  border-bottom: none;
}

.cart-item-img {
  width: 120rpx;
  height: 120rpx;
  border-radius: 8rpx;
  margin-right: 20rpx;
}

.cart-item-info {
  flex: 1;
}

.cart-item-name {
  font-size: 28rpx;
  color: #333;
  font-weight: bold;
}

.cart-item-spec {
  font-size: 24rpx;
  color: #888;
  margin-top: 6rpx;
}

.cart-item-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12rpx;
}

.cart-item-price {
  font-size: 28rpx;
  color: #ff4b4b;
  font-weight: bold;
}

.cart-item-qty {
  display: flex;
  align-items: center;
  margin-right: 12rpx;
}

.qty-btn-small {
  width: 44rpx;
  height: 44rpx;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  font-size: 28rpx;
  color: #333;
}

.qty-num {
  width: 50rpx;
  text-align: center;
  font-size: 28rpx;
  color: #333;
}

.cart-footer {
  display: flex;
  align-items: center;
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #eee;
  background: #fff;
}

.cart-total {
  flex: 1;
}

.cart-total-label {
  font-size: 26rpx;
  color: #666;
}

.cart-total-price {
  font-size: 36rpx;
  color: #ff4b4b;
  font-weight: bold;
  margin-left: 10rpx;
}

.cart-checkout-btn {
  background: linear-gradient(135deg, #ff4b4b, #ff6b6b);
  color: #fff;
  padding: 20rpx 40rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: bold;
}

.fly-ball.flying {
  transform: scale(1);
}

.fly-ball-text {
  font-size: 24rpx;
  color: #fff;
  font-weight: bold;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4rpx) scale(1.1); }
  75% { transform: translateX(4rpx) scale(1.1); }
}

.shake {
  animation: shake 0.3s ease-in-out;
}
</style>