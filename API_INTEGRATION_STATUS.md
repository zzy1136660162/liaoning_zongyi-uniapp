# 前端API对接状态说明

## ❌ 问题发现

虽然API接口文件已创建，但**前端页面没有实际调用这些API**！

### 原因分析

前端页面使用了以下三种数据来源：

1. **硬编码的本地数据** - 直接写在页面代码中
2. **远程静态JSON文件** - 从 `https://yuntuoengine.com/assets_files/...` 获取
3. **uni.request直接调用** - 没有使用封装好的API模块

❌ **没有使用** `api/` 目录下封装好的后端API！

---

## ✅ 已修复

### 修改的文件

**pages/products/priducts_list.vue**

#### 修改前 (❌)
```javascript
loadProducts() {
    // 从远程JSON文件获取
    uni.request({
        url: 'https://yuntuoengine.com/.../products.json',
        method: 'GET',
        success: (res) => {
            this.categories = res.data.categories
        }
    })
}
```

#### 修改后 (✅)
```javascript
import { getCategoryList, getCategoryProducts } from '@/api/product.js'

async loadProducts() {
    // ✅ 调用后端API
    const categories = await getCategoryList()
    
    // 加载每个分类下的商品
    const categoriesWithProducts = await Promise.all(
        categories.map(async (category) => {
            const products = await getCategoryProducts(category.id, 1, 100)
            return {
                id: category.id,
                name: category.categoryName,
                products: products.list || []
            }
        })
    )
    
    this.categories = categoriesWithProducts
}
```

---

## 🔄 还需要修改的页面

### 高优先级

| 页面 | 当前状态 | 需要修改 |
|------|---------|---------|
| **pages/register/register.vue** | ❌ 未调用API | 使用 `sendSmsCode()`, `login()` |
| **pages/order/address_list.vue** | ❌ 未调用API | 使用 `getAddressList()` |
| **pages/order/address_edit.vue** | ❌ 未调用API | 使用 `addAddress()`, `updateAddress()` |
| **pages/order/confirm.vue** | ❌ 未调用API | 使用 `createOrder()` |
| **pages/order/order-detail.vue** | ❌ 未调用API | 使用 `getOrderDetail()` |

### 中优先级

| 页面 | 当前状态 | 需要修改 |
|------|---------|---------|
| pages/dispense/apply.vue | ❌ 未调用API | 使用就诊人API |
| pages/dispense/consultation.vue | ❌ 未调用API | 使用咨询API |
| pages/prescription/detail.vue | ❌ 未调用API | 使用处方API |
| pages/products/priducts_detail.vue | ❌ 未调用API | 使用商品详情API |

---

## 📝 修改模板

### 1. 登录注册页面

```javascript
// pages/register/register.vue
import { sendSmsCode, login } from '@/api/auth.js'

methods: {
    // 获取验证码
    async getVerifyCode() {
        try {
            await sendSmsCode(this.formData.phone)
            uni.showToast({ title: '验证码已发送', icon: 'success' })
            // 开始倒计时
            this.startCountdown()
        } catch (error) {
            uni.showToast({ title: '发送失败', icon: 'none' })
        }
    },
    
    // 登录
    async handleLogin() {
        try {
            const res = await login(this.formData.phone, this.formData.verifyCode)
            // 登录成功，跳转
            uni.switchTab({ url: '/pages/index/index' })
        } catch (error) {
            uni.showToast({ title: '登录失败', icon: 'none' })
        }
    }
}
```

### 2. 地址列表页面

```javascript
// pages/order/address_list.vue
import { getAddressList, deleteAddress, setDefaultAddress } from '@/api/address.js'

methods: {
    async loadAddresses() {
        try {
            this.addresses = await getAddressList()
        } catch (error) {
            uni.showToast({ title: '加载失败', icon: 'none' })
        }
    },
    
    async handleDelete(id) {
        try {
            await deleteAddress(id)
            uni.showToast({ title: '删除成功', icon: 'success' })
            this.loadAddresses() // 重新加载
        } catch (error) {
            uni.showToast({ title: '删除失败', icon: 'none' })
        }
    }
}
```

### 3. 订单确认页面

```javascript
// pages/order/confirm.vue
import { createOrder } from '@/api/order.js'

methods: {
    async handleSubmit() {
        try {
            const orderData = {
                addressId: this.selectedAddress.id,
                items: this.cartItems.map(item => ({
                    productId: item.id,
                    quantity: item.quantity
                })),
                remark: this.remark
            }
            
            const order = await createOrder(orderData)
            
            // 跳转到支付页面
            uni.navigateTo({ 
                url: `/pages/order/payment?orderId=${order.id}` 
            })
        } catch (error) {
            uni.showToast({ title: '提交失败', icon: 'none' })
        }
    }
}
```

---

## 🎯 行动计划

### 立即执行

1. ✅ **已完成**: 修改商品列表页面使用后端API
2. ⏳ **进行中**: 按优先级修改其他页面

### 修改步骤

对于每个页面：

```bash
1. 在<script>中导入API
   import { xxx } from '@/api/xxx.js'

2. 找到数据加载的方法
   - loadData()
   - onLoad()
   - onShow()

3. 替换为API调用
   - 移除 uni.request()
   - 改用封装的API方法
   - 添加 try-catch 错误处理

4. 测试验证
   - 启动后端服务 (端口10086)
   - 启动前端
   - 测试功能是否正常
```

---

## 📊 完成度统计

| 状态 | 数量 | 说明 |
|------|------|------|
| ✅ API已创建 | 10个文件 | `api/` 目录下的接口文件 |
| ✅ 后端已实现 | 13个Controller | Spring Boot后端接口 |
| ✅ 页面已修改 | 1个 | priducts_list.vue |
| ⏳ 待修改页面 | ~15个 | 需要接入API的页面 |

**当前完成度**: API层100% ✅ | 页面层~10% ⏳

---

## 🚀 验证方法

### 1. 启动后端
```bash
cd liaoning_zongyi-springboot
mvn spring-boot:run
# 后端运行在 http://localhost:10086
```

### 2. 启动前端
```bash
cd liaoning_zongyi-uniapp
npm run dev:mp-weixin
# 或在HBuilderX中运行到微信开发者工具
```

### 3. 查看控制台

在浏览器或微信开发者工具控制台查看：
```
✅ 从后端API获取分类: [...]
✅ 从后端API获取商品: [...]
```

如果看到❌或报错，说明API调用失败。

---

## 📚 相关文档

- API接口文档: `api/` 目录下的各个js文件
- 后端接口: `liaoning_zongyi-springboot` 项目
- 配置文件: `utils/config.js`
- 请求封装: `utils/request.js`

---

**更新时间**: 2024年11月21日  
**状态**: 部分完成，需要继续修改其他页面 🚧
