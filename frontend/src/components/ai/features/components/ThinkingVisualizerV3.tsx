/**
 * ThinkingVisualizer V3.0 - 增强型思考过程可视化组件
 *
 * 核心增强：
 * - 树形层级展示（父子关系、分支路径）
 * - 多维度筛选与分析视图切换
 * - 问题拆解依赖图展示
 * - 思考路径可追溯与交互调整
 * - 时间线与进度追踪增强
 * - 用户反馈机制（批准/拒绝/修订步骤）
 *
 * @version 3.0.0
 */

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import {
  Brain,
  Search,
  Database,
  FileText,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Sparkles,
  Target,
  GitBranch,
  Zap,
  GitFork,
  Lightbulb,
  ShieldCheck,
  Layers,
  MessageSquare,
  FlaskConical,
  Scale,
  Microscope,
  Cog,
  TrendingUp,
  ShieldAlert,
  BarChart3,
  DollarSign,
  Filter,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  EyeOff,
  AlertTriangle,
  Network,
  ArrowRight,
  Timer,
  Tag,
} from 'lucide-react'
import type {
  ThinkingStepV3,
  ThinkingStepType,
  ThinkingDimension,
  ProblemDecompositionResult,
} from '../types/thinkingTypes'
import {
  STEP_TYPE_CONFIG,
  DIMENSION_CONFIG,
} from '../types/thinkingTypes'
import type { ThinkingStep } from './ThinkingVisualizer'

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Brain, Search, GitBranch, Target, Sparkles, GitFork, Lightbulb,
  ShieldCheck, Layers, MessageSquare, FlaskConical, Scale, Microscope,
  Cog, TrendingUp, ShieldAlert, BarChart3, DollarSign,
}

export interface ThinkingVisualizerV3Props {
  steps: ThinkingStepV3[]
  legacySteps?: ThinkingStep[]
  isVisible: boolean
  onToggleVisibility?: () => void
  currentStepId?: string | null
  decomposition?: ProblemDecompositionResult | null
  onStepAction?: (stepId: string, action: 'approve' | 'reject' | 'revise' | 'expand' | 'collapse', detail?: string) => void
  onBranchSelect?: (branchId: string) => void
  activeDimensionFilter?: ThinkingDimension | 'all'
  onDimensionFilterChange?: (dimension: ThinkingDimension | 'all') => void
}

interface ViewMode {
  type: 'tree' | 'timeline' | 'decomposition' | 'dimensions'
  label: string
  icon: React.ComponentType<any>
}

const VIEW_MODES: ViewMode[] = [
  { type: 'tree', label: '树形路径', icon: GitBranch },
  { type: 'timeline', label: '时间线', icon: Timer },
  { type: 'decomposition', label: '问题拆解', icon: Network },
  { type: 'dimensions', label: '维度分析', icon: Layers },
]

function ConfidenceBar({ confidence, size = 'sm' }: { confidence: number; size?: 'sm' | 'md' }) {
  const safeConfidence = typeof confidence === 'number' && !isNaN(confidence) ? Math.max(0, Math.min(1, confidence)) : 0
  const getColor = () => {
    if (safeConfidence >= 0.85) return 'bg-primary-500'
    if (safeConfidence >= 0.7) return 'bg-secondary-500'
    if (safeConfidence >= 0.5) return 'bg-warning-500'
    return 'bg-error-400'
  }
  const h = size === 'md' ? 'h-2.5' : 'h-1.5'
  return (
    <div className={`flex items-center gap-2 flex-1`}>
      <div className={`flex-1 ${h} bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden`}>
        <div className={`${h} ${getColor()} transition-all duration-700 ease-out rounded-full`} style={{ width: `${Math.max(safeConfidence * 100, 5)}%` }} />
      </div>
      <span className={`text-xs font-medium text-neutral-500 dark:text-neutral-400 w-10 text-right tabular-nums ${size === 'md' ? '' : 'text-xs'}`}>
        {Math.round(safeConfidence * 100)}%
      </span>
    </div>
  )
}

function StatusDot({ status }: { status: ThinkingStepV3['status'] }) {
  const config = {
    pending: { cls: 'bg-neutral-300 dark:bg-neutral-600', icon: null, label: '等待' },
    processing: { cls: 'bg-secondary-500 animate-pulse', icon: Clock, label: '处理中' },
    completed: { cls: 'bg-primary-500', icon: CheckCircle2, label: '完成' },
    error: { cls: 'bg-error-500', icon: AlertTriangle, label: '错误' },
    skipped: { cls: 'bg-neutral-400 dark:bg-neutral-500', icon: EyeOff, label: '跳过' },
    revised: { cls: 'bg-warning-500', icon: RotateCcw, label: '已修订' },
  }[status] || { cls: 'bg-neutral-300 dark:bg-neutral-600', icon: null, label: String(status || '未知') }
  const Icon = config.icon
  return (
    <div className="flex items-center gap-1" title={config.label}>
      <div className={`w-2.5 h-2.5 rounded-full ${config.cls}`} />
      {Icon && <Icon className="w-3 h-3 text-current" />}
    </div>
  )
}

function DimensionBadge({ dimension }: { dimension: ThinkingDimension }) {
  const cfg = DIMENSION_CONFIG[dimension as keyof typeof DIMENSION_CONFIG] || DIMENSION_CONFIG['technical'] || { color: 'text-neutral-500', bgColor: 'bg-neutral-100 dark:bg-neutral-800', label: String(dimension || '未知'), icon: 'Tag' }
  const DimIcon = ICON_MAP[cfg.icon] || Tag
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${cfg.color} ${cfg.bgColor}`}>
      <DimIcon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  )
}

function StepTypeBadge({ type }: { type: ThinkingStepType }) {
  const cfg = STEP_TYPE_CONFIG[type] || STEP_TYPE_CONFIG['analysis'] || { bgColor: 'bg-neutral-100 dark:bg-neutral-800', textColor: 'text-neutral-600', label: String(type || '未知'), icon: 'Brain' }
  const TypeIcon = ICON_MAP[cfg.icon] || Brain
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bgColor} ${cfg.textColor}`}>
      <TypeIcon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

/** StepCardV3 内部错误边界 — 单个步骤渲染失败不影响整体 */
class StepCardErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-3 rounded-xl border border-warning-200 bg-warning-50/50 dark:border-warning-800 dark:bg-warning-950/20 ml-[var(--depth-px,0px)]">
          <div className="flex items-center gap-2 text-warning-600 dark:text-warning-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-xs">步骤渲染异常</span>
          </div>
          <p className="text-xs text-warning-500 mt-1 font-mono">{this.state.error?.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}

const StepCardV3: React.FC<{
  step: ThinkingStepV3
  isActive: boolean
  depth: number
  isExpanded: boolean
  children?: ThinkingStepV3[]
  onToggle: () => void
  onAction: (action: 'approve' | 'reject' | 'revise') => void
}> = ({ step, isActive, depth, isExpanded, children, onToggle, onAction }) => {
  const typeCfg = STEP_TYPE_CONFIG[step.type] || STEP_TYPE_CONFIG['analysis']
  const TypeIcon = ICON_MAP[typeCfg?.icon] || Brain

  // 安全获取 dimension 配置，防止 undefined key
  const dimCfg = DIMENSION_CONFIG[step.dimension]
  const safeDimension = step.dimension && dimCfg ? step.dimension : 'technical'

  return (
    <StepCardErrorBoundary>
    <div className={``} style={{ marginLeft: `${depth * 20}px` }}>
      <div
        className={`group relative p-3.5 rounded-xl border transition-all duration-300 ${
          isActive ? `${typeCfg.borderColor} ${typeCfg.bgColor} shadow-md scale-[1.01] ring-2 ring-offset-1 ring-secondary-200 dark:ring-secondary-800` :
          `border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-200 dark:hover:border-neutral-700`
        } ${step.status === 'error' ? 'border-error-200 bg-error-50/50 dark:bg-error-950/20' : ''}
        ${step.metadata?.userFeedback === 'approved' ? 'ring-1 ring-success-300' : ''}
        ${step.metadata?.userFeedback === 'rejected' ? 'ring-1 ring-error-300 opacity-60' : ''}
        `}
      >
        {step.status === 'processing' && (
          <div className="absolute inset-0 bg-white/40 dark:bg-neutral-900/40 rounded-xl flex items-center justify-center z-10 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 text-secondary-600 dark:text-secondary-700">
              <Clock className="w-4 h-4 animate-spin" />
              <span className="text-xs font-medium">思考中...</span>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2.5">
          <div className={`p-1.5 rounded-lg ${typeCfg.color.replace('text-', 'bg-')} text-white shrink-0 mt-0.5`}>
            <TypeIcon className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <StepTypeBadge type={step.type} />
                <DimensionBadge dimension={safeDimension} />
                <StatusDot status={step.status} />
                {step.branchId && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-accent-50 text-accent-600 font-mono">branch:{step.branchId.slice(0, 6)}</span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {(children && children.length > 0) && (
                  <button onClick={(e) => { e.stopPropagation(); onToggle() }}
                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                    title={isExpanded ? '收起子步骤' : '展开子步骤'}>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); onToggle() }}
                  className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors">
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                </button>
              </div>
            </div>

            <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-0.5 leading-tight">{step.title}</h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 line-clamp-2">{step.description}</p>

            <ConfidenceBar confidence={step.confidence} />

            <div className="flex items-center gap-2 mt-2">
              {step.evidence && Array.isArray(step.evidence) && step.evidence.length > 0 && (
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex items-center gap-0.5">
                  <FileText className="w-2.5 h-2.5" />{step.evidence.length} 条证据
                </span>
              )}
              {step.metadata?.durationMs != null && (
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex items-center gap-0.5">
                  <Timer className="w-2.5 h-2.5" />{(step.metadata.durationMs / 1000).toFixed(1)}s
                </span>
              )}
              {(step.childrenIds && step.childrenIds.length > 0) && !isExpanded && (
                <span className="text-xs text-secondary-500 cursor-pointer hover:underline"  role="button" tabIndex={0} onClick={onToggle}>
                  {step.childrenIds.length} 个子步骤 →
                </span>
              )}
            </div>

            {isExpanded && step.details && (
              <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800">
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">{step.details}</p>
              </div>
            )}

            {isExpanded && step.evidence && Array.isArray(step.evidence) && step.evidence.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800 space-y-1.5">
                <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 flex items-center gap-1 mb-1.5">
                  <Database className="w-3 h-3" /> 证据链
                </div>
                {step.evidence.map((ev, evIdx) => (
                  <div key={ev?.id || `ev-${evIdx}`} className="flex items-start gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      (ev?.credibility ?? 0) >= 0.8 ? 'bg-primary-400' : (ev?.credibility ?? 0) >= 0.5 ? 'bg-warning-400' : 'bg-error-400'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">{ev?.title || '未知证据'}</p>
                      {ev?.snippet && <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5 line-clamp-1">{ev.snippet}</p>}
                    </div>
                    <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0">{Math.round((ev?.relevance ?? 0) * 100)}%</span>
                  </div>
                ))}
              </div>
            )}

            {isExpanded && step.metadata?.userFeedback == null && step.status !== 'processing' && (
              <div className="mt-2.5 pt-2 border-t border-dashed border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">反馈:</span>
                  <button onClick={() => onAction('approve')} className="p-1 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors" title="批准此步骤">
                    <ThumbsUp className="w-3 h-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-primary-500" />
                  </button>
                  <button onClick={() => onAction('reject')} className="p-1 hover:bg-error-50 dark:hover:bg-error-900/30 rounded transition-colors" title="拒绝此步骤">
                    <ThumbsDown className="w-3 h-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-error-500" />
                  </button>
                  <button onClick={() => onAction('revise')} className="p-1 hover:bg-warning-50 dark:hover:bg-warning-900/30 rounded transition-colors" title="请求修订">
                    <RotateCcw className="w-3 h-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-warning-500" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isExpanded && children?.map(child => (
        <StepCardV3 key={child.id} step={child} isActive={false} depth={depth + 1}
          isExpanded={false} onToggle={() => {}} onAction={() => {}} />
      ))}
    </div>
    </StepCardErrorBoundary>
  )
}

function DecompositionView({ decomposition }: { decomposition: ProblemDecompositionResult }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const priorityColors = {
    critical: 'border-l-red-500 bg-error-50/30 dark:bg-error-950/20',
    high: 'border-l-warning-500 bg-warning-50/30 dark:bg-warning-950/20',
    medium: 'border-l-warning-500 bg-warning-50/30 dark:bg-warning-950/20',
    low: 'border-l-green-500 bg-success-50/30 dark:bg-success-950/20',
  }
  const priorityLabels = { critical: '关键', high: '高', medium: '中', low: '低' }
  if (!decomposition || !decomposition.subProblems || !Array.isArray(decomposition.subProblems) || decomposition.subProblems.length === 0) {
    return null
  }

  return (
    <div className="space-y-3 p-1">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
          拆解为 {decomposition.subProblems.length} 个子问题
        </div>
        <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          总复杂度: {(decomposition.totalEstimatedComplexity * 100).toFixed(0)}%
        </div>
      </div>

      <div className="space-y-2">
        {decomposition.executionOrder.map((subId, idx) => {
          const sp = decomposition.subProblems.find(s => s.id === subId)
          if (!sp) return null
          const dimCfg = DIMENSION_CONFIG[sp.dimension]
          const DimIcon = ICON_MAP[dimCfg.icon] || Tag
          const isExp = expandedId === sp.id
          const deps = decomposition.dependencyGraph.filter(d => d.from === sp.id)

          return (
            <div key={sp.id} className={`rounded-lg border-l-2 ${priorityColors[sp.priority]} overflow-hidden transition-all`}>
              <button onClick={() => setExpandedId(isExp ? null : sp.id)}
                className="w-full text-left p-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-500 shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${dimCfg.color} ${dimCfg.bgColor}`}>
                        <DimIcon className="w-2.5 h-2.5 inline mr-0.5" />{dimCfg.label}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        sp.priority === 'critical' ? 'bg-error-100 text-error-600' :
                        sp.priority === 'high' ? 'bg-warning-100 text-warning-600' :
                        sp.priority === 'medium' ? 'bg-warning-100 text-warning-700' : 'bg-success-100 text-success-600'
                      }`}>{priorityLabels[sp.priority]}</span>
                    </div>
                    <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">{sp.title}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">{sp.description}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">复杂度 {(sp.estimatedComplexity * 100).toFixed(0)}%</span>
                      {deps.length > 0 && (
                        <span className="text-xs text-secondary-500 flex items-center gap-0.5">
                          <ArrowRight className="w-2.5 h-2.5" />依赖 {deps.length} 项
                        </span>
                      )}
                    </div>
                  </div>
                  {(deps.length > 0 || (sp.dependencies && sp.dependencies.length > 0)) && (
                    <ChevronRight className={`w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] transition-transform ${isExp ? 'rotate-90' : ''}`} />
                  )}
                </div>
              </button>

              {isExp && (
                <div className="px-3 pb-3 pt-0 border-t border-neutral-100 dark:border-neutral-800 mt-1">
                  {deps.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">依赖关系</div>
                      {deps.map((d, i) => {
                        const targetSp = decomposition.subProblems.find(s => s.id === d.to)
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-neutral-50 dark:bg-neutral-800/50">
                            <ArrowRight className={`w-3 h-3 ${d.relation === 'requires' ? 'text-error-400' : 'text-secondary-400'}`} />
                            <span className="text-neutral-600 dark:text-neutral-400">{targetSp?.title || d.to}</span>
                            <span className={`text-xs ml-auto ${d.relation === 'requires' ? 'text-error-400' : 'text-secondary-400'}`}>
                              {d.relation === 'requires' ? '必须完成' : '参考信息'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DimensionsView({ steps }: { steps: ThinkingStepV3[] }) {
  const dimGroups = useMemo(() => {
    if (!steps || !Array.isArray(steps) || steps.length === 0) return []
    const groups: Record<string, ThinkingStepV3[]> = {
      semantic: [], domain: [], regulatory: [], technical: [],
      process: [], efficacy: [], safety: [], market: [], cost: [],
    }
    steps.forEach(s => {
      const dim = s.dimension
      if (dim && groups[dim] !== undefined) {
        groups[dim].push(s)
      } else {
        // fallback: put unknown dimension into 'technical'
        groups['technical'].push(s)
      }
    })
    return Object.entries(groups)
      .filter(([, items]) => items && items.length > 0)
      .sort((a, b) => (DIMENSION_CONFIG[a[0] as ThinkingDimension]?.priority || 99) - (DIMENSION_CONFIG[b[0] as ThinkingDimension]?.priority || 99))
      .map(([dim, items]) => ({ dimension: dim as ThinkingDimension, items: items! }))
  }, [steps])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-1">
      {dimGroups.map(({ dimension, items }) => {
        const cfg = DIMENSION_CONFIG[dimension as keyof typeof DIMENSION_CONFIG]
        const DimIcon = ICON_MAP[cfg.icon] || Tag
        const avgConfidence = items.reduce((s, i) => s + i.confidence, 0) / items.length
        const completedCount = items.filter(i => i.status === 'completed').length

        return (
          <div key={dimension} className={`rounded-xl border ${cfg.bgColor} border-opacity-60 overflow-hidden`}>
            <div className="px-3 py-2.5 flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className={`p-1.5 rounded-lg ${cfg.bgColor}`}>
                <DimIcon className={`w-4 h-4 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{cfg.label}</p>
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{completedCount}/{items.length} 完成</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">{Math.round(avgConfidence * 100)}%</span>
              </div>
            </div>
            <div className="p-2 space-y-1.5 max-h-48 overflow-y-auto">
              {items.map(item => (
                <div key={item.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${
                  item.status === 'completed' ? 'bg-white/60 dark:bg-neutral-800/40' :
                  item.status === 'processing' ? 'bg-secondary-50/60 dark:bg-secondary-300/20' :
                  'bg-neutral-50/60 dark:bg-neutral-800/20'
                }`}>
                  <StatusDot status={item.status} />
                  <span className="flex-1 truncate text-neutral-600 dark:text-neutral-400">{item.title}</span>
                  <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] tabular-nums">{Math.round(item.confidence * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const ThinkingVisualizerV3: React.FC<ThinkingVisualizerV3Props> = ({
  steps,
  legacySteps,
  isVisible,
  onToggleVisibility,
  currentStepId,
  decomposition,
  onStepAction,
  activeDimensionFilter = 'all',
  onDimensionFilterChange,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode['type']>('tree')
  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentStepId && containerRef.current) {
      const el = containerRef.current.querySelector(`[data-step-id="${currentStepId}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentStepId])

  const toggleExpand = useCallback((stepId: string) => {
    setExpandedStepIds(prev => {
      const next = new Set(prev)
      if (next.has(stepId)) next.delete(stepId)
      else next.add(stepId)
      return next
    })
  }, [])

  const handleStepAction = useCallback((stepId: string, action: 'approve' | 'reject' | 'revise') => {
    onStepAction?.(stepId, action)
  }, [onStepAction])

  const filteredSteps = useMemo(() => {
    if (!steps || !Array.isArray(steps)) return []
    if (activeDimensionFilter === 'all') return steps
    return steps.filter(s => s.dimension === activeDimensionFilter)
  }, [steps, activeDimensionFilter])

  const rootSteps = useMemo(() => filteredSteps.filter(s => !s.parentId), [filteredSteps])

  const getChildrenOf = useCallback((parentId: string): ThinkingStepV3[] => {
    return filteredSteps.filter(s => s.parentId === parentId)
  }, [filteredSteps])

  const stats = useMemo(() => {
    if (!steps || !Array.isArray(steps)) {
      return { total: 0, completed: 0, processing: 0, dimensions: [] as string[], avgConfidence: 0, hasDecomposition: false }
    }
    return {
      total: steps.length,
      completed: steps.filter(s => s.status === 'completed').length,
      processing: steps.filter(s => s.status === 'processing').length,
      dimensions: [...new Set(steps.map(s => s.dimension).filter(Boolean))],
      avgConfidence: steps.length ? steps.reduce((s, st) => s + st.confidence, 0) / steps.length : 0,
      hasDecomposition: !!decomposition && !!decomposition.subProblems && decomposition.subProblems.length > 0,
    }
  }, [steps, decomposition])

  const allDimensions = (Object.keys(DIMENSION_CONFIG) as ThinkingDimension[]).filter(d =>
    steps && Array.isArray(steps) && steps.some(s => s.dimension === d),
  )

  if (!isVisible) return null

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-100 dark:border-neutral-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-accent-500 via-accent-500 to-danger-500">
        <div className="flex items-center gap-2.5 text-white cursor-pointer"  role="button" tabIndex={0} onClick={onToggleVisibility}>
          <div className="p-1.5 bg-white dark:bg-neutral-900/20 rounded-lg backdrop-blur-sm">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">AI 思考过程 V3</h3>
            <p className="text-xs text-white/80">
              {stats.total} 步骤 · {stats.completed} 完成 · {stats.dimensions.length} 维度
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/70 hidden sm:inline">{stats.avgConfidence > 0 ? `均置信度 ${Math.round(stats.avgConfidence * 100)}%` : ''}</span>
          <button onClick={onToggleVisibility} className="p-1.5 hover:bg-white dark:bg-neutral-900/10 rounded-lg transition-colors">
            <ChevronDown className="w-4 h-4 text-white/80" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2 bg-neutral-50/80 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-2">
          {/* View Mode Tabs */}
          <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
            {VIEW_MODES.map(vm => {
              const VmIcon = vm.icon
              const isActive = viewMode === vm.type
              const isDisabled = vm.type === 'decomposition' && !stats.hasDecomposition
              return (
                <button key={vm.type} onClick={() => !isDisabled && setViewMode(vm.type)}
                  disabled={isDisabled}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    isActive ? 'bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 shadow-sm' :
                    isDisabled ? 'text-neutral-300 dark:text-neutral-400 cursor-not-allowed' :
                    'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                  }`}
                  title={vm.label}>
                  <VmIcon className="w-3 h-3" />
                  <span className="hidden md:inline">{vm.label}</span>
                </button>
              )
            })}
          </div>

          {/* Dimension Filter */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <Filter className="w-3 h-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0" />
            <button onClick={() => onDimensionFilterChange?.('all')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors shrink-0 ${
                activeDimensionFilter === 'all' ? 'bg-accent-100 text-accent-700 dark:bg-accent-300/25 dark:text-accent-700' : 'text-neutral-500 hover:text-neutral-700'
              }`}>全部</button>
            {allDimensions.slice(0, 4).map(dim => {
              const cfg = DIMENSION_CONFIG[dim]
              return (
                <button key={dim} onClick={() => onDimensionFilterChange?.(dim)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors shrink-0 ${
                    activeDimensionFilter === dim ? `${cfg.bgColor} ${cfg.color}` : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-neutral-700'
                  }`}>{cfg.label}</button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div ref={containerRef} className="max-h-[480px] overflow-y-auto scrollbar-thin">
        {viewMode === 'tree' && (
          <div className="p-3 space-y-2.5">
            {rootSteps.length === 0 && !legacySteps?.length ? (
              <div className="text-center py-12 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">AI 正在准备深度思考...</p>
                <p className="text-xs mt-1 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">发送问题后，多维度思考过程将在此展示</p>
              </div>
            ) : (
              <>
                {rootSteps.map(step => (
                  <StepCardV3 key={step.id} step={step} isActive={step.id === currentStepId}
                    depth={0} isExpanded={expandedStepIds.has(step.id)}
                    children={getChildrenOf(step.id)} onToggle={() => toggleExpand(step.id)}
                    onAction={(action) => handleStepAction(step.id, action)}
                  />
                ))}
                {legacySteps && legacySteps.length > 0 && (
                  <div className="pt-3 mt-3 border-t border-dashed border-neutral-200 dark:border-neutral-700">
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2 px-1">兼容模式 — 传统步骤</p>
                    {legacySteps.map(ls => (
                      <div key={ls.id} className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-100 dark:border-neutral-800 ml-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{ls.title}</span>
                          <StatusDot status={ls.status} />
                        </div>
                        <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] line-clamp-1">{ls.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {viewMode === 'timeline' && (
          <div className="p-4">
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-accent-300 via-accent-300 to-danger-300 dark:from-accent-700 dark:via-accent-700 dark:to-danger-700" />
              <div className="space-y-1">
                {steps && Array.isArray(steps) && [...steps].sort((a, b) => (a.metadata?.timestamp || 0) - (b.metadata?.timestamp || 0)).map((step) => {
                  const typeCfg = STEP_TYPE_CONFIG[step.type] || STEP_TYPE_CONFIG['analysis']
                  const TypeIcon = ICON_MAP[typeCfg?.icon] || Brain
                  return (
                    <div key={step.id} data-step-id={step.id} className="relative pl-10 pb-3 group">
                      <div className={`absolute left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 ${
                        step.status === 'completed' ? 'bg-primary-500 border-success-200' :
                        step.status === 'processing' ? 'bg-secondary-500 border-secondary-200 animate-pulse' :
                        'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600'
                      }`}>
                        <TypeIcon className="w-2.5 h-2.5 text-white" />
                      </div>
                      <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-transparent group-hover:border-neutral-200 dark:group-hover:border-neutral-700 transition-all">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{step.title}</span>
                          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                          {/* eslint-disable-next-line react-hooks/purity */}
                          {new Date(step.metadata?.timestamp || Date.now()).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">{step.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'decomposition' && decomposition && (
          <DecompositionView decomposition={decomposition} />
        )}

        {viewMode === 'decomposition' && !decomposition && (
          <div className="text-center py-12 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            <Network className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无问题拆解数据</p>
            <p className="text-xs mt-1 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">复杂问题将自动拆解为子问题依赖图</p>
          </div>
        )}

        {viewMode === 'dimensions' && (
          <DimensionsView steps={steps} />
        )}
      </div>

      {/* Progress Footer */}
      {steps && Array.isArray(steps) && steps.length > 0 && (
        <div className="px-4 py-2.5 bg-neutral-50/80 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">
            <span className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-accent-400" />
              思考进度
            </span>
            <span>{stats.completed} / {stats.total} 步骤完成</span>
          </div>
          <div className="h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-accent-500 via-accent-500 to-danger-500 transition-all duration-700 ease-out rounded-full"
              style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              {stats.dimensions.slice(0, 5).map(d => {
                const cfg = DIMENSION_CONFIG[d as keyof typeof DIMENSION_CONFIG]
                return <span key={d} className={`${cfg.color}`}>{cfg.label}</span>
              })}
            </div>
            <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">↑↓ 导航 · Enter 展开 · Tab 切换视图</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ThinkingVisualizerV3
