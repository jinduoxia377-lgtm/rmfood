/**
 * ReasoningRow — DSH 风格思考过程行 (v3.0)
 *
 * 设计原则（对标 DSH ReasoningRow）：
 * - 折叠状态：单行 disclosure，高度固定 28px
 * - 展开状态：内联展开完整思考文本
 * - 流式时显示脉冲状态
 * - 极简视觉：无渐变背景、无边框、无算法标签堆砌
 *
 * @version 3.0.0
 */
import React, { useState, useRef, useEffect } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'

export interface ReasoningStep {
  step: string
  content: string
  status: 'thinking' | 'complete' | 'pending'
  detail?: string
}

interface ReasoningRowProps {
  steps: ReasoningStep[]
  isThinking: boolean
  elapsedMs?: number
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function ReasoningRow({ steps, isThinking, elapsedMs }: ReasoningRowProps) {
  const [expanded, setExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const completedCount = steps.filter(s => s.status === 'complete').length
  const pendingCount = steps.filter(s => s.status === 'pending').length

  // 流式完成时自动收起
  useEffect(() => {
    if (!isThinking && steps.length > 0 && completedCount === steps.length && expanded) {
      // 保持展开，让用户决定是否收起
    }
  }, [isThinking, completedCount, steps.length, expanded])

  if (steps.length === 0 && !isThinking) return null

  const isComplete = !isThinking && completedCount === steps.length
  const isPartial = !isThinking && completedCount > 0 && completedCount < steps.length

  return (
    <div className="my-1">
      {/* 折叠/展开 trigger — DSH 单行 disclosure 风格 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors group"
        aria-expanded={expanded}
      >
        {/* 状态指示器 — DSH 风格：纯圆点 */}
        <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${
          isThinking ? 'bg-emerald-500 animate-pulse' :
          isComplete ? 'bg-emerald-500' :
          isPartial ? 'bg-amber-500' :
          'bg-neutral-400'
        }`} />

        {/* 摘要文字 — DSH 风格：简洁文本 */}
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400 flex-1 truncate">
          {isThinking
            ? '正在思考…'
            : isComplete
              ? `思考完成 · ${completedCount} 步`
              : isPartial
                ? `思考中 · ${completedCount}/${steps.length} 步`
                : '思考过程'}
          {elapsedMs !== undefined && !isThinking && (
            <span className="text-neutral-400 dark:text-neutral-500 ml-1">· {formatDuration(elapsedMs)}</span>
          )}
        </span>

        {/* 展开箭头 */}
        <ChevronRight className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-150 flex-shrink-0 ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {/* 展开内容 — 内联展示 */}
      <div
        ref={contentRef}
        className={`overflow-hidden transition-all duration-200 ${
          expanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-2 pb-1.5 space-y-0.5">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`flex items-start gap-1.5 py-0.5 text-[11px] ${
                step.status === 'thinking' ? 'text-neutral-500' :
                step.status === 'complete' ? 'text-neutral-600 dark:text-neutral-400' :
                'text-neutral-400 dark:text-neutral-600'
              }`}
            >
              {/* 步骤状态 */}
              <span className="flex-shrink-0 w-3 h-3 flex items-center justify-center mt-0.5">
                {step.status === 'complete' && (
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                )}
                {step.status === 'thinking' && (
                  <Loader2 className="w-2.5 h-2.5 text-emerald-500 animate-spin" />
                )}
                {step.status === 'pending' && (
                  <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                )}
              </span>
              {/* 步骤内容 */}
              <span className="flex-1 min-w-0 truncate">
                <span className="font-medium">{step.step}</span>
                {step.content && (
                  <span className="text-neutral-400 dark:text-neutral-500 ml-1">{step.content}</span>
                )}
              </span>
            </div>
          ))}

          {/* 流式思考中 — 追加动态行 */}
          {isThinking && (
            <div className="flex items-center gap-1.5 py-0.5 text-[11px] text-neutral-400">
              <Loader2 className="w-2.5 h-2.5 text-emerald-500 animate-spin flex-shrink-0" />
              <span>正在分析配方需求…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
