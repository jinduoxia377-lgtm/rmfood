/**
 * RAGSourcesBanner — 可交互引用卡片组件
 *
 * 当用户启用 RAG 并发送消息后，在消息区域显示
 * 检索到了哪些文档片段，支持展开查看完整内容。
 * 
 * 增强功能（Phase 3）：
 * - 可展开的引用卡片（显示前 3 条 chunk 预览）
 * - 相关度展示为「排序徽标 + 相对强弱」（P1-9：RRF 融合分不是百分比，不再渲染进度条）
 * - 点击卡片展开完整内容
 * - 快速关闭功能
 */

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Database, FileText, ChevronDown, ChevronUp, X, Eye, Target } from 'lucide-react'
import type { RAGChunkResult } from '@/api/rag'
import { clsx } from 'clsx'
import MarkdownRenderer from '../features/components/pro/MarkdownRenderer'
import { getRelevanceLabel, getRankBadge } from './relevance'
import { getSourceDisplayName } from './sourceDisplay'

interface RAGSourcesBannerProps {
  /** 是否已启用 RAG */
  isEnabled: boolean
  /** 检索到的文档块 */
  chunks: RAGChunkResult[]
  /** 源文件列表（去重） */
  sources: string[]
  /** 关闭横幅 */
  onDismiss?: () => void
}

export function RAGSourcesBanner({
  isEnabled,
  chunks,
  sources,
  onDismiss,
}: RAGSourcesBannerProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [activeChunkIdx, setActiveChunkIdx] = useState<number | null>(null)

  // RAG 未启用或无数据时不显示
  if (! isEnabled || chunks.length === 0) return null

  // 按相关度分数排序（score 为 RRF 融合分，仅用于排序，不直接展示为百分比）
  const sortedChunks = [...chunks].sort((a, b) => b.score - a.score)
  const previewChunks = sortedChunks.slice(0, 3)

  return (
    <div className="mx-4 mt-2">
      <div className={clsx(
        'rounded-lg border text-sm transition-all duration-200 overflow-hidden',
        'bg-primary-50/80 dark:bg-success-950/20 border-success-200 dark:border-success-900/30',
      )}>
        {/* 头部信息栏 */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Database className="w-3.5 h-3.5 text-primary-700 dark:text-primary-700 shrink-0" />
            <span className="text-xs font-medium text-primary-700 dark:text-primary-700">
              {t('ai.knowledge.ragSourceRef')}
            </span>
            <span className="px-1.5 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-300/30 text-primary-700 dark:text-primary-700 rounded">
              {t('ai.knowledge.ragChunksCount', { count: chunks.length })}
            </span>
            {sources.length > 0 && (
              <span className="text-xs text-primary-500 dark:text-primary-700 hidden sm:inline truncate">
                {t('ai.knowledge.ragFromDocs', { count: sources.length })}
              </span>
            )}
            {/* 相关度排序指示（P1-9：RRF 融合分不是百分比，改为排序语义） */}
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-300/20 text-primary-700 dark:text-primary-700 rounded">
              <Target className="w-3 h-3" />
              {t('ai.knowledge.relevanceRank')}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-1 rounded hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
              title={expanded ? t('ai.knowledge.collapseDetails') : t('ai.knowledge.viewSource')}
            >
              {expanded
                ? <ChevronUp className="w-3.5 h-3.5 text-primary-500" />
                : <ChevronDown className="w-3.5 h-3.5 text-primary-500" />
              }
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="p-1 rounded hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                title={t('ai.knowledge.close')}
              >
                <X className="w-3.5 h-3.5 text-primary-400" />
              </button>
            )}
          </div>
        </div>

        {/* 预览卡片（默认显示前 3 条） */}
        {!expanded && previewChunks.length > 0 && (
          <div className="border-t border-success-200 dark:border-success-900/30 px-3 py-2 space-y-1.5">
            {previewChunks.map((chunk, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveChunkIdx(idx)
                  setExpanded(true)
                }}
                className="w-full flex items-start gap-2 text-xs p-1.5 rounded hover:bg-primary-100/50 dark:hover:bg-primary-900/20 transition-colors text-left"
              >
                <FileText className="w-3.5 h-3.5 text-primary-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-primary-700 dark:text-primary-700 truncate">
                      {getSourceDisplayName(chunk.source, chunk.display_name)}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="px-1 py-0.5 text-[10px] font-semibold leading-none bg-primary-100 dark:bg-primary-300/20 text-primary-700 dark:text-primary-700 rounded">
                        {getRankBadge(idx)}
                      </span>
                      <span className="text-primary-500 dark:text-primary-700 text-xs">
                        {getRelevanceLabel(idx, t)}
                      </span>
                    </span>
                  </div>
                  <p className="text-primary-600 dark:text-primary-700/80 truncate mt-0.5">
                    {chunk.content.slice(0, 60)}...
                  </p>
                </div>
              </button>
            ))}
            {sortedChunks.length > 3 && (
              <button
                onClick={() => setExpanded(true)}
                className="w-full text-center text-xs text-primary-500 dark:text-primary-700 hover:text-primary-700 dark:hover:text-primary-500 py-1 transition-colors"
              >
                {t('ai.knowledge.viewAllSources', { count: sortedChunks.length })}
              </button>
            )}
          </div>
        )}

        {/* 展开的详情列表 */}
        {expanded && (
          <div className="border-t border-success-200 dark:border-success-900/30 px-3 py-2 max-h-64 overflow-y-auto">
            {sortedChunks.map((chunk, idx) => {
              const isActive = activeChunkIdx === idx
              return (
                <div
                  key={idx}
                  className={clsx(
                    'mb-2 p-2 rounded-md border transition-all',
                    isActive
                      ? 'bg-primary-100/80 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700'
                      : 'bg-white/50 dark:bg-neutral-900/30 border-transparent hover:border-primary-200 dark:hover:border-primary-800'
                  )}
                >
                  <button
                    onClick={() => setActiveChunkIdx(isActive ? null : idx)}
                    className="w-full flex items-center gap-2 text-xs text-left mb-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                    <span className="text-primary-700 dark:text-primary-700 font-medium flex-1 truncate">
                      {getSourceDisplayName(chunk.source, chunk.display_name)}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="px-1 py-0.5 text-[10px] font-semibold leading-none bg-primary-100 dark:bg-primary-300/20 text-primary-700 dark:text-primary-700 rounded">
                        {getRankBadge(idx)}
                      </span>
                      <span className="text-primary-600 dark:text-primary-700 text-xs font-medium">
                        {getRelevanceLabel(idx, t)}
                      </span>
                    </span>
                    {isActive ? (
                      <Eye className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-primary-400 shrink-0" />
                    )}
                  </button>
                  {/* 展开显示完整内容（Markdown 渲染） */}
                  {isActive && (
                    <div className="ml-5 p-2 bg-white/80 dark:bg-neutral-900/50 rounded text-xs text-primary-700 dark:text-primary-700/90 leading-relaxed max-h-48 overflow-y-auto">
                      <MarkdownRenderer content={chunk.content} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}