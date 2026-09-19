/**
 * 安全工具函数单元测试
 */
import { sanitizeHTML, sanitizeText, createMarkup } from '@/utils/sanitize'

describe('sanitize', () => {
  describe('sanitizeHTML', () => {
    it('should sanitize HTML with XSS attack', () => {
      const dirty = '<script>alert("XSS")</script><p>Safe content</p>'
      const clean = sanitizeHTML(dirty)
      
      expect(clean).not.toContain('<script>')
      expect(clean).toContain('<p>Safe content</p>')
    })

    it('should remove event handlers', () => {
      const dirty = '<div onclick="alert(1)">Click me</div>'
      const clean = sanitizeHTML(dirty)
      
      expect(clean).not.toContain('onclick')
      expect(clean).toContain('Click me')
    })

    it('should allow safe HTML tags', () => {
      const html = '<p><strong>Bold</strong> and <em>italic</em></p>'
      const clean = sanitizeHTML(html)
      
      expect(clean).toContain('<strong>')
      expect(clean).toContain('<em>')
    })

    it('should handle empty string', () => {
      const result = sanitizeHTML('')
      expect(result).toBe('')
    })

    it('should handle null/undefined gracefully', () => {
      const result = sanitizeHTML(null as unknown as string)
      expect(result).toBe('')
    })
  })

  describe('sanitizeText', () => {
    it('should escape HTML special characters', () => {
      const text = '<script>alert("test")</script>'
      const escaped = sanitizeText(text)
      
      expect(escaped).not.toContain('<script>')
      expect(escaped).toContain('&lt;script&gt;')
    })

    it('should escape ampersand first to prevent double escaping', () => {
      const text = '&amp; < > " \''
      const escaped = sanitizeText(text)
      
      expect(escaped).toContain('&amp;amp;')
      expect(escaped).toContain('&lt;')
      expect(escaped).toContain('&gt;')
    })
  })

  describe('createMarkup', () => {
    it('should return object with __html property', () => {
      const markup = createMarkup('<p>Test</p>')
      
      expect(markup).toHaveProperty('__html')
      expect(typeof markup.__html).toBe('string')
    })

    it('should sanitize the HTML content', () => {
      const markup = createMarkup('<img src=x onerror=alert(1)>')
      
      expect(markup.__html).not.toContain('onerror')
    })
  })
})
