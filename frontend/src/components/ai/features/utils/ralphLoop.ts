/**
 * Ralph Loop - 面向目标的 Fresh-Agent 迭代工作流
 *
 * 基于 DeepSeek Harness 的 Ralph 循环模式：
 * - 每轮创建 fresh child session
 * - Handoff 结构化传递状态
 * - 直到目标完成或达到预算
 */

import { logger } from '@/utils/safeLogger';
import type { SessionId, ContentBlock } from '@/components/ai/shared/types';

// ── 类型定义 ────────────────────────────────────────────────

export type RalphStatus = 'in_progress' | 'blocked' | 'completed';

export interface RalphHandoff {
  status: RalphStatus;
  summary: string;
  evidence: ContentBlock[];
  nextSteps: string[];
  blocker?: string;
  round?: number;
}

export interface RalphBudget {
  maxRounds: number;
  timeoutMs?: number;
}

export interface RalphResult {
  success: boolean;
  rounds: number;
  finalHandoff: RalphHandoff;
  error?: string;
}

// ── Ralph Handoff 解析器 ────────────────────────────────────

export function parseHandoffFromText(text: string): RalphHandoff {
  const handoff: RalphHandoff = {
    status: 'in_progress',
    summary: '',
    evidence: [],
    nextSteps: [],
  };

  // 解析 JSON 格式
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        status: parsed.status ?? 'in_progress',
        summary: parsed.summary ?? '',
        evidence: parsed.evidence ?? [],
        nextSteps: parsed.nextSteps ?? [],
        blocker: parsed.blocker,
        round: parsed.round,
      };
    }
  } catch {
    // 降级到文本解析
  }

  // 文本解析
  const summaryMatch = text.match(/summary[:\s]+([^\n]+)/i);
  if (summaryMatch) handoff.summary = summaryMatch[1].trim();

  const statusMatch = text.match(/status[:\s]+(\w+)/i);
  if (statusMatch) {
    handoff.status = statusMatch[1].toLowerCase() as RalphStatus;
  }

  const nextStepsMatch = text.match(/next steps[:\s]+([^\n]+)/i);
  if (nextStepsMatch) {
    handoff.nextSteps = nextStepsMatch[1].split(',').map(s => s.trim());
  }

  return handoff;
}

export function formatHandoffForInput(handoff: RalphHandoff): string {
  return JSON.stringify({
    status: handoff.status,
    summary: handoff.summary,
    evidence: handoff.evidence,
    nextSteps: handoff.nextSteps,
    blocker: handoff.blocker,
    round: handoff.round ?? 0,
  }, null, 2);
}

// ── Ralph Loop 引擎 ────────────────────────────────────────

export class RalphLoopEngine {
  private readonly MAX_DEFAULT_ROUNDS = 10;
  private readonly TIMEOUT_MS = 60_000;

  /**
   * 执行 Ralph 循环
   * @param objective 不可变目标
   * @param budget 预算限制
   * @param agentFactory 创建 fresh agent 的工厂函数
   */
  async execute(
    objective: string,
    budget: RalphBudget = { maxRounds: this.MAX_DEFAULT_ROUNDS },
    agentFactory: (handoff: RalphHandoff, round: number) => Promise<RalphHandoff>,
  ): Promise<RalphResult> {
    let handoff: RalphHandoff = {
      status: 'in_progress',
      summary: `Ralph 循环开始: ${objective}`,
      evidence: [],
      nextSteps: [objective],
      round: 0,
    };

    const startTime = Date.now();
    let round = 0;

    logger.info(`[RalphLoop] Starting loop for objective: ${objective}`);

    for (round = 1; round <= budget.maxRounds; round++) {
      // 检查超时
      if (budget.timeoutMs && Date.now() - startTime > budget.timeoutMs) {
        logger.warn('[RalphLoop] Timeout exceeded');
        return {
          success: false,
          rounds: round,
          finalHandoff: { ...handoff, status: 'blocked', blocker: 'timeout' },
          error: 'Timeout exceeded',
        };
      }

      // 执行当前轮次
      handoff.round = round;
      logger.info(`[RalphLoop] Round ${round}/${budget.maxRounds}`);

      try {
        const result = await agentFactory(handoff, round);
        handoff = result;

        // 检查是否完成
        if (handoff.status === 'completed') {
          logger.info('[RalphLoop] Objective completed');
          return {
            success: true,
            rounds: round,
            finalHandoff: handoff,
          };
        }

        // 检查是否阻塞
        if (handoff.status === 'blocked' && handoff.blocker) {
          logger.warn(`[RalphLoop] Blocked: ${handoff.blocker}`);
          return {
            success: false,
            rounds: round,
            finalHandoff: handoff,
            error: handoff.blocker,
          };
        }

      } catch (err) {
        logger.error('[RalphLoop] Round execution failed:', err);
        handoff.status = 'blocked';
        handoff.blocker = err instanceof Error ? err.message : 'Unknown error';
        return {
          success: false,
          rounds: round,
          finalHandoff: handoff,
          error: handoff.blocker,
        };
      }
    }

    // 达到预算上限
    logger.warn('[RalphLoop] Budget exceeded');
    return {
      success: false,
      rounds: round,
      finalHandoff: { ...handoff, status: 'blocked', blocker: 'budget_exceeded' },
      error: 'Budget exceeded',
    };
  }

  /**
   * 创建 Ralph Handoff 初始值
   */
  static createInitialHandoff(objective: string): RalphHandoff {
    return {
      status: 'in_progress',
      summary: `初始目标: ${objective}`,
      evidence: [],
      nextSteps: [objective],
      round: 0,
    };
  }
}

// ── 便捷函数 ────────────────────────────────────────────────

/**
 * 简化的 Ralph 循环执行
 */
export async function runRalphLoop(
  objective: string,
  handler: (handoff: RalphHandoff, round: number) => Promise<RalphHandoff>,
  maxRounds: number = 5,
): Promise<RalphResult> {
  const engine = new RalphLoopEngine();
  return engine.execute(objective, { maxRounds }, handler);
}