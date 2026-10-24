/**
 * RAGSourcesBanner — 显示 RAG 检索结果的来源文档
 *
 * 当用户启用 RAG 并发送消息后，在消息区域显示
 * 检索到了哪些文档片段。
 */

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Database, FileText, ChevronDown, ChevronUp, X } from 'lucide-react'
import type { RAGChunkResult } from '@/api/rag'
import { clsx } from 'clsx'

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

  // RAG 未启用或无数据时不显示
  if (!isEnabled || chunks.length === 0) return null

  return (
    <div className="mx-4 mt-2">
      <div className={clsx(
        'rounded-lg border text-sm transition-all duration-200',
        'bg-primary-50/80 dark:bg-success-950/20 border-success-200 dark:border-success-900/30',
      )}>
        {/* 头部信息栏 */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Database className="w-3.5 h-3.5 text-primary-700 dark:text-primary-700 shrink-0" />
            <span className="text-xs font-medium text-primary-700 dark:text-primary-700">
              知识库参考
            </span>
            <span className="px-1.5 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-300/30 text-primary-700 dark:text-primary-700 rounded">
              {chunks.length} 个片段
            </span>
            {sources.length > 0 && (
              <span className="text-xs text-primary-500 dark:text-primary-700 hidden sm:inline truncate">
                来自 {sources.length} 个文档
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {sources.length > 0 && (
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
            )}
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

        {/* 展开的详情列表 */}
        {expanded && (
          <div className="border-t border-success-200 dark:border-success-900/30 px-3 py-2 space-y-1.5 max-h-32 overflow-y-auto">
            {sources.map((source, i) => {
              const matchCount = chunks.filter(c => c.source === source).length
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <FileText className="w-3 h-3 text-primary-500 shrink-0" />
                  <span className="text-primary-700 dark:text-primary-700 truncate">{source}</span>
                  <span className="text-primary-400 dark:text-primary-700 shrink-0 ml-auto">
                    {matchCount} 个匹配
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
