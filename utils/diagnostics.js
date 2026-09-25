// Diagnostics never accepts request/response bodies, credentials or raw error messages.
export const createTraceId = () =>
  'client_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12)

const safeWord = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : 'unknown'
const safeNumber = value => typeof value === 'number' && Number.isFinite(value) ? value : 0
// Only fixed route words may appear in logs; dynamic segments and query values are never logged.
const routeWords = new Set(('api auth wechat login login-by-openid logout send-sms openid phone payment single combine ' +
  'create-by-order sync-by-order notify refund-notify refund apply cancel detail list audit revoke internal admin ' +
  'orders order patients user profile consultation consultations prescriptions prescription redeem vouchers manual ' +
  'confirm complete delivery logistics status access-log categories products').split(' '))
export const diagnosticRoute = url => {
  const path = typeof url === 'string' ? url.split(/[?#]/, 1)[0] : ''
  if (!path.startsWith('/api/')) return 'other'
  return path.split('/').slice(0, 9).map(part => !part ? '' : routeWords.has(part) ? part : ':value').join('/')
}

const writeRequestDiagnostic = ({ traceId, url, method, httpStatus, businessCode, durationMs, reason, stale }) => {
  const route = diagnosticRoute(url)
  const http = safeNumber(httpStatus)
  const code = safeNumber(businessCode)
  const failed = Boolean(reason) || http >= 400 || code >= 400
  const line = '[diagnostic] event=http_request traceId=' + safeWord(traceId) +
    ' method=' + safeWord(method) + ' route=' + route + ' httpStatus=' + http +
    ' businessCode=' + code + ' result=' + (failed ? 'failed' : 'completed') +
    ' reason=' + (reason ? safeWord(reason) : 'none') + ' staleSession=' + Boolean(stale) +
    ' durationMs=' + safeNumber(durationMs)
  if (failed) console.warn(line)
  else if (/auth|payment|refund|orders|consultation|prescription|redeem/.test(route)) console.info(line)
}

const writePaymentDiagnostic = (event, orderId, reason = 'none') => {
  const line = '[diagnostic] event=' + safeWord(event) + ' orderId=' + safeNumber(Number(orderId)) +
    ' reason=' + safeWord(reason)
  if (reason === 'none') console.info(line)
  else console.warn(line)
}

// Diagnostics is best effort: an unavailable console must never interrupt a payment or HTTP promise.
export const logRequestDiagnostic = fields => {
  try { writeRequestDiagnostic(fields) } catch (_) { /* Keep the original request behavior. */ }
}
export const logPaymentDiagnostic = (event, orderId, reason) => {
  try { writePaymentDiagnostic(event, orderId, reason) } catch (_) { /* Keep the original payment behavior. */ }
}
