import { endSession, getSessionGeneration, getSessionToken, isCurrentSession, onSessionChanged } from './session.js'

let redirectTimer
let promptedGeneration
onSessionChanged(() => {
  clearTimeout(redirectTimer)
  redirectTimer = undefined
  promptedGeneration = undefined
})

// Called only for our API's 401. Optional authentication/third-party failures never invalidate a login.
export const handleAuthenticationFailure = ({ generation, token, required, redirect = true, message }) => {
  const error = Object.assign(new Error(message || '登录已失效，请重新登录'), { code: 401, invalidated: false })
  if (!required || !isCurrentSession(generation) || token !== getSessionToken()) return error
  if (token) {
    endSession({ explicit: false })
    error.invalidated = true
  }
  const current = getSessionGeneration()
  error.sessionGeneration = current
  if (redirect && promptedGeneration !== current) {
    promptedGeneration = current
    uni.showToast({ title: error.message, icon: 'none', duration: 2000 })
    redirectTimer = setTimeout(() => {
      if (isCurrentSession(current) && !getSessionToken()) uni.reLaunch({ url: '/pages/register/register' })
    }, 2000)
  }
  return error
}
