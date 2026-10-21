<template>
  <view class="chat-page">
    <view
      class="safe-top"
      :style="{ height: `${statusBarHeight}px` }"
    />

    <view
      class="page-header"
      :style="{ height: `${navigationHeight}px`, paddingRight: `${navigationRightInset}px` }"
    >
      <view
        class="back-button"
        @tap="goBack"
      >
        <uni-icons
          type="left"
          size="20"
          color="#163450"
        />
      </view>
      <text
        class="header-title"
        :style="{ left: `${navigationRightInset}px`, right: `${navigationRightInset}px` }"
      >
        智能客服
      </text>
    </view>

    <view class="conversation-toolbar">
      <view class="service-identity">
        <image
          class="service-logo"
          :src="hospitalLogo"
          mode="aspectFill"
        />
        <view class="service-info">
          <text class="service-name">
            辽宁中医智能客服
          </text>
          <view class="service-status">
            <view class="status-dot" />
            <text>在线为您解答</text>
          </view>
        </view>
      </view>
      <button
        class="new-chat-button"
        @tap="handleStartNewChat"
      >
        <uni-icons type="plusempty" size="14" color="#2f6fb3" />
        <text>新对话</text>
      </button>
    </view>

    <scroll-view
      class="message-list"
      scroll-y
      :scroll-into-view="scrollIntoView"
      scroll-with-animation
    >
      <view class="message-content">
        <view v-if="showQuickQuestions" class="service-tags">
          <view v-for="item in serviceTags" :key="item" class="service-tag">
            {{ item }}
          </view>
        </view>
        <view
          v-for="item in messages"
          :id="`message-${item.id}`"
          :key="item.id"
          class="message-row"
          :class="item.role"
        >
          <view
            v-if="item.role !== 'user'"
            class="avatar assistant-avatar"
          >
            AI
          </view>
          <image
            v-else-if="userAvatar"
            class="avatar user-avatar"
            :src="userAvatar"
            mode="aspectFill"
          />
          <view
            v-else
            class="avatar user-avatar fallback-avatar"
          >
            我
          </view>

          <view
            class="message-main"
            :class="item.role"
          >
            <view
              class="bubble"
              :class="[item.role, { 'is-error': item.status === 'error' }]"
              @longpress="copyMessage(item.content)"
            >
              <MarkdownMessage
                v-if="item.role !== 'user'"
                :content="item.content"
              />
              <text
                v-else
                class="user-text"
              >
                {{ item.content }}
              </text>
            </view>

            <view
              v-if="item.role === 'system' && item.status === 'error' && failedQuestion"
              class="message-actions"
            >
              <view
                class="retry-action"
                @tap="retryLastMessage"
              >
                重试上一条
              </view>
            </view>

            <view class="message-meta">
              <text class="message-time">
                {{ formatTime(item.createdAt) }}
              </text>
              <text
                v-if="item.role === 'user' && item.status === 'sending'"
                class="message-status"
              >
                发送中
              </text>
              <text
                v-if="item.role === 'user' && item.status === 'error'"
                class="message-status error"
              >
                发送失败
              </text>
            </view>
          </view>
        </view>

        <view
          v-if="isLoading"
          class="message-row assistant"
        >
          <view class="avatar assistant-avatar">
            AI
          </view>
          <view class="message-main assistant">
            <view class="bubble assistant loading-bubble">
              <view class="loading-dots">
                <view class="dot" />
                <view class="dot" />
                <view class="dot" />
              </view>
            </view>
          </view>
        </view>
        <view
          v-if="showQuickQuestions"
          class="quick-section"
        >
          <text class="quick-title">
            您可以这样问
          </text>
          <view class="quick-list">
            <view
              v-for="question in quickQuestions"
              :key="question"
              class="quick-item"
              @tap="handleQuickQuestion(question)"
            >
              <text>{{ question }}</text>
              <uni-icons type="right" size="12" color="#8ba2b7" />
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="input-panel">
      <view class="input-shell">
        <input
          v-model="inputValue"
          class="message-input"
          :disabled="isLoading"
          maxlength="-1"
          confirm-type="send"
          :cursor-spacing="16"
          placeholder="请输入您想咨询的问题"
          @confirm="submitMessage()"
        >
        <button
          class="send-button"
          :disabled="!canSend"
          :class="{ active: canSend }"
          @tap="submitMessage()"
        >
          发送
        </button>
      </view>
      <text class="input-tip">
        回复由 AI 智能体提供，请勿输入身份证号、银行卡号等敏感信息。
      </text>
    </view>
  </view>
</template>

<script setup>
import { logPageView, logButtonClick, logAccess, getActionFailureResult } from '@/utils/accessLog.js'

const PAGE_LOG = { moduleCode: 'CUSTOMER_SERVICE', accessType: '客户服务', pageType: 'AI_CHAT', requestUri: '/pages/ai/chat', pageId: '' }
import { getSessionGeneration, getSessionToken, isCurrentSession, onSessionChanged } from '@/utils/session.js'
import { fetchAccountProfile } from '@/utils/account.js'
let pageSession = getSessionGeneration()
let pageToken = getSessionToken()
let pageActive = true
let chatRequestSequence = 0
let avatarRequestSequence = 0

import { computed, nextTick, ref, watch } from 'vue'
import { onLoad, onResize, onShow, onUnload } from '@dcloudio/uni-app'
import MarkdownMessage from '@/components/chat/MarkdownMessage.vue'
import { sendAiChatMessage } from '@/api/ai-chat.js'
import { getImageUrl } from '@/utils/config.js'
import { renderMarkdown } from '@/utils/markdown.js'
import {
  STORAGE_KEY_AI_CHAT_ID,
  STORAGE_KEY_AI_CHAT_MESSAGES
} from '@/utils/storage.js'

const serviceTags = ['就诊指引', '药品咨询', '常见问答']
const quickQuestions = [
  '如何查看处方和订单状态？',
  '线上复诊申请后多久能审核？',
  '如何修改收货地址或就诊人信息？',
  '购买药品后如何申请退款？'
]
const welcomeMessage = '您好，这里是辽宁中医智能客服。我可以协助您了解就诊流程、订单进度、药品说明和常见问题。'
const MAX_CONTEXT_MESSAGES = 12

const statusBarHeight = ref(24)
const navigationHeight = ref(44)
const navigationRightInset = ref(96)
const inputValue = ref('')
const isLoading = ref(false)
const chatId = ref('')
const messages = ref([])
const scrollIntoView = ref('')
const failedQuestion = ref('')
const userAvatar = ref('')

const hospitalLogo = computed(() => getImageUrl('/profile/liaoning_zongyi/zaixian_mingyi_logo.png'))
const canSend = computed(() => Boolean(inputValue.value.trim()) && !isLoading.value)
const showQuickQuestions = computed(() => !messages.value.some((item) => item.role === 'user'))
const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
// 会话编号只使用时间与随机值，不携带账户资料或页面表单身份。
const createChatId = () => `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
const isCurrentAccount = (session, token) => pageActive && isCurrentSession(session) && getSessionToken() === token

const formatTime = (timestamp) => {
  const date = new Date(timestamp || Date.now())
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

const createMessage = ({ role, content, status = 'sent', createdAt = Date.now() }) => {
  const messageContent = typeof content === 'string' ? content : String(content || '')
  return {
    id: generateMessageId(),
    role,
    content: messageContent,
    htmlContent: role === 'assistant' || role === 'system' ? renderMarkdown(messageContent) : '',
    status,
    createdAt
  }
}

const normalizeStoredMessages = (storedMessages) => {
  if (!Array.isArray(storedMessages)) {
    return []
  }

  return storedMessages
    .filter((item) => item && typeof item === 'object')
    .map((item) => createMessage({
      role: ['assistant', 'user', 'system'].includes(item.role) ? item.role : 'system',
      content: typeof item.content === 'string' ? item.content : '',
      status: ['sending', 'sent', 'error'].includes(item.status) ? item.status : 'sent',
      createdAt: item.createdAt || Date.now()
    }))
}

const buildRequestMessages = (content) => {
  const historyMessages = messages.value
    .filter((item) => ['assistant', 'user'].includes(item.role))
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((item) => ({
      role: item.role,
      content: item.content
    }))

  return [
    ...historyMessages,
    {
      role: 'user',
      content
    }
  ]
}

const saveChatState = () => {
  if (!isCurrentAccount(pageSession, pageToken)) return
  uni.setStorageSync(STORAGE_KEY_AI_CHAT_ID, chatId.value || '')
  uni.setStorageSync(STORAGE_KEY_AI_CHAT_MESSAGES, messages.value)
}

const scrollToBottom = () => {
  nextTick(() => {
    const lastMessage = messages.value[messages.value.length - 1]
    if (!lastMessage) {
      return
    }

    scrollIntoView.value = `message-${lastMessage.id}`
  })
}

const setMessages = (nextMessages) => {
  messages.value = nextMessages
  scrollToBottom()
}

const appendMessage = (message) => {
  setMessages([...messages.value, message])
}

const updateMessageStatus = (messageId, status) => {
  setMessages(
    messages.value.map((item) => (
      item.id === messageId
        ? {
            ...item,
            status
          }
        : item
    ))
  )
}

const resetConversation = () => {
  chatRequestSequence += 1
  isLoading.value = false
  failedQuestion.value = ''
  chatId.value = ''
  inputValue.value = ''
  setMessages([
    createMessage({
      role: 'system',
      content: welcomeMessage
    })
  ])
}

const syncAccountSession = () => {
  if (!pageActive) return false
  const token = getSessionToken()
  if (!isCurrentSession(pageSession) || pageToken !== token) {
    pageSession = getSessionGeneration()
    pageToken = token
    avatarRequestSequence += 1
    userAvatar.value = ''
    resetConversation()
  }
  return true
}

const loadAccountAvatar = async () => {
  const sequence = ++avatarRequestSequence
  const session = getSessionGeneration()
  const token = getSessionToken()
  userAvatar.value = ''
  if (!token) return
  try {
    // 头像来自正式账户 DTO；接口失败时使用页面默认头像，不回退本地资料。
    const profile = await fetchAccountProfile({ authRedirect: false })
    if (sequence !== avatarRequestSequence || !isCurrentAccount(session, token)) return
    userAvatar.value = profile.avatarUrl || ''
  } catch (error) {
    if (sequence !== avatarRequestSequence || !isCurrentAccount(session, token)) return
    uni.showToast({ title: '账户资料加载失败，头像暂不可用', icon: 'none' })
  }
}

const restoreConversation = () => {
  const storedChatId = uni.getStorageSync(STORAGE_KEY_AI_CHAT_ID) || ''
  const storedMessages = normalizeStoredMessages(uni.getStorageSync(STORAGE_KEY_AI_CHAT_MESSAGES) || [])

  chatId.value = storedChatId

  if (storedMessages.length > 0) {
    setMessages(storedMessages)
    return
  }

  resetConversation()
}

const resolveErrorMessage = (error) => {
  if (typeof error?.message === 'string' && error.message) {
    return error.message
  }

  return '发送失败，请检查网络或 FastGPT 配置后重试。'
}

const submitMessage = async (presetQuestion = '', entry = 'input') => {
  if (!syncAccountSession()) return
  const content = typeof presetQuestion === 'string' && presetQuestion
    ? presetQuestion.trim()
    : inputValue.value.trim()

  if (!content || isLoading.value) {
    return
  }

  const actionSession = getSessionGeneration()
  const actionToken = getSessionToken()
  const requestSequence = ++chatRequestSequence
  const isRequestCurrent = () => requestSequence === chatRequestSequence && isCurrentAccount(actionSession, actionToken)
  if (!chatId.value) chatId.value = createChatId()
  const actionLog = { ...PAGE_LOG, actionCode: 'SEND_AI_MESSAGE', accessTitle: '发送智能客服问题', accessDescription: '用户提交咨询问题并等待智能客服回复', extraData: { entry, chatId: chatId.value || '' } }
  logButtonClick(actionLog)
  failedQuestion.value = ''
  inputValue.value = ''
  uni.hideKeyboard()

  const requestMessages = buildRequestMessages(content)
  const userMessage = createMessage({
    role: 'user',
    content,
    status: 'sending'
  })

  appendMessage(userMessage)
  isLoading.value = true

  try {
    const result = await sendAiChatMessage({
      text: content,
      chatId: chatId.value,
      messages: requestMessages
    })

    if (!isRequestCurrent()) return
    logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: 'SUCCESS', accessTitle: '智能客服已返回回复', accessDescription: '本次咨询请求已返回回复结果，不记录问题和回复正文' })
    chatId.value = result.chatId || chatId.value
    updateMessageStatus(userMessage.id, 'sent')

    appendMessage(createMessage({
      role: 'assistant',
      content: result.content || '已收到您的问题，但当前没有返回可展示的回复。'
    }))
  } catch (error) {
    if (!isRequestCurrent()) return
    logAccess({ ...actionLog, actionType: 'BEHAVIOR', actionResult: getActionFailureResult(error), accessTitle: '智能客服回复未完成', accessDescription: '本次咨询未取得明确成功回复，可由用户重试', extraData: { ...actionLog.extraData, reason: 'chat_incomplete' } })
    failedQuestion.value = content
    updateMessageStatus(userMessage.id, 'error')

    appendMessage(createMessage({
      role: 'system',
      content: resolveErrorMessage(error),
      status: 'error'
    }))
  } finally {
    if (isRequestCurrent()) isLoading.value = false
  }
}

const retryLastMessage = () => {
  if (!failedQuestion.value || isLoading.value) {
    return
  }

  submitMessage(failedQuestion.value, 'retry')
}

const handleQuickQuestion = (question) => {
  submitMessage(question, 'quick_question')
}

const copyMessage = (content) => {
  if (!content) {
    return
  }

  uni.setClipboardData({
    data: content,
    success: () => {
      uni.showToast({
        title: '已复制',
        icon: 'success'
      })
    }
  })
}

const handleStartNewChat = () => {
  if (!syncAccountSession()) return
  const actionSession = getSessionGeneration()
  const actionToken = getSessionToken()
  logButtonClick({ ...PAGE_LOG, actionCode: 'START_NEW_AI_CHAT', accessTitle: '开启新客服会话', accessDescription: '用户请求结束当前本地会话并开始新会话' })
  const hasConversation = messages.value.some((item) => item.role === 'user' || item.role === 'assistant')
  if (!hasConversation) {
    resetConversation()
    logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'START_NEW_AI_CHAT', actionResult: 'SUCCESS', accessTitle: '已开启新客服会话', accessDescription: '本地会话已重置，准备开始新的咨询' })
    return
  }

  uni.showModal({
    title: '开启新对话',
    content: '当前会话记录将被清空，是否继续？',
    success: (res) => {
      if (!isCurrentAccount(actionSession, actionToken)) return
      if (!res.confirm) {
        logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'START_NEW_AI_CHAT', actionResult: 'CANCELLED', accessTitle: '取消新建客服会话', accessDescription: '用户保留当前会话，不清空本地消息' })
        return
      }

      resetConversation()
      logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'START_NEW_AI_CHAT', actionResult: 'SUCCESS', accessTitle: '已开启新客服会话', accessDescription: '用户确认清空本地会话，准备开始新的咨询' })
      uni.showToast({
        title: '已开启新对话',
        icon: 'none'
      })
    }
  })
}

const goBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
    return
  }

  uni.reLaunch({
    url: '/pages/index/index'
  })
}

const updateHeaderLayout = () => {
  let windowInfo = {}
  try {
    windowInfo = uni.getWindowInfo?.() || {}
  } catch (error) {
    // 旧基础库或非微信环境继续使用兼容接口。
  }
  if (!Number.isFinite(windowInfo.statusBarHeight)) {
    try {
      windowInfo = uni.getSystemInfoSync?.() || windowInfo
    } catch (error) {
      // 无法测量时保留安全回退值，不阻断聊天记录恢复。
    }
  }
  statusBarHeight.value = Number.isFinite(windowInfo.statusBarHeight) && windowInfo.statusBarHeight >= 0
    ? windowInfo.statusBarHeight : 24
  navigationHeight.value = 44
  navigationRightInset.value = 96
  try {
    const capsule = uni.getMenuButtonBoundingClientRect?.()
    if (Number.isFinite(capsule?.bottom) && capsule.bottom > statusBarHeight.value) {
      // 新对话位于下一行，确保这一行从胶囊底边至少 8px 之后开始。
      navigationHeight.value = Math.max(44, capsule.bottom - statusBarHeight.value + 8)
    }
    const width = windowInfo.windowWidth || windowInfo.screenWidth
    if (Number.isFinite(width) && capsule?.left > 0 && capsule.left < width) {
      navigationRightInset.value = width - capsule.left + 8
    }
  } catch (error) {
    // 胶囊测量不可用时使用标准导航高度和右侧预留空间。
  }
}

watch(chatId, saveChatState)
watch(messages, saveChatState, { deep: true })

// 账号切换时立即清空页面上下文；旧请求即使成功也不能写进新账号会话。
const unsubscribeSessionChanged = onSessionChanged(() => {
  avatarRequestSequence += 1
  userAvatar.value = ''
  resetConversation()
})

onLoad(() => {
  updateHeaderLayout()
  restoreConversation()
})
onShow(async () => {
  if (!syncAccountSession()) return
  logPageView({ ...PAGE_LOG, actionCode: 'VIEW_PAGE', accessTitle: '访问智能客服', accessDescription: '进入智能客服会话，查看消息并准备咨询' })
  await loadAccountAvatar()
})

onUnload(() => {
  pageActive = false
  chatRequestSequence += 1
  avatarRequestSequence += 1
  unsubscribeSessionChanged()
})

onResize(updateHeaderLayout)
</script>

<style scoped>
page {
  background: #f5f7fb;
}

.chat-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #f7fbff 0%, #f5f7fb 30%, #f5f7fb 100%);
  overflow: hidden;
}

.safe-top {
  flex-shrink: 0;
}

.page-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
  min-width: 0;
  padding-left: 8px;
  box-sizing: border-box;
}

.back-button {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.new-chat-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  flex-shrink: 0;
  min-height: 64rpx;
  margin: 0;
  padding: 14rpx 18rpx;
  background: #eef5ff;
  border: 1rpx solid #dceaff;
  border-radius: 16rpx;
  color: #2f6fb3;
  font-size: 24rpx;
  line-height: 1.3;
  font-weight: 600;
}

.new-chat-button::after {
  border: none;
}

.new-chat-button:active {
  background: #e0edfc;
}

.header-title {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  text-align: center;
  pointer-events: none;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 32rpx;
  color: #163450;
  font-weight: 600;
}

.conversation-toolbar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-shrink: 0;
  margin: 8rpx 24rpx 0;
  padding: 20rpx 22rpx;
  background: #ffffff;
  border: 1rpx solid #e5edf6;
  border-radius: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(17, 57, 95, 0.04);
  box-sizing: border-box;
}

.service-identity {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex: 1;
  min-width: 0;
}

.service-logo {
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  background: #e3edf6;
  flex-shrink: 0;
}

.service-info {
  flex: 1;
  min-width: 0;
}

.service-status {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 6rpx;
  color: #7c91a8;
  font-size: 22rpx;
  line-height: 1.4;
}

.service-name {
  display: block;
  font-size: 28rpx;
  color: #163450;
  font-weight: 600;
  line-height: 1.5;
  word-break: break-word;
}

.status-dot {
  width: 10rpx;
  height: 10rpx;
  flex-shrink: 0;
  border-radius: 50%;
  background: #50a77c;
}

.service-tags {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.service-tag {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: #eaf1f9;
  color: #64809a;
  font-size: 22rpx;
}

.message-list {
  flex: 1;
  height: 0;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.message-content {
  padding: 28rpx 24rpx 32rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.message-row {
  display: flex;
  align-items: flex-start;
  width: 100%;
  margin-bottom: 28rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.message-row.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 20rpx;
  flex-shrink: 0;
}

.assistant-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2f6fb3 0%, #5a9cde 100%);
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 700;
}

.user-avatar {
  background: #dbe8f6;
}

.fallback-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2f6fb3;
  font-size: 28rpx;
  font-weight: 700;
}

.message-main {
  flex: 1;
  min-width: 0;
  max-width: none;
  margin: 0 14rpx;
}

.message-main.user {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.bubble {
  display: block;
  width: fit-content;
  max-width: 100%;
  padding: 20rpx 22rpx;
  border-radius: 22rpx;
  box-sizing: border-box;
  overflow: hidden;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.bubble.assistant,
.bubble.system {
  background: #ffffff;
  border: 1rpx solid #e4ebf3;
  box-shadow: 0 4rpx 14rpx rgba(28, 68, 107, 0.04);
  border-top-left-radius: 10rpx;
}

.bubble.system.is-error {
  background: #fff8e8;
  border: 1px solid #f3d88c;
  border-top-left-radius: 10rpx;
}

.bubble.user {
  background: linear-gradient(135deg, #4c8fd7 0%, #6fa9e1 100%);
  color: #ffffff;
  border-top-right-radius: 10rpx;
  box-shadow: 0 10rpx 26rpx rgba(55, 108, 168, 0.2);
}

.user-text {
  display: block;
  max-width: 100%;
  color: #ffffff;
  font-size: 28rpx;
  line-height: 1.7;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #86a0b7;
}

.message-main.user .message-meta {
  justify-content: flex-end;
}

.message-status.error {
  color: #cf4e4e;
}

.message-actions {
  margin-top: 10rpx;
}

.retry-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10rpx 18rpx;
  background: rgba(47, 111, 179, 0.08);
  color: #2f6fb3;
  border-radius: 999rpx;
  font-size: 24rpx;
}

.loading-bubble {
  min-width: 112rpx;
}

.loading-dots {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #7ea6ca;
  animation: dot-bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) {
  animation-delay: -0.32s;
}

.dot:nth-child(2) {
  animation-delay: -0.16s;
}

.quick-section {
  margin-top: 36rpx;
  box-sizing: border-box;
}

.quick-title {
  display: block;
  margin-bottom: 20rpx;
  color: #526d87;
  font-size: 26rpx;
  font-weight: 600;
}

.quick-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.quick-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  min-height: 100rpx;
  min-width: 0;
  padding: 20rpx;
  flex: 1 1 calc(50% - 8rpx);
  box-sizing: border-box;
  background: #ffffff;
  border: 1rpx solid #e4ebf3;
  border-radius: 18rpx;
  color: #274461;
  font-size: 24rpx;
  line-height: 1.6;
}

.quick-item:active {
  background: #eef5ff;
}

.input-panel {
  flex-shrink: 0;
  padding: 18rpx 24rpx calc(env(safe-area-inset-bottom) + 18rpx);
  background: #ffffff;
  border-top: 1px solid rgba(116, 145, 173, 0.12);
  box-shadow: 0 -8rpx 30rpx rgba(18, 58, 97, 0.04);
  box-sizing: border-box;
}

.input-shell {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 10rpx 10rpx 10rpx 24rpx;
  background: #f3f6fa;
  border: 1rpx solid #e6ecf3;
  border-radius: 24rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.message-input {
  flex: 1;
  min-width: 0;
  height: 64rpx;
  font-size: 28rpx;
  color: #163450;
}

.send-button {
  width: 104rpx;
  height: 64rpx;
  flex-shrink: 0;
  line-height: 64rpx;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 18rpx;
  background: #d8e6f5;
  color: #8aa3bc;
  font-size: 26rpx;
  font-weight: 600;
}

.send-button::after {
  border: none;
}

.send-button.active {
  background: linear-gradient(135deg, #2f6fb3 0%, #5b9ee0 100%);
  color: #ffffff;
}

.input-tip {
  display: block;
  margin-top: 12rpx;
  color: #8ba2b7;
  font-size: 20rpx;
  line-height: 1.5;
  text-align: center;
}

@keyframes dot-bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }

  40% {
    transform: scale(1);
  }
}
</style>
