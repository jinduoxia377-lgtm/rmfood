/**
 * EventSourcedSession v2.1 - 完整事件溯源实现
 *
 * 基于 DeepSeek Harness 的 Session 事件溯源架构完整实现：
 * - Append-only Log
 * - Surface Projection (deriveMessages)
 * - IndexedDB 持久化
 * - Fork 机制
 * - Resume 机制
 * - Crash Recovery
 * - Request Header 折叠
 * - CompactionLock 集成
 */

import { logger } from '@/utils/safeLogger';
import {
  canCompact,
} from './compactionLock';
import type {
  SessionEvent,
  SessionEventType,
  AgentMessage,
  TurnStartData,
  TurnEndData,
  StepStartData,
  StepEndData,
  ToolCallData,
  ToolResultData,
  RequestHeader,
} from '@/components/ai/shared/types';

// ── IndexedDB 常量 ─────────────────────────────────────────

const DB_NAME = 'rmfood-agent-session';
const DB_VERSION = 3;
const STORE_NAME = 'events';
const META_STORE_NAME = 'metadata';

// ── Token 估算器 ───────────────────────────────────────────

export class SimpleTokenEstimator {
  // 使用更接近 DeepSeek/ChatGPT tokenizer 的比例：
  // - CJK 字符约 1.5 字符/token（实际约 2-3，取保守值）
  // - ASCII 字符约 3.5 字符/token（实际约 4，更精确）
  private readonly CJK_RATIO = 1.8;
  private readonly ASCII_RATIO = 3.8;
  // 每条消息的固定开销（用于估算 system messages 等）
  private readonly PER_MESSAGE_OVERHEAD = 4;

  estimate(messages: AgentMessage[]): number {
    if (messages.length === 0) return 0;
    return messages.reduce((sum, msg) => sum + this.estimateSingle(msg), 0);
  }

  estimateSingle(message: AgentMessage): number {
    const text = message.content;
    // 空消息按 0 token 处理（无内容即无消耗）
    if (!text || text.length === 0) return 0;

    let chineseCount = 0;
    let asciiCount = 0;
    for (const char of text) {
      if (/[\u4e00-\u9fa5\u3000-\u303F\uFF00-\uFFEF]/.test(char)) {
        chineseCount++;
      } else {
        asciiCount++;
      }
    }
    return Math.ceil(chineseCount / this.CJK_RATIO + asciiCount / this.ASCII_RATIO + this.PER_MESSAGE_OVERHEAD);
  }
}

export const tokenEstimator = new SimpleTokenEstimator();

// ── IndexedDB 封装 ─────────────────────────────────────────

class IndexedDBAdapter {
  async open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // v3：事件存储改为「唯一事件 ID」主键 + seq 索引。
        // 旧版以 seq 为全局主键，React StrictMode 双挂载/多会话并发时会写入相同 seq
        // 导致 ConstraintError: Key already exists。升级时删除旧结构重建。
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('seq', 'seq', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('turnId', 'data.turnId', { unique: false });

        if (!db.objectStoreNames.contains(META_STORE_NAME)) {
          db.createObjectStore(META_STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addEvent(db: IDBDatabase, event: SessionEvent): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      // 唯一事件 ID：同一 seq 在不同会话/挂载中也不会冲突
      const record = {
        ...event,
        id: `${event.seq}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      };
      const request = store.add(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getEvents(db: IDBDatabase, fromSeq?: number, toSeq?: number): Promise<SessionEvent[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('seq');
      let request: IDBRequest;

      if (fromSeq !== undefined) {
        const range = toSeq !== undefined
          ? IDBKeyRange.bound(fromSeq, toSeq)
          : IDBKeyRange.lowerBound(fromSeq);
        request = index.getAll(range);
      } else {
        request = index.getAll();
      }

      request.onsuccess = () => {
        const events = (request.result as SessionEvent[]).sort((a, b) => a.seq - b.seq);
        resolve(events);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getEvent(db: IDBDatabase, seq: number): Promise<SessionEvent | undefined> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('seq');
      const request = index.get(seq);
      request.onsuccess = () => resolve(request.result as SessionEvent | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(db: IDBDatabase): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveMetadata(db: IDBDatabase, key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE_NAME, 'readwrite');
      const store = tx.objectStore(META_STORE_NAME);
      const request = store.put({ key, value, updatedAt: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMetadata(db: IDBDatabase, key: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE_NAME, 'readonly');
      const store = tx.objectStore(META_STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve((request.result as { value: unknown })?.value);
      request.onerror = () => reject(request.error);
    });
  }

  close(db: IDBDatabase): void {
    db.close();
  }
}

// ── Session 类 ─────────────────────────────────────────────

export class EventSourcedSession {
  private db: IDBDatabase | null = null;
  private adapter: IndexedDBAdapter;
  private _seq = 0;
  private events: SessionEvent[] = [];
  private sessionId: string;
  private lastRequestHeader: RequestHeader | null = null;
  private _messageCache: { seq: number; messages: AgentMessage[] } | null = null;

  constructor(sessionId?: string) {
    this.sessionId = sessionId ?? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.adapter = new IndexedDBAdapter();
  }

  /** 获取会话 ID */
  get id(): string {
    return this.sessionId;
  }

  /** 获取当前日志长度 */
  get seq(): number {
    return this._seq;
  }

  /** 打开数据库连接 */
  async open(): Promise<void> {
    this.db = await this.adapter.open();
    await this.loadEvents();
    await this.loadRequestHeader();

    // 检查是否需要崩溃恢复
    await this.checkCrashRecovery();

    logger.info(`[EventSourcedSession] Opened session ${this.sessionId} with ${this.events.length} events`);
  }

  /** 加载已有事件 */
  private async loadEvents(): Promise<void> {
    this.events = await this.adapter.getEvents(this.db!);
    // 使用最大 seq + 1 作为下一个序号，避免与既有事件键冲突
    this._seq = this.events.length > 0 ? Math.max(...this.events.map((e) => e.seq)) + 1 : 0;
  }

  /** 加载 Request Header */
  private async loadRequestHeader(): Promise<void> {
    const saved = await this.adapter.getMetadata(this.db!, 'lastRequestHeader');
    if (saved) {
      this.lastRequestHeader = saved as RequestHeader;
    }
  }

  /** 崩溃恢复检查 */
  private async checkCrashRecovery(): Promise<void> {
    const openTurns = new Set<string>();
    const unmatchedCalls = new Set<string>();

    for (const event of this.events) {
      if (event.type === 'turn/start') {
        openTurns.add((event.data as TurnStartData).turnId);
      } else if (event.type === 'turn/end') {
        openTurns.delete((event.data as TurnEndData).turnId);
      } else if (event.type === 'tool/call') {
        unmatchedCalls.add((event.data as ToolCallData).callId);
      } else if (event.type === 'tool/result') {
        unmatchedCalls.delete((event.data as ToolResultData).callId);
      }
    }

    if (openTurns.size > 0 || unmatchedCalls.size > 0) {
      logger.warn(`[EventSourcedSession] Found ${openTurns.size} open turns and ${unmatchedCalls.size} unmatched tool calls, repairing...`);
      await this.repairCrashedLog(openTurns, unmatchedCalls);
    }
  }

  /** 追加事件 */
  async append(type: SessionEventType, data: unknown): Promise<number> {
    if (!this.db) {
      throw new Error('Session not opened. Call open() first.');
    }

    const event: SessionEvent = {
      seq: this._seq,
      type,
      data,
      timestamp: Date.now(),
    };

    await this.adapter.addEvent(this.db, event);
    this.events.push(event);
    this._seq++;

    return event.seq;
  }

  /**
   * 替换事件范围 (Compaction 使用)
   */
  async replaceEvents(startSeq: number, endSeq: number, replacement: SessionEvent[]): Promise<void> {
    if (!this.db) throw new Error('Session not opened');

    // 移除旧事件
    this.events = this.events.filter(e => e.seq < startSeq || e.seq >= endSeq);

    // 添加新事件
    const baseSeq = this.events.length > 0 ? Math.max(...this.events.map(e => e.seq)) + 1 : 0;
    replacement.forEach((event, i) => {
      event.seq = baseSeq + i;
      this.events.push(event);
    });

    this._seq = this.events.length > 0 ? Math.max(...this.events.map(e => e.seq)) + 1 : 0;

    // 写回数据库
    await this.adapter.clear(this.db);
    for (const event of this.events) {
      await this.adapter.addEvent(this.db, event);
    }
  }

  /** 获取所有事件 */
  getEvents(): SessionEvent[] {
    return this.events;
  }

  /** 按序号获取事件 */
  eventAt(seq: number): SessionEvent | undefined {
    return this.events.find((e) => e.seq === seq);
  }

  /** 获取事件快照 */
  snapshotEvents(fromSeq?: number, toSeqExclusive?: number): SessionEvent[] {
    if (fromSeq === undefined && toSeqExclusive === undefined) {
      return this.events;
    }
    return this.events.filter(e => {
      if (fromSeq !== undefined && e.seq < fromSeq) return false;
      if (toSeqExclusive !== undefined && e.seq >= toSeqExclusive) return false;
      return true;
    });
  }

  /**
   * 从日志派生模型可见的消息历史
   * 对应 DeepSeek Harness 的 deriveMessages()
   * 使用缓存优化性能
   */
  deriveMessages(invalidateFrom?: number): AgentMessage[] {
    // 如果有 invalidation，清除缓存
    if (invalidateFrom !== undefined && this._messageCache?.seq !== invalidateFrom) {
      this._messageCache = null;
    }

    // 返回缓存
    if (this._messageCache && this._messageCache.seq === this._seq) {
      return this._messageCache.messages;
    }

    const messages: AgentMessage[] = [];

    for (const event of this.events) {
      switch (event.type) {
        case 'user/message': {
          const data = event.data as { content: string; id?: string };
          messages.push({
            id: data.id ?? `msg-${event.seq}`,
            role: 'user',
            content: data.content,
            timestamp: new Date(event.timestamp),
          });
          break;
        }
        case 'assistant/message': {
          const data = event.data as { content: string; id?: string; metadata?: Record<string, unknown> };
          messages.push({
            id: data.id ?? `msg-${event.seq}`,
            role: 'assistant',
            content: data.content,
            timestamp: new Date(event.timestamp),
            metadata: data.metadata,
          });
          break;
        }
      }
    }

    // 缓存结果
    this._messageCache = { seq: this._seq, messages };
    return messages;
  }

  /** 获取最后保存的 Request Header */
  getLastRequestHeader(): RequestHeader | null {
    return this.lastRequestHeader;
  }

  /** 保存 Request Header 快照 */
  async saveRequestHeaderSnapshot(header: RequestHeader): Promise<void> {
    this.lastRequestHeader = header;
    await this.adapter.saveMetadata(this.db!, 'lastRequestHeader', header);
    await this.append('request/header' as SessionEventType, {
      reason: 'change' as const,
      ...header,
    } as unknown);
  }

  /**
   * Fork 创建子会话
   * 对应 DeepSeek Harness 的 fork()
   */
  async fork(boundary?: number): Promise<EventSourcedSession> {
    const boundarySeq = boundary ?? this.seq;

    if (boundarySeq > this.seq) {
      throw new Error(`Fork boundary ${boundarySeq} exceeds current seq ${this.seq}`);
    }

    const child = new EventSourcedSession(`${this.sessionId}-fork-${Date.now()}`);
    await child.open();

    for (let i = 0; i <= boundarySeq && i < this.events.length; i++) {
      await child.append(this.events[i].type, this.events[i].data);
    }

    logger.info(`[EventSourcedSession] Forked session at boundary ${boundarySeq}, child: ${child.sessionId}`);
    return child;
  }

  /**
   * Resume 从现有会话恢复
   */
  static async resume(sessionId: string): Promise<EventSourcedSession> {
    const session = new EventSourcedSession(sessionId);
    await session.open();
    logger.info(`[EventSourcedSession] Resumed session: ${sessionId}`);
    return session;
  }

  /** 清空事件日志 */
  async clear(): Promise<void> {
    if (this.db) {
      await this.adapter.clear(this.db);
      this.events = [];
      this._seq = 0;
      this.lastRequestHeader = null;
    }
  }

  /** 关闭数据库连接 */
  async close(): Promise<void> {
    if (this.db) {
      this.adapter.close(this.db);
      this.db = null;
    }
  }

  /** 估算当前 token 使用量 */
  estimateTokenCount(): number {
    const messages = this.deriveMessages();
    return tokenEstimator.estimate(messages);
  }

  /** 使消息缓存失效 (compaction 后调用) */
  invalidateMessageCache(): void {
    this._messageCache = null;
  }

  /**
   * 崩溃恢复
   */
  private async repairCrashedLog(openTurns: Set<string>, unmatchedCalls: Set<string>): Promise<void> {
    if (!this.db) return;

    // 修复未闭合的 turn
    for (const turnId of openTurns) {
      this.events.push({
        seq: this._seq++,
        type: 'turn/end' as SessionEventType,
        data: { turnId, durationMs: 0, reason: 'aborted' as const },
        timestamp: Date.now(),
      });
      logger.warn(`[EventSourcedSession] Repaired open turn: ${turnId}`);
    }

    // 修复未配对的 tool/call
    for (const callId of unmatchedCalls) {
      this.events.push({
        seq: this._seq++,
        type: 'tool/result' as SessionEventType,
        data: { callId, result: null, error: 'TOOL_NOT_STARTED', latencyMs: 0 },
        timestamp: Date.now(),
      });
      logger.warn(`[EventSourcedSession] Repaired unmatched tool call: ${callId}`);
    }

    // 写回数据库
    await this.adapter.clear(this.db);
    for (const event of this.events) {
      await this.adapter.addEvent(this.db, event);
    }

    logger.info(`[EventSourcedSession] Crash recovery completed`);
  }
}

// ── Compaction 决策 ────────────────────────────────────────

export type CompactionTrigger = 'context-overflow' | 'pressure';

export interface CompactionDecision {
  trigger: CompactionTrigger | null;
  canCompact: boolean;
  tokenCount: number;
  messageCount: number;
}

export function checkCompactionTrigger(
  session: EventSourcedSession,
  maxTokens: number = 128000,
): CompactionDecision {
  const tokenCount = session.estimateTokenCount();
  const messages = session.deriveMessages();
  const messageCount = messages.length;
  const ratio = tokenCount / maxTokens;

  let trigger: CompactionTrigger | null = null;

  if (ratio >= 0.95) {
    trigger = 'context-overflow';
  } else if (ratio >= 0.8 && messageCount >= 100) {
    trigger = 'pressure';
  }

  return {
    trigger,
    canCompact: trigger !== null && canCompact(),
    tokenCount,
    messageCount,
  };
}

// ── 事件辅助函数 ───────────────────────────────────────────

export function createTurnStartEvent(turnId: string, input: string, workflowType: string): TurnStartData {
  return { turnId, input, workflowType };
}

export function createTurnEndEvent(turnId: string, durationMs: number, reason: 'completed' | 'cancelled' | 'timeout'): TurnEndData {
  return { turnId, durationMs, reason };
}

export function createStepStartEvent(stepId: string, type: StepStartData['type'], toolName?: string): StepStartData {
  return { stepId, type, toolName };
}

export function createStepEndEvent(stepId: string, type: StepEndData['type'], latencyMs: number, success: boolean, error?: string): StepEndData {
  return { stepId, type, latencyMs, success, error };
}

export function createToolCallEvent(callId: string, tool: string, args: Record<string, unknown>, isConcurrencySafe: boolean): ToolCallData {
  return { callId, tool, args, isConcurrencySafe };
}

export function createToolResultEvent(callId: string, result: unknown, error?: string, latencyMs?: number): ToolResultData {
  return { callId, result, error, latencyMs: latencyMs ?? 0 };
}
