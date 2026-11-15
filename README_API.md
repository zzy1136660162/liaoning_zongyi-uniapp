# 小程序 API 使用说明

本文件面向维护页面和接口封装的开发者，说明当前调用约定。业务字段和接口导出以对应源码为准，不维护另一份容易过期的完整接口清单。运行方式见 [README.md](README.md)，跨端业务约定见 [项目 README](../README.md)。

## 配置与请求

API 地址、图片地址、超时及客服配置集中在 [utils/config.js](utils/config.js)。当前 `ENV` 固定选择 `production`；修改配置后重新编译小程序，并核对实际请求地址，不能靠构建模式推断当前环境。

[utils/request.js](utils/request.js) 统一拼接 `BASE_URL`、携带当前会话 Token、记录请求诊断并协调登录恢复。页面优先调用业务模块，新增接口在所属 `api/*.js` 中复用请求工具。

| 请求选项 | 当前行为 |
| --- | --- |
| `needAuth` | 默认 `true`，受保护请求使用当前会话；公开接口由封装显式设为 `false` |
| `showLoading` | 默认 `true`，控制全局加载提示；以各业务封装暴露的参数为准 |
| `authRedirect` | 默认 `true`，控制认证失败后的登录引导 |
| `silent` | 抑制封装中的部分提示，不改变请求失败结果 |
| `returnResponse` | 默认 `false`；需要顶层分页元数据时由接口封装显式开启 |
| `timeout` | 默认使用统一配置，特殊业务由现有封装单独设置 |

HTTP 状态为 200 且业务 `code` 为 200 时，普通调用直接获得 `response.data`，不再读取一层 `res.data`。开启 `returnResponse` 才保留完整响应。业务错误、网络错误和会话变化都会拒绝 Promise，页面应清理提交状态、保留输入并展示适当的重试入口；并非所有业务错误都有统一弹窗。

## 账户与身份

[api/auth.js](api/auth.js) 提供短信验证码、登录、注册和微信绑定协议。`login()` 是手机号验证码登录，注册使用独立的 `register()`；完整交互复用 [登录页](pages/register/register.vue) 和现有注册页，避免在业务页面复制一套登录流程。

登录成功通过 `establishAccountSession()` 建立会话。页面读取正式资料统一使用 [utils/account.js](utils/account.js) 的 `fetchAccountProfile()`，不直接缓存或兜底拼装账户资料：

```js
import { fetchAccountProfile } from '@/utils/account.js'

const profile = await fetchAccountProfile()
// profile 已是正式资料对象，沿用服务端 id、userName、idCardNo 等字段。
```

`getUserProfile({ authRedirect })` 是 HTTP 协议层，由账户工具调用，不接受第二个通用配置参数。退出登录复用 [api/logout.js](api/logout.js) 的 `logout()`；不要在页面只删除一个 Token 存储项而绕过会话清理。

[utils/auth-session.js](utils/auth-session.js) 与 [utils/session.js](utils/session.js) 负责恢复、退出和切号。请求认证失效后，GET 最多在本轮恢复后重读一次；已发出的写请求不自动重放，页面收到 `AUTH_RETRY_REQUIRED` 后让用户再次确认。切号后迟到的旧响应不得覆盖当前页面数据。

支付只提交本次新获取的微信授权码，由后端验证并核对当前账户绑定；本地 OpenID 仅能作辅助信息，不能认证账户或决定付款身份。详细边界见 [用户身份与结算校验约定](../docs/功能文档/用户身份与结算校验约定.md) 和 [登录恢复说明](../docs/小程序登录恢复与按页请求改造说明.md)。

## 商品、分页与购物车

商品目录、列表和详情使用 [api/product.js](api/product.js)。例如读取指定目录的一页商品：

```js
import { getCategoryProducts } from '@/api/product.js'

const result = await getCategoryProducts(categoryId, 1, 10)
```

`categoryId` 是目录树编号，`productCategory` 是独立的商品业务大类，不能混用。可选大类、排序、关键字和加载选项按该函数当前签名传入。展示字段、可售性与库存未知值使用现有映射工具，不能用本地默认值伪造有货。

订单分页使用 [api/order.js](api/order.js) 的 `getOrderPage()`，其结果已整理为 `rows`、`total`、`pageNum`、`pageSize`、`hasMore`：

```js
import { getOrderPage } from '@/api/order.js'

const page = await getOrderPage({ pageNum: 1, pageSize: 10 })
const orders = page.rows
```

购物车协议在 [api/cart.js](api/cart.js)，页面优先使用 [utils/cart.js](utils/cart.js) 的 `refreshCart()`、`addCartItem()`、`setCartItemQuantity()` 等业务入口。服务端行 ID 和 `cartVersion` 必须随现有流程传递；操作失败重新读取服务端结果，不回退到本地购物车并宣称保存成功。下单后的清理只删除原快照匹配的行和版本，不能按商品 ID 猜测删除用户后来加入的商品。

## 结算与付款

确认订单页面使用 [pages/order/confirm.vue](pages/order/confirm.vue) 的完整流程：

1. 校验就诊人、地址、商品规格、问卷和报价，使用 [utils/order-submission.js](utils/order-submission.js) 取得或恢复本次 `requestId`。
2. 调用 [api/payment.js](api/payment.js) 的 `prepareOrderCheckout(kind, data)`，`kind` 为 `goods` 或 `prescription`。此入口合并下单和支付参数准备；不要在页面先另建订单再重复调用结算。
3. 保存返回的原订单，再使用同一次结算取得的支付对象调用 `invokePreparedWechatPayment(orderId, payment)`。该对象仅在取得它的当前会话内有效。
4. SDK 返回后读取服务端支付和履约状态；结果未知时保留原订单、原提交标识和购物车快照，从原订单恢复。

原订单续付复用 `wechatSinglePay(orderId)`；页面不能提供 OpenID、金额或复用已消费的微信授权码。`getPaymentStatusByOrder()` 只读已保存状态；`syncPaymentByOrder()` 是主动资金查询同步，不能把普通状态轮询改成重复提交付款或 HIS 写请求。

真实微信收款和医院登记分别保留事实。HIS 前置失败不应拉起付款，付款后的医院异常也不能改成未付款。具体门禁和恢复规则遵循根目录当前 AGENTS 及维护中的功能文档。

## 其他模块与维护

| 模块 | 源码入口 |
| --- | --- |
| 就诊人与地址 | [patient.js](api/patient.js)、[address.js](api/address.js) |
| 医院、医生及咨询处方 | [hospital.js](api/hospital.js)、[consultation.js](api/consultation.js) |
| 公告与 AI 会话 | [announcement.js](api/announcement.js)、[ai-chat.js](api/ai-chat.js) |
| 接口聚合导出 | [api/index.js](api/index.js)，未聚合模块直接导入 |

新增或调整接口时同步修改实际调用页。保留服务端返回的空值含义、状态及归属校验，失败时展示错误和重试，不以模拟数据替代正式结果。日志使用现有诊断工具，不输出 Token、一次性授权码或患者资料。

后端字段、字典及结构变更遵循 [Flyway 迁移约定](../docs/数据库文档/database-flyway.md)，不在小程序接入步骤中手工执行旧迁移脚本。修改后的验证范围按实际受影响入口确定，未执行的自动化、真机或支付验证如实记录。
