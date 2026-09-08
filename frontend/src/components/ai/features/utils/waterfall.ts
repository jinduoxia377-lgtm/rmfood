/**
 * Waterfall 事件系统 v2.1
 *
 * 基于 DeepSeek Harness 的 waterfall 事件模型完整实现：
 * - 强制 next() 调用机制
 * - 完整的 6 个 Waterfall 事件类型
 * - 1 个 Serial 事件类型 (agent/turn-stopping)
 * - 事件数据强类型
 * - 监听器统计和调试信息
 */

import { logger } from '@/utils/safeLogger';
import type {
  WaterfallEvent,
  WaterfallEventData,
  SerialEvent,
  SerialEventData,
} from '@/components/ai/shared/types';

// ── 监听器类型 ─────────────────────────────────────────────

export type WaterfallHandler = (data: any, next: () => void) => void;
export type SerialHandler = (data: any) => void;

// ── WaterfallEmitter 类 ────────────────────────────────────

export class WaterfallEmitter {
  private waterfallListeners: Map<WaterfallEvent, WaterfallHandler[]> = new Map();
  private serialListeners: Map<SerialEvent, SerialHandler[]> = new Map();
  private enabled = true;
  private listenersCount = 0;

  /** 注册 Waterfall 监听器 (必须调用 next()) */
  on(event: WaterfallEvent, handler: WaterfallHandler): () => void {
    if (!this.enabled) {
      logger.warn('[Waterfall] Emitter disabled, listener not registered');
      return () => {};
    }

    const list = this.waterfallListeners.get(event) ?? [];
    list.push(handler);
    this.waterfallListeners.set(event, list);
    this.listenersCount++;

    return () => {
      const current = this.waterfallListeners.get(event) ?? [];
      this.waterfallListeners.set(
        event,
        current.filter((h) => h !== handler),
      );
      this.listenersCount--;
    };
  }

  /** 注册一次性 Waterfall 监听器 */
  once(event: WaterfallEvent, handler: WaterfallHandler): () => void {
    const wrapper = (data: any, next: () => void) => {
      handler(data, next);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper as any);
  }

  /** 移除 Waterfall 监听器 */
  off(event: WaterfallEvent, handler: WaterfallHandler): void {
    const list = this.waterfallListeners.get(event) ?? [];
    this.waterfallListeners.set(
      event,
      list.filter((h) => h !== handler),
    );
    this.listenersCount--;
  }

  /** 注册 Serial 监听器 (无需调用 next) */
  onSerial(event: SerialEvent, handler: SerialHandler): () => void {
    if (!this.enabled) return () => {};

    const list = this.serialListeners.get(event) ?? [];
    list.push(handler);
    this.serialListeners.set(event, list);
    this.listenersCount++;

    return () => {
      const current = this.serialListeners.get(event) ?? [];
      this.serialListeners.set(
        event,
        list.filter((h) => h !== handler),
      );
      this.listenersCount--;
    };
  }

  /**
   * 触发 Waterfall 事件
   * 所有监听器必须调用 next() 才能继续委托
   * 如果监听器没有调用 next()，会自动继续 (带警告)
   */
  async emit<T extends WaterfallEvent>(
    event: T,
    data: any,
  ): Promise<any> {
    if (!this.enabled) return data;

    const list = this.waterfallListeners.get(event) ?? [];
    if (list.length === 0) return data;

    let currentData = data;

    for (const handler of list) {
      let nextCalled = false;

      await new Promise<void>((resolve) => {
        const next = () => {
          nextCalled = true;
          resolve();
        };

        try {
          handler(currentData, next);
        } catch (err) {
          logger.error(`[Waterfall] Listener error on ${event}:`, err);
          next(); // 出错时也继续
        }

        // 如果 handler 没有调用 next()，等待一小段时间后自动继续
        if (!nextCalled) {
          setTimeout(() => {
            if (!nextCalled) {
              logger.warn(`[Waterfall] Listener did not call next() for ${event}, auto-continuing`);
              resolve();
            }
          }, 100);
        }
      });
    }

    return currentData;
  }

  /**
   * 触发 Serial 事件
   */
  async emitSerial<T extends SerialEvent>(
    event: T,
    data: SerialEventData[T],
  ): Promise<void> {
    if (!this.enabled) return;

    const list = this.serialListeners.get(event) ?? [];
    for (const handler of list) {
      try {
        handler(data);
      } catch (err) {
        logger.error(`[Waterfall] Serial listener error on ${event}:`, err);
      }
    }
  }

  /** 禁用/启用事件系统 */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      logger.info('[Waterfall] Emitter disabled');
    }
  }

  /** 获取监听器统计 */
  get stats() {
    let count = 0;
    this.waterfallListeners.forEach((listeners) => (count += listeners.length));
    this.serialListeners.forEach((listeners) => (count += listeners.length));
    return {
      waterfallEvents: this.waterfallListeners.size,
      serialEvents: this.serialListeners.size,
      totalListeners: count,
      enabled: this.enabled,
    };
  }

  /** 清除所有监听器 */
  clear(): void {
    this.waterfallListeners.clear();
    this.serialListeners.clear();
    this.listenersCount = 0;
    logger.info('[Waterfall] All listeners cleared');
  }
}

// ── 全局单例 ───────────────────────────────────────────────

let _emitter: WaterfallEmitter | null = null;

export function getWaterfallEmitter(): WaterfallEmitter {
  if (!_emitter) {
    _emitter = new WaterfallEmitter();
    logger.info('[Waterfall] Global emitter initialized');
  }
  return _emitter;
}

/** 重置全局 emitter (用于测试) */
export function resetWaterfallEmitter(): void {
  _emitter = null;
}

// ── 事件工厂函数 ───────────────────────────────────────────

export const waterfallEvents = {
  /** agent/pre-step: 决定是否进入 step */
  preStep: (input: string, turnId: string) => ({
    event: 'agent/pre-step' as WaterfallEvent,
    data: { input, turnId } as WaterfallEventData['agent/pre-step'],
  }),

  /** agent/request: 模型请求前预处理 */
  request: (turnId: string, model: string) => ({
    event: 'agent/request' as WaterfallEvent,
    data: { turnId, model } as WaterfallEventData['agent/request'],
  }),

  /** llm/stream: 流式响应 */
  stream: (turnId: string, chunk: string) => ({
    event: 'llm/stream' as WaterfallEvent,
    data: { turnId, chunk } as WaterfallEventData['llm/stream'],
  }),

  /** tools/pre-execute: 工具执行前 */
  preExecute: (toolCalls: any[]) => ({
    event: 'tools/pre-execute' as WaterfallEvent,
    data: { toolCalls } as WaterfallEventData['tools/pre-execute'],
  }),

  /** tools/execute: 工具执行中 */
  execute: (toolCalls: any[]) => ({
    event: 'tools/execute' as WaterfallEvent,
    data: { toolCalls } as WaterfallEventData['tools/execute'],
  }),

  /** tools/post-execute: 工具执行后 */
  postExecute: (results: any[]) => ({
    event: 'tools/post-execute' as WaterfallEvent,
    data: { results } as WaterfallEventData['tools/post-execute'],
  }),

  /** agent/turn-stopping: 最终拦截点 (Serial) */
  turnStopping: (turnId: string, reason: 'completed' | 'cancelled' | 'timeout') => ({
    event: 'agent/turn-stopping' as SerialEvent,
    data: { turnId, reason } as SerialEventData['agent/turn-stopping'],
  }),
};
