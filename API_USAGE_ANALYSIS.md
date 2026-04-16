# API接口使用情况完整分析

## 📊 总体统计

| 模块 | 总接口数 | 已使用 | 未使用 | 使用率 |
|------|---------|--------|--------|--------|
| **auth (认证)** | 4 | 2 | 2 | 50% |
| **patient (就诊人)** | 4 | 2 | 2 | 50% |
| **address (地址)** | 5 | 5 | 0 | 100% ✅ |
| **product (商品)** | 5 | 2 | 3 | 40% |
| **consultation (咨询)** | 6 | 4 | 2 | 67% |
| **order (订单)** | 7 | 2 | 5 | 29% |
| **payment (支付)** | 2 | 0 | 2 | 0% |
| **hospital (医院)** | 3 | 0 | 3 | 0% |
| **announcement (公告)** | 2 | 0 | 2 | 0% |
| **合计** | **38** | **17** | **21** | **45%** |

---

## ✅ 已使用的接口 (17个)

### 1. auth.js - 认证模块 (2/4)

| 接口 | 使用页面 | 状态 |
|------|---------|------|
| `sendSmsCode()` | register.vue | ✅ |
| `login()` | register.vue | ✅ |

### 2. patient.js - 就诊人模块 (2/4)

| 接口 | 使用页面 | 状态 |
|------|---------|------|
| `getPatientList()` | apply.vue | ✅ |
| `addPatient()` | apply.vue | ✅ |

### 3. address.js - 地址模块 (5/5) ✅ 完成

| 接口 | 使用页面 | 状态 |
|------|---------|------|
| `getAddressList()` | address_list.vue | ✅ |
| `addAddress()` | address_edit.vue | ✅ |
| `updateAddress()` | address_edit.vue | ✅ |
| `deleteAddress()` | address_list.vue | ✅ |
| `setDefaultAddress()` | address_list.vue | ✅ |

### 4. product.js - 商品模块 (2/5)

| 接口 | 使用页面 | 状态 |
|------|---------|------|
| `getCategoryList()` | priducts_list.vue | ✅ |
| `getCategoryProducts()` | priducts_list.vue | ✅ |

### 5. consultation.js - 咨询模块 (4/6)

| 接口 | 使用页面 | 状态 |
|------|---------|------|
| `createConsultation()` | consultation.vue | ✅ |
| `getMyConsultations()` | prescription_list.vue | ✅ |
| `getConsultationDetail()` | consultation_detail.vue | ✅ |
| `getPrescriptionDetail()` | prescription/detail.vue | ✅ |

### 6. order.js - 订单模块 (2/7)

| 接口 | 使用页面 | 状态 |
|------|---------|------|
| `createOrder()` | confirm.vue | ✅ |
| `getOrderDetail()` | order-detail.vue | ✅ |

---

## ❌ 未使用的接口 (21个) - 需要对接

### 1. auth.js - 认证模块 (2个未使用)

| 接口 | 建议使用场景 | 优先级 | 需要页面 |
|------|-------------|--------|---------|
| `getUserProfile()` | 获取用户信息 | 高 | 个人中心页 |
| `logout()` | 退出登录 | 高 | 个人中心页 |

**解决方案**: 创建个人中心页面 `pages/user/profile.vue`

---

### 2. patient.js - 就诊人模块 (2个未使用)

| 接口 | 建议使用场景 | 优先级 | 需要功能 |
|------|-------------|--------|---------|
| `updatePatient()` | 编辑就诊人信息 | 高 | 在apply.vue添加编辑功能 |
| `deletePatient()` | 删除就诊人 | 中 | 在apply.vue添加删除功能 |

**解决方案**: 在 `apply.vue` 添加编辑和删除就诊人功能

---

### 3. product.js - 商品模块 (3个未使用)

| 接口 | 建议使用场景 | 优先级 | 需要功能 |
|------|-------------|--------|---------|
| `searchProducts()` | 商品搜索 | 中 | 在priducts_list.vue添加搜索 |
| `getProductDetail()` | 商品详情 | 低 | priducts_detail.vue对接 |
| `getBannerList()` | 首页轮播图 | 低 | 首页展示 |

**解决方案**: 
1. 在 `priducts_list.vue` 添加搜索功能
2. 在 `priducts_detail.vue` 添加详情加载
3. 创建首页轮播图

---

### 4. consultation.js - 咨询模块 (2个未使用)

| 接口 | 建议使用场景 | 优先级 | 需要功能 |
|------|-------------|--------|---------|
| `submitDiagnosis()` | 提交诊断信息 | 中 | 在consultation.vue添加 |
| `getConsultationMessages()` | 获取咨询消息 | 低 | 聊天功能 |

**解决方案**: 在在线咨询页面添加诊断提交和消息查看

---

### 5. order.js - 订单模块 (5个未使用)

| 接口 | 建议使用场景 | 优先级 | 需要页面 |
|------|-------------|--------|---------|
| `getMyOrders()` | 我的订单列表 | 高 | 订单列表页 |
| `cancelOrder()` | 取消订单 | 高 | 订单详情/列表页 |
| `confirmReceipt()` | 确认收货 | 中 | 订单详情页 |
| `getOrderStatus()` | 查询订单状态 | 中 | 订单详情页 |
| `applyRefund()` | 申请退款 | 低 | 订单详情页 |

**解决方案**: 
1. 创建订单列表页 `pages/order/order_list.vue`
2. 在 `order-detail.vue` 添加取消、确认收货、退款功能

---

### 6. payment.js - 支付模块 (2个未使用)

| 接口 | 建议使用场景 | 优先级 | 需要页面 |
|------|-------------|--------|---------|
| `createPrepay()` | 创建支付 | 高 | 订单确认页 |
| `wechatPay()` | 微信支付 | 高 | 订单确认页 |

**解决方案**: 在 `confirm.vue` 添加支付功能

---

### 7. hospital.js - 医院医生模块 (3个未使用)

| 接口 | 建议使用场景 | 优先级 | 需要页面 |
|------|-------------|--------|---------|
| `getHospitalList()` | 医院列表 | 低 | 医院选择页 |
| `getDoctorsByHospital()` | 医生列表 | 低 | 医生选择页 |
| `getDoctorDetail()` | 医生详情 | 低 | 医生详情页 |

**解决方案**: 创建医院/医生选择页面（如需要）

**说明**: 目前业务流程中医院和医生是固定的（线上名医），可能不需要单独页面

---

### 8. announcement.js - 公告模块 (2个未使用)

| 接口 | 建议使用场景 | 优先级 | 需要页面 |
|------|-------------|--------|---------|
| `getAnnouncementList()` | 公告列表 | 低 | 首页/公告页 |
| `getAnnouncementDetail()` | 公告详情 | 低 | 公告详情页 |

**解决方案**: 
1. 在首页添加公告轮播
2. 在 `notice.vue` 改为动态加载

**说明**: `notice.vue` 目前是静态内容，可改为动态加载

---

## 🎯 接口对接优先级

### 高优先级 (必须完成) - 8个接口

1. ✅ **支付功能** - `createPrepay()`, `wechatPay()`
2. ✅ **用户中心** - `getUserProfile()`, `logout()`
3. ✅ **订单管理** - `getMyOrders()`, `cancelOrder()`
4. ✅ **就诊人管理** - `updatePatient()`, `deletePatient()`

### 中优先级 (建议完成) - 6个接口

5. **订单操作** - `confirmReceipt()`, `getOrderStatus()`
6. **商品搜索** - `searchProducts()`
7. **咨询诊断** - `submitDiagnosis()`

### 低优先级 (可选) - 7个接口

8. **医院医生** - `getHospitalList()`, `getDoctorsByHospital()`, `getDoctorDetail()`
9. **公告展示** - `getAnnouncementList()`, `getAnnouncementDetail()`
10. **商品详情** - `getProductDetail()`, `getBannerList()`

---

## 📋 需要创建的页面/功能

### 必须创建

1. ✅ **个人中心页** - `pages/user/profile.vue`
   - 显示用户信息
   - 退出登录按钮
   - 我的订单入口

2. ✅ **订单列表页** - `pages/order/order_list.vue`
   - 显示所有订单
   - 订单筛选（待支付、待收货等）
   - 订单操作（取消、确认收货）

3. ✅ **支付功能** - 在 `confirm.vue`
   - 调用支付接口
   - 处理支付结果

4. ✅ **就诊人编辑删除** - 在 `apply.vue`
   - 编辑就诊人信息
   - 删除就诊人

### 可选创建

5. **商品搜索** - 在 `priducts_list.vue`
6. **医院医生选择页** - 新页面（如需要）
7. **公告动态加载** - 修改 `notice.vue`
8. **首页优化** - 修改 `index.vue`

---

## 🔧 立即行动计划

### 第一步：高优先级接口对接（8个）

```
1. 创建个人中心页 → getUserProfile, logout
2. 创建订单列表页 → getMyOrders
3. 订单详情页添加取消订单 → cancelOrder  
4. 订单确认页添加支付 → createPrepay, wechatPay
5. 就诊人管理添加编辑删除 → updatePatient, deletePatient
```

### 第二步：中优先级接口对接（6个）

```
6. 订单详情添加确认收货 → confirmReceipt
7. 订单状态查询 → getOrderStatus
8. 商品列表添加搜索 → searchProducts
9. 咨询页添加诊断提交 → submitDiagnosis
```

### 第三步：低优先级接口对接（7个）

```
10. 医院医生相关（可选）
11. 公告动态加载（可选）
12. 首页优化（可选）
```

---

## ✅ 完成标准

**核心接口100%对接完成条件**：
- 所有高优先级接口（8个）全部对接 ✅
- 所有中优先级接口（6个）全部对接 ✅
- 核心业务流程完整可用 ✅

**说明**：低优先级接口可根据实际业务需求决定是否对接。
