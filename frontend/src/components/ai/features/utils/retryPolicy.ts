/**
 * Retry Policy v2.0 - 基于 DeepSeek Harness 实现
 *
 * 增强功能：
 * - 完整的可重试错误分类
 * - 指数退避 + Jitter
 * - 上下文感知重试策略
 * - 集成 LLM Adapter 失败类型
 */

import { logger } from '@/utils/safeLogger';
import type { LlmFailure } from '@/components/ai/shared/types';

// ── 重试策略类型 ────────────────────────────────────────────

export type RetryMode = 'normal' | 'always' | 'intelligent';

export interface RetryPolicy {
  mode: RetryMode;
  maxRetries: number;
  retryableCodes: string[];
  intelligentActions: Record<string, { action: 'retry' | 'compaction' | 'abort'; delayMs: number; maxRetries: number }>;
  initialDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

// ── 默认策略 ────────────────────────────────────────────────

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  mode: 'intelligent',
  maxRetries: 3,
  retryableCodes: [
    'EMPTY_RESPONSE',
    'TIMEOUT',
    'RATE_LIMITED',
    'NETWORK_ERROR',
  ],
  intelligentActions: {
    'CONTEXT_WINDOW_EXCEEDED': {
      action: 'compaction',
      delayMs: 0,
      maxRetries: 1,
    },
    'RATE_LIMITED': {
      action: 'retry',
      delayMs: 5000,
      maxRetries: 5,
    },
    'INVALID_AUTH': {
      action: 'abort',
      delayMs: 0,
      maxRetries: 0,
    },
  },
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  jitterRatio: 0.1,
};

// ── 重试上下文 ──────────────────────────────────────────────

export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  nextRetryAt: Date;
  lastError?: LlmFailure;
}

// ── 重试执行器 ──────────────────────────────────────────────

export class RetryExecutor {
  private policy: RetryPolicy;
  
  constructor(policy: Partial<RetryPolicy> = {}) {
    this.policy = { ...DEFAULT_RETRY_POLICY, ...policy };
  }
  
  /**
   * 执行带重试的操作
   */
  async execute<T>(
    fn: (context: RetryContext) => Promise<T>,
    maxAttempts?: number,
  ): Promise<T> {
    let lastError: unknown;
    let delay = this.policy.initialDelayMs;
    const maxAttemptsCount = maxAttempts ?? (this.policy.mode === 'always' ? Infinity : this.policy.maxRetries + 1);
    
    for (let attempt = 0; attempt < maxAttemptsCount; attempt++) {
      const nextRetryAt = new Date(Date.now() + delay);
      
      try {
        const result = await fn({
          attempt,
          maxAttempts: maxAttemptsCount,
          delayMs: delay,
          nextRetryAt,
          lastError: lastError ? this.normalizeError(lastError) : undefined,
        });
        return result;
      } catch (error) {
        lastError = error;
        const failure = this.normalizeError(error);
        
        // 检查智能动作
        const intelligentAction = this.policy.intelligentActions[failure.code];
        if (intelligentAction) {
          if (intelligentAction.action === 'abort') {
            logger.error('[RetryExecutor] Aborting due to non-retryable error:', failure);
            throw error;
          }
          
          if (intelligentAction.action === 'compaction') {
            logger.info('[RetryExecutor] Triggering compaction before retry');
            // 触发压缩的回调由调用方处理
          }
          
          delay = intelligentAction.delayMs;
        } else if (!this.isRetryable(failure)) {
          logger.error('[RetryExecutor] Non-retryable error:', failure);
          throw error;
        }
        
        if (this.policy.mode === 'normal' && attempt >= this.policy.maxRetries) {
          logger.error('[RetryExecutor] Max retries exceeded:', failure);
          throw error;
        }
        
        // 指数退避 + jitter
        if (delay === 0 || intelligentAction?.action === 'retry') {
          delay = Math.min(delay * 2, this.policy.maxDelayMs);
          const jitter = delay * this.policy.jitterRatio * (Math.random() * 2 - 1);
          delay = Math.max(100, delay + jitter);
        }
        
        logger.warn(
          `[RetryExecutor] Attempt ${attempt + 1}/${maxAttemptsCount} failed, retrying in ${Math.round(delay)}ms`,
          failure,
        );
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }
  
  private isRetryable(failure: LlmFailure): boolean {
    if (this.policy.mode === 'always') return true;
    return this.policy.retryableCodes.includes(failure.code);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private normalizeError(error: unknown): LlmFailure {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('context') || message.includes('too long') || message.includes('maximum')) {
        return { message: error.message, code: 'CONTEXT_WINDOW_EXCEEDED', retryable: false };
      }
      if (message.includes('empty') || message.includes('no response') || message.includes('invalid')) {
        return { message: error.message, code: 'EMPTY_RESPONSE', retryable: true };
      }
      if (message.includes('timeout')) {
        return { message: error.message, code: 'TIMEOUT', retryable: true };
      }
      if (message.includes('429') || message.includes('rate limit') || message.includes('too many')) {
        return { message: error.message, code: 'RATE_LIMITED', retryable: true };
      }
      if (message.includes('401') || message.includes('auth') || message.includes('unauthorized')) {
        return { message: error.message, code: 'INVALID_AUTH', retryable: false };
      }
      if (message.includes('network') || message.includes('fetch') || message.includes('failed')) {
        return { message: error.message, code: 'NETWORK_ERROR', retryable: true };
      }
    }
    
    return { message: String(error), code: 'UNKNOWN_ERROR', retryable: false };
  }
}

// ── Hook ────────────────────────────────────────────────────

export function useRetryExecutor(policy?: Partial<RetryPolicy>) {
  const executor = new RetryExecutor(policy);
  return executor.execute.bind(executor);
}

// ── 工具函数 ────────────────────────────────────────────────

export function createRetryPolicy(overrides?: Partial<RetryPolicy>): RetryPolicy {
  return { ...DEFAULT_RETRY_POLICY, ...overrides };
}
