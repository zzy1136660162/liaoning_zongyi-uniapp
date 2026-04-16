# 前端API对接说明文档

## 目录结构

```
liaoning_zongyi-uniapp/
├── api/                    # API接口目录
│   ├── index.js           # API统一出口
│   ├── auth.js            # 认证模块API
│   ├── patient.js         # 就诊人模块API
│   ├── address.js         # 收货地址模块API
│   ├── product.js         # 商品模块API
│   ├── hospital.js        # 医院医生模块API
│   ├── consultation.js    # 咨询处方模块API
│   ├── order.js           # 订单模块API
│   ├── payment.js         # 支付模块API
│   └── announcement.js    # 公告模块API
├── utils/
│   ├── config.js          # API配置
│   ├── request.js         # HTTP请求封装
│   ├── storage.js         # 本地存储KEY管理
│   └── cart.js            # 购物车工具
```

## 快速开始

### 1. 配置API地址

编辑 `utils/config.js` 文件，修改API基础地址：

```javascript
export const API_CONFIG = {
  development: {
    baseURL: 'http://localhost:10086',  // 开发环境
    timeout: 30000
  },
  production: {
    baseURL: 'https://api.yourdomain.com',  // 生产环境
    timeout: 30000
  }
}
```

### 2. 在页面中使用

```javascript
// 方式1: 导入所有API
import * as API from '@/api/index.js'

// 方式2: 按需导入
import { login, sendSmsCode } from '@/api/auth.js'
import { getProductList } from '@/api/product.js'
```

## API使用示例

### 认证模块

#### 发送验证码
```javascript
import { sendSmsCode } from '@/api/auth.js'

// 发送验证码
sendSmsCode('13800138000').then(res => {
  console.log('验证码已发送')
}).catch(err => {
  console.error('发送失败', err)
})
```

#### 登录
```javascript
import { login } from '@/api/auth.js'
import { saveToken } from '@/utils/request.js'
import { STORAGE_KEY_USER_INFO } from '@/utils/storage.js'

// 登录
login({
  phone: '13800138000',
  code: '123456'
}).then(res => {
  // 保存Token
  saveToken(res.data.token)
  
  // 保存用户信息
  uni.setStorageSync(STORAGE_KEY_USER_INFO, res.data)
  
  // 跳转到首页
  uni.switchTab({
    url: '/pages/index/index'
  })
})
```

#### 获取用户信息
```javascript
import { getUserProfile } from '@/api/auth.js'

getUserProfile().then(res => {
  console.log('用户信息:', res.data)
})
```

### 商品模块

#### 获取分类列表
```javascript
import { getCategoryList } from '@/api/product.js'

getCategoryList().then(res => {
  this.categories = res.data
})
```

#### 获取商品列表(分页)
```javascript
import { getProductsByCategory } from '@/api/product.js'

getProductsByCategory(1, 1, 10).then(res => {
  this.products = res.data.records
  this.total = res.data.total
})
```

#### 获取商品详情
```javascript
import { getProductDetail } from '@/api/product.js'

getProductDetail(1).then(res => {
  this.productInfo = res.data
})
```

### 地址模块

#### 获取地址列表
```javascript
import { getAddressList } from '@/api/address.js'

getAddressList().then(res => {
  this.addressList = res.data
})
```

#### 新增地址
```javascript
import { addAddress } from '@/api/address.js'

addAddress({
  receiverName: '张三',
  receiverPhone: '13800138000',
  province: '辽宁省',
  city: '沈阳市',
  district: '和平区',
  addressDetail: '某某街道123号',
  isDefault: 1
}).then(res => {
  uni.showToast({
    title: '添加成功',
    icon: 'success'
  })
})
```

#### 设置默认地址
```javascript
import { setDefaultAddress } from '@/api/address.js'

setDefaultAddress(addressId).then(res => {
  uni.showToast({
    title: '设置成功',
    icon: 'success'
  })
})
```

### 订单模块

#### 创建订单
```javascript
import { createOrder } from '@/api/order.js'

createOrder({
  addressId: 1,
  remark: '请尽快发货',
  items: [
    {
      productId: 1,
      quantity: 2
    }
  ]
}).then(res => {
  const orderId = res.data.id
  // 跳转到支付页面
})
```

#### 获取订单列表
```javascript
import { getOrderList } from '@/api/order.js'

// 获取所有订单
getOrderList().then(res => {
  this.orderList = res.data
})

// 按状态筛选
getOrderList(0).then(res => {  // 0:待支付
  this.orderList = res.data
})
```

### 支付模块

#### 微信支付
```javascript
import { wechatPay } from '@/api/payment.js'

wechatPay(orderId).then(() => {
  // 支付成功
  uni.redirectTo({
    url: '/pages/order/payment_success'
  })
}).catch(err => {
  // 支付失败或取消
  console.error('支付失败', err)
})
```

## 响应数据格式

所有接口响应格式统一为：

```javascript
{
  "code": 200,              // 状态码，200表示成功
  "message": "操作成功",     // 消息
  "data": {},               // 响应数据
  "success": true,          // 是否成功
  "timestamp": 1700000000000 // 时间戳
}
```

## 错误处理

### 自动处理
- HTTP错误：自动显示Toast提示
- 401未登录：自动跳转登录页
- 业务错误：自动显示错误消息

### 手动处理
```javascript
import { getOrderDetail } from '@/api/order.js'

getOrderDetail(1).then(res => {
  // 成功处理
  this.orderInfo = res.data
}).catch(err => {
  // 失败处理
  console.error('获取订单详情失败', err)
})
```

## Token管理

### 保存Token
```javascript
import { saveToken } from '@/utils/request.js'

saveToken('your_token_here')
```

### 清除Token
```javascript
import { clearToken } from '@/utils/request.js'

clearToken()
```

### Token自动携带
请求拦截器会自动在请求头添加Token：
```
Authorization: Bearer {token}
```

## 常见问题

### 1. 如何修改API地址？
修改 `utils/config.js` 中的 `baseURL`

### 2. 如何取消loading提示？
在API调用时传入 `showLoading: false`：
```javascript
getUserProfile({}, { showLoading: false })
```

### 3. 如何访问不需要登录的接口？
在API定义时设置 `needAuth: false`（已在API模块中配置）

### 4. 网络请求超时怎么办？
修改 `utils/config.js` 中的 `timeout` 值（单位：毫秒）

## 开发建议

1. **统一导入**: 建议在页面顶部统一导入需要的API
2. **错误处理**: 始终添加 `.catch()` 处理错误情况
3. **Loading状态**: 对于耗时操作，合理使用loading提示
4. **数据缓存**: 适当使用本地缓存减少网络请求
5. **Token管理**: 登录成功后立即保存Token

## 完整示例

```vue
<template>
  <view class="page">
    <view v-for="product in products" :key="product.id">
      {{ product.name }}
    </view>
  </view>
</template>

<script>
import { getCategoryList, getProductsByCategory } from '@/api/product.js'

export default {
  data() {
    return {
      products: []
    }
  },
  onLoad() {
    this.loadProducts()
  },
  methods: {
    async loadProducts() {
      try {
        // 获取分类列表
        const categoryRes = await getCategoryList()
        const firstCategory = categoryRes.data[0]
        
        // 获取商品列表
        const productRes = await getProductsByCategory(firstCategory.id, 1, 10)
        this.products = productRes.data.records
      } catch (error) {
        console.error('加载失败', error)
      }
    }
  }
}
</script>
```

## API接口清单

### 认证模块 (auth.js)
- `sendSmsCode(phone)` - 发送验证码
- `login(params)` - 登录/注册
- `getUserProfile()` - 获取用户信息
- `logout()` - 退出登录

### 就诊人模块 (patient.js)
- `getPatientList()` - 获取就诊人列表
- `addPatient(data)` - 新增就诊人
- `updatePatient(id, data)` - 编辑就诊人
- `deletePatient(id)` - 删除就诊人

### 地址模块 (address.js)
- `getAddressList()` - 获取地址列表
- `addAddress(data)` - 新增地址
- `updateAddress(id, data)` - 编辑地址
- `deleteAddress(id)` - 删除地址
- `setDefaultAddress(id)` - 设置默认地址

### 商品模块 (product.js)
- `getCategoryList()` - 获取分类列表
- `getProductsByCategory(categoryId, pageNum, pageSize)` - 获取商品列表
- `getProductDetail(id)` - 获取商品详情

### 医院医生模块 (hospital.js)
- `getHospitalList()` - 获取医院列表
- `getDoctorsByHospital(hospitalName)` - 获取医生列表
- `getDoctorDetail(id)` - 获取医生详情

### 咨询处方模块 (consultation.js)
- `createConsultation(data)` - 发起咨询
- `getConsultationList(status)` - 获取咨询列表
- `getConsultationDetail(id)` - 获取咨询详情
- `getPrescriptionByConsultation(id)` - 获取处方
- `getPrescriptionDetail(id)` - 获取处方详情
- `getPrescriptionItems(id)` - 获取处方药品

### 订单模块 (order.js)
- `createOrderFromPrescription(data)` - 处方下单
- `createOrder(data)` - 创建订单
- `getOrderList(orderStatus)` - 获取订单列表
- `getOrderDetail(id)` - 获取订单详情
- `cancelOrder(id, reason)` - 取消订单

### 支付模块 (payment.js)
- `createPrepay(channel, orderId)` - 创建支付
- `wechatPay(orderId)` - 微信支付

### 公告模块 (announcement.js)
- `getAnnouncementList()` - 获取公告列表
- `getAnnouncementDetail(id)` - 获取公告详情

---

**更新时间**: 2024年
**版本**: v1.0.0
