# 辽宁中医小程序

患者端基于 uni-app 开发，日常运行和打包使用 HBuilderX。业务包括商品浏览、就诊人、问卷与咨询、处方、购物车、订单支付和退款。页面路由以 [pages.json](pages.json) 为准。

本文件说明小程序的开发入口；跨模块约定、数据库迁移和服务器发布规则见 [项目 README](../README.md) 与 [AGENTS.md](../AGENTS.md)。

## 开发与运行

1. 在 HBuilderX 中打开本目录，使用支持当前项目的 Vue 3/uni-app 编译环境。
2. 在本目录使用 pnpm 10.34.9 安装锁定依赖。

   ```bash
   pnpm install --frozen-lockfile
   ```

3. 核对 [utils/config.js](utils/config.js) 中的 `API_CONFIG`、`ENV`、`IMAGE_BASE_URL` 及客服配置。当前 `ENV` 表达式固定选择 `production`，不能假定开发构建会自动切换到本地 API。真机访问本地服务时也不能使用真机自己的 `localhost`。
4. 核对 [manifest.json](manifest.json) 的微信小程序配置，并在微信平台配置实际使用的请求、上传及下载合法域名。
5. 通过 HBuilderX“运行 → 运行到小程序模拟器 → 微信开发者工具”启动，核对控制台实际请求地址与目标环境一致。

使用 [package.json](package.json) 中的 `pnpm run lint` 检查代码。小程序运行和打包均从 HBuilderX 进行。发行时使用 HBuilderX 的微信小程序发行入口，再到微信开发者工具上传，发布前核对目标环境和版本。小程序发布与服务器整体发布分开执行。

## 目录与维护入口

| 目录或文件 | 用途 |
| --- | --- |
| [pages/](pages/) | 页面；购物车、商品、就诊人、咨询、处方、订单及个人中心 |
| [components/](components/) | 公共组件；底部导航见 [TabBar.vue](components/TabBar/TabBar.vue) |
| [api/](api/) | 按业务划分的 HTTP 协议封装，使用方法见 [README_API.md](README_API.md) |
| [utils/request.js](utils/request.js) | 请求、认证恢复协调、错误及响应解包 |
| [utils/account.js](utils/account.js) | 正式账户资料读取和登录会话建立 |
| [utils/auth-session.js](utils/auth-session.js)、[utils/session.js](utils/session.js) | 登录恢复、切号及过期请求隔离 |
| [utils/cart.js](utils/cart.js)、[api/cart.js](api/cart.js) | 服务端购物车读写及页面状态更新 |
| [utils/order-submission.js](utils/order-submission.js) | 下单请求标识、原订单及购物车版本快照 |
| [api/payment.js](api/payment.js) | 统一结算、原订单续付、微信付款及支付状态查询 |
| [static/](static/)、[uni_modules/](uni_modules/) | 静态资源及 uni-app 插件 |
| [App.vue](App.vue)、[main.js](main.js) | 应用生命周期和入口 |

接口清单以各 `api/*.js` 的实际导出为准；[api/index.js](api/index.js) 只聚合其中部分模块，未聚合的接口直接从所属模块导入。

## 数据与业务约定

- 正式账户资料统一调用 `fetchAccountProfile()`，以服务端 `/api/user/profile` 的返回为准。注册表单、本地姓名或微信 OpenID 不能代替当前登录账户，也不能在请求失败时伪造资料或注册成功状态。
- 购物车通过服务端接口维护。页面使用现有购物车工具保留服务端行 ID 与版本；本地选择、提交恢复记录不构成购物车或账户的权威数据。
- 下单使用确认页现有校验与 `prepareOrderCheckout()`，统一完成医院前置确认、商城订单和支付参数准备。商品价格、库存、问卷、归属及订单状态由服务端校验；接口失败应保留用户输入并提供重试。
- 微信身份由一次性授权码经服务端验证。页面不能自报付款 OpenID 或金额。微信 SDK 成功回调表示付款已提交，最终收款与履约状态继续查询服务端。
- 保护重复提交和切号场景。复用现有会话、提交标识及恢复机制；结果未知时恢复原订单，不新建另一笔订单或清空当前购物车。付款后的购物车清理按下单快照的服务端行及版本处理。

完整规则与当前实现入口见 [用户身份与结算校验约定](../docs/功能文档/用户身份与结算校验约定.md)、[小程序登录恢复与按页请求改造说明](../docs/小程序登录恢复与按页请求改造说明.md)、[短信登录注册与微信绑定改造](../docs/短信登录注册与微信绑定改造.md)。

## 变更与验收

新增页面先确认目标用户、场景与成功标准，再补齐加载、空数据、提交中、失败重试及权限状态。复用现有请求和业务工具，避免直接写本地存储拼出业务结果。

按本次改动检查实际入口、返回上下文、重复提交、网络失败及切换账户场景。涉及支付、退款和 HIS 时遵循根目录当前业务约定，保留真实交易事实和原业务标识。只改文档时检查差异、格式及链接即可；没有执行的编译、真机和支付验收应明确注明。

数据库变更由移动 API 后端的 Flyway 统一执行，不能让小程序发布流程手工重放旧 SQL。迁移入口见 [database-flyway.md](../docs/数据库文档/database-flyway.md)。
