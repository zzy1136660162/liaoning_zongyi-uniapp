<template>
    <view class="page">
  
      <!-- 商品大图 -->
      <image 
        class="banner"
        :src="getImageUrl(product.image)"
        mode="widthFix"
      />
  
      <!-- 标题 + 价格 + 数量 -->
      <view class="box">
        <view class="title">{{ product.name }}</view>
  
        <view class="price-row">
          <text class="price">￥{{ formattedPrice }}</text>
  
          <view class="counter">
            <!-- <button class="btn" @click="dec">-</button>
            <text class="num">{{ count }}</text>
            <button class="btn" @click="inc">+</button> -->
          </view>
        </view>
      </view>
  
      <!-- 商品详情富文本内容 -->
      <view class="content" v-if="product.intro">
        <rich-text :nodes="formatRichText(product.intro)" class="rich-text-content"></rich-text>
      </view>

      <!-- 默认宣传文案（当没有富文本内容时显示） -->
      <view class="content" v-else>

        <view class="section">
          <view class="section-title">冬季养生 · 辽派膏滋怎么吃才对？</view>
          <view class="p">
            天气一冷，"冬季养生"就成了大家嘴边的热门话题。
            而"膏方"更是凭借其温和滋补的特性，频频出现在养生清单里。
          </view>
          <view class="p">
            但不少粉丝总问：膏方是不是贴的膏药？
            ——非也！此"膏"非彼"膏"。
          </view>
          <view class="p">
            辽派膏滋，根据您的体质定制的"一人一方"内服调补佳品，
            是辽宁人自己的冬季养生好选择。
          </view>
        </view>


        <!-- 一、辽派膏滋介绍 -->
        <view class="section">
          <view class="section-subtitle">一、辽派膏滋，为您"量身定制"的冬季补剂</view>

          <view class="p">
            辽派膏滋从选材到制作，都透着"精细"二字，完全根据个人体质"量体裁衣"：
          </view>

          <view class="ul">
            <view class="li">• 选料严：只选用道地药材，保证品质。</view>
            <view class="li">• 工艺精：传统慢火熬制，多道工序浓缩精华。</view>
            <view class="li">• 优势多：吸收好、药效温和、便携易坚持。</view>
          </view>
        </view>


        <!-- 二、服用方法 -->
        <view class="section">
          <view class="section-subtitle">二、服用膏方，记住这几招"锦囊妙计"</view>

          <view class="ol">
            <view class="li"><text class="b">1. 最佳时节：</text>冬季主"封藏"，此时调补吸收更佳。</view>
            <view class="li"><text class="b">2. 服用方法：</text>早晚各一次，每次10-15克，温水冲服。</view>
            <view class="li"><text class="b">3. 注意事项：</text>感冒发烧、拉肚子时暂停；忌茶水牛奶送服。</view>
          </view>
        </view>


        <!-- 三、活动信息 -->
        <view class="section">
          <view class="section-subtitle">三、想了解膏方？这场活动别错过！</view>

          <view class="p">
            11月7日 "五脏同调滋元气 · 膏方养正润安康" 主题膏方活动亮点抢先看：
          </view>

          <view class="ul">
            <view class="li">• 专家义诊：现场辨证，定制专属养生方案。</view>
            <view class="li">• 免费体验：艾灸/推拿/拔罐/穴位贴敷。</view>
            <view class="li">• 特色福利：试喝代茶饮、文创区、抽奖活动。</view>
          </view>

          <view class="p">
            <text class="b">活动时间：</text>11月7日 9:00-11:00
            <br />
            <text class="b">活动地点：</text>主院区门诊1号楼1楼大厅、门诊2号楼1楼大厅
          </view>
        </view>

        <view class="p center bold">快约上家人朋友，一起来赴这场健康之约吧！</view>
      </view>
  
      <!-- 悬浮客服按钮 -->
      <view class="customer-service-btn" @click="handleCustomerService">
        <text class="icon">💬</text>
        <text class="text">客服</text>
      </view>
  
    </view>
  </template>
  
<script setup>
import { ref, computed, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { STORAGE_KEY_PRODUCT_QUANTITIES } from '@/utils/storage.js'
import { getProductDetail } from '@/api/product.js'
import { getImageUrl } from '@/utils/config.js'
import { logPageView } from '@/api/access-log.js'

const product = ref({
  id: '',
  name: '辽派膏滋',
  price: 4.51,
  image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png'),
  description: '',
  intro: '',
  unit: ''
})

const count = ref(1)
const isInitializing = ref(false) // 标记是否正在初始化
const productId = ref(null) // 商品ID

// 从存储中加载数量
const loadQuantityFromStorage = () => {
  if (!product.value.id) return
  
  try {
    isInitializing.value = true
    const productQuantities = uni.getStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES) || {}
    const savedQuantity = productQuantities[product.value.id]
    if (savedQuantity && savedQuantity > 0) {
      count.value = savedQuantity
    } else {
      // 如果没有保存的数量，默认设为1
      count.value = 1
    }
  } catch (e) {
    console.error('加载商品数量失败:', e)
  } finally {
    isInitializing.value = false
  }
}

// 保存数量到存储
const saveQuantityToStorage = () => {
  if (!product.value.id || isInitializing.value) return
  
  try {
    const productQuantities = uni.getStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES) || {}
    productQuantities[product.value.id] = count.value
    uni.setStorageSync(STORAGE_KEY_PRODUCT_QUANTITIES, productQuantities)
  } catch (e) {
    console.error('保存商品数量失败:', e)
  }
}

// 监听数量变化，同步到存储
watch(count, () => {
  saveQuantityToStorage()
})

const inc = () => {
  count.value++
}

const dec = () => {
  if (count.value > 1) {
    count.value--
  }
}
  
  const formattedPrice = computed(() => {
    const price = parseFloat(product.value.price) || 0
    return price.toFixed(2)
  })
  
  const total = computed(() => {
    const price = parseFloat(product.value.price) || 0
    return (price * count.value).toFixed(2)
  })

// ✅ 从API加载商品详情
const loadProductDetail = async (id) => {
  try {
    uni.showLoading({ title: '加载中...' })
    
    const productData = await getProductDetail(id)
    
    console.log('商品详情:', productData)
    
    product.value = {
      id: productData.id,
      name: productData.productName || productData.name,
      price: productData.price || 0,
      image: getImageUrl(productData.coverImage || productData.image || productData.productImage || '/profile/liaoning_zongyi/zhongyi_gaoyao1.png'),
      description: productData.description || '',
      intro: productData.intro || '',
      unit: productData.unit || ''
    }

    // 加载数量
    loadQuantityFromStorage()
    
    uni.hideLoading()
  } catch (error) {
    console.error('加载商品详情失败:', error)
    uni.hideLoading()
    uni.showToast({
      title: error.message || '加载失败',
      icon: 'none'
    })
  }
}

// 格式化富文本内容
const formatRichText = (htmlContent) => {
  if (!htmlContent) return ''

  // 确保返回字符串格式的HTML
  if (typeof htmlContent === 'string') {
    // 清理可能的转义字符
    let cleanHtml = htmlContent
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")

    return cleanHtml
  }

  // 如果是其他格式，尝试转换
  return String(htmlContent)
}

// 接收页面参数
onLoad((options) => {
  // 记录页面访问日志
  if (options.id) {
    logPageView('产品详情', '用户进入产品详情页面', options.id)
  } else if (options.product) {
    logPageView('产品详情', '用户进入产品详情页面')
  } else {
    logPageView('产品详情', '用户进入产品详情页面')
  }

  // 每次进入页面时清除现有数据，确保显示最新内容
  product.value = {
    id: '',
    name: '辽派膏滋',
    price: 4.51,
    image: getImageUrl('/profile/liaoning_zongyi/zhongyi_gaoyao1.png'),
    description: '',
    intro: '',
    unit: ''
  }

  // 优先使用商品ID从API加载
  if (options.id) {
    productId.value = options.id
    loadProductDetail(options.id)
  }
  // 兼容旧的传参方式：如果传递了product参数，也尝试从其中获取ID并调用API
  else if (options.product) {
    try {
      const productData = JSON.parse(decodeURIComponent(options.product))
      // 如果传递的数据中有ID，优先使用API获取完整数据
      if (productData.id) {
        productId.value = productData.id
        loadProductDetail(productData.id)
      } else {
        // 如果没有ID，则使用传递的数据作为后备
        product.value = {
          id: productData.id || '',
          name: productData.name || '辽派膏滋',
          price: productData.price || 4.51,
          image: getImageUrl(productData.coverImage || productData.image || productData.productImage || '/profile/liaoning_zongyi/zhongyi_gaoyao1.png'),
          description: productData.description || '',
          intro: productData.intro || '',
          unit: productData.unit || ''
        }
        // 加载数量
        loadQuantityFromStorage()
      }
    } catch (e) {
      console.error('解析产品数据失败:', e)
    }
  }
})

// 页面显示时重新加载数量（从列表页返回时）
onShow(() => {
  loadQuantityFromStorage()
})

// 客服按钮点击事件
const handleCustomerService = () => {
  uni.showActionSheet({
    itemList: ['在线咨询', '电话咨询'],
    success: (res) => {
      if (res.tapIndex === 0) {
        // 在线咨询 - 可以跳转到聊天页面或显示提示
        uni.showToast({
          title: '在线客服功能建设中',
          icon: 'none'
        })
      } else if (res.tapIndex === 1) {
        // 电话咨询 - 拨打客服电话
        uni.makePhoneCall({
          phoneNumber: '024-82961387', // 请替换为实际客服电话
          fail: (err) => {
            console.error('拨打电话失败:', err)
            uni.showToast({
              title: '拨打电话失败',
              icon: 'none'
            })
          }
        })
      }
    }
  })
}
  
  const submit = () => {
    uni.showToast({
      title: '订单已提交',
      icon: 'success'
    })
  }
  </script>
  
  <style lang="scss" scoped>
  .page {
    padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
  }
  
  .banner {
    width: 100%;
  }
  
  .box {
    padding: 30rpx;
    background: #fff;
    margin-top: 20rpx;
  }
  
  .title {
    font-size: 34rpx;
    font-weight: bold;
  }
  
  .price-row {
    margin-top: 20rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .price {
    color: #e64340;
    font-size: 32rpx;
    font-weight: bold;
  }
  
  .counter {
    display: flex;
    align-items: center;
  }
  
  .btn {
    width: 60rpx;
    height: 60rpx;
    background: #f5f5f5;
    text-align: center;
    line-height: 60rpx;
    font-size: 32rpx;
  }
  
  .num {
    margin: 0 20rpx;
    font-size: 32rpx;
  }
  
  .content {
    padding: 30rpx;
    background: #fff;
    margin-top: 20rpx;
  }
  
  .section-title {
    font-size: 32rpx;
    font-weight: bold;
    margin-bottom: 20rpx;
  }
  
  .section-subtitle {
    font-size: 30rpx;
    font-weight: bold;
    margin: 30rpx 0 10rpx;
  }
  
  .p {
    font-size: 28rpx;
    line-height: 1.6;
    margin-bottom: 20rpx;
    color: #555;
  }
  
  .ul .li,
  .ol .li {
    font-size: 28rpx;
    margin-bottom: 16rpx;
  }
  
  .b {
    font-weight: bold;
  }
  
  .center {
    text-align: center;
  }
  
  .bold {
    font-weight: bold;
    margin-top: 30rpx;
  }
  
  
  .footer {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100rpx;
    background: #fff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 30rpx;
    padding-bottom: calc(0rpx + env(safe-area-inset-bottom));
    box-shadow: 0 -4rpx 10rpx rgba(0,0,0,0.1);
    z-index: 100;
  }
  
  .total {
    color: #e64340;
    font-size: 32rpx;
    font-weight: bold;
  }
  
  .submit-btn {
    background: #2a82e4;
    color: #fff;
    padding: 0 50rpx;
    border-radius: 50rpx;
  }

  /* 悬浮客服按钮 */
  .customer-service-btn {
    position: fixed;
    right: 30rpx;
    bottom: calc(140rpx + env(safe-area-inset-bottom));
    width: 80rpx;
    height: 80rpx;
    background: linear-gradient(135deg, #2a82e4 0%, #1e6bc7 100%);
    border-radius: 50rpx;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    box-shadow: 0 4rpx 20rpx rgba(42, 130, 228, 0.4);
    z-index: 200;
    transition: all 0.3s ease;
  }

  .customer-service-btn:active {
    transform: scale(0.95);
    box-shadow: 0 2rpx 10rpx rgba(42, 130, 228, 0.3);
  }

  .customer-service-btn .icon {
    font-size: 40rpx;
    line-height: 1;
    margin-bottom: 4rpx;
  }

/* 富文本内容样式 */
.rich-text-content {
  font-size: 28rpx;
  line-height: 1.6;
  color: #555;
}

.rich-text-content p {
  margin-bottom: 20rpx;
}

.rich-text-content h1,
.rich-text-content h2,
.rich-text-content h3,
.rich-text-content h4,
.rich-text-content h5,
.rich-text-content h6 {
  font-weight: bold;
  margin: 30rpx 0 10rpx 0;
  color: #333;
}

.rich-text-content h1 {
  font-size: 32rpx;
}

.rich-text-content h2 {
  font-size: 30rpx;
}

.rich-text-content h3,
.rich-text-content h4,
.rich-text-content h5,
.rich-text-content h6 {
  font-size: 28rpx;
}

.rich-text-content ul,
.rich-text-content ol {
  margin: 20rpx 0;
  padding-left: 30rpx;
}

.rich-text-content li {
  margin-bottom: 10rpx;
  line-height: 1.6;
}

.rich-text-content img {
  max-width: 100%;
  height: auto;
  margin: 20rpx 0;
  border-radius: 8rpx;
}

.rich-text-content blockquote {
  border-left: 4rpx solid #2a82e4;
  padding-left: 20rpx;
  margin: 20rpx 0;
  color: #666;
  font-style: italic;
}

  .customer-service-btn .text {
    font-size: 22rpx;
    color: #fff;
    line-height: 1;
  }
  </style>
  