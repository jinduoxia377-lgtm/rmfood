/**
 * useAnalyticsData — 从后端真实 API 拉取分析数据
 *
 * 取代原来完全依赖模拟数据的旧 hook，
 * 将所有 KPI、图表、趋势、活动、过滤器数据对接到
 * backend/app/api/analytics.py 的 REST 端点。
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { logger } from '@/utils/safeLogger'
import api from '@/api/client'

// ─── 类型定义 ────────────────────────────────────────────────

export interface KPIMetric {
  id: string
  name: string
  value: number
  unit: string
  change_percent?: number | null
  change_direction?: 'up' | 'down' | null
  target?: number | null
  trend_data?: Array<{ period: string; value: number; metric: string }>
}

export interface ChartDataItem {
  chart_type: string
  title: string
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string
    fill?: boolean
  }>
}

export interface ActivityItem {
  type: string
  title: string
  timestamp?: string | null
  author?: string | null
}

export interface SystemHealth {
  database_status: string
  avg_response_time_ms: number
  active_connections: number
  error_rate_percent: number
  cpu_usage_percent: number
  memory_usage_percent: number
  disk_usage_percent: number
  cache_hit_rate_percent: number
}

export interface FilterOption {
  value: string
  label: string
}

export interface FilterOptions {
  formula_status: string[]
  experiment_status: string[]
  categories: Array<{ id: string; name: string }>
  users: Array<{ id: string; username: string; full_name: string }>
  time_ranges: FilterOption[]
}

export interface TopEntity {
  id: number | string
  name: string
  comment_count: number
  creator: string | null
  created_at: string | null
}

export interface DashboardResponse {
  timestamp: string
  kpi: KPIMetric[]
  charts: Record<string, ChartDataItem>
  recent_activity: ActivityItem[]
  top_entities: Record<string, TopEntity[]>
  system_health: SystemHealth
  available_filters: FilterOptions
  filters_applied: Record<string, unknown>
}

export interface TrendResponse {
  entity: string
  days: number
  granularity: string
  data_points: number
  data: Array<{ period: string; value: number; metric: string }>
  generated_at: string
}

// ─── 从 KPI 列表中提取快捷字段 ────────────────────────────────

interface StatsSnapshot {
  total_formulas: number
  total_experiments: number
  active_users: number
  data_points: number
  success_rate: number
  avg_processing_time: number
}

function extractStats(kpis: KPIMetric[]): StatsSnapshot {
  const map = new Map(kpis.map(k => [k.id, k]))
  const fmt = (id: string, fallback = 0) => (map.has(id) ? map.get(id)!.value : fallback)
  return {
    total_formulas: fmt('total_formulas', 0),
    total_experiments: fmt('total_experiments', 0),
    active_users: fmt('active_users', 0),
    data_points: fmt('ai_generations', 0),
    success_rate: fmt('published_formulas', 0),
    avg_processing_time: 0,
  }
}

// ─── Hook ────────────────────────────────────────────────────

export interface UseAnalyticsDataOptions {
  /** 自动轮询间隔（毫秒），0 表示关闭 */
  pollInterval?: number
  /** 时间范围过滤器 */
  timeRange?: string
}

export function useAnalyticsData(opts: UseAnalyticsDataOptions = {}) {
  const { pollInterval = 30_000, timeRange = '30d' } = opts

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 单次拉取 — 使用统一的 axios 客户端（自动携带 Cookie / Authorization）
  const fetchDashboard = useCallback(async () => {
    // 取消上一次未完成请求
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const res = await api.get('/analytics/dashboard', {
        params: { time_range: timeRange },
        signal: abortRef.current.signal,
      })
      const data: DashboardResponse = res.data
      setDashboard(data)
      setError(null)
      setLastFetched(new Date())
    } catch (e: unknown) {
      if (e instanceof Error && ((e as {name?: string; code?: string}).name === 'CanceledError' || (e as {code?: string}).code === 'ERR_CANCELED')) return
      logger.error('[useAnalyticsData] fetch failed:', e)
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  // 初始加载
  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // 轮询
  useEffect(() => {
    if (pollInterval <= 0) return
    pollRef.current = setInterval(fetchDashboard, pollInterval)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [pollInterval, fetchDashboard])

  // 手动刷新
  const refresh = useCallback(() => {
    setLoading(true)
    fetchDashboard()
  }, [fetchDashboard])

  // ─── 派生数据 ──────────────────────────────────────────────

  const stats = (dashboard && Array.isArray(dashboard.kpi)) ? extractStats(dashboard.kpi) : null
  const statusDistribution = dashboard?.charts?.formula_status_distribution
  const monthlyTrend = dashboard?.charts?.monthly_creation_trend
  const categoryBreakdown = dashboard?.charts?.category_breakdown
  const activities = dashboard?.recent_activity ?? []
  const filters = dashboard?.available_filters
  const health = dashboard?.system_health
  const topEntities = dashboard?.top_entities

  // 将 KPI 转为扁平对象方便页面使用
  const kpiMap = dashboard && Array.isArray(dashboard.kpi)
    ? Object.fromEntries(dashboard.kpi.map((k: KPIMetric) => [k.id, k]))
    : null

  return {
    /** 原始 dashboard 数据 */
    dashboard,
    /** 统计快照 */
    stats,
    /** KPI 按 ID 索引 */
    kpiMap,
    /** 配方状态饼图数据 */
    statusDistribution,
    /** 月度趋势折线图数据 */
    monthlyTrend,
    /** 分类柱状图数据 */
    categoryBreakdown,
    /** 最近活动列表 */
    activities,
    /** 可用过滤器选项 */
    filters,
    /** 系统健康数据 */
    health,
    /** 热门实体 */
    topEntities,
    /** 加载状态 */
    loading,
    /** 错误信息 */
    error,
    /** 上次拉取时间 */
    lastFetched,
    /** 手动刷新 */
    refresh,
  }
}

// ─── 趋势数据 Hook ───────────────────────────────────────────

export function useTrendData(entity: 'formulas' | 'experiments' | 'users' | 'ai_generations', days = 30) {
  const [data, setData] = useState<TrendResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    api.get(`/analytics/trends/${entity}`, {
      params: { days, granularity: 'daily' },
      signal: ctrl.signal,
    })
      .then(res => {
        setData(res.data.data)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (e instanceof Error && ((e as {name?: string; code?: string}).name === 'CanceledError' || (e as {code?: string}).code === 'ERR_CANCELED')) return
        setError(e instanceof Error ? e.message : 'Unknown')
        setLoading(false)
      })
    return () => ctrl.abort()
  }, [entity, days])

  return { data, loading, error }
}
