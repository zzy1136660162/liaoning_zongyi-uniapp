import { BASE_URL, API_PATHS } from '../utils/config.js'
import { createTraceId } from '../utils/diagnostics.js'

// Deliberately isolated from ordinary request session guards: revoke ONLY the captured old credential.
export const logout = async token => {
  if (!token) return { confirmed: true, attempts: 0 }
  for (let attempt = 1; attempt <= 2; attempt++) {
    const outcome = await new Promise(resolve => {
      uni.request({
        url: BASE_URL + API_PATHS.AUTH.LOGOUT, method: 'POST', data: {}, timeout: 5000,
        header: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Request-Id': createTraceId() },
        success: res => {
          const code = Number(res.data?.code)
          const confirmed = (res.statusCode === 200 && code === 200) || res.statusCode === 401 || code === 401
          resolve({ confirmed, retry: !confirmed && (res.statusCode >= 500 || code >= 500) })
        },
        fail: () => resolve({ confirmed: false, retry: true })
      })
    })
    console.info('event=logout_revoke attempt=%s result=%s', attempt, outcome.confirmed ? 'confirmed' : 'unconfirmed')
    if (outcome.confirmed || !outcome.retry || attempt === 2) return { confirmed: outcome.confirmed, attempts: attempt }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}
