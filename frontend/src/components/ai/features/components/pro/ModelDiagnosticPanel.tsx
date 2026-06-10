/**
 * ModelDiagnosticPanel — AI 模型诊断面板组件
 *
 * 展示后端返回的三级检测结果（配置/连通性/能力验证）。
 * 支持：
 * - 整体健康度分数 + 颜色指示（绿≥80 / 黄≥50 / 红<50）
 * - 三级分组展示：配置检查(C-xx) / 连通性检查(N-xx) / 能力验证(P-xx)
 * - fail/warn 项可展开查看建议
 * - 骨架屏加载动画（3 个脉冲条）
 * - 空状态引导文案
 * - 深色主题适配
 */
import React, { useState, useMemo } from 'react'
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  MinusCircle,
  RefreshCw,
  Activity,
  Wrench,
  Globe,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

// ── 类型定义 ──────────────────────────────────────────────

export interface DiagnosticCheck {
  check_id: string
  name: string
  status: 'pass' | 'warn' | 'fail' | 'skip'
  detail: string
  suggestion: string
  fixable: boolean
  auto_fix_available: boolean
}

export interface DiagnosticReport {
  overall: 'healthy' | 'degraded' | 'critical'
  score: number
  timestamp_iso: string
  checks: DiagnosticCheck[]
}

export interface ModelDiagnosticPanelProps {
  report: DiagnosticReport | null
  isDiagnosing: boolean
  onRunDiagnostic: () => void
}

// ── 常量 ──────────────────────────────────────────────────

const LEVEL_CONFIG = [
  { prefix: 'C-', label: '配置检查', icon: Wrench, emoji: '🔧', color: 'text-amber-500' },
  { prefix: 'N-', label: '连通性检查', icon: Globe, emoji: '🌐', color: 'text-blue-500' },
  { prefix: 'P-', label: '能力验证', icon: Zap, emoji: '⚡', color: 'text-purple-500' },
] as const

const STATUS_ICON_MAP = {
  pass: { Icon: CheckCircle, className: 'text-emerald-500', label: '通过' },
  warn: { Icon: AlertTriangle, className: 'text-amber-500', label: '警告' },
  fail: { Icon: XCircle, className: 'text-red-500', label: '失败' },
  skip: { Icon: MinusCircle, className: 'text-gray-400', label: '跳过' },
} as const

// ── 子组件：健康度卡片 ────────────────────────────────────

function HealthScoreCard({ score, overall }: { score: number; overall: DiagnosticReport['overall'] }) {
  const colorConfig =
    score >= 80
      ? { ring: 'ring-emerald-500/30', text: 'text-emerald-400', bg: 'bg-emerald-500/10', label: '正常' }
      : score >= 50
        ? { ring: 'ring-amber-500/30', text: 'text-amber-400', bg: 'bg-amber-500/10', label: '降级' }
        : { ring: 'ring-red-500/30', text: 'text-red-400', bg: 'bg-red-500/10', label: '严重' }

  const overallLabel = overall === 'healthy' ? '正常' : overall === 'degraded' ? '降级' : '严重'

  return (
    <div className={`rounded-xl border ${colorConfig.ring} bg-white dark:bg-gray-800 p-6 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">整体健康度</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-5xl font-bold tracking-tight ${colorConfig.text}`}>{score}</span>
            <span className="text-lg text-gray-400">/ 100</span>
          </div>
          <p className={`mt-1 text-sm font-medium ${colorConfig.text}`}>{overallLabel}</p>
        </div>
        <Activity className={`h-12 w-12 ${colorConfig.text} opacity-60`} strokeWidth={1.5} />
      </div>
    </div>
  )
}

// ── 子组件：检测项 ────────────────────────────────────────

function CheckItem({ check }: { check: DiagnosticCheck }) {
  const [expanded, setExpanded] = useState(false)
  const statusInfo = STATUS_ICON_MAP[check.status]
  const StatusIcon = statusInfo.Icon
  const isExpandable = check.status === 'fail' || check.status === 'warn'

  return (
    <div
      className={`group rounded-lg border transition-colors ${
        check.status === 'fail'
          ? 'border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20'
          : check.status === 'warn'
            ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20'
            : 'border-gray-100 bg-white dark:border-gray-700/50 dark:bg-gray-800/50'
      }`}
    >
      <button
        type="button"
        onClick={() => isExpandable && setExpanded(!expanded)}
        disabled={!isExpandable}
        className="flex w-full items-start gap-3 p-3 text-left"
      >
        <StatusIcon className={`mt-0.5 h-5 w-5 shrink-0 ${statusInfo.className}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{check.name}</span>
            <span className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
              check.status === 'pass'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                : check.status === 'warn'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                  : check.status === 'fail'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              {statusInfo.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{check.detail}</p>
        </div>
        {isExpandable && (
          expanded
            ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
            : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        )}
      </button>

      {/* 可展开的建议区域 */}
      {isExpandable && expanded && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2 dark:border-gray-700/50">
          <div className="rounded-md bg-gray-50 p-2.5 dark:bg-gray-900/60">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">建议操作</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{check.suggestion || '无可用建议'}</p>
            {(check.fixable || check.auto_fix_available) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {check.fixable && (
                  <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    可手动修复
                  </span>
                )}
                {check.auto_fix_available && (
                  <span className="inline-flex items-center rounded bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:bg-green-900/30 dark:text-green-400">
                    支持自动修复
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 子组件：骨架屏加载 ────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-6 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700/50" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  )
}

// ── 子组件：空状态 ────────────────────────────────────────

function EmptyState({ onRunDiagnostic }: { onRunDiagnostic: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-12 dark:border-gray-700 dark:bg-gray-800">
      <Activity className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" strokeWidth={1} />
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">尚未执行诊断</p>
      <p className="mt-1 max-w-xs text-center text-xs text-gray-400 dark:text-gray-500">
        点击下方按钮运行 AI 模型诊断，检测配置、网络连接和服务能力状态
      </p>
      <button
        type="button"
        onClick={onRunDiagnostic}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
      >
        <RefreshCw className="h-4 w-4" />
        开始诊断
      </button>
    </div>
  )
}

// ── 主组件 ─────────────────────────────────────────────────

export function ModelDiagnosticPanel({
  report,
  isDiagnosing,
  onRunDiagnostic,
}: ModelDiagnosticPanelProps) {
  // 按前缀将检查项分组到三个级别
  const groupedChecks = useMemo(() => {
    if (!report?.checks) return null
    return LEVEL_CONFIG.map((level) => ({
      ...level,
      items: report.checks.filter((c) => c.check_id.startsWith(level.prefix)),
    })).filter((g) => g.items.length > 0)
  }, [report])

  // 格式化时间戳
  const formattedTime = report?.timestamp_iso
    ? new Date(report.timestamp_iso).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null

  // ── 加载中 → 骨架屏 ──
  if (isDiagnosing) {
    return <SkeletonLoader />
  }

  // ── 无报告 → 空状态 ──
  if (!report) {
    return <EmptyState onRunDiagnostic={onRunDiagnostic} />
  }

  // ── 有报告 → 完整面板 ──
  return (
    <div className="space-y-4">
      {/* 健康度卡片 */}
      <HealthScoreCard score={report.score} overall={report.overall} />

      {/* 三级分组 */}
      {groupedChecks &&
        groupedChecks.map((group) => {
          const GroupIcon = group.icon
          return (
            <div key={group.prefix}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <GroupIcon className={`h-4 w-4 ${group.color}`} />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{group.label}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  ({group.items.filter((c) => c.status === 'pass').length}/{group.items.length})
                </span>
              </div>
              <div className="space-y-2">
                {group.items.map((check) => (
                  <CheckItem key={check.check_id} check={check} />
                ))}
              </div>
            </div>
          )
        })}

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-gray-700/50 dark:bg-gray-800/60">
        <button
          type="button"
          onClick={onRunDiagnostic}
          className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-gray-900 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          重新诊断
        </button>
        {formattedTime && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            诊断于 {formattedTime}
          </span>
        )}
      </div>
    </div>
  )
}

export default ModelDiagnosticPanel
