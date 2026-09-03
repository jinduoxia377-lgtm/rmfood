// @ts-nocheck
import { renderHook, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { useStreamingText } from '../../../hooks/useStreamingText'
import { TEST_CONSTANTS } from '../../helpers/testFactories'

describe('useStreamingText', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('打字机效果', () => {
    it('应逐步显示流式文本内容', () => {
      const { result } = renderHook(() => useStreamingText())

      const chunks = ['Hello', ', ', 'World', '!']

      chunks.forEach(chunk => {
        act(() => {
          result.current.appendChunk(chunk)
        })
      })

      expect(result.current.displayedText).toBe('Hello, World!')
    })

    it('应实时更新当前显示的文本', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.appendChunk('第一部分')
      })
      expect(result.current.displayedText).toBe('第一部分')

      act(() => {
        result.current.appendChunk(' 第二部分')
      })
      expect(result.current.displayedText).toBe('第一部分 第二部分')
    })

    it('应处理空 chunk', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.appendChunk('')
      })

      expect(result.current.displayedText).toBe('')
    })
  })

  describe('流式状态管理', () => {
    it('应在开始接收时设置 isStreaming 为 true', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.startStreaming()
      })

      expect(result.current.isStreaming).toBe(true)
    })

    it('应在完成时设置 isStreaming 为 false 并标记完成', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.startStreaming()
        result.current.appendChunk('完整文本')
        result.current.completeStreaming()
      })

      expect(result.current.isStreaming).toBe(false)
      expect(result.current.isComplete).toBe(true)
      expect(result.current.displayedText).toBe('完整文本')
    })
  })

  describe('中断与恢复', () => {
    it('应支持中断当前的流式传输', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.startStreaming()
        result.current.appendChunk('部分内容')
        result.current.interruptStreaming()
      })

      expect(result.current.isStreaming).toBe(false)
      expect(result.current.isInterrupted).toBe(true)
      expect(result.current.displayedText).toBe('部分内容')
    })

    it('应从中断点恢复流式传输', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.startStreaming()
        result.current.appendChunk('中断前 ')
        result.current.interruptStreaming()
        result.current.resumeStreaming()
      })

      expect(result.current.isStreaming).toBe(true)
      expect(result.current.isInterrupted).toBe(false)

      act(() => {
        result.current.appendChunk('恢复后')
        result.current.completeStreaming()
      })

      expect(result.current.displayedText).toBe('中断前 恢复后')
      expect(result.current.isComplete).toBe(true)
    })
  })

  describe('重置功能', () => {
    it('应完全重置所有状态', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.startStreaming()
        result.current.appendChunk('要清除的文本')
        result.current.interruptStreaming()
        result.current.reset()
      })

      expect(result.current.displayedText).toBe('')
      expect(result.current.isStreaming).toBe(false)
      expect(result.current.isComplete).toBe(false)
      expect(result.current.isInterrupted).toBe(false)
    })
  })

  describe('性能优化', () => {
    it('应高效处理大量 chunk（1000+）', () => {
      const { result } = renderHook(() => useStreamingText())

      const startTime = performance.now()

      act(() => {
        result.current.startStreaming()
        for (let i = 0; i < 1000; i++) {
          result.current.appendChunk(`chunk${i} `)
        }
        result.current.completeStreaming()
      })

      const endTime = performance.now()

      expect(result.current.displayedText.length).toBeGreaterThan(0)
      expect(endTime - startTime).toBeLessThan(100)
    })

    it('不应引起不必要的重新渲染', () => {
      const renderSpy = jest.fn()
      const { result } = renderHook(() => {
        renderSpy()
        return useStreamingText()
      })

      const initialRenders = renderSpy.mock.calls.length

      act(() => {
        result.current.startStreaming()
        result.current.appendChunk('test')
      })

      expect(renderSpy.mock.calls.length).toBe(initialRenders + 2)
    })
  })

  describe('Markdown 实时渲染', () => {
    it('应逐步构建可渲染的 Markdown 内容', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.startStreaming()
        result.current.appendChunk('# 标题\n\n')
        result.current.appendChunk('这是**加粗**文本')
      })

      const markdown = result.current.getMarkdownContent()
      expect(markdown).toContain('# 标题')
      expect(markdown).toContain('**加粗**')
    })

    it('应处理不完整的 Markdown 标记', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.startStreaming()
        result.current.appendChunk('未完成的**加粗')
      })

      expect(result.current.getMarkdownContent()).toContain('未完成的**加粗')
    })
  })

  describe('与 ChatStateMachine 集成', () => {
    it('应在不同状态下正确响应', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.startStreaming()
      })

      expect(result.current.canAppend).toBe(true)
      expect(result.current.canInterrupt).toBe(true)

      act(() => {
        result.current.completeStreaming()
      })

      expect(result.current.canAppend).toBe(false)
      expect(result.current.canInterrupt).toBe(false)

      act(() => {
        result.current.reset()
        result.current.startStreaming()
      })

      expect(result.current.canAppend).toBe(true)
    })
  })
})
