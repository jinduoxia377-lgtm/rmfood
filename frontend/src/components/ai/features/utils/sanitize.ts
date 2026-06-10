import DOMPurify from 'dompurify'

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'div', 'span', 'br', 'hr',
    'ul', 'ol', 'li',
    'strong', 'b', 'em', 'i', 'u',
    'code', 'pre', 'blockquote',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a', 'img',
  ],
  ALLOWED_ATTR: [
    'class', 'id', 'style',
    'href', 'target', 'rel',
    'src', 'alt', 'title',
    'colspan', 'rowspan',
    'data-*',
  ],
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  ALLOW_DATA_ATTR: false,
  SAFE_FOR_TEMPLATES: true,
  WHOLE_DOCUMENT: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_TRUSTED_TYPE: false,
}

const FILE_NAME_PATTERN = /[<>:"/\\|?*\x00-\x1F]/g
const FILE_NAME_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i

const sanitizeCache = new Map<string, string>()
const MAX_CACHE_SIZE = 200

let sanitizeWorker: Worker | null = null
let workerReady = false
const pendingSanitizes = new Map<string, { resolve: (value: string) => void; reject: (reason?: any) => void }>()
let workerFallbackCount = 0

function supportsWebWorker(): boolean {
  // Blob Worker 中无法通过 importScripts 可靠加载外部 CDN 脚本（CORS 限制），
  // 因此禁用 Web Worker 路径，统一使用主线程同步消毒
  return false
}

async function initWorker(): Promise<Worker> {
  if (sanitizeWorker && workerReady) {
    return sanitizeWorker
  }

  if (!supportsWebWorker()) {
    throw new Error('Web Worker not supported')
  }

  try {
    const workerCode = `
      importScripts('https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js');

      const SANITIZE_CONFIG = ${JSON.stringify(SANITIZE_CONFIG)};

      self.onmessage = (event) => {
        const { html, id } = event.data;
        
        try {
          const startTime = performance.now();
          
          const sanitized = DOMPurify.sanitize(html, {
            ...SANITIZE_CONFIG,
            ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp|mailto|tel|data:image\\/(png|jpeg|gif|svg\\+xml|webp);base64,[a-zA-Z0-9+/=]+)|#[^ ]*|(?:\\/|\\.\\.\\/)[^ ]*)$/
          });
          
          const duration = performance.now() - startTime;
          
          self.postMessage({
            id,
            sanitized,
            duration,
            success: true
          });
        } catch (error) {
          self.postMessage({
            id,
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false
          });
        }
      };
    `

    const blob = new Blob([workerCode], { type: 'application/javascript' })
    const workerUrl = URL.createObjectURL(blob)

    sanitizeWorker = new Worker(workerUrl)

    sanitizeWorker.onmessage = (event: MessageEvent) => {
      const { id, sanitized, error, success, duration } = event.data

      const pending = pendingSanitizes.get(id)
      if (pending) {
        pendingSanitizes.delete(id)

        if (success) {
          if (duration && duration > 50) {
            console.warn(`[sanitize] Worker Performance warning: sanitization took ${duration.toFixed(2)}ms`)
          }
          pending.resolve(sanitized)
        } else {
          pending.reject(new Error(error))
        }
      }

      URL.revokeObjectURL(workerUrl)
    }

    sanitizeWorker.onerror = (error: ErrorEvent) => {
      console.error('[sanitize] Worker error:', error)
      workerReady = false
      workerFallbackCount++

      pendingSanitizes.forEach((pending) => {
        pending.reject(new Error('Worker failed'))
      })
      pendingSanitizes.clear()
    }

    workerReady = true

    return sanitizeWorker
  } catch (error) {
    console.warn('[sanitize] Failed to initialize Worker, falling back to main thread:', error)
    workerFallbackCount++
    throw error
  }
}

export async function sanitizeHtmlAsync(html: string): Promise<string> {
  if (!html || typeof html !== 'string') return ''

  if (sanitizeCache.has(html)) {
    return sanitizeCache.get(html)!
  }

  // Worker 不可用时静默降级到同步路径，避免不必要的 warn 日志
  if (!supportsWebWorker()) {
    return sanitizeHtmlSync(html)
  }

  try {
    const worker = await initWorker()

    const id = Math.random().toString(36).slice(2)

    const result = new Promise<string>((resolve, reject) => {
      pendingSanitizes.set(id, { resolve, reject })

      setTimeout(() => {
        if (pendingSanitizes.has(id)) {
          pendingSanitizes.delete(id)
          reject(new Error('Worker timeout'))
        }
      }, 10000)
    })

    worker.postMessage({ html, id })

    const sanitized = await result

    if (sanitizeCache.size >= MAX_CACHE_SIZE) {
      const firstKey = sanitizeCache.keys().next().value
      sanitizeCache.delete(firstKey)
    }
    sanitizeCache.set(html, sanitized)

    return sanitized
  } catch (error) {
    console.warn('[sanitize] Worker failed, using main thread fallback:', error)
    return sanitizeHtmlSync(html)
  }
}

export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return ''

  if (sanitizeCache.has(html)) {
    return sanitizeCache.get(html)!
  }

  if (workerReady && sanitizeWorker) {
    sanitizeHtmlAsync(html).then(result => {
      if (!sanitizeCache.has(html)) {
        if (sanitizeCache.size >= MAX_CACHE_SIZE) {
          const firstKey = sanitizeCache.keys().next().value
          sanitizeCache.delete(firstKey)
        }
        sanitizeCache.set(html, result)
      }
    }).catch(() => {})
  }

  return sanitizeHtmlSync(html)
}

function sanitizeHtmlSync(html: string): string {
  const startTime = performance.now()

  const sanitized = DOMPurify.sanitize(html, {
    ...SANITIZE_CONFIG,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp|mailto|tel|data:image\/(png|jpeg|gif|svg\+xml|webp);base64,[a-zA-Z0-9+/=]+)|#[^ ]*|(?:\/|\.\.\/)[^ ]*)$/,
  })

  const duration = performance.now() - startTime
  if (sanitizeCache.size >= MAX_CACHE_SIZE) {
    const firstKey = sanitizeCache.keys().next().value
    sanitizeCache.delete(firstKey)
  }
  sanitizeCache.set(html, sanitized)

  return sanitized
}

export function getSanitizeStats(): {
  cacheSize: number
  workerReady: boolean
  fallbackCount: number
} {
  return {
    cacheSize: sanitizeCache.size,
    workerReady,
    fallbackCount: workerFallbackCount,
  }
}

export function clearSanitizeCache(): void {
  sanitizeCache.clear()
}

export function sanitizeMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return ''

  let sanitized = markdown

  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  sanitized = sanitized.replace(/javascript:/gi, '')
  sanitized = sanitized.replace(/on\w+\s*=/gi, '')
  sanitized = sanitized.replace(/<iframe[\s\S]*?<\/iframe>/gi, '')

  return sanitized
}

export function sanitizeFileName(name: string): string {
  if (!name || typeof name !== 'string') return ''

  let sanitized = name.trim()

  sanitized = sanitized.replace(FILE_NAME_PATTERN, '_')

  if (FILE_NAME_RESERVED.test(sanitized)) {
    sanitized = `_${sanitized}_`
  }

  sanitized = sanitized.replace(/^[.]+/, '_').replace(/[.]+$/, '_')
  sanitized = sanitized.substring(0, 255)

  if (sanitized === '' || sanitized === '_' || '.') {
    sanitized = `unnamed_${Date.now()}`
  }

  return sanitized
}

export function isSafeHtml(html: string): boolean {
  if (!html || typeof html !== 'string') return true

  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript\s*:/gi,
    /on(?:click|load|error|mouse|key|focus|blur|change|submit|reset|select|unload)\s*=/gi,
    /<iframe[\s\S]*?<\/iframe>/gi,
    /<object[\s\S]*?<\/object>/gi,
    /<embed[^>]*>/gi,
    /expression\s*\(/gi,
    /vbscript\s*:/gi,
    /data:\s*text\/html/gi,
  ]

  return !dangerousPatterns.some(pattern => pattern.test(html))
}

export { DOMPurify, SANITIZE_CONFIG }
