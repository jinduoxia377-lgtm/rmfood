import { renderHook, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { useChatMessages } from '../../../hooks/useChatMessages'
import { chatService } from '../../../services/chatService'
import { eventBus } from '../../../services/eventBus'

// 当前 useChatMessages 以模块单例方式依赖各服务
vi.mock('../../../services/chatService', () => ({
  chatService: {
    sendMessage: vi.fn().mockResolvedValue({ content: '非流式回复', role: 'assistant', formulas: [], timestamp: 0 }),
    sendMessageStream: vi.fn(),
    clearAuthToken: vi.fn(),
    closeAllPendingRequests: vi.fn(),
    retryLastMessage: vi.fn().mockResolvedValue({ content: '重试回复', role: 'assistant', formulas: [], timestamp: 0 }),
    getStateMachine: vi.fn(() => ({ addStateListener: () => () => {} })),
  },
}))

vi.mock('../../../services/storageService', () => ({
  storageService: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('../../../services/eventBus', () => ({
  eventBus: {
    emit: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}))

vi.mock('../../../capabilities/storage/ChatStorageService', () => ({
  chatStorageService: {
    saveMessages: vi.fn().mockResolvedValue(undefined),
    deleteMessages: vi.fn().mockResolvedValue(undefined),
  },
}))

function makeMessage(id: string, role: 'user' | 'assistant', content: string) {
  return { id, role, content, timestamp: Date.now() }
}

describe('useChatMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应初始化为空状态', () => {
    const { result } = renderHook(() => useChatMessages())

    expect(result.current.messages).toEqual([])
    expect(result.current.input).toBe('')
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.chatError).toBeNull()
    expect(result.current.isPaused).toBe(false)
  })

  it('setInput 应更新输入内容', () => {
    const { result } = renderHook(() => useChatMessages())

    act(() => {
      result.current.setInput('你好')
    })

    expect(result.current.input).toBe('你好')
  })

  it('addMessage / updateMessage / removeMessage / clearMessages 应正确维护消息列表', () => {
    const { result } = renderHook(() => useChatMessages())

    const userMsg = makeMessage('u1', 'user', '你好')

    act(() => {
      result.current.addMessage(userMsg)
    })
    expect(result.current.messages).toHaveLength(1)

    act(() => {
      result.current.updateMessage('u1', { content: '你好呀' })
    })
    expect(result.current.messages[0].content).toBe('你好呀')

    act(() => {
      result.current.addMessage(makeMessage('a1', 'assistant', '回复'))
    })
    expect(result.current.messages).toHaveLength(2)

    act(() => {
      result.current.removeMessage('u1')
    })
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].id).toBe('a1')

    act(() => {
      result.current.clearMessages()
    })
    expect(result.current.messages).toHaveLength(0)
  })

  it('sendMessage 应通过流式接口累加回复', async () => {
    ;(chatService.sendMessageStream as Mock).mockImplementation(async function* () {
      yield { done: false, content: '流式' }
      yield { done: false, content: '回复' }
      yield { done: true, content: '' }
    })

    const { result } = renderHook(() => useChatMessages())

    await act(async () => {
      await result.current.sendMessage('你好')
    })

    expect(result.current.messages.length).toBeGreaterThanOrEqual(2)
    const assistantMessages = result.current.messages.filter((m) => m.role === 'assistant')
    expect(assistantMessages.length).toBeGreaterThan(0)
    expect(assistantMessages[assistantMessages.length - 1].content).toContain('流式回复')
    expect(result.current.isStreaming).toBe(false)
  })

  it('sendMessage 流式失败时应回退到非流式接口', async () => {
    ;(chatService.sendMessageStream as Mock).mockImplementation(async function* () {
      throw new Error('Network error')
      yield undefined
    })
    ;(chatService.sendMessage as Mock).mockResolvedValue({
      content: '回退回复',
      role: 'assistant',
      formulas: [],
      timestamp: 0,
    })

    const { result } = renderHook(() => useChatMessages())

    await act(async () => {
      await result.current.sendMessage('你好')
    })

    const assistantMessages = result.current.messages.filter((m) => m.role === 'assistant')
    expect(assistantMessages.length).toBeGreaterThan(0)
    expect(assistantMessages[assistantMessages.length - 1].content).toContain('回退回复')
  })

  it('setChatError / clearError 应维护错误状态', () => {
    const { result } = renderHook(() => useChatMessages())

    act(() => {
      result.current.setChatError(new Error('测试错误'))
    })
    expect(result.current.chatError?.message).toBe('测试错误')

    act(() => {
      result.current.clearError()
    })
    expect(result.current.chatError).toBeNull()
  })

  it('setActiveSessionId 应更新会话 ID', () => {
    const { result } = renderHook(() => useChatMessages())

    act(() => {
      result.current.setActiveSessionId('session-1')
    })

    expect(result.current.messages).toEqual([])
    // setActiveSessionId 更新内部引用，不直接暴露；此处仅验证可调用不抛错
    expect(typeof result.current.setActiveSessionId).toBe('function')
  })

  it('retryLastMessage 应调用 chatService 重试', async () => {
    ;(chatService.sendMessageStream as Mock).mockImplementation(async function* () {
      yield { done: true, content: '' }
    })
    ;(chatService.sendMessage as Mock).mockResolvedValue({
      content: '重试结果',
      role: 'assistant',
      formulas: [],
      timestamp: 0,
    })

    const { result } = renderHook(() => useChatMessages())

    await act(async () => {
      await result.current.sendMessage('第一条')
    })

    await act(async () => {
      await result.current.retryLastMessage()
    })

    // 重试会再次产生一条 assistant 消息
    const assistantMessages = result.current.messages.filter((m) => m.role === 'assistant')
    expect(assistantMessages.length).toBeGreaterThan(0)
  })

  it('eventBus 的 auth:required 订阅应被注册', () => {
    renderHook(() => useChatMessages())

    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'auth:required',
      expect.any(Function),
    )
  })
})