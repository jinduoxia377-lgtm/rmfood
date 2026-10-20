import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useChatMessages } from '../useChatMessages'
import { chatService } from '../../services/chatService'
import { storageService } from '../../services/storageService'

vi.mock('../../services/chatService', () => ({
  chatService: {
    sendMessage: vi.fn(),
    sendMessageStream: vi.fn(),
    retryLastMessage: vi.fn(),
    setAuthToken: vi.fn(),
    clearAuthToken: vi.fn(),
    getRateLimitStatus: vi.fn().mockReturnValue({ remaining: 100, resetAt: null, limit: 1000 }),
    getStateMachine: vi.fn().mockReturnValue({
      state: 'idle',
      transition: vi.fn(),
      canTransition: vi.fn().mockReturnValue(true),
    }),
    closeAllPendingRequests: vi.fn(),
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

// 模拟流式 SSE 响应（async generator）
function mockStreamResponse(content: string) {
  const streamMock = chatService.sendMessageStream as Mock
  streamMock.mockImplementation(async function* () {
    yield { content, model: 'test-model', done: false }
    yield { content: '', done: true }
  })
}

describe('useChatMessages', () => {
  const mockStream = chatService.sendMessageStream as Mock
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
      expect(result.current.chatError).toBeNull()
    })
  })

  describe('消息发送', () => {
    it('应发送消息并添加到列表', async () => {
      mockStreamResponse('AI Response')
      
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.sendMessage('Hello AI')
      })
      
      expect(mockStream).toHaveBeenCalledWith('Hello AI', expect.any(Array))
      expect(result.current.messages).toHaveLength(2)
      expect(result.current.messages[0].role).toBe('user')
      expect(result.current.messages[1].role).toBe('assistant')
      expect(result.current.messages[1].content).toBe('AI Response')
    })

    it('应处理空消息', async () => {
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.sendMessage('')
      })
      
      expect(mockStream).not.toHaveBeenCalled()
      expect(result.current.messages).toHaveLength(0)
    })

    it('应处理发送错误', async () => {
      const error = new Error('Network error')
      mockStream.mockRejectedValue(error)
      
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.sendMessage('Hello')
      })
      
      await waitFor(() => {
        expect(result.current.chatError).not.toBeNull()
      })
    })
  })

  describe('消息编辑', () => {
    it('应编辑用户消息', async () => {
      mockStreamResponse('AI Response')
      
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.sendMessage('Original')
      })
      
      const userMessage = result.current.messages[0]
      
      await act(async () => {
        result.current.editMessage(userMessage.id, 'Edited content')
      })
      
      expect(result.current.messages[0].content).toBe('Edited content')
      expect(result.current.messages[0].isEdited).toBe(true)
      expect(result.current.messages[0].originalContent).toBe('Original')
    })
  })

  describe('消息撤回', () => {
    it('应撤回用户消息', async () => {
      mockStreamResponse('AI Response')
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.sendMessage('Test message')
      })
      
      const userMessage = result.current.messages[0]
      await act(async () => {
        result.current.retractMessage(userMessage.id)
      })
      
      expect(result.current.messages[0].isRetracted).toBe(true)
      expect(result.current.messages[0].content).toBe('消息已撤回')
    })
  })

  describe('清除消息', () => {
    it('应清除所有消息', async () => {
      mockStreamResponse('AI Response')
      
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.sendMessage('Hello')
      })
      
      await act(async () => {
        await result.current.clearMessages()
      })
      
      expect(result.current.messages).toEqual([])
    })
  })

  describe('清除错误', () => {
    it('应清除错误', async () => {
      const error = new Error('Test error')
      mockStream.mockRejectedValue(error)
      
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.sendMessage('test')
      })
      
      await waitFor(() => {
        expect(result.current.chatError).not.toBeNull()
      })
      
      await act(async () => {
        result.current.clearError()
      })
      
      expect(result.current.chatError).toBeNull()
    })
  })

  describe('存储操作', () => {
    it('发送消息应写入存储', async () => {
      mockStreamResponse('AI Response')
      
      const { result } = renderHook(() => useChatMessages())
      
      await act(async () => {
        await result.current.sendMessage('Hello')
      })
      
      // localStorage 兜底路径（jsdom 无 IndexedDB）会写入 storageService
      expect(mockStorageSet).toHaveBeenCalled()
    })
  })
})