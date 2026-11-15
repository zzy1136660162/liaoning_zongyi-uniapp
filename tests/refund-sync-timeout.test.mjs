import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

test('同步退款写请求局部等待60秒，详情查询沿用默认超时', async () => {
  const calls = [], context = {
    post: async (url, data, options) => { calls.push({ url, options }); return {} },
    get: async (url, data, options) => { calls.push({ url, options }); return {} }
  }
  const source = readFileSync(new URL('../api/refund.js', import.meta.url), 'utf8')
    .replace(/^import .*$/gm, '').replace(/export const /g, 'globalThis.')
  vm.runInNewContext(source, context)
  await context.applyRefund({ orderId: 1 }); await context.auditRefund(2, { status: 1 }); await context.executeRefund(2)
  await context.getRefundDetail(2)
  assert.ok(calls.slice(0, 3).every(call => call.options.timeout === 60000))
  assert.equal(calls[3].options.timeout, undefined)
})
