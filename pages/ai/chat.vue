<template>
  <view class="chat-page">
    <view
      class="safe-top"
      :style="{ height: `${statusBarHeight}px` }"
    />

    <view class="page-header">
      <view
        class="header-side back-button"
        @tap="goBack"
      >
        <uni-icons
          type="left"
          size="20"
          color="#163450"
        />
      </view>
      <text class="header-title">
        智能客服
      </text>
      <view
        class="header-side new-chat-button"
        @tap="handleStartNewChat"
      >
        新对话
      </view>
    </view>

    <view class="service-card">
      <view class="service-card-top">
        <image
          class="service-logo"
          :src="hospitalLogo"
          mode="aspectFill"
        />
        <view class="service-info">
          <view class="service-name-row">
            <text class="service-name">
              辽宁中医智能客服
            </text>
            <view class="service-badge">
              在线
            </view>
          </view>
          <text class="service-desc">
            提供就诊指引、药品咨询与常见问题解答
          </text>
        </view>
      </view>
      <view class="service-tags">
        <view
          v-for="item in serviceTags"
          :key="item"
          class="service-tag"
        >
          {{ item }}
        </view>
      </view>
    </view>

    <scroll-view
      class="message-list"
      scroll-y
      :scroll-into-view="scrollIntoView"
      scroll-with-animation
    >
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
            :class="item.role"
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
    </scroll-view>

    <view
      v-if="showQuickQuestions"
      class="quick-section"
    >
      <text class="quick-title">
        常见问题
      </text>
      <view class="quick-list">
        <view
          v-for="question in quickQuestions"
          :key="question"
          class="quick-item"
          @tap="handleQuickQuestion(question)"
        >
          {{ question }}
        </view>
      </view>
    </view>

    <view class="input-panel">
      <view class="input-shell">
        <input
          v-model="inputValue"
          class="message-input"
          :disabled="isLoading"
          maxlength="-1"
          confirm-type="send"
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
import { computed, nextTick, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import MarkdownMessage from '@/components/chat/MarkdownMessage.vue'
import { sendAiChatMessage } from '@/api/ai-chat.js'
import { getImageUrl } from '@/utils/config.js'
import { renderMarkdown } from '@/utils/markdown.js'
import {
  STORAGE_KEY_AI_CHAT_ID,
  STORAGE_KEY_AI_CHAT_MESSAGES,
  STORAGE_KEY_USER_INFO,
  STORAGE_KEY_USER_REGISTER,
  STORAGE_KEY_WECHAT_OPENID
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

const statusBarHeight = ref(0)
const inputValue = ref('')
const isLoading = ref(false)
const chatId = ref('')
const messages = ref([])
const scrollIntoView = ref('')
const failedQuestion = ref('')

const hospitalLogo = computed(() => getImageUrl('/profile/liaoning_zongyi/zaixian_mingyi_logo.png'))
const canSend = computed(() => Boolean(inputValue.value.trim()) && !isLoading.value)
const showQuickQuestions = computed(() => !messages.value.some((item) => item.role === 'user'))
const userAvatar = computed(() => {
  const userInfo = uni.getStorageSync(STORAGE_KEY_USER_INFO) || {}
  return userInfo.avatarUrl || ''
})

const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

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

const loadCurrentUserInfo = () => {
  const userInfo = uni.getStorageSync(STORAGE_KEY_USER_INFO) || {}
  const registerInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER) || {}
  const openid = uni.getStorageSync(STORAGE_KEY_WECHAT_OPENID) || userInfo.openid || ''

  return {
    userId: userInfo.userId || registerInfo.userId || '',
    userName: userInfo.userName || registerInfo.realName || '',
    phone: userInfo.phone || registerInfo.phone || '',
    openid
  }
}

const saveChatState = () => {
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

const submitMessage = async (presetQuestion = '') => {
  const content = typeof presetQuestion === 'string' && presetQuestion
    ? presetQuestion.trim()
    : inputValue.value.trim()

  if (!content || isLoading.value) {
    return
  }

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
      userInfo: loadCurrentUserInfo(),
      messages: requestMessages
    })

    chatId.value = result.chatId || chatId.value
    updateMessageStatus(userMessage.id, 'sent')

    appendMessage(createMessage({
      role: 'assistant',
      content: result.content || '已收到您的问题，但当前没有返回可展示的回复。'
    }))
  } catch (error) {
    failedQuestion.value = content
    updateMessageStatus(userMessage.id, 'error')

    appendMessage(createMessage({
      role: 'system',
      content: resolveErrorMessage(error),
      status: 'error'
    }))
  } finally {
    isLoading.value = false
  }
}

const retryLastMessage = () => {
  if (!failedQuestion.value || isLoading.value) {
    return
  }

  submitMessage(failedQuestion.value)
}

const handleQuickQuestion = (question) => {
  submitMessage(question)
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
  const hasConversation = messages.value.some((item) => item.role === 'user' || item.role === 'assistant')
  if (!hasConversation) {
    resetConversation()
    return
  }

  uni.showModal({
    title: '开启新对话',
    content: '当前会话记录将被清空，是否继续？',
    success: (res) => {
      if (!res.confirm) {
        return
      }

      resetConversation()
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

watch(chatId, saveChatState)
watch(messages, saveChatState, { deep: true })

onLoad(() => {
  statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 0
  restoreConversation()
})
</script>

<style scoped>
page {
  background: #edf3f8;
}

.chat-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #f6fbff 0%, #edf3f8 34%, #edf3f8 100%);
  overflow: hidden;
}

.safe-top {
  flex-shrink: 0;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28rpx 18rpx;
  background: transparent;
  box-sizing: border-box;
}

.header-side {
  min-width: 120rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
}

.back-button {
  justify-content: flex-start;
}

.new-chat-button {
  justify-content: flex-end;
  color: #2f6fb3;
  font-size: 26rpx;
  font-weight: 600;
}

.header-title {
  font-size: 34rpx;
  color: #163450;
  font-weight: 700;
}

.service-card {
  margin: 0 24rpx 20rpx;
  padding: 24rpx;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(92, 135, 177, 0.12);
  border-radius: 20rpx;
  box-shadow: 0 12rpx 32rpx rgba(17, 57, 95, 0.08);
  box-sizing: border-box;
  overflow: hidden;
}

.service-card-top {
  display: flex;
  align-items: center;
}

.service-logo {
  width: 96rpx;
  height: 96rpx;
  border-radius: 28rpx;
  background: #e3edf6;
  flex-shrink: 0;
}

.service-info {
  flex: 1;
  margin-left: 20rpx;
  min-width: 0;
}

.service-name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}

.service-name {
  font-size: 30rpx;
  color: #163450;
  font-weight: 700;
}

.service-badge {
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(60, 146, 90, 0.12);
  color: #2f8f4f;
  font-size: 22rpx;
  line-height: 1;
}

.service-desc {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #5b7690;
  line-height: 1.6;
  word-break: break-word;
}

.service-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 20rpx;
}

.service-tag {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #f1f6fb;
  color: #44627e;
  font-size: 22rpx;
}

.message-list {
  flex: 1;
  min-height: 0;
  padding: 0 24rpx 20rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.message-row {
  display: flex;
  align-items: flex-start;
  width: 100%;
  margin-bottom: 24rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.message-row.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 24rpx;
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
  margin: 0 16rpx;
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

.bubble.assistant {
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(90, 126, 160, 0.12);
  box-shadow: 0 10rpx 26rpx rgba(28, 68, 107, 0.08);
  border-top-left-radius: 10rpx;
}

.bubble.system {
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
  padding: 0 24rpx 18rpx;
  box-sizing: border-box;
}

.quick-title {
  display: block;
  margin-bottom: 14rpx;
  color: #526d87;
  font-size: 24rpx;
}

.quick-list {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.quick-item {
  min-height: 78rpx;
  min-width: 0;
  padding: 18rpx 20rpx;
  flex: 1 1 calc(50% - 7rpx);
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(90, 126, 160, 0.12);
  border-radius: 18rpx;
  color: #274461;
  font-size: 26rpx;
  line-height: 1.6;
}

.input-panel {
  padding: 18rpx 24rpx calc(env(safe-area-inset-bottom) + 18rpx);
  background: rgba(248, 251, 255, 0.98);
  border-top: 1px solid rgba(116, 145, 173, 0.12);
  box-shadow: 0 -8rpx 30rpx rgba(18, 58, 97, 0.04);
  box-sizing: border-box;
}

.input-shell {
  display: flex;
  align-items: center;
  padding: 10rpx 10rpx 10rpx 22rpx;
  background: #ffffff;
  border: 1px solid rgba(116, 145, 173, 0.18);
  border-radius: 24rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.message-input {
  flex: 1;
  min-width: 0;
  height: 72rpx;
  font-size: 28rpx;
  color: #163450;
}

.send-button {
  width: 136rpx;
  height: 72rpx;
  line-height: 72rpx;
  margin: 0;
  border: none;
  border-radius: 18rpx;
  background: #d8e6f5;
  color: #8aa3bc;
  font-size: 28rpx;
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
  font-size: 22rpx;
  line-height: 1.5;
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
