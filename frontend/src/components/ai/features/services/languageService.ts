/**
 * LanguageService - 语言服务 (v1.0)
 *
 * 提供多语言自动检测、语言切换和输入建议功能。
 * 支持中英文双语，集成 i18n 系统。
 *
 * 功能特性：
 * - 自动检测文本语言
 * - 语言切换
 * - 智能输入建议
 * - 事件通知
 * - 错误处理
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-12
 */

import i18n, { SUPPORTED_LANGUAGES } from '../i18n'
import { eventBus } from './eventBus'
import { logger } from '@/utils/safeLogger'

// 语言类型定义
export type LanguageCode = 'zh-CN' | 'en-US' | 'de-DE'

export interface LanguageDetectionResult {
  language: LanguageCode
  confidence: number
  isMixed: boolean
  chineseRatio: number
  englishRatio: number
}

export interface InputSuggestion {
  id: string
  text: string
  type: 'question' | 'statement' | 'command'
  category: string
  confidence: number
}

export interface LanguageServiceConfig {
  autoDetectOnInput?: boolean
  minConfidence?: number
  suggestionCount?: number
}

export interface ILanguageService {
  detectLanguage(text: string): LanguageDetectionResult
  switchLanguage(language: LanguageCode): Promise<void>
  getCurrentLanguage(): LanguageCode
  getSuggestions(input: string, context?: string[]): InputSuggestion[]
  subscribe(callback: (language: LanguageCode) => void): () => void
  unsubscribe(callback: (language: LanguageCode) => void): void
}

class LanguageService implements ILanguageService {
  private readonly config: Required<LanguageServiceConfig>
  private subscribers: Set<(language: LanguageCode) => void>
  private lastDetectedLanguage: LanguageCode | null = null

  constructor(config: LanguageServiceConfig = {}) {
    this.config = {
      autoDetectOnInput: config.autoDetectOnInput ?? true,
      minConfidence: config.minConfidence ?? 0.6,
      suggestionCount: config.suggestionCount ?? 5,
    }
    this.subscribers = new Set()

    this.init()
  }

  private init(): void {
    logger.debug('[LanguageService] 初始化语言服务')

    i18n.on('languageChanged', (lng) => {
      this.notifySubscribers(lng as LanguageCode)
    })
  }

  detectLanguage(text: string): LanguageDetectionResult {
    if (!text || text.trim().length === 0) {
      return {
        language: this.getCurrentLanguage(),
        confidence: 1.0,
        isMixed: false,
        chineseRatio: 0,
        englishRatio: 0,
      }
    }

    const chineseChars = this.countChineseCharacters(text)
    const englishChars = this.countEnglishCharacters(text)
    const germanChars = this.countGermanCharacters(text)
    const totalChars = chineseChars + englishChars

    if (totalChars === 0) {
      return {
        language: this.getCurrentLanguage(),
        confidence: 0.5,
        isMixed: false,
        chineseRatio: 0,
        englishRatio: 0,
      }
    }

    const chineseRatio = chineseChars / totalChars
    const englishRatio = englishChars / totalChars
    const isMixed = chineseRatio > 0.1 && englishRatio > 0.1

    let detectedLanguage: LanguageCode
    let confidence: number

    if (chineseRatio > englishRatio) {
      detectedLanguage = 'zh-CN'
      confidence = chineseRatio
    } else if (germanChars > 0 && germanChars / Math.max(englishChars, 1) >= 0.05) {
      // 德语特有字符（ä ö ü ß 等）出现时判定为德语
      detectedLanguage = 'de-DE'
      confidence = Math.min(1, englishRatio + germanChars / totalChars)
    } else {
      detectedLanguage = 'en-US'
      confidence = englishRatio
    }

    if (isMixed) {
      confidence = Math.max(chineseRatio, englishRatio) * 0.8
    }

    return {
      language: detectedLanguage,
      confidence,
      isMixed,
      chineseRatio,
      englishRatio,
    }
  }

  async switchLanguage(language: LanguageCode): Promise<void> {
    try {
      const isSupported = SUPPORTED_LANGUAGES.some(lang => lang.code === language)
      if (!isSupported) {
        throw new Error(`不支持的语言: ${language}`)
      }

      logger.debug('[LanguageService] 切换语言:', language)
      await i18n.changeLanguage(language)
      eventBus.emit('language:changed', { language })
    } catch (error) {
      logger.error('[LanguageService] 语言切换失败:', error)
      throw error
    }
  }

  getCurrentLanguage(): LanguageCode {
    const lng = i18n.language
    return (lng === 'zh-CN' || lng === 'en-US' || lng === 'de-DE') ? lng : 'zh-CN'
  }

  getSuggestions(input: string, context: string[] = []): InputSuggestion[] {
    const detected = this.detectLanguage(input)
    const language = detected.confidence >= this.config.minConfidence
      ? detected.language
      : this.getCurrentLanguage()

    const suggestions: InputSuggestion[] = []

    if (language === 'zh-CN') {
      suggestions.push(...this.generateChineseSuggestions(input, context))
    } else if (language === 'de-DE') {
      suggestions.push(...this.generateGermanSuggestions(input, context))
    } else {
      suggestions.push(...this.generateEnglishSuggestions(input, context))
    }

    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.suggestionCount)
  }

  subscribe(callback: (language: LanguageCode) => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  unsubscribe(callback: (language: LanguageCode) => void): void {
    this.subscribers.delete(callback)
  }

  private notifySubscribers(language: LanguageCode): void {
    this.subscribers.forEach(callback => {
      try {
        callback(language)
      } catch (error) {
        logger.error('[LanguageService] 订阅者回调失败:', error)
      }
    })
  }

  private countChineseCharacters(text: string): number {
    const chineseRegex = /[\u4e00-\u9fa5]/g
    return (text.match(chineseRegex) || []).length
  }

  private countEnglishCharacters(text: string): number {
    const englishRegex = /[a-zA-ZäöüÄÖÜß]/g
    return (text.match(englishRegex) || []).length
  }

  private countGermanCharacters(text: string): number {
    const germanRegex = /[äöüÄÖÜß]/g
    return (text.match(germanRegex) || []).length
  }

  private generateChineseSuggestions(input: string, context: string[]): InputSuggestion[] {
    const suggestions: InputSuggestion[] = []
    const lowerInput = input.toLowerCase()

    if (input.trim()) {
      if (lowerInput.includes('配方') || lowerInput.includes('成分')) {
        suggestions.push({
          id: 'zh-1',
          text: '请帮我生成一个保湿配方',
          type: 'question',
          category: '配方生成',
          confidence: 0.95,
        })
        suggestions.push({
          id: 'zh-2',
          text: '分析这个成分的功效',
          type: 'question',
          category: '成分分析',
          confidence: 0.9,
        })
      }

      if (lowerInput.includes('安全') || lowerInput.includes('风险')) {
        suggestions.push({
          id: 'zh-3',
          text: '请检查这个配方的安全性',
          type: 'question',
          category: '安全评估',
          confidence: 0.92,
        })
      }

      if (lowerInput.includes('比较') || lowerInput.includes('对比')) {
        suggestions.push({
          id: 'zh-4',
          text: '对比这两个配方的差异',
          type: 'question',
          category: '配方对比',
          confidence: 0.88,
        })
      }

      if (lowerInput.includes('优化') || lowerInput.includes('改进')) {
        suggestions.push({
          id: 'zh-5',
          text: '如何优化这个配方',
          type: 'question',
          category: '配方优化',
          confidence: 0.85,
        })
      }
    } else {
      suggestions.push(
        {
          id: 'zh-empty-1',
          text: '生成保湿配方',
          type: 'command',
          category: '快捷操作',
          confidence: 0.9,
        },
        {
          id: 'zh-empty-2',
          text: '分析成分功效',
          type: 'command',
          category: '快捷操作',
          confidence: 0.85,
        },
        {
          id: 'zh-empty-3',
          text: '安全性评估',
          type: 'command',
          category: '快捷操作',
          confidence: 0.8,
        },
      )

      if (context.length > 0) {
        const recentContext = context.slice(-2)
        recentContext.forEach((ctx, idx) => {
          suggestions.push({
            id: `zh-context-${idx}`,
            text: ctx.length > 30 ? ctx.slice(0, 30) + '...' : ctx,
            type: 'statement',
            category: '历史记录',
            confidence: 0.75 - idx * 0.05,
          })
        })
      }
    }

    return suggestions
  }

  private generateEnglishSuggestions(input: string, context: string[]): InputSuggestion[] {
    const suggestions: InputSuggestion[] = []
    const lowerInput = input.toLowerCase()

    if (input.trim()) {
      if (lowerInput.includes('formula') || lowerInput.includes('ingredient')) {
        suggestions.push({
          id: 'en-1',
          text: 'Help me generate a moisturizing formula',
          type: 'question',
          category: 'Formula Generation',
          confidence: 0.95,
        })
        suggestions.push({
          id: 'en-2',
          text: 'Analyze the efficacy of this ingredient',
          type: 'question',
          category: 'Ingredient Analysis',
          confidence: 0.9,
        })
      }

      if (lowerInput.includes('safety') || lowerInput.includes('risk')) {
        suggestions.push({
          id: 'en-3',
          text: 'Check the safety of this formula',
          type: 'question',
          category: 'Safety Assessment',
          confidence: 0.92,
        })
      }

      if (lowerInput.includes('compare') || lowerInput.includes('compare')) {
        suggestions.push({
          id: 'en-4',
          text: 'Compare these two formulas',
          type: 'question',
          category: 'Formula Comparison',
          confidence: 0.88,
        })
      }

      if (lowerInput.includes('optimize') || lowerInput.includes('improve')) {
        suggestions.push({
          id: 'en-5',
          text: 'How to optimize this formula',
          type: 'question',
          category: 'Formula Optimization',
          confidence: 0.85,
        })
      }
    } else {
      suggestions.push(
        {
          id: 'en-empty-1',
          text: 'Generate a moisturizing formula',
          type: 'command',
          category: 'Quick Actions',
          confidence: 0.9,
        },
        {
          id: 'en-empty-2',
          text: 'Analyze ingredient efficacy',
          type: 'command',
          category: 'Quick Actions',
          confidence: 0.85,
        },
        {
          id: 'en-empty-3',
          text: 'Safety assessment',
          type: 'command',
          category: 'Quick Actions',
          confidence: 0.8,
        },
      )

      if (context.length > 0) {
        const recentContext = context.slice(-2)
        recentContext.forEach((ctx, idx) => {
          suggestions.push({
            id: `en-context-${idx}`,
            text: ctx.length > 30 ? ctx.slice(0, 30) + '...' : ctx,
            type: 'statement',
            category: 'History',
            confidence: 0.75 - idx * 0.05,
          })
        })
      }
    }

    return suggestions
  }

  private generateGermanSuggestions(input: string, context: string[]): InputSuggestion[] {
    const suggestions: InputSuggestion[] = []
    const lowerInput = input.toLowerCase()

    if (input.trim()) {
      if (lowerInput.includes('formel') || lowerInput.includes('rezeptur') || lowerInput.includes('inhaltsstoff')) {
        suggestions.push({
          id: 'de-1',
          text: 'Helfen Sie mir, eine feuchtigkeitsspendende Formel zu erstellen',
          type: 'question',
          category: 'Formelgenerierung',
          confidence: 0.95,
        })
        suggestions.push({
          id: 'de-2',
          text: 'Analysieren Sie die Wirksamkeit dieses Inhaltsstoffs',
          type: 'question',
          category: 'Inhaltsstoffanalyse',
          confidence: 0.9,
        })
      }

      if (lowerInput.includes('sicherheit') || lowerInput.includes('risiko')) {
        suggestions.push({
          id: 'de-3',
          text: 'Prüfen Sie die Sicherheit dieser Formel',
          type: 'question',
          category: 'Sicherheitsbewertung',
          confidence: 0.92,
        })
      }

      if (lowerInput.includes('vergleich') || lowerInput.includes('vergleichen')) {
        suggestions.push({
          id: 'de-4',
          text: 'Vergleichen Sie diese beiden Formeln',
          type: 'question',
          category: 'Formelvergleich',
          confidence: 0.88,
        })
      }

      if (lowerInput.includes('optimieren') || lowerInput.includes('verbessern')) {
        suggestions.push({
          id: 'de-5',
          text: 'Wie kann diese Formel optimiert werden?',
          type: 'question',
          category: 'Formeloptimierung',
          confidence: 0.85,
        })
      }
    } else {
      suggestions.push(
        {
          id: 'de-empty-1',
          text: 'Feuchtigkeitsspendende Formel erstellen',
          type: 'command',
          category: 'Schnellaktionen',
          confidence: 0.9,
        },
        {
          id: 'de-empty-2',
          text: 'Inhaltsstoff-Wirksamkeit analysieren',
          type: 'command',
          category: 'Schnellaktionen',
          confidence: 0.85,
        },
        {
          id: 'de-empty-3',
          text: 'Sicherheitsbewertung',
          type: 'command',
          category: 'Schnellaktionen',
          confidence: 0.8,
        },
      )

      if (context.length > 0) {
        const recentContext = context.slice(-2)
        recentContext.forEach((ctx, idx) => {
          suggestions.push({
            id: `de-context-${idx}`,
            text: ctx.length > 30 ? ctx.slice(0, 30) + '...' : ctx,
            type: 'statement',
            category: 'Verlauf',
            confidence: 0.75 - idx * 0.05,
          })
        })
      }
    }

    return suggestions
  }
}

export const languageService = new LanguageService()
export default languageService
