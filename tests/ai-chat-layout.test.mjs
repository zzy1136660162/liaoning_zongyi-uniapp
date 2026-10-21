import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadSetup } from './sfc-harness.mjs'
import * as storage from '../utils/storage.js'
import { renderMarkdown } from '../utils/markdown.js'

const createChat = (device = {}, stored = [], options = {}) => {
  const values = new Map([
    [storage.STORAGE_KEY_AI_CHAT_ID, 'fixture-chat'],
    [storage.STORAGE_KEY_AI_CHAT_MESSAGES, stored]
  ])
  const requests = [], modals = []
  let load, resize, show, unload, sessionChanged
  let generation = 1, token = options.token || ''
  const uni = {
    getWindowInfo: () => ({ statusBarHeight: 24, windowWidth: 375 }),
    getMenuButtonBoundingClientRect: () => ({ left: 281, bottom: 60 }),
    getStorageSync: key => values.get(key), setStorageSync: (key, value) => values.set(key, value),
    hideKeyboard() {}, showToast() {}, showModal: options => modals.push(options),
    ...device
  }
  const state = loadSetup('pages/ai/chat.vue', {
    ...storage, uni, renderMarkdown, getImageUrl: value => value,
    getSessionGeneration: () => generation, isCurrentSession: session => session === generation,
    getSessionToken: () => token,
    onSessionChanged: callback => { sessionChanged = callback; return () => { sessionChanged = null } },
    fetchAccountProfile: options.fetchAccountProfile || (async () => ({ id: 7, avatarUrl: '/api-avatar.png' })),
    ref: value => ({ value }), computed: getter => ({ get value() { return getter() } }),
    watch() {}, nextTick: callback => callback(),
    onLoad: callback => { load = callback }, onResize: callback => { resize = callback },
    onShow: callback => { show = callback }, onUnload: callback => { unload = callback },
    sendAiChatMessage: async payload => {
      requests.push(payload)
      if (options.sendAiChatMessage) return options.sendAiChatMessage(payload)
      return { chatId: 'fixture-reply-chat', content: '模拟客服回复' }
    }
  }, ['statusBarHeight', 'navigationHeight', 'navigationRightInset', 'messages', 'chatId',
    'inputValue', 'isLoading', 'showQuickQuestions', 'canSend', 'submitMessage', 'handleStartNewChat',
    'userAvatar', 'failedQuestion'])
  load()
  return { state, uni, resize, show, unload, requests, modals, values,
    changeSession: (nextToken = 'fixture-next-token') => { generation++; sessionChanged?.(); token = nextToken },
    replaceToken: nextToken => { token = nextToken } }
}

test('聊天工具栏从胶囊下方开始，导航内容为胶囊预留横向空间', () => {
  for (const [statusBarHeight, windowWidth, left, bottom] of [
    [20, 320, 226, 60], [24, 360, 266, 60], [44, 375, 281, 80], [59, 430, 336, 97]
  ]) {
    const { state } = createChat({
      getWindowInfo: () => ({ statusBarHeight, windowWidth }),
      getMenuButtonBoundingClientRect: () => ({ left, bottom })
    })
    assert.ok(state.statusBarHeight.value + state.navigationHeight.value >= bottom + 8)
    assert.ok(windowWidth - state.navigationRightInset.value <= left - 8)
    assert.equal(state.messages.value.length, 1)
  }
})

test('胶囊或窗口信息缺失、无效、抛错时仍能恢复对话并获得有限的布局尺寸', () => {
  const unavailable = () => { throw new Error('API unavailable') }
  const history = [{ role: 'assistant', content: '历史回复', createdAt: 1 }]
  for (const device of [
    { getMenuButtonBoundingClientRect: undefined },
    { getMenuButtonBoundingClientRect: () => ({ left: 0, bottom: 0 }) },
    { getMenuButtonBoundingClientRect: () => ({ left: NaN, bottom: Infinity }) },
    { getMenuButtonBoundingClientRect: unavailable },
    { getWindowInfo: unavailable, getSystemInfoSync: () => ({ statusBarHeight: 44, windowWidth: 375 }) },
    { getWindowInfo: unavailable, getSystemInfoSync: unavailable, getMenuButtonBoundingClientRect: unavailable },
    { getWindowInfo: () => ({ statusBarHeight: 0, windowWidth: 375 }) }
  ]) {
    const { state } = createChat(device, history)
    for (const value of [state.statusBarHeight.value, state.navigationHeight.value, state.navigationRightInset.value]) {
      assert.ok(Number.isFinite(value) && value >= 0)
    }
    assert.ok(state.navigationHeight.value >= 44)
    assert.equal(state.messages.value[0].content, '历史回复')
    assert.equal(state.chatId.value, 'fixture-chat')
  }
})

test('窗口变化重新计算安全区域，不重置已有聊天记录', () => {
  const { state, uni, resize } = createChat({}, [{ role: 'user', content: '已有问题', createdAt: 1 }])
  const messageId = state.messages.value[0].id
  uni.getWindowInfo = () => ({ statusBarHeight: 59, windowWidth: 430 })
  uni.getMenuButtonBoundingClientRect = () => ({ left: 336, bottom: 97 })
  resize()
  assert.ok(state.statusBarHeight.value + state.navigationHeight.value >= 105)
  assert.ok(430 - state.navigationRightInset.value <= 328)
  assert.equal(state.messages.value[0].id, messageId)
  assert.equal(state.chatId.value, 'fixture-chat')
})

test('快捷提问仍发送原消息结构，新对话取消保留历史、确认后清空', async () => {
  const { state, requests, modals } = createChat()
  assert.equal(state.showQuickQuestions.value, true)
  assert.equal(state.canSend.value, false)
  await state.submitMessage('如何查看订单状态？')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].text, '如何查看订单状态？')
  assert.equal('userInfo' in requests[0], false)
  assert.match(requests[0].chatId, /^chat_[a-z0-9]+_[a-z0-9]+$/)
  assert.deepEqual(requests[0].messages.at(-1), { role: 'user', content: '如何查看订单状态？' })
  assert.equal(state.messages.value.at(-1).content, '模拟客服回复')
  assert.equal(state.isLoading.value, false)
  assert.equal(state.showQuickQuestions.value, false)
  const messages = state.messages.value
  state.handleStartNewChat()
  modals.at(-1).success({ confirm: false })
  assert.equal(state.messages.value, messages)
  state.handleStartNewChat()
  modals.at(-1).success({ confirm: true })
  assert.equal(state.chatId.value, '')
  assert.equal(state.messages.value.length, 1)
  assert.equal(state.showQuickQuestions.value, true)
})

const deferred = () => {
  let resolve, reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

test('头像每次显示从账户接口取得，游客不请求资料且不读取旧资料缓存', async () => {
  const profileRequests = []
  const chat = createChat({}, [], { token: 'fixture-token', fetchAccountProfile: async options => {
    profileRequests.push(options)
    return { id: 7, avatarUrl: `/api-avatar-${profileRequests.length}.png` }
  } })
  chat.values.set('user_info', { avatarUrl: '/old-avatar.png' })
  chat.values.set('user_register_info', { realName: '本地表单' })
  const read = chat.uni.getStorageSync
  chat.uni.getStorageSync = key => {
    assert.ok(!['user_info', 'user_register_info', 'wechat_openid'].includes(key))
    return read(key)
  }
  await chat.show()
  assert.equal(chat.state.userAvatar.value, '/api-avatar-1.png')
  await chat.show()
  assert.equal(chat.state.userAvatar.value, '/api-avatar-2.png')
  assert.deepEqual(profileRequests, [{ authRedirect: false }, { authRedirect: false }])
  chat.changeSession('')
  await chat.show()
  assert.equal(chat.state.userAvatar.value, '')
  assert.equal(profileRequests.length, 2)
})

test('换账号后旧头像和聊天回复均不能回写，新的上下文不携带上一账号问题', async () => {
  const avatar = deferred(), response = deferred()
  const chat = createChat({}, [], { token: 'fixture-A', fetchAccountProfile: () => avatar.promise,
    sendAiChatMessage: () => response.promise })
  const showing = chat.show()
  const sending = chat.state.submitMessage('旧账号问题')
  assert.equal(chat.state.isLoading.value, true)
  chat.changeSession('fixture-B')
  assert.equal(chat.state.messages.value.length, 1)
  avatar.resolve({ id: 7, avatarUrl: '/old-account-avatar.png' })
  response.resolve({ chatId: 'old-account-chat', content: '旧账号回复' })
  await Promise.all([showing, sending])
  assert.equal(chat.state.userAvatar.value, '')
  assert.equal(chat.state.chatId.value, '')
  assert.equal(chat.state.isLoading.value, false)
  assert.equal(chat.state.messages.value.length, 1)
  await chat.state.submitMessage('新账号问题')
  assert.deepEqual(chat.requests[1].messages, [{ role: 'user', content: '新账号问题' }])
})

test('旧账号失败不会成为新账号重试内容或重置新请求加载态', async () => {
  const first = deferred(), second = deferred()
  let count = 0
  const chat = createChat({}, [], { token: 'fixture-A', sendAiChatMessage: () => (++count === 1 ? first : second).promise })
  const old = chat.state.submitMessage('旧账号问题')
  chat.changeSession('fixture-B')
  const current = chat.state.submitMessage('新账号问题')
  first.reject(new Error('旧请求失败'))
  await old
  assert.equal(chat.state.failedQuestion.value, '')
  assert.equal(chat.state.isLoading.value, true)
  assert.equal(chat.state.messages.value.some(message => message.content === '旧请求失败'), false)
  second.resolve({ chatId: 'new-account-chat', content: '新账号回复' })
  await current
  assert.equal(chat.state.isLoading.value, false)
  assert.equal(chat.state.messages.value.at(-1).content, '新账号回复')
})

test('直接换Token、新对话及卸载均使在途旧消息失效', async () => {
  for (const boundary of ['token', 'new-chat', 'unload']) {
    const response = deferred()
    const chat = createChat({}, [], { token: 'fixture-A', sendAiChatMessage: () => response.promise })
    const pending = chat.state.submitMessage('在途问题')
    if (boundary === 'token') {
      chat.replaceToken('fixture-B')
      await chat.show()
    } else if (boundary === 'new-chat') {
      chat.state.handleStartNewChat()
      chat.modals.at(-1).success({ confirm: true })
    } else chat.unload()
    const before = JSON.stringify(chat.state.messages.value)
    response.resolve({ chatId: 'stale-chat', content: '迟到回复' })
    await pending
    assert.equal(JSON.stringify(chat.state.messages.value), before)
    assert.notEqual(chat.state.chatId.value, 'stale-chat')
  }
})
