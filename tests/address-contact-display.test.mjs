import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import parser from 'vue-eslint-parser'

const readTemplate = page => {
  const source = readFileSync(new URL(`../pages/order/${page}.vue`, import.meta.url), 'utf8')
  const { ast } = parser.parseForESLint(source, { sourceType: 'module', ecmaVersion: 2022, range: true })
  const descendants = node => [node, ...(node.children || []).flatMap(descendants)]
  const nodes = descendants(ast.templateBody)
  const findClass = className => {
    const node = nodes.find(node => node.type === 'VElement'
      && node.startTag.attributes.some(attribute => attribute.key.name === 'class'
        && attribute.value.value.split(/\s+/).includes(className)))
    assert.ok(node, `${page} 应包含 ${className}`)
    return node
  }
  const evaluate = (expression, data) => Function(...Object.keys(data),
    `return (${source.slice(...expression.range)})`)(...Object.values(data))
  return {
    findClass,
    text: (node, data) => descendants(node).filter(node => node.type === 'VExpressionContainer')
      .map(node => evaluate(node.expression, data)).join(''),
    visible: (node, data) => Boolean(evaluate(node.startTag.attributes
      .find(attribute => attribute.directive && attribute.key.name.name === 'if').value.expression, data)),
    source
  }
}

const address = {
  id: 10, receiverName: '测试联系人', receiverPhone: '13800138000',
  province: '辽宁省', city: '沈阳市', district: '和平区', addressDetail: '测试街道10号', isDefault: 1
}
const assertContact = text => {
  assert.ok(text.includes(address.receiverName), '应显示后端返回的联系人')
  assert.ok(text.includes(address.receiverPhone), '应显示后端返回的电话')
  assert.ok(text.includes('辽宁省沈阳市和平区测试街道10号'), '应显示完整地址')
}

test('确认订单使用地址真实字段显示联系人、电话和地址，并保留无地址提示', () => {
  const page = readTemplate('confirm')
  const content = page.findClass('address-content')
  assertContact(page.text(content, { selectedAddress: address }))
  assert.equal(page.visible(content, { selectedAddress: address }), true)
  assert.equal(page.visible(content, { selectedAddress: null }), false)
  const empty = page.findClass('address-empty')
  assert.ok(page.source.slice(...empty.range).includes('请选择收货地址'))
})

test('地址列表显示联系人和电话，默认标签仅显示在默认地址并位于联系人左侧', () => {
  const page = readTemplate('address_list')
  assertContact(page.text(page.findClass('address-content'), { address }))
  const badge = page.findClass('default-badge')
  assert.equal(page.visible(badge, { address }), true)
  assert.equal(page.visible(badge, { address: { ...address, isDefault: 0 } }), false)
  assert.ok(badge.range[0] < page.findClass('name').range[0])
  assert.equal(page.visible(page.findClass('empty-state'), { addresses: [] }), true)
  assert.equal(page.visible(page.findClass('empty-state'), { addresses: [address] }), false)
})
