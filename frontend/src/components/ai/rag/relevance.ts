/**
 * RAG 相关度展示辅助（P1-9 修复）
 *
 * 后端 score 是 RRF 融合分（典型值 ≈0.01–0.32），并非百分比。
 * 为避免把 RRF 分渲染成「百分比 + 进度条」造成误导（如 2% 几乎空条），
 * 前端统一改为「排序徽标（#1/#2/#3…）+ 相对强弱表达」。
 *
 * 相对强弱按排序位置划分（不依赖 RRF 绝对值，天然跨检索稳定）：
 * - 第 1 条   → 最相关（strong）
 * - 第 2-3 条 → 相关（medium）
 * - 第 4+ 条  → 较相关（weak）
 */

import type { TFunction } from 'i18next'

export type RelevanceLevel = 'strong' | 'medium' | 'weak'

/** 0-based 排序下标 → 相对相关度等级 */
export function getRelevanceLevel(rank: number): RelevanceLevel {
  if (rank <= 0) return 'strong'
  if (rank <= 2) return 'medium'
  return 'weak'
}

/** 0-based 排序下标 → 本地化相对强弱文案 */
export function getRelevanceLabel(rank: number, t: TFunction): string {
  switch (getRelevanceLevel(rank)) {
    case 'strong':
      return t('ai.knowledge.relevanceStrong')
    case 'medium':
      return t('ai.knowledge.relevanceMedium')
    case 'weak':
    default:
      return t('ai.knowledge.relevanceWeak')
  }
}

/** 排序徽标文本：#1 / #2 / #3 … */
export function getRankBadge(rank: number): string {
  return `#${rank + 1}`
}