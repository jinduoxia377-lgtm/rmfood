/**
 * useChatCompaction 增强 Hook
 *
 * 在消息发送前检查 token 使用量，自动触发压缩
 * 集成到 ChatTab 的消息发送流程
 */

import { useCallback } from 'react';
import { useCompaction, type CompactionResult } from './useCompaction';
import { logger } from '@/utils/safeLogger';
import type { AgentMessage } from '@/components/ai/shared/types';

export interface UseChatCompactionOptions {
  /** 压缩触发时的回调 */
  onCompact?: (result: CompactionResult) => void;
  /** 最大消息数后强制压缩 (默认 100) */
  forceCompactAfter?: number;
}

export interface UseChatCompactionReturn {
  /** 检查并执行压缩，返回是否触发了压缩 */
  checkAndCompact: (messages: AgentMessage[]) => Promise<CompactionResult>;
  /** 当前 token 使用统计 */
  tokenUsage: { used: number; ratio: number };
  /** 压缩配置 */
  config: ReturnType<typeof useCompaction>['config'];
}

export function useChatCompaction(options: UseChatCompactionOptions = {}): UseChatCompactionReturn {
  const { onCompact, forceCompactAfter = 100 } = options;
  const { checkCompact, compact, config } = useCompaction();

  /**
   * 发送前检查并执行压缩
   */
  const checkAndCompact = useCallback(
    async (messages: AgentMessage[]): Promise<CompactionResult> => {
      const trigger = checkCompact(messages);

      if (!trigger) {
        // 检查是否达到强制压缩阈值
        if (messages.length >= forceCompactAfter) {
          logger.info(`[ChatCompaction] Force compact: ${messages.length} messages exceeds limit`);
        } else {
          return { triggered: false, beforeCount: messages.length, afterCount: messages.length, tokensSaved: 0 };
        }
      }

      const result = await compact(messages, (updated) => {
        // 更新消息列表（由调用方处理）
        logger.info(`[ChatCompaction] Compact applied: ${trigger}, before=${messages.length}, after=${updated.length}`);
        onCompact?.({ triggered: true, trigger: trigger ?? undefined, beforeCount: messages.length, afterCount: updated.length, tokensSaved: 0 });
      });

      return result;
    },
    [checkCompact, compact, forceCompactAfter, onCompact],
  );

  return {
    checkAndCompact,
    tokenUsage: { used: 0, ratio: 0 }, // 实际使用时由调用方传入消息列表计算
    config,
  };
}
