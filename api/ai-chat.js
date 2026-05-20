import {
  FASTGPT_API_KEY,
  FASTGPT_STREAM,
  FASTGPT_TIMEOUT,
  getFastgptChatUrl,
  isFastgptConfigured
} from '@/utils/ai-chat-config.js'
import {
  STORAGE_KEY_USER_INFO,
  STORAGE_KEY_USER_REGISTER,
  STORAGE_KEY_WECHAT_OPENID
} from '@/utils/storage.js'

const getStoredUserContext = () => {
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

const getCustomUid = (userInfo = {}) => userInfo.userId || userInfo.openid || userInfo.phone || 'guest'

const buildVariables = (userInfo = {}) => ({
  userId: userInfo.userId || '',
  userName: userInfo.userName || '',
  phone: userInfo.phone || ''
})

const normalizeRequestMessages = (messages = [], fallbackContent = '') => {
  if (Array.isArray(messages) && messages.length > 0) {
    return messages
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null
        }

        const role = ['system', 'assistant', 'user'].includes(item.role) ? item.role : ''
        const content = typeof item.content === 'string' ? item.content.trim() : ''

        if (!role || !content) {
          return null
        }

        return { role, content }
      })
      .filter(Boolean)
  }

  if (!fallbackContent) {
    return []
  }

  return [
    {
      role: 'user',
      content: fallbackContent
    }
  ]
}

const normalizeReplyContent = (content) => {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item
        }

        if (item && typeof item === 'object') {
          if (typeof item.text === 'string') {
            return item.text
          }

          if (typeof item.content === 'string') {
            return item.content
          }
        }

        return ''
      })
      .filter(Boolean)
      .join('\n')
  }

  if (content == null) {
    return ''
  }

  return String(content)
}

export const sendAiChatMessage = ({ text, chatId = '', userInfo = {}, messages = [] } = {}) => {
  const content = typeof text === 'string' ? text.trim() : ''
  const requestMessages = normalizeRequestMessages(messages, content)

  if (!content && requestMessages.length === 0) {
    return Promise.reject(new Error('消息内容不能为空'))
  }

  if (!isFastgptConfigured()) {
    return Promise.reject(new Error('请先在 utils/ai-chat-config.js 中配置 FastGPT 地址和 API Key'))
  }

  const mergedUserInfo = {
    ...getStoredUserContext(),
    ...userInfo
  }

  const payload = {
    stream: FASTGPT_STREAM,
    detail: false,
    customUid: getCustomUid(mergedUserInfo),
    variables: buildVariables(mergedUserInfo),
    messages: requestMessages
  }

  if (chatId) {
    payload.chatId = chatId
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: getFastgptChatUrl(),
      method: 'POST',
      timeout: FASTGPT_TIMEOUT,
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FASTGPT_API_KEY}`
      },
      data: payload,
      success: (response) => {
        const { statusCode, data } = response

        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`FastGPT 请求失败(${statusCode})`))
          return
        }

        if (!data || typeof data !== 'object') {
          reject(new Error('FastGPT 返回数据格式异常'))
          return
        }

        resolve({
          content: normalizeReplyContent(data?.choices?.[0]?.message?.content),
          chatId: data.chatId || data.id || chatId || '',
          raw: data
        })
      },
      fail: (error) => {
        const errorMessage = error?.errMsg || ''
        if (errorMessage.includes('timeout')) {
          reject(new Error('请求超时，请稍后重试'))
          return
        }

        reject(new Error('网络连接失败，请检查网络后重试'))
      }
    })
  })
}
