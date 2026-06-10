import { describe, it, expect, vi } from 'vitest'
import {
  formatTimestamp,
  truncateText,
  detectMessageType,
  highlightKeywords,
  generateMessageId,
  estimateTokenCount,
  formatTimestampAdvanced,
  generateTextSummary,
  extractKeywords,
  calculateMessageSimilarity,
  parseUrl,
  linkifyText,
  countEmojis,
  normalizeText,
  detectLanguage,
  formatFileSize,
  debounce,
  throttle,
} from '../chatHelpers'

describe('chatHelpers', () => {
  describe('formatTimestamp', () => {
    it('应格式化刚刚发生的时间', () => {
      const now = Date.now()
      expect(formatTimestamp(now)).toBe('刚刚')
    })

    it('应格式化几分钟前', () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      expect(formatTimestamp(fiveMinutesAgo)).toBe('5分钟前')
    })

    it('应格式化几小时前', () => {
      const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000
      expect(formatTimestamp(threeHoursAgo)).toBe('3小时前')
    })

    it('应格式化几天前的日期', () => {
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000
      const result = formatTimestamp(twoDaysAgo)
      expect(result).toMatch(/^\d+\/\d+ \d{2}:\d{2}$/)
    })

    it('应处理无效时间戳', () => {
      expect(formatTimestamp('invalid')).toBe('')
    })

    it('应处理字符串时间戳', () => {
      const timestampStr = '2024-01-15T10:30:00.000Z'
      const result = formatTimestamp(timestampStr)
      expect(result).toBeTruthy()
    })
  })

  describe('formatTimestampAdvanced', () => {
    it('应支持相对时间格式', () => {
      const now = Date.now()
      expect(formatTimestampAdvanced(now, { relative: true })).toBe('刚刚')
    })

    it('应支持绝对时间格式', () => {
      const date = new Date('2024-06-15T14:30:00')
      const result = formatTimestampAdvanced(date, { relative: false, showDate: true, showTime: true })
      expect(result).toContain('2024年6月15日')
      expect(result).toContain('14:30')
    })

    it('应支持自定义格式字符串', () => {
      const date = new Date('2024-06-15')
      const result = formatTimestampAdvanced(date, { format: 'YYYY-MM-DD' })
      expect(result).toBe('2024-06-15')
    })

    it('应支持12小时制', () => {
      const date = new Date('2024-06-15T14:30:00')
      const result = formatTimestampAdvanced(date, { format: 'hh:mm A', use12Hour: true })
      expect(result).toBe('02:30 PM')
    })

    it('应处理超过7天的时间', () => {
      const sevenDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
      const result = formatTimestampAdvanced(sevenDaysAgo, { relative: true })
      expect(result).toMatch(/年.*月.*日/)
    })
  })

  describe('truncateText', () => {
    it('应截断过长文本', () => {
      const longText = 'A'.repeat(150)
      const result = truncateText(longText, 100)
      expect(result).toHaveLength(103) // 100 + '...'
      expect(result.endsWith('...')).toBe(true)
    })

    it('不应截断短文本', () => {
      const shortText = 'Short text'
      expect(truncateText(shortText)).toBe(shortText)
    })

    it('应处理空字符串', () => {
      expect(truncateText('')).toBe('')
      expect(truncateText(undefined as any)).toBe('')
    })

    it('应处理默认长度', () => {
      const longText = 'A'.repeat(150)
      const result = truncateText(longText)
      expect(result).toHaveLength(103)
    })
  })

  describe('detectMessageType', () => {
    it('应检测配方相关消息', () => {
      expect(detectMessageType('帮我生成一个蛋糕配方')).toBe('formula')
      expect(detectMessageType('分析营养成分')).toBe('formula')
      expect(detectMessageType('计算成本')).toBe('formula')
    })

    it('应检测问题类型', () => {
      expect(detectMessageType('你好吗？')).toBe('question')
      expect(detectMessageType('What is this?')).toBe('question')
    })

    it('应返回普通文本类型', () => {
      expect(detectMessageType('这是一段普通文本')).toBe('text')
    })

    it('应处理空字符串', () => {
      expect(detectMessageType('')).toBe('text')
    })
  })

  describe('highlightKeywords', () => {
    it('应高亮匹配的关键词', () => {
      const text = 'Hello world, this is a test'
      const result = highlightKeywords(text, ['world', 'test'])
      expect(result).toBe('Hello <mark>world</mark>, this is a <mark>test</mark>')
    })

    it('应忽略空关键词', () => {
      const text = 'Hello world'
      const result = highlightKeywords(text, ['', '  ', undefined as any])
      expect(result).toBe(text)
    })

    it('应处理空文本', () => {
      expect(highlightKeywords('', ['test'])).toBe('')
    })

    it('应处理无关键词', () => {
      expect(highlightKeywords('Hello', [])).toBe('Hello')
    })
  })

  describe('generateMessageId', () => {
    it('应生成唯一ID', () => {
      const id1 = generateMessageId()
      const id2 = generateMessageId()
      expect(id1).not.toBe(id2)
    })

    it('应符合格式', () => {
      const id = generateMessageId()
      expect(id).toMatch(/^msg_\d+_[a-z0-9]{9}$/)
    })
  })

  describe('estimateTokenCount', () => {
    it('应估算中文文本token数', () => {
      const text = '你好世界'
      const count = estimateTokenCount(text)
      expect(count).toBeGreaterThan(0)
    })

    it('应估算英文文本token数', () => {
      const text = 'Hello world'
      const count = estimateTokenCount(text)
      expect(count).toBe(2)
    })

    it('应估算混合文本token数', () => {
      const text = 'Hello 世界'
      const count = estimateTokenCount(text)
      expect(count).toBeGreaterThan(0)
    })

    it('应处理空文本', () => {
      expect(estimateTokenCount('')).toBe(0)
    })
  })

  describe('generateTextSummary', () => {
    it('应生成文本摘要', () => {
      const longText = '这是一段非常长的文本，包含多个句子。第一个句子介绍了一些内容。第二个句子继续补充信息。'
      const result = generateTextSummary(longText, { maxLength: 30 })
      expect(result.length).toBeLessThanOrEqual(33) // 30 + '...'
      expect(result.endsWith('...')).toBe(true)
    })

    it('应保留完整句子', () => {
      const text = '这是第一句话。这是第二句话。这是第三句话。'
      const result = generateTextSummary(text, { maxLength: 12, preserveSentences: true })
      expect(result).toBe('这是第一句话。这是第二句...')
    })

    it('不应截断短文本', () => {
      const shortText = '短文本'
      expect(generateTextSummary(shortText)).toBe(shortText)
    })
  })

  describe('extractKeywords', () => {
    it('应提取关键词', () => {
      const text = '苹果 苹果 香蕉 橙子 苹果 香蕉'
      const keywords = extractKeywords(text, 3)
      expect(keywords).toHaveLength(3)
      expect(keywords[0].word).toBe('苹果')
      expect(keywords[0].count).toBe(3)
    })

    it('应处理中文文本', () => {
      const text = '这是一段中文文本测试测试'
      const keywords = extractKeywords(text)
      expect(keywords.length).toBeGreaterThan(0)
    })

    it('应处理空文本', () => {
      expect(extractKeywords('')).toEqual([])
    })
  })

  describe('calculateMessageSimilarity', () => {
    it('应计算相同消息的相似度', () => {
      const result = calculateMessageSimilarity('Hello world', 'Hello world')
      expect(result.similarity).toBe(1)
      expect(result.isDuplicate).toBe(true)
    })

    it('应计算不同消息的相似度', () => {
      const result = calculateMessageSimilarity('Hello world', 'Goodbye world')
      expect(result.similarity).toBeLessThan(1)
      expect(result.isDuplicate).toBe(false)
    })

    it('应处理空消息', () => {
      const result = calculateMessageSimilarity('', 'Hello')
      expect(result.similarity).toBe(0)
    })

    it('应返回共同词汇', () => {
      const result = calculateMessageSimilarity('Hello world today', 'Hello world tomorrow')
      expect(result.commonWords).toContain('hello')
      expect(result.commonWords).toContain('world')
    })
  })

  describe('parseUrl', () => {
    it('应解析有效URL', () => {
      const url = 'https://example.com/path?query=value#hash'
      const result = parseUrl(url)
      
      expect(result.isValid).toBe(true)
      expect(result.protocol).toBe('https')
      expect(result.host).toBe('example.com')
      expect(result.path).toBe('/path')
      expect(result.query).toEqual({ query: 'value' })
      expect(result.hash).toBe('hash')
    })

    it('应处理无效URL', () => {
      const result = parseUrl('invalid-url')
      expect(result.isValid).toBe(false)
    })

    it('应处理无查询参数的URL', () => {
      const url = 'http://example.com/path'
      const result = parseUrl(url)
      expect(result.query).toEqual({})
    })
  })

  describe('linkifyText', () => {
    it('应转换URL为链接', () => {
      const text = 'Visit https://example.com today'
      const result = linkifyText(text)
      expect(result).toBe(
        'Visit <a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a> today'
      )
    })

    it('应处理无URL的文本', () => {
      const text = 'No URL here'
      expect(linkifyText(text)).toBe(text)
    })

    it('应处理多个URL', () => {
      const text = 'Check https://a.com and https://b.com'
      const result = linkifyText(text)
      expect(result).toContain('href="https://a.com"')
      expect(result).toContain('href="https://b.com"')
    })
  })

  describe('countEmojis', () => {
    it('应统计表情符号数量', () => {
      const text = 'Hello 😊 World 🌍'
      expect(countEmojis(text)).toBe(2)
    })

    it('应处理无表情符号的文本', () => {
      expect(countEmojis('No emojis here')).toBe(0)
    })

    it('应处理混合文本', () => {
      const text = '🎂 生日蛋糕 🎉🎊🎁'
      expect(countEmojis(text)).toBe(4)
    })
  })

  describe('normalizeText', () => {
    it('应压缩多余空格', () => {
      const text = 'Hello   world   test'
      expect(normalizeText(text)).toBe('Hello world test')
    })

    it('应统一换行符', () => {
      const text = 'Line1\r\nLine2\n\n\nLine3'
      expect(normalizeText(text)).toBe('Line1\nLine2\n\nLine3')
    })

    it('应去除首尾空格', () => {
      const text = '  Hello world  '
      expect(normalizeText(text)).toBe('Hello world')
    })
  })

  describe('detectLanguage', () => {
    it('应检测中文', () => {
      expect(detectLanguage('你好世界')).toBe('zh')
    })

    it('应检测英文', () => {
      expect(detectLanguage('Hello world')).toBe('en')
    })

    it('应检测混合语言', () => {
      expect(detectLanguage('中文测试 English 编程')).toBe('mixed')
    })

    it('应处理空文本', () => {
      expect(detectLanguage('')).toBe('unknown')
    })
  })

  describe('formatFileSize', () => {
    it('应格式化字节', () => {
      expect(formatFileSize(100)).toBe('100 B')
    })

    it('应格式化KB', () => {
      expect(formatFileSize(2048)).toBe('2.0 KB')
    })

    it('应格式化MB', () => {
      expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB')
    })

    it('应格式化GB', () => {
      expect(formatFileSize(4 * 1024 * 1024 * 1024)).toBe('4.0 GB')
    })

    it('应处理0字节', () => {
      expect(formatFileSize(0)).toBe('0 B')
    })
  })

  describe('debounce', () => {
    it('应延迟执行函数', async () => {
      vi.useFakeTimers()
      const mockFn = vi.fn()
      const debouncedFn = debounce(mockFn, 100)

      debouncedFn()
      debouncedFn()
      debouncedFn()

      expect(mockFn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(mockFn).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })

    it('应在延迟后执行', async () => {
      vi.useFakeTimers()
      const mockFn = vi.fn()
      const debouncedFn = debounce(mockFn, 50)

      debouncedFn()
      vi.advanceTimersByTime(49)
      expect(mockFn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)
      expect(mockFn).toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  describe('throttle', () => {
    it('应限制函数执行频率', async () => {
      vi.useFakeTimers()
      const mockFn = vi.fn()
      const throttledFn = throttle(mockFn, 100)

      throttledFn()
      throttledFn()
      throttledFn()

      expect(mockFn).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(100)
      throttledFn()
      expect(mockFn).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it('应在限制时间内只执行一次', async () => {
      vi.useFakeTimers()
      const mockFn = vi.fn()
      const throttledFn = throttle(mockFn, 50)

      throttledFn()
      throttledFn()
      vi.advanceTimersByTime(49)
      throttledFn()
      
      expect(mockFn).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(1)
      throttledFn()
      expect(mockFn).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })
  })
})
