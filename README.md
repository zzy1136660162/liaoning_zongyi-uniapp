# 辽宁中医 - uni-app 移动端应用

## 项目简介

辽宁中医是一款基于 uni-app 开发的中医互联网医疗移动应用，提供在线复诊、药品配送、处方管理等服务。应用支持微信小程序、App 等多端运行。

## 功能特性

### 📱 核心功能

- **用户认证**
  - 手机号短信验证码登录/注册
  - Token 认证机制
  - 用户信息管理

- **产品服务**
  - 药方分类浏览
  - 产品详情查看
  - 注意事项说明
  - 健康问卷填写

- **就诊管理**
  - 就诊人信息管理（新增/编辑/删除）
  - 在线复诊咨询
  - 申请配药服务

- **处方系统**
  - 处方详情查看
  - 处方药品清单
  - 处方历史记录
  - 一键下单

- **订单管理**
  - 订单创建与提交
  - 订单列表查看
  - 订单详情追踪
  - 订单支付（支持微信支付）
  - 订单取消与确认收货

- **购物车**
  - 商品加入购物车
  - 购物车管理

- **收货地址**
  - 地址列表管理
  - 新增/编辑/删除地址
  - 设置默认地址

- **个人中心**
  - 用户信息展示
  - 订单管理入口
  - 处方记录入口

## 技术栈

### 前端框架
- **uni-app**: 跨平台应用开发框架
- **Vue 3**: 渐进式 JavaScript 框架
- **Pinia**: Vue 状态管理库

### UI 组件
- **uni-ui**: uni-app 官方组件库
- **uni-scss**: 样式预处理

### 开发工具
- **HBuilderX**: 推荐使用 3.1.0 及以上版本

## 项目结构

```
liaoning_zongyi-uniapp/
├── api/                    # API 接口模块
│   ├── address.js         # 收货地址接口
│   ├── announcement.js    # 公告接口
│   ├── auth.js            # 认证接口
│   ├── consultation.js    # 复诊咨询接口
│   ├── hospital.js        # 医院医生接口
│   ├── index.js           # 接口统一导出
│   ├── order.js           # 订单接口
│   ├── patient.js         # 就诊人接口
│   ├── payment.js         # 支付接口
│   └── product.js         # 产品接口
├── pages/                 # 页面文件
│   ├── cart/             # 购物车
│   ├── dispense/         # 配药相关（申请配药、就诊人管理、在线复诊）
│   ├── index/            # 首页
│   ├── notice/           # 告知书
│   ├── order/            # 订单相关（订单列表、订单详情、确认订单、地址管理等）
│   ├── prescription/     # 处方详情
│   ├── products/         # 产品相关（产品列表、详情、注意事项、问卷）
│   ├── register/         # 注册登录
│   ├── splash/           # 启动页
│   └── user/             # 个人中心
├── static/                # 静态资源
├── utils/                 # 工具函数
│   ├── cart.js           # 购物车工具
│   ├── config.js         # 配置文件
│   ├── patient.js        # 就诊人工具
│   ├── request.js        # HTTP 请求封装
│   └── storage.js        # 本地存储工具
├── uni_modules/           # uni-app 插件模块
├── App.vue               # 应用配置
├── main.js               # 应用入口
├── pages.json            # 页面路由配置
├── manifest.json         # 应用配置清单
└── package.json          # 项目依赖

```

## 快速开始

### 环境要求

- Node.js 12+
- HBuilderX 3.1.0+
- 微信开发者工具（开发微信小程序时需要）

### 安装依赖

```bash
npm install
```

### 配置说明

#### 1. API 配置

修改 `utils/config.js` 文件，配置 API 地址：

```javascript
export const API_CONFIG = {
  development: {
    baseURL: 'http://localhost:10086',  // 开发环境地址
    timeout: 30000
  },
  production: {
    baseURL: 'https://api.yourdomain.com',  // 生产环境地址
    timeout: 30000
  }
}
```

#### 2. 微信小程序配置

修改 `manifest.json` 文件中的微信小程序 AppID：

```json
"mp-weixin": {
  "appid": "wx0a45a9789c9c8314",  // 替换为你的 AppID
  "setting": {
    "urlCheck": false
  }
}
```

### 运行项目

#### 微信小程序
1. 在 HBuilderX 中打开项目
2. 点击运行 -> 运行到小程序模拟器 -> 微信开发者工具
3. 在微信开发者工具中预览

#### App
1. 在 HBuilderX 中打开项目
2. 连接手机或启动模拟器
3. 点击运行 -> 运行到手机或模拟器

#### H5
1. 在 HBuilderX 中打开项目
2. 点击运行 -> 运行到浏览器

### 打包发布

#### 微信小程序
1. 点击发行 -> 小程序-微信
2. 填写小程序名称和 AppID
3. 点击发行
4. 在微信开发者工具中上传

#### App
1. 点击发行 -> 原生 App-云打包
2. 选择打包类型（Android/iOS）
3. 配置证书和签名
4. 提交打包

## API 模块说明

### 认证模块 (auth.js)
- 发送短信验证码
- 登录/注册
- 退出登录
- 获取用户信息

### 就诊人模块 (patient.js)
- 获取就诊人列表
- 新增就诊人
- 编辑就诊人
- 删除就诊人

### 收货地址模块 (address.js)
- 获取地址列表
- 新增地址
- 编辑地址
- 删除地址
- 设置默认地址

### 产品模块 (product.js)
- 获取分类列表
- 获取分类下商品列表
- 获取商品详情

### 医院医生模块 (hospital.js)
- 获取医院列表
- 获取医院下医生列表
- 获取医生详情

### 咨询处方模块 (consultation.js)
- 发起复诊咨询
- 获取咨询列表
- 获取咨询详情
- 获取咨询对应处方
- 获取处方详情

### 订单模块 (order.js)
- 处方一键下单
- 创建普通订单
- 获取订单列表
- 获取订单详情
- 取消订单
- 确认收货

### 支付模块 (payment.js)
- 创建支付预订单
- 支付回调处理

### 公告模块 (announcement.js)
- 获取公告列表
- 获取公告详情

## 工具函数说明

### request.js - HTTP 请求封装
- 统一的请求/响应拦截
- 自动 Token 认证
- 错误统一处理
- 加载提示

### config.js - 配置管理
- API 地址配置
- 环境变量管理
- API 路径常量

### storage.js - 本地存储
- 数据持久化
- 缓存管理

### cart.js - 购物车
- 购物车数据管理
- 商品数量计算

### patient.js - 就诊人
- 就诊人数据管理
- 信息验证

## 页面路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/pages/splash/splash` | 启动页 | 应用启动页 |
| `/pages/notice/notice` | 告知书 | 使用告知书 |
| `/pages/index/index` | 首页 | 应用首页 |
| `/pages/register/register` | 注册/登录 | 用户认证 |
| `/pages/products/priducts_list` | 选择药方 | 产品列表 |
| `/pages/products/priducts_detail` | 产品详情 | 产品详细信息 |
| `/pages/products/product_notice` | 注意事项 | 产品注意事项 |
| `/pages/products/product_questionnaire` | 健康问卷 | 健康问卷调查 |
| `/pages/dispense/apply` | 申请配药 | 配药申请 |
| `/pages/dispense/patient_edit` | 新增就诊人 | 就诊人管理 |
| `/pages/dispense/consultation` | 在线复诊 | 在线复诊咨询 |
| `/pages/prescription/detail` | 处方详情 | 处方信息 |
| `/pages/order/order_list` | 我的订单 | 订单列表 |
| `/pages/order/order-detail` | 订单详情 | 订单详细信息 |
| `/pages/order/prescription_list` | 药品处方 | 处方列表 |
| `/pages/order/prescription_detail` | 处方详情 | 处方详细信息 |
| `/pages/order/consultation_detail` | 在线复诊单 | 复诊详情 |
| `/pages/order/confirm` | 确认订单 | 订单确认 |
| `/pages/order/address_list` | 收货地址 | 地址管理 |
| `/pages/order/address_edit` | 地址设置 | 地址编辑 |
| `/pages/order/payment_success` | 支付成功 | 支付结果 |
| `/pages/cart/cart` | 购物车 | 购物车管理 |
| `/pages/user/profile` | 我的 | 个人中心 |

## 开发规范

### 代码规范
- 使用 ES6+ 语法
- 组件命名采用 PascalCase
- 文件命名采用 kebab-case
- 变量命名采用 camelCase

### 提交规范
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建/工具链相关

## 常见问题

### 1. 登录后跳转到其他页面时提示未登录
检查 Token 是否正确保存，确认请求头是否携带 Token。

### 2. 请求超时
检查 API 地址配置是否正确，网络是否正常。

### 3. 微信小程序无法请求接口
- 确认服务器域名已在微信公众平台配置
- 开发时可以在微信开发者工具中勾选"不校验合法域名"

### 4. 打包后图片无法显示
使用绝对路径或网络图片，避免使用相对路径。

## 更新日志

### v1.0.0 (2024-11-30)
- ✨ 初始版本发布
- ✅ 完成用户认证功能
- ✅ 完成产品浏览功能
- ✅ 完成订单管理功能
- ✅ 完成支付功能
- ✅ 完成处方管理功能

## 许可证

本项目仅供学习交流使用。

## 联系方式

如有问题，请联系项目负责人。
