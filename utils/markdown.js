import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

export const renderMarkdown = (content) => {
  if (typeof content !== 'string') {
    return ''
  }

  return markdown.render(content)
}
