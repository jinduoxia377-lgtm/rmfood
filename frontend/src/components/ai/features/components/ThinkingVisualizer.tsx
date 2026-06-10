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
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    label: '语义分析',
  },
  retrieval: {
    icon: Search,
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    label: '信息检索',
  },
  reasoning: {
    icon: GitBranch,
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    label: '逻辑推理',
  },
  decision: {
    icon: Target,
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
    label: '决策制定',
  },
  generation: {
    icon: Sparkles,
    color: 'bg-pink-500',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    textColor: 'text-pink-700',
    label: '内容生成',
  },
}

const ConfidenceBar: React.FC<{ confidence: number }> = ({ confidence }) => {
  const getColor = () => {
    if (confidence >= 0.8) return 'bg-green-500'
    if (confidence >= 0.5) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all duration-500 ease-out`}
          style={{ width: `${confidence * 100}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600 w-12 text-right">
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
        <div className="absolute inset-0 bg-white/50 rounded-xl flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-gray-600">
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
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
            </div>
            <button
              onClick={onToggle}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>

          <h4 className="font-semibold text-gray-800 mb-1">{step.title}</h4>
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{step.description}</p>

          <ConfidenceBar confidence={step.confidence} />

          {isExpanded && step.details && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-700">{step.details}</p>
            </div>
          )}

          {isExpanded && step.relatedData && step.relatedData.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                <Database className="w-3 h-3" />
                相关资料
              </div>
              <div className="space-y-2">
                {step.relatedData.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-2 bg-white rounded-lg border border-gray-100"
                  >
                    <FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                      {item.snippet && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {item.snippet}
                        </p>
                      )}
                      {item.source && (
                        <p className="text-xs text-gray-400 mt-1">来源: {item.source}</p>
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
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 cursor-pointer"
        onClick={onToggleVisibility}
      >
        <div className="flex items-center gap-2 text-white">
          <div className="p-1.5 bg-white/20 rounded-lg">
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
            <div className="text-center py-8 text-gray-400">
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
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>思考进度</span>
            <span>
              {steps.filter(s => s.status === 'completed').length} / {steps.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
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
