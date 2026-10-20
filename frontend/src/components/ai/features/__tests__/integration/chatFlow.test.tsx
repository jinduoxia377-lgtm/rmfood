import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChatTab } from '../../ChatTab'
import { ChatStateProvider } from '../../ChatStateProvider'
import { chatService } from '../../services/chatService'

// 当前架构：ChatTab 是纯布局组件，所有业务逻辑在 ChatStateProvider 中。
// 测试通过 ChatStateProvider 包裹，并 mock 底层网络/存储服务。
vi.mock('@/components/ai/features/services/chatService', () => ({
  chatService: {
    sendMessage: vi.fn().mockResolvedValue({ content: '非流式回复', role: 'assistant', formulas: [], timestamp: 0 }),
    sendMessageStream: vi.fn(),
    clearAuthToken: vi.fn(),
    closeAllPendingRequests: vi.fn(),
    retryLastMessage: vi.fn(),
  },
}))

vi.mock('@/components/ai/features/services/eventBus', () => ({
  eventBus: {
    emit: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}))

vi.mock('@/components/ai/features/services/storageService', () => ({
  storageService: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('@/components/ai/features/capabilities/storage/ChatStorageService', () => ({
  chatStorageService: {
    saveMessages: vi.fn().mockResolvedValue(undefined),
    deleteMessages: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/api/modelClient', () => ({
  ModelClient: {
    getModelStatus: vi.fn().mockResolvedValue({ data: { available: true, models: ['default'] } }),
  },
}))

vi.mock('@/api/ai', () => ({
  aiApi: { chat: vi.fn() },
}))

vi.mock('@/api/client', () => ({
  default: { post: vi.fn().mockResolvedValue({ data: {} }), get: vi.fn().mockResolvedValue({ data: {} }) },
}))

vi.mock('@/utils/safeLogger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), log: vi.fn() },
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderChatTab() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ChatStateProvider>
        <ChatTab />
      </ChatStateProvider>
    </QueryClientProvider>
  )
}

describe('ChatFlow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应渲染消息输入框与发送按钮', () => {
    renderChatTab()

    expect(screen.getByPlaceholderText(/描述/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发送' })).toBeInTheDocument()
  })

  it('发送消息后应展示用户消息与 AI 回复', async () => {
    ;(chatService.sendMessageStream as Mock).mockImplementation(async function* () {
      yield { done: false, content: '这是模拟回复' }
      yield { done: true, content: '' }
    })

    renderChatTab()

    const input = screen.getByPlaceholderText(/描述/)
    const sendButton = screen.getByRole('button', { name: '发送' })

    await act(async () => {
      fireEvent.change(input, { target: { value: '你好' } })
      fireEvent.click(sendButton)
    })

    await waitFor(() => {
      expect(screen.getByText('你好')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText(/这是模拟回复/)).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})