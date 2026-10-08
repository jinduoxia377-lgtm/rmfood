/**
 * InlineReasoningRow — DSH 风格的内联思考过程行
 *
 * - 折叠时：单行 28px，显示摘要 + 状态指示器
 * - 展开时：显示完整思考步骤列表
 * - 仅 assistant 消息显示
 * - 替代独立侧栏，节省水平空间
 *
 * @version 2.0.0
 */
import React, { useState, useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown, Loader2, Brain, Cpu, Clock } from 'lucide-react'

export interface InlineStep {
  step: string
  content: string
  status: 'thinking' | 'complete' | 'pending'
  detail?: string
  algorithm?: string
  confidence?: number
}

interface InlineReasoningRowProps {
  steps: InlineStep[]
  isThinking: boolean
  elapsedMs?: number
}

// 算法标签映射
const ALGORITHM_BADGES: Record<string, { label: string; color: string }> = {
  'hybrid-nlp':    { label: 'NLP',    color: 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-400' },
  'rule-engine':   { label: '规则',   color: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400' },
  'llm':           { label: 'LLM',    color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' },
  'bayesian':      { label: '贝叶斯', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  'semantic-search': { label: '搜索', color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400' },
  'ensemble':      { label: '集成',   color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' },
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function InlineReasoningRow({ steps, isThinking, elapsedMs }: InlineReasoningRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [animating, setAnimating] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const completedCount = steps.filter(s => s.status === 'complete').length

  const handleToggle = () => {
    if (!expanded) setAnimating(true)
    setExpanded(!expanded)
    setTimeout(() => setAnimating(false), 200)
  }

  // 流式结束时自动收起
  useEffect(() => {
    if (!isThinking && expanded) {
      // 保持展开，让用户可以选择收起
    }
  }, [isThinking, expanded])

  if (steps.length === 0 && !isThinking) return null

  return (
    <div className="my-1.5 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700/60 bg-neutral-50/80 dark:bg-neutral-800/40">
      {/* 折叠状态 — 单行摘要 */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
        aria-expanded={expanded}
      >
        {/* 状态指示器 */}
        <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
          isThinking ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-emerald-500'
        }`}>
          {isThinking ? (
            <Loader2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 animate-spin" />
          ) : (
            <Brain className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          )}
        </div>

        {/* 摘要文字 */}
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
            {isThinking ? 'AI 正在分析...' : '思考过程'}
          </span>
          {!isThinking && steps.length > 0 && (
            <span className="text-[10px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-1.5">
              {completedCount}/{steps.length} 步
              {elapsedMs !== undefined && ` · ${formatDuration(elapsedMs)}`}
            </span>
          )}
          {/* 算法标签 */}
          {!isThinking && steps.length > 0 && (
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {Array.from(new Set(steps.map(s => s.algorithm).filter((a): a is string => !!a))).slice(0, 3).map((alg) => {
                const badge = ALGORITHM_BADGES[alg]
                return badge ? (
                  <span key={alg} className={`text-[9px] px-1 py-0.5 rounded font-medium ${badge.color}`}>
                    {badge.label}
                  </span>
                ) : null
              })}
            </div>
          )}
        </div>

        {/* 展开/折叠箭头 */}
        <ChevronDown className={`w-3.5 h-3.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* 展开内容 — 带动画 */}
      <div
        ref={contentRef}
        className={`overflow-hidden transition-all duration-200 ${
          expanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-3 pb-2 space-y-1 border-t border-neutral-200 dark:border-neutral-700/60 pt-1.5">
          {steps.map((step, i) => {
            const isComplete = step.status === 'complete'
            const isThinking = step.status === 'thinking'
            return (
              <div
                key={i}
                className={`flex items-start gap-2 py-1 text-xs transition-opacity ${
                  isThinking ? 'opacity-100' : 'opacity-70'
                }`}
              >
                {/* 步骤状态图标 */}
                <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5 ${
                  isComplete ? 'bg-emerald-500' : isThinking ? 'bg-amber-400 animate-pulse' : 'bg-neutral-300 dark:bg-neutral-600'
                }`}>
                  {isComplete ? (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isThinking ? (
                    <Loader2 className="w-2.5 h-2.5 text-white animate-spin" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                  )}
                </div>

                {/* 步骤内容 */}
                <div className="flex-1 min-w-0">
                  <span className={`font-medium ${isComplete ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-500 dark:text-neutral-500'}`}>
                    {step.step}
                  </span>
                  {step.content && (
                    <span className="text-neutral-500 dark:text-neutral-500 ml-1.5 truncate">
                      {step.content}
                    </span>
                  )}
                </div>

                {/* 算法标签 */}
                {step.algorithm && ALGORITHM_BADGES[step.algorithm] && (
                  <span className={`flex-shrink-0 text-[9px] px-1 py-0.5 rounded font-medium ${ALGORITHM_BADGES[step.algorithm].color}`}>
                    {ALGORITHM_BADGES[step.algorithm].label}
                  </span>
                )}
              </div>
            )
          })}

          {/* 流式思考中 — 追加提示 */}
          {isThinking && (
            <div className="flex items-center gap-1.5 py-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
              <span>正在处理...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
