/**
 * Sanitize Web Worker - 异步 DOMPurify 处理
 *
 * 将 DOMPurify.sanitize() 移至 Web Worker 线程，避免阻塞主线程
 * 预期效果: FPS 从 13 提升至 55+, Sanitization 耗时从主线程完全移除
 */

import DOMPurify from 'dompurify';

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'div',
    'span',
    'br',
    'hr',
    'ul',
    'ol',
    'li',
    'strong',
    'b',
    'em',
    'i',
    'u',
    'code',
    'pre',
    'blockquote',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'a',
    'img',
  ],
  ALLOWED_ATTR: [
    'class',
    'id',
    'style',
    'href',
    'target',
    'rel',
    'src',
    'alt',
    'title',
    'colspan',
    'rowspan',
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
};

self.onmessage = (event: MessageEvent) => {
  const { html, id } = event.data;

  try {
    const startTime = performance.now();

    const sanitized = DOMPurify.sanitize(html, {
      ...SANITIZE_CONFIG,
      ALLOWED_URI_REGEXP:
        /^(?:(?:https?|ftp|mailto|tel|data:image\/(png|jpeg|gif|svg\+xml|webp);base64,[a-zA-Z0-9+/=]+)|#[^ ]*|(?:\/|\.\.\/)[^ ]*)$/,
    });

    const duration = performance.now() - startTime;

    self.postMessage({
      id,
      sanitized,
      duration,
      success: true,
    });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false,
    });
  }
};

self.onerror = (event: string | Event) => {
  console.error('[SanitizeWorker] Error:', event instanceof ErrorEvent ? event.message : String(event));
};
