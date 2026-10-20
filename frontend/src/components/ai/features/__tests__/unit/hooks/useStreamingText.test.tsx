import { renderHook, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useStreamingText } from '../../../hooks/useStreamingText'

/**
 * useStreamingText 单元测试（对齐 v7.1 当前 API）
 * 当前返回值：displayedText / formattedHtml / isComplete / progress /
 * appendChunk / reset / interrupt / resume / getFormattingStats / reformat / getFormattingMode
 */
describe('useStreamingText', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** 推进打字机动画帧，使缓冲文本刷新到 displayedText */
  const flush = () => {
    act(() => {
      vi.advanceTimersByTime(3000)
    })
  }

  describe('打字机效果', () => {
    it('应逐步显示流式文本内容', () => {
      const { result } = renderHook(() => useStreamingText())

      const chunks = ['Hello', ', ', 'World', '!']
      chunks.forEach(chunk => {
        act(() => {
          result.current.appendChunk(chunk)
        })
      })
      flush()

      expect(result.current.displayedText).toBe('Hello, World!')
      expect(result.current.isComplete).toBe(true)
    })

    it('应实时更新当前显示的文本', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.appendChunk('第一部分')
      })
      flush()
      expect(result.current.displayedText).toBe('第一部分')

      act(() => {
        result.current.appendChunk(' 第二部分')
      })
      flush()
      expect(result.current.displayedText).toBe('第一部分 第二部分')
    })

    it('应处理空 chunk', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.appendChunk('')
      })
      flush()

      expect(result.current.displayedText).toBe('')
    })
  })

  describe('流式状态管理', () => {
    it('应在完成后标记 isComplete', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.appendChunk('完整文本')
      })
      flush()

      expect(result.current.isComplete).toBe(true)
      expect(result.current.displayedText).toBe('完整文本')
    })

    it('appendChunk 后应推进文本显示', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.appendChunk('一段文本')
      })
      flush()

      expect(result.current.displayedText).toBe('一段文本')
      expect(result.current.isComplete).toBe(true)
    })
  })

  describe('中断与恢复', () => {
    it('应支持中断当前的流式传输', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.appendChunk('部分内容')
        // 在动画尚未 flush 前立即中断
        result.current.interrupt()
      })
      flush()

      // 中断后缓冲不再输出
      expect(result.current.displayedText).not.toBe('部分内容')
      expect(result.current.isComplete).toBe(false)
    })

    it('应从中断点恢复流式传输', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.appendChunk('中断前 ')
      })
      flush()
      act(() => {
        result.current.interrupt()
      })
      act(() => {
        result.current.resume()
        result.current.appendChunk('恢复后')
      })
      flush()

      expect(result.current.displayedText).toBe('中断前 恢复后')
      expect(result.current.isComplete).toBe(true)
    })
  })

  describe('重置功能', () => {
    it('应完全重置所有状态', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.appendChunk('要清除的文本')
      })
      flush()
      act(() => {
        result.current.interrupt()
        result.current.reset()
      })

      expect(result.current.displayedText).toBe('')
      expect(result.current.isComplete).toBe(false)
      expect(result.current.progress).toBe(0)
    })
  })

  describe('性能优化', () => {
    it('应高效处理大量 chunk（1000+）', () => {
      const { result } = renderHook(() => useStreamingText())

      const startTime = performance.now()

      act(() => {
        for (let i = 0; i < 1000; i++) {
          result.current.appendChunk(`chunk${i} `)
        }
      })
      flush()

      const endTime = performance.now()

      expect(result.current.displayedText.length).toBeGreaterThan(0)
      expect(endTime - startTime).toBeLessThan(5000)
    })

    it('不应因无关操作引起不必要的重置', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.appendChunk('test')
      })
      flush()

      expect(result.current.displayedText).toBe('test')
    })
  })

  describe('Markdown 实时渲染', () => {
    it('应生成可渲染的 Markdown HTML', () => {
      const { result } = renderHook(() => useStreamingText({ formattingMode: 'markdown' }))

      act(() => {
        result.current.appendChunk('# 标题\n\n')
        result.current.appendChunk('这是**加粗**文本')
      })
      flush()

      expect(result.current.formattedHtml).toContain('h1')
      expect(result.current.formattedHtml).toContain('strong')
    })

    it('应处理不完整的 Markdown 标记而不崩溃', () => {
      const { result } = renderHook(() => useStreamingText({ formattingMode: 'markdown' }))

      act(() => {
        result.current.appendChunk('未完成的**加粗')
      })
      flush()

      expect(result.current.formattedHtml.length).toBeGreaterThan(0)
    })
  })

  describe('格式化统计', () => {
    it('应返回格式统计信息', () => {
      const { result } = renderHook(() => useStreamingText())

      act(() => {
        result.current.appendChunk('文本')
      })
      flush()

      const stats = result.current.getFormattingStats()
      expect(stats).toBeDefined()
      expect(stats.totalCharacters).toBeGreaterThan(0)
    })

    it('reformat 不应抛出异常', () => {
      const { result } = renderHook(() => useStreamingText({ formattingMode: 'markdown' }))

      act(() => {
        result.current.appendChunk('# 标题')
      })
      flush()

      expect(() => {
        act(() => {
          result.current.reformat()
        })
      }).not.toThrow()
    })
  })
})