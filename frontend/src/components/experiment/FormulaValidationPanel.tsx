/**
 * 配方在线验证面板
 *
 * 功能：
 * - 一键触发配方全流程验证（无需人工多次干预）
 * - 实时进度可视化（WebSocket / 轮询）
 * - 各阶段评分卡片展示
 * - 预测值 vs 实验值对比表
 * - 验证报告与建议
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2,
  Play, RotateCcw, FlaskConical, ShieldCheck, Activity,
  Thermometer, Zap, Network, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, FileText,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { experimentApi, type FormulaValidationResult, type ValidationStageResult, type PredictionComparison } from '@/api/experiment'
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'

// ── 阶段配置 ──────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<string, {
  label: string
  icon: typeof FlaskConical
  color: string
  description: string
  weight: number
}> = {
  safety_check: {
    label: '安全性检查',
    icon: ShieldCheck,
    color: 'text-rose-500',
    description: 'GB 16740 / ADI / UL 阈值比对',
    weight: 0.25,
  },
  compatibility_check: {
    label: '兼容性检测',
    icon: Network,
    color: 'text-amber-500',
    description: '4层架构成分相互作用分析',
    weight: 0.20,
  },
  efficacy_prediction: {
    label: '功效预测',
    icon: Activity,
    color: 'text-blue-500',
    description: 'PopPK/PD 模型模拟',
    weight: 0.20,
  },
  stability_prediction: {
    label: '稳定性预测',
    icon: Thermometer,
    color: 'text-purple-500',
    description: '货架期与降解速率模拟',
    weight: 0.15,
  },
  taste_prediction: {
    label: '风味评分',
    icon: Zap,
    color: 'text-pink-500',
    description: '感官特性预测',
    weight: 0.10,
  },
  synergy_analysis: {
    label: '协同效应分析',
    icon: Network,
    color: 'text-cyan-500',
    description: '网络药理学预测',
    weight: 0.10,
  },
  data_comparison: {
    label: '数据对比',
    icon: TrendingUp,
    color: 'text-emerald-500',
    description: '预测值 vs 实测值对比',
    weight: 0.10,
  },
}

// ── 结论样式 ──────────────────────────────────────────────────────────────

const OUTCOME_CONFIG = {
  passed: { label: '通过', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700', icon: CheckCircle2 },
  conditional: { label: '有条件通过', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700', icon: AlertTriangle },
  failed: { label: '未通过', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-300 dark:border-rose-700', icon: XCircle },
  inconclusive: { label: '待验证', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700', icon: Minus },
} as const

// ═══════════════════════════════════════════════════════════
// 进度环组件
// ═══════════════════════════════════════════════════════════

function ProgressRing({ percent, size = 48, strokeWidth = 4 }: { percent: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke="currentColor" strokeWidth={strokeWidth}
        fill="none" className="text-neutral-200 dark:text-neutral-700"
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke="currentColor" strokeWidth={strokeWidth} fill="none"
        strokeDasharray={circumference} strokeDashoffset={offset}
        className="transition-all duration-500 ease-out"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════
// 阶段卡片
// ═══════════════════════════════════════════════════════════

function StageCard({ result }: { result: ValidationStageResult }) {
  const config = STAGE_CONFIG[result.stage] || {
    label: result.stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    icon: FlaskConical,
    color: 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]',
    description: '',
    weight: 0,
  }
  const Icon = config.icon
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn(
      'rounded-xl border transition-all duration-200',
      result.success
        ? result.passed
          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'
          : 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10'
        : 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10',
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        {/* 状态图标 */}
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          result.success
            ? result.passed
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
            : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400',
        )}>
          {result.success
            ? result.passed
              ? <CheckCircle2 size={16} />
              : <AlertTriangle size={16} />
            : <XCircle size={16} />}
        </div>

        {/* 阶段信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-neutral-900 dark:text-white">{config.label}</span>
            {config.weight > 0 && (
              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">×{config.weight}</span>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{config.description}</p>
        </div>

        {/* 分数 */}
        <div className="text-right flex-shrink-0">
          <div className={cn(
            'text-lg font-bold',
            result.score >= 70 ? 'text-emerald-600 dark:text-emerald-400' :
            result.score >= 50 ? 'text-amber-600 dark:text-amber-400' :
            'text-rose-600 dark:text-rose-400',
          )}>
            {result.score.toFixed(0)}
          </div>
          <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{result.latency_ms.toFixed(0)}ms</div>
        </div>

        {/* 展开/折叠 */}
        {expanded ? <ChevronUp size={16} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex-shrink-0" /> : <ChevronDown size={16} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex-shrink-0" />}
      </button>

      {/* 展开详情 */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-neutral-200 dark:border-neutral-700 pt-2">
          {config.description && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{config.description}</p>
          )}
          {result.warnings.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">警告</p>
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-neutral-600 dark:text-neutral-400 pl-2">⚠ {w}</p>
              ))}
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">错误</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-neutral-600 dark:text-neutral-400 pl-2">✗ {e}</p>
              ))}
            </div>
          )}
          {Object.keys(result.details).length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(result.details).slice(0, 6).map(([k, v]) => (
                <div key={k} className="text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400">{k}: </span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">
                    {typeof v === 'number' ? v.toFixed(2) : String(v)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 对比图表
// ═══════════════════════════════════════════════════════════

function ComparisonChart({ comparisons }: { comparisons: PredictionComparison[] }) {
  if (comparisons.length === 0) return null

  const chartData = comparisons
    .filter(c => c.measured_value !== undefined)
    .map(c => ({
      name: c.parameter,
      predicted: c.predicted_value,
      measured: c.measured_value,
      within_tolerance: c.within_tolerance,
    }))

  if (chartData.length === 0) return null

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-700" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--neutral-900)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Bar dataKey="predicted" name="预测值" fill="var(--color-primary-500)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="measured" name="实测值" fill="var(--emerald-500)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// 主面板组件
// ═══════════════════════════════════════════════════════════

interface FormulaValidationPanelProps {
  formulaId: number
  formulaName: string
  experimentId?: number
  onClose?: () => void
}

export function FormulaValidationPanel({ formulaId, formulaName, experimentId, onClose }: FormulaValidationPanelProps) {
  const { addToast } = useToast()
  const qc = useQueryClient()
  const [validationId, setValidationId] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [polling, setPolling] = useState(false)
  const [activeTab, setActiveTab] = useState<'stages' | 'compare' | 'report'>('stages')

  // 查询历史验证记录
  const { data: historyValidations } = useQuery({
    queryKey: ['formula-validations', formulaId],
    queryFn: () => experimentApi.listValidations(formulaId, 5),
    enabled: !!formulaId,
  })

  // 查询当前验证进度
  const { data: progress, refetch: refetchProgress } = useQuery({
    queryKey: ['validation-progress', validationId],
    queryFn: () => validationId ? experimentApi.getValidationProgress(formulaId, validationId) : null,
    enabled: !!validationId && polling,
    refetchInterval: polling ? 2000 : false,
    refetchOnWindowFocus: false,
  })

  // 触发验证
  const triggerMut = useMutation({
    mutationFn: (expId: number | undefined) =>
      experimentApi.triggerValidation(formulaId, {
        experiment_id: expId,
        daily_dosage_g: 10,
        target_population: 'adult',
        body_weight_kg: 65,
      }),
    onSuccess: (data) => {
      setValidationId(data.validation_id)
      setIsRunning(true)
      setPolling(true)
      addToast({ type: 'success', message: `验证已启动，ID: ${data.validation_id}` })
    },
    onError: (err: any) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || '验证启动失败' })
    },
  })

  // 重试
  const retryMut = useMutation({
    mutationFn: (vid: string) => experimentApi.retryValidation(formulaId, vid),
    onSuccess: (data) => {
      setValidationId(data.validation_id)
      setIsRunning(true)
      setPolling(true)
      addToast({ type: 'success', message: '验证重试已启动' })
    },
    onError: () => addToast({ type: 'error', message: '重试失败' }),
  })

  // 轮询停止条件
  useEffect(() => {
    if (!progress) return
    if (progress.status === 'completed' || progress.status === 'failed') {
      setPolling(false)
      setIsRunning(false)
      qc.invalidateQueries({ queryKey: ['formula-validations', formulaId] })
    }
  }, [progress, formulaId, qc])

  const handleStartValidation = () => {
    triggerMut.mutate(experimentId)
  }

  const handleRetry = () => {
    if (validationId) {
      retryMut.mutate(validationId)
    }
  }

  // 获取最新的完整验证结果
  const latestResult = historyValidations?.[0]
  const result = latestResult ?? null

  return (
    <div className="space-y-4 animate-page-enter">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            配方在线验证
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {formulaName} · 一键全流程验证 · 无需人工多次干预
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" icon={<XCircle size={14} />} onClick={onClose}>
            关闭
          </Button>
        )}
      </div>

      {/* 操作栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="primary"
          icon={isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          disabled={isRunning || triggerMut.isPending}
          onClick={handleStartValidation}
        >
          {isRunning ? '验证运行中...' : '一键验证'}
        </Button>

        {validationId && (
          <Button
            variant="outline"
            icon={<RotateCcw size={14} />}
            disabled={retryMut.isPending || !isRunning}
            onClick={handleRetry}
          >
            重试失败阶段
          </Button>
        )}

        {latestResult && (
          <Badge
            variant={latestResult.outcome === 'passed' ? 'success' : latestResult.outcome === 'conditional' ? 'warning' : 'destructive'}
            className="ml-auto"
          >
            {OUTCOME_CONFIG[latestResult.outcome as keyof typeof OUTCOME_CONFIG]?.label ?? latestResult.outcome}
            · 总分 {latestResult.overall_score.toFixed(0)}
          </Badge>
        )}
      </div>

      {/* 进度条 */}
      {isRunning && progress && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>{progress.message}</span>
            <span>{progress.progress_percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500"
              style={{ width: `${progress.progress_percent}%` }}
            />
          </div>
          <div className="flex items-center gap-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            <Loader2 size={12} className="animate-spin" />
            <span>阶段 {progress.stage_index}/{progress.total_stages} · 当前: {progress.current_stage?.replace(/_/g, ' ')}</span>
          </div>
        </div>
      )}

      {/* Tab 切换 */}
      <div className="flex gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 w-fit">
        {([
          { key: 'stages', label: '验证阶段', icon: FlaskConical },
          { key: 'compare', label: '预测对比', icon: TrendingUp },
          { key: 'report', label: '验证报告', icon: FileText },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              activeTab === tab.key
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300',
            )}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 阶段结果 */}
      {activeTab === 'stages' && (
        <div className="space-y-2">
          {result?.stages && result.stages.length > 0 ? (
            result!.stages.map((s, i) => (
              <StageCard key={i} result={s} />
            ))
          ) : isRunning && progress ? (
            // 运行中显示占位
            Object.entries(STAGE_CONFIG).map(([key, cfg], i) => (
              <div
                key={key}
                className={cn(
                  'rounded-xl border p-3 flex items-center gap-3',
                  progress.current_stage === key
                    ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10'
                    : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50',
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  progress.current_stage === key
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 animate-pulse'
                    : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400',
                )}>
                  {progress.current_stage === key
                    ? <Loader2 size={16} className="animate-spin" />
                    : <cfg.icon size={16} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-neutral-900 dark:text-white">{cfg.label}</span>
                    <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">×{cfg.weight}</span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{cfg.description}</p>
                </div>
                {progress.current_stage === key && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">执行中...</span>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-neutral-400 dark:text-neutral-400">
              <FlaskConical size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">点击上方「一键验证」开始全流程验证</p>
              <p className="text-xs mt-1">系统将自动执行安全性检查→兼容性检测→功效预测→稳定性预测→风味评分→协同效应分析</p>
            </div>
          )}
        </div>
      )}

      {/* 预测对比 */}
      {activeTab === 'compare' && (
        <div className="space-y-4">
          {result?.comparisons && result.comparisons.length > 0 ? (
            <>
              <ComparisonChart comparisons={result!.comparisons} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400">参数</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400">预测值</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400">实测值</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400">偏差</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400">容差内</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result!.comparisons.map((c, i) => (
                      <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800">
                        <td className="py-2 px-3 font-medium text-neutral-900 dark:text-white">{c.parameter}</td>
                        <td className="py-2 px-3 font-mono text-neutral-700 dark:text-neutral-300">
                          {c.predicted_value.toFixed(2)} <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{c.unit}</span>
                        </td>
                        <td className="py-2 px-3 font-mono text-neutral-700 dark:text-neutral-300">
                          {c.measured_value?.toFixed(2) ?? '-'}
                        </td>
                        <td className={cn(
                          'py-2 px-3 font-mono',
                          c.within_tolerance ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                        )}>
                          {c.deviation_percent.toFixed(1)}%
                        </td>
                        <td className="py-2 px-3">
                          {c.within_tolerance
                            ? <CheckCircle2 size={14} className="text-emerald-500" />
                            : <XCircle size={14} className="text-rose-500" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-neutral-400 dark:text-neutral-400">
              <TrendingUp size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                {result
                  ? result.comparisons.length === 0
                    ? '暂无对比数据，请先录入实验数据或关联已有实验'
                    : '无预测-实测对比数据'
                  : '运行验证后此处将展示预测值与实测值的对比'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 验证报告 */}
      {activeTab === 'report' && (
        <div className="space-y-4">
          {latestResult ? (
            <>
              {/* 总览卡片 */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <ProgressRing percent={result!.overall_score} size={80} strokeWidth={6} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-neutral-900 dark:text-white">
                          {result!.overall_score.toFixed(0)}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border',
                          OUTCOME_CONFIG[result!.outcome as keyof typeof OUTCOME_CONFIG]?.color,
                        )}>
                          {React.createElement(OUTCOME_CONFIG[result!.outcome as keyof typeof OUTCOME_CONFIG]?.icon || Minus, { size: 12 })}
                          {OUTCOME_CONFIG[result!.outcome as keyof typeof OUTCOME_CONFIG]?.label}
                        </span>
                        <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                          耗时 {result!.total_latency_ms.toFixed(0)}ms
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        已通过 {result!.stages.filter(s => s.passed).length}/{result!.stages.length} 个验证阶段
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 建议 */}
              {result?.recommendations && result.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                    <FileText size={14} />
                    验证建议
                  </h4>
                  {result!.recommendations.map((r, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-700 dark:text-neutral-300"
                    >
                      {r}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-neutral-400 dark:text-neutral-400">
              <FileText size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">验证完成后将在此处展示完整报告</p>
            </div>
          )}
        </div>
      )}

      {/* 历史验证记录 */}
      {historyValidations && historyValidations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">历史验证记录</h4>
          <div className="space-y-2">
            {historyValidations.map((v, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700"
              >
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                  OUTCOME_CONFIG[v.outcome as keyof typeof OUTCOME_CONFIG]?.color,
                )}>
                  {v.outcome}
                </span>
                <span className="text-sm text-neutral-700 dark:text-neutral-300 font-medium">
                  评分 {v.overall_score.toFixed(0)}
                </span>
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-auto">
                  {v.validation_id}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FormulaValidationPanel
