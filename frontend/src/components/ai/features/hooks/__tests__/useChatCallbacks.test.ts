import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatCallbacks } from '../useChatCallbacks'

vi.mock('../components/pro', () => ({
  saveSessions: vi.fn(),
}))

describe('useChatCallbacks', () => {
  const mockHistorySessions = [
    { id: 's1', title: '对话1', messageCount: 3, lastMessage: 'hi', timestamp: 1000 },
    { id: 's2', title: '对话2', messageCount: 5, lastMessage: 'hello', timestamp: 2000 },
  ]

  const createMockOptions = (overrides = {}) => ({
    historySessions: [...mockHistorySessions],
    setHistorySessions: vi.fn(),
    setActiveSessionId: vi.fn(),
    historyVisible: false,
    setHistoryVisible: vi.fn(),
    clearMessages: vi.fn(),
    clearAllFormulas: vi.fn(),
    clearMultiTurnDialogue: vi.fn(),
    ...overrides,
  })

  it('should return all callback functions', () => {
    const { result } = renderHook(() => useChatCallbacks(createMockOptions()))
    expect(typeof result.current.handleClearChat).toBe('function')
    expect(typeof result.current.handleNewSession).toBe('function')
    expect(typeof result.current.handleSelectSession).toBe('function')
    expect(typeof result.current.handleDeleteSession).toBe('function')
    expect(typeof result.current.handleRenameSession).toBe('function')
    expect(typeof result.current.toggleHistory).toBe('function')
  })

  it('handleClearChat should clear all states', () => {
    const options = createMockOptions()
    const { result } = renderHook(() => useChatCallbacks(options))

    act(() => result.current.handleClearChat())

    expect(options.clearMessages).toHaveBeenCalledOnce()
    expect(options.clearAllFormulas).toHaveBeenCalledOnce()
    expect(options.clearMultiTurnDialogue).toHaveBeenCalledOnce()
  })

  it('handleDeleteSession should filter and save', async () => {
    const options = createMockOptions()
    const { result } = renderHook(() => useChatCallbacks(options))

    await act(async () => {
      await result.current.handleDeleteSession('s1')
    })

    expect(options.setHistorySessions).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 's2' })])
    )
  })

  it('toggleHistory should invert visibility', () => {
    const setHistoryVisible = vi.fn()
    const options = createMockOptions({ setHistoryVisible, historyVisible: false })
    const { result } = renderHook(() => useChatCallbacks(options))

    act(() => result.current.toggleHistory())

    expect(setHistoryVisible).toHaveBeenCalledWith(expect.any(Function))
  })
})
