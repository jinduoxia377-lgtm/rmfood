/**
 * Context Compaction Hook
 *
 * 基于 DeepSeek Harness 的 compaction 算法实现：
 * - 基于 token 计数的压力检测
 * - 自动摘要压缩历史消息
 * - 保留关键上下文
 */

import { useCallback, useRef } from 'react';
import { logger } from '@/utils/safeLogger';
import { tokenEstimator, type CompactionTrigger, type EventSourcedSession } from '../utils/eventSourcing';
import type { AgentMessage } from '@/components/ai/shared/types';

export interface CompactionOptions {
  /** 压力阈值 (默认 80%) */
  pressureThreshold?: number;
  /** 溢出阈值 (默认 95%) */
  overflowThreshold?: number;
  /** 最大消息数 (触发压力压缩) */
  maxMessageCount?: number;
  /** 最大 token 数 (默认 128000) */
  maxTokens?: number;
  /** 压缩后保留的最小消息数 */
  minMessagesToKeep?: number;
}

export interface CompactionResult {
  /** 是否触发了压缩 */
  triggered: boolean;
  /** 触发原因 */
  trigger?: CompactionTrigger;
  /** 压缩前的消息数 */
  beforeCount: number;
  /** 压缩后的消息数 */
  afterCount: number;
  /** 估算节省的 token 数 */
  tokensSaved: number;
}

/**
 * 计算当前 token 使用量和比例
 */
function calculateTokenUsage(
  messages: AgentMessage[],
  maxTokens: number,
): { used: number; ratio: number } {
  const used = tokenEstimator.estimate(messages);
  return { used, ratio: used / maxTokens };
}

/**
 * 判断是否需要触发压缩
 */
function shouldCompact(
  messages: AgentMessage[],
  options: Required<CompactionOptions>,
): CompactionTrigger | null {
  const { used, ratio } = calculateTokenUsage(messages, options.maxTokens);

  if (ratio >= options.overflowThreshold) {
    return 'context-overflow';
  }

  if (
    ratio >= options.pressureThreshold &&
    messages.length >= options.maxMessageCount
  ) {
    return 'pressure';
  }

  return null;
}

/**
 * 生成压缩摘要 (实际项目中应调用 LLM)
 */
async function generateCompressionSummary(
  messages: AgentMessage[],
  keepCount: number,
): Promise<{ summary: string; remaining: AgentMessage[] }> {
  // 保留最近的消息
  const remaining = messages.slice(-keepCount);
  const toCompress = messages.slice(0, -keepCount);

  // 生成摘要
  const summary = `[上下文摘要] 已压缩 ${toCompress.length} 条历史消息 (约 ${tokenEstimator.estimate(toCompress)} tokens)，保留最近 ${remaining.length} 条关键对话。`;

  // 将摘要注入第一条消息
  if (remaining.length > 0) {
    remaining[0] = {
      ...remaining[0],
      content: summary + (remaining[0].content ?? ''),
    };
  }

  return { summary, remaining };
}

export function useCompaction(options: CompactionOptions = {}) {
  const {
    pressureThreshold = 0.8,
    overflowThreshold = 0.95,
    maxMessageCount = 100,
    maxTokens = 128000,
    minMessagesToKeep = 10,
  } = { ...options };

  const sessionRef = useRef<EventSourcedSession | null>(null);

  /**
   * 检查当前消息是否需要压缩
   */
  const checkCompact = useCallback(
    (messages: AgentMessage[]): CompactionTrigger | null => {
      return shouldCompact(messages, {
        pressureThreshold,
        overflowThreshold,
        maxMessageCount,
        maxTokens,
        minMessagesToKeep,
      });
    },
    [pressureThreshold, overflowThreshold, maxMessageCount, maxTokens, minMessagesToKeep],
  );

  /**
   * 执行压缩操作
   */
  const compact = useCallback(
    async (
      messages: AgentMessage[],
      onMessagesUpdate: (updated: AgentMessage[]) => void,
    ): Promise<CompactionResult> => {
      const trigger = shouldCompact(messages, {
        pressureThreshold,
        overflowThreshold,
        maxMessageCount,
        maxTokens,
        minMessagesToKeep,
      });

      if (!trigger) {
        return {
          triggered: false,
          beforeCount: messages.length,
          afterCount: messages.length,
          tokensSaved: 0,
        };
      }

      logger.info(`[Compaction] Triggered: ${trigger}`);

      // 计算保留数量
      const keepCount = Math.max(minMessagesToKeep, Math.floor(messages.length * 0.2));

      // 计算节省的 token
      const beforeTokens = tokenEstimator.estimate(messages);
      const { remaining } = await generateCompressionSummary(messages, keepCount);
      const afterTokens = tokenEstimator.estimate(remaining);

      // 更新消息
      onMessagesUpdate(remaining);

      return {
        triggered: true,
        trigger,
        beforeCount: messages.length,
        afterCount: remaining.length,
        tokensSaved: beforeTokens - afterTokens,
      };
    },
    [pressureThreshold, overflowThreshold, maxMessageCount, maxTokens, minMessagesToKeep],
  );

  /**
   * 获取当前 token 使用量
   */
  const getTokenUsage = useCallback(
    (messages: AgentMessage[]) => {
      return calculateTokenUsage(messages, maxTokens);
    },
    [maxTokens],
  );

  /**
   * 获取压缩配置
   */
  const config = {
    pressureThreshold,
    overflowThreshold,
    maxMessageCount,
    maxTokens,
    minMessagesToKeep,
  };

  return {
    checkCompact,
    compact,
    getTokenUsage,
    config,
  };
}
