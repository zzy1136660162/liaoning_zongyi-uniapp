/**
 * 全局页面访问自动追踪
 */

import { logPageView } from '@/utils/accessLog.js'
import {
  buildPageQueryString,
  extractPageIdFromOptions,
  resolveRouteMeta
} from '@/utils/page-route-meta.js'

const AUTO_TRACK_DEDUP_MS = 1500
const lastAutoTrackMap = new Map()

const getCurrentPageContext = () => {
  try {
    const pages = getCurrentPages()
    if (!pages || !pages.length) {
      return null
    }
    const currentPage = pages[pages.length - 1]
    const route = currentPage?.route || ''
    const options = currentPage?.options || {}
    const referer = pages.length > 1 ? (pages[pages.length - 2]?.route || '') : ''
    return { route, options, referer }
  } catch (error) {
    console.warn('[page-tracker] getCurrentPageContext failed', error)
    return null
  }
}

const shouldSkipAutoTrack = (dedupKey) => {
  const now = Date.now()
  const lastAt = lastAutoTrackMap.get(dedupKey)
  if (lastAt && now - lastAt < AUTO_TRACK_DEDUP_MS) {
    return true
  }
  lastAutoTrackMap.set(dedupKey, now)

  if (lastAutoTrackMap.size > 200) {
    const expiredBefore = now - AUTO_TRACK_DEDUP_MS * 20
    lastAutoTrackMap.forEach((time, key) => {
      if (time < expiredBefore) {
        lastAutoTrackMap.delete(key)
      }
    })
  }
  return false
}

/**
 * 自动记录当前页面访问（在 global mixin onShow 中调用）
 */
export const trackCurrentPageVisit = () => {
  const context = getCurrentPageContext()
  if (!context || !context.route) {
    return
  }

  const { route, options, referer } = context
  const meta = resolveRouteMeta(route)
  const pageId = extractPageIdFromOptions(options)
  const query = buildPageQueryString(options)
  const dedupKey = `PAGE_VIEW:${route}:${query}:${pageId}`

  if (shouldSkipAutoTrack(dedupKey)) {
    return
  }

  logPageView(meta.pageType, pageId, {
    accessTitle: meta.title,
    route,
    query,
    refererRoute: referer,
    source: 'auto_page_tracker'
  })
}
