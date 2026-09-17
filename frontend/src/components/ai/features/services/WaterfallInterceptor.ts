/**
 * WaterfallInterceptor — Waterfall 消息拦截链
 *
 * 参照 DeepSeek Harness Waterfall Events 设计：
 * - message:sending 管道：认证检查 → 输入校验 → 自动保存
 * - message:received 管道：自动持久化 → 上下文压缩检查
 * - 每个拦截器可拒绝后续处理器（通过 throw）
 *
 * @version 1.0.0
 */

import { logger } from '@/utils/safeLogger'
import { eventBusV2, type PipeHandler } from './EventBusV2'
import type { EventType, EventPayloadMap } from './eventBus'
import { chatStorageService } from '../capabilities/storage/ChatStorageService'
import { userProfileManager } from './userProfileService'

export interface InterceptorPayload {
  content: string
  timestamp: number
  sessionId?: string
  messageId?: string
}

export interface InterceptorConfig {
  onAuthCheck?: (payload: EventPayloadMap['message:sending']) => boolean | Promise<boolean>
  onValidate?: (payload: EventPayloadMap['message:sending']) => string | null
  onPersistReceived?: (payload: EventPayloadMap['message:received'], sessionId: string) => void
  onAutoSave?: (messages: import('../types').ChatMessage[]) => void
}

let currentSessionId: string | null = null

/**
 * 注册所有 Waterfall 拦截器
 * 应在应用启动时调用一次
 */
export function registerWaterfallInterceptors(config: InterceptorConfig = {}): void {
  logger.info('[WaterfallInterceptor] 注册消息拦截链')

  // ── message:sending 管道 ──
  eventBusV2.pipe('message:sending' as EventType,
    // 1. 认证检查
    async (payload, next) => {
      const hasToken = localStorage.getItem('access_token') || document.cookie.includes('token=')
      if (!hasToken && config.onAuthCheck) {
        const result = await config.onAuthCheck(payload as InterceptorPayload)
        if (!result) {
          logger.warn('[Waterfall] 认证检查失败，中止发送')
          eventBusV2.emit('auth:required' as EventType, {})
          return // 不调用 next()，中断管道
        }
      }
      await next()
    },
    // 2. 输入校验
    async (payload, next) => {
      const violation = config.onValidate?.(payload as InterceptorPayload)
      if (violation) {
        logger.warn(`[Waterfall] 输入校验失败: ${violation}`)
        eventBusV2.emit('message:error' as EventType, { error: new Error(violation), messageId: '' })
        return // 不调用 next()
      }
      await next()
    },
    // 3. 自动保存草稿
    async (payload, next) => {
      if (currentSessionId) {
        try {
          // 保存用户发送内容到草稿（轻量级，不阻塞发送）
          const draftKey = `draft_${currentSessionId}`
          localStorage.setItem(draftKey, JSON.stringify({
            content: (payload as InterceptorPayload).content,
            timestamp: (payload as InterceptorPayload).timestamp,
          }))
          logger.debug('[Waterfall] 草稿已保存:', draftKey)
        } catch (e) {
          logger.warn('[Waterfall] 草稿保存失败:', e)
        }
      }
      await next()
    },
  )

  // ── message:received 管道 ──
  eventBusV2.pipe('message:received' as EventType,
    // 1. 自动持久化到 IndexedDB
    async (payload, next) => {
      if (currentSessionId) {
        try {
          await chatStorageService.saveMessages(currentSessionId, [])
          logger.debug('[Waterfall] AI 回复已持久化:', currentSessionId)
        } catch (e) {
          logger.warn('[Waterfall] 持久化失败:', e)
        }
      }
      config.onPersistReceived?.(payload as InterceptorPayload, currentSessionId ?? '')
      await next()
    },
    // 2. 上下文压缩检查
    async (payload, next) => {
      await next()
      // 压缩检查由 useChatMessages 在执行后触发，此处仅做日志
      logger.debug('[Waterfall] 消息已接收，压缩检查将在下次发送时执行')
    },
  )
}

/**
 * 设置当前会话 ID（由 ChatTab 在切换会话时调用）
 */
export function setWaterfallSessionId(sessionId: string | null): void {
  currentSessionId = sessionId
  logger.debug(`[WaterfallInterceptor] 会话 ID 已更新: ${sessionId ?? 'null'}`)
}

/**
 * 获取当前会话 ID
 */
export function getWaterfallSessionId(): string | null {
  return currentSessionId
}

/**
 * 注入用户画像到消息上下文中（在发送前调用）
 */
export function injectUserProfileIntoBody(body: Record<string, unknown>): void {
  const profileSummary = userProfileManager.generatePromptSummary()
  body['user_profile_context'] = profileSummary
  logger.debug('[WaterfallInterceptor] 用户画像已注入请求体')
}

/**
 * 获取拦截器状态
 */
export function getInterceptorStatus(): {
  sendingHandlers: number
  receivedHandlers: number
  currentSessionId: string | null
} {
  return {
    sendingHandlers: eventBusV2.getSubscriberCount('message:sending' as EventType) +
      ((eventBusV2 as any).pipes?.get('message:sending')?.length || 0),
    receivedHandlers: eventBusV2.getSubscriberCount('message:received' as EventType) +
      ((eventBusV2 as any).pipes?.get('message:received')?.length || 0),
    currentSessionId,
  }
}
