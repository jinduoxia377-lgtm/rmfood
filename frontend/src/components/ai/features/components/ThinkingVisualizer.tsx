/**
 * ThinkingVisualizer - 实时思考可视化组件
 *
 * 展示AI的思考过程、信息检索路径及决策逻辑，增强用户对AI响应过程的理解与信任。
 *
 * 核心功能：
 * - 动态展示思考步骤
 * - 可视化信息检索过程
 * - 显示决策置信度
 * - 支持展开/折叠详情
 * - 动画效果增强用户体验
 *
 * @version 2.0.0
 * @lastUpdated 2026-05-22
 */

import React, { useEffect, useState, useRef } from 'react'
import {
  Brain,
  Search,
  Database,
  FileText,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Target,
  GitBranch,
  Zap,
} from 'lucide-react'

export interface ThinkingStep {
  id: string
  type: 'analysis' | 'retrieval' | 'reasoning' | 'decision' | 'generation'
  title: string
  description: string
  confidence: number
  details?: string
  relatedData?: {
    type: 'document' | 'knowledge' | 'formula' | 'research'
    title: string
    snippet?: string
    source?: string
  }[]
  timestamp: number
  status: 'pending' | 'processing' | 'completed' | 'error'
}

export interface ThinkingVisualizerProps {
  steps: ThinkingStep[]
  isVisible: boolean
  onToggleVisibility?: () => void
  currentStepIndex?: number
}

const stepTypeConfig = {
  analysis: {
    icon: Brain,
    color: 'bg-secondary-500',
    bgColor: 'bg-secondary-50',
    borderColor: 'border-secondary-200',
    textColor: 'text-secondary-700',
    label: '语义分析',
  },
  retrieval: {
    icon: Search,
    color: 'bg-success-500',
    bgColor: 'bg-success-50',
    borderColor: 'border-success-200',
    textColor: 'text-success-700',
    label: '信息检索',
  },
  reasoning: {
    icon: GitBranch,
    color: 'bg-accent-500',
    bgColor: 'bg-accent-50',
    borderColor: 'border-accent-200',
    textColor: 'text-accent-700',
    label: '逻辑推理',
  },
  decision: {
    icon: Target,
    color: 'bg-warning-500',
    bgColor: 'bg-warning-50',
    borderColor: 'border-warning-200',
    textColor: 'text-warning-700',
    label: '决策制定',
  },
  generation: {
    icon: Sparkles,
    color: 'bg-danger-500',
    bgColor: 'bg-danger-50',
    borderColor: 'border-danger-200',
    textColor: 'text-danger-700',
    label: '内容生成',
  },
}

const ConfidenceBar: React.FC<{ confidence: number }> = ({ confidence }) => {
  const getColor = () => {
    if (confidence >= 0.8) return 'bg-success-500'
    if (confidence >= 0.5) return 'bg-warning-500'
    return 'bg-error-500'
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all duration-500 ease-out`}
          style={{ width: `${confidence * 100}%` }}
        />
      </div>
      <span className="text-xs font-medium text-neutral-600 w-12 text-right">
        {Math.round(confidence * 100)}%
      </span>
    </div>
  )
}

const ThinkingStepCard: React.FC<{
  step: ThinkingStep
  isActive: boolean
  isExpanded: boolean
  onToggle: () => void
}> = ({ step, isActive, isExpanded, onToggle }) => {
  const config = stepTypeConfig[step.type]
  const Icon = config.icon

  return (
    <div
      className={`relative p-4 rounded-xl border-2 transition-all duration-300 ${
        config.borderColor
      } ${config.bgColor} ${isActive ? 'shadow-lg scale-[1.02]' : ''}`}
    >
      {step.status === 'processing' && (
        <div className="absolute inset-0 bg-white dark:bg-neutral-900/50 rounded-xl flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-neutral-600">
            <Clock className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">处理中...</span>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${config.color} text-white shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.bgColor} ${config.textColor}`}>
                {config.label}
              </span>
              {step.status === 'completed' && (
                <CheckCircle2 className="w-4 h-4 text-success-500" />
              )}
            </div>
            <button
              onClick={onToggle}
              className="p-1 hover:bg-neutral-200 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              )}
            </button>
          </div>

          <h4 className="font-semibold text-neutral-800 mb-1">{step.title}</h4>
          <p className="text-sm text-neutral-600 mb-3 line-clamp-2">{step.description}</p>

          <ConfidenceBar confidence={step.confidence} />

          {isExpanded && step.details && (
            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <p className="text-sm text-neutral-700">{step.details}</p>
            </div>
          )}

          {isExpanded && step.relatedData && step.relatedData.length > 0 && (
            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <div className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2 flex items-center gap-1">
                <Database className="w-3 h-3" />
                相关资料
              </div>
              <div className="space-y-2">
                {step.relatedData.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-2 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-100"
                  >
                    <FileText className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate">{item.title}</p>
                      {item.snippet && (
                        <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5 line-clamp-2">
                          {item.snippet}
                        </p>
                      )}
                      {item.source && (
                        <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">来源: {item.source}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const ThinkingVisualizer: React.FC<ThinkingVisualizerProps> = ({
  steps,
  isVisible,
  onToggleVisibility,
  currentStepIndex = -1,
}) => {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentStepIndex >= 0 && containerRef.current) {
      const activeStep = containerRef.current.querySelector('.scale-\\[1\\.02\\]')
      if (activeStep) {
        activeStep.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [currentStepIndex])

  const toggleExpand = (stepId: string) => {
    setExpandedStepId(expandedStepId === stepId ? null : stepId)
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-100 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-accent-500 to-accent-500 cursor-pointer"
         role="button" tabIndex={0} onClick={onToggleVisibility}
      >
        <div className="flex items-center gap-2 text-white">
          <div className="p-1.5 bg-white dark:bg-neutral-900/20 rounded-lg">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold">AI思考过程</h3>
            <p className="text-xs text-white/80">
              {steps.length > 0 ? `${steps.length} 个思考步骤` : '等待开始...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/80">
            {isVisible ? '点击收起' : '点击展开'}
          </span>
          {isVisible ? (
            <ChevronDown className="w-4 h-4 text-white/80" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white/80" />
          )}
        </div>
      </div>

      {/* Content */}
      {isVisible && (
        <div ref={containerRef} className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {steps.length === 0 ? (
            <div className="text-center py-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>AI正在准备思考...</p>
            </div>
          ) : (
            steps.map((step, index) => (
              <ThinkingStepCard
                key={step.id}
                step={step}
                isActive={index === currentStepIndex}
                isExpanded={expandedStepId === step.id}
                onToggle={() => toggleExpand(step.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Progress Indicator */}
      {isVisible && steps.length > 0 && (
        <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border-t border-neutral-100">
          <div className="flex items-center justify-between text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            <span>思考进度</span>
            <span>
              {steps.filter(s => s.status === 'completed').length} / {steps.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-500 to-accent-500 transition-all duration-500"
              style={{
                width: `${(steps.filter(s => s.status === 'completed').length / steps.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default ThinkingVisualizer
