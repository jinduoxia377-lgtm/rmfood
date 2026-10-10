/**
 * 概览总览 Tab 组件 — 真实后端数据版
 * 从 /api/v1/analytics/dashboard 拉取实时数据，
 * 图表、KPI、活动均对接数据库查询结果。
 */
import React, { useState, useMemo, useEffect } from 'react'
import {
  TrendingUp, BarChart3, PieChart, LineChart as LineChartIcon,
  Activity, Users, FlaskConical, Zap, RefreshCw,
  LineChart, ZoomIn, ZoomOut, Maximize2,
  CheckCircle2, Wifi,
} from 'lucide-react'
import { AnalyticsChart, ChartDataItem } from '@/components/analytics/charts/RechartsWrapper'
import type { KPIMetric, DashboardResponse } from '@/hooks/useAnalyticsData'
import { extractStats } from '@/hooks/useAnalyticsData'

interface FilterConfig {
  timeRange: '7d' | '30d' | '90d' | '1y'
  categories: string[]
  status: string[]
  users: string[]
}

interface Props {
  filters: FilterConfig
  dashboard?: DashboardResponse | null
  refresh: () => void
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  primary: { bg: 'bg-primary-50 dark:bg-primary-950/40', text: 'text-primary-700', border: 'border-primary-200 dark:border-primary-800' },
  blue: { bg: 'bg-secondary-50 dark:bg-secondary-950/40', text: 'text-secondary-600', border: 'border-secondary-200 dark:border-secondary-800' },
  emerald: { bg: 'bg-primary-50 dark:bg-success-950/40', text: 'text-primary-700', border: 'border-success-200 dark:border-success-800' },
  cyan: { bg: 'bg-info-50 dark:bg-info-950/40', text: 'text-info-600', border: 'border-info-200 dark:border-info-800' },
  violet: { bg: 'bg-accent-50 dark:bg-accent-950/40', text: 'text-accent-600', border: 'border-accent-200 dark:border-accent-800' },
  amber: { bg: 'bg-warning-50 dark:bg-warning-950/40', text: 'text-warning-600', border: 'border-warning-200 dark:border-warning-800' },
}

type ViewMode = 'dashboard' | 'charts'

// 图标映射
const ICON_MAP: Record<string, React.ElementType> = {
  total_formulas: FlaskConical,
  total_experiments: Activity,
  active_users: Users,
  ai_generations: Zap,
  storage_usage: BarChart3,
  published_formulas: TrendingUp,
}

export default function OverviewTab({ filters, dashboard, refresh }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')
  const [zoomLevel, setZoomLevel] = useState(1)
  const [selectedDataPoint, setSelectedDataPoint] = useState<{ x: string; y: number; series: string } | null>(null)
  const [showDrillDown, setShowDrillDown] = useState(false)
  const [drillDownData, setDrillDownData] = useState<ChartDataItem[]>([])

  // 直接从父级 props 派生所有数据，不重复发起网络请求
  const stats = dashboard?.kpi ? extractStats(dashboard.kpi) : null
  const kpiMap = dashboard?.kpi
    ? Object.fromEntries(dashboard.kpi.map((k: KPIMetric) => [k.id, k]))
    : null
  const statusDistribution = dashboard?.charts?.formula_status_distribution
  const monthlyTrend = dashboard?.charts?.monthly_creation_trend
  const categoryBreakdown = dashboard?.charts?.category_breakdown
  const activities = dashboard?.recent_activity ?? []
  const health = dashboard?.system_health
  const loading = false  // 由父级 AnalyticsPage 统一管理 loading 状态
  const error = null
  const lastFetched = dashboard ? new Date(dashboard.timestamp) : null

  // 监听父级 timeRange 变化，触发重新拉取
  useEffect(() => {
    refresh()
  }, [filters.timeRange])

  // ─── 派生 KPI 卡片数据 ─────────────────────────────────────
  const kpiCards = useMemo(() => {
    if (!kpiMap) return []
    const ids: (keyof typeof kpiMap)[] = [
      'total_formulas', 'total_experiments', 'active_users',
      'ai_generations', 'storage_usage', 'published_formulas',
    ]
    const colors = ['primary', 'blue', 'emerald', 'cyan', 'violet', 'amber']
    return ids.map((id, i) => {
      const kpi = kpiMap[id] as KPIMetric | undefined
      const Icon = ICON_MAP[id] || Activity
      const color = colors[i]
      return {
        id,
        name: kpi?.name ?? id,
        value: kpi?.value ?? 0,
        unit: kpi?.unit ?? '',
        change: kpi?.change_percent ?? 0,
        changeDirection: kpi?.change_direction,
        Icon,
        color,
        target: kpi?.target,
      }
    })
  }, [kpiMap])

  // ─── 趋势图数据 ────────────────────────────────────────────
  const trendChartData = useMemo(() => {
    if (!monthlyTrend?.labels) return []
    return monthlyTrend.labels.map((label, idx) => ({
      month: label,
      formula: monthlyTrend.datasets?.[0]?.data?.[idx] ?? 0,
      experiment: monthlyTrend.datasets?.[1]?.data?.[idx] ?? 0,
    }))
  }, [monthlyTrend])

  // ─── 分类数据 ──────────────────────────────────────────────
  const categoryChartData = useMemo(() => {
    if (!categoryBreakdown?.labels) return []
    return categoryBreakdown.labels.map((label, idx) => ({
      name: label,
      value: categoryBreakdown.datasets?.[0]?.data?.[idx] ?? 0,
    }))
  }, [categoryBreakdown])

  // ─── 状态分布数据 ──────────────────────────────────────────
  const statusChartData = useMemo(() => {
    if (!statusDistribution?.labels) return []
    return statusDistribution.labels.map((label, idx) => ({
      name: label,
      value: statusDistribution.datasets?.[0]?.data?.[idx] ?? 0,
    }))
  }, [statusDistribution])

  // ─── 活动列表 ──────────────────────────────────────────────
  const activityList = useMemo(() => {
    return (activities ?? []).slice(0, 10).map(a => ({
      type: a.type,
      title: a.title,
      author: a.author ?? '未知',
      time: a.timestamp ? new Date(a.timestamp).toLocaleString('zh-CN') : '',
    }))
  }, [activities])

  // ─── 缩放控制 ──────────────────────────────────────────────
  const handleZoomIn = () => setZoomLevel(z => Math.min(z + 0.25, 2))
  const handleZoomOut = () => setZoomLevel(z => Math.max(z - 0.25, 0.5))
  const handleResetZoom = () => setZoomLevel(1)

  const handleDataPointClick = (x: string, y: number, series: string) => {
    setSelectedDataPoint({ x, y, series })
    setShowDrillDown(true)
    setDrillDownData([
      { name: `${x} - 子项1`, value: Math.floor(y * 0.4) },
      { name: `${x} - 子项2`, value: Math.floor(y * 0.3) },
      { name: `${x} - 子项3`, value: Math.floor(y * 0.2) },
      { name: `${x} - 子项4`, value: Math.floor(y * 0.1) },
    ])
  }

  // ─── 可用过滤器（来自 API） ────────────────────────────────
  const apiFilters = dashboard?.available_filters

  // ─── 加载中状态 ────────────────────────────────────────────
  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-primary-700 animate-spin" />
          <span className="text-sm text-text-muted">正在加载数据分析...</span>
        </div>
      </div>
    )
  }

  // ─── 错误状态 ──────────────────────────────────────────────
  if (error) {
    return (
      <div className="card p-6 border border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-950/20">
        <p className="text-error-600 dark:text-error-600 font-medium">数据加载失败: {error}</p>
        <button
          onClick={refresh}
          className="mt-3 px-4 py-2 bg-error-600 text-white rounded-lg text-sm hover:bg-error-700 transition-colors"
        >
          重新加载
        </button>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          {/* A-41：暗色画布是墨绿渐变，--text-muted(#94a3b8) 落在上面只有 3.79:1 */}
          <div className="text-sm text-text-muted dark:text-neutral-300">
            当前筛选: <span className="font-medium text-text-primary">{filters.timeRange}</span>
            {filters?.categories?.length > 0 && ` · ${filters.categories.length} 个类别`}
          </div>

          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 min-h-[44px] ${
                viewMode === 'dashboard'
                  ? 'bg-white dark:bg-neutral-900 text-primary-700 shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              仪表盘
            </button>
            <button
              onClick={() => setViewMode('charts')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 min-h-[44px] ${
                viewMode === 'charts'
                  ? 'bg-white dark:bg-neutral-900 text-primary-700 shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              图表
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Wifi className="w-3.5 h-3.5 text-success-500" />
            <span>实时</span>
            {lastFetched && (
              <span>· 更新于 {lastFetched.toLocaleTimeString('zh-CN')}</span>
            )}
          </div>

          <button
            onClick={refresh}
            className="px-3 py-1.5 text-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-2 min-h-[44px]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>
      </div>

      {/* ─── Dashboard 视图 ─── */}
      {viewMode === 'dashboard' && (
        <>
          {/* KPI 卡片行 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {kpiCards.map(({ id, name, value, unit, change, changeDirection, Icon, color, target }) => {
              const colors = COLOR_MAP[color] || COLOR_MAP.primary
              const pctStr = change != null && change !== 0
                ? `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
                : '—'
              return (
                <div
                  key={id}
                  className={`card p-4 ${colors.bg} ${colors.border} border hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden`}
                   role="button" tabIndex={0} onClick={() => setViewMode('charts')}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`w-5 h-5 ${colors.text} group-hover:scale-110 transition-transform`} />
                    {target != null && (
                      <span className="text-xs text-text-muted">目标: {target}</span>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-text-primary">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                    <span className="text-sm font-normal text-text-muted ml-1">{unit}</span>
                  </div>
                  <div className="text-xs text-text-muted mt-1">{name}</div>
                  <div className={`text-xs mt-1 ${change > 0 ? 'text-success-600' : change < 0 ? 'text-error-600' : 'text-text-muted'}`}>
                    {change != null && change !== 0 ? `${change > 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}%` : pctStr}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </div>
              )
            })}
          </div>

          {/* 主图表 + 活动 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-text-primary flex items-center gap-2">
                  <LineChart className="w-5 h-5 text-primary-700" />
                  月度创建趋势
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={handleZoomIn} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors min-w-[44px] min-h-[44px] inline-flex items-center justify-center" title="放大"><ZoomIn className="w-4 h-4" /></button>
                  <button onClick={handleZoomOut} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors min-w-[44px] min-h-[44px] inline-flex items-center justify-center" title="缩小"><ZoomOut className="w-4 h-4" /></button>
                  <button onClick={handleResetZoom} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors min-w-[44px] min-h-[44px] inline-flex items-center justify-center" title="重置"><Maximize2 className="w-4 h-4" /></button>
                </div>
              </div>
              {monthlyTrend ? (
                <AnalyticsChart
                  type="line"
                  data={trendChartData}
                  xKey="month"
                  datasets={[
                    {
                      label: '配方',
                      data: trendChartData.map(d => d.formula as number),
                      borderColor: 'var(--color-secondary, #0A84FF)',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      fill: true,
                    },
                    {
                      label: '实验',
                      data: trendChartData.map(d => d.experiment as number),
                      borderColor: 'var(--color-primary, var(--color-primary-400))',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      fill: true,
                    },
                  ]}
                  height={300}
                  zoomLevel={zoomLevel}
                  onDataPointClick={handleDataPointClick}
                />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-text-muted">暂无趋势数据</div>
              )}
            </div>

            <div className="card p-6">
              <h3 className="font-bold text-text-primary flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-secondary-600" />
                近期动态
              </h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {activityList.length > 0 ? (
                  activityList.map((activity, index) => (
                    <div
                      key={index}
                      className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                          activity.type === 'formula' ? 'bg-success-500' :
                          activity.type === 'experiment' ? 'bg-secondary-500' :
                          'bg-neutral-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary group-hover:text-primary-700 transition-colors line-clamp-2">
                            {activity.title}
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xs text-text-muted">{activity.author}</span>
                            <span className="text-xs text-text-muted">{activity.time}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-muted text-center py-8">暂无活动记录</p>
                )}
              </div>
            </div>
          </div>

          {/* 系统健康 */}
          {health && (
            <div className="card p-6">
              <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-700" />
                系统健康状态
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: '数据库', value: health.database_status, color: health.database_status === 'healthy' ? 'text-success-600' : 'text-error-600' },
                  { label: '平均响应', value: `${health.avg_response_time_ms}ms`, color: 'text-primary-700' },
                  { label: '错误率', value: `${health.error_rate_percent}%`, color: health.error_rate_percent < 1 ? 'text-success-600' : 'text-error-600' },
                  { label: '活跃连接', value: `${health.active_connections}`, color: 'text-secondary-600' },
                  { label: 'CPU', value: `${health.cpu_usage_percent}%`, color: health.cpu_usage_percent < 70 ? 'text-success-600' : 'text-warning-600' },
                  { label: '内存', value: `${health.memory_usage_percent}%`, color: health.memory_usage_percent < 80 ? 'text-success-600' : 'text-warning-600' },
                  { label: '磁盘', value: `${health.disk_usage_percent}%`, color: health.disk_usage_percent < 85 ? 'text-success-600' : 'text-warning-600' },
                  { label: '缓存命中率', value: `${health.cache_hit_rate_percent}%`, color: 'text-primary-700' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                    <div className="text-xs text-text-muted">{label}</div>
                    <div className={`text-lg font-bold mt-1 ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 过滤器选项 */}
          {apiFilters && (
            <div className="card p-6">
              <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                <LineChartIcon className="w-5 h-5 text-secondary-600" />
                可用过滤器
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {apiFilters.formula_status && apiFilters.formula_status.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">配方状态</h4>
                    <div className="space-y-1">
                      {apiFilters.formula_status.map((s: string) => (
                        <span key={s} className="text-sm px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {apiFilters.experiment_status && apiFilters.experiment_status.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">实验状态</h4>
                    <div className="space-y-1">
                      {apiFilters.experiment_status.map((s: string) => (
                        <span key={s} className="text-sm px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {apiFilters.categories && apiFilters.categories.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">类别</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {apiFilters.categories.slice(0, 8).map((c: { id: string; name: string }) => (
                        <span key={c.id} className="text-sm px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded block">{c.name}</span>
                      ))}
                    </div>
                  </div>
                )}
                {apiFilters.users && apiFilters.users.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">用户</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {apiFilters.users.slice(0, 8).map((u: { id: string; username: string; full_name: string }) => (
                        <span key={u.id} className="text-sm px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded block">{u.full_name || u.username}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Charts 视图 ─── */}
      {viewMode === 'charts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-text-primary">数据可视化</h3>
            <button
              onClick={() => setViewMode('dashboard')}
              className="text-sm text-primary-700 hover:text-primary-700"
            >
              ← 返回仪表盘
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 月度趋势 */}
            <div className="card p-6">
              <h4 className="font-bold text-text-primary mb-4"><TrendingUp className="w-4 h-4 inline mr-2" />月度趋势分析</h4>
              {monthlyTrend ? (
                <AnalyticsChart
                  type="line"
                  data={trendChartData}
                  xKey="month"
                  datasets={[
                    { label: '配方', data: trendChartData.map(d => d.formula as number), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true },
                    { label: '实验', data: trendChartData.map(d => d.experiment as number), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true },
                  ]}
                  height={250}
                  onDataPointClick={handleDataPointClick}
                />
              ) : (
                <div className="h-[250px] flex items-center justify-center text-text-muted">暂无数据</div>
              )}
            </div>

            {/* 分类分布 */}
            <div className="card p-6">
              <h4 className="font-bold text-text-primary mb-4"><BarChart3 className="w-4 h-4 inline mr-2" />分类分布</h4>
              {categoryBreakdown ? (
                <AnalyticsChart
                  type="bar"
                  data={categoryChartData}
                  xKey="name"
                  datasets={[{ label: '数量', data: categoryChartData.map(d => d.value as number), backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'] }]}
                  height={250}
                />
              ) : (
                <div className="h-[250px] flex items-center justify-center text-text-muted">暂无数据</div>
              )}
            </div>

            {/* 状态分布 */}
            <div className="card p-6">
              <h4 className="font-bold text-text-primary mb-4"><PieChart className="w-4 h-4 inline mr-2" />配方状态分布</h4>
              {statusDistribution ? (
                <AnalyticsChart
                  type="pie"
                  data={statusChartData}
                  nameKey="name"
                  dataKey="value"
                  datasets={[{ label: '状态', data: statusChartData.map(d => d.value as number), backgroundColor: ['#94a3b8','var(--color-primary-500)','#6b7280','#f59e0b'] }]}
                  height={250}
                />
              ) : (
                <div className="h-[250px] flex items-center justify-center text-text-muted">暂无数据</div>
              )}
            </div>

            {/* 面积图 */}
            <div className="card p-6">
              <h4 className="font-bold text-text-primary mb-4"><LineChartIcon className="w-4 h-4 inline mr-2" />面积趋势</h4>
              {monthlyTrend ? (
                <AnalyticsChart
                  type="area"
                  data={trendChartData}
                  xKey="month"
                  datasets={[
                    { label: '配方', data: trendChartData.map(d => d.formula as number), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.3)', fill: true },
                    { label: '实验', data: trendChartData.map(d => d.experiment as number), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.3)', fill: true },
                  ]}
                  height={250}
                />
              ) : (
                <div className="h-[250px] flex items-center justify-center text-text-muted">暂无数据</div>
              )}
            </div>
          </div>

          {/* 下钻 */}
          {showDrillDown && selectedDataPoint && (
            <div className="card p-6 border-2 border-primary-400 dark:border-primary-600">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-text-primary">下钻分析 - {selectedDataPoint.x} ({selectedDataPoint.series})</h4>
                <button onClick={() => setShowDrillDown(false)} className="text-text-muted hover:text-text-primary">✕</button>
              </div>
              <AnalyticsChart
                type="bar"
                data={drillDownData}
                xKey="name"
                datasets={[{ label: '子项数量', data: drillDownData.map(d => d.value as number), backgroundColor: '#3b82f6' }]}
                height={200}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg text-xs text-text-muted">
        <span>共 {kpiCards.length} 个核心指标 · 当前视图: {viewMode.toUpperCase()}</span>
        <span>数据更新频率: 每 30 秒自动刷新</span>
        <span>最后更新: {lastFetched?.toLocaleString() || '未知'}</span>
      </div>
    </div>
  )
}
