import { jest } from '@jest/globals'
import { IEventBus, IChatService, IStorageService, IExportService } from '../../types'
import {
  createMockAIResponse,
  createMockFormula,
  createMockMessage,
  TEST_CONSTANTS
} from './testFactories'

export function createMockEventBus(): jest.Mocked<IEventBus> {
  return {
    emit: jest.fn<IEventBus['emit']>(),
    subscribe: jest.fn<IEventBus['subscribe']>(() => jest.fn()),
    once: jest.fn<IEventBus['once']>(() => jest.fn()),
    clear: jest.fn<IEventBus['clear']>(),
    clearEvent: jest.fn<IEventBus['clearEvent']>(),
    getSubscriberCount: jest.fn<IEventBus['getSubscriberCount']>(() => 0),
    hasSubscribers: jest.fn<IEventBus['hasSubscribers']>(() => false)
  }
}

export function createMockChatService(overrides: Partial<jest.Mocked<IChatService>> = {}): jest.Mocked<IChatService> {
  const defaultService = {
    sendMessage: jest.fn<IChatService['sendMessage']>().mockResolvedValue(createMockAIResponse() as Awaited<ReturnType<IChatService['sendMessage']>>),
    sendMessageStream: jest.fn<IChatService['sendMessageStream']>(),
    setAuthToken: jest.fn<IChatService['setAuthToken']>(),
    clearAuthToken: jest.fn<IChatService['clearAuthToken']>(),
    retryLastMessage: jest.fn<IChatService['retryLastMessage']>().mockResolvedValue(createMockAIResponse({
      content: '重试成功的响应'
    }) as Awaited<ReturnType<IChatService['retryLastMessage']>>),
    getLastError: jest.fn<IChatService['getLastError']>(() => null),
    getClassifiedError: jest.fn<IChatService['getClassifiedError']>(() => null),
    getRateLimitStatus: jest.fn<IChatService['getRateLimitStatus']>(() => ({
      remaining: 100,
      resetAt: null,
      limit: 1000
    }))
  }

  return { ...defaultService, ...overrides }
}

export function createMockStorageService(overrides: Partial<jest.Mocked<IStorageService>> = {}): jest.Mocked<IStorageService> {
  return {
    saveMessages: jest.fn<IStorageService['saveMessages']>().mockResolvedValue(undefined),
    loadMessages: jest.fn<IStorageService['loadMessages']>().mockResolvedValue([]),
    saveSession: jest.fn<IStorageService['saveSession']>().mockResolvedValue(undefined),
    loadSession: jest.fn<IStorageService['loadSession']>().mockResolvedValue(null),
    deleteSession: jest.fn<IStorageService['deleteSession']>().mockResolvedValue(undefined),
    listSessions: jest.fn<IStorageService['listSessions']>().mockResolvedValue([]),
    clearAll: jest.fn<IStorageService['clearAll']>().mockResolvedValue(undefined),
    getUsageStats: jest.fn<IStorageService['getUsageStats']>().mockResolvedValue({
      totalMessages: 0,
      totalSessions: 0,
      storageUsed: 0,
      lastActivity: null
    }),
    ...overrides
  }
}

export function createMockExportService(overrides: Partial<jest.Mocked<IExportService>> = {}): jest.Mocked<IExportService> {
  return {
    exportToPDF: jest.fn<IExportService['exportToPDF']>().mockResolvedValue(new Blob()),
    exportToWord: jest.fn<IExportService['exportToWord']>().mockResolvedValue(new Blob()),
    exportToExcel: jest.fn<IExportService['exportToExcel']>().mockResolvedValue(new Blob()),
    exportToMarkdown: jest.fn<IExportService['exportToMarkdown']>().mockResolvedValue('# 测试报告'),
    exportToJSON: jest.fn<IExportService['exportToJSON']>().mockResolvedValue('{}'),
    cancelExport: jest.fn<IExportService['cancelExport']>(),
    getExportProgress: jest.fn<IExportService['getExportProgress']>(() => ({
      isExporting: false,
      progress: 0,
      format: null
    })),
    ...overrides
  }
}

export function setupMockServiceWithError<T extends keyof IChatService>(
  service: jest.Mocked<IChatService>,
  method: T,
  error: Error
): void {
  const mockFn = service[method] as unknown as jest.Mock
  mockFn.mockRejectedValueOnce(error)
}

export function setupMockServiceWithDelay<T extends keyof IChatService>(
  service: jest.Mocked<IChatService>,
  method: T,
  delay: number,
  result?: any
): void {
  (service[method] as unknown as jest.Mock).mockImplementationOnce(
    () => new Promise(resolve => setTimeout(() => resolve(result), delay))
  )
}

export const mockNetworkError = new Error(TEST_CONSTANTS.ERROR_MESSAGE)
export const mockAuthError = new Error('Unauthorized')
export const mockRateLimitError = new Error('Rate limit exceeded')
