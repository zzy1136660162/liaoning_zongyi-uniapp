import assert from 'node:assert/strict'

const events = await import('../utils/cart-events.js')

assert.equal(events.shouldReloadCartFromServer(), false)
assert.equal(events.shouldReloadCartFromServer({}), false)
assert.equal(events.shouldReloadCartFromServer({ source: 'local' }), false)
assert.equal(events.shouldReloadCartFromServer({ source: 'server' }), false)
assert.equal(events.shouldReloadCartFromServer({ source: 'reload' }), true)
assert.equal(events.shouldReloadCartFromServer({ reload: true }), true)
