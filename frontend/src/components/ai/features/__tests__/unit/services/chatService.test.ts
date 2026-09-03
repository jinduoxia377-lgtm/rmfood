// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { ChatService } from '../../../services/chatService'
import { IChatService, AIResponse, RateLimitStatus, AuthToken } from '../../../types'

describe('ChatService', () => {
  let chatService: ChatService
  let mockFetch: jest.Mock

  const BASE_URL = '/api/ai/chat'
  const TEST_TOKEN = 'test-auth-token'

  beforeEach(() => {
    mockFetch = jest.fn()
    global.fetch = mockFetch
    chatService = new ChatService(BASE_URL)
  })

  afterEach(() => {
    jest.restoreAllMocks()
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '1', content: 'response' })
      })

      chatService.setAuthToken(TEST_TOKEN)
      await chatService.sendMessage('test')

      expect(mockFetch).toHaveBeenCalledWith(
        BASE_URL,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${TEST_TOKEN}`
          })
        })
      )
    })
  })

  describe('发送消息', () => {
    it('应成功发送消息并返回响应', async () => {
      const mockResponse: AIResponse = {
        id: 'resp-1',
        content: '这是AI的回答',
        senderId: 'assistant',
        timestamp: Date.now(),
        formulas: []
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await chatService.sendMessage('你好')

      expect(result).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        BASE_URL,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ message: '你好' })
        })
      )
    })

    it('应处理网络超时错误', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'))

      await expect(chatService.sendMessage('test')).rejects.toThrow('Network timeout')
      expect(chatService.getLastError()).toEqual(expect.objectContaining({
        message: 'Network timeout'
      }))
    })

    it('应处理 HTTP 错误状态码', async () => {
      const errorCases = [
        { status: 401, message: 'Unauthorized' },
        { status: 403, message: 'Forbidden' },
        { status: 404, message: 'Not Found' },
        { status: 500, message: 'Internal Server Error' }
      ]

      for (const { status, message } of errorCases) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status,
          json: () => Promise.resolve({ error: message })
        })

        try {
          await chatService.sendMessage('test')
          fail(`Expected error for status ${status}`)
        } catch (error) {
          expect((error as any).status).toBe(status)
        }
      }
    })
  })

  describe('流式消息', () => {
    it('应正确处理流式响应', async () => {
      const chunks = ['chunk1', 'chunk2', 'chunk3']
      let chunkIndex = 0

      mockFetch.mockImplementationOnce(async () => ({
        ok: true,
        body: {
          getReader: () => ({
            read: () => {
              if (chunkIndex < chunks.length) {
                return Promise.resolve({
                  done: false,
                  value: new TextEncoder().encode(chunks[chunkIndex++])
                })
              }
              return Promise.resolve({ done: true, value: null })
            },
            releaseLock: jest.fn()
          })
        }
      }))

      const receivedChunks: string[] = []
      await chatService.sendMessageStream(
        'stream test',
        (chunk) => receivedChunks.push(chunk),
        { signal: null as any }
      )

      expect(receivedChunks).toEqual(chunks)
    })

    it('应支持取消流式传输', async () => {
      const abortController = new AbortController()
      let callCount = 0

      mockFetch.mockImplementationOnce(async () => ({
        ok: true,
        body: {
          getReader: () => ({
            read: () => {
              callCount++
              if (callCount > 2) {
                abortController.abort()
              }
              return Promise.resolve({
                done: false,
                value: new TextEncoder().encode(`chunk${callCount}`)
              })
            },
            releaseLock: jest.fn()
          })
        }
      }))

      const receivedChunks: string[] = []
      try {
        await chatService.sendMessageStream(
          'cancel test',
          (chunk) => receivedChunks.push(chunk),
          { signal: abortController.signal as any }
        )
      } catch (error) {
        expect((error as any).name).toBe('AbortError')
      }

      expect(receivedChunks.length).toBeLessThanOrEqual(3)
    })
  })

  describe('重试机制', () => {
    it('应自动重试失败的消息发送', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'retry-1', content: 'retry response' })
        })

      const result = await chatService.retryLastMessage()

      expect(result).toEqual({ id: 'retry-1', content: 'retry response' })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('应在达到最大重试次数后抛出错误', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent error'))

      await expect(chatService.retryLastMessage()).rejects.toThrow()
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('重试之间应有适当的延迟', async () => {
      jest.useFakeTimers()

      mockFetch
        .mockRejectedValueOnce(new Error('error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: '1', content: 'ok' })
        })

      const retryPromise = chatService.retryLastMessage()

      await jest.advanceTimersByTimeAsync(1000)

      const result = await retryPromise
      expect(result.content).toBe('ok')

      jest.useRealTimers()
    })
  })

  describe('限流处理', () => {
    it('应正确解析限流状态', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (name: string) => {
            if (name === 'Retry-After') return '60'
            if (name === 'X-RateLimit-Remaining') return '0'
            if (name === 'X-RateLimit-Limit') return '1000'
            return null
          }
        },
        json: () => Promise.resolve({ error: 'Rate limit exceeded' })
      })

      try {
        await chatService.sendMessage('rate limit test')
      } catch (error) {
        // Expected
      }

      const rateLimitStatus = chatService.getRateLimitStatus()
      expect(rateLimitStatus.remaining).toBe(0)
      expect(rateLimitStatus.limit).toBe(1000)
      expect(rateLimitStatus.resetAt).not.toBeNull()
    })

    it('应在限流时阻止新请求', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => null },
        json: () => Promise.resolve({ error: 'Rate limited' })
      })

      try {
        await chatService.sendMessage('test')
      } catch (error) {
        // Expected
      }

      expect(chatService.isRateLimited()).toBe(true)
    })
  })

  describe('错误追踪', () => {
    it('应记录最后一次错误', async () => {
      const error = new Error('Test error')
      mockFetch.mockRejectedValueOnce(error)

      try {
        await chatService.sendMessage('error test')
      } catch (e) {
        // Expected
      }

      expect(chatService.getLastError()).toEqual(error)
    })

    it('成功请求后应清除错误状态', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: '1', content: 'success' })
        })

      try {
        await chatService.sendMessage('fail')
      } catch (e) {
        // Expected
      }

      expect(chatService.getLastError()).not.toBeNull()

      await chatService.sendMessage('success')

      expect(chatService.getLastError()).toBeNull()
    })
  })

  describe('请求去重 (Debounce)', () => {
    it('应在短时间内防止重复请求', async () => {
      jest.useFakeTimers()
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: '1', content: 'response' })
      })

      const promises = [
        chatService.sendMessage('msg1'),
        chatService.sendMessage('msg2'),
        chatService.sendMessage('msg3')
      ]

      await jest.advanceTimersByTimeAsync(400)

      const results = await Promise.all(promises)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(results[0].content).toBe('response')

      jest.useRealTimers()
    })
  })
})
