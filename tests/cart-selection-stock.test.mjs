import assert from 'node:assert/strict'

const storage = new Map()
const emitted = []

globalThis.uni = {
  getStorageSync(key) {
    return storage.get(key)
  },
  setStorageSync(key, value) {
    storage.set(key, value)
  },
  removeStorageSync(key) {
    storage.delete(key)
  },
  $emit(eventName, payload) {
    emitted.push({ eventName, payload })
  }
}

const resetState = () => {
  storage.clear()
  emitted.length = 0
}

const lastCartUpdated = () => {
  return emitted.filter(event => event.eventName === 'cartUpdated').at(-1)
}

const categories = [{
  id: 'cart_items',
  name: 'cart',
  products: [
    {
      id: '101',
      name: 'in stock',
      price: 12.5,
      stock: 8,
      available: true
    },
    {
      id: '102',
      name: 'sold out',
      price: 99,
      stock: 0,
      available: false
    }
  ]
}]

const main = async () => {
  const cart = await import('../utils/cart.js')

  resetState()
  cart.replaceCartData({
    101: { verified: true, selected: true, quantity: 2, available: true, stock: 8 },
    102: { verified: true, selected: true, quantity: 1, available: false, stock: 0 }
  })

  let items = cart.loadCartItems(categories)
  assert.equal(items.find(item => item.id === '101').selected, true)
  assert.equal(items.find(item => item.id === '101').stock, 8)
  assert.equal(items.find(item => item.id === '102').selected, false)
  assert.equal(items.find(item => item.id === '102').available, false)
  assert.equal(items.find(item => item.id === '102').stock, 0)
  assert.deepEqual(cart.getSelectedProductIds(), ['101'])
  assert.equal(cart.calculateTotalPrice(items), 25)

  cart.updateMultipleSelections({ 101: false, 102: true })
  items = cart.loadCartItems(categories)
  assert.deepEqual(cart.getSelectedProductIds(), [])
  assert.equal(cart.calculateTotalPrice(items), 0)
  assert.equal(items.find(item => item.id === '102').selected, false)

  cart.updateMultipleSelections({ 101: true, 102: true })
  items = cart.loadCartItems(categories)
  assert.deepEqual(cart.getSelectedProductIds(), ['101'])
  assert.equal(items.find(item => item.id === '102').selected, false)

  cart.setCartItemQuantity('101', 99)
  items = cart.loadCartItems(categories)
  assert.equal(items.find(item => item.id === '101').quantity, 8)

  resetState()
  cart.addCartItem({ id: '101', stock: 8, available: true }, 1)
  assert.equal(lastCartUpdated().payload.source, 'local')

  cart.replaceCartData({
    101: { verified: true, selected: true, quantity: 1, available: true, stock: 8 }
  })
  assert.equal(lastCartUpdated().payload.source, 'server')

  resetState()
  cart.addCartItem({
    id: '201',
    name: 'direct goods',
    productCategory: 2,
    bizType: 1,
    stock: 8,
    available: true
  }, 1)
  const therapyCompatibility = cart.resolveCartCompatibility({
    id: '202',
    name: 'traditional therapy',
    categoryCode: '传统疗法',
    bizType: 1,
    stock: 8,
    available: true
  })
  assert.equal(therapyCompatibility.valid, true)
}

main()
