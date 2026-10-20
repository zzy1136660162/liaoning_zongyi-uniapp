// 商品图文统一解码并限制图片宽度，避免后台富文本图片撑出小程序页面。
export const formatRichText = (htmlContent) => {
  if (!htmlContent) return ''
  const normalizeRichText = (content) => content
    .replace(/<img([^>]*)style=(['"])(.*?)\2([^>]*)>/gi, (match, before, quote, styleContent, after) => {
      const sanitizedStyle = styleContent
        .replace(/(?:^|;)\s*width\s*:[^;]*/gi, '')
        .replace(/(?:^|;)\s*height\s*:[^;]*/gi, '')
        .trim()
      const nextStyle = `max-width:100%;width:100%;height:auto;display:block;box-sizing:border-box;${sanitizedStyle ? ` ${sanitizedStyle}` : ''}`.trim()
      return `<img${before}style="${nextStyle}"${after}>`
    })
    .replace(/<img((?:(?!style=)[^>])*)>/gi, '<img$1 style="max-width:100%;width:100%;height:auto;display:block;box-sizing:border-box;">')

  if (typeof htmlContent === 'string') {
    return normalizeRichText(
      htmlContent
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    )
  }
  return normalizeRichText(String(htmlContent))
}
