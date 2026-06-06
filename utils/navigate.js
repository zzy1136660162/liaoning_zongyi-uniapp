/**
 * 安全页面跳转（缓解「Page has not been registered yet」）
 */

const normalizePagePath = (url = '') => {
  const raw = String(url || '').trim()
  if (!raw) {
    return ''
  }
  const withoutQuery = raw.split('?')[0]
  return withoutQuery.startsWith('/') ? withoutQuery.slice(1) : withoutQuery
}

const isPageRegistered = (pagePath) => {
  if (!pagePath) {
    return false
  }

  try {
    const config = typeof __uniConfig !== 'undefined' ? __uniConfig : null
    if (!config) {
      return true
    }

    const mainPages = Array.isArray(config.pages) ? config.pages : []
    if (mainPages.some((item) => item.path === pagePath || item === pagePath)) {
      return true
    }

    const subPackages = Array.isArray(config.subPackages) ? config.subPackages : []
    return subPackages.some((pkg) => {
      const root = pkg.root || ''
      const pages = Array.isArray(pkg.pages) ? pkg.pages : []
      return pages.some((item) => {
        const subPath = item.path || ''
        return `${root}/${subPath}` === pagePath
      })
    })
  } catch (error) {
    console.warn('[navigate] isPageRegistered check failed', error)
    return true
  }
}

const runNavigate = (method, url, options = {}) => {
  const pagePath = normalizePagePath(url)
  if (!isPageRegistered(pagePath)) {
    const message = `页面未注册: ${pagePath}，请重新编译小程序`
    console.error('[navigate]', message, { url, method })
    uni.showToast({ title: '页面加载中，请稍后重试', icon: 'none' })
    return Promise.reject(new Error(message))
  }

  return new Promise((resolve, reject) => {
    uni[method]({
      url,
      ...options,
      success: resolve,
      fail: (error) => {
        console.error(`[navigate] ${method} failed`, { url, error })
        reject(error)
      }
    })
  })
}

export const safeRedirectTo = (url) => runNavigate('redirectTo', url)

export const safeNavigateTo = (url) => runNavigate('navigateTo', url)

export const safeReLaunch = (url) => runNavigate('reLaunch', url)

/**
 * redirectTo 失败时降级 reLaunch（冷启动/页面栈异常时常见）
 */
export const redirectToWithFallback = async (url) => {
  try {
    await safeRedirectTo(url)
  } catch (error) {
    console.warn('[navigate] redirectTo fallback to reLaunch', url, error)
    await safeReLaunch(url)
  }
}
