import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { hasMixedTherapyAndNormalRefundItems, resolveRefundType } from '../utils/refund.js'
import { loadOptions } from './sfc-harness.mjs'

const createPage = (mocks = {}) => {
  const requests = [], notices = []
  const options = loadOptions('pages/order/refund_apply.vue', {
    getSessionGeneration: () => 0, isCurrentSession: () => true, assertCurrentSession() {},
    createRefundRequestId: () => 'fixture-request', hasMixedTherapyAndNormalRefundItems, resolveRefundType,
    getImageUrl: value => value, setTimeout() {}, console: { error() {}, info() {}, warn() {} },
    checkCanApplyRefund: async () => true,
    getOrderDetail: async () => ({ orderNo: 'fixture', items: [] }),
    applyRefund: async data => { requests.push(structuredClone(data)) },
    uni: { showLoading() {}, hideLoading() {}, showModal() {}, showToast: value => notices.push(value.title) },
    ...mocks
  })
  const page = { ...options.data(), ...options.methods, orderId: 9 }
  page.allProducts = [{ id: 10, price: 0.01, quantity: 1, selectedQuantity: 1, redeemVouchers: [] }]
  for (const [name, getter] of Object.entries(options.computed)) {
    Object.defineProperty(page, name, { get: () => getter.call(page) })
  }
  return { page, requests, notices }
}

test('未选退款原因仍能点击提交，并明确提示选择原因', async () => {
  const { page, requests, notices } = createPage()
  assert.equal(page.canSubmit, true)
  await page.submitRefund()
  assert.deepEqual(notices, ['请选择退款原因'])
  assert.deepEqual(requests, [])
})

test('未选退款商品与非正退款金额分别提示原因，不发送申请', async () => {
  for (const [quantity, price, expected] of [[0, 1, '请选择退款商品'], [1, 0, '退款金额须大于0'], [1, -1, '退款金额须大于0']]) {
    const { page, requests, notices } = createPage()
    page.allProducts[0].selectedQuantity = quantity
    page.allProducts[0].price = price
    page.form.refundReason = '其他'
    assert.equal(page.canSubmit, true)
    await page.submitRefund()
    assert.deepEqual(notices, [expected])
    assert.deepEqual(requests, [])
  }
})

test('有商品、原因和正金额时，说明和凭证留空也能正常提交', async () => {
  const { page, requests, notices } = createPage()
  page.selectReason('其他')
  await page.submitRefund()
  assert.equal(requests.length, 1)
  assert.equal(requests[0].refundReason, '其他')
  assert.equal(requests[0].refundDescription, '')
  assert.deepEqual(requests[0].refundImages, [])
  assert.deepEqual(requests[0].items, [{ orderItemId: 10, quantity: 1, refundReason: '其他' }])
  assert.deepEqual(notices, ['申请提交成功'])
  assert.equal(page.canSubmit, false)
})

test('加载、上传、提交和已成功状态禁用按钮且不会重复请求或误报表单错误', async () => {
  for (const flag of ['loading', 'uploading', 'submitting', 'submitted']) {
    const { page, requests, notices } = createPage()
    page[flag] = true
    assert.equal(page.canSubmit, false, flag)
    await page.submitRefund()
    assert.deepEqual(requests, [], flag)
    assert.deepEqual(notices, [], flag)
  }
})

test('详情加载期间禁止申请，加载完成和失败后均恢复点击', async () => {
  let finish
  const { page, requests } = createPage({ checkCanApplyRefund: () => new Promise(resolve => { finish = resolve }) })
  const loading = page.loadOrderDetail()
  assert.equal(page.canSubmit, false)
  await page.submitRefund()
  assert.deepEqual(requests, [])
  finish(true)
  await loading
  assert.equal(page.canSubmit, true)
  const failed = createPage({ checkCanApplyRefund: async () => { throw new Error('加载失败') } })
  await failed.page.loadOrderDetail()
  assert.equal(failed.page.canSubmit, true)
  assert.deepEqual(failed.notices, ['加载失败'])
})

test('选择凭证至上传结束全程禁止申请，结束后恢复点击', async () => {
  let choose, upload
  const { page, requests } = createPage({
    uni: { showLoading() {}, hideLoading() {}, chooseImage: () => new Promise(resolve => { choose = resolve }) },
    uploadFile: () => new Promise(resolve => { upload = resolve })
  })
  const uploading = page.chooseImage()
  assert.equal(page.canSubmit, false)
  await page.submitRefund()
  assert.deepEqual(requests, [])
  choose({ tempFilePaths: ['/fixture.jpg'] })
  await Promise.resolve()
  assert.equal(page.canSubmit, false)
  upload({ url: '/uploaded.jpg' })
  await uploading
  assert.equal(page.canSubmit, true)
  assert.deepEqual(page.form.refundImages, ['/uploaded.jpg'])
})

test('取消选择凭证和上传失败均恢复按钮状态', async () => {
  for (const error of [{ errMsg: 'chooseImage:fail cancel' }, new Error('上传失败')]) {
    const notices = []
    const { page } = createPage({
      uni: { showLoading() {}, hideLoading() {}, showToast: value => notices.push(value.title),
        chooseImage: async () => { throw error } }
    })
    await page.chooseImage()
    assert.equal(page.canSubmit, true)
    assert.deepEqual(notices, error.errMsg ? [] : ['上传失败'])
  }
})

test('请求进行中与成功后点击均不会重复创建退款申请', async () => {
  let finish, count = 0
  const { page } = createPage({ applyRefund: () => new Promise(resolve => { count++; finish = resolve }) })
  page.selectReason('其他')
  const submitting = page.submitRefund()
  await page.submitRefund()
  assert.equal(count, 1)
  assert.equal(page.canSubmit, false)
  finish()
  await submitting
  await page.submitRefund()
  assert.equal(count, 1)
})

test('接口拒绝时保留具体失败提示并允许重新提交', async () => {
  const { page, notices } = createPage({ applyRefund: async () => { throw { code: 400, message: '可退数量已变化' } } })
  page.selectReason('其他')
  await page.submitRefund()
  for (let i = 0; i < 12; i++) await Promise.resolve()
  assert.deepEqual(notices, ['可退数量已变化'])
  assert.equal(page.canSubmit, true)
})

test('明确拒绝后的后台刷新不会用加载提示覆盖错误原因', async () => {
  const feedback = []
  const { page } = createPage({
    applyRefund: async () => { throw { code: 400, message: '发货状态已变化' } },
    uni: { showLoading: () => feedback.push('loading'), hideLoading() {},
      showToast: value => feedback.push(value.title) }
  })
  page.selectReason('其他')
  await page.submitRefund()
  for (let i = 0; i < 12; i++) await Promise.resolve()
  assert.deepEqual(feedback, ['loading', '发货状态已变化'])
  assert.equal(page.canSubmit, true)
})

test('页面标明原因必选，按钮点击与禁用样式绑定相同忙状态', () => {
  const source = readFileSync(new URL('../pages/order/refund_apply.vue', import.meta.url), 'utf8')
  assert.match(source, /退款原因（必选）/)
  assert.match(source, /<button\b(?=[^>]*class="submit-btn")(?=[^>]*:class="\{ disabled: !canSubmit \}")(?=[^>]*:disabled="!canSubmit")(?=[^>]*@tap="submitRefund")[^>]*>/)
  assert.match(source, /&\.disabled\s*\{/)
})
