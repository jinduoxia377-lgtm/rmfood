/**
 * EventBusV2 — 可拦截的水落式事件总线
 *
 * 参照 DeepSeek Harness Waterfall Events 设计：
 * - pipe() 注册拦截管道（handler → next()）
 * - emit() 执行所有拦截器后分发
 * - 保持与旧版 eventBus 的向后兼容
 *
 * @version 2.0.0
 */

import { logger } from '@/utils/safeLogger'
import type { EventType, EventPayloadMap, EventHandler, UnsubscribeFn } from './eventBus'

export type PipeHandler<T> = (payload: T, next: () => Promise<void>) => Promise<void> | void

export class EventBusV2<TEvents extends Record<string, any>> {
  private subscribers = new Map<keyof TEvents, EventHandler<any>[]>
  private pipes = new Map<keyof TEvents, PipeHandler<any>[]>
  private emitHistory: Array<{ event: string; timestamp: number; payload: unknown }> = []
  private readonly MAX_HISTORY_SIZE = 100

  /**
   * 发射事件（执行所有拦截管道后，再分发到订阅者）
   */
  async emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): Promise<void> {
    // 1. 执行所有 pipe 拦截器
    const handlers = this.pipes.get(event)
    if (handlers && handlers.length > 0) {
      let index = 0
      const executeNext = async (): Promise<void> => {
        if (index >= handlers.length) return
        const handler = handlers[index++]
        await handler(payload as Record<string, unknown>, executeNext)
      }
      await executeNext()
    }

    // 2. 执行原有 subscribe 逻辑（向后兼容）
    this.simpleEmit(event as string, payload)

    // 3. 记录历史
    this.recordEmit(event as string, payload)
  }

  /**
   * 注册拦截管道（水落式拦截）
   * @param event 事件名
   * @param handlers 拦截处理器（按注册顺序执行）
   */
  pipe<K extends keyof TEvents>(event: K, ...handlers: PipeHandler<TEvents[K]>[]): void {
    const key = event as string
    if (!this.pipes.has(key)) {
      this.pipes.set(key, [])
    }
    this.pipes.get(key)!.push(...handlers as PipeHandler<any>[])
    logger.debug(`[EventBusV2] pipe 注册: ${key} (${handlers.length} 个处理器)`)
  }

  /**
   * 订阅事件（向后兼容）
   */
  subscribe<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): UnsubscribeFn {
    const key = event as string
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, [])
    }
    this.subscribers.get(key)!.push(handler as EventHandler<any>)

    logger.debug(`[EventBusV2] subscribe: ${key}`)
    return () => this.unsubscribe(key, handler)
  }

  /**
   * 一次性订阅
   */
  once<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): UnsubscribeFn {
    const key = event as string
    const wrapper: EventHandler<TEvents[K]> = (payload) => {
      handler(payload)
      this.unsubscribe(key, wrapper)
    }
    return this.subscribe(event, wrapper)
  }

  /**
   * 清除所有订阅和管道
   */
  clear(): void {
    const totalSubs = this.getTotalSubscriberCount()
    this.subscribers.clear()
    this.pipes.clear()
    this.emitHistory = []
    logger.info(`[EventBusV2] 清理所有订阅和管道 (共移除 ${totalSubs} 个订阅者)`)
  }

  /**
   * 清除指定事件的订阅
   */
  clearEvent<K extends keyof TEvents>(event: K): void {
    const key = event as string
    const count = this.subscribers.get(key)?.length ?? 0
    this.subscribers.delete(key)
    this.pipes.delete(key)
    logger.info(`[EventBusV2] 清理事件 "${key}" 的订阅 (共移除 ${count} 个)`)
  }

  /**
   * 获取订阅者数量
   */
  getSubscriberCount(event?: keyof TEvents): number {
    if (event) {
      return this.subscribers.get(event as string)?.length ?? 0
    }
    let count = 0
    this.subscribers.forEach(entries => { count += entries.length })
    return count
  }

  /**
   * 检查是否有订阅者
   */
  hasSubscribers<K extends keyof TEvents>(event: K): boolean {
    return !!this.subscribers.get(event as string)?.length
  }

  /**
   * 获取事件历史
   */
  getEmitHistory(): Array<{ event: string; timestamp: number; payload: unknown }> {
    return [...this.emitHistory]
  }

  // ===== 私有方法 =====

  private simpleEmit(event: string, payload: unknown): void {
    const entries = this.subscribers.get(event)
    if (!entries || entries.length === 0) {
      logger.debug(`[EventBusV2] 事件 "${event}" 无订阅者`)
      return
    }

    entries.forEach((handler, index) => {
      try {
        handler(payload)
      } catch (error) {
        logger.error(`[EventBusV2] 订阅者执行异常 [事件: ${event}, 索引: ${index}]:`, error)
      }
    })
  }

  private unsubscribe(event: string, handler: EventHandler<any>): void {
    const entries = this.subscribers.get(event)
    if (!entries) return
    const index = entries.indexOf(handler)
    if (index > -1) entries.splice(index, 1)
    if (entries.length === 0) this.subscribers.delete(event)
  }

  private getTotalSubscriberCount(): number {
    let count = 0
    this.subscribers.forEach(entries => { count += entries.length })
    return count
  }

  private recordEmit(event: string, payload: unknown): void {
    this.emitHistory.push({ event, timestamp: Date.now(), payload })
    if (this.emitHistory.length > this.MAX_HISTORY_SIZE) {
      this.emitHistory.shift()
    }
  }
}

// 类型化的全局实例
export const eventBusV2 = new EventBusV2<EventPayloadMap>()

// 导出旧的 eventBus 作为兼容层（基于新实现）
export const eventBus = {
  emit: <K extends keyof EventPayloadMap>(event: K, payload: EventPayloadMap[K]) =>
    eventBusV2.emit(event, payload),
  subscribe: <K extends keyof EventPayloadMap>(
    event: K,
    handler: EventHandler<EventPayloadMap[K]>
  ) => eventBusV2.subscribe(event, handler),
  once: <K extends keyof EventPayloadMap>(
    event: K,
    handler: EventHandler<EventPayloadMap[K]>
  ) => eventBusV2.once(event, handler),
  clear: () => eventBusV2.clear(),
  clearEvent: <K extends keyof EventPayloadMap>(event: K) => eventBusV2.clearEvent(event),
  getSubscriberCount: (event?: keyof EventPayloadMap) =>
    eventBusV2.getSubscriberCount(event),
  hasSubscribers: <K extends keyof EventPayloadMap>(event: K) =>
    eventBusV2.hasSubscribers(event),
} as const

export default eventBusV2
