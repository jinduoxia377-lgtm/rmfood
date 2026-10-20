/**
 * 深度思考服务 V2 单元测试
 * 覆盖：API 成功解析、API 失败降级分析、实体/意图/情感/关键词提取、增强提示生成
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deepThinkingServiceV2 } from '../../../services/deepThinkingService'

vi.mock('../../../services/eventBus', () => ({
  eventBus: { emit: vi.fn(), subscribe: vi.fn().mockReturnValue(vi.fn()) },
}))

describe('DeepThinkingServiceV2', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('analyze - API 成功', () => {
    it('应返回多维度分析结果', async () => {
      const mockResponse = {
        semanticAnalysis: {
          entities: [{ name: '测试', type: 'ingredient', confidence: 0.9 }],
          keywords: ['测试'],
          sentiment: 'neutral',
          sentimentScore: 0,
          intent: 'question',
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

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      })

      const result = await deepThinkingServiceV2.analyze('测试问题')
      expect(result.semanticAnalysis.entities).toHaveLength(1)
      expect(result.semanticAnalysis.intent).toBe('question')
      expect(result.enhancedPrompt).toBe('增强提示')
    })
  })

  describe('analyze - API 失败降级', () => {
    it('应返回降级分析结果', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'))

      const result = await deepThinkingServiceV2.analyze('测试问题')
      expect(result.semanticAnalysis).toBeDefined()
      expect(result.contextAnalysis).toBeDefined()
      expect(result.logicalReasoning).toBeDefined()
    })

    it('应正确提取实体', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed'))

      const result = await deepThinkingServiceV2.analyze('测试提取物的功效')
      const entities = result.semanticAnalysis.entities
      expect(entities.some((e) => e.type === 'ingredient')).toBe(true)
    })

    it('应正确检测意图', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed'))

      const questionResult = await deepThinkingServiceV2.analyze('这是什么？')
      expect(questionResult.semanticAnalysis.intent).toBe('question')

      const requestResult = await deepThinkingServiceV2.analyze('请帮我分析')
      expect(requestResult.semanticAnalysis.intent).toBe('request')
    })

    it('应正确分析情感', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed'))

      const positiveResult = await deepThinkingServiceV2.analyze('这个很棒')
      expect(positiveResult.semanticAnalysis.sentiment).toBe('positive')

      const negativeResult = await deepThinkingServiceV2.analyze('这个很差')
      expect(negativeResult.semanticAnalysis.sentiment).toBe('negative')
    })

    it('应正确提取关键词', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed'))

      const result = await deepThinkingServiceV2.analyze('测试 配方 的 功效 分析')
      const keywords = result.semanticAnalysis.keywords
      expect(keywords).toContain('测试')
      expect(keywords).toContain('配方')
      expect(keywords).toContain('功效')
      expect(keywords).toContain('分析')
    })
  })

  describe('增强提示生成', () => {
    it('应包含问题与上下文', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed'))

      const result = await deepThinkingServiceV2.analyze('测试问题', ['上下文1', '上下文2'])
      expect(result.enhancedPrompt).toContain('测试问题')
      expect(result.enhancedPrompt).toContain('上下文1')
      expect(result.enhancedPrompt).toContain('上下文2')
    })

    it('应处理空上下文', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed'))

      const result = await deepThinkingServiceV2.analyze('测试问题')
      expect(result.enhancedPrompt).toContain('无')
    })
  })
})