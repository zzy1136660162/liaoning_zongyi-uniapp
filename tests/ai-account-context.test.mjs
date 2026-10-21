import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, test } from 'node:test'
import { fetchAccountProfile } from '../utils/account.js'
import { beginSession, endSession, getSessionGeneration, getSessionToken, isCurrentSession, sessionChangedError } from '../utils/session.js'
import { STORAGE_KEY_TOKEN } from '../utils/storage.js'

const source = readFileSync(new URL('../api/ai-chat.js', import.meta.url), 'utf8')
  .replace(/^[ \t]*import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
  .replace(/^export /gm, '')
const sendAiChatMessage = Function('getSessionGeneration', 'getSessionToken', 'isCurrentSession',
  'sessionChangedError', 'fetchAccountProfile', 'FASTGPT_API_KEY', 'FASTGPT_STREAM', 'FASTGPT_TIMEOUT',
  'getFastgptChatUrl', 'isFastgptConfigured', `${source}\nreturn sendAiChatMessage`)(
  getSessionGeneration, getSessionToken, isCurrentSession, sessionChangedError, fetchAccountProfile,
  'fixture-ai-key', false, 1000, () => 'https://fixture.invalid/ai/chat', () => true)

const values = new Map(), requests = [], reads = []
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve() }
const profile = { id: 7, userName: '接口账户', phone: 'fixture-phone', avatarUrl: '/api-avatar.png' }
const succeedProfile = (request, data = profile) => request.success({ statusCode: 200, data: { code: 200, data } })
const succeedChat = request => request.success({ statusCode: 200, data: { chatId: 'fixture-chat',
  choices: [{ message: { content: '模拟客服回复' } }] } })

beforeEach(() => {
  values.clear(); requests.length = 0; reads.length = 0
  // 替换传输边界，账户查询仍经过真实账户模块和请求封装，不访问业务接口。
  globalThis.uni = {
    getStorageSync: key => { reads.push(key); return values.get(key) },
    setStorageSync: (key, value) => values.set(key, value), removeStorageSync: key => values.delete(key),
    request: options => requests.push(options), hideLoading() {}, showLoading() {}, showToast() {}, $emit() {}
  }
  beginSession('fixture-A')
  reads.length = 0
})
afterEach(() => { endSession() })

test('AI发送内部取得正式DTO，调用者附加表单身份及旧缓存均不能覆盖', async () => {
  values.set('user_info', { userId: 999, userName: '旧缓存' })
  values.set('user_register_info', { realName: '未提交表单' })
  const pending = sendAiChatMessage({ text: '测试问题', userInfo: { userId: 999, userName: '页面伪身份' } })
  await flush()
  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/api\/user\/profile$/)
  succeedProfile(requests[0]); await flush()
  assert.equal(requests.length, 2)
  assert.equal(requests[1].data.customUid, '7')
  assert.deepEqual(requests[1].data.variables, { userId: 7, userName: '接口账户', phone: 'fixture-phone' })
  assert.equal(requests[1].data.messages.at(-1).content, '测试问题')
  succeedChat(requests[1]); assert.equal((await pending).content, '模拟客服回复')
  assert.equal(reads.some(key => ['user_info', 'user_register_info', 'wechat_openid'].includes(key)), false)

  const next = sendAiChatMessage({ text: '再次提问' })
  await flush()
  assert.equal(requests.length, 3)
  assert.match(requests[2].url, /\/api\/user\/profile$/)
  succeedProfile(requests[2], { ...profile, userName: '更新后的接口账户' }); await flush()
  assert.equal(requests[3].data.variables.userName, '更新后的接口账户')
  succeedChat(requests[3]); await next
})

test('游客使用guest而不查账户接口、不使用旧资料或调用者身份', async () => {
  endSession()
  const pending = sendAiChatMessage({ text: '游客问题', userInfo: { userId: 999 } })
  await flush()
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'https://fixture.invalid/ai/chat')
  assert.equal(requests[0].data.customUid, 'guest')
  assert.deepEqual(requests[0].data.variables, { userId: '', userName: '', phone: '' })
  succeedChat(requests[0]); await pending
})

test('账户资料查询失败即阻断发送，不冒充游客或沿用历史资料', async () => {
  const pending = sendAiChatMessage({ text: '测试问题' })
  const rejected = assert.rejects(pending)
  await flush()
  requests[0].fail({ errMsg: 'request:fail timeout' })
  await rejected
  assert.equal(requests.length, 1)
})

test('资料返回前换号不会发送旧问题到新账号，AI响应前换号也拒绝迟到结果', async () => {
  const oldProfile = sendAiChatMessage({ text: '旧问题' })
  const profileRejected = assert.rejects(oldProfile, { code: 'SESSION_CHANGED' })
  await flush(); beginSession('fixture-B'); succeedProfile(requests[0]); await profileRejected
  assert.equal(requests.length, 1)

  const oldChat = sendAiChatMessage({ text: 'B的问题' })
  const chatRejected = assert.rejects(oldChat, { code: 'SESSION_CHANGED' })
  await flush(); succeedProfile(requests[1], { ...profile, id: 8 }); await flush()
  assert.equal(requests[2].data.customUid, '8')
  beginSession('fixture-C'); succeedChat(requests[2]); await chatRejected
})

test('会话代次相同但Token被替换时，AI成功及失败回调均拒绝旧结果', async () => {
  for (const outcome of ['success', 'failure']) {
    beginSession(`fixture-A-${outcome}`)
    const index = requests.length
    const pending = sendAiChatMessage({ text: '旧Token问题' })
    const rejected = assert.rejects(pending, { code: 'SESSION_CHANGED' })
    await flush(); succeedProfile(requests[index]); await flush()
    const generation = getSessionGeneration()
    values.set(STORAGE_KEY_TOKEN, `fixture-B-${outcome}`)
    assert.equal(getSessionGeneration(), generation)
    if (outcome === 'success') succeedChat(requests[index + 1])
    else requests[index + 1].fail({ errMsg: 'request:fail timeout' })
    await rejected
  }
})
