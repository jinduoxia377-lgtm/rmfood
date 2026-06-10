/**
 * RAGSourcesBanner — 显示 RAG 检索结果的来源文档
 *
 * 当用户启用 RAG 并发送消息后，在消息区域显示
 * 检索到了哪些文档片段。
 */

import React, { useState } from 'react'
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
  const [expanded, setExpanded] = useState(false)

  // RAG 未启用或无数据时不显示
  if (!isEnabled || chunks.length === 0) return null

  return (
    <div className="mx-4 mt-2">
      <div className={clsx(
        'rounded-lg border text-sm transition-all duration-200',
        'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30',
      )}>
        {/* 头部信息栏 */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              知识库参考
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded">
              {chunks.length} 个片段
            </span>
            {sources.length > 0 && (
              <span className="text-[10px] text-emerald-500 dark:text-emerald-500 hidden sm:inline truncate">
                来自 {sources.length} 个文档
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {sources.length > 0 && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                title={expanded ? '收起详情' : '查看来源'}
              >
                {expanded
                  ? <ChevronUp className="w-3.5 h-3.5 text-emerald-500" />
                  : <ChevronDown className="w-3.5 h-3.5 text-emerald-500" />
                }
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                title="关闭"
              >
                <X className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            )}
          </div>
        </div>

        {/* 展开的详情列表 */}
        {expanded && (
          <div className="border-t border-emerald-200 dark:border-emerald-900/30 px-3 py-2 space-y-1.5 max-h-32 overflow-y-auto">
            {sources.map((source, i) => {
              const matchCount = chunks.filter(c => c.source === source).length
              return (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <FileText className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="text-emerald-700 dark:text-emerald-300 truncate">{source}</span>
                  <span className="text-emerald-400 dark:text-emerald-500 shrink-0 ml-auto">
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
