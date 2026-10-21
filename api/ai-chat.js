import { getSessionGeneration, getSessionToken, isCurrentSession, sessionChangedError } from '../utils/session.js'
import { fetchAccountProfile } from '../utils/account.js'
import {
  FASTGPT_API_KEY,
  FASTGPT_STREAM,
  FASTGPT_TIMEOUT,
  getFastgptChatUrl,
  isFastgptConfigured
} from '@/utils/ai-chat-config.js'

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

export const sendAiChatMessage = async ({ text, chatId = '', messages = [] } = {}) => {
  const session = getSessionGeneration()
  const token = getSessionToken()
  const isRequestCurrent = () => isCurrentSession(session) && getSessionToken() === token
  const content = typeof text === 'string' ? text.trim() : ''
  const requestMessages = normalizeRequestMessages(messages, content)

  if (!content && requestMessages.length === 0) {
    throw new Error('消息内容不能为空')
  }

  if (!isFastgptConfigured()) {
    throw new Error('请先在 utils/ai-chat-config.js 中配置 FastGPT 地址和 API Key')
  }

  // 登录身份只取正式账户 DTO；页面输入、微信身份及本地资料不能覆盖发送者。
  const profile = token ? await fetchAccountProfile({ authRedirect: false }) : null
  if (!isRequestCurrent()) throw sessionChangedError()

  const payload = {
    stream: FASTGPT_STREAM,
    detail: false,
    customUid: profile ? String(profile.id) : 'guest',
    variables: {
      userId: profile?.id || '',
      userName: profile?.userName || '',
      phone: profile?.phone || ''
    },
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
        if (!isRequestCurrent()) { reject(sessionChangedError()); return }
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
        if (!isRequestCurrent()) { reject(sessionChangedError()); return }
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
