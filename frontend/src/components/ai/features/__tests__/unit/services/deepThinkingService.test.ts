/**
 * 深度思考服务单元测试
 * 
 * @version 1.0.0
 * @lastUpdated 2026-05-21
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DeepThinkingService, deepThinkingService } from '../../../services/deepThinkingService'

describe('DeepThinkingService', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    global.fetch = originalFetch
  })

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const service = new DeepThinkingService()
      expect(service.getStatus().enabled).toBe(true)
      expect(service.getStatus().model).toBe('deep-thinking-v1')
    })

    it('should initialize with custom config', () => {
      const service = new DeepThinkingService({ timeout: 15000 })
      expect(service.getStatus().enabled).toBe(true)
    })
  })

  describe('getStatus', () => {
    it('should return correct status', () => {
      const status = deepThinkingService.getStatus()
      expect(status).toEqual({ enabled: true, model: 'deep-thinking-v1' })
    })
  })

  describe('analyze', () => {
    it('should return valid DeepThinkingResult when API succeeds', async () => {
      const mockResponse = {
        semanticAnalysis: {
          entities: [{ name: '测试', type: 'ingredient' as const, confidence: 0.9 }],
          keywords: ['测试'],
          sentiment: 'neutral' as const,
          sentimentScore: 0,
          intent: 'question' as const,
          intentConfidence: 0.8,
        },
        contextAnalysis: {
          references: [],
          contextWindow: [],
          topicContinuity: 0.5,
          isFollowUp: false,
          relatedQuestions: ['测试相关问题'],
        },
        logicalReasoning: {
          steps: [{ step: 1, description: '分析', confidence: 0.9 }],
          conclusion: '结论',
          supportingEvidence: ['证据'],
          confidence: 0.8,
        },
        enhancedPrompt: '增强提示',
      }

      ;(global.fetch as vi.Mock).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      })

      const result = await deepThinkingService.analyze('测试问题')
      expect(result.semanticAnalysis.entities).toHaveLength(1)
      expect(result.semanticAnalysis.intent).toBe('question')
      expect(result.enhancedPrompt).toBe('增强提示')
    })

    it('should return fallback result when API fails', async () => {
      ;(global.fetch as vi.Mock).mockRejectedValue(new Error('Network error'))

      const result = await deepThinkingService.analyze('测试问题')
      expect(result.semanticAnalysis).toBeDefined()
      expect(result.contextAnalysis).toBeDefined()
      expect(result.logicalReasoning).toBeDefined()
    })
  })

  describe('fallbackAnalysis', () => {
    it('should extract entities correctly', async () => {
      ;(global.fetch as vi.Mock).mockRejectedValue(new Error('Failed'))

      const result = await deepThinkingService.analyze('测试提取物的功效')
      const entities = result.semanticAnalysis.entities
      expect(entities.some((e) => e.type === 'ingredient')).toBe(true)
    })

    it('should detect intent correctly', async () => {
      ;(global.fetch as vi.Mock).mockRejectedValue(new Error('Failed'))

      const questionResult = await deepThinkingService.analyze('这是什么？')
      expect(questionResult.semanticAnalysis.intent).toBe('question')

      const requestResult = await deepThinkingService.analyze('请帮我分析')
      expect(requestResult.semanticAnalysis.intent).toBe('request')
    })

    it('should analyze sentiment correctly', async () => {
      ;(global.fetch as vi.Mock).mockRejectedValue(new Error('Failed'))

      const positiveResult = await deepThinkingService.analyze('这个很棒')
      expect(positiveResult.semanticAnalysis.sentiment).toBe('positive')

      const negativeResult = await deepThinkingService.analyze('这个很差')
      expect(negativeResult.semanticAnalysis.sentiment).toBe('negative')
    })

    it('should extract keywords correctly', async () => {
      ;(global.fetch as vi.Mock).mockRejectedValue(new Error('Failed'))

      const result = await deepThinkingService.analyze('测试 配方 的 功效 分析')
      const keywords = result.semanticAnalysis.keywords
      expect(keywords).toContain('测试')
      expect(keywords).toContain('配方')
      expect(keywords).toContain('功效')
      expect(keywords).toContain('分析')
    })
  })

  describe('enhancePrompt', () => {
    it('should generate enhanced prompt with context', async () => {
      ;(global.fetch as vi.Mock).mockRejectedValue(new Error('Failed'))

      const result = await deepThinkingService.analyze('测试问题', ['上下文1', '上下文2'])
      expect(result.enhancedPrompt).toContain('测试问题')
      expect(result.enhancedPrompt).toContain('上下文1')
      expect(result.enhancedPrompt).toContain('上下文2')
    })

    it('should handle empty context', async () => {
      ;(global.fetch as vi.Mock).mockRejectedValue(new Error('Failed'))

      const result = await deepThinkingService.analyze('测试问题')
      expect(result.enhancedPrompt).toContain('无')
    })
  })
})
