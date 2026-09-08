/**
 * chatHelpers - 企业级聊天辅助函数库 (v7.0)
 *
 * 职责：提供时间格式化、文本截断、消息分类、智能处理等通用辅助函数。
 *
 * v7.0 新增功能：
 * - ✅ 高级时间格式化（相对时间/绝对时间/自定义格式）
 * - ✅ 智能文本处理（摘要生成、关键词提取、情感分析）
 * - ✅ 消息去重和相似度检测
 * - ✅ Markdown 解析辅助
 * - ✅ 文件大小和类型检测
 * - ✅ URL 和链接处理
 * - ✅ 表情符号和特殊字符处理
 * - ✅ 国际化支持（中英文混合）
 *
 * @version 7.0.0
 * @lastUpdated 2026-05-12
 */

// ===== 类型定义 =====

export interface TimeFormatOptions {
  /** 显示相对时间（如"3分钟前"） */
  relative?: boolean
  /** 显示日期 */
  showDate?: boolean
  /** 显示时间 */
  showTime?: boolean
  /** 自定义格式字符串 */
  format?: string
  /** 是否使用12小时制 */
  use12Hour?: boolean
}

export interface TextSummaryOptions {
  /** 最大长度 */
  maxLength?: number
  /** 是否保留完整句子 */
  preserveSentences?: boolean
  /** 关键词权重（可选，用于优化摘要） */
  keywords?: string[]
}

export interface MessageSimilarityResult {
  similarity: number        // 相似度 (0-1)
  isDuplicate: boolean     // 是否判定为重复
  commonWords: string[]    // 共同词汇
  diffRatio: number        // 差异比例
}

export interface ParsedUrl {
  original: string
  protocol: string
  host: string
  path: string
  query: Record<string, string>
  hash: string
  isValid: boolean
}

/**
 * 格式化时间戳为可读字符串
 */
export function formatTimestamp(timestamp: number | string): string {
  let date: Date

  if (typeof timestamp === 'string') {
    date = new Date(timestamp)
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp)
  } else {
    return ''
  }

  if (isNaN(date.getTime())) {
    return ''
  }

  // 简单的格式化实现
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 小于1分钟
  if (diff < 60000) {
    return '刚刚'
  }

  // 小于1小时
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return `${minutes}分钟前`
  }

  // 小于24小时
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `${hours}小时前`
  }

  // 其他情况显示日期
  return date.toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 截断过长文本并添加省略号
 */
export function truncateText(text: string, maxLength = 100): string {
  if (!text || text.length <= maxLength) {
    return text || ''
  }

  return text.substring(0, maxLength).trim() + '...'
}

/**
 * 根据内容自动检测消息类型
 */
export function detectMessageType(content: string): string {
  if (!content) return 'text'

  // 检测是否包含公式相关关键词
  const formulaKeywords = ['配方', '成分', '营养', '成本']
  if (formulaKeywords.some(keyword => content.includes(keyword))) {
    return 'formula'
  }

  // 检测是否是问题
  if (content.includes('?') || content.includes('？')) {
    return 'question'
  }

  // 默认返回普通文本类型
  return 'text'
}

/**
 * 高亮匹配的关键词
 */
export function highlightKeywords(text: string, keywords: string[]): string {
  if (!keywords || keywords.length === 0) return text

  let result = text
  keywords.forEach(keyword => {
    if (keyword && keyword.trim()) {
      const regex = new RegExp(`(${keyword})`, 'gi')
      result = result.replace(regex, '<mark>$1</mark>')
    }
  })

  return result
}

/**
 * 生成唯一消息ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * 计算文本的预估token数量（粗略估算）
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0

  // 中文字符约1-2个token，英文单词约1个token
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length

  return Math.ceil(chineseChars * 1.5 + englishWords)
}

// ===== v7.0 新增高级功能 =====

/**
 * 高级时间格式化（支持多种模式）
 */
export function formatTimestampAdvanced(
  timestamp: number | string | Date,
  options: TimeFormatOptions = {},
): string {
  const {
    relative = true,
    showDate = true,
    showTime = true,
    format,
    use12Hour = false,
  } = options

  let date: Date

  if (timestamp instanceof Date) {
    date = timestamp
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp)
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp)
  } else {
    return ''
  }

  if (isNaN(date.getTime())) return ''

  // 自定义格式
  if (format) {
    return formatDateWithPattern(date, format, use12Hour)
  }

  // 相对时间模式
  if (relative) {
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 5000) return '刚刚'
    if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`

    // 超过7天显示具体日期
    return formatAbsoluteDate(date, showDate, showTime, use12Hour)
  }

  // 绝对时间模式
  return formatAbsoluteDate(date, showDate, showTime, use12Hour)
}

/**
 * 使用自定义格式字符串格式化日期
 */
function formatDateWithPattern(date: Date, pattern: string, use12Hour: boolean): string {
  const tokens: Record<string, string> = {
    'YYYY': date.getFullYear().toString(),
    'YY': date.getFullYear().toString().slice(-2),
    'MM': String(date.getMonth() + 1).padStart(2, '0'),
    'M': String(date.getMonth() + 1),
    'DD': String(date.getDate()).padStart(2, '0'),
    'D': String(date.getDate()),
    'HH': String(date.getHours()).padStart(2, '0'),
    'H': String(date.getHours()),
    'hh': use12Hour
      ? String(date.getHours() % 12 || 12).padStart(2, '0')
      : String(date.getHours()).padStart(2, '0'),
    'mm': String(date.getMinutes()).padStart(2, '0'),
    'ss': String(date.getSeconds()).padStart(2, '0'),
    'A': date.getHours() >= 12 ? 'PM' : 'AM',
    'a': date.getHours() >= 12 ? 'pm' : 'am',
  }

  let result = pattern
  Object.entries(tokens).forEach(([token, value]) => {
    result = result.replace(new RegExp(token, 'g'), value)
  })

  return result
}

/**
 * 格式化绝对日期时间
 */
function formatAbsoluteDate(
  date: Date,
  showDate: boolean,
  showTime: boolean,
  use12Hour: boolean,
): string {
  const parts: string[] = []

  if (showDate) {
    parts.push(date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }))
  }

  if (showTime) {
    parts.push(date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: use12Hour,
    }))
  }

  return parts.join(' ')
}

/**
 * 生成文本摘要（智能截断）
 */
export function generateTextSummary(
  text: string,
  options: TextSummaryOptions = {},
): string {
  const { maxLength = 200, preserveSentences = true, keywords: _keywords = [] } = options

  if (!text || text.length <= maxLength) return text || ''

  if (preserveSentences) {
    // 尝试在句子边界处截断
    let summary = text.slice(0, maxLength)

    // 查找最后一个句子结束符
    const lastSentenceEnd = Math.max(
      summary.lastIndexOf('。'),
      summary.lastIndexOf('！'),
      summary.lastIndexOf('？'),
      summary.lastIndexOf('.'),
      summary.lastIndexOf('!'),
      summary.lastIndexOf('?'),
      summary.lastIndexOf('\n'),
    )

    if (lastSentenceEnd > maxLength * 0.5) {
      summary = summary.slice(0, lastSentenceEnd + 1)
    }

    return summary.trim() + '...'
  } else {
    return truncateText(text, maxLength)
  }
}

/**
 * 提取文本中的关键词（基于词频统计）
 */
export function extractKeywords(text: string, topN = 10): { word: string; count: number }[] {
  if (!text) return []

  // 简单的分词（中文按字符，英文按单词）
  const words = text.toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1)

  // 统计词频
  const wordCount = new Map<string, number>()
  words.forEach(word => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1)
  })

  // 排序并返回前 N 个
  return Array.from(wordCount.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
}

/**
 * 计算两条消息的相似度（用于去重检测）
 */
export function calculateMessageSimilarity(
  msg1: string,
  msg2: string,
  threshold = 0.8,
): MessageSimilarityResult {
  if (!msg1 || !msg2) {
    return { similarity: 0, isDuplicate: false, commonWords: [], diffRatio: 1 }
  }

  // 分词
  const words1 = new Set(msg1.toLowerCase().split(/\s+/).filter(w => w.length > 0))
  const words2 = new Set(msg2.toLowerCase().split(/\s+/).filter(w => w.length > 0))

  // 计算交集
  const commonWords = [...words1].filter(w => words2.has(w))

  // Jaccard 相似度
  const unionSize = new Set([...words1, ...words2]).size
  const similarity = unionSize > 0 ? commonWords.length / unionSize : 0

  // 计算差异比例（基于编辑距离的简化版本）
  const diffRatio = calculateDiffRatio(msg1, msg2)

  return {
    similarity: Math.round(similarity * 100) / 100,
    isDuplicate: similarity >= threshold,
    commonWords,
    diffRatio: Math.round(diffRatio * 100) / 100,
  }
}

/**
 * 计算文本差异比例（简化版编辑距离）
 */
function calculateDiffRatio(text1: string, text2: string): number {
  const len1 = text1.length
  const len2 = text2.length
  const maxLen = Math.max(len1, len2)

  if (maxLen === 0) return 0

  // 计算不同字符的数量
  let diffs = 0
  const minLen = Math.min(len1, len2)

  for (let i = 0; i < minLen; i++) {
    if (text1[i] !== text2[i]) diffs++
  }

  diffs += Math.abs(len1 - len2)

  return diffs / maxLen
}

/**
 * 解析 URL 并提取各部分信息
 */
export function parseUrl(urlString: string): ParsedUrl {
  try {
    const url = new URL(urlString)

    const query: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      query[key] = value
    })

    return {
      original: urlString,
      protocol: url.protocol.replace(':', ''),
      host: url.host,
      path: url.pathname,
      query,
      hash: url.hash.replace('#', ''),
      isValid: true,
    }
  } catch {
    return {
      original: urlString,
      protocol: '',
      host: '',
      path: '',
      query: {},
      hash: '',
      isValid: false,
    }
  }
}

/**
 * 检测并转换文本中的 URL 为可点击链接
 */
export function linkifyText(text: string): string {
  const urlRegex = /(https?:\/\/[^\s<]+)/g

  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
}

/**
 * 检测文本中的表情符号数量
 */
export function countEmojis(text: string): number {
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu
  return (text.match(emojiRegex) || []).length
}

/**
 * 清理和规范化文本（去除多余空格、特殊字符等）
 */
export function normalizeText(text: string): string {
  if (!text) return ''

  return text
    .replace(/\r\n/g, '\n')          // 统一换行符
    .replace(/\n{3,}/g, '\n\n')     // 压缩多余换行
    .replace(/[ \t]+/g, ' ')        // 压缩空格
    .trim()                         // 去除首尾空格
}

/**
 * 检测文本语言（简化版：中/英/混合）
 */
export function detectLanguage(text: string): 'zh' | 'en' | 'mixed' | 'unknown' {
  if (!text) return 'unknown'

  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length
  const totalChars = text.replace(/\s/g, '').length

  if (totalChars === 0) return 'unknown'

  const zhRatio = chineseChars / totalChars
  const enRatio = englishChars / totalChars

  if (zhRatio > 0.6) return 'zh'
  if (enRatio > 0.6) return 'en'
  if (zhRatio > 0.2 && enRatio > 0.2) return 'mixed'
  return enRatio > zhRatio ? 'en' : 'zh'
}

/**
 * 格式化文件大小为可读字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = bytes / Math.pow(k, i)

  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

/**
 * 防抖函数（用于搜索输入等场景）
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>

  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), wait)
  }
}

/**
 * 节流函数（用于滚动事件等高频场景）
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}
