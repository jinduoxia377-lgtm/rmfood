/**
 * 智能搜索服务单元测试
 * 
 * @version 1.0.0
 * @lastUpdated 2026-05-21
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SmartSearchService, smartSearchService } from '../../../services/smartSearchService'

describe('SmartSearchService', () => {
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
      const service = new SmartSearchService()
      expect(service.getStatus().enabled).toBe(true)
      expect(service.getStatus().indexVersion).toBe('v1.0')
    })

    it('should initialize with custom config', () => {
      const service = new SmartSearchService({ timeout: 15000, maxResults: 10 })
      expect(service.getStatus().enabled).toBe(true)
    })
  })

  describe('getStatus', () => {
    it('should return correct status', () => {
      const status = smartSearchService.getStatus()
      expect(status).toEqual({ enabled: true, indexVersion: 'v1.0' })
    })
  })

  describe('search', () => {
    it('should return valid SmartSearchResult when API succeeds', async () => {
      const mockResponse = {
        results: [
          {
            id: '1',
            title: '测试结果',
            snippet: '测试摘要',
            category: 'knowledge' as const,
            relevance: 0.9,
            source: '知识库',
          },
        ],
        suggestions: [],
        semanticAnalysis: {
          tokens: ['测试'],
          synonyms: {},
          intent: 'search' as const,
          entities: [],
        },
        totalResults: 1,
      }

      ;(global.fetch as vi.Mock).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      })

      const result = await smartSearchService.search({ query: '测试' })
      expect(result.results).toHaveLength(1)
      expect(result.results[0].title).toBe('测试结果')
      expect(result.totalResults).toBe(1)
    })

    it('should return fallback result when API fails', async () => {
      ;(global.fetch as vi.Mock).mockRejectedValue(new Error('Network error'))

      const result = await smartSearchService.search({ query: '测试' })
      expect(result.results).toBeDefined()
      expect(result.results.length).toBeGreaterThan(0)
      expect(result.suggestions).toBeDefined()
    })

    it('should apply maxResults filter', async () => {
      ;(global.fetch as vi.Mock).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [],
          suggestions: [],
          semanticAnalysis: { tokens: [], synonyms: {}, intent: 'search', entities: [] },
          totalResults: 0,
        }),
      })

      await smartSearchService.search({ query: '测试', filters: { maxResults: 5 } })
      const callArgs = (global.fetch as vi.Mock).mock.calls[0]
      expect(callArgs[1].body).toContain('"maxResults":5')
    })
  })

  describe('getSuggestions', () => {
    it('should return suggestions from API', async () => {
      const mockSuggestions = [
        { text: '测试配方', type: 'autocomplete' as const, score: 0.9 },
      ]

      ;(global.fetch as vi.Mock).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ suggestions: mockSuggestions }),
      })

      const suggestions = await smartSearchService.getSuggestions('测试')
      expect(suggestions).toHaveLength(1)
      expect(suggestions[0].text).toBe('测试配方')
    })

    it('should return fallback suggestions when API fails', async () => {
      ;(global.fetch as vi.Mock).mockRejectedValue(new Error('Failed'))

      const suggestions = await smartSearchService.getSuggestions('测试')
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.some((s) => s.type === 'autocomplete')).toBe(true)
    })
  })

  describe('getPopularSearches', () => {
    it('should return popular searches from API', async () => {
      const mockSearches = ['热门1', '热门2']

      ;(global.fetch as vi.Mock).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ searches: mockSearches }),
      })

      const searches = await smartSearchService.getPopularSearches(2)
      expect(searches).toEqual(mockSearches)
    })

    it('should return fallback searches when API fails', async () => {
      ;(global.fetch as vi.Mock).mockRejectedValue(new Error('Failed'))

      const searches = await smartSearchService.getPopularSearches()
      expect(searches.length).toBeGreaterThan(0)
      expect(searches).toContain('护肤品配方')
    })
  })

  describe('fallbackSearch', () => {
    it('should generate mock results with different categories', async () => {
      ;(global.fetch as vi.Mock).mockRejectedValue(new Error('Failed'))

      const result = await smartSearchService.search({ query: '测试' })
      const categories = result.results.map((r) => r.category)
      expect(categories).toContain('knowledge')
      expect(categories).toContain('formula')
      expect(categories).toContain('ingredient')
    })

    it('should sort results by relevance', async () => {
      ;(global.fetch as vi.Mock).mockRejectedValue(new Error('Failed'))

      const result = await smartSearchService.search({ query: '测试' })
      const relevances = result.results.map((r) => r.relevance)
      for (let i = 1; i < relevances.length; i++) {
        expect(relevances[i - 1]).toBeGreaterThanOrEqual(relevances[i])
      }
    })
  })

  describe('analyzeQuery', () => {
    it('should tokenize query correctly', async () => {
      ;(global.fetch as vi.Mock).mockRejectedValue(new Error('Failed'))

      const result = await smartSearchService.search({ query: '测试 配方 的 功效' })
      expect(result.semanticAnalysis.tokens).toContain('测试')
      expect(result.semanticAnalysis.tokens).toContain('配方')
      expect(result.semanticAnalysis.tokens).toContain('功效')
    })

    it('should detect question intent', async () => {
      ;(global.fetch as vi.Mock).mockRejectedValue(new Error('Failed'))

      const result = await smartSearchService.search({ query: '这是什么？' })
      expect(result.semanticAnalysis.intent).toBe('question')
    })

    it('should find synonyms', async () => {
      ;(global.fetch as vi.Mock).mockRejectedValue(new Error('Failed'))

      const result = await smartSearchService.search({ query: '配方' })
      expect(result.semanticAnalysis.synonyms).toBeDefined()
      expect(Object.keys(result.semanticAnalysis.synonyms).length).toBeGreaterThan(0)
    })
  })
})
