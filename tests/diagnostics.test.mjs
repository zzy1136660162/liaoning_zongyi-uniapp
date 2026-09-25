import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTraceId, diagnosticRoute, logRequestDiagnostic, logPaymentDiagnostic } from '../utils/diagnostics.js'
import { request } from '../utils/request.js'

test('trace IDs are bounded and query strings / dynamic routes never appear in diagnostics', () => {
  const a = createTraceId()
  assert.match(a, /^[A-Za-z0-9_-]{16,64}$/)
  assert.notEqual(a, createTraceId())
  assert.equal(diagnosticRoute('/api/payment/single/create-by-order/987?openid=private'), '/api/payment/single/create-by-order/:value')
  assert.equal(diagnosticRoute('/api/patients/private-name/private-phone'), '/api/patients/:value/:value')
})

test('request keeps response semantics, carries trace ID and logs numeric error code without private body', async () => {
  const logs = []
  const original = console.warn
  console.warn = (...args) => logs.push(args.join(' '))
  let call
  globalThis.uni = {
    getStorageSync() { return '' }, setStorageSync() {}, removeStorageSync() {},
    showLoading() {}, hideLoading() {}, showToast() {},
    request(options) { if (!options.url.endsWith('/api/access-log')) call = options }
  }
  try {
    const result = request({ url: '/api/refund/apply?code=private-code', data: { phone: 'private-phone' } })
    assert.match(call.header['X-Request-Id'], /^[A-Za-z0-9_-]{16,64}$/)
    const body = { code: 409, message: 'private-name', data: { token: 'private-token' } }
    const rejected = assert.rejects(result, error => error === body)
    call.success({ statusCode: 200, data: body })
    await rejected
    assert.equal(logs.length, 1)
    assert.ok(logs[0].includes('traceId=' + call.header['X-Request-Id']))
    assert.ok(logs[0].includes('businessCode=409'))
    assert.ok(!logs[0].includes('private'))
  } finally {
    console.warn = original
  }
})

test('network failures log fixed reason without forwarding external error contents', () => {
  const lines = []
  const original = console.warn
  console.warn = text => lines.push(text)
  try {
    logRequestDiagnostic({ traceId: createTraceId(), url: '/api/auth/login?code=private',
      method: 'POST', httpStatus: 0, durationMs: 80, reason: 'timeout', stale: true })
    assert.ok(lines[0].includes('reason=timeout'))
    assert.ok(lines[0].includes('staleSession=true'))
    assert.ok(!lines[0].includes('private'))
  } finally { console.warn = original }
})

test('a broken console cannot interrupt request resolution or client payment diagnostics', async () => {
  const originalInfo = console.info
  const originalWarn = console.warn
  console.info = console.warn = () => { throw new Error('console unavailable') }
  let call
  globalThis.uni = {
    getStorageSync() { return '' }, setStorageSync() {}, removeStorageSync() {},
    showLoading() {}, hideLoading() {}, showToast() {},
    request(options) { if (!options.url.endsWith('/api/access-log')) call = options }
  }
  try {
    const response = request({ url: '/api/payment/single/create-by-order/123' })
    call.success({ statusCode: 200, data: { code: 200, data: { id: 123 } } })
    assert.deepEqual(await response, { id: 123 })
    assert.doesNotThrow(() => logPaymentDiagnostic('client_pay_failed', 123, 'sdk_failure'))
  } finally {
    console.info = originalInfo
    console.warn = originalWarn
  }
})
