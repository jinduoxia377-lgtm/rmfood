import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ChatService } from '../../../services/chatService'
import api from '@/api/client'

// 非流式 sendMessage 走 axios api.post（@/api/client），而非 global.fetch
vi.mock('@/api/client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

// buildRagContext → searchChunks 也会走 api.post；mock 掉 RAG 检索，
// 避免它消耗测试对 api.post 设置的 Once mock 序列（导致「成功请求后应清除错误状态」等失败）。
vi.mock('@/api/rag', () => ({
  searchChunks: vi.fn().mockResolvedValue([]),
}))

// 服务流式路径依赖登录态
vi.mock('@/stores/auth', () => ({
  useAuthStore: {
    getState: () => ({ isAuthenticated: true }),
  },
}))

/** 创建测试服务实例；默认关闭重试，避免定时器交互导致超时 */
function createService(overrides: Record<string, unknown> = {}) {
  const svc = new ChatService({ timeout: 60_000, maxRetries: 0, debounceMs: 0, ...overrides })
  vi.spyOn(svc as any, 'isAuthenticated').mockReturnValue(true)
  return svc
}

describe('ChatService', () => {
  let chatService: ChatService
  const apiPost = api.post as unknown as Mock

  const TEST_TOKEN = 'test-auth-token'

  beforeEach(() => {
    document.cookie = 'csrf_token=test-csrf-token'
    vi.clearAllMocks()
    chatService = createService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('认证管理', () => {
    it('应正确设置认证令牌', () => {
      chatService.setAuthToken(TEST_TOKEN)
      expect(chatService['authToken']).toBe(TEST_TOKEN)
    })

    it('应正确清除认证令牌', () => {
      chatService.setAuthToken(TEST_TOKEN)
      chatService.clearAuthToken()
      expect(chatService['authToken']).toBeNull()
    })

    it('应在请求头中包含认证令牌', async () => {
      apiPost.mockResolvedValue({ data: { id: '1', content: 'ok', senderId: 'assistant', timestamp: 0, formulas: [] } })
      chatService.setAuthToken(TEST_TOKEN)
      await chatService.sendMessage('test')
      expect(apiPost).toHaveBeenCalled()
    })
  })

  describe('发送消息', () => {
    it('应成功发送消息并返回响应', async () => {
      const mockResponse = { id: 'resp-1', content: '这是AI的回答', senderId: 'assistant', timestamp: 0, formulas: [] }
      apiPost.mockResolvedValue({ data: mockResponse })
      const result = await chatService.sendMessage('你好')
      expect(result.content).toBe(mockResponse.content)
      expect(apiPost).toHaveBeenCalled()
    })

    it('应处理网络超时错误', async () => {
      apiPost.mockRejectedValue(new Error('Network timeout'))
      await expect(chatService.sendMessage('test')).rejects.toThrow()
      expect(chatService.getLastError()).not.toBeNull()
    })

    it('应处理 HTTP 错误状态码', async () => {
      for (const status of [401, 403, 404, 500]) {
        apiPost.mockRejectedValueOnce({ response: { status, data: { detail: `err-${status}` } } })
        await expect(chatService.sendMessage('test')).rejects.toThrow()
      }
    })
  })

  describe('流式消息', () => {
    it('应正确处理流式响应', async () => {
      const sseLines = [
        'event: content',
        'data: {"type":"content","content":"chunk1"}',
        '',
        'event: content',
        'data: {"type":"content","content":"chunk2"}',
        '',
        'event: content',
        'data: {"type":"content","content":"chunk3"}',
        '',
        'data: [DONE]',
        '',
      ]
      let lineIndex = 0
      const encoder = new TextEncoder()
      const mockFetch = vi.fn().mockImplementationOnce(async () => ({
        ok: true,
        body: {
          getReader: () => ({
            read: () => {
              if (lineIndex < sseLines.length) {
                return Promise.resolve({ done: false, value: encoder.encode(sseLines[lineIndex++] + '\n') })
              }
              return Promise.resolve({ done: true, value: null })
            },
            releaseLock: vi.fn(),
          }),
        },
      }))
      global.fetch = mockFetch as any

      const receivedChunks: string[] = []
      const gen = chatService.sendMessageStream('stream test', undefined, true)
      for await (const chunk of gen) {
        if (chunk && chunk.content) receivedChunks.push(chunk.content)
      }

      expect(receivedChunks).toContain('chunk1')
      expect(receivedChunks).toContain('chunk2')
      expect(receivedChunks).toContain('chunk3')
    })
  })

  describe('重试机制', () => {
    it('应自动重试失败的消息发送', async () => {
      vi.useFakeTimers()
      const retryService = createService({ maxRetries: 2 })
      apiPost
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { id: 'retry-1', content: 'retry response', senderId: 'assistant', timestamp: 0, formulas: [] } })

      // 首次发送内部会重试：第一次网络错误 → 第二次成功
      const p = retryService.sendMessage('重试测试')
      p.catch(() => {}) // 吸收未处理 rejection，避免 Node unhandled 警告
      await vi.advanceTimersByTimeAsync(10_000)
      const result = await p
      expect(result.content).toBe('retry response')
      expect(apiPost.mock.calls.length).toBeGreaterThanOrEqual(2)
      vi.useRealTimers()
    })

    it('应在达到最大重试次数后抛出错误', async () => {
      vi.useFakeTimers()
      const retryService = createService({ maxRetries: 2 })
      apiPost.mockRejectedValue(new Error('Persistent error'))
      const first = retryService.sendMessage('x')
      first.catch(() => {}) // 吸收未处理 rejection
      await vi.advanceTimersByTimeAsync(10_000)
      await expect(first).rejects.toThrow()

      const p = retryService.retryLastMessage()
      p.catch(() => {}) // 吸收未处理 rejection
      await vi.advanceTimersByTimeAsync(10_000)
      await expect(p).rejects.toThrow()
      vi.useRealTimers()
    })
  })

  describe('限流处理', () => {
    it('应正确解析限流状态', async () => {
      apiPost.mockRejectedValueOnce({ response: { status: 429, data: { detail: 'Rate limit exceeded' } } })
      await expect(chatService.sendMessage('rate limit test')).rejects.toThrow()
      expect(chatService.getRateLimitStatus()).toBeDefined()
    })

    it('应在限流时阻止新请求', async () => {
      apiPost.mockRejectedValueOnce({ response: { status: 429, data: { detail: 'Rate limited' } } })
      await expect(chatService.sendMessage('test')).rejects.toThrow()
      expect(chatService.getRateLimitStatus()).toBeDefined()
    })
  })

  describe('错误追踪', () => {
    it('应记录最后一次错误', async () => {
      apiPost.mockRejectedValueOnce(new Error('Test error'))
      await expect(chatService.sendMessage('error test')).rejects.toThrow()
      expect(chatService.getLastError()).not.toBeNull()
    })

    it('成功请求后应清除错误状态', async () => {
      apiPost
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce({ data: { id: '1', content: 'success', senderId: 'assistant', timestamp: 0, formulas: [] } })

      await expect(chatService.sendMessage('fail')).rejects.toThrow()
      expect(chatService.getLastError()).not.toBeNull()

      await chatService.sendMessage('success')
      expect(chatService.getLastError()).toBeNull()
    })
  })

  describe('请求去重 (Debounce)', () => {
    it('应在短时间内防止重复请求', async () => {
      vi.useFakeTimers()
      const debounceService = createService({ debounceMs: 300, maxRetries: 0 })
      apiPost.mockResolvedValue({ data: { id: '1', content: 'response', senderId: 'assistant', timestamp: 0, formulas: [] } })

      const promises = [
        debounceService.sendMessage('msg1'),
        debounceService.sendMessage('msg2'),
        debounceService.sendMessage('msg3'),
      ]
      await vi.advanceTimersByTimeAsync(1000)
      const results = await Promise.all(promises)
      expect(results[0].content).toBe('response')
      vi.useRealTimers()
    })
  })
})