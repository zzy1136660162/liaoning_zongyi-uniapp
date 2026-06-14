import { CUSTOMER_SERVICE_CONFIG } from './config.js'

export const buildCustomerServiceChatOptions = (config = CUSTOMER_SERVICE_CONFIG) => ({
  extInfo: {
    url: config.url
  },
  corpId: config.corpId
})

export const openCustomerServiceChat = (options = {}) => {
  const {
    config = CUSTOMER_SERVICE_CONFIG,
    failTitle = CUSTOMER_SERVICE_CONFIG.unavailableMessage || '人工客服暂时不可用'
  } = options

  if (!config?.corpId || !config?.url) {
    uni.showToast({
      title: failTitle,
      icon: 'none'
    })
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    uni.openCustomerServiceChat({
      ...buildCustomerServiceChatOptions(config),
      success: (res) => {
        console.log('打开企业微信客服成功:', res)
        resolve(res)
      },
      fail: (error) => {
        console.error('打开企业微信客服失败:', error)
        uni.showToast({
          title: failTitle,
          icon: 'none'
        })
        resolve(false)
      }
    })
  })
}
