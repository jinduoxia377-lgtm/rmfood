// @ts-nocheck
import { renderHook, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { useChatMessages } from '../../../hooks/useChatMessages'
import {
  createMockChatService,
  createMockStorageService,
  createMockEventBus
} from '../../helpers/mockServices'
import {
  createMockMessage,
  createMockAIResponse,
  createMockMessagesArray,
  TEST_CONSTANTS
} from '../helpers/testFactories'

describe('useChatMessages', () => {
  let mockChatService: ReturnType<typeof createMockChatService>
  let mockStorageService: ReturnType<typeof createMockStorageService>
  let mockEventBus: ReturnType<typeof createMockEventBus>

  beforeEach(() => {
    mockChatService = createMockChatService()
    mockStorageService = createMockStorageService()
    mockEventBus = createMockEventBus()
  })

  describe('v7 接口兼容性', () => {
    it('应提供完整的 v7 状态接口', () => {
      const { result } = renderHook(() =>
        useChatMessages(mockChatService, mockStorageService, mockEventBus)
      )

      expect(result.current).toHaveProperty('messages')
      expect(result.current).toHaveProperty('isLoading')
      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('formulas')
      expect(result.current).toHaveProperty('streamingContent')
      expect(result.current).toHaveProperty('currentSessionId')
      expect(result.current).toHaveProperty('sendMessage')
      expect(result.current).toHaveProperty('retryMessage')
      expect(result.current).toHaveProperty('clearError')
      expect(result.current).toHaveProperty('createNewSession')
    })

    it('应初始化为空状态', () => {
      const { result } = renderHook(() =>
        useChatMessages(mockChatService, mockStorageService, mockEventBus)
      )

      expect(result.current.messages).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.formulas).toEqual([])
      expect(result.current.streamingContent).toBe('')
    })
  })

  describe('消息发送功能', () => {
    it('应成功发送消息并更新状态', async () => {
      const mockResponse = createMockAIResponse({
        content: TEST_CONSTANTS.ASSISTANT_RESPONSE
      })
      mockChatService.sendMessage.mockResolvedValueOnce(mockResponse)

      const { result } = renderHook(() =>
        useChatMessages(mockChatService, mockStorageService, mockEventBus)
      )

      await act(async () => {
        await result.current.sendMessage(TEST_CONSTANTS.USER_MESSAGE)
      })

      expect(result.current.messages.length).toBe(2)
      expect(result.current.messages[0].role).toBe('user')
      expect(result.current.messages[0].content).toBe(TEST_CONSTANTS.USER_MESSAGE)
      expect(result.current.messages[1].role).toBe('assistant')
      expect(result.current.messages[1].content).toBe(TEST_CONSTANTS.ASSISTANT_RESPONSE)
      expect(result.current.isLoading).toBe(false)
    })

    it('应在发送时设置加载状态', async () => {
      let resolvePromise: (value: any) => void
      mockChatService.sendMessage.mockImplementation(
        () => new Promise(resolve => { resolvePromise = resolve })
      )

      const { result } = renderHook(() =>
        useChatMessages(mockChatService, mockStorageService, mockEventBus)
      )

      act(() => {
        result.current.sendMessage('测试消息')
      })

      expect(result.current.isLoading).toBe(true)

      await act(async () => {
        resolvePromise!(createMockAIResponse())
      })

      expect(result.current.isLoading).toBe(false)
    })

    it('应处理发送错误', async () => {
      const error = new Error('Network error')
      mockChatService.sendMessage.mockRejectedValueOnce(error)

      const { result } = renderHook(() =>
        useChatMessages(mockChatService, mockStorageService, mockEventBus)
      )

      await act(async () => {
        try {
          await result.current.sendMessage('失败消息')
        } catch (e) {
          // Expected
        }
      })

      expect(result.current.error).toEqual(error)
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('消息持久化', () => {
    it('应在消息更新后自动保存到存储服务', async () => {
      mockChatService.sendMessage.mockResolvedValueOnce(createMockAIResponse())

      const { result } = renderHook(() =>
        useChatMessages(mockChatService, mockStorageService, mockEventBus)
      )

      await act(async () => {
        await result.current.sendMessage('持久化测试')
      })

      expect(mockStorageService.saveMessages).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ content: '持久化测试' })
        ])
      )
    })

    it('应在初始化时从存储服务恢复历史消息', async () => {
      const savedMessages = createMockMessagesArray(10)
      mockStorageService.loadMessages.mockResolvedValue(savedMessages)

      const { result, waitForNextUpdate } = renderHook(() =>
        useChatMessages(mockChatService, mockStorageService, mockEventBus)
      )

      await waitForNextUpdate()

      expect(result.current.messages).toEqual(savedMessages)
    })
  })

  describe('公式管理集成', () => {
    it('应正确提取和存储 AI 响应中的配方', async () => {
      const formulas = [
        { id: 'f1', name: '胶原蛋白肽', category: '功能性成分', data: {} },
        { id: 'f2', name: '乳清蛋白肽', category: '功能性成分', data: {} }
      ]

      mockChatService.sendMessage.mockResolvedValueOnce(
        createMockAIResponse({ formulas: formulas as any })
      )

      const { result } = renderHook(() =>
        useChatMessages(mockChatService, mockStorageService, mockEventBus)
      )

      await act(async () => {
        await result.current.sendMessage('获取配方')
      })

      expect(result.current.formulas).toHaveLength(2)
      expect(result.current.formulas[0].name).toBe('胶原蛋白肽')
      expect(result.current.formulas[1].name).toBe('乳清蛋白肽')
    })
  })

  describe('事件驱动', () => {
    it('应在发送消息前触发 MESSAGE_SENT 事件', async () => {
      mockChatService.sendMessage.mockResolvedValueOnce(createMockAIResponse())

      const { result } = renderHook(() =>
        useChatMessages(mockChatService, mockStorageService, mockEventBus)
      )

      await act(async () => {
        await result.current.sendMessage('事件测试')
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.stringContaining('MESSAGE_SENT'),
        expect.any(Object)
      )
    })

    it('应在收到响应后触发 MESSAGE_RECEIVED 事件', async () => {
      mockChatService.sendMessage.mockResolvedValueOnce(createMockAIResponse())

      const { result } = renderHook(() =>
        useChatMessages(mockChatService, mockStorageService, mockEventBus)
      )

      await act(async () => {
        await result.current.sendMessage('接收测试')
      })

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.stringContaining('MESSAGE_RECEIVED'),
        expect.any(Object)
      )
    })
  })

  describe('会话管理', () => {
    it('应创建新会话并清除当前状态', async () => {
      mockChatService.sendMessage.mockResolvedValueOnce(createMockAIResponse())

      const { result } = renderHook(() =>
        useChatMessages(mockChatService, mockStorageService, mockEventBus)
      )

      await act(async () => {
        await result.current.sendMessage('旧会话消息')
      })

      expect(result.current.messages.length).toBeGreaterThan(0)

      act(() => {
        result.current.createNewSession()
      })

      expect(result.current.messages).toEqual([])
      expect(result.current.formulas).toEqual([])
      expect(mockStorageService.saveSession).toHaveBeenCalled()
    })

    it('应为每个会话生成唯一 ID', () => {
      const { result } = renderHook(() =>
        useChatMessages(mockChatService, mockStorageService, mockEventBus)
      )

      const sessionId1 = result.current.currentSessionId

      act(() => {
        result.current.createNewSession()
      })

      const sessionId2 = result.current.currentSessionId

      expect(sessionId1).not.toBe(sessionId2)
      expect(sessionId1).toMatch(/^[a-f0-9-]+$/)
      expect(sessionId2).toMatch(/^[a-f0-9-]+$/)
    })
  })

  describe('重试机制', () => {
    it('应支持重试最后一条消息', async () => {
      mockChatService.sendMessage
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(createMockAIResponse({ content: 'Retry success' }))

      const { result } = renderHook(() =>
        useChatMessages(mockChatService, mockStorageService, mockEventBus)
      )

      try {
        await act(async () => {
          await result.current.sendMessage('初始消息')
        })
      } catch (e) {
        // Expected error
      }

      expect(result.current.error).not.toBeNull()

      await act(async () => {
        await result.current.retryMessage()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.messages.some(m => m.content === 'Retry success')).toBe(true)
    })
  })

  describe('错误处理', () => {
    it('应能清除错误状态', async () => {
      mockChatService.sendMessage.mockRejectedValueOnce(new Error('Test error'))

      const { result } = renderHook(() =>
        useChatMessages(mockChatService, mockStorageService, mockEventBus)
      )

      try {
        await act(async () => {
          await result.current.sendMessage('错误测试')
        })
      } catch (e) {
        // Expected
      }

      expect(result.current.error).not.toBeNull()

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })
})
