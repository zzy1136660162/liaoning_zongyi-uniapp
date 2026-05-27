const assert = require('assert')

const {
  buildCategoryTree,
  findDefaultSubCategoryId,
  normalizeCategoryId
} = require('../utils/category-tree.js')

const tree = buildCategoryTree([
  { id: 1, parentId: 0, name: '内科制剂' },
  { id: 2, parentId: 1, name: '呼吸类' },
  { id: 3, parentId: 1, name: '脾胃类' },
  { id: 4, parentId: 0, name: '外科制剂' }
])

assert.strictEqual(tree.length, 2)
assert.strictEqual(tree[0].children.length, 2)
assert.strictEqual(tree[0].children[0].name, '呼吸类')
assert.strictEqual(findDefaultSubCategoryId(tree[0]), '2')
assert.strictEqual(findDefaultSubCategoryId(tree[1]), '')
assert.strictEqual(normalizeCategoryId(10), '10')

console.log('category-tree test passed')
