import { logger } from '@/utils/safeLogger'

export type EventType =
  | 'message:sending'
  | 'message:received'
  | 'message:error'
  | 'formulas:detected'
  | 'formulas:added'
  | 'report:generating'
  | 'report:generated'
  | 'export:started'
  | 'export:completed'
  | 'state:changed'
  | 'auth:required'        // 认证失效，需要重新登录
  | 'ai:config_error'      // AI 服务配置错误（API Key 无效等）
  | 'thinking:step'         // AI 思考步骤更新（转发至 ChatSidebar）

export interface EventPayloadMap {
  'message:sending': { content: string; timestamp: number }
  'message:received': { content: string; senderId: string; timestamp: number }
  'message:error': { error: Error; messageId?: string }
  'formulas:detected': { formulas: { name: string; value: number }[] }
  'formulas:added': { formulaName: string; formulaData: Record<string, unknown> }
  'report:generating': { reportType: string; progress: number }
  'report:generated': { reportUrl: string; reportType: string }
  'export:started': { format: string; itemCount: number }
  'export:completed': { filePath: string; success: boolean }
  'state:changed': { newState: string; previousState?: string }
  'auth:required': Record<string, never>
  'ai:config_error': { type: string; message: string; suggestion?: string }
  'thinking:step': { step: string; content: string; status: string; detail?: string }
}

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>

export interface IEventBus {
  emit<T extends EventType>(event: T, payload: EventPayloadMap[T]): void
  subscribe<T extends EventType>(event: T, handler: EventHandler<EventPayloadMap[T]>): UnsubscribeFn
  once<T extends EventType>(event: T, handler: EventHandler<EventPayloadMap[T]>): UnsubscribeFn
  clear(): void
  clearEvent<T extends EventType>(event: T): void
  getSubscriberCount(event?: EventType): number
  hasSubscribers<T extends EventType>(event: T): boolean
}

export type UnsubscribeFn = () => void

interface SubscriberEntry<T = unknown> {
  handler: EventHandler<T>
  once: boolean
}

class EventBus implements IEventBus {
  private subscribers = new Map<EventType, SubscriberEntry<unknown>[]>()
  private emitHistory: { event: EventType; timestamp: number; payload: unknown }[] = []
  private maxHistorySize = 100

  emit<T extends EventType>(event: T, payload: EventPayloadMap[T]): void {
    const entries = this.subscribers.get(event)
    if (!entries || entries.length === 0) {
      logger.debug('[EventBus] 事件 "' + event + '" 无订阅者')
      return
    }

    this.recordEmit(event, payload)

    const toRemove: number[] = []

    entries.forEach((entry, index) => {
      try {
        (entry.handler as EventHandler<EventPayloadMap[T]>)(payload)
      } catch (error) {
        logger.error(
          '[EventBus] 订阅者执行异常 [事件: ' + event + ', 索引: ' + index + ']:',
          { error, payload },
        )
      }

      if (entry.once) toRemove.push(index)
    })

    if (toRemove.length > 0) {
      for (let i = toRemove.length - 1; i >= 0; i--) {
        entries.splice(toRemove[i], 1)
      }
      if (entries.length === 0) this.subscribers.delete(event)
    }
  }

  subscribe<T extends EventType>(
    event: T,
    handler: EventHandler<EventPayloadMap[T]>,
  ): UnsubscribeFn {
    const entry: SubscriberEntry<unknown> = { handler: handler as EventHandler<unknown>, once: false }
    if (!this.subscribers.has(event)) this.subscribers.set(event, [])
    this.subscribers.get(event)!.push(entry)

    logger.debug('[EventBus] 新订阅 [事件: ' + event + ', 当前总数: ' + this.getSubscriberCount(event) + ']')

    return () => {
      const entries = this.subscribers.get(event)
      if (!entries) return
      const index = entries.indexOf(entry)
      if (index > -1) entries.splice(index, 1)
      if (entries.length === 0) this.subscribers.delete(event)

      logger.debug('[EventBus] 取消订阅 [事件: ' + event + ']')
    }
  }

  once<T extends EventType>(
    event: T,
    handler: EventHandler<EventPayloadMap[T]>,
  ): UnsubscribeFn {
    const entry: SubscriberEntry<unknown> = { handler: handler as EventHandler<unknown>, once: true }
    if (!this.subscribers.has(event)) this.subscribers.set(event, [])
    this.subscribers.get(event)!.push(entry)

    logger.debug('[EventBus] 一次性订阅 [事件: ' + event + ']')

    return () => {
      const entries = this.subscribers.get(event)
      if (!entries) return
      const index = entries.indexOf(entry)
      if (index > -1) entries.splice(index, 1)
      if (entries.length === 0) this.subscribers.delete(event)
    }
  }

  clear(): void {
    const totalBefore = this.getSubscriberCount()
    this.subscribers.clear()
    logger.info(`[EventBus] 清理所有订阅 (共移除 ${totalBefore} 个)`)
  }

  clearEvent<T extends EventType>(event: T): void {
    const count = this.getSubscriberCount(event)
    this.subscribers.delete(event)
    logger.info(`[EventBus] 清理事件 "${event}" 的订阅 (共移除 ${count} 个)`)
  }

  getSubscriberCount(event?: EventType): number {
    if (event) {
      const entries = this.subscribers.get(event)
      return entries ? entries.length : 0
    }

    let count = 0
    this.subscribers.forEach((entries) => { count += entries.length })
    return count
  }

  hasSubscribers<T extends EventType>(event: T): boolean {
    const entries = this.subscribers.get(event)
    return !!entries && entries.length > 0
  }

  private recordEmit<T extends EventType>(event: T, payload: EventPayloadMap[T]): void {
    this.emitHistory.push({
      event,
      timestamp: Date.now(),
      payload,
    })

    if (this.emitHistory.length > this.maxHistorySize) {
      this.emitHistory.shift()
    }
  }

  getEmitHistory(): readonly { event: EventType; timestamp: number; payload: unknown }[] {
    return [...this.emitHistory]
  }
}

export const eventBus: IEventBus = new EventBus()
export default eventBus
