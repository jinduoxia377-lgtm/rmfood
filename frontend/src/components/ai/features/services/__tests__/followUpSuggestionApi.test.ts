/**
 * followUpSuggestionApi 三态映射 + 35s AbortController 超时测试
 *
 * 补齐「可以继续追问」后端轨的降级契约覆盖（组件层竞速测试见
 * FollowUpSuggestionsBar.race.test.tsx，那里把本 API 整体 mock 掉）：
 * - source=llm：后端 LLM 成功 → 透传 llm + suggestions
 * - source=fallback：后端 LLM 未走通 → 透传 fallback（供 UI 标记降级态）
 * - success=false / 无 suggestions / 空 suggestions → unavailable
 * - AbortController 超时（35s）→ unavailable（AbortError 映射）
 * - 网络异常 → unavailable（不抛异常）
 * - question 为空 → 直接 unavailable（不发起请求，防 422）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchDynamicFollowUpSuggestions, mapCategoryToKey } from '../followUpSuggestionApi'
import { fetchWithCsrf } from '@/utils/csrf'
import type { Mock } from 'vitest'

vi.mock('@/utils/csrf', () => ({ fetchWithCsrf: vi.fn() }))
vi.mock('@/utils/safeLogger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockedFetch = fetchWithCsrf as unknown as Mock

/** 构造 AbortError（超时时 AbortController 产生的错误名） */
function abortError() {
  return Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

const baseParams = { question: '帮我设计助眠配方', answer: '黄芪 10g 助眠方。' }

describe('followUpSuggestionApi 三态映射', () => {
  it('后端返回 source=llm → 透传 llm + 映射后的 suggestions', async () => {
    mockedFetch.mockResolvedValue({
      success: true,
      source: 'llm',
      suggestions: [
        { question: '黄芪的用量依据？', category: '配方设计' },
        { question: '', category: '药材知识' }, // 空问题应被过滤
      ],
    })
    const result = await fetchDynamicFollowUpSuggestions(baseParams)
    expect(result.source).toBe('llm')
    expect(result).toMatchObject({ source: 'llm' })
    if (result.source === 'llm') {
      expect(result.suggestions).toHaveLength(1) // 空问题被过滤掉
      expect(result.suggestions[0].question).toBe('黄芪的用量依据？')
      expect(result.suggestions[0].categoryKey).toBe('formulaDesign')
      expect(result.suggestions[0].source).toBe('llm')
    }
  })

  it('后端返回 source=fallback → 透传 fallback（供 UI 标记降级）', async () => {
    mockedFetch.mockResolvedValue({
      success: true,
      source: 'fallback',
      suggestions: [{ question: '固定兜底问题', category: '药材知识' }],
    })
    const result = await fetchDynamicFollowUpSuggestions(baseParams)
    expect(result).toMatchObject({ source: 'fallback' })
  })

  it('success=false → unavailable', async () => {
    mockedFetch.mockResolvedValue({ success: false, suggestions: [] })
    expect(await fetchDynamicFollowUpSuggestions(baseParams)).toEqual({ source: 'unavailable', suggestions: null })
  })

  it('无 suggestions 数组 → unavailable', async () => {
    mockedFetch.mockResolvedValue({ success: true })
    expect(await fetchDynamicFollowUpSuggestions(baseParams)).toEqual({ source: 'unavailable', suggestions: null })
  })

  it('suggestions 为空数组 → unavailable', async () => {
    mockedFetch.mockResolvedValue({ success: true, source: 'llm', suggestions: [] })
    expect(await fetchDynamicFollowUpSuggestions(baseParams)).toEqual({ source: 'unavailable', suggestions: null })
  })

  it('question 为空 → 直接 unavailable，不发起请求（防 422）', async () => {
    const result = await fetchDynamicFollowUpSuggestions({ ...baseParams, question: '   ' })
    expect(result).toEqual({ source: 'unavailable', suggestions: null })
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('领域上下文字段仅有值时透传（formula_context/constitution 等）', async () => {
    mockedFetch.mockResolvedValue({ success: true, source: 'llm', suggestions: [{ question: 'q', category: '配方设计' }] })
    await fetchDynamicFollowUpSuggestions({
      ...baseParams,
      formula_context: '黄芪 10g',
      constitution: '气虚质',
      rag_context: ['知识块'],
    })
    const body = JSON.parse(mockedFetch.mock.calls[0][1].body)
    expect(body.formula_context).toBe('黄芪 10g')
    expect(body.constitution).toBe('气虚质')
    expect(body.rag_context).toEqual(['知识块'])
    // 未传的字段不出现在 body（取不到就不传，向后兼容旧后端）
    expect('user_constraints' in body).toBe(false)
    expect(body.max_suggestions).toBe(3)
  })
})

describe('followUpSuggestionApi 超时/异常降级', () => {
  it('35s AbortController 超时 → unavailable（AbortError 映射，静默不抛）', async () => {
    vi.useFakeTimers()
    // 模拟真实 fetch：尊重 signal，abort 时以 AbortError reject
    mockedFetch.mockImplementation((_url: string, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        const signal = options.signal
        if (signal?.aborted) { reject(abortError()); return }
        signal?.addEventListener('abort', () => reject(abortError()))
      }),
    )

    const promise = fetchDynamicFollowUpSuggestions(baseParams)
    const assertion = expect(promise).resolves.toEqual({ source: 'unavailable', suggestions: null })

    // 推进到 35s 超时点 → controller.abort() → fetch 以 AbortError 失败 → 映射 unavailable
    await vi.advanceTimersByTimeAsync(35_000)
    await assertion
  })

  it('网络异常（非 AbortError）→ unavailable，不抛异常', async () => {
    mockedFetch.mockRejectedValue(new Error('net::ERR_FAILED'))
    await expect(fetchDynamicFollowUpSuggestions(baseParams)).resolves.toEqual({
      source: 'unavailable',
      suggestions: null,
    })
  })

  it('非 200（fetchWithCsrf 抛 HTTP 错误）→ unavailable', async () => {
    mockedFetch.mockRejectedValue(new Error('HTTP 500: Internal Server Error'))
    await expect(fetchDynamicFollowUpSuggestions(baseParams)).resolves.toEqual({
      source: 'unavailable',
      suggestions: null,
    })
  })
})

describe('mapCategoryToKey 分类中文 → i18n key', () => {
  it('命中映射表', () => {
    expect(mapCategoryToKey('配方设计')).toBe('formulaDesign')
    expect(mapCategoryToKey('安全合规')).toBe('safetyCompliance')
    expect(mapCategoryToKey('体质辨识')).toBe('constitution')
  })

  it('未命中回落 herbKnowledge', () => {
    expect(mapCategoryToKey('未知分类')).toBe('herbKnowledge')
  })
})
