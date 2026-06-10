/**
 * 安全工具函数
 * 提供 DOMPurify 包装和输入消毒功能
 */
import DOMPurify from 'dompurify'

// 配置 DOMPurify
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  // 移除所有事件处理属性
  if (data.allowedTags[data.tagName]) {
    const element = node as Element
    if (element.attributes) {
      Array.from(element.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) {
          element.removeAttribute(attr.name)
        }
      })
    }
  }
})

interface SanitizeOptions {
  allowedTags?: string[]
  allowedAttributes?: Record<string, string[] | boolean>
}

const DEFAULT_ALLOWED_TAGS: string[] = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'div', 'span', 'br', 'hr',
  'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i',
  'code', 'pre', 'blockquote',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'button',
]

const DEFAULT_ALLOWED_ATTRS: Record<string, string[] | boolean> = {
  '*': ['class', 'id', 'style'],
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height', 'loading'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
}

export function sanitizeHTML(dirtyHtml: string, options?: SanitizeOptions): string {
  const config: Record<string, unknown> = {
    ALLOWED_TAGS: options?.allowedTags || DEFAULT_ALLOWED_TAGS,
  }

  if (options?.allowedAttributes) {
    config.ALLOWED_ATTR = options.allowedAttributes
  } else {
    config.ALLOWED_ATTR = DEFAULT_ALLOWED_ATTRS
  }

  return DOMPurify.sanitize(dirtyHtml, config)
}

export function sanitizeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export function createMarkup(htmlContent: string): { __html: string } {
  return { __html: sanitizeHTML(htmlContent) }
}

export function safeSetInnerHTML(content: string): { __html: string } {
  return createMarkup(content)
}
