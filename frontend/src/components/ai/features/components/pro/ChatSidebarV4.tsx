/**
 * ChatSidebarV4 — 算法感知型 AI 思考过程侧边栏
 *
 * 增强功能：
 * - 算法标签显示 (HybridNLP / 规则引擎 / LLM / 贝叶斯优化)
 * - 置信度进度条
 * - 算法类型色彩编码
 * - 多分支推理视图
 * - 响应式布局
 *
 * @version 4.0.0
 */
import React, { useState } from 'react'
import {
  Brain, Search, Database, FileText, CheckCircle2, Clock,
  ChevronDown, ChevronRight, Loader2, Lightbulb, Cpu,
  BarChart3, GitBranch, Target, Sigma, Activity,
} from 'lucide-react'

// ═══════════════════════════════
// 类型定义
// ═══════════════════════════════

export type AlgorithmType =
  | 'hybrid-nlp' | 'rule-engine' | 'llm' | 'bayesian'
  | 'knowledge-graph' | 'semantic-search' | 'ensemble'

export interface SidebarStepV4 {
  step: string              // 步骤名
  content: string           // 摘要
  status: 'thinking' | 'complete' | 'pending' | 'error'
  detail?: string           // 详情
  /** 使用的算法 */
  algorithm?: AlgorithmType
  /** 置信度 0~1 */
  confidence?: number
  /** 算法说明 */
  algorithmLabel?: string
  /** 子步骤 (分支推理) */
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
  label: string; icon: React.ReactNode; color: string; bgColor: string
}> = {
  'hybrid-nlp': {
    label: 'HybridNLP',
    icon: <Activity className="w-3 h-3" />,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  'rule-engine': {
    label: '规则引擎',
    icon: <Cpu className="w-3 h-3" />,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-900/30',
  },
  'llm': {
    label: 'LLM',
    icon: <Brain className="w-3 h-3" />,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
  },
  'bayesian': {
    label: '贝叶斯优化',
    icon: <Sigma className="w-3 h-3" />,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  'knowledge-graph': {
    label: '知识图谱',
    icon: <GitBranch className="w-3 h-3" />,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  'semantic-search': {
    label: '语义搜索',
    icon: <Search className="w-3 h-3" />,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
  },
  'ensemble': {
    label: '集成决策',
    icon: <BarChart3 className="w-3 h-3" />,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-100 dark:bg-rose-900/30',
  },
}

// 步骤名 → 默认算法映射
const STEP_ALGORITHM: Record<string, AlgorithmType> = {
  '问题理解': 'hybrid-nlp',
  '知识检索': 'semantic-search',
  '推理分析': 'llm',
  '配方设计': 'bayesian',
  '生成回答': 'ensemble',
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  '问题理解': <Search className="w-4 h-4" />,
  '知识检索': <Database className="w-4 h-4" />,
  '推理分析': <Brain className="w-4 h-4" />,
  '配方设计': <Sigma className="w-4 h-4" />,
  '生成回答': <FileText className="w-4 h-4" />,
}

// ═══════════════════════════════
// 算法徽章组件
// ═══════════════════════════════

function AlgorithmBadge({ algorithm, confidence }: {
  algorithm: AlgorithmType; confidence?: number
}) {
  const cfg = ALGORITHM_CONFIG[algorithm]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.color} ${cfg.bgColor}`}>
      {cfg.icon}
      <span>{cfg.label}</span>
      {confidence !== undefined && (
        <span className="opacity-70">{(confidence * 100).toFixed(0)}%</span>
      )}
    </span>
  )
}

// ═══════════════════════════════
// 置信度进度条
// ═══════════════════════════════

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-slate-400'
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 w-6 text-right">{pct}%</span>
    </div>
  )
}

// ═══════════════════════════════
// 步骤卡片
// ═══════════════════════════════

function StepCard({
  step, isLast, isExpanded, onToggle,
}: {
  step: SidebarStepV4; isLast: boolean
  isExpanded: boolean; onToggle: () => void
}) {
  const isComplete = step.status === 'complete'
  const isProcessing = step.status === 'thinking'
  const isError = step.status === 'error'
  const algorithm = step.algorithm || STEP_ALGORITHM[step.step] || 'rule-engine'

  return (
    <div className="relative">
      {/* 连接线 */}
      {!isLast && (
        <div className={`absolute left-3 top-7 bottom-0 w-0.5
          ${isComplete ? 'bg-gradient-to-b from-primary-300 to-primary-100 dark:from-primary-700 dark:to-primary-900'
                       : 'bg-gray-200 dark:bg-gray-700'}`}
        />
      )}

      <div className="relative flex items-start gap-2.5 pb-1">
        {/* 状态图标 */}
        <div className={`
          flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
          transition-all duration-300 ring-2 ring-offset-1
          ${isComplete ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white ring-primary-200 dark:ring-primary-800'
            : isProcessing ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white ring-amber-200 dark:ring-amber-800 animate-pulse'
            : isError ? 'bg-gradient-to-br from-red-400 to-red-500 text-white ring-red-200 dark:ring-red-800'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 ring-gray-200 dark:ring-gray-700'}
        `}>
          {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" />
            : isProcessing ? <Loader2 className="w-3 h-3 animate-spin" />
            : isError ? <span className="text-xs font-bold">!</span>
            : STEP_ICONS[step.step] || <Clock className="w-3 h-3" />}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0 pb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={onToggle}
              className="text-xs font-semibold text-gray-800 dark:text-gray-200 hover:text-primary-600 transition-colors"
            >
              {step.step}
            </button>
            {/* 算法标签 */}
            <AlgorithmBadge algorithm={algorithm} confidence={step.confidence} />
            {isProcessing && (
              <span className="text-[10px] text-amber-500 font-medium animate-pulse">思考中...</span>
            )}
            {step.detail && (
              <button onClick={onToggle} className="ml-auto">
                {isExpanded ? <ChevronDown className="w-3 h-3 text-gray-400" />
                            : <ChevronRight className="w-3 h-3 text-gray-400" />}
              </button>
            )}
          </div>

          {/* 置信度进度条 */}
          {step.confidence !== undefined && isComplete && (
            <ConfidenceBar value={step.confidence} />
          )}

          <p className={`text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2
            ${isProcessing ? 'animate-pulse' : ''}`}
          >
            {step.content}
          </p>

          {/* 展开详情 */}
          {isExpanded && step.detail && (
            <div className="mt-1.5 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-100
              dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-400 whitespace-pre-wrap"
            >
              {step.detail}
            </div>
          )}

          {/* 子步骤 */}
          {step.subSteps && step.subSteps.length > 0 && (
            <div className="mt-2 ml-2 pl-2 border-l-2 border-gray-200 dark:border-gray-700 space-y-1">
              {step.subSteps.map((sub, j) => (
                <div key={j} className="flex items-start gap-1.5">
                  <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0
                    ${sub.status === 'complete' ? 'bg-emerald-400'
                      : sub.status === 'thinking' ? 'bg-amber-400 animate-pulse'
                      : 'bg-gray-300'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                        {sub.step}
                      </span>
                      {sub.algorithm && <AlgorithmBadge algorithm={sub.algorithm} />}
                    </div>
                    <p className="text-[10px] text-gray-400 line-clamp-1">{sub.content}</p>
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

  if (!isVisible) return null

  // 算法筛选按钮
  const algorithms: Array<{ key: AlgorithmType | 'all'; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'hybrid-nlp', label: 'NLP' },
    { key: 'llm', label: 'LLM' },
    { key: 'bayesian', label: '贝叶斯' },
    { key: 'rule-engine', label: '规则' },
  ]

  return (
    <div className="border-l border-gray-200 dark:border-gray-700 bg-gray-50/50
      dark:bg-gray-900/50 w-80 flex-shrink-0 overflow-y-auto
      transition-all duration-300 hidden xl:block"
    >
      <div className="p-3 space-y-3">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <button onClick={onToggle} className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Cpu className="w-4 h-4 text-primary-500" />
            <span>AI 思考过程</span>
            {isThinking && <Loader2 className="w-3.5 h-3.5 text-primary-500 animate-spin" />}
          </button>
          <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">
            {stepCounts.complete}/{stepCounts.total}
          </span>
        </div>

        {/* 算法筛选器 */}
        {steps.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {algorithms.map(a => (
              <button key={a.key}
                onClick={() => setFilterAlgorithm(a.key)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors
                  ${filterAlgorithm === a.key
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* 空状态 */}
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

        {/* 步骤列表 */}
        <div className="space-y-1">
          {filteredSteps.map((step, i) => (
            <StepCard
              key={step.step}
              step={step}
              isLast={i === filteredSteps.length - 1}
              isExpanded={expandedSteps.has(step.step)}
              onToggle={() => toggleStep(step.step)}
            />
          ))}
        </div>

        {/* 算法统计 */}
        {steps.length > 0 && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-[10px] text-gray-400 font-medium mb-1">算法使用统计</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(ALGORITHM_CONFIG).map(([key, cfg]) => {
                const count = steps.filter(s =>
                  (s.algorithm || STEP_ALGORITHM[s.step] || 'rule-engine') === key
                ).length
                if (count === 0) return null
                return (
                  <span key={key}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${cfg.color} ${cfg.bgColor}`}
                  >
                    {cfg.icon}
                    {cfg.label}
                    <span className="font-mono">{count}</span>
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
