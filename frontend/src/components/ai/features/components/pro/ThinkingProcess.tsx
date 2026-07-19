/**
 * ThinkingProcess — 专业级 AI 思考过程展示
 *
 * 位于 AI 回答上方，显示逐步推理链：
 * 1. 步骤依次出现（打字机风格）
 * 2. 每步可折叠展开
 * 3. 完成后渐入最终回答
 * 4. 显示思考耗时
 *
 * 类似 ChatGPT/Claude 的 reasoning 展示
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Brain, Search, Database, FileText, Lightbulb, CheckCircle2,
  ChevronDown, ChevronRight, Loader2, Clock, Cpu,
} from 'lucide-react'

export interface ThinkingStep {
  step: string
  content: string
  status: string
  detail?: string
}

interface ThinkingProcessProps {
  steps: ThinkingStep[]
  isThinking: boolean
  onToggle?: () => void
  startTime?: number
}

const STEP_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  '问题理解': { icon: <Search className="w-3.5 h-3.5" />, color: 'from-blue-500 to-blue-600' },
  '知识检索': { icon: <Database className="w-3.5 h-3.5" />, color: 'from-violet-500 to-violet-600' },
  '推理分析': { icon: <Brain className="w-3.5 h-3.5" />, color: 'from-amber-500 to-orange-500' },
  '配方设计': { icon: <Lightbulb className="w-3.5 h-3.5" />, color: 'from-emerald-500 to-emerald-600' },
  '生成回答': { icon: <FileText className="w-3.5 h-3.5" />, color: 'from-primary-500 to-primary-600' },
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function ThinkingProcess({ steps, isThinking, onToggle, startTime }: ThinkingProcessProps) {
  const [visibleSteps, setVisibleSteps] = useState(0)
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  // 逐步显示思考步骤
  useEffect((): (() => void) | void => {
    if (steps.length === 0) {
      setVisibleSteps(0)
      return
    }
    // 已经完成的步骤立即显示，正在思考的逐步出现
    const completedCount = steps.filter(s => s.status === 'complete').length
    setVisibleSteps(completedCount)

    if (isThinking && completedCount < steps.length) {
      const interval = setInterval(() => {
        setVisibleSteps(prev => Math.min(prev + 1, steps.length))
      }, 600)
      return () => clearInterval(interval)
    } else {
      setVisibleSteps(steps.length)
    }
  }, [steps, isThinking])

  // 计时器
  useEffect(() => {
    if (!startTime) return
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startTime)
    }, 200)
    return () => clearInterval(timerRef.current)
  }, [startTime])

  // 展开/折叠所有
  const toggleAll = useCallback(() => {
    if (expandedStep === '__all__') {
      setExpandedStep(null)
    } else {
      setExpandedStep('__all__')
    }
  }, [expandedStep])

  if (steps.length === 0 && !isThinking) return null

  return (
    <div className="my-2 overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={toggleAll}
          className="flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors group"
        >
          <Cpu className={`w-3.5 h-3.5 ${isThinking ? 'text-primary-500 animate-pulse' : 'text-neutral-400'}`} />
          <span className="font-medium">
            {isThinking ? 'AI 正在思考...' : `AI 思考过程`}
          </span>
          {!isThinking && steps.length > 0 && (
            <span className="text-[10px] text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full ml-1">
              {steps.filter(s => s.status === 'complete').length}/{steps.length} 步
            </span>
          )}
          {startTime && !isThinking && (
            <span className="text-[10px] text-neutral-400 flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {formatDuration(elapsed)}
            </span>
          )}
          {isThinking && (
            <Loader2 className="w-3 h-3 text-primary-500 animate-spin" />
          )}
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expandedStep === '__all__' ? 'rotate-180' : ''} opacity-0 group-hover:opacity-100`} />
        </button>

        {/* 展开/折叠 */}
        {!isThinking && steps.length > 1 && (
          <button
            onClick={toggleAll}
            className="text-[10px] text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            {expandedStep === '__all__' ? '收起' : '展开全部'}
          </button>
        )}
      </div>

      {/* 步骤列表 */}
      <div className="space-y-0.5">
        {steps.slice(0, visibleSteps).map((step, i) => {
          const cfg = STEP_CONFIG[step.step] || { icon: <Brain className="w-3.5 h-3.5" />, color: 'from-slate-400 to-slate-500' }
          const isComplete = step.status === 'complete'
          const isExpanded = expandedStep === step.step || expandedStep === '__all__'
          const isLast = i === steps.length - 1
          const show = i < visibleSteps

          if (!show) return null

          return (
            <div
              key={i}
              className="animate-slide-in"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <button
                onClick={() => setExpandedStep(isExpanded ? null : step.step)}
                className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors group"
              >
                {/* 状态图标 + 连接线 */}
                <div className="flex flex-col items-center">
                  <div className={`
                    flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center
                    transition-all duration-300
                    ${isComplete
                      ? `bg-gradient-to-br ${cfg.color} text-white`
                      : 'bg-warning-100 dark:bg-warning-900/30 text-warning-500'
                    }
                  `}>
                    {isComplete
                      ? <CheckCircle2 className="w-3 h-3" />
                      : <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    }
                  </div>
                  {!isLast && (
                    <div className={`w-0.5 flex-1 min-h-[8px] mt-0.5 ${isComplete ? 'bg-neutral-200 dark:bg-neutral-700' : 'bg-neutral-100 dark:bg-neutral-800'}`} />
                  )}
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${isComplete ? 'text-neutral-700 dark:text-neutral-300' : 'text-warning-600 dark:text-warning-400'}`}>
                      {step.step}
                    </span>
                    {isComplete ? (
                      <span className="text-[10px] text-neutral-400">✓</span>
                    ) : (
                      <span className="text-[10px] text-warning-500 animate-pulse">分析中...</span>
                    )}
                    {step.detail && (
                      <span className="ml-auto">
                        {isExpanded
                          ? <ChevronDown className="w-3 h-3 text-neutral-300" />
                          : <ChevronRight className="w-3 h-3 text-neutral-300" />
                        }
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] leading-relaxed mt-0.5 ${
                    isComplete
                      ? 'text-neutral-500 dark:text-neutral-400'
                      : 'text-warning-600/70 dark:text-warning-400/70 animate-pulse'
                  }`}>
                    {step.content}
                  </p>

                  {/* 展开详情 */}
                  {isExpanded && step.detail && (
                    <div className="mt-1.5 p-2 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-100 dark:border-neutral-700 text-[11px] text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap leading-relaxed">
                      {step.detail}
                    </div>
                  )}
                </div>
              </button>
            </div>
          )
        })}

        {/* 思考中占位 */}
        {isThinking && visibleSteps === 0 && (
          <div className="flex items-center gap-2.5 p-2 animate-pulse">
            <div className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            <div className="flex-1 space-y-1">
              <div className="h-2.5 bg-neutral-200 dark:bg-neutral-700 rounded w-20" />
              <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded w-40" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
