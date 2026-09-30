/**
 * Subagent Manager - 子智能体委托框架
 *
 * 基于 DeepSeek Harness 的 Subagent 能力：
 * - 子智能体创建与管理
 * - 任务委托与结果回收
 * - 生命周期管理
 */

import { logger } from '@/utils/safeLogger';
import { fetchWithCsrf } from '@/utils/csrf';
import type { AgentMessage } from '@/components/ai/shared/types';

// ── 类型定义 ────────────────────────────────────────────────

export interface SubagentOptions {
  id?: string;
  name: string;
  prompt: string;
  maxSteps?: number;
  timeoutMs?: number;
}

export interface SubagentResult {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  output?: string;
  error?: string;
  steps?: Array<{ tool: string; result: unknown }>;
  startedAt: number;
  completedAt?: number;
}

export interface SubagentHandle {
  id: string;
  send(message: AgentMessage[]): SendResult;
  interrupt(): InterruptResult;
  result(): Promise<SubagentResult>;
}

export interface SendResult {
  accepted: boolean;
  queueLength?: number;
}

export interface InterruptResult {
  success: boolean;
  reason?: string;
}

// ── 子智能体类 ──────────────────────────────────────────────

class SubagentImpl implements SubagentHandle {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' = 'running';
  private messages: AgentMessage[] = [];
  private resultPromise: Promise<SubagentResult>;
  private abortController: AbortController;
  private startTime: number;

  constructor(private options: SubagentOptions) {
    this.id = options.id ?? `subagent-${Date.now()}`;
    this.startTime = Date.now();
    this.abortController = new AbortController();
    this.resultPromise = this.execute();
  }

  async execute(): Promise<SubagentResult> {
    try {
      const prompt = this.options.prompt;
      const maxSteps = this.options.maxSteps ?? 5;

      // 调用后端 Agent API 执行子任务
      const data = await fetchWithCsrf('/api/v1/agent/execute', {
        method: 'POST',
        body: JSON.stringify({
          query: prompt,
          mode: 'smart' as const,
          max_steps: maxSteps,
        }),
        signal: this.abortController.signal,
      }) as { data: { final_response_preview?: string; steps?: Array<{ tool: string; result?: unknown }> } };
      const output = data.data?.final_response_preview ?? `[${this.options.name}] 执行完成`;
      const steps = (data.data?.steps ?? []).map(s => ({ tool: s.tool, result: s.result }));

      const result: SubagentResult = {
        id: this.id,
        status: 'completed',
        output,
        steps,
        startedAt: this.startTime,
        completedAt: Date.now(),
      };
      return result;
    } catch (err) {
      if (this.abortController.signal.aborted) {
        return {
          id: this.id,
          status: 'cancelled',
          startedAt: this.startTime,
          completedAt: Date.now(),
        };
      }
      return {
        id: this.id,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        startedAt: this.startTime,
        completedAt: Date.now(),
      };
    }
  }

  send(message: AgentMessage[]): SendResult {
    if (this.status === 'cancelled') {
      return { accepted: false };
    }
    this.messages.push(...message);
    return { accepted: true, queueLength: this.messages.length };
  }

  interrupt(): InterruptResult {
    if (this.status !== 'running') {
      return { success: false, reason: 'Agent not running' };
    }
    this.status = 'cancelled';
    this.abortController.abort();
    logger.info(`[Subagent] Interrupted: ${this.id}`);
    return { success: true };
  }

  result(): Promise<SubagentResult> {
    return this.resultPromise;
  }
}

// ── Subagent Manager ────────────────────────────────────────

export class SubagentManager {
  private agents: Map<string, SubagentImpl> = new Map();

  /**
   * 创建并启动子智能体
   */
  spawn(options: SubagentOptions): SubagentHandle {
    const agent = new SubagentImpl(options);
    this.agents.set(agent.id, agent);
    logger.info(`[SubagentManager] Spawned subagent: ${agent.id}`);
    return agent;
  }

  /**
   * 获取子智能体
   */
  get(id: string): SubagentHandle | undefined {
    return this.agents.get(id);
  }

  /**
   * 中断子智能体
   */
  interrupt(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    agent.interrupt();
    return true;
  }

  /**
   * 等待子智能体完成
   */
  async waitFor(id: string, timeoutMs?: number): Promise<SubagentResult> {
    const agent = this.agents.get(id);
    if (!agent) throw new Error(`Subagent not found: ${id}`);

    if (timeoutMs) {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${timeoutMs}ms`)), timeoutMs)
      );
      return Promise.race([agent.result(), timeout]);
    }

    return agent.result();
  }

  /**
   * 获取所有子智能体状态
   */
  listAgents(): Array<{ id: string; status: string; name: string }> {
    return Array.from(this.agents.entries()).map(([id, agent]) => ({
      id,
      status: agent.status,
      name: agent['options']?.name ?? 'Unknown',
    }));
  }

  /**
   * 清理已完成的子智能体
   */
  cleanup(): number {
    const before = this.agents.size;
    for (const [id, agent] of this.agents.entries()) {
      if (agent.status !== 'running') {
        this.agents.delete(id);
      }
    }
    return before - this.agents.size;
  }
}

// 全局单例
let _manager: SubagentManager | null = null;

export function getSubagentManager(): SubagentManager {
  if (!_manager) {
    _manager = new SubagentManager();
  }
  return _manager;
}