export const FASTGPT_CHAT_URL = 'https://www.yuntuoengine.com/fast-agent/api/v1/chat/completions'
export const FASTGPT_API_KEY = 'fastgpt-fIX1VkMqSRh5bjQR65rzuHGZzxJw52vB5YhSpB5gn2Mus9SYSfnK0RquZOTV9'
export const FASTGPT_TIMEOUT = 30000
export const FASTGPT_STREAM = false

export const getFastgptChatUrl = () => FASTGPT_CHAT_URL.trim()

export const isFastgptConfigured = () => {
  const hasChatUrl = Boolean(FASTGPT_CHAT_URL) && /^https?:\/\//.test(FASTGPT_CHAT_URL.trim())
  const hasApiKey = Boolean(FASTGPT_API_KEY) && !FASTGPT_API_KEY.includes('REPLACE_WITH_FASTGPT_APP_KEY')
  return hasChatUrl && hasApiKey
}
