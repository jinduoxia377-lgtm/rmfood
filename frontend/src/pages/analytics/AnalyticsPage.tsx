/**
 * 数据分析中心页面 — 参考 Dashboard 设计风格
 * 统一使用 bg-primary-600 横幅、StatCard、Card+CardHeader+CardContent 模式
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  PageHeader, Badge, Tabs,
  TabsList, TabsTrigger, TabsContent, useToast,
  Card, CardHeader, CardTitle, CardContent, Button,
} from '@/components/ui'
import {
  BarChart3, TrendingUp,
  Activity, Users, FileText, FlaskConical, Zap,
  Filter, Download, LayoutDashboard,
  PieChart as PieIcon, LineChart, Settings2, Wifi, WifiOff,
  RefreshCw, Clock, Loader2, AlertCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAnalyticsWebSocket } from '@/hooks/useAnalyticsWebSocket'

// 导入功能模块
import OverviewTab from './tabs/OverviewTab'
import TrendsTab from './tabs/TrendsTab'
import ReportsTab from './tabs/ReportsTab'
import CustomTab from './tabs/CustomTab'
import BusinessInsightsTab from './tabs/BusinessInsightsTab'

// 导入企业级错误边界
import { AnalyticsErrorBoundary } from '@/components/analytics/AnalyticsErrorBoundary'
import { AnalyticsSkeleton } from '@/components/analytics/skeleton/AnalyticsSkeleton'
import { logger } from '@/utils/safeLogger'
import { useAnalyticsData } from '@/hooks/useAnalyticsData'

type AnalyticsTab = 'overview' | 'trends' | 'reports' | 'business' | 'custom'

interface FilterConfig {
  timeRange: '7d' | '30d' | '90d' | '1y'
  categories: string[]
  status: string[]
  users: string[]
}

const TABS: { key: AnalyticsTab; label: string; icon: LucideIcon }[] = [
  { key: 'overview',        label: '概览',          icon: LayoutDashboard },
  { key: 'trends',          label: '趋势分析',       icon: TrendingUp },
  { key: 'reports',         label: '报表中心',       icon: FileText },
  { key: 'business',        label: '业务洞察',       icon: FlaskConical },
  { key: 'custom',          label: '自定义仪表盘',   icon: Settings2 },
]

export default function AnalyticsPage() {
  const [tab, setTab] = useState<AnalyticsTab>('overview')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterConfig>({
    timeRange: '30d',
    categories: [],
    status: [],
    users: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const filterRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  const {
    stats,
    dashboard,
    loading: dataLoading,
    error: dataError,
    lastFetched,
    refresh,
    filters: apiFilters,
  } = useAnalyticsData({
    pollInterval: 30_000,
    timeRange: filters.timeRange,
    categories: filters.categories,
    status: filters.status,
    users: filters.users,
  })

  // ─── WebSocket 实时连接 ──────────────────────────────────────
  const wsUrl = useMemo(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/api/v1/analytics/ws/dashboard`
  }, [])

  const {
    connected: wsConnected,
    connecting: wsConnecting,
  } = useAnalyticsWebSocket({
    url: wsUrl,
    reconnect: true,
    reconnectInterval: 5000,
    maxReconnectAttempts: 5,
    onMessage: useCallback((data: any) => {
      if (data?.type === 'kpi_update' || data?.type === 'chart_refresh') {
        refresh()
      }
    }, [refresh]),
  })

  // 导出当前仪表盘数据为 CSV/JSON
  const handleExport = useCallback(async (format: 'json' | 'excel') => {
    if (!dashboard) return
    try {
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(dashboard, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `analytics_dashboard_${filters.timeRange}_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const kpiRows = dashboard.kpi?.map((k: any) => ({
          指标ID: k.id,
          指标名称: k.name,
          数值: k.value,
          单位: k.unit,
          环比变化: k.change_percent ?? '—',
          目标值: k.target ?? '—',
        })) || []
        const headers = Object.keys(kpiRows[0] ?? {}).join(',')
        const rows = kpiRows.map(r => Object.values(r).map(v => String(v ?? '')).join(','))
        const csv = [headers, ...rows].join('\n')
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `analytics_kpi_${filters.timeRange}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      toast.error('导出失败，请稍后重试')
    }
  }, [dashboard, filters.timeRange, toast])

  // 初始加载完成后清除骨架屏（防止缓存命中时仍显示假 loading）
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  // 全局筛选防抖
  // 点击外部关闭筛选面板
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilters(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 初始加载状态处理
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  if (isLoading) {
    return <AnalyticsSkeleton />
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

      {/* Primary Banner — 与 Dashboard 一致的 bg-primary-600 横幅 */}
      <div className="surface-primary rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold leading-snug">数据分析中心</h1>
            <p className="mt-1 text-white/85 text-sm">
              配方管理 · 实验追踪 · 用户行为 · 系统性能 · 自定义报表
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* 最后更新时间 */}
            <div className="flex items-center gap-1.5 text-xs text-white/75 px-3 py-1.5 bg-white dark:bg-neutral-900/10 rounded-lg">
              <Clock className="w-3.5 h-3.5" />
              <span>更新于 {lastFetched ? formatTime(lastFetched) : '--:--:--'}</span>
            </div>
            {/* 数据状态 */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${
              dataLoading
                ? 'bg-warning-500/20 text-white'
                : 'bg-success-500/20 text-white'
            }`}>
              {dataLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              {dataLoading ? '加载中' : '已连接'}
            </div>
            {/* WebSocket 状态 */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${
              wsConnected
                ? 'bg-green-500/20 text-white'
                : wsConnecting
                  ? 'bg-yellow-500/20 text-white'
                  : 'bg-neutral-500/20 text-white/60'
            }`}>
              {wsConnected
                ? <Wifi className="w-3.5 h-3.5 text-green-400" />
                : wsConnecting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-yellow-400" />
                  : <WifiOff className="w-3.5 h-3.5" />
              }
              <span>{wsConnected ? '实时' : wsConnecting ? '连接中…' : '轮询'}</span>
            </div>
            {/* 刷新按钮 */}
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={refresh}
              disabled={dataLoading}
            >
              刷新
            </Button>
            {/* 导出按钮 */}
            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={14} />}
              onClick={() => handleExport('excel')}
            >
              导出 CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={14} />}
              onClick={() => handleExport('json')}
            >
              导出 JSON
            </Button>
          </div>
        </div>
      </div>

      {/* 筛选工具栏 */}
      <div ref={filterRef} className="relative">
        <div className="flex items-center gap-3">
          {/* 时间范围 */}
          <select
            value={filters.timeRange}
            onChange={(e) => setFilters({ ...filters, timeRange: e.target.value as FilterConfig['timeRange'] })}
            className="px-3 py-2 text-sm input min-w-[110px]"
          >
            <option value="7d">近 7 天</option>
            <option value="30d">近 30 天</option>
            <option value="90d">近 90 天</option>
            <option value="1y">近 1 年</option>
          </select>

          {/* 高级筛选 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors flex items-center gap-1.5 ${
              showFilters
                ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-300 dark:border-primary-800 text-primary-700 dark:text-primary-300'
                : 'border-border text-text-secondary hover:bg-surface-hover'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            筛选
          </button>
        </div>

        {/* 高级筛选面板 */}
        {showFilters && (
          <div className="absolute top-full left-0 mt-2 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 z-50 p-5 w-full animate-micro-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">数据类别</label>
                <div className="space-y-1.5">
                  {['功能性食品', '保健品', '营养补充剂', '药食同源'].map((category) => (
                    <label key={category} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-border text-primary-600"
                        checked={filters.categories.includes(category)}
                        onChange={(e) => {
                          setFilters(prev => ({
                            ...prev,
                            categories: e.target.checked
                              ? [...prev.categories, category]
                              : prev.categories.filter(c => c !== category),
                          }))
                        }}
                      />
                      <span className="text-sm text-text-primary">{category}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">状态</label>
                <div className="space-y-1.5">
                  {['草稿', '审核中', '已发布', '已归档'].map((status) => (
                    <label key={status} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-border text-primary-600"
                        checked={filters.status.includes(status)}
                        onChange={(e) => {
                          setFilters(prev => ({
                            ...prev,
                            status: e.target.checked
                              ? [...prev.status, status]
                              : prev.status.filter(s => s !== status),
                          }))
                        }}
                      />
                      <span className="text-sm text-text-primary">{status}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">负责人</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {apiFilters?.users?.length ? (
                    apiFilters.users.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-border text-primary-600"
                          checked={filters.users.includes(u.id)}
                          onChange={(e) => {
                            setFilters(prev => ({
                              ...prev,
                              users: e.target.checked
                                ? [...prev.users, u.id]
                                : prev.users.filter(id => id !== u.id),
                            }))
                          }}
                        />
                        <span className="text-sm text-text-primary">{u.full_name || u.username}</span>
                      </label>
                    ))
                  ) : (
                    <span className="text-xs text-text-muted">暂无用户数据</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => {
                  setFilters({ timeRange: '30d', categories: [], status: [], users: [] })
                  setShowFilters(false)
                  refresh()
                }}
                className="px-3 py-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                重置
              </button>
              <button
                onClick={() => { setShowFilters(false); refresh() }}
                className="px-4 py-1.5 bg-primary-container hover:bg-primary-container text-primary-main text-sm rounded-lg transition-colors"
              >
                应用筛选
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 统计概览行 — 使用 StatCard 风格 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: '配方总数', value: stats?.total_formulas ?? 0, icon: FlaskConical as LucideIcon, variant: 'primary' as const },
          { label: '实验次数', value: stats?.total_experiments ?? 0, icon: Activity as LucideIcon, variant: 'secondary' as const },
          { label: '活跃用户', value: stats?.active_users ?? 0, icon: Users as LucideIcon, variant: 'info' as const },
          { label: 'AI 生成', value: stats?.data_points ?? 0, icon: BarChart3 as LucideIcon, variant: 'success' as const },
          { label: '成功率', value: `${stats?.success_rate ?? 0}%`, icon: TrendingUp as LucideIcon, variant: 'warning' as const },
          { label: '存储使用', value: `${(stats?.avg_processing_time ?? 0).toFixed(1)} MB`, icon: Zap as LucideIcon, variant: 'primary' as const },
        ].map(({ label, value, icon: Icon, variant }) => (
          <Card key={label} className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-text-muted">{label}</p>
              <div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <Icon size={14} className="text-primary-600 dark:text-primary-400" />
              </div>
            </div>
            <p className="text-xl font-bold text-text-primary">{value}</p>
          </Card>
        ))}
      </div>

      {/* 错误提示 */}
      {dataError && (
        <div className="p-3 rounded-lg bg-error-50 dark:bg-error-950/20 border border-error-200 dark:border-error-900/40 text-error-700 dark:text-error-400 text-sm">
          {dataError}
        </div>
      )}

      {/* Tab 导航 — 与 Dashboard 一致的药丸风格 */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as AnalyticsTab)}>
        <TabsList className="mb-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <TabsTrigger key={key} value={key} icon={<Icon className="w-3.5 h-3.5" />}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <AnalyticsErrorBoundary>
            <OverviewTab filters={filters} dashboard={dashboard} refresh={refresh} />
          </AnalyticsErrorBoundary>
        </TabsContent>
        <TabsContent value="trends">
          <AnalyticsErrorBoundary>
            <TrendsTab filters={filters} />
          </AnalyticsErrorBoundary>
        </TabsContent>
        <TabsContent value="reports">
          <AnalyticsErrorBoundary>
            <ReportsTab filters={filters} />
          </AnalyticsErrorBoundary>
        </TabsContent>
        <TabsContent value="business">
          <AnalyticsErrorBoundary>
            <BusinessInsightsTab filters={filters} />
          </AnalyticsErrorBoundary>
        </TabsContent>
        <TabsContent value="custom">
          <AnalyticsErrorBoundary>
            <CustomTab filters={filters} dashboard={dashboard} refresh={refresh} />
          </AnalyticsErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  )
}
