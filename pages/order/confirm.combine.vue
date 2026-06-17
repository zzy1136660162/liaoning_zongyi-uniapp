<template>
  <view class="page">
    <view style="padding: 20rpx;">
    <!-- 页面内容 -->
    <scroll-view class="body" scroll-y>
      <!-- 收货地址 -->
      <view class="section address-section" @click="selectAddress">
        <view v-if="selectedAddress" class="address-content">
          <view class="address-header">
            <text class="name">{{ selectedAddress.name }}</text>
            <text class="phone">{{ selectedAddress.phone }}</text>
          </view>
          <view class="address-detail">
            {{ selectedAddress.province }}{{ selectedAddress.city }}{{ selectedAddress.district }}{{ selectedAddress.addressDetail || (selectedAddress.street || '') + (selectedAddress.detail || '') }}
          </view>
        </view>
        <view v-else class="address-empty">
          <text>请选择收货地址</text>
        </view>
        <view class="address-arrow"><uni-icons type="right" size="24" color="#999"></uni-icons></view>
      </view>
      
      <!-- 配送信息 -->
      <view class="section">
        <view class="section-title">配送信息</view>
        <view class="info-row">
          <text class="label">配送方</text>
          <text class="value">{{ orderInfo.deliveryInfo.distributor }}</text>
        </view>
        <view class="info-row">
          <text class="label">物流公司</text>
          <text class="value">{{ orderInfo.deliveryInfo.logistics }}</text>
        </view>
        <view class="info-row">
          <text class="label">购药方式</text>
          <text class="value">{{ orderInfo.deliveryInfo.purchaseMethod }}</text>
        </view>
        <view class="info-row">
          <text class="label">快递费支付方式</text>
          <text class="value">{{ orderInfo.deliveryInfo.shippingPaymentMethod }}</text>
        </view>
      </view>
      
      <!-- 订单商品 -->
      <view class="section">
        <view class="section-title">订单商品</view>
        <view 
          v-for="item in orderInfo.items" 
          :key="item.id"
          class="order-item"
        >
          <view class="item-info">
            <text class="item-name">{{ item.name }}</text>
            <text class="item-type">{{ item.type }} <text v-if="item.quantity > 1">×{{ item.quantity }}</text></text>
          </view>
          <text class="item-price">¥{{ item.price.toFixed(2) }}</text>
        </view>
      </view>
      
      <!-- 费用明细 -->
      <view class="section">
        <view class="section-title">费用明细</view>
        <view class="cost-row">
          <text class="label">药品费用</text>
          <text class="value">¥{{ orderInfo.cost.medicineCost.toFixed(2) }}</text>
        </view>
        <view class="cost-row">
          <view class="label-with-checkbox">
            <text class="label">代煎</text>
            <view class="checkbox" :class="{ checked: orderInfo.cost.isDecocted }" @click="toggleDecocted"></view>
          </view>
          <text class="value">¥0.00</text>
        </view>
        <view class="cost-row">
          <view class="label-with-note">
            <text class="label">运费（到付）</text>
            <text class="freight-note">运费计算供参考，以实际支付为准</text>
          </view>
          <text class="value freight-ref">约¥{{ orderInfo.cost.shippingFee.toFixed(2) }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
    <!-- 底部操作栏 -->
    <view class="footer">
      <view class="footer-left">
        <text class="total-label">合计:</text>
        <text class="total-price">¥{{ orderInfo.total.toFixed(2) }}</text>
      </view>
      <button class="submit-btn" :class="{ disabled: !selectedAddress }" @click="submitOrder">提交订单</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { 
  STORAGE_KEY_CURRENT_ORDER,
  STORAGE_KEY_SHIPPING_ADDRESSES,
  STORAGE_KEY_DEFAULT_ADDRESS_ID,
  STORAGE_KEY_VERIFIED_PRODUCTS,
  STORAGE_KEY_PRODUCT_QUANTITIES
} from '@/utils/storage.js'
import { loadCartItems, calculateTotalPrice } from '@/utils/cart.js'
import { createOrder } from '@/api/order.js'
import { getAddressList } from '@/api/address.js'
import { wechatSinglePay } from '@/api/payment.js'
import { getProductDetail } from '@/api/product.js'
import { ensureWeChatIdentity } from '@/api/auth.js'

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

onMounted(async () => {
  await loadProducts()
  loadOrderInfo()
  loadAddresses()
})

onShow(async () => {
  // 页面显示时检查是否有新选中的地址（从地址选择页面返回）
  const tempAddress = uni.getStorageSync('temp_selected_address')
  if (tempAddress) {
    selectedAddress.value = tempAddress
    uni.removeStorageSync('temp_selected_address')
  } else {
    // 重新加载地址列表（可能地址被编辑或删除）
    loadAddresses()
  }
  
  // 重新加载产品数据并更新订单金额（购物车数据可能已更新）
  await loadProducts()
  loadOrderInfo()
})

// 加载产品数据（只加载购物车中的商品）
const loadProducts = async () => {
  try {
    // 先从购物车获取需要的产品ID
    const verifiedProducts = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
    const productIds = Object.keys(verifiedProducts).filter(id => verifiedProducts[id])
    
    if (productIds.length === 0) {
      // 如果购物车为空，清空分类数据
      categories.value = []
      return []
    }
    
    uni.showLoading({ title: '加载商品...' })
    
    // 为购物车中的商品创建虚拟分类结构
    const cartCategory = {
      id: 'cart_items',
      name: '订单商品',
      products: []
    }
    
    // 逐个获取购物车商品的详细信息（只加载需要的商品）
    for (const productId of productIds) {
      try {
        const productDetail = await getProductDetail(productId)
        if (productDetail) {
          cartCategory.products.push({
            id: productDetail.id,
            name: productDetail.productName || productDetail.name,
            description: productDetail.subTitle || productDetail.description,
            image: productDetail.coverImage || productDetail.image,
            price: productDetail.price,
            unit: productDetail.unit || '份',
            notice: productDetail.usageDesc || productDetail.notice
          })
        }
      } catch (err) {
        console.error(`获取商品${productId}详情失败:`, err)
      }
    }
    
    categories.value = [cartCategory]
    return [cartCategory]
  } catch (error) {
    console.error('加载商品失败:', error)
    categories.value = []
    return []
  } finally {
    uni.hideLoading()
  }
}

const loadOrderInfo = () => {
  try {
    const saved = uni.getStorageSync(STORAGE_KEY_CURRENT_ORDER)
    if (saved) {
      orderInfo.value = saved
      
      // 从购物车数据重新计算药品费用
      if (categories.value.length > 0) {
        const cartItems = loadCartItems(categories.value)
        const medicineCost = calculateTotalPrice(cartItems)
        orderInfo.value.cost.medicineCost = parseFloat(medicineCost.toFixed(2))
        
        // 更新订单商品列表（基于购物车数据）
        orderInfo.value.items = cartItems.map(item => ({
          id: item.id,
          name: item.name,
          type: '制剂',
          price: parseFloat(((item.price || 0) * (item.quantity || 1)).toFixed(2)),
          quantity: item.quantity || 1
        }))
      }
      
      // 固定快递费为 18 元
      orderInfo.value.cost.shippingFee = 18
      // 计算总价
      calculateTotal()
      // 保存更新后的订单信息
      uni.setStorageSync(STORAGE_KEY_CURRENT_ORDER, orderInfo.value)
    }
  } catch (e) {
    console.error('加载订单信息失败:', e)
    uni.showToast({ title: '加载订单失败', icon: 'none' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  }
}

const loadAddresses = () => {
  try {
    const saved = uni.getStorageSync(STORAGE_KEY_SHIPPING_ADDRESSES) || []
    addresses.value = saved
    
    // 加载默认地址
    const defaultId = uni.getStorageSync(STORAGE_KEY_DEFAULT_ADDRESS_ID)
    if (defaultId) {
      const defaultAddr = addresses.value.find(a => a.id === defaultId)
      if (defaultAddr) {
        selectedAddress.value = defaultAddr
      }
    } else if (addresses.value.length > 0) {
      // 如果没有默认地址，使用第一个
      selectedAddress.value = addresses.value[0]
    }
  } catch (e) {
    console.error('加载地址列表失败:', e)
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
  if (!selectedAddress.value) {
    uni.showToast({ title: '请选择收货地址', icon: 'none' })
    return
  }
  
  if (!orderInfo.value.items || orderInfo.value.items.length === 0) {
    uni.showToast({ title: '订单商品不能为空', icon: 'none' })
    return
  }
  
  try {
    uni.showLoading({ title: '获取支付信息...' })

    const wechatInfo = await ensureWeChatIdentity()
    const openid = wechatInfo && wechatInfo.openid
    if (!openid) {
      throw new Error('未获取到微信支付信息，请稍后重试')
    }

    uni.showLoading({ title: '提交中...' })
    
    // ✅ 调用后端API创建订单
    const orderData = {
      addressId: selectedAddress.value.id,
      items: orderInfo.value.items.map(item => ({
        productId: item.id,
        quantity: item.quantity || 1,
        price: item.price
      })),
      remark: '', // 备注
      totalAmount: orderInfo.value.total
    }
    
    const order = await createOrder(orderData)
    
    console.log('订单创建成功:', order)
    
    uni.hideLoading()
    
    // ✅ 订单创建成功，调起单笔支付
    const orderId = order.id || order.orderNo
    
    console.log('订单创建成功，准备调起单笔支付:', {
      orderId,
      goodsAmount: orderInfo.value.cost.medicineCost,
      shippingFee: orderInfo.value.cost.shippingFee,
      total: orderInfo.value.total
    })
    
    // 显示支付选择弹窗
    uni.showModal({
      title: '选择支付方式',
      content: '仅在线支付商品费用，运费到付（货到付款给快递员）',
      confirmText: '微信支付',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            console.log('openid', openid)
            console.log('使用openid发起支付:', openid)
            
            // V2 支付模式使用单笔支付，运费为到付，不参与在线支付
            console.log('开始调用单笔支付...')
            const payResult = await wechatSinglePay(orderId, { openid })
            
            console.log('单笔支付成功:', payResult)
            
            // 支付成功，跳转到支付成功页面
            uni.redirectTo({
              url: `/pages/order/payment_success?orderId=${orderId}&amount=${orderInfo.value.total}&outTradeNo=${payResult.outTradeNo || ''}&paymentType=single`
            })
          } catch (error) {
            console.error('单笔支付失败:', error)
            
            // 判断是否是用户取消
            if (error.message === '用户取消支付') {
              // 用户取消，跳转到订单详情
              uni.showModal({
                title: '支付已取消',
                content: '您可以稍后在订单列表中继续支付',
                showCancel: false,
                success: () => {
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
                  uni.redirectTo({
                    url: `/pages/order/order-detail?orderId=${orderId}`
                  })
                }
              })
            }
          }
        } else {
          // 取消支付，跳转到订单详情
          uni.redirectTo({
            url: `/pages/order/order-detail?orderId=${orderId}`
          })
        }
      }
    })
    
  } catch (error) {
    console.error('提交订单失败:', error)
    uni.hideLoading()
    uni.showToast({ 
      title: error.message || '提交失败，请重试', 
      icon: 'none' 
    })
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

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
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
}

.address-header {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 12rpx;
}

.name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.phone {
  font-size: 28rpx;
  color: #666;
}

.address-detail {
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
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

