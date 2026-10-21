// 一个页面实例只保留一个延迟返回任务；隐藏/卸载后不恢复旧任务。
export const createPageReturn = (isSessionCurrent, {
  getPages = () => getCurrentPages(),
  setTimer = setTimeout,
  clearTimer = clearTimeout
} = {}) => {
  let owner = null
  let timer = null
  let sequence = 0
  let visible = true
  let disposed = false

  const topPage = () => {
    try {
      const pages = getPages()
      return pages[pages.length - 1] || null
    } catch (_) {
      return null
    }
  }
  const cancel = () => {
    sequence++
    if (timer !== null) clearTimer(timer)
    timer = null
  }
  const bind = () => {
    if (!disposed && !owner) owner = topPage()
  }
  const isCurrent = () => !disposed && visible && owner !== null &&
    isSessionCurrent() && topPage() === owner

  return {
    // 在 onLoad 中捕获实例，不能在异步保存完成后捕获当前栈顶。
    bind,
    show() {
      if (!disposed) visible = true
    },
    hide() {
      visible = false
      cancel()
    },
    dispose() {
      disposed = true
      visible = false
      owner = null
      cancel()
    },
    schedule(action, delay = 1500) {
      cancel()
      if (!isCurrent()) return
      const currentSequence = sequence
      timer = setTimer(() => {
        // clearTimeout 无法撤销已进入回调队列的任务，因此仍需校验代次和实例。
        if (currentSequence !== sequence) return
        timer = null
        if (isCurrent()) action()
      }, delay)
    }
  }
}
