/**
 * ChatSidebar — 专业版思考过程侧边栏
 *
 * 展示 AI 的推理链：
 * - 问题理解 → 知识检索 → 推理分析 → 配方设计 → 生成回答
 * - 每步有状态指示器（待处理/进行中/完成）
 * - 折叠/展开细节
 */
import React, { useState } from 'react'
import {
  Brain, Search, Database, FileText, CheckCircle2, Clock,
  ChevronDown, ChevronRight, Loader2, Lightbulb, Cpu,
} from 'lucide-react'

export interface SidebarStep {
  step: string
  content: string
  status: string
  detail?: string
}

interface ChatSidebarProps {
  steps: SidebarStep[]
  isThinking: boolean
  isVisible: boolean
  onToggle: () => void
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  '问题理解': <Search className="w-4 h-4" />,
  '知识检索': <Database className="w-4 h-4" />,
  '推理分析': <Brain className="w-4 h-4" />,
  '配方设计': <Lightbulb className="w-4 h-4" />,
  '生成回答': <FileText className="w-4 h-4" />,
}

const STEP_COLORS: Record<string, string> = {
  '问题理解': 'from-blue-500 to-blue-600',
  '知识检索': 'from-violet-500 to-violet-600',
  '推理分析': 'from-amber-500 to-orange-600',
  '配方设计': 'from-emerald-500 to-emerald-600',
  '生成回答': 'from-primary-500 to-primary-600',
}

export default function ChatSidebar({ steps, isThinking, isVisible, onToggle }: ChatSidebarProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null)

  if (!isVisible) return null

  return (
    <div className="border-l border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 w-72 flex-shrink-0 overflow-y-auto hidden lg:block">
      <div className="p-3 space-y-3">
        {/* 头部 */}
        <button onClick={onToggle} className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Cpu className="w-4 h-4 text-primary-500" />
            <span>AI 思考过程</span>
            {isThinking && <Loader2 className="w-3.5 h-3.5 text-primary-500 animate-spin" />}
          </div>
          <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
            {steps.filter(s => s.status === 'complete').length}/{steps.length}
          </span>
        </button>

        {/* 步骤列表 */}
        {steps.length === 0 && isThinking && (
          <div className="space-y-2.5 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-32" />
                </div>
              </div>
            ))}
          </div>
        )}

        {steps.length === 0 && !isThinking && (
          <div className="text-center py-8">
            <Brain className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-400">AI 思考过程将在此显示</p>
          </div>
        )}

        {/* 步骤条目 */}
        <div className="space-y-1">
          {steps.map((step, i) => {
            const isComplete = step.status === 'complete'
            const isProcessing = step.status === 'thinking'
            const isExpanded = expandedStep === step.step
            const isLast = i === steps.length - 1

            return (
              <div key={i} className="relative">
                {/* 连接线 */}
                {!isLast && (
                  <div className={`absolute left-3 top-7 bottom-0 w-0.5 ${isComplete ? 'bg-primary-200 dark:bg-primary-800' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}

                <div className="relative flex items-start gap-2.5 pb-1">
                  {/* 状态图标 */}
                  <div className={`
                    flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                    transition-all duration-300
                    ${isComplete
                      ? 'bg-gradient-to-br ' + (STEP_COLORS[step.step] || 'from-gray-400 to-gray-500') + ' text-white'
                      : isProcessing
                        ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white animate-pulse'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                    }
                  `}>
                    {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" />
                      : isProcessing ? <Loader2 className="w-3 h-3 animate-spin" />
                      : STEP_ICONS[step.step] || <Clock className="w-3 h-3" />}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0 pb-3">
                    <button
                      onClick={() => setExpandedStep(isExpanded ? null : step.step)}
                      className="flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 transition-colors"
                    >
                      {step.step}
                      {step.detail && (
                        isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                      )}
                      {isProcessing && <span className="text-[10px] text-amber-500 ml-1">思考中...</span>}
                    </button>

                    <p className={`text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 ${isProcessing ? 'animate-pulse' : ''}`}>
                      {step.content}
                    </p>

                    {/* 展开的详细信息 */}
                    {isExpanded && step.detail && (
                      <div className="mt-1.5 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                        {step.detail}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
