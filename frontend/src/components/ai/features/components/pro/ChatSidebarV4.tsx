/**
 * ChatSidebarV4 — 算法感知型 AI 思考过程侧边栏（紧凑优化版）
 *
 * @version 4.1.0
 */
import React, { useState } from 'react'
import {
  Brain, Search, Database, FileText, CheckCircle2, Clock,
  ChevronDown, ChevronRight, Loader2, Lightbulb, Cpu,
  BarChart3, GitBranch, Target, Sigma, Activity,
  ChevronLeft, ChevronRight as ChevronRightIcon,
} from 'lucide-react'

// ═══════════════════════════════
// 类型定义
// ═══════════════════════════════

export type AlgorithmType =
  | 'hybrid-nlp' | 'rule-engine' | 'llm' | 'bayesian'
  | 'knowledge-graph' | 'semantic-search' | 'ensemble'

export interface SidebarStepV4 {
  step: string
  content: string
  status: 'thinking' | 'complete' | 'pending' | 'error'
  detail?: string
  algorithm?: AlgorithmType
  confidence?: number
  subSteps?: SidebarStepV4[]
}

interface ChatSidebarV4Props {
  steps: SidebarStepV4[]
  isThinking: boolean
  isVisible: boolean
  onToggle: () => void
}

// ═══════════════════════════════
// 算法配置
// ═══════════════════════════════

const ALGORITHM_CONFIG: Record<AlgorithmType, {
  label: string; color: string; bgColor: string
}> = {
  'hybrid-nlp':     { label: 'NLP',    color: 'text-secondary-600 dark:text-secondary-700', bgColor: 'bg-secondary-100 dark:bg-secondary-300/25' },
  'rule-engine':    { label: '规则',   color: 'text-neutral-600 dark:text-neutral-400',     bgColor: 'bg-neutral-100 dark:bg-neutral-900/30' },
  'llm':            { label: 'LLM',    color: 'text-accent-600 dark:text-accent-700',       bgColor: 'bg-accent-100 dark:bg-accent-300/25' },
  'bayesian':       { label: '贝叶斯', color: 'text-primary-700 dark:text-primary-700',     bgColor: 'bg-primary-100 dark:bg-primary-300/25' },
  'knowledge-graph':{ label: '图谱',   color: 'text-warning-600 dark:text-warning-700',     bgColor: 'bg-warning-100 dark:bg-warning-300/25' },
  'semantic-search':{ label: '搜索',   color: 'text-info-600 dark:text-info-700',           bgColor: 'bg-info-100 dark:bg-info-300/25' },
  'ensemble':       { label: '集成',   color: 'text-danger-600 dark:text-danger-700',           bgColor: 'bg-danger-100 dark:bg-danger-300/25' },
}

const STEP_ALGORITHM: Record<string, AlgorithmType> = {
  '问题理解': 'hybrid-nlp',
  '知识检索': 'semantic-search',
  '推理分析': 'llm',
  '配方设计': 'bayesian',
  '生成回答': 'ensemble',
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  '问题理解': <Search className="w-3.5 h-3.5" />,
  '知识检索': <Database className="w-3.5 h-3.5" />,
  '推理分析': <Brain className="w-3.5 h-3.5" />,
  '配方设计': <Sigma className="w-3.5 h-3.5" />,
  '生成回答': <FileText className="w-3.5 h-3.5" />,
}

// ═══════════════════════════════
// 算法徽章（紧凑版）
// ═══════════════════════════════

function AlgorithmBadge({ algorithm, confidence, compact }: {
  algorithm: AlgorithmType; confidence?: number; compact?: boolean
}) {
  const cfg = ALGORITHM_CONFIG[algorithm]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center gap-0.5 rounded font-medium ${cfg.color} ${cfg.bgColor} ${
      compact ? 'text-[9px] px-1 py-0' : 'text-xs px-1.5 py-0.5'
    }`}>
      <span>{cfg.label}</span>
      {confidence !== undefined && !compact && (
        <span className="opacity-70">{(confidence * 100).toFixed(0)}%</span>
      )}
    </span>
  )
}

// ═══════════════════════════════
// 置信度进度条（紧凑版）
// ═══════════════════════════════

function ConfidenceBar({ value, compact }: { value: number; compact?: boolean }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? 'bg-primary-500' : pct >= 60 ? 'bg-warning-500' : 'bg-neutral-400'
  return (
    <div className={`flex items-center gap-1 ${compact ? 'mt-0.5' : 'mt-1'}`}>
      <div className={`flex-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden ${compact ? 'h-0.5' : 'h-1'}`}>
        <div className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }} />
      </div>
      {!compact && <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] w-6 text-right">{pct}%</span>}
    </div>
  )
}

// ═══════════════════════════════
// 步骤卡片（紧凑优化版）
// ═══════════════════════════════

function StepCard({
  step, isLast, isExpanded, onToggle, compact,
}: {
  step: SidebarStepV4; isLast: boolean
  isExpanded: boolean; onToggle: () => void; compact?: boolean
}) {
  const isComplete = step.status === 'complete'
  const isProcessing = step.status === 'thinking'
  const isError = step.status === 'error'
  const algorithm = step.algorithm || STEP_ALGORITHM[step.step] || 'rule-engine'

  return (
    <div className="relative">
      {/* 连接线 */}
      {!isLast && (
        <div className={`absolute left-2.5 top-6 bottom-0 w-px
          ${isComplete ? 'bg-primary-200 dark:bg-primary-800'
                       : 'bg-neutral-200 dark:bg-neutral-700'}`}
        />
      )}

      <div className="relative flex items-start gap-2 pb-1">
        {/* 状态图标 — 紧凑: w-5 h-5 */}
        <div className={`flex-shrink-0 rounded-full flex items-center justify-center
          transition-all duration-300 ring-1 ring-offset-1
          ${compact ? 'w-5 h-5' : 'w-6 h-6'}
          ${isComplete ? 'bg-primary-container text-primary-main ring-primary-200 dark:ring-primary-800'
            : isProcessing ? 'bg-warning-container text-warning-main ring-warning-200 dark:ring-warning-800 animate-pulse'
            : isError ? 'bg-error-container text-error-main ring-error-200 dark:ring-error-800'
            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 ring-neutral-200 dark:ring-neutral-700'}
        `}>
          {isComplete ? <CheckCircle2 className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            : isProcessing ? <Loader2 className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            : isError ? <span className="text-xs font-bold">!</span>
            : STEP_ICONS[step.step] || <Clock className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0 pb-2">
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={onToggle}
              className={`font-semibold text-neutral-800 dark:text-neutral-200 hover:text-primary-700 transition-colors truncate ${
                compact ? 'text-xs' : 'text-xs'
              }`}
            >
              {step.step}
            </button>
            <AlgorithmBadge algorithm={algorithm} confidence={step.confidence} compact={compact} />
            {isProcessing && (
              <span className="text-[9px] text-warning-500 font-medium animate-pulse">思考中...</span>
            )}
            {step.detail && (
              <button onClick={onToggle} className="ml-auto flex-shrink-0">
                {isExpanded ? <ChevronDown className="w-3 h-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                            : <ChevronRight className="w-3 h-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
              </button>
            )}
          </div>

          {/* 置信度进度条 */}
          {step.confidence !== undefined && isComplete && (
            <ConfidenceBar value={step.confidence} compact={compact} />
          )}

          {/* 内容描述 */}
          <p className={`text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 ${
            compact ? 'line-clamp-1' : 'line-clamp-2'
          } ${isProcessing ? 'animate-pulse' : ''}`}>
            {step.content}
          </p>

          {/* 展开详情 */}
          {isExpanded && step.detail && (
            <div className="mt-1.5 p-1.5 bg-white dark:bg-neutral-800 rounded border border-neutral-100
              dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap"
            >
              {step.detail}
            </div>
          )}

          {/* 子步骤 */}
          {step.subSteps && step.subSteps.length > 0 && (
            <div className="mt-1.5 ml-1 pl-1.5 border-l border-neutral-200 dark:border-neutral-700 space-y-1">
              {step.subSteps.map((sub, j) => (
                <div key={j} className="flex items-start gap-1.5">
                  <span className={`mt-1 w-1 h-1 rounded-full flex-shrink-0
                    ${sub.status === 'complete' ? 'bg-primary-400'
                      : sub.status === 'thinking' ? 'bg-warning-400 animate-pulse'
                      : 'bg-neutral-300'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        {sub.step}
                      </span>
                      {sub.algorithm && <AlgorithmBadge algorithm={sub.algorithm} compact />}
                    </div>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] line-clamp-1">{sub.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════
// 主组件
// ═══════════════════════════════

export default function ChatSidebarV4({
  steps, isThinking, isVisible, onToggle,
}: ChatSidebarV4Props) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState(false)
  const [filterAlgorithm, setFilterAlgorithm] = useState<AlgorithmType | 'all'>('all')

  const toggleStep = (name: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const filteredSteps = filterAlgorithm === 'all'
    ? steps
    : steps.filter(s => (s.algorithm || STEP_ALGORITHM[s.step] || 'rule-engine') === filterAlgorithm)

  const stepCounts = {
    total: steps.length,
    complete: steps.filter(s => s.status === 'complete').length,
  }

  // 折叠状态：只显示触发按钮
  if (!isVisible) return null

  // 收起模式：仅显示一个小按钮，点击后展开完整面板
  if (collapsed) {
    return (
      <div className="border-l border-neutral-200 dark:border-neutral-700
        hidden xl:flex xl:flex-col xl:items-center xl:py-2 xl:gap-1"
      >
        <button
          onClick={() => setCollapsed(false)}
          className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg
            text-neutral-400 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20
            transition-all duration-200 group"
          title="显示 AI 思考过程"
        >
          <Cpu className="w-4 h-4 group-hover:animate-pulse" />
          <span className="text-[9px] font-medium"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            思考过程
          </span>
          {isThinking && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
          )}
        </button>
      </div>
    )
  }

  // 展开模式：完整侧栏（宽度 w-64 = 256px，比原来 320px 缩小 20%）
  return (
    <div className="border-l border-neutral-200 dark:border-neutral-700 bg-neutral-50/50
      dark:bg-neutral-900/50 w-64 flex-shrink-0 overflow-y-auto
      transition-all duration-300 hidden xl:block"
    >
      <div className="p-2.5 space-y-2.5">
        {/* 头部 */}
        <div className="flex items-center justify-between gap-1">
          <button onClick={onToggle}
            className="flex items-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:text-primary-700 transition-colors"
          >
            <Cpu className="w-3.5 h-3.5 text-primary-500" />
            <span className="truncate">AI 思考</span>
            {isThinking && <Loader2 className="w-3 h-3 text-primary-500 animate-spin flex-shrink-0" />}
          </button>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <span className="text-[9px] text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono">
              {stepCounts.complete}/{stepCounts.total}
            </span>
            <button
              onClick={() => setCollapsed(true)}
              className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 transition-colors"
              title="收起侧栏"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 算法筛选器（紧凑标签式） */}
        {steps.length > 0 && (
          <div className="flex gap-0.5 flex-wrap">
            {([
              { key: 'all' as const, label: '全部' },
              { key: 'hybrid-nlp' as const, label: 'NLP' },
              { key: 'llm' as const, label: 'LLM' },
              { key: 'bayesian' as const, label: '贝叶斯' },
              { key: 'rule-engine' as const, label: '规则' },
            ] as const).map(a => (
              <button key={a.key}
                onClick={() => setFilterAlgorithm(a.key)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors
                  ${filterAlgorithm === a.key
                    ? 'bg-primary-100 dark:bg-primary-300/30 text-primary-700 dark:text-primary-700'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* 空状态 */}
        {steps.length === 0 && isThinking && (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                <div className="flex-1 space-y-1">
                  <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded w-12" />
                </div>
              </div>
            ))}
          </div>
        )}

        {steps.length === 0 && !isThinking && (
          <div className="text-center py-4">
            <Brain className="w-6 h-6 text-neutral-300 dark:text-neutral-400 mx-auto mb-1.5" />
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">AI 思考过程将在此显示</p>
          </div>
        )}

        {/* 步骤列表（紧凑模式） */}
        <div className="space-y-0.5">
          {filteredSteps.map((step, i) => (
            <StepCard
              key={step.step}
              step={step}
              isLast={i === filteredSteps.length - 1}
              isExpanded={expandedSteps.has(step.step)}
              onToggle={() => toggleStep(step.step)}
              compact
            />
          ))}
        </div>

        {/* 算法统计（极简版） */}
        {steps.length > 0 && (
          <div className="pt-1.5 border-t border-neutral-200 dark:border-neutral-700">
            <div className="flex flex-wrap gap-0.5">
              {Object.entries(ALGORITHM_CONFIG).map(([key, cfg]) => {
                const count = steps.filter(s =>
                  (s.algorithm || STEP_ALGORITHM[s.step] || 'rule-engine') === key
                ).length
                if (count === 0) return null
                return (
                  <span key={key}
                    className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] ${cfg.color} ${cfg.bgColor}`}
                  >
                    <span>{cfg.label}</span>
                    <span className="font-mono opacity-70">{count}</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
