/**
 * Goal System - 持久化完成目标
 *
 * 基于 DeepSeek Harness 的 Goal 系统：
 * - 附加到现有会话的持久化目标
 * - 状态机管理 (active → paused → blocked → complete)
 * - 续期追踪
 */

import { logger } from '@/utils/safeLogger';
import type { SessionId } from '@/components/ai/shared/types';

// ── 类型定义 ────────────────────────────────────────────────

export type GoalPhase = 'active' | 'paused' | 'blocked' | 'complete';

export interface Goal {
  id: string;
  sessionId: SessionId;
  phase: GoalPhase;
  revision: number;
  description: string;
  objective: string;
  createdAt: number;
  updatedAt: number;
  continuationRounds: number;
  maxGoalRounds?: number;
  blockedReason?: string;
}

export interface GoalStats {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  blockedGoals: number;
}

// ── Goal 管理器 ─────────────────────────────────────────────

export class GoalManager {
  private goals = new Map<string, Goal>();
  private nextId = 1;

  /**
   * 创建新目标
   */
  create(options: {
    sessionId: SessionId;
    objective: string;
    maxGoalRounds?: number;
  }): Goal {
    const goal: Goal = {
      id: `goal-${this.nextId++}`,
      sessionId: options.sessionId,
      phase: 'active',
      revision: 1,
      description: options.objective,
      objective: options.objective,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      continuationRounds: 0,
      maxGoalRounds: options.maxGoalRounds,
    };

    this.goals.set(goal.id, goal);
    logger.info(`[GoalSystem] Created goal: ${goal.id} for session ${options.sessionId}`);
    return goal;
  }

  /**
   * 获取目标
   */
  get(id: string): Goal | undefined {
    return this.goals.get(id);
  }

  /**
   * 获取会话的所有目标
   */
  getBySession(sessionId: SessionId): Goal[] {
    return Array.from(this.goals.values())
      .filter(g => g.sessionId === sessionId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 暂停目标
   */
  pause(id: string): boolean {
    const goal = this.goals.get(id);
    if (!goal || goal.phase !== 'active') return false;

    goal.phase = 'paused';
    goal.updatedAt = Date.now();
    goal.revision++;
    logger.info(`[GoalSystem] Paused goal: ${id}`);
    return true;
  }

  /**
   * 恢复目标
   */
  resume(id: string): boolean {
    const goal = this.goals.get(id);
    if (!goal || goal.phase !== 'paused') return false;

    goal.phase = 'active';
    goal.updatedAt = Date.now();
    goal.revision++;
    logger.info(`[GoalSystem] Resumed goal: ${id}`);
    return true;
  }

  /**
   * 标记为阻塞
   */
  block(id: string, reason: string): boolean {
    const goal = this.goals.get(id);
    if (!goal) return false;

    goal.phase = 'blocked';
    goal.blockedReason = reason;
    goal.updatedAt = Date.now();
    goal.revision++;
    logger.warn(`[GoalSystem] Blocked goal: ${id} - ${reason}`);
    return true;
  }

  /**
   * 完成目标
   */
  complete(id: string): boolean {
    const goal = this.goals.get(id);
    if (!goal || goal.phase === 'complete') return false;

    goal.phase = 'complete';
    goal.updatedAt = Date.now();
    goal.revision++;
    logger.info(`[GoalSystem] Completed goal: ${id}`);
    return true;
  }

  /**
   * 更新目标描述
   */
  updateDescription(id: string, description: string): boolean {
    const goal = this.goals.get(id);
    if (!goal) return false;

    goal.description = description;
    goal.updatedAt = Date.now();
    goal.revision++;
    return true;
  }

  /**
   * 增加续期轮次
   */
  incrementContinuation(id: string): boolean {
    const goal = this.goals.get(id);
    if (!goal) return false;

    goal.continuationRounds++;
    goal.updatedAt = Date.now();
    goal.revision++;
    return true;
  }

  /**
   * 删除目标
   */
  delete(id: string): boolean {
    return this.goals.delete(id);
  }

  /**
   * 获取统计信息
   */
  getStats(): GoalStats {
    const all = Array.from(this.goals.values());
    return {
      totalGoals: all.length,
      activeGoals: all.filter(g => g.phase === 'active').length,
      completedGoals: all.filter(g => g.phase === 'complete').length,
      blockedGoals: all.filter(g => g.phase === 'blocked').length,
    };
  }

  /**
   * 获取所有目标
   */
  getAll(): Goal[] {
    return Array.from(this.goals.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 检查是否达到最大轮次
   */
  isBudgetExceeded(goal: Goal): boolean {
    if (!goal.maxGoalRounds) return false;
    return goal.continuationRounds >= goal.maxGoalRounds;
  }
}

// 全局单例
let _manager: GoalManager | null = null;

export function getGoalManager(): GoalManager {
  if (!_manager) {
    _manager = new GoalManager();
  }
  return _manager;
}