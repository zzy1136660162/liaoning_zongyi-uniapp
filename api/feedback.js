import { post } from '@/utils/request.js'

export const submitFeedback = (content, requestId) => post('/api/feedback', { content, requestId }, {
  showLoading: false,
  silent: true,
  authRedirect: false
})
