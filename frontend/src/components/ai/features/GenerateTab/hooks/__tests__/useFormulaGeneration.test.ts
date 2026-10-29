/**
 * useFormulaGeneration Hook 单测
 *
 * mock aiApi.generate，覆盖：
 * - 成功：返回 candidates 并设置 generateResult / generator
 * - 失败：设置 errorMessage
 * - 取消：abort 信号被触发并重置 mutation
 * - loading：isGenerating 状态
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockGenerate } = vi.hoisted(() => ({ mockGenerate: vi.fn() }))

vi.mock('@/api/ai', () => ({
  aiApi: {
    generate: mockGenerate,
  },
}))

vi.mock('@/components/ui', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('@/utils/safeLogger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    startTimer: vi.fn(() => ({ end: vi.fn() })),
  },
}))

import { useFormulaGeneration } from '../useFormulaGeneration'
import { resetGenerationStoreForTest } from '@/stores/generationStore'

const makeCandidate = (overrides: Record<string, unknown> = {}) => ({
  id: 'cand_1',
  name: '测试配方',
  ingredients: [{ name: '黄芪', dosage: '10', unit: 'g' }],
  score: 0.9,
  effects: ['免疫调节'],
  ...overrides,
})

describe('useFormulaGeneration', () => {
  let queryClient: QueryClient
  let wrapper: React.FC<{ children: React.ReactNode }>

  beforeEach(() => {
    // P3：生成状态已提升到全局 store，每个用例前重置，避免用例间串扰
    resetGenerationStoreForTest()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)
    vi.clearAllMocks()
    mockGenerate.mockResolvedValue({
      candidates: [makeCandidate()],
      total: 1,
      generator: 'ga_optimizer',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('成功：mock aiApi.generate 返回 candidates 并设置结果', async () => {
    const { result } = renderHook(() => useFormulaGeneration({}), { wrapper })

    act(() => {
      result.current.mutation.mutate(['免疫调节'])
    })

    await waitFor(() => expect(result.current.isGenerating).toBe(false))

    expect(mockGenerate).toHaveBeenCalledWith(
      ['免疫调节'],
      undefined, // constraints
      false, // useLlm
      expect.any(AbortSignal), // signal
      undefined, // algorithmConfig
    )
    expect(result.current.generateResult).toHaveLength(1)
    expect(result.current.generateResult![0].id).toBe('cand_1')
    // mutationFn 归一化 'ga_optimizer' → 'ga'，onSuccess 直接使用该值
    expect(result.current.generator).toBe('ga')
    expect(result.current.errorMessage).toBeNull()
  })

  it('失败：aiApi.generate 抛错时设置错误信息', async () => {
    mockGenerate.mockRejectedValue(new Error('NetworkError'))
    const { result } = renderHook(() => useFormulaGeneration({}), { wrapper })

    act(() => {
      result.current.mutation.mutate(['免疫调节'])
    })

    await waitFor(() => expect(result.current.errorMessage).not.toBeNull())

    expect(result.current.generateResult).toBeNull()
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.errorMessage).toContain('请检查网络')
  })

  it('取消：handleCancelGeneration 触发 abort 并重置', async () => {
    let capturedSignal: AbortSignal | undefined
    mockGenerate.mockImplementation(
      (_effects: string[], _constraints: unknown, _useLlm: boolean, signal?: AbortSignal) => {
        capturedSignal = signal
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        })
      },
    )

    const { result } = renderHook(() => useFormulaGeneration({}), { wrapper })

    act(() => {
      result.current.mutation.mutate(['免疫调节'])
    })
    await waitFor(() => expect(result.current.isGenerating).toBe(true))

    act(() => {
      result.current.handleCancelGeneration()
    })

    expect(capturedSignal?.aborted).toBe(true)
    await waitFor(() => expect(result.current.isGenerating).toBe(false))
  })

  it('loading：生成中 isGenerating 为 true 且未设置结果', async () => {
    mockGenerate.mockImplementation(() => new Promise(() => {})) // 永不 resolve
    const { result } = renderHook(() => useFormulaGeneration({}), { wrapper })

    act(() => {
      result.current.mutation.mutate(['免疫调节'])
    })

    await waitFor(() => expect(result.current.isGenerating).toBe(true))
    expect(result.current.generateResult).toBeNull()
    expect(result.current.errorMessage).toBeNull()
  })
})