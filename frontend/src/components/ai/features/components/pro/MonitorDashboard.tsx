/**
 * MonitorDashboard — AI 模型调用实时监控面板
 *
 * 展示 LLM 调用的实时指标数据，包括：
 * - 顶部状态栏：整体健康指示器 + 调用总数 + 最后刷新时间
 * - 核心指标卡片：成功率 / 平均延迟 / Token总量 / 回退率
 * - 延迟分布图：P50/P95/P99 条形对比
 * - 错误分类：彩色标签列表
 * - Provider 状态网格：各 provider 状态卡片
 * - 活动告警列表：按 severity 着色
 * - 底部操作栏：自动刷新开关 + 手动刷新 + 查看日志
 *
 * 数据来源: GET /api/v1/ai/metrics
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Activity,
  BarChart3,
  Clock,
  Coins,
  Bell,
  RefreshCw,
  AlertTriangle,
  Shield,
  Server,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Zap,
  TrendingUp,
  WifiOff,
} from 'lucide-react'

// ── 类型定义 ──────────────────────────────────────────────

export interface MetricsData {
  window_seconds: number
  total_calls: number
  success_rate: number
  error_rate: number
  latency_p50: number
  latency_p95: number
  latency_p99: number
  avg_latency_ms: number
  tokens_total: number
  fallback_rate: number
  error_breakdown: Record<string, number>
  provider_breakdown: Record<string, { success_rate: number; avg_latency_ms: number; calls: number }>
}

export interface AlertData {
  rule_id: string
  name: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  timestamp: string
}

interface MetricsResponse {
  metrics: MetricsData
  alerts: AlertData[]
  recent_alerts: AlertData[]
  collected_at: string
}

export interface MonitorDashboardProps {
  autoRefresh?: boolean
  refreshInterval?: number
}

// ── 常量 ──────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; border: string; icon: typeof AlertTriangle }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', icon: XCircle },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: AlertTriangle },
  info: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', icon: AlertCircle },
}

const ERROR_COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-yellow-500',
  'bg-purple-500', 'bg-pink-500', 'bg-cyan-500',
  'bg-emerald-500', 'bg-indigo-500', 'bg-teal-500',
]

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return '--:--:--'
  }
}

function getHealthStatus(metrics: MetricsData | null): { label: string; color: string; dotClass: string } {
  if (!metrics) return { label: '等待数据...', color: 'text-gray-400', dotClass: 'bg-gray-500 animate-pulse' }
  if (metrics.total_calls === 0) return { label: '暂无调用记录', color: 'text-gray-400', dotClass: 'bg-gray-500' }

  const critAlertsExist = false // 由外部 alerts 判断
  if (metrics.success_rate < 0.8 || metrics.error_rate > 0.2) {
    return { label: '服务异常', color: 'text-red-400', dotClass: 'bg-red-500' }
  }
  if (metrics.success_rate < 0.95 || metrics.fallback_rate > 0.3) {
    return { label: '服务降级', color: 'text-amber-400', dotClass: 'bg-amber-500' }
  }
  return { label: '运行正常', color: 'text-emerald-400', dotClass: 'bg-emerald-500' }
}

// ── 子组件 ────────────────────────────────────────────────

/** 骨架屏加载动画 */
function SkeletonGrid({ cols = 4 }: { cols?: number }) {
  return (
    <div className={`grid grid-cols-${cols} gap-4`}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-5 animate-pulse">
          <div className="h-3 w-20 rounded bg-white/10 mb-3" />
          <div className="h-8 w-16 rounded bg-white/10 mb-2" />
          <div className="h-2 w-full rounded bg-white/10" />
        </div>
      ))}
    </div>
  )
}

/** 核心指标卡片 */
function MetricCard({
  icon: Icon, label, value, unit, subText, color, trend,
}: {
  icon: typeof Activity
  label: string
  value: string | number
  unit?: string
  subText?: string
  color: string
  trend?: 'up' | 'down' | 'stable'
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5 hover:border-white/20 transition-colors duration-300">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className={color} />
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-white tabular-nums transition-all duration-500">{value}</span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
      {(subText || trend) && (
        <div className={`mt-2 flex items-center gap-1 text-xs ${trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-emerald-400' : 'text-gray-500'}`}>
          {trend === 'up' && <TrendingUp size={12} />}
          {trend === 'down' && <TrendingUp size={12} className="rotate-180" />}
          {subText}
        </div>
      )}
    </div>
  )
}

/** 延迟分布条形图 */
function LatencyBars({ p50, p95, p99 }: { p50: number; p95: number; p99: number }) {
  const maxVal = Math.max(p99, 1)
  return (
    <div className="space-y-3">
      {[
        { label: 'P50', value: p50, color: 'bg-emerald-500' },
        { label: 'P95', value: p95, color: 'bg-amber-500' },
        { label: 'P99', value: p99, color: 'bg-red-500' },
      ].map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-8 shrink-0 font-mono">{item.label}</span>
          <div className="flex-1 h-5 rounded-md bg-white/5 overflow-hidden relative">
            <div
              className={`h-full ${item.color} transition-all duration-700 ease-out rounded-md`}
              style={{ width: `${Math.min((item.value / maxVal) * 100, 100)}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-mono text-white/80">
              {item.value > 0 ? `${item.value.toFixed(0)}ms` : '--'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** 错误分类标签 */
function ErrorBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const entries = Object.entries(breakdown)
  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
        <CheckCircle2 size={16} className="text-emerald-500/50" />
        <span>无错误记录</span>
      </div>
    )
  }

  const total = entries.reduce((_, [, v]) => _ + v, 0)

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([code, count], i) => {
        const pct = ((count / total) * 100).toFixed(0)
        return (
          <span
            key={code}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white ${ERROR_COLORS[i % ERROR_COLORS.length]}`}
          >
            <span>{code}</span>
            <span className="opacity-70">×{count}</span>
            <span className="opacity-50">({pct}%)</span>
          </span>
        )
      })}
    </div>
  )
}

/** Provider 状态卡片 */
function ProviderGrid({ breakdown }: { breakdown: MetricsData['provider_breakdown'] }) {
  const entries = Object.entries(breakdown)
  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-6 justify-center">
        <Server size={16} />
        <span>暂无 Provider 数据</span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {entries.map(([name, info]) => {
        const isHealthy = info.success_rate >= 0.9
        return (
          <div
            key={name}
            className={`rounded-lg border p-3.5 transition-colors duration-200 ${
              isHealthy ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Server size={14} className={isHealthy ? 'text-emerald-400' : 'text-red-400'} />
                <span className="text-sm font-semibold text-white">{name}</span>
              </div>
              {isHealthy ? (
                <Shield size={14} className="text-emerald-400" />
              ) : (
                <WifiOff size={14} className="text-red-400" />
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-gray-500 block">调用</span>
                <span className="text-white font-mono tabular-nums">{info.calls}</span>
              </div>
              <div>
                <span className="text-gray-500 block">成功率</span>
                <span className={`font-mono tabular-nums ${isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(info.success_rate * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">延迟</span>
                <span className="text-white font-mono tabular-nums">{info.avg_latency_ms.toFixed(0)}ms</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** 告警列表项 */
function AlertItem({ alert }: { alert: AlertData }) {
  const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.info
  const Icon = cfg.icon

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.border} ${cfg.bg} transition-colors`}>
      <Icon size={16} className={`${cfg.text} mt-0.5 shrink-0`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-xs font-bold uppercase tracking-wider ${cfg.text}`}>{alert.severity}</span>
          <span className="text-xs text-gray-500 font-mono">{formatTime(alert.timestamp)}</span>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">{alert.message}</p>
      </div>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────

export function MonitorDashboard({
  autoRefresh = true,
  refreshInterval = 10000,
}: MonitorDashboardProps) {
  const [data, setData] = useState<MetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [autoOn, setAutoOn] = useState(autoRefresh)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await fetch('/api/v1/ai/metrics')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: MetricsResponse = await res.json()
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
      if (isManual) setRefreshing(false)
    }
  }, [])

  // 初始加载 + 自动刷新
  useEffect(() => {
    fetchData()

    if (autoOn) {
      timerRef.current = setInterval(() => fetchData(), refreshInterval)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchData, autoOn, refreshInterval])

  // 切换自动刷新
  const toggleAuto = () => {
    setAutoOn((prev) => {
      if (prev && timerRef.current) clearInterval(timerRef.current)
      if (!prev) timerRef.current = setInterval(() => fetchData(), refreshInterval)
      return !prev
    })
  }

  // 错误重试视图
  if (error && !data) {
    return (
      <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-8 text-center">
        <XCircle size={32} className="mx-auto mb-3 text-red-400" />
        <p className="text-red-400 mb-4">加载指标数据失败: {error}</p>
        <button
          onClick={() => { setError(null); setLoading(true); fetchData() }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors text-sm"
        >
          <RefreshCw size={14} /> 重试
        </button>
      </div>
    )
  }

  const metrics = data?.metrics ?? null
  const alerts = data?.alerts ?? []
  const recentAlerts = data?.recent_alerts ?? []
  const health = getHealthStatus(metrics)
  const hasCritical = alerts.some((a) => a.severity === 'critical')

  return (
    <div className="space-y-5">
      {/* ══ 顶部状态栏 ══ */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white/[0.03] border border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={`relative`}>
            <div className={`w-3 h-3 rounded-full ${health.dotClass}`} />
            {hasCritical && (
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-red-500 animate-ping opacity-75" />
            )}
          </div>
          <span className={`font-semibold ${health.color}`}>{health.label}</span>
          {metrics && metrics.total_calls > 0 && (
            <>
              <span className="text-gray-600">|</span>
              <span className="text-sm text-gray-400">
                <Activity size={13} className="inline mr-1 -mt-0.5" />
                总调用 <strong className="text-white tabular-nums">{metrics.total_calls}</strong> 次
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {data && (
            <span className="font-mono">
              <Clock size={12} className="inline mr-1 -mt-0.5" />
              更新于 {formatTime(data.collected_at)}
            </span>
          )}
        </div>
      </div>

      {/* 加载骨架屏 */}
      {loading && !data && <SkeletonGrid cols={4} />}

      {/* ══ 核心指标卡片 (4列) ══ */}
      {!loading && metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={Shield}
            label="成功率"
            value={(metrics.success_rate * 100).toFixed(1)}
            unit="%"
            color={metrics.success_rate >= 0.95 ? 'text-emerald-400' : metrics.success_rate >= 0.8 ? 'text-amber-400' : 'text-red-400'}
            subText={`${metrics.total_calls} 次调用中 ${Math.round(metrics.total_calls * metrics.success_rate)} 成功`}
            trend={metrics.success_rate >= 0.95 ? 'stable' : 'down'}
          />
          <MetricCard
            icon={Clock}
            label="平均延迟"
            value={metrics.avg_latency_ms.toFixed(0)}
            unit="ms"
            color={metrics.avg_latency_ms <= 2000 ? 'text-emerald-400' : metrics.avg_latency_ms <= 10000 ? 'text-amber-400' : 'text-red-400'}
            trend={metrics.avg_latency_ms <= 2000 ? 'stable' : 'up'}
          />
          <MetricCard
            icon={Coins}
            label="Token 用量"
            value={formatTokens(metrics.tokens_total)}
            color="text-purple-400"
          />
          <MetricCard
            icon={Zap}
            label="回退率"
            value={(metrics.fallback_rate * 100).toFixed(1)}
            unit="%"
            color={metrics.fallback_rate <= 0.1 ? 'text-emerald-400' : metrics.fallback_rate <= 0.3 ? 'text-amber-400' : 'text-red-400'}
            subText={metrics.fallback_rate > 0.1 ? '部分请求使用降级模型' : undefined}
            trend={metrics.fallback_rate <= 0.1 ? 'stable' : 'up'}
          />
        </div>
      )}

      {/* ══ 中间区域: 延迟 + 错误 + Provider ══ */}
      {!loading && metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 延迟分布 */}
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <BarChart3 size={15} className="text-cyan-400" />
              延迟分布
            </h3>
            <LatencyBars p50={metrics.latency_p50} p95={metrics.latency_p95} p99={metrics.latency_p99} />
          </div>

          {/* 错误分类 */}
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <AlertTriangle size={15} className="text-orange-400" />
              错误分类
            </h3>
            <ErrorBreakdown breakdown={metrics.error_breakdown} />
          </div>

          {/* Provider 状态 */}
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <Server size={15} className="text-violet-400" />
              Provider 状态
            </h3>
            <ProviderGrid breakdown={metrics.provider_breakdown} />
          </div>
        </div>
      )}

      {/* ══ 活动告警列表 ══ */}
      <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <Bell size={15} className="text-rose-400" />
          活动告警
          {alerts.length > 0 && (
            <span className="ml-auto text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full tabular-nums">
              {alerts.length}
            </span>
          )}
          {recentAlerts.length > 0 && alerts.length === 0 && (
            <span className="ml-auto text-xs text-gray-500">
              最近 {recentAlerts.length} 条历史告警
            </span>
          )}
        </h3>

        {alerts.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {alerts.map((a) => <AlertItem key={a.rule_id} alert={a} />)}
          </div>
        ) : recentAlerts.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {recentAlerts.map((a) => <AlertItem key={`${a.rule_id}-${a.timestamp}`} alert={a} />)}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
            <Bell size={16} className="opacity-30" />
            <span>无活动告警 — 一切正常</span>
          </div>
        )}
      </div>

      {/* ══ 底部操作栏 ══ */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.02] border border-white/5 px-5 py-3">
        <div className="flex items-center gap-3">
          {/* 自动刷新开关 */}
          <button
            onClick={toggleAuto}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
              autoOn ? 'bg-emerald-600' : 'bg-gray-600'
            }`}
            aria-label="切换自动刷新"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                autoOn ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-xs text-gray-400">
            自动刷新 {autoOn ? `(${refreshInterval / 1000}s)` : '(已关闭)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* 手动刷新 */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-40"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            刷新
          </button>

          {/* 预留: 查看详细日志 */}
          <span className="text-xs text-gray-600 cursor-default select-none">
            · 查看详细日志 (预留)
          </span>
        </div>
      </div>
    </div>
  )
}

export default MonitorDashboard
