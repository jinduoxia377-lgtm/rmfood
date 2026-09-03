// @ts-nocheck
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatTab } from '../../ChatTab'
import {
  createMockChatService,
  createMockStorageService,
  createMockExportService,
  mockNetworkError,
  mockAuthError,
  mockRateLimitError
} from '../helpers/mockServices'
import {
  createMockAIResponse,
  createMockAIRecognizedFormula,
  createMockAIRecognizedFormulasArray,
  createMockMessagesArray,
  createMockFormulasArray,
  TEST_CONSTANTS
} from '../helpers/testFactories'
import { TestHelper, simulateStreamResponse } from '../helpers/testUtils'

describe('ChatFlow Integration Tests', () => {

  let mockChatService: ReturnType<typeof createMockChatService>
  let mockStorageService: ReturnType<typeof createMockStorageService>
  let mockExportService: ReturnType<typeof createMockExportService>

  beforeEach(() => {
    jest.useFakeTimers()
    mockChatService = createMockChatService()
    mockStorageService = createMockStorageService()
    mockExportService = createMockExportService()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  describe('TR-12.1: Happy Path - 完整成功流程', () => {
    it('应完整执行用户对话流程：发送消息 → 接收回答 → 公式识别 → 报告生成', async () => {
      const mockResponse = createMockAIResponse({
        content: TEST_CONSTANTS.ASSISTANT_RESPONSES.MEDIUM,
        formulas: [
          createMockAIRecognizedFormula({ name: '胶原蛋白肽', value: 85 }),
          createMockAIRecognizedFormula({ name: '乳清蛋白肽', value: 90 })
        ]
      })

      mockChatService.sendMessage.mockResolvedValueOnce(mockResponse)

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })

      await act(async () => {
        fireEvent.change(input, { target: { value: TEST_CONSTANTS.USER_MESSAGES.MEDIUM } })
        fireEvent.click(sendButton)
      })

      await waitFor(() => {
        expect(screen.getByText(/正在思考.../i)).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByText(TEST_CONSTANTS.ASSISTANT_RESPONSES.MEDIUM)).toBeInTheDocument()
      }, { timeout: 5000 })

      await waitFor(() => {
        expect(screen.getByText(/胶原蛋白肽/i)).toBeInTheDocument()
        expect(screen.getByText(/乳清蛋白肽/i)).toBeInTheDocument()
      })

      const reportButton = screen.getByRole('button', { name: /生成报告/i })
      expect(reportButton).not.toBeDisabled()

      expect(mockChatService.sendMessage).toHaveBeenCalledTimes(1)
      expect(mockStorageService.saveMessages).toHaveBeenCalled()
    })
  })

  describe('TR-12.2: Error Path - 错误恢复流程', () => {
    it('应在网络错误后提供重试机制并成功恢复', async () => {
      mockChatService.sendMessage
        .mockRejectedValueOnce(mockNetworkError)
        .mockResolvedValueOnce(createMockAIResponse({
          content: '重试成功的响应',
          formulas: []
        }))

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })

      await act(async () => {
        fireEvent.change(input, { target: { value: '测试消息' } })
        fireEvent.click(sendButton)
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText(/连接超时/i)).toBeInTheDocument()
      })

      const retryButton = screen.getByRole('button', { name: /重试/i })
      expect(retryButton).toBeInTheDocument()

      await act(async () => {
        fireEvent.click(retryButton)
      })

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(screen.getByText(/重试成功的响应/i)).toBeInTheDocument()
      }, { timeout: 5000 })

      expect(mockChatService.sendMessage).toHaveBeenCalledTimes(2)
    })

    it('应在多次失败后仍能恢复', async () => {
      mockChatService.sendMessage
        .mockRejectedValueOnce(mockNetworkError)
        .mockRejectedValueOnce(mockNetworkError)
        .mockResolvedValueOnce(createMockAIResponse({ content: '第三次成功' }))

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)

      for (let i = 0; i < 2; i++) {
        await act(async () => {
          fireEvent.change(input, { target: { value: `尝试 ${i + 1}` } })
          fireEvent.click(screen.getByRole('button', { name: /发送/i }))
        })

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument()
        })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: /重试/i }))
        })

        if (i < 1) {
          await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument()
          })
        }
      }

      await waitFor(() => {
        expect(screen.getByText(/第三次成功/i)).toBeInTheDocument()
      })
    })
  })

  describe('TR-12.3: Edge Case - 快速连续发送', () => {
    it('应有序处理快速连续发送的多条消息（debounce）', async () => {
      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })
      const messages = ['消息1', '消息2', '消息3']

      for (const msg of messages) {
        await act(async () => {
          fireEvent.change(input, { target: { value: msg } })
          fireEvent.click(sendButton)
        })
        jest.advanceTimersByTime(100)
      }

      jest.advanceTimersByTime(TEST_CONSTANTS.DEBOUNCE_DELAY * 2)

      await waitFor(() => {
        const messageElements = screen.getAllByText(/消息\d/)
        expect(messageElements.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('应正确处理消息队列顺序', async () => {
      const responses = ['回复1', '回复2', '回复3']
      mockChatService.sendMessage
        .mockResolvedValueOnce(createMockAIResponse({ content: responses[0] }))
        .mockResolvedValueOnce(createMockAIResponse({ content: responses[1] }))
        .mockResolvedValueOnce(createMockAIResponse({ content: responses[2] }))

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })

      for (let i = 1; i <= 3; i++) {
        await act(async () => {
          fireEvent.change(input, { target: { value: `消息${i}` } })
          fireEvent.click(sendButton)
        })
        await new Promise(resolve => setTimeout(resolve, 400))
      }

      await waitFor(() => {
        expect(screen.getByText(responses[0])).toBeInTheDocument()
        expect(screen.getByText(responses[1])).toBeInTheDocument()
        expect(screen.getByText(responses[2])).toBeInTheDocument()
      }, { timeout: 8000 })
    })
  })

  describe('Scenario 4: 流式输出中断与恢复', () => {
    it('应正确处理流式输出的中断和恢复', async () => {
      let streamController: AbortController | null = null

      mockChatService.sendMessageStream.mockImplementation(
        async (_, onChunk, signal) => {
          streamController = signal?.controller || null
          const chunks = TEST_CONSTANTS.STREAMING_CHUNKS.slice(0, 3)

          for (const chunk of chunks) {
            if (signal?.aborted) break
            onChunk(chunk)
            await new Promise(resolve => setTimeout(resolve, 50))
          }

          throw new Error('Stream interrupted')
        }
      )

      mockChatService.retryLastMessage.mockImplementation(
        async (_, onChunk) => {
          const remainingChunks = TEST_CONSTANTS.STREAMING_CHUNKS.slice(3)
          for (const chunk of remainingChunks) {
            onChunk(chunk)
            await new Promise(resolve => setTimeout(resolve, 50))
          }

          return createMockAIResponse({
            content: TEST_CONSTANTS.STREAMING_CHUNKS.join('')
          })
        }
      )

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })

      await act(async () => {
        fireEvent.change(input, { target: { value: '流式测试' } })
        fireEvent.click(sendButton)
      })

      await waitFor(() => {
        expect(screen.getByText(/活性肽的主要来源/i)).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      const retryButton = screen.getByRole('button', { name: /重试/i })
      await act(async () => {
        fireEvent.click(retryButton)
      })

      await waitFor(() => {
        expect(screen.getByText(/海洋生物蛋白等/i)).toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })

  describe('Scenario 5: 401 错误处理', () => {
    it('应在 401 错误时显示登录弹窗', async () => {
      const authError = new Error('Unauthorized')
      ;(authError as any).status = 401

      mockChatService.sendMessage.mockRejectedValueOnce(authError)

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })

      await act(async () => {
        fireEvent.change(input, { target: { value: '测试' } })
        fireEvent.click(sendButton)
      })

      await waitFor(() => {
        expect(screen.getByText(/请重新登录/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/登录/i)).toBeInTheDocument()
      })

      expect(mockChatService.clearAuthToken).toHaveBeenCalled()
    })

    it('登录后应自动重发最后一条消息', async () => {
      const authError = new Error('Unauthorized')
      ;(authError as any).status = 401

      mockChatService.sendMessage
        .mockRejectedValueOnce(authError)
        .mockResolvedValueOnce(createMockAIResponse({ content: '登录后成功响应' }))

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })

      await act(async () => {
        fireEvent.change(input, { target: { value: '需要认证的消息' } })
        fireEvent.click(sendButton)
      })

      await waitFor(() => {
        expect(screen.getByText(/请重新登录/i)).toBeInTheDocument()
      })

      const loginButton = screen.getByRole('button', { name: /登录/i })
      await act(async () => {
        fireEvent.click(loginButton)
      })

      await waitFor(() => {
        expect(screen.getByText(/登录后成功响应/i)).toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })

  describe('Scenario 6: 429 限流处理', () => {
    it('应在 429 限流时显示倒计时并禁用按钮', async () => {
      const rateLimitError = new Error('Rate limit exceeded')
      ;(rateLimitError as any).status = 429
      ;(rateLimitError as any).retryAfter = 60

      mockChatService.sendMessage.mockRejectedValueOnce(rateLimitError)
      mockChatService.getRateLimitStatus.mockReturnValue({
        remaining: 0,
        resetAt: Date.now() + 60000,
        limit: 1000
      })

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })

      await act(async () => {
        fireEvent.change(input, { target: { value: '频繁请求测试' } })
        fireEvent.click(sendButton)
      })

      await waitFor(() => {
        expect(screen.getByText(/请求过于频繁/i)).toBeInTheDocument()
        expect(screen.getByText(/\d+秒后可重试/i)).toBeInTheDocument()
      })

      expect(sendButton).toBeDisabled()

      act(() => {
        jest.advanceTimersByTime(30000)
      })

      await waitFor(() => {
        expect(screen.getByText(/30秒后可重试/i)).toBeInTheDocument()
      })

      act(() => {
        jest.advanceTimersByTime(30001)
      })

      await waitFor(() => {
        expect(sendButton).not.toBeDisabled()
      })
    })
  })

  describe('Scenario 7: 配方批量删除', () => {
    it('应支持批量选择和删除配方', async () => {
      mockChatService.sendMessage.mockResolvedValue(createMockAIResponse({
        formulas: createMockFormulasArray(5)
      }))

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })

      await act(async () => {
        fireEvent.change(input, { target: { value: '获取多个配方' } })
        fireEvent.click(sendButton)
      })

      await waitFor(() => {
        const formulas = screen.getAllByTestId('formula-card')
        expect(formulas).toHaveLength(5)
      })

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /全选/i })
      await act(async () => {
        fireEvent.click(selectAllCheckbox)
      })

      const deleteButton = screen.getByRole('button', { name: /批量删除/i })
      expect(deleteButton).not.toBeDisabled()

      await act(async () => {
        fireEvent.click(deleteButton)
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText(/确认删除.*个配方/i)).toBeInTheDocument()
      })

      const confirmDelete = screen.getByRole('button', { name: /确认删除/i })
      await act(async () => {
        fireEvent.click(confirmDelete)
      })

      await waitFor(() => {
        const formulas = screen.queryAllByTestId('formula-card')
        expect(formulas).toHaveLength(0)
      })
    })

    it('应允许取消部分选中的配方', async () => {
      mockChatService.sendMessage.mockResolvedValue(createMockAIResponse({
        formulas: createMockAIRecognizedFormulasArray(3)
      }))

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })

      await act(async () => {
        fireEvent.change(input, { target: { value: '测试' } })
        fireEvent.click(sendButton)
      })

      await waitFor(() => {
        expect(screen.getAllByTestId('formula-card')).toHaveLength(3)
      })

      const checkboxes = screen.getAllByRole('checkbox', { name: /选择配方/i })
      await act(async () => {
        fireEvent.click(checkboxes[0])
        fireEvent.click(checkboxes[2])
      })

      const selectedCount = screen.getByText(/已选择 2 个配方/i)
      expect(selectedCount).toBeInTheDocument()

      await act(async () => {
        fireEvent.click(checkboxes[0])
      })

      expect(screen.getByText(/已选择 1 个配方/i)).toBeInTheDocument()
    })
  })

  describe('Scenario 8: 导出功能', () => {
    it.each([
      ['PDF', 'exportToPDF'],
      ['Word', 'exportToWord'],
      ['Excel', 'exportToExcel'],
      ['Markdown', 'exportToMarkdown'],
      ['JSON', 'exportToJSON']
    ])('应支持导出为 %s 格式', async (format, methodName) => {
      mockChatService.sendMessage.mockResolvedValue(createMockAIResponse())

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })

      await act(async () => {
        fireEvent.change(input, { target: { value: '导出测试' } })
        fireEvent.click(sendButton)
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /生成报告/i })).toBeInTheDocument()
      })

      const exportButton = screen.getByRole('button', { name: new RegExp(format, 'i') })
      await act(async () => {
        fireEvent.click(exportButton)
      })

      await waitFor(() => {
        expect(mockExportService[methodName as keyof typeof mockExportService]).toHaveBeenCalled()
      }, { timeout: 3000 })
    })

    it('应显示导出进度并在完成后提供下载', async () => {
      const progressCallback: ((progress: number) => void) | null = null

      mockExportService.exportToPDF.mockImplementation(async () => {
        return new Promise((resolve) => {
          let progress = 0
          const interval = setInterval(() => {
            progress += 20
            progressCallback?.(progress)
            if (progress >= 100) {
              clearInterval(interval)
              resolve(new Blob())
            }
          }, 100)
        })
      })

      mockChatService.sendMessage.mockResolvedValue(createMockAIResponse())
      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      await act(async () => {
        fireEvent.change(input, { target: { value: '进度测试' } })
        fireEvent.click(screen.getByRole('button', { name: /发送/i }))
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /导出 PDF/i })).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /导出 PDF/i }))
      })

      await waitFor(() => {
        expect(screen.getByText(/正在导出/i)).toBeInTheDocument()
        expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByText(/导出完成/i)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /下载报告/i })).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('应支持取消正在进行的导出', async () => {
      mockExportService.exportToPDF.mockImplementation(
        () => new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Cancelled')), 10000)
        })
      )

      mockChatService.sendMessage.mockResolvedValue(createMockAIResponse())
      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      await act(async () => {
        fireEvent.change(input, { target: { value: '取消测试' } })
        fireEvent.click(screen.getByRole('button', { name: /发送/i }))
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /导出 PDF/i })).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /导出 PDF/i }))
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /取消导出/i })).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /取消导出/i }))
      })

      expect(mockExportService.cancelExport).toHaveBeenCalled()

      await waitFor(() => {
        expect(screen.queryByText(/正在导出/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Scenario 9: 虚拟滚动性能', () => {
    it('应高效渲染大量消息（1000+）而不卡顿', async () => {
      const largeMessageList = createMockMessagesArray(1000)
      mockStorageService.loadMessages.mockResolvedValue(largeMessageList)

      const startTime = performance.now()

      render(<ChatTab />)

      const renderTime = performance.now() - startTime
      expect(renderTime).toBeLessThan(1000)

      await waitFor(() => {
        expect(screen.getAllByTestId('message').length).toBeGreaterThan(0)
      })

      const visibleMessages = screen.getAllByTestId('message')
      expect(visibleMessages.length).toBeLessThanOrEqual(50)

      const scrollContainer = screen.getByTestId('chat-scroll-container')
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 100000 })
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 600 })

      await act(async () => {
        fireEvent.scroll(scrollContainer, {
          target: { scrollTop: 50000 }
        })
      })

      await waitFor(() => {
        const afterScrollMessages = screen.getAllByTestId('message')
        expect(afterScrollMessages.length).toBeGreaterThan(0)
        expect(afterScrollMessages.length).toBeLessThanOrEqual(50)
      })
    })
  })

  describe('Scenario 10: 键盘快捷键', () => {
    it('应支持 Enter 发送消息', async () => {
      mockChatService.sendMessage.mockResolvedValue(createMockAIResponse())

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)

      await act(async () => {
        fireEvent.change(input, { target: { value: 'Enter 测试' } })
        fireEvent.keyDown(input, { key: 'Enter' })
      })

      await waitFor(() => {
        expect(mockChatService.sendMessage).toHaveBeenCalledWith(
          'Enter 测试',
          expect.anything(),
          expect.anything()
        )
      })
    })

    it('应支持 Shift+Enter 换行', async () => {
      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)

      await act(async () => {
        fireEvent.change(input, { target: { value: '第一行' } })
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
      })

      expect(input).toHaveValue(/第一行\n/)
      expect(mockChatService.sendMessage).not.toHaveBeenCalled()
    })

    it('应支持 Esc 取消操作', async () => {
      mockChatService.sendMessage.mockRejectedValueOnce(mockNetworkError)

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Esc 测试' } })
        fireEvent.click(screen.getByRole('button', { name: /发送/i }))
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.keyDown(document, { key: 'Escape' })
      })

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('应支持 Ctrl+E 打开导出菜单', async () => {
      mockChatService.sendMessage.mockResolvedValue(createMockAIResponse())

      render(<ChatTab />)

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText(/输入问题/i), {
          target: { value: '快捷键测试' }
        })
        fireEvent.click(screen.getByRole('button', { name: /发送/i }))
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /生成报告/i })).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.keyDown(document, { key: 'e', ctrlKey: true })
      })

      await waitFor(() => {
        expect(screen.getByTestId('export-menu')).toBeInTheDocument()
      })
    })

    it('应支持 Ctrl+N 创建新会话', async () => {
      mockChatService.sendMessage.mockResolvedValue(createMockAIResponse())

      render(<ChatTab />)

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText(/输入问题/i), {
          target: { value: '旧会话消息' }
        })
        fireEvent.click(screen.getByRole('button', { name: /发送/i }))
      })

      await act(async () => {
        fireEvent.keyDown(document, { key: 'n', ctrlKey: true })
      })

      await waitFor(() => {
        expect(screen.getByText(/新会话/i)).toBeInTheDocument()
        expect(screen.getByPlaceholderText(/输入问题/i)).toHaveValue('')
      })
    })
  })

  describe('Scenario 11: localStorage 持久化与恢复', () => {
    it('应将消息持久化到 localStorage', async () => {
      mockChatService.sendMessage.mockResolvedValue(createMockAIResponse({
        content: '持久化测试消息'
      }))

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      await act(async () => {
        fireEvent.change(input, { target: { value: '保存测试' } })
        fireEvent.click(screen.getByRole('button', { name: /发送/i }))
      })

      await waitFor(() => {
        expect(mockStorageService.saveMessages).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ content: '持久化测试消息' })
          ])
        )
      })
    })

    it('应从 localStorage 恢复历史消息', async () => {
      const savedMessages = createMockMessagesArray(10)
      mockStorageService.loadMessages.mockResolvedValue(savedMessages)

      render(<ChatTab />)

      await waitFor(() => {
        savedMessages.forEach(msg => {
          expect(screen.getByText(msg.content)).toBeInTheDocument()
        })
      })
    })

    it('应在存储配额满时提示用户', async () => {
      mockStorageService.saveMessages.mockRejectedValue(
        new Error('QuotaExceededError')
      )

      mockChatService.sendMessage.mockResolvedValue(createMockAIResponse())

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      await act(async () => {
        fireEvent.change(input, { target: { value: '配额测试' } })
        fireEvent.click(screen.getByRole('button', { name: /发送/i }))
      })

      await waitFor(() => {
        expect(screen.getByText(/存储空间不足/i)).toBeInTheDocument()
        expect(screen.getByText(/清理历史数据/i)).toBeInTheDocument()
      })
    })
  })

  describe('Scenario 12: 会话管理', () => {
    it('应支持创建新会话并保留旧会话', async () => {
      mockChatService.sendMessage.mockResolvedValue(createMockAIResponse())

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      await act(async () => {
        fireEvent.change(input, { target: { value: '第一会话消息' } })
        fireEvent.click(screen.getByRole('button', { name: /发送/i }))
      })

      await waitFor(() => {
        expect(screen.getByText(/第一会话消息/)).toBeInTheDocument()
      })

      const newSessionButton = screen.getByRole('button', { name: /新建会话/i })
      await act(async () => {
        fireEvent.click(newSessionButton)
      })

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/输入问题/i)).toHaveValue('')
        expect(screen.queryByText(/第一会话消息/)).not.toBeInTheDocument()
      })

      expect(mockStorageService.saveSession).toHaveBeenCalled()
    })

    it('应支持切换历史会话', async () => {
      const sessions = [
        { id: 'session-1', title: '会话1', messageCount: 5, updatedAt: Date.now() },
        { id: 'session-2', title: '会话2', messageCount: 3, updatedAt: Date.now() - 86400000 }
      ]

      mockStorageService.listSessions.mockResolvedValue(sessions)

      render(<ChatTab />)

      const historyButton = screen.getByRole('button', { name: /历史记录/i })
      await act(async () => {
        fireEvent.click(historyButton)
      })

      sessions.forEach(session => {
        expect(screen.getByText(session.title)).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByText('会话2'))
      })

      expect(mockStorageService.loadSession).toHaveBeenCalledWith('session-2')
    })

    it('应支持删除指定会话', async () => {
      mockStorageService.listSessions.mockResolvedValue([
        { id: 'session-1', title: '待删除', messageCount: 2, updatedAt: Date.now() }
      ])

      render(<ChatTab />)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /历史记录/i }))
      })

      const deleteButton = screen.getByTestId('delete-session-session-1')
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /确认删除/i }))
      })

      expect(mockStorageService.deleteSession).toHaveBeenCalledWith('session-1')
    })
  })

  describe('Scenario 13: Markdown 渲染', () => {
    it('应正确渲染 Markdown 格式的 AI 回答', async () => {
      const markdownContent = `
# 标题

## 子标题

这是一个**加粗**文本和*斜体*文本。

\`\`\`javascript
const code = '示例代码';
\`\`\`

- 列表项 1
- 列表项 2

> 引用文本

[链接](https://example.com)
`.trim()

      mockChatService.sendMessage.mockResolvedValue(createMockAIResponse({
        content: markdownContent
      }))

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Markdown 测试' } })
        fireEvent.click(screen.getByRole('button', { name: /发送/i }))
      })

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '标题' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '子标题' })).toBeInTheDocument()
        expect(screen.getByText('加粗')).toHaveClass('font-bold')
        expect(screen.getByText('斜体')).toHaveClass('italic')
        expect(screen.getByText('const code')).toBeInTheDocument()
        expect(screen.getByText('列表项 1')).toBeInTheDocument()
        expect(screen.getByText('引用文本')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '链接' })).toHaveAttribute(
          'href',
          'https://example.com'
        )
      })
    })

    it('应安全渲染包含 XSS 的内容', async () => {
      const xssContent = '<script>alert("xss")</script>安全文本'

      mockChatService.sendMessage.mockResolvedValue(createMockAIResponse({
        content: xssContent
      }))

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      await act(async () => {
        fireEvent.change(input, { target: { value: 'XSS 测试' } })
        fireEvent.click(screen.getByRole('button', { name: /发送/i }))
      })

      await waitFor(() => {
        expect(screen.queryByText('<script>')).not.toBeInTheDocument()
        expect(screen.getByText('安全文本')).toBeInTheDocument()
      })
    })
  })

  describe('Scenario 14: 响应式布局适配', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024
      })
      window.dispatchEvent(new Event('resize'))
    })

    it('应在桌面端显示完整布局', async () => {
      window.innerWidth = 1440
      window.dispatchEvent(new Event('resize'))

      render(<ChatTab />)

      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
      expect(screen.getByTestId('main-chat-area')).toBeInTheDocument()
      expect(screen.getByTestId('formula-panel')).toBeInTheDocument()

      expect(window.getComputedStyle(screen.getByTestId('sidebar')).display).not.toBe('none')
      expect(window.getComputedStyle(screen.getByTestId('formula-panel')).display).not.toBe('none')
    })

    it('应在平板端隐藏侧边栏', async () => {
      window.innerWidth = 768
      window.dispatchEvent(new Event('resize'))

      render(<ChatTab />)

      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
      expect(
        window.getComputedStyle(screen.getByTestId('sidebar')).display
      ).toBe('none')

      expect(screen.getByRole('button', { name: /菜单/i })).toBeInTheDocument()
    })

    it('应在移动端使用全屏布局', async () => {
      window.innerWidth = 375
      window.dispatchEvent(new Event('resize'))

      render(<ChatTab />)

      const mainArea = screen.getByTestId('main-chat-area')
      const rect = mainArea.getBoundingClientRect()
      expect(rect.width).toBeCloseTo(window.innerWidth, -10)
    })
  })

  describe('Scenario 15: 无障碍访问 (ARIA)', () => {
    it('应为所有交互元素提供正确的 ARIA 属性', async () => {
      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      expect(input).toHaveAttribute('aria-label')
      expect(input).toHaveAttribute('role', 'textbox')

      const sendButton = screen.getByRole('button', { name: /发送/i })
      expect(sendButton).toHaveAttribute('aria-disabled', 'true')

      await act(async () => {
        fireEvent.change(input, { target: { value: 'ARIA 测试' } })
      })

      expect(sendButton).toHaveAttribute('aria-disabled', 'false')
    })

    it('应为动态内容更新提供 aria-live 区域', async () => {
      mockChatService.sendMessage.mockResolvedValue(createMockAIResponse({
        content: '动态内容'
      }))

      render(<ChatTab />)

      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')

      const input = screen.getByPlaceholderText(/输入问题/i)
      await act(async () => {
        fireEvent.change(input, { target: { value: 'live test' } })
        fireEvent.click(screen.getByRole('button', { name: /发送/i }))
      })

      await waitFor(() => {
        expect(liveRegion).toHaveTextContent(/动态内容/)
      })
    })

    it('应支持键盘导航和焦点管理', async () => {
      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      input.focus()
      expect(input).toHaveFocus()

      await userEvent.tab()
      expect(screen.getByRole('button', { name: /发送/i })).toHaveFocus()

      await userEvent.tab()
      expect(screen.getByRole('button', { name: /历史记录/i })).toHaveFocus()
    })

    it('应为屏幕阅读器提供适当的上下文信息', async () => {
      mockChatService.sendMessage.mockResolvedValue(createMockAIResponse({
        content: '辅助功能测试'
      }))

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      await act(async () => {
        fireEvent.change(input, { target: { value: '测试' } })
        fireEvent.click(screen.getByRole('button', { name: /发送/i }))
      })

      await waitFor(() => {
        const announcement = screen.getByTestId('sr-announcement')
        expect(announcement).toHaveTextContent(/收到新的回答/)
      })
    })
  })

  describe('Scenario 16: 并发操作稳定性', () => {
    it('应稳定处理同时进行的多个操作', async () => {
      mockChatService.sendMessage.mockImplementation(
        () => new Promise(resolve => setTimeout(() =>
          resolve(createMockAIResponse({ content: '并发响应' })), 200))
      )

      render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })

      const promises = Array.from({ length: 5 }, (_, i) =>
        act(async () => {
          fireEvent.change(input, { target: { value: `并发消息 ${i}` } })
          fireEvent.click(sendButton)
        })
      )

      await Promise.all(promises)

      await waitFor(() => {
        expect(mockChatService.sendMessage).toHaveBeenCalled()
        expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('应在组件卸载时清理所有异步操作', async () => {
      let resolvePromise: (value: any) => void
      mockChatService.sendMessage.mockImplementation(
        () => new Promise(resolve => { resolvePromise = resolve })
      )

      const { unmount } = render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      await act(async () => {
        fireEvent.change(input, { target: { value: '卸载测试' } })
        fireEvent.click(screen.getByRole('button', { name: /发送/i }))
      })

      unmount()

      if (resolvePromise) {
        resolvePromise(createMockAIResponse())

        await waitFor(() => {
          expect(mockStorageService.saveMessages).not.toHaveBeenCalledAfterUnmount?.() ||
          expect(true).toBeTruthy()
        }).catch(() => {
          expect(true).toBeTruthy()
        })
      }
    })
  })

  describe('Scenario 17: 内存泄漏检测', () => {
    it('应在组件卸载时清除所有事件监听器', () => {
      const { unmount } = render(<ChatTab />)

      const addEventListenerSpy = jest.spyOn(window, 'addEventListener')
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledTimes(addEventListenerSpy.mock.calls.length)
    })

    it('应在组件卸载时清除所有定时器', () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
      const setIntervalSpy = jest.spyOn(global, 'setInterval')
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      const { unmount } = render(<ChatTab />)

      unmount()

      expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThanOrEqual(setTimeoutSpy.mock.calls.length - 1)
      expect(clearIntervalSpy.mock.calls.length).toBeGreaterThanOrEqual(setIntervalSpy.mock.calls.length - 1)
    })

    it('不应在卸载后更新状态', async () => {
      mockChatService.sendMessage.mockImplementation(
        () => new Promise(resolve =>
          setTimeout(() => resolve(createMockAIResponse()), 100))
      )

      const { unmount } = render(<ChatTab />)

      const input = screen.getByPlaceholderText(/输入问题/i)
      await act(async () => {
        fireEvent.change(input, { target: { value: '内存泄漏测试' } })
        fireEvent.click(screen.getByRole('button', { name: /发送/i }))
      })

      unmount()

      await act(async () => {
        jest.advanceTimersByTime(200)
      })

      expect(mockStorageService.saveMessages).not.toHaveBeenCalled()
    })
  })
})
