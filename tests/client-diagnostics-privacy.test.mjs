import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { getWeChatUserInfo, getWeChatUserProfile, getStoredWeChatOpenId } from '../api/auth.js'
import { uploadFile } from '../api/common.js'

const require = createRequire(import.meta.url)
const { parse } = require('espree')
const PRIVATE = 'SYNTHETIC_PRIVATE_SAMPLE'

const captureLogs = async callback => {
  const entries = []
  const saved = Object.fromEntries(['log', 'debug', 'info', 'warn', 'error'].map(level => [level, console[level]]))
  for (const level of Object.keys(saved)) console[level] = (...args) => entries.push(args)
  try {
    await callback(entries)
  } finally {
    Object.assign(console, saved)
  }
}

test('微信资料与存储错误诊断不打印身份、凭证或异常原文', async () => {
  await captureLogs(async entries => {
    globalThis.uni = {
      getUserInfo: ({ success }) => success({ userInfo: { nickName: PRIVATE }, rawData: PRIVATE, signature: PRIVATE }),
      getUserProfile: ({ fail }) => fail({ errMsg: PRIVATE, code: PRIVATE }),
      getStorageSync: () => { throw new Error(PRIVATE) }
    }
    assert.equal((await getWeChatUserInfo()).nickName, PRIVATE)
    await assert.rejects(getWeChatUserProfile())
    assert.equal(getStoredWeChatOpenId(), null)
    const rendered = JSON.stringify(entries)
    assert.match(rendered, /event=wechat_profile/)
    assert.match(rendered, /reason=storage_error/)
    assert.equal(rendered.includes(PRIVATE), false)
  })
})

test('上传诊断保留结果与耗时但不打印鉴权、文件地址或服务端错误原文', async () => {
  await captureLogs(async entries => {
    let call
    globalThis.uni = {
      getStorageSync: () => PRIVATE,
      uploadFile: options => { call = options }
    }
    const success = uploadFile(`/local/${PRIVATE}`, { formData: { phone: PRIVATE } })
    assert.equal(call.header.Authorization, `Bearer ${PRIVATE}`)
    call.success({ statusCode: 200, data: { code: 200, data: { url: `/uploads/${PRIVATE}` } } })
    assert.equal((await success).url, `/uploads/${PRIVATE}`)
    const failure = uploadFile(`/local/${PRIVATE}`)
    const rejected = assert.rejects(failure)
    call.success({ statusCode: 200, data: { code: 500, message: PRIVATE } })
    await rejected
    const rendered = JSON.stringify(entries)
    assert.match(rendered, /event=common_upload/)
    assert.match(rendered, /durationMs/)
    assert.match(rendered, /reason=parse_error/)
    assert.equal(rendered.includes(PRIVATE), false)
  })
})

test('已修改患者关键页面的console仅使用固定诊断字段及明确的库存数量白名单', () => {
  const files = [
    'pages/index/index.vue', 'pages/order/confirm.vue', 'pages/order/order-detail.vue',
    'pages/order/order_list.vue', 'pages/order/payment_success.vue', 'pages/order/prescription_list.vue',
    'pages/order/refund_apply.vue', 'pages/order/refund_detail.vue', 'pages/register/register.vue',
    'pages/user/profile.vue', 'pages/dispense/consultation.vue'
  ]
  let logCount = 0
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    const script = /<script\b[^>]*>([\s\S]*?)<\/script>/.exec(source)?.[1]
    assert.ok(script, `${file}: script exists`)
    const tree = parse(script, { ecmaVersion: 'latest', sourceType: 'module' })
    const visit = node => {
      if (!node || typeof node !== 'object') return
      if (node.type === 'CallExpression' && node.callee?.object?.name === 'console') {
        logCount++
        const first = node.arguments[0]
        assert.equal(first?.type, 'Literal', `${file}: log template must be static`)
        if (first.value.startsWith('category=CHECKOUT_STOCK_GUARD')) {
          assert.deepEqual(node.arguments.slice(1).map(argument => [argument.object?.name, argument.property?.name]), [
            ['stockCheck', 'reason'], ['stockCheck', 'productId'], ['stockCheck', 'quantity'], ['stockCheck', 'latestStock']
          ])
        } else {
          assert.match(first.value, /^event=ui_/)
          assert.equal(node.arguments.length, 1, `${file}: no unreviewed object or error payload in page logs`)
        }
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visit)
        else if (value && typeof value === 'object') visit(value)
      }
    }
    visit(tree)
  }
  assert.ok(logCount > 60)
})
