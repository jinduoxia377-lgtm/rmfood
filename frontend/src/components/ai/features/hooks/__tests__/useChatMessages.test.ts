import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useChatMessages, ChatMessage } from '../useChatMessages'
import { chatService } from '../../services/chatService'
import { storageService } from '../../services/storageService'
import { eventBus } from '../../services/eventBus'

vi.mock('../../services/chatService', () => ({
  chatService: {
    sendMessage: vi.fn(),
    retryLastMessage: vi.fn(),
    setAuthToken: vi.fn(),
    clearAuthToken: vi.fn(),
    getRateLimitStatus: vi.fn().mockReturnValue({ remaining: 100, resetAt: null, limit: 1000 }),
    getStateMachine: vi.fn().mockReturnValue({
      state: 'idle',
      transition: vi.fn(),
      canTransition: vi.fn().mockReturnValue(true),
    }),
  },
}))

vi.mock('../../services/storageService', () => ({
  storageService: {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('../../services/eventBus', () => ({
  eventBus: {
    subscribe: vi.fn().mockReturnValue(vi.fn()),
    emit: vi.fn(),
  },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn().mockReturnValue({ accessToken: 'test-token' }),
}))

describe('useChatMessages', () => {
  const mockSendMessage = chatService.sendMessage as Mock
  const mockStorageGet = storageService.get as Mock
  const mockStorageSet = storageService.set as Mock

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('初始化', () => {
    it('应初始化空消息列表', () => {
      const { result } = renderHook(() => useChatMessages())
      
      expect(result.current.messages).toEqual([])
      expect(result.current.error).toBeNull()
    })
  })

  describe('消息发送', () => {
    it('应发送消息并添加到列表', async () => {
      const mockResponse = { content: 'AI Response', timestamp: Date.now(), role: 'assistant' }
      mockSendMessage.mockResolvedValue(mockResponse)
      
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.sendMessage('Hello AI')
      })
      
      expect(mockSendMessage).toHaveBeenCalledWith('Hello AI')
      expect(result.current.messages).toHaveLength(2)
      expect(result.current.messages[0].role).toBe('user')
      expect(result.current.messages[1].role).toBe('assistant')
    })

    it('应处理空消息', async () => {
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.sendMessage('')
      })
      
      expect(mockSendMessage).not.toHaveBeenCalled()
      expect(result.current.messages).toHaveLength(0)
    })

    it('应处理发送错误', async () => {
      const error = new Error('Network error')
      mockSendMessage.mockRejectedValue(error)
      
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.sendMessage('Hello')
      })
      
      expect(result.current.error).toEqual(error)
    })
  })

  describe('消息编辑', () => {
    it('应编辑用户消息', async () => {
      const mockResponse = { content: 'AI Response', timestamp: Date.now(), role: 'assistant' }
      mockSendMessage.mockResolvedValue(mockResponse)
      
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.sendMessage('Original')
      })
      
      const userMessage = result.current.messages[0]
      
      await act(() => {
        result.current.editMessage(userMessage.id, 'Edited content')
      })
      
      expect(result.current.messages[0].content).toBe('Edited content')
      expect(result.current.messages[0].isEdited).toBe(true)
      expect(result.current.messages[0].originalContent).toBe('Original')
    })
  })

  describe('消息撤回', () => {
    it('应撤回用户消息', async () => {
      const { result } = renderHook(() => useChatMessages({
        initialMessages: [{
          id: 'test-msg',
          role: 'user',
          content: 'Test message',
          timestamp: Date.now(),
        }]
      }))
      
      await act(() => {
        const success = result.current.withdrawMessage('test-msg', 'Changed mind')
        expect(success).toBe(true)
      })
      
      expect(result.current.messages[0].isWithdrawn).toBe(true)
      expect(result.current.messages[0].content).toBe('[消息已撤回]')
    })
  })

  describe('消息评价', () => {
    it('应对消息进行点赞', async () => {
      const mockResponse = { content: 'AI Response', timestamp: Date.now(), role: 'assistant' }
      mockSendMessage.mockResolvedValue(mockResponse)
      
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.sendMessage('Hello')
      })
      
      const assistantMessage = result.current.messages[1]
      
      await act(() => {
        result.current.rateMessage(assistantMessage.id, 'up', 'Very helpful')
      })
      
      expect(result.current.messages[1].rating).toBe('up')
      expect(result.current.messages[1].feedback).toBe('Very helpful')
    })
  })

  describe('消息书签', () => {
    it('应添加书签', async () => {
      const mockResponse = { content: 'AI Response', timestamp: Date.now(), role: 'assistant' }
      mockSendMessage.mockResolvedValue(mockResponse)
      
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.sendMessage('Hello')
      })
      
      const assistantMessage = result.current.messages[1]
      
      await act(() => {
        result.current.toggleBookmark(assistantMessage.id, 'Important note')
      })
      
      expect(result.current.messages[1].isBookmarked).toBe(true)
      expect(result.current.messages[1].bookmarkNote).toBe('Important note')
    })
  })

  describe('清除消息', () => {
    it('应清除所有消息', async () => {
      const mockResponse = { content: 'AI Response', timestamp: Date.now(), role: 'assistant' }
      mockSendMessage.mockResolvedValue(mockResponse)
      
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.sendMessage('Hello')
      })
      
      await act(() => {
        result.current.clearMessages()
      })
      
      expect(result.current.messages).toEqual([])
    })
  })

  describe('清除错误', () => {
    it('应清除错误', async () => {
      const error = new Error('Test error')
      mockSendMessage.mockRejectedValue(error)
      
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.sendMessage('test')
      })
      
      await waitFor(() => {
        expect(result.current.error).not.toBeNull()
      })
      
      await act(() => {
        result.current.clearError()
      })
      
      expect(result.current.error).toBeNull()
    })
  })

  describe('存储操作', () => {
    it('应保存到存储', async () => {
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.saveToStorage()
      })
      
      expect(mockStorageSet).toHaveBeenCalled()
    })
  })
})
