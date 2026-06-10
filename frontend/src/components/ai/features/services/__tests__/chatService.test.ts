import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChatService } from '../chatService'

describe('ChatService', () => {
  let service: ChatService

  beforeEach(() => {
    service = new ChatService({
      timeout: 5000,
      maxRetries: 1,
      debounceMs: 100,
    })
  })

  it('should create instance with default config', () => {
    const defaultService = new ChatService()
    expect(defaultService).toBeInstanceOf(ChatService)
    expect(defaultService.getStateMachine()).toBeDefined()
  })

  it('should handle rate limit status', () => {
    const status = service.getRateLimitStatus()
    expect(status).toHaveProperty('remaining')
    expect(status).toHaveProperty('resetAt')
    expect(status).toHaveProperty('limit')
  })

  it('should return null for last error when no error occurred', () => {
    expect(service.getLastError()).toBeNull()
    expect(service.getClassifiedError()).toBeNull()
  })

  it('should set and clear auth token', () => {
    service.setAuthToken('test-token-123')
    service.clearAuthToken()
    expect(service.getLastError()).toBeNull()
  })
})
