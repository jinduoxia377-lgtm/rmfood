import { vi, Mock } from 'vitest'
import { IEventBus, IChatService, IStorageService, IExportService } from '../../types'
import {
  createMockAIResponse,
  TEST_CONSTANTS
} from './testFactories'

export function createMockEventBus(): vi.Mocked<IEventBus> {
  return {
    emit: vi.fn<IEventBus['emit']>(),
    subscribe: vi.fn<IEventBus['subscribe']>(() => vi.fn()),
    once: vi.fn<IEventBus['once']>(() => vi.fn()),
    clear: vi.fn<IEventBus['clear']>(),
    clearEvent: vi.fn<IEventBus['clearEvent']>(),
    getSubscriberCount: vi.fn<IEventBus['getSubscriberCount']>(() => 0),
    hasSubscribers: vi.fn<IEventBus['hasSubscribers']>(() => false)
  }
}

export function createMockChatService(overrides: Partial<vi.Mocked<IChatService>> = {}): vi.Mocked<IChatService> {
  const defaultService = {
    sendMessage: vi.fn<IChatService['sendMessage']>().mockResolvedValue(createMockAIResponse() as Awaited<ReturnType<IChatService['sendMessage']>>),
    sendMessageStream: vi.fn<IChatService['sendMessageStream']>(),
    setAuthToken: vi.fn<IChatService['setAuthToken']>(),
    clearAuthToken: vi.fn<IChatService['clearAuthToken']>(),
    retryLastMessage: vi.fn<IChatService['retryLastMessage']>().mockResolvedValue(createMockAIResponse({
      content: '重试成功的响应'
    }) as Awaited<ReturnType<IChatService['retryLastMessage']>>),
    getLastError: vi.fn<IChatService['getLastError']>(() => null),
    getClassifiedError: vi.fn<IChatService['getClassifiedError']>(() => null),
    getRateLimitStatus: vi.fn<IChatService['getRateLimitStatus']>(() => ({
      remaining: 100,
      resetAt: null,
      limit: 1000
    }))
  }

  return { ...defaultService, ...overrides }
}

export function createMockStorageService(overrides: Partial<vi.Mocked<IStorageService>> = {}): vi.Mocked<IStorageService> {
  return {
    saveMessages: vi.fn<IStorageService['saveMessages']>().mockResolvedValue(undefined),
    loadMessages: vi.fn<IStorageService['loadMessages']>().mockResolvedValue([]),
    saveSession: vi.fn<IStorageService['saveSession']>().mockResolvedValue(undefined),
    loadSession: vi.fn<IStorageService['loadSession']>().mockResolvedValue(null),
    deleteSession: vi.fn<IStorageService['deleteSession']>().mockResolvedValue(undefined),
    listSessions: vi.fn<IStorageService['listSessions']>().mockResolvedValue([]),
    clearAll: vi.fn<IStorageService['clearAll']>().mockResolvedValue(undefined),
    getUsageStats: vi.fn<IStorageService['getUsageStats']>().mockResolvedValue({
      totalMessages: 0,
      totalSessions: 0,
      storageUsed: 0,
      lastActivity: null
    }),
    ...overrides
  }
}

export function createMockExportService(overrides: Partial<vi.Mocked<IExportService>> = {}): vi.Mocked<IExportService> {
  return {
    exportToPDF: vi.fn<IExportService['exportToPDF']>().mockResolvedValue(new Blob()),
    exportToWord: vi.fn<IExportService['exportToWord']>().mockResolvedValue(new Blob()),
    exportToExcel: vi.fn<IExportService['exportToExcel']>().mockResolvedValue(new Blob()),
    exportToMarkdown: vi.fn<IExportService['exportToMarkdown']>().mockResolvedValue('# 测试报告'),
    exportToJSON: vi.fn<IExportService['exportToJSON']>().mockResolvedValue('{}'),
    cancelExport: vi.fn<IExportService['cancelExport']>(),
    getExportProgress: vi.fn<IExportService['getExportProgress']>(() => ({
      isExporting: false,
      progress: 0,
      format: null
    })),
    ...overrides
  }
}

export function setupMockServiceWithError<T extends keyof IChatService>(
  service: vi.Mocked<IChatService>,
  method: T,
  error: Error
): void {
  const mockFn = service[method] as unknown as Mock
  mockFn.mockRejectedValueOnce(error)
}

export function setupMockServiceWithDelay<T extends keyof IChatService>(
  service: vi.Mocked<IChatService>,
  method: T,
  delay: number,
  result?: any
): void {
  (service[method] as unknown as Mock).mockImplementationOnce(
    () => new Promise(resolve => setTimeout(() => resolve(result), delay))
  )
}

export const mockNetworkError = new Error(TEST_CONSTANTS.ERROR_MESSAGE)
export const mockAuthError = new Error('Unauthorized')
export const mockRateLimitError = new Error('Rate limit exceeded')
