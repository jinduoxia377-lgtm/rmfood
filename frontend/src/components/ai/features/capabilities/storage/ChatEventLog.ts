/**
 * ChatEventLog — 事件溯源日志层
 *
 * 参照 DeepSeek Harness Session 的 append-only log 设计：
 * - 所有状态变更以事件形式追加，不覆盖历史
 * - UI 消息通过 deriveMessages() 从日志派生
 * - 支持 replace 操作（用于编辑/撤回）
 * - 支持精确的时序恢复
 *
 * @version 1.0.0
 */

import type { ChatMessage } from '../../types'
import { logger } from '@/utils/safeLogger'

/** 事件类型 */
export type SessionEventType =
  | 'user/message'        // 用户发送消息
  | 'assistant/message'   // AI 回复完成
  | 'assistant/chunk'     // 流式增量（中间状态）
  | 'error/message'       // 错误消息
  | 'system/alert'        // 系统提示

/** 表面投影操作类型 */
export type SurfaceOp = 'append' | 'replace'

/** 单个会话事件 */
export interface SessionEvent {
  /** 单调递增序列号 */
  seq: number
  /** 事件类型 */
  type: SessionEventType
  /** 事件数据 */
  data: unknown
  /** 时间戳 */
  timestamp: number
  /** 表面投影操作（用于 replace 语义） */
  surfaceOp?: SurfaceOp
}

export class ChatEventLog {
  private events: SessionEvent[] = []
  private seq = 0
  private listeners: Array<(events: SessionEvent[]) => void> = []

  /**
   * 追加事件（核心操作，参照 DSH Session.append）
   */
  append(type: SessionEventType, data: unknown): number {
    const event: SessionEvent = {
      seq: this.seq++,
      type,
      data,
      timestamp: Date.now(),
      surfaceOp: 'append',
    }
    this.events.push(event)
    this.notifyListeners()
    return event.seq
  }

  /**
   * 替换事件范围（用于编辑/撤回，参照 DSH surface projection replace）
   */
  replaceRange(startSeq: number, endSeq: number, newEvents: SessionEvent[]): void {
    const startIdx = this.events.findIndex(e => e.seq === startSeq)
    if (startIdx === -1) {
      logger.warn('[ChatEventLog] replaceRange: startSeq not found', { startSeq })
      return
    }
    const endIdx = endSeq === -1
      ? this.events.length
      : this.events.findIndex(e => e.seq === endSeq)
    const spliceEnd = endIdx === -1 ? startIdx + 1 : endIdx + 1

    if (spliceEnd <= startIdx) {
      logger.warn('[ChatEventLog] replaceRange: invalid range', { startSeq, endSeq })
      return
    }

    this.events.splice(startIdx, spliceEnd - startIdx, ...newEvents)
    this.notifyListeners()
  }

  /**
   * 从日志派生出 UI 消息列表（参照 DSH deriveMessages）
   */
  deriveMessages(): ChatMessage[] {
    return this.events
      .filter(e =>
        ['user/message', 'assistant/message', 'error/message'].includes(e.type)
      )
      .map(e => this.eventToMessage(e))
  }

  /**
   * 获取指定范围内的原始事件（用于精确恢复/重放）
   */
  getEventsInRange(fromSeq: number, toSeq?: number): SessionEvent[] {
    if (toSeq === undefined) {
      return this.events.filter(e => e.seq >= fromSeq)
    }
    return this.events.filter(e => e.seq >= fromSeq && e.seq <= toSeq)
  }

  /**
   * 获取最后一条事件
   */
  getLastEvent(): SessionEvent | null {
    return this.events[this.events.length - 1] || null
  }

  /**
   * 获取日志长度
   */
  get length(): number {
    return this.events.length
  }

  /**
   * 获取当前序列号
   */
  get currentSeq(): number {
    return this.seq
  }

  /**
   * 清空日志
   */
  clear(): void {
    this.events = []
    this.seq = 0
    this.notifyListeners()
  }

  /**
   * 注册事件变更监听器
   */
  onChange(listener: (events: SessionEvent[]) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  /**
   * 将事件转换为 ChatMessage
   */
  private eventToMessage(event: SessionEvent): ChatMessage {
    const data = event.data as ChatMessage & { _eventSeq?: number }
    return {
      ...data,
      id: data.id,
      role: data.role as 'user' | 'assistant',
      content: data.content,
      timestamp: data.timestamp || event.timestamp,
    }
  }

  private notifyListeners(): void {
    const snapshot = [...this.events]
    this.listeners.forEach(listener => {
      try {
        listener(snapshot)
      } catch (err) {
        logger.error('[ChatEventLog] Listener error:', err)
      }
    })
  }
}

// 单例导出
export const chatEventLog = new ChatEventLog()
export default ChatEventLog
