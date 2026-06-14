import assert from 'node:assert/strict'
import { buildCustomerServiceChatOptions } from '../utils/customer-service.js'
import { CUSTOMER_SERVICE_CONFIG } from '../utils/config.js'

const options = buildCustomerServiceChatOptions()

assert.equal(options.corpId, CUSTOMER_SERVICE_CONFIG.corpId)
assert.deepEqual(options.extInfo, { url: CUSTOMER_SERVICE_CONFIG.url })
assert.equal(options.corpId, 'ww3fe8ec237bf70c8b')
assert.equal(options.extInfo.url, 'https://work.weixin.qq.com/kfid/kfcc92471bfa5f832db')
