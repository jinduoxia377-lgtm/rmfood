/**
 * Session Manager - 多会话管理
 *
 * 基于 DeepSeek Harness 的多会话架构：
 * - 会话创建/切换/删除
 * - 会话持久化
 * - 会话统计
 */

import { logger } from '@/utils/safeLogger';
import { EventSourcedSession } from './eventSourcing';
import type { AgentMessage } from '@/components/ai/shared/types';

export interface SessionInfo {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  tokenCount: number;
}

export class SessionManager {
  private sessions: Map<string, EventSourcedSession> = new Map();
  private currentSessionId: string | null = null;
  private metaStore: Map<string, { name: string; updatedAt: number }> = new Map();

  /**
   * 创建新会话
   */
  async createSession(name?: string): Promise<string> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const session = new EventSourcedSession(sessionId);
    await session.open();

    this.sessions.set(sessionId, session);
    this.metaStore.set(sessionId, {
      name: name ?? `会话 ${this.sessions.size}`,
      updatedAt: Date.now(),
    });

    this.currentSessionId = sessionId;
    logger.info(`[SessionManager] Created session: ${sessionId}`);

    return sessionId;
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): EventSourcedSession | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) ?? null;
  }

  /**
   * 切换到指定会话
   */
  async switchSession(sessionId: string): Promise<boolean> {
    if (!this.sessions.has(sessionId)) {
      logger.error(`[SessionManager] Session not found: ${sessionId}`);
      return false;
    }

    this.currentSessionId = sessionId;
    logger.info(`[SessionManager] Switched to session: ${sessionId}`);
    return true;
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.error(`[SessionManager] Session not found: ${sessionId}`);
      return false;
    }

    await session.close();
    this.sessions.delete(sessionId);
    this.metaStore.delete(sessionId);

    // 如果删除的是当前会话，切换到另一个
    if (this.currentSessionId === sessionId) {
      const remaining = Array.from(this.sessions.keys());
      this.currentSessionId = remaining[0] ?? null;
    }

    logger.info(`[SessionManager] Deleted session: ${sessionId}`);
    return true;
  }

  /**
   * 获取会话列表
   */
  getSessionList(): SessionInfo[] {
    return Array.from(this.sessions.entries()).map(([id, session]) => {
      const meta = this.metaStore.get(id);
      const messages = session.deriveMessages();
      const { tokenEstimator } = require('./tokenEstimator');

      return {
        id,
        name: meta?.name ?? '未命名会话',
        createdAt: session['lastRequestHeader']?.timestamp ?? Date.now(),
        updatedAt: meta?.updatedAt ?? Date.now(),
        messageCount: messages.length,
        tokenCount: tokenEstimator.estimate(messages),
      };
    });
  }

  /**
   * 重命名会话
   */
  renameSession(sessionId: string, name: string): boolean {
    const meta = this.metaStore.get(sessionId);
    if (!meta) return false;

    meta.name = name;
    meta.updatedAt = Date.now();
    this.metaStore.set(sessionId, meta);
    return true;
  }

  /**
   * 获取会话统计
   */
  getStats(): { totalSessions: number; totalMessages: number; totalTokens: number } {
    let totalMessages = 0;
    let totalTokens = 0;
    const { tokenEstimator } = require('./tokenEstimator');

    for (const session of this.sessions.values()) {
      const messages = session.deriveMessages();
      totalMessages += messages.length;
      totalTokens += tokenEstimator.estimate(messages);
    }

    return {
      totalSessions: this.sessions.size,
      totalMessages,
      totalTokens,
    };
  }
}

// 全局单例
let _manager: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!_manager) {
    _manager = new SessionManager();
  }
  return _manager;
}