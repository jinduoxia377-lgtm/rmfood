/**
 * chatService 流式可恢复错误识别与自动重试判定测试（六期）
 *
 * 覆盖：
 * - 网络中断 / 超时 / 5xx（502/503）视为可恢复 → 自动重试
 * - 后端 SSE retryable=true 视为可恢复
 * - AbortError（用户取消）/ 401 认证错误不重试
 */
import { describe, it, expect } from 'vitest'
import { chatService } from '@/components/ai/features/services/chatService'

// 访问私有方法用于单测
const svc = chatService as unknown as {
  _isRecoverableStreamError: (error: any, errMsg: string) => boolean
}

describe('chatService._isRecoverableStreamError', () => {
  it('网络中断（Failed to fetch）可重试', () => {
    expect(svc._isRecoverableStreamError(new Error('Failed to fetch'), 'Failed to fetch')).toBe(true)
  })

  it('超时可重试', () => {
    expect(svc._isRecoverableStreamError(new Error('timeout'), 'timeout')).toBe(true)
    expect(svc._isRecoverableStreamError(new Error('请求超时'), '请求超时')).toBe(true)
  })

  it('502/503 可重试', () => {
    expect(svc._isRecoverableStreamError(new Error('503'), '503')).toBe(true)
    expect(svc._isRecoverableStreamError(new Error('502'), '502')).toBe(true)
  })

  it('后端 SSE retryable=true 可重试', () => {
    const e: any = new Error('[SSE] AI 服务繁忙')
    e.retryable = true
    expect(svc._isRecoverableStreamError(e, '[SSE] AI 服务繁忙')).toBe(true)
  })

  it('AbortError（用户取消）不重试', () => {
    const e: any = new Error('The user aborted a request.')
    e.name = 'AbortError'
    expect(svc._isRecoverableStreamError(e, 'aborted')).toBe(false)
    expect(svc._isRecoverableStreamError(new Error('ERR_ABORTED'), 'ERR_ABORTED')).toBe(false)
  })

  it('401 认证错误不重试', () => {
    expect(svc._isRecoverableStreamError(new Error('401 认证失败'), '401 认证失败')).toBe(false)
    expect(svc._isRecoverableStreamError(new Error('Token 已过期'), 'Token 已过期')).toBe(false)
  })
})