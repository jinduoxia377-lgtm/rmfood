/**
 * 投影缓存优化
 *
 * 基于 DeepSeek Harness 的 SessionProjection 实现：
 * - 缓存派生消息，避免重复计算
 * - 基于内容 hash 失效
 */

import { useRef, useMemo, useCallback } from 'react';
import type { AgentMessage } from '@/components/ai/shared/types';

// ── Hash 计算 ──────────────────────────────────────────────

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

function messageHash(msg: AgentMessage): string {
  return simpleHash(`${msg.id}-${msg.content}-${msg.timestamp.getTime()}`);
}

// ── 缓存结构 ───────────────────────────────────────────────

interface CacheEntry {
  hash: string;
  messages: AgentMessage[];
  tokenEstimate: number;
  updatedAt: number;
}

// ── 单例缓存 ───────────────────────────────────────────────

const cache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 100;

function evictOldest(): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = Array.from(cache.entries())
      .sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0]?.[0];
    if (oldestKey) cache.delete(oldestKey);
  }
}

// ── 投影缓存 Hook ──────────────────────────────────────────

export function useProjectionCache() {
  const invalidateRef = useRef<(() => void)[]>([]);

  /**
   * 获取或计算派生消息 (带缓存)
   */
  const getProjectedMessages = useMemo(() => {
    return (messages: AgentMessage[]): AgentMessage[] => {
      // 生成缓存 key
      const key = messages.map(messageHash).join('|');

      // 检查缓存
      const cached = cache.get(key);
      if (cached && Date.now() - cached.updatedAt < 5000) {
        return cached.messages;
      }

      // 未命中，计算并缓存
      evictOldest();
      const entry: CacheEntry = {
        hash: key,
        messages,
        tokenEstimate: estimateTokens(messages),
        updatedAt: Date.now(),
      };
      cache.set(key, entry);

      return messages;
    };
  }, []);

  /**
   * 清除缓存
   */
  const clearCache = useCallback(() => {
    cache.clear();
  }, []);

  /**
   * 获取缓存统计
   */
  const stats = useMemo(() => ({
    size: cache.size,
    maxEntries: MAX_CACHE_SIZE,
  }), [cache.size]);

  return { getProjectedMessages, clearCache, stats };
}

/**
 * 估算 token 数量
 */
function estimateTokens(messages: AgentMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    // 简单估算：中文字符 1.5 字符/token，ASCII 4 字符/token
    let chinese = 0;
    let ascii = 0;
    for (const char of msg.content) {
      if (/[\u4e00-\u9fa5]/.test(char)) chinese++;
      else ascii++;
    }
    total += Math.ceil(chinese / 1.5 + ascii / 4);
  }
  return total;
}
