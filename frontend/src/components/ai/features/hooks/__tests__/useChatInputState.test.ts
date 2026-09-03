import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
// @ts-expect-error - vitest environment testing-library compatibility
import { renderHook, act } from '@testing-library/react'
import { useChatInputState } from '../useChatInputState'

vi.mock('../../services/languageService', () => ({
  languageService: {
    detectLanguage: vi.fn().mockReturnValue({ language: 'zh-CN' }),
    getSuggestions: vi.fn().mockReturnValue([]),
  },
}))

vi.mock('../../services/userPreferencesService', () => ({
  userPreferencesService: {
    getInputBehavior: vi.fn().mockReturnValue({
      autoResize: true,
      minHeight: 44,
      maxHeight: 200,
      showSuggestions: true,
      showCharCount: true,
    }),
    subscribe: vi.fn().mockReturnValue(vi.fn()),
    getHotkey: vi.fn(),
  },
}))

vi.mock('../../services/clipboardAttachmentService', () => ({
  clipboardAttachmentService: {
    setupPasteHandler: vi.fn().mockReturnValue(vi.fn()),
    setupDropZone: vi.fn().mockReturnValue(vi.fn()),
    handleFiles: vi.fn().mockResolvedValue([]),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
}))

describe('useChatInputState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('初始化', () => {
    it('应使用默认初始值', () => {
      const { result } = renderHook(() => useChatInputState())
      
      expect(result.current.value).toBe('')
      expect(result.current.isFocused).toBe(false)
      expect(result.current.charCount).toBe(0)
      expect(result.current.inputHeight).toBe(44)
      expect(result.current.showSuggestions).toBe(false)
      expect(result.current.deepThinking).toBe(false)
      expect(result.current.smartSearch).toBe(false)
      expect(result.current.attachments).toEqual([])
      expect(result.current.detectedLanguage).toBe('zh-CN')
    })

    it('应支持自定义初始值', () => {
      const { result } = renderHook(() => useChatInputState({
        initialValue: 'Hello World',
      }))
      
      expect(result.current.value).toBe('Hello World')
      expect(result.current.charCount).toBe(11)
    })

    it('应支持外部控制深度思考和智能搜索状态', () => {
      const { result } = renderHook(() => useChatInputState({
        externalDeepThinking: true,
        externalSmartSearch: true,
      }))
      
      expect(result.current.deepThinking).toBe(true)
      expect(result.current.smartSearch).toBe(true)
    })
  })

  describe('输入管理', () => {
    it('应正确更新输入值', () => {
      const { result } = renderHook(() => useChatInputState())
      
      act(() => {
        result.current.onChange('New value')
      })
      
      expect(result.current.value).toBe('New value')
      expect(result.current.charCount).toBe(9)
    })

    it('应处理焦点状态', () => {
      const { result } = renderHook(() => useChatInputState())
      
      act(() => {
        result.current.onFocus()
      })
      expect(result.current.isFocused).toBe(true)
      
      act(() => {
        result.current.onBlur()
      })
      expect(result.current.isFocused).toBe(false)
    })

    it('应检测字符数超限', () => {
      const { result } = renderHook(() => useChatInputState({
        maxLength: 10,
      }))
      
      act(() => {
        result.current.onChange('This is a long text')
      })
      
      expect(result.current.isExceeded).toBe(true)
      expect(result.current.isOverLimit).toBe(true)
      expect(result.current.showFormatError).toBe(true)
      expect(result.current.errorMessage).toContain('10')
    })

    it('应在接近限制时显示警告', () => {
      const { result } = renderHook(() => useChatInputState({
        maxLength: 100,
      }))
      
      act(() => {
        result.current.onChange('a'.repeat(91))
      })
      
      expect(result.current.isOverLimit).toBe(true)
      expect(result.current.isExceeded).toBe(false)
    })
  })

  describe('建议系统', () => {
    it('应生成默认建议（空输入时）', () => {
      const { result } = renderHook(() => useChatInputState())
      
      expect(result.current.suggestions.length).toBeGreaterThan(0)
      expect(result.current.suggestions[0].type).toBe('ai')
    })

    it('应包含历史记录建议', () => {
      const { result } = renderHook(() => useChatInputState({
        conversationHistory: ['历史消息1', '历史消息2', '历史消息3'],
      }))
      
      const historySuggestions = result.current.suggestions.filter((s: { type: string }) => s.type === 'history')
      expect(historySuggestions.length).toBeGreaterThan(0)
    })

    it('应用建议时应更新输入值并关闭面板', () => {
      const { result } = renderHook(() => useChatInputState())
      const suggestion = result.current.suggestions[0]
      
      act(() => {
        result.current.applySuggestion(suggestion)
      })
      
      expect(result.current.value).toContain(suggestion.text)
      expect(result.current.showSuggestions).toBe(false)
    })
  })

  describe('深度思考模式', () => {
    it('应切换深度思考模式', async () => {
      const onDeepThinkingChange = vi.fn()
      const { result } = renderHook(() => useChatInputState({
        initialValue: '什么是人工智能？',
        onDeepThinkingChange,
      }))
      
      act(() => {
        result.current.toggleDeepThinking()
      })
      
      expect(result.current.deepThinking).toBe(true)
      expect(result.current.isAnalyzing).toBe(true)
      
      await act(async () => {
        vi.advanceTimersByTime(800)
      })
      
      expect(result.current.isAnalyzing).toBe(false)
      expect(result.current.deepThinkingAnalysis).not.toBeNull()
      expect(result.current.showDeepThinkingPanel).toBe(true)
      expect(onDeepThinkingChange).toHaveBeenCalledWith(true)
    })

    it('关闭深度思考模式时应清除分析结果', () => {
      const { result } = renderHook(() => useChatInputState({
        externalDeepThinking: true,
      }))
      
      act(() => {
        result.current.toggleDeepThinking()
      })
      
      expect(result.current.deepThinking).toBe(false)
      expect(result.current.showDeepThinkingPanel).toBe(false)
    })

    it('空输入时不应触发分析', () => {
      const { result } = renderHook(() => useChatInputState())
      
      act(() => {
        result.current.triggerDeepThinking()
      })
      
      expect(result.current.isAnalyzing).toBe(false)
    })
  })

  describe('智能搜索模式', () => {
    it('应切换智能搜索模式', async () => {
      const onSmartSearchChange = vi.fn()
      const { result } = renderHook(() => useChatInputState({
        initialValue: 'React hooks',
        onSmartSearchChange,
      }))
      
      act(() => {
        result.current.toggleSmartSearch()
      })
      
      expect(result.current.smartSearch).toBe(true)
      expect(result.current.isSearching).toBe(true)
      
      await act(async () => {
        vi.advanceTimersByTime(600)
      })
      
      expect(result.current.isSearching).toBe(false)
      expect(result.current.searchResults.length).toBeGreaterThan(0)
      expect(result.current.showSearchPanel).toBe(true)
      expect(onSmartSearchChange).toHaveBeenCalledWith(true)
    })

    it('选择搜索结果时应更新输入值', () => {
      const { result } = renderHook(() => useChatInputState({
        initialValue: 'test',
      }))
      
      act(() => {
        result.current.triggerSearch()
        vi.advanceTimersByTime(600)
      })
      
      const searchResult = result.current.searchResults[0]
      
      act(() => {
        result.current.selectSearchResult(searchResult)
      })
      
      expect(result.current.value).toContain(searchResult.title)
      expect(result.current.showSearchPanel).toBe(false)
    })
  })

  describe('附件管理', () => {
    it('应添加附件', () => {
      const mockAttachment = {
        id: '1',
        name: 'test.pdf',
        type: 'document' as const,
        size: 1024,
      }
      
      const { result } = renderHook(() => useChatInputState())
      
      act(() => {
        result.current.addAttachments([mockAttachment])
      })
      
      expect(result.current.attachments).toHaveLength(1)
      expect(result.current.attachments[0].id).toBe('1')
      expect(result.current.showAttachments).toBe(true)
    })

    it('应删除附件', () => {
      const mockAttachments = [
        { id: '1', name: 'test1.pdf', type: 'document' as const, size: 1024 },
        { id: '2', name: 'test2.png', type: 'image' as const, size: 2048 },
      ]
      
      const { result } = renderHook(() => useChatInputState())
      
      act(() => {
        result.current.addAttachments(mockAttachments)
        result.current.removeAttachment('1')
      })
      
      expect(result.current.attachments).toHaveLength(1)
      expect(result.current.attachments[0].id).toBe('2')
    })

    it('删除最后一个附件时应隐藏附件面板', () => {
      const mockAttachment = {
        id: '1',
        name: 'test.pdf',
        type: 'document' as const,
        size: 1024,
      }
      
      const { result } = renderHook(() => useChatInputState())
      
      act(() => {
        result.current.addAttachments([mockAttachment])
        result.current.removeAttachment('1')
      })
      
      expect(result.current.attachments).toHaveLength(0)
      expect(result.current.showAttachments).toBe(false)
    })
  })

  describe('清空功能', () => {
    it('应清空所有状态', () => {
      const { result } = renderHook(() => useChatInputState({
        initialValue: 'Some text',
        maxLength: 100,
      }))
      
      act(() => {
        result.current.onChange('Some text')
        result.current.clearAll()
      })
      
      expect(result.current.value).toBe('')
      expect(result.current.showSuggestions).toBe(false)
      expect(result.current.showDeepThinkingPanel).toBe(false)
      expect(result.current.showSearchPanel).toBe(false)
      expect(result.current.showAttachments).toBe(false)
      expect(result.current.showFormatError).toBe(false)
      expect(result.current.errorMessage).toBe('')
      expect(result.current.attachments).toEqual([])
      expect(result.current.deepThinkingAnalysis).toBeNull()
      expect(result.current.searchResults).toEqual([])
    })
  })

  describe('发送验证', () => {
    it('应允许发送有效消息', () => {
      const { result } = renderHook(() => useChatInputState({
        initialValue: 'Valid message',
      }))
      
      const canSend = result.current.canSend(false, false)
      expect(canSend).toBe(true)
    })

    it('应禁止发送禁用状态的消息', () => {
      const { result } = renderHook(() => useChatInputState({
        initialValue: 'Valid message',
      }))
      
      const canSend = result.current.canSend(true, false)
      expect(canSend).toBe(false)
    })

    it('应禁止发送流式传输中的消息', () => {
      const { result } = renderHook(() => useChatInputState({
        initialValue: 'Valid message',
      }))
      
      const canSend = result.current.canSend(false, true)
      expect(canSend).toBe(false)
    })

    it('应禁止发送空消息', () => {
      const { result } = renderHook(() => useChatInputState())
      
      const canSend = result.current.canSend(false, false)
      expect(canSend).toBe(false)
    })

    it('应禁止发送超过长度限制的消息', () => {
      const { result } = renderHook(() => useChatInputState({
        initialValue: 'a'.repeat(101),
        maxLength: 100,
      }))
      
      const canSend = result.current.canSend(false, false)
      expect(canSend).toBe(false)
    })
  })

  describe('语言检测', () => {
    it('应检测输入语言', () => {
      const { result } = renderHook(() => useChatInputState())
      
      act(() => {
        result.current.onChange('Hello world')
      })
      
      expect(result.current.detectedLanguage).toBe('zh-CN')
    })
  })

  describe('互斥逻辑', () => {
    it('启用深度思考时应关闭智能搜索', () => {
      const { result } = renderHook(() => useChatInputState({
        externalSmartSearch: true,
      }))
      
      act(() => {
        result.current.toggleDeepThinking()
      })
      
      expect(result.current.deepThinking).toBe(true)
      expect(result.current.smartSearch).toBe(false)
    })

    it('启用智能搜索时应关闭深度思考', () => {
      const { result } = renderHook(() => useChatInputState({
        externalDeepThinking: true,
      }))
      
      act(() => {
        result.current.toggleSmartSearch()
      })
      
      expect(result.current.smartSearch).toBe(true)
      expect(result.current.deepThinking).toBe(false)
    })
  })

  describe('性能优化', () => {
    it('方法引用应保持稳定', () => {
      const { result, rerender } = renderHook(() => useChatInputState())
      
      const firstOnChange = result.current.onChange
      const firstOnFocus = result.current.onFocus
      const firstToggleDeepThinking = result.current.toggleDeepThinking
      
      rerender()
      
      expect(result.current.onChange).toBe(firstOnChange)
      expect(result.current.onFocus).toBe(firstOnFocus)
      expect(result.current.toggleDeepThinking).toBe(firstToggleDeepThinking)
    })
  })

  describe('事件监听器设置', () => {
    it('应返回清理函数', () => {
      const { result } = renderHook(() => useChatInputState())
      
      const cleanup = result.current.setupEventListeners()
      
      expect(typeof cleanup).toBe('function')
      
      act(() => {
        cleanup()
      })
    })
  })
})
