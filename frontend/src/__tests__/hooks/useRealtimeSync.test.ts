/**
 * useRealtimeSync Hook 测试
 *
 * 测试 CDC 实时同步功能：
 * - WebSocket 消息监听
 * - React Query 缓存失效
 * - 防抖机制
 * - 实体类型映射
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock WebSocket service - 使用 vi.hoisted 确保变量在 mock 之前初始化
const { mockOnMessage, mockUnsubscribe } = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn()
  const mockOnMessage = vi.fn().mockReturnValue(mockUnsubscribe)
  return { mockOnMessage, mockUnsubscribe }
})

vi.mock('@/services/websocket', () => ({
  wsService: {
    onMessage: mockOnMessage,
  },
}))

// Mock logger
vi.mock('@/utils/safeLogger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { useRealtimeSync } from '@/hooks/useRealtimeSync'

describe('useRealtimeSync', () => {
  let queryClient: QueryClient
  let wrapper: React.FC<{ children: React.ReactNode }>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    // Reset mocks
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Re-setup mock return value after clearAllMocks
    mockOnMessage.mockReturnValue(mockUnsubscribe)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should subscribe to WebSocket messages on mount', () => {
    renderHook(() => useRealtimeSync(), { wrapper })

    expect(mockOnMessage).toHaveBeenCalledTimes(1)
    expect(mockOnMessage).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useRealtimeSync(), { wrapper })

    unmount()

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('should invalidate queries on CDC message', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    let messageHandler: (message: unknown) => void
    mockOnMessage.mockImplementation((handler) => {
      messageHandler = handler
      return mockUnsubscribe
    })

    renderHook(() => useRealtimeSync(), { wrapper })

    // Simulate CDC message
    act(() => {
      messageHandler!({
        type: 'data_change',
        data: {
          entity_type: 'formulas',
          entity_id: 123,
          action: 'UPDATE',
          changed_fields: ['name'],
          user_id: 1,
        },
      })
    })

    // Fast-forward debounce timer
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['formulas'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['formula'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] })
  })

  it('should debounce multiple CDC messages', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    let messageHandler: (message: unknown) => void
    mockOnMessage.mockImplementation((handler) => {
      messageHandler = handler
      return mockUnsubscribe
    })

    renderHook(() => useRealtimeSync(), { wrapper })

    // Simulate multiple CDC messages
    act(() => {
      messageHandler!({
        type: 'data_change',
        data: { entity_type: 'formulas', entity_id: 1, action: 'INSERT' },
      })
      messageHandler!({
        type: 'data_change',
        data: { entity_type: 'formulas', entity_id: 2, action: 'INSERT' },
      })
      messageHandler!({
        type: 'data_change',
        data: { entity_type: 'experiments', entity_id: 1, action: 'UPDATE' },
      })
    })

    // Fast-forward debounce timer
    act(() => {
      vi.advanceTimersByTime(300)
    })

    // Should invalidate both formulas and experiments queries
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['formulas'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['experiments'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] })
  })

  it('should ignore non-CDC messages', () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    let messageHandler: (message: unknown) => void
    mockOnMessage.mockImplementation((handler) => {
      messageHandler = handler
      return mockUnsubscribe
    })

    renderHook(() => useRealtimeSync(), { wrapper })

    // Simulate non-CDC message
    act(() => {
      messageHandler!({
        type: 'heartbeat',
        data: { timestamp: Date.now() },
      })
    })

    // Fast-forward debounce timer
    act(() => {
      vi.advanceTimersByTime(300)
    })

    // Should not invalidate any queries
    expect(invalidateQueriesSpy).not.toHaveBeenCalled()
  })

  it('should handle unknown entity types gracefully', () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    let messageHandler: (message: unknown) => void
    mockOnMessage.mockImplementation((handler) => {
      messageHandler = handler
      return mockUnsubscribe
    })

    renderHook(() => useRealtimeSync(), { wrapper })

    // Simulate CDC message with unknown entity type
    act(() => {
      messageHandler!({
        type: 'data_change',
        data: { entity_type: 'unknown_entity', entity_id: 1, action: 'INSERT' },
      })
    })

    // Fast-forward debounce timer
    act(() => {
      vi.advanceTimersByTime(300)
    })

    // Should not invalidate any queries for unknown entity
    expect(invalidateQueriesSpy).not.toHaveBeenCalled()
  })

  it('should map entity types to correct query keys', () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    let messageHandler: (message: unknown) => void
    mockOnMessage.mockImplementation((handler) => {
      messageHandler = handler
      return mockUnsubscribe
    })

    renderHook(() => useRealtimeSync(), { wrapper })

    // Test different entity types
    const testCases = [
      { entity_type: 'notifications', expected: ['notifications'] },
      { entity_type: 'teams', expected: ['teams', 'team'] },
      { entity_type: 'users', expected: ['users', 'user', 'auth'] },
      { entity_type: 'workflows', expected: ['workflows', 'workflow'] },
    ]

    for (const testCase of testCases) {
      invalidateQueriesSpy.mockClear()

      act(() => {
        messageHandler!({
          type: 'data_change',
          data: { entity_type: testCase.entity_type, entity_id: 1, action: 'INSERT' },
        })
      })

      act(() => {
        vi.advanceTimersByTime(300)
      })

      for (const key of testCase.expected) {
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: [key] })
      }
    }
  })
})
