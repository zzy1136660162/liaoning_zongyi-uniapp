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
            到店核销，无需物流
          </view>
          <view class="therapy-tip-desc">
            支付成功后将在订单列表生成核销二维码，到店出示即可使用。
          </view>
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
                {{ selectedAddress.name }}
              </text>
              <text class="phone">
                {{ selectedAddress.phone }}
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
      
        <!-- 费用明细 -->
        <view class="section">
          <view class="section-title">
            费用明细
          </view>
          <view class="cost-row">
            <text class="label">
              药品费用
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
import { onLoad, onShow } from '@dcloudio/uni-app'
import {
  STORAGE_KEY_CURRENT_ORDER,
  STORAGE_KEY_SHIPPING_ADDRESSES,
  STORAGE_KEY_DEFAULT_ADDRESS_ID,
  STORAGE_KEY_CURRENT_CONSULTATION_ID
} from '@/utils/storage.js'
import { buildOrderInfo, getCurrentCheckoutProductIds, loadCartItems, setCheckoutProductIds } from '@/utils/cart.js'
import { createOrder } from '@/api/order.js'
import { getAddressList } from '@/api/address.js'
import { wechatSinglePay } from '@/api/payment.js'
import { getProductDetail } from '@/api/product.js'
import { ensureWeChatIdentity } from '@/api/auth.js'
import { queryFreight } from '@/api/express.js'
import { getCachedProducts, setCachedProducts, isCacheValid } from '@/utils/cache.js'
import { logPageView, logButtonClick } from '@/api/access-log.js'
import { resolveProductFlow } from '@/utils/product-biz.js'
import { ORDER_TYPE_THERAPY } from '@/utils/therapy.js'

const isTherapyOrder = ref(false)
const therapyRouteRequested = ref(false)

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
const selectedBizType = ref(1)
const selectedRequiresConsultation = ref(true)

const requiresShipping = computed(() => !isTherapyOrder.value)

const canSubmit = computed(() => {
  if (!requiresShipping.value) {
    return orderInfo.value.items && orderInfo.value.items.length > 0
  }
  return !!selectedAddress.value
})

onLoad((options) => {
  therapyRouteRequested.value = options?.therapy === '1' || options?.therapy === 1 || options?.therapy === true
  isTherapyOrder.value = therapyRouteRequested.value
  if (options?.selectedItems) {
    selectedProductIds.value = options.selectedItems.split(',').filter(id => id.trim())
    setCheckoutProductIds(selectedProductIds.value)
  } else {
    selectedProductIds.value = getCurrentCheckoutProductIds()
  }
})

const resolveTherapyOrderFlag = (flow = {}) => {
  return therapyRouteRequested.value || !!flow.allTraditionalTherapy
}

onMounted(async () => {
  // 记录页面访问日志
  logPageView('下单页面', '用户进入下单页面')

  await loadProducts()
  loadOrderInfo()
  if (requiresShipping.value) {
    loadAddresses()
  } else {
    orderInfo.value.cost.shippingFee = 0
    calculateTotal()
  }
})

onShow(async () => {
  // 先加载本地订单信息，避免后续覆盖已计算的运费
  loadOrderInfo()

  // 页面显示时检查是否有新选中的地址（从地址选择页面返回）
  const tempAddress = uni.getStorageSync('temp_selected_address')
  if (tempAddress) {
    selectedAddress.value = tempAddress
    uni.removeStorageSync('temp_selected_address')
    // 地址变化后重新计算快递费
    if (requiresShipping.value) {
      await calculateShippingFee()
    } else {
      orderInfo.value.cost.shippingFee = 0
      calculateTotal()
    }
  } else {
    // 重新加载地址列表（可能地址被编辑或删除）
    if (requiresShipping.value) {
      loadAddresses()
    }
    // 如果有选中的地址，重新计算快递费
    if (requiresShipping.value && selectedAddress.value) {
      await calculateShippingFee()
    } else if (!requiresShipping.value) {
      selectedAddress.value = null
      orderInfo.value.cost.shippingFee = 0
      calculateTotal()
    }
  }
  
  // 重新加载产品数据并更新订单金额（购物车数据可能已更新）
  await loadProducts()
  loadOrderInfo()
})

// 加载产品数据（只加载购物车中选中的商品）
const loadProducts = async () => {
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
    
    // 先检查缓存
    if (isCacheValid(currentSelectedIds)) {
      const cached = getCachedProducts(currentSelectedIds)
      // 汇总缓存中的所有商品（按 id 建立索引，便于按当前选中项精确取用）
      const cachedProductMap = new Map()
      const cachedCategories = cached?.categories || []
      cachedCategories.forEach(cat => {
        (cat?.products || []).forEach(p => {
          if (p && p.id !== undefined && p.id !== null) {
            cachedProductMap.set(String(p.id), p)
          }
        })
      })

      // 仅当缓存覆盖了当前选中的所有商品时才复用缓存
      const hasAllProducts = currentSelectedIds.every(id => cachedProductMap.has(String(id)))
      const selectedProducts = hasAllProducts
        ? currentSelectedIds.map(id => cachedProductMap.get(String(id)))
        : []
      const hasFlowFields = selectedProducts.every(product =>
        product &&
        (
          product.productCategory !== undefined ||
          product.categoryCode ||
          product.category_code ||
          product.categoryId !== undefined ||
          product.category_id !== undefined ||
          Number(product.bizType) === 2
        )
      )
      if (hasAllProducts && hasFlowFields) {
        console.log('使用缓存的商品数据')
        // 只取当前选中的商品，避免历史缓存中多余的商品混入本次订单
        const cachedCategory = {
          id: 'selected_items',
          name: '订单商品',
          products: selectedProducts
        }
        categories.value = [cachedCategory]
        const flow = resolveProductFlow(selectedProducts)
        if (flow.valid) {
          selectedBizType.value = flow.bizType
          selectedRequiresConsultation.value = flow.requiresConsultation
          isTherapyOrder.value = resolveTherapyOrderFlag(flow)
        } else {
          uni.showToast({ title: flow.message, icon: 'none' })
          setTimeout(() => uni.navigateBack(), 1500)
          return []
        }
        return [cachedCategory]
      }
    }

    console.log('从服务器加载选中的商品数据')
    uni.showLoading({ title: '加载商品...' })
    
    // 为选中的商品创建虚拟分类结构
    const cartCategory = {
      id: 'selected_items',
      name: '订单商品',
      products: []
    }
    
    // 逐个获取选中商品的详细信息
    for (const productId of currentSelectedIds) {
      try {
        const productDetail = await getProductDetail(productId)
        if (productDetail) {
          cartCategory.products.push({
            id: productDetail.id,
            name: productDetail.productName || productDetail.name,
            description: productDetail.subTitle || productDetail.description,
            image: productDetail.coverImage || productDetail.image,
            price: productDetail.price,
            bizType: productDetail.bizType,
            productCategory: productDetail.productCategory,
            isPrescription: productDetail.isPrescription,
            categoryId: productDetail.categoryId || productDetail.category_id,
            categoryCode: productDetail.categoryCode || productDetail.category_code || '',
            goodsMerchantType: productDetail.goodsMerchantType,
            unit: productDetail.unit || '份',
            notice: productDetail.usageDesc || productDetail.notice
          })
        }
      } catch (err) {
        console.error(`获取商品${productId}详情失败:`, err)
      }
    }
    
    // 缓存数据
    const productsData = { selected_items: cartCategory.products }
    setCachedProducts([cartCategory], productsData, currentSelectedIds)
    
    categories.value = [cartCategory]
    const flow = resolveProductFlow(cartCategory.products)
    if (!flow.valid) {
      uni.showToast({ title: flow.message, icon: 'none' })
      setTimeout(() => uni.navigateBack(), 1500)
      return []
    }
    selectedBizType.value = flow.bizType
    selectedRequiresConsultation.value = flow.requiresConsultation
    isTherapyOrder.value = resolveTherapyOrderFlag(flow)
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
    const cartItems = categories.value.length > 0 ? loadCartItems(categories.value) : []
    const currentSelectedIds = cartItems.map(item => String(item.id))
    const distributor = !selectedRequiresConsultation.value
      ? '健康产品服务'
      : '辽宁中医药大学附属医院'
    const rebuiltOrder = cartItems.length > 0
      ? buildOrderInfo(cartItems, currentSelectedIds, distributor)
      : null

    orderInfo.value = saved && saved.items ? saved : (rebuiltOrder || orderInfo.value)

    if (!orderInfo.value.cost) {
      orderInfo.value.cost = { medicineCost: 0, isDecocted: false, shippingFee: 0 }
    }

    if (rebuiltOrder) {
      orderInfo.value.bizType = selectedBizType.value
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
    console.error('加载订单信息失败:', e)
    uni.showToast({ title: '加载订单失败', icon: 'none' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  }
}

const loadAddresses = async () => {
  if (!requiresShipping.value) {
    selectedAddress.value = null
    return
  }

  try {
    // 先从后端获取最新地址列表
    try {
      const remoteAddresses = await getAddressList()
      if (remoteAddresses && Array.isArray(remoteAddresses)) {
        addresses.value = remoteAddresses
        // 同步到本地存储
        uni.setStorageSync(STORAGE_KEY_SHIPPING_ADDRESSES, remoteAddresses)
      }
    } catch (apiError) {
      console.warn('从后端获取地址失败，使用本地缓存:', apiError)
      // 如果API调用失败，使用本地缓存
      const saved = uni.getStorageSync(STORAGE_KEY_SHIPPING_ADDRESSES) || []
      addresses.value = saved
    }
    
    // 加载默认地址
    const defaultId = uni.getStorageSync(STORAGE_KEY_DEFAULT_ADDRESS_ID)
    let defaultAddr = null
    
    // 优先使用存储的默认地址ID
    if (defaultId) {
      defaultAddr = addresses.value.find(a => a.id === defaultId)
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
    console.error('加载地址列表失败:', e)
  }
}

// 计算快递费
const calculateShippingFee = async () => {
  if (!requiresShipping.value) {
    console.log('跳过传统疗法运费计算')
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
    
    console.log('查询运费参数:', freightParams)
    
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
        
        console.log('快递费计算成功:', orderInfo.value.cost.shippingFee)
      } else {
        console.warn('运费值无效:', freightResult.freight, '，使用默认值18元')
        orderInfo.value.cost.shippingFee = 18
        calculateTotal()
      }
    } else {
      console.warn('未获取到运费，使用默认值18元，响应数据:', freightResult)
      orderInfo.value.cost.shippingFee = 18
      calculateTotal()
    }

  } catch (error) {
    console.error('计算快递费失败:', error)
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
  // 记录按钮点击日志
  logButtonClick('下单页面', '用户点击下单按钮')

  console.log('2222---------submitOrder' );
  console.log('111111---------submitOrder', orderInfo.value);
  
  if (requiresShipping.value) {
    if ((!orderInfo.value.cost || orderInfo.value.cost.shippingFee === undefined || orderInfo.value.cost.shippingFee === null)
        && selectedAddress.value) {
      await calculateShippingFee()
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
      shippingFee: 0,
      items: orderInfo.value.items.map(item => ({
        productId: item.id,
        quantity: item.quantity || 1,
        price: item.price
      })),
      remark: '',
      totalAmount: orderInfo.value.total
    }
    if (isTherapyOrder.value) {
      orderData.orderType = ORDER_TYPE_THERAPY
    } else {
      orderData.addressId = selectedAddress.value.id
      orderData.consultationId = !selectedRequiresConsultation.value
        ? null
        : (uni.getStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID) || null)
    }
    console.log('orderData', orderData)
    const order = await createOrder(orderData)
    
    console.log('订单创建成功:', order)
    
    uni.hideLoading()
    
    const orderId = order.id || order.orderId
    
    if (!orderId) {
      console.error('订单ID为空，无法继续支付')
      uni.showToast({ title: '订单创建失败，请重试', icon: 'none' })
      return
    }
    
    console.log('订单创建成功，准备调起支付:', {
      orderId,
      orderNo: order.orderNo,
      goodsAmount: orderInfo.value.cost.medicineCost,
      shippingFee: orderInfo.value.cost.shippingFee,
      total: orderInfo.value.total
    })
    
    try {
      console.log('使用openid发起支付:', openid)
      
      const payResult = await wechatSinglePay(orderId, {
        openid,
        totalAmount: orderInfo.value.total
      })
      console.log('单笔支付成功:', payResult)
      const itemCount = (orderInfo.value.items || []).reduce((sum, item) => {
        const quantity = Number(item.quantity || 1)
        return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1)
      }, 0)
      const paymentSuccessParams = {
        orderId,
        amount: orderInfo.value.total,
        outTradeNo: payResult.outTradeNo || '',
        paymentType: 'single',
        orderNo: order.orderNo || '',
        itemCount,
        orderType: isTherapyOrder.value ? ORDER_TYPE_THERAPY : '',
        therapy: isTherapyOrder.value ? '1' : '0'
      }
      const paymentSuccessUrl = '/pages/order/payment_success?' + Object.entries(paymentSuccessParams)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
        .join('&')
      console.log('支付成功跳转参数:', paymentSuccessParams)
      console.log('支付成功跳转URL:', paymentSuccessUrl)
      uni.redirectTo({
        url: paymentSuccessUrl,
        success: (res) => {
          console.log('跳转支付成功页成功:', res, paymentSuccessUrl)
        },
        fail: (err) => {
          console.error('跳转支付成功页失败:', err, paymentSuccessUrl)
        },
        complete: (res) => {
          console.log('跳转支付成功页完成:', res)
        }
      })
    } catch (error) {
      console.error('支付失败:', error)
      
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
