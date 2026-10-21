import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import parser from 'vue-eslint-parser'
import { loadSetup } from './sfc-harness.mjs'

const regions = [
  { name: '广东省', children: [{ name: '广州市', children: [] }] },
  { name: '辽宁省', children: [
    { name: '沈阳市', children: [
      { name: '和平区', children: [{ name: '测试街道' }, { name: '另一街道' }] },
      { name: '测试区', children: [] }
    ] },
    { name: '大连市', children: [{ name: '中山区', children: [{ name: '测试街道' }] }] }
  ] }
]
const address = {
  id: 10, receiverName: '测试收货人', receiverPhone: '13800138000',
  province: '辽宁省', city: '沈阳市', district: '和平区', addressDetail: '测试街道10号'
}

const createPage = (data = regions, existing = address) => {
  let mount
  const toasts = [], saved = []
  const page = loadSetup('pages/order/address_edit.vue', {
    ref: value => ({ value }), reactive: value => value,
    onMounted: callback => { mount = callback }, getCurrentPages: () => [{ options: {} }],
    getSessionGeneration: () => 1, getImageUrl: path => path,
    getAddressDetail: async () => existing,
    addAddress: async data => saved.push({ data }),
    updateAddress: async (id, data) => saved.push({ id, data }),
    uni: {
      request: ({ success }) => success({ data }),
      showToast: toast => toasts.push(toast.title),
      showLoading() {}, hideLoading() {}, setNavigationBarTitle() {}, navigateBack() {}
    }
  }, ['formData', 'multiRange', 'multiValue', 'isEdit', 'addressId', 'loadAddress',
    'onMultiColumnChange', 'onMultiChange', 'setMultiValueFromForm', 'validateForm', 'saveAddress'])
  return { page, mount, toasts, saved }
}

const fillContact = page => Object.assign(page.formData, {
  name: address.receiverName, phone: address.receiverPhone, detail: '10号'
})
const confirmSelection = page => page.onMultiChange({ detail: { value: page.multiValue.value } })

test('区域选择器包住标签、内容和箭头，整行具有完整宽度和内边距', () => {
  const source = readFileSync(new URL('../pages/order/address_edit.vue', import.meta.url), 'utf8')
  const { ast } = parser.parseForESLint(source, { sourceType: 'module', ecmaVersion: 2022 })
  const descendants = node => [node, ...(node.children || []).flatMap(descendants)]
  const nodes = descendants(ast.templateBody)
  const hasClass = (node, name) => node.startTag?.attributes.some(attribute =>
    !attribute.directive && attribute.key.name === 'class' && attribute.value.value.split(/\s+/).includes(name))
  const picker = nodes.find(node => node.name === 'picker' && hasClass(node, 'region-picker'))
  assert.ok(picker)
  const row = picker.children.find(node => hasClass(node, 'picker-item'))
  for (const name of ['label', 'picker-value', 'arrow', 'region-hint']) {
    assert.ok(descendants(row).some(node => hasClass(node, name)), `${name} 应位于选择器整行内`)
  }
  assert.match(source, /\.region-picker\s*\{[^}]*width:\s*100%/)
  assert.match(source, /\.picker-item\s*\{[^}]*padding:\s*24rpx 0/)
  assert.ok(picker.startTag.attributes.some(attribute => attribute.directive
    && attribute.key.argument?.name === 'cancel' && attribute.value.expression.name === 'setMultiValueFromForm'))
})

test('全国数据只保留辽宁省，默认沈阳市但未确认区县时不能保存', async () => {
  const { page, mount, toasts } = createPage()
  await mount()
  assert.deepEqual(page.multiRange.value, [['辽宁省'], ['沈阳市', '大连市'], ['和平区', '测试区'], ['测试街道', '另一街道']])
  assert.equal(page.formData.province, '辽宁省')
  assert.equal(page.formData.city, '沈阳市')
  fillContact(page)
  assert.equal(page.validateForm(), false)
  assert.equal(toasts.at(-1), '请选择完整的市、区县')
})

test('切换市会重置区县和街道，确认后保存完整的辽宁地址', async () => {
  const { page, mount, saved } = createPage()
  await mount()
  page.onMultiColumnChange({ detail: { column: 3, value: 1 } })
  page.onMultiColumnChange({ detail: { column: 1, value: 1 } })
  assert.deepEqual(page.multiValue.value, [0, 1, 0, 0])
  assert.deepEqual(page.multiRange.value[2], ['中山区'])
  confirmSelection(page)
  fillContact(page)
  await page.saveAddress()
  assert.equal(saved.length, 1)
  assert.deepEqual(saved[0].data, {
    receiverName: address.receiverName, receiverPhone: address.receiverPhone,
    province: '辽宁省', city: '大连市', district: '中山区', addressDetail: '测试街道10号', isDefault: 0
  })
})

test('取消选择恢复上次确认的区域索引，不改变地址字段', async () => {
  const { page, mount } = createPage()
  await mount()
  confirmSelection(page)
  const previous = { ...page.formData }
  page.onMultiColumnChange({ detail: { column: 1, value: 1 } })
  page.setMultiValueFromForm()
  assert.deepEqual(page.multiValue.value, [0, 0, 0, 0])
  assert.deepEqual(page.formData, previous)
})

test('辽宁地址编辑回填街道且不重复拼接，更新仍使用原地址ID', async () => {
  const { page, mount, saved } = createPage()
  await mount()
  page.isEdit.value = true
  page.addressId.value = '10'
  await page.loadAddress()
  assert.equal(page.formData.street, '测试街道')
  assert.equal(page.formData.detail, '10号')
  await page.saveAddress()
  assert.equal(saved[0].id, '10')
  assert.equal(saved[0].data.addressDetail, address.addressDetail)
})

test('省外历史地址原样回填，重新选择辽宁省内区域前不提交保存', async () => {
  const { page, mount, saved, toasts } = createPage(regions, {
    ...address, province: '广东省', city: '广州市', district: '测试区', addressDetail: '旧地址10号'
  })
  await mount()
  await page.loadAddress()
  assert.equal(page.formData.province, '广东省')
  assert.equal(page.formData.detail, '旧地址10号')
  await page.saveAddress()
  assert.deepEqual(saved, [])
  assert.equal(toasts.at(-1), '仅支持辽宁省内地址，请重新选择区域')
  confirmSelection(page)
  assert.equal(page.validateForm(), true)
})

test('没有街道数据的辽宁区县仍可保存，不将占位文字作为街道', async () => {
  const { page, mount } = createPage()
  await mount()
  page.onMultiColumnChange({ detail: { column: 2, value: 1 } })
  confirmSelection(page)
  fillContact(page)
  assert.equal(page.formData.street, '')
  assert.equal(page.validateForm(), true)
})

test('区域数据缺少辽宁或格式异常时，不回退到其他省份并阻止新增保存', async () => {
  for (const data of [[regions[0]], { message: '加载失败' }]) {
    const { page, mount, saved } = createPage(data)
    await mount()
    assert.deepEqual(page.multiRange.value[0], [])
    confirmSelection(page)
    fillContact(page)
    await page.saveAddress()
    assert.deepEqual(saved, [])
  }
})
