import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGenerationHistory, type GenerationHistoryItem } from '../useGenerationHistory'

describe('useGenerationHistory', () => {
  const mockItems: Omit<GenerationHistoryItem, 'id'>[] = [
    {
      timestamp: Date.now(),
      targetEffects: ['免疫调节'],
      candidates: [],
      generator: 'rule_engine',
    },
    {
      timestamp: Date.now(),
      targetEffects: ['抗疲劳', '抗氧化'],
      candidates: [],
      generator: 'llm',
    },
  ]

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('should initialize with empty history when no storage', () => {
    const { result } = renderHook(() => useGenerationHistory())
    expect(result.current.history).toEqual([])
  })

  it('should load history from localStorage', () => {
    const storedItems: GenerationHistoryItem[] = [
      {
        id: 'test_id',
        ...mockItems[0],
      },
    ]
    localStorage.setItem('rmfood_generation_history', JSON.stringify(storedItems))

    const { result } = renderHook(() => useGenerationHistory())
    expect(result.current.history).toEqual(storedItems)
  })

  it('should add item to history', () => {
    const { result } = renderHook(() => useGenerationHistory())

    act(() => {
      result.current.addToHistory(mockItems[0])
    })

    expect(result.current.history.length).toBe(1)
    expect(result.current.history[0].targetEffects).toEqual(mockItems[0].targetEffects)
    expect(result.current.history[0].id).toBeDefined()
  })

  it('should persist history to localStorage', () => {
    const { result } = renderHook(() => useGenerationHistory())

    act(() => {
      result.current.addToHistory(mockItems[0])
    })

    const stored = localStorage.getItem('rmfood_generation_history')
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed.length).toBe(1)
    expect(parsed[0].targetEffects).toEqual(mockItems[0].targetEffects)
  })

  it('should remove item from history', () => {
    const { result } = renderHook(() => useGenerationHistory())

    act(() => {
      result.current.addToHistory(mockItems[0])
    })

    const itemId = result.current.history[0].id

    act(() => {
      result.current.removeFromHistory(itemId)
    })

    expect(result.current.history.length).toBe(0)
  })

  it('should clear all history', () => {
    const { result } = renderHook(() => useGenerationHistory())

    act(() => {
      result.current.addToHistory(mockItems[0])
      result.current.addToHistory(mockItems[1])
    })

    expect(result.current.history.length).toBe(2)

    act(() => {
      result.current.clearHistory()
    })

    expect(result.current.history.length).toBe(0)
    expect(localStorage.getItem('rmfood_generation_history')).toBeNull()
  })

  it('should return recent effects', () => {
    const { result } = renderHook(() => useGenerationHistory())

    act(() => {
      result.current.addToHistory(mockItems[0])
      result.current.addToHistory(mockItems[1])
    })

    const recentEffects = result.current.getRecentEffects()
    expect(recentEffects).toContain('免疫调节')
    expect(recentEffects).toContain('抗疲劳')
    expect(recentEffects).toContain('抗氧化')
  })

  it('should limit history to max size', () => {
    const { result } = renderHook(() => useGenerationHistory())

    for (let i = 0; i < 25; i++) {
      act(() => {
        result.current.addToHistory({
          timestamp: Date.now(),
          targetEffects: [`效果${i}`],
          candidates: [],
          generator: 'rule_engine',
        })
      })
    }

    expect(result.current.history.length).toBe(20)
  })
})