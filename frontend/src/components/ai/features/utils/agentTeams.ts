/**
 * Agent Teams - 多智能体协作框架
 *
 * 基于 DeepSeek Harness 的 Agent Teams 实验性功能：
 * - Lead Agent 创建 Task DAG
 * - Teammate Agents 执行任务
 * - Durable Mailbox 投递语义
 * - 重放算法构建状态
 */

import { logger } from '@/utils/safeLogger';
import type { SessionId, ContentBlock } from '@/components/ai/shared/types';

// ── 类型定义 ────────────────────────────────────────────────

export type TeamTaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted';
export type TeamMemberPhase = 'provisioning' | 'active' | 'failed';
export type TeamMessageContext = 'fresh' | 'fork';

export interface TeamMemberSnapshot {
  id: SessionId;
  name: string;
  description: string;
  provider: string;
  context: TeamMessageContext;
  phase: TeamMemberPhase;
}

export interface TeamTaskSnapshot {
  id: string;
  revision: number;
  subject: string;
  description: string;
  status: TeamTaskStatus;
  ownerId?: SessionId;
  blockedBy: string[];
  writeScopes: string[];
}

export interface TeamMessageSnapshot {
  id: string;
  senderId: SessionId;
  senderName: string;
  targetId: SessionId;
  content: ContentBlock[];
}

export interface TeamState {
  roster: TeamMemberSnapshot[];
  tasks: Map<string, TeamTaskSnapshot>;
  mailbox: TeamMessageSnapshot[];
}

// ── Task DAG ────────────────────────────────────────────────

export class TaskDAG {
  private tasks = new Map<string, TeamTaskSnapshot>();
  private adjacency = new Map<string, Set<string>>();

  /** 添加任务 */
  addTask(task: TeamTaskSnapshot): void {
    this.tasks.set(task.id, task);
    if (!this.adjacency.has(task.id)) {
      this.adjacency.set(task.id, new Set());
    }
    for (const dep of task.blockedBy) {
      if (!this.adjacency.has(dep)) {
        this.adjacency.set(dep, new Set());
      }
      this.adjacency.get(dep)!.add(task.id);
    }
    logger.info(`[AgentTeams] Added task: ${task.id}`);
  }

  /** 更新任务状态 */
  updateTask(id: string, updates: Partial<TeamTaskSnapshot>): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    this.tasks.set(id, { ...task, ...updates, revision: task.revision + 1 });
    return true;
  }

  /** 获取可执行任务（无依赖或依赖已完成） */
  getReadyTasks(): TeamTaskSnapshot[] {
    return Array.from(this.tasks.values()).filter(task => {
      if (task.status !== 'pending') return false;
      return task.blockedBy.every(depId => {
        const dep = this.tasks.get(depId);
        return dep?.status === 'completed';
      });
    });
  }

  /** 检查循环依赖 */
  hasCycle(): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = this.adjacency.get(nodeId) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const taskId of this.tasks.keys()) {
      if (!visited.has(taskId)) {
        if (dfs(taskId)) return true;
      }
    }
    return false;
  }

  /** 拓扑排序 */
  topologicalSort(): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const deps = this.tasks.get(nodeId)?.blockedBy || [];
      for (const depId of deps) {
        visit(depId);
      }
      sorted.push(nodeId);
    };

    for (const taskId of this.tasks.keys()) {
      visit(taskId);
    }
    return sorted.reverse();
  }

  /** 获取所有任务 */
  getAllTasks(): TeamTaskSnapshot[] {
    return Array.from(this.tasks.values());
  }

  /** 获取任务计数 */
  count(): number {
    return this.tasks.size;
  }
}

// ── Durable Mailbox ─────────────────────────────────────────

export class DurableMailbox {
  private messages = new Map<string, TeamMessageSnapshot[]>();

  /** 投递消息 */
  send(message: TeamMessageSnapshot): void {
    const targetId = message.targetId;
    const targetMsgs = this.messages.get(targetId) || [];
    targetMsgs.push(message);
    this.messages.set(targetId, targetMsgs);
    logger.info(`[AgentTeams] Message sent to ${targetId}: ${message.id}`);
  }

  /** 获取待处理消息 */
  getPendingMessages(targetId: SessionId): TeamMessageSnapshot[] {
    return this.messages.get(targetId) || [];
  }

  /** 标记消息为已读 */
  markAsRead(targetId: SessionId, messageId: string): boolean {
    const msgs = this.messages.get(targetId);
    if (!msgs) return false;
    const idx = msgs.findIndex(m => m.id === messageId);
    if (idx === -1) return false;
    msgs.splice(idx, 1);
    this.messages.set(targetId, msgs);
    return true;
  }

  /** 清空指定成员的消息 */
  clearMessages(targetId: SessionId): void {
    this.messages.delete(targetId);
  }

  /** 获取消息总数 */
  totalMessages(): number {
    let count = 0;
    for (const msgs of this.messages.values()) {
      count += msgs.length;
    }
    return count;
  }
}

// ── Team State Rebuilder ────────────────────────────────────

export class TeamStateRebuilder {
  private roster: TeamMemberSnapshot[] = [];
  private tasks = new Map<string, TeamTaskSnapshot>();
  private mailbox: TeamMessageSnapshot[] = [];

  /** 处理团队事件 */
  processEvent(event: { type: string; data: unknown }): void {
    const data = event.data as Record<string, unknown>;
    switch (event.type) {
      case 'team/roster/update':
        if (data.snapshot) {
          this.roster.push(data.snapshot as TeamMemberSnapshot);
        }
        break;
      case 'team/task/create':
        if (data.task) {
          const task = data.task as TeamTaskSnapshot;
          this.tasks.set(task.id, task);
        }
        break;
      case 'team/task/update':
        if (data.id && data.revision !== undefined) {
          const existing = this.tasks.get(data.id as string);
          if (existing && existing.revision < (data.revision as number)) {
            this.tasks.set(data.id as string, { ...existing, ...data });
          }
        }
        break;
      case 'team/message/send':
        if (data.message) {
          this.mailbox.push(data.message as TeamMessageSnapshot);
        }
        break;
    }
  }

  /** 构建团队状态 */
  buildState(): TeamState {
    return {
      roster: this.roster,
      tasks: this.tasks,
      mailbox: this.mailbox,
    };
  }

  /** 重置状态 */
  reset(): void {
    this.roster = [];
    this.tasks.clear();
    this.mailbox = [];
  }
}

// ── Team Manager ────────────────────────────────────────────

export class TeamManager {
  private teamId: SessionId;
  private members = new Map<SessionId, TeamMemberSnapshot>();
  private taskDAG = new TaskDAG();
  private mailbox = new DurableMailbox();
  private rebuilder = new TeamStateRebuilder();

  constructor(teamId: SessionId) {
    this.teamId = teamId;
    logger.info(`[AgentTeams] Created team: ${teamId}`);
  }

  /** 添加入团队成员 */
  addMember(member: TeamMemberSnapshot): void {
    this.members.set(member.id, member);
    logger.info(`[AgentTeams] Added member: ${member.name}`);
  }

  /** 添加任务 */
  addTask(task: TeamTaskSnapshot): void {
    this.taskDAG.addTask(task);
  }

  /** 获取可执行任务 */
  getReadyTasks(): TeamTaskSnapshot[] {
    return this.taskDAG.getReadyTasks();
  }

  /** 检查循环依赖 */
  validateNoCycles(): boolean {
    return !this.taskDAG.hasCycle();
  }

  /** 投递消息 */
  sendMessage(message: TeamMessageSnapshot): void {
    this.mailbox.send(message);
  }

  /** 获取团队状态 */
  getState(): TeamState {
    return this.rebuilder.buildState();
  }

  /** 处理事件流 */
  processEvents(events: Array<{ type: string; data: unknown }>): void {
    for (const event of events) {
      this.rebuilder.processEvent(event);
    }
  }

  /** 获取统计信息 */
  getStats(): { members: number; tasks: number; messages: number } {
    return {
      members: this.members.size,
      tasks: this.taskDAG.count(),
      messages: this.mailbox.totalMessages(),
    };
  }
}

// 全局单例工厂
const teams = new Map<string, TeamManager>();

export function getOrCreateTeam(teamId: SessionId): TeamManager {
  if (!teams.has(teamId)) {
    teams.set(teamId, new TeamManager(teamId));
  }
  return teams.get(teamId)!;
}