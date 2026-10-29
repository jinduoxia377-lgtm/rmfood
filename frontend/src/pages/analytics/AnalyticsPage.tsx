/**
 * 数据分析中心页面 — 参考 Dashboard 设计风格
 * 统一使用 bg-[var(--color-primary)] 横幅、StatCard、Card+CardHeader+CardContent 模式
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Tabs,
  TabsList, TabsTrigger, TabsContent, useToast,
  Card, Button,
} from '@/components/ui'
import {
  BarChart3, TrendingUp,
  Activity, Users, FileText, FlaskConical, Zap,
  Download, LayoutDashboard,
  Settings2, Wifi, WifiOff,
  RefreshCw, Clock, Loader2,
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
import { useAnalyticsData } from '@/hooks/useAnalyticsData'

type AnalyticsTab = 'overview' | 'trends' | 'reports' | 'business' | 'custom'

interface FilterConfig {
  timeRange: '7d' | '30d' | '90d' | '1y'
  categories: string[]
  status: string[]
  users: string[]
}

const TABS: { key: AnalyticsTab; labelKey: string; icon: LucideIcon }[] = [
  { key: 'overview',        labelKey: 'pages.analytics.tabOverview', icon: LayoutDashboard },
  { key: 'trends',          labelKey: 'pages.analytics.tabTrends', icon: TrendingUp },
  { key: 'reports',         labelKey: 'pages.analytics.tabReports', icon: FileText },
  { key: 'business',        labelKey: 'pages.analytics.tabBusiness', icon: FlaskConical },
  { key: 'custom',          labelKey: 'pages.analytics.tabCustom', icon: Settings2 },
]

export default function AnalyticsPage() {
  const { t, i18n } = useTranslation()
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
    errorStatus: dataErrorStatus,
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
    // 优先使用 VITE_WS_ANALYTICS_URL（直连后端，避免依赖 dev 代理的 WS 转发）；
    // 生产部署未配置该变量时，回退到同源路径（需网关/反向代理支持 WS 升级）。
    return (
      import.meta.env?.VITE_WS_ANALYTICS_URL ||
      `${protocol}//${window.location.host}/api/v1/analytics/ws/dashboard`
    )
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
    } catch {
      toast.error(t('pages.analytics.exportFailed'))
    }
  }, [dashboard, filters.timeRange, toast, t])

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
    return timestamp.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  if (isLoading) {
    return <AnalyticsSkeleton />
  }

  return (
    <div className="space-y-[var(--space-apple-md)] max-w-[1600px] mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-[var(--space-apple-lg)]">

      {/* Primary Banner — 与 Dashboard 一致的 bg-[var(--color-primary)] 横幅（移动端紧凑化） */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold leading-snug truncate">{t('pages.analytics.title')}</h1>
            <p className="mt-0.5 text-white/85 text-xs sm:text-sm truncate">
              {t('pages.analytics.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {/* 最后更新时间 */}
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-primary-text)] dark:text-white/75 px-2.5 py-1.5 bg-[var(--color-primary-container)] dark:bg-[var(--bg-secondary)]/10 rounded-[var(--radius-Apple-sm)] shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>{t('pages.analytics.updatedAt', { time: lastFetched ? formatTime(lastFetched) : '--:--:--' })}</span>
            </div>
            {/* 数据状态 */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-Apple-sm)] text-xs shrink-0 ${
              dataLoading
                ? 'bg-[var(--bg-secondary)]/95 dark:bg-[var(--color-warning-container)]0/20 text-[var(--color-warning-text)] dark:text-white'
                : 'bg-[var(--bg-secondary)]/95 dark:bg-[var(--color-success-container)]0/20 text-[var(--color-success-text)] dark:text-white'
            }`}>
              {dataLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              {dataLoading ? t('pages.analytics.loading') : t('pages.analytics.connected')}
            </div>
            {/* WebSocket 状态 */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-Apple-sm)] text-xs shrink-0 ${
              wsConnected
                ? 'bg-[var(--bg-secondary)]/95 dark:bg-[var(--color-success-container)]0/20 text-[var(--color-success-text)] dark:text-white'
                : wsConnecting
                  ? 'bg-[var(--bg-secondary)]/95 dark:bg-[var(--color-warning-container)]0/20 text-[var(--color-warning-text)] dark:text-white'
                  : 'bg-[var(--bg-secondary)]/95 dark:bg-[var(--bg-tertiary)]0/20 text-[var(--text-primary)] dark:text-white'
            }`}>
              {wsConnected
                ? <Wifi className="w-3.5 h-3.5 text-[var(--color-success-text)] dark:text-[var(--color-success-text)]" />
                : wsConnecting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />
                  : <WifiOff className="w-3.5 h-3.5" />
              }
              <span>{wsConnected ? t('pages.analytics.realtime') : wsConnecting ? t('pages.analytics.connecting') : t('pages.analytics.polling')}</span>
            </div>
            {/* 刷新按钮 */}
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={refresh}
              disabled={dataLoading}
              className="min-w-[44px]"
            >
              <span className="hidden sm:inline">{t('pages.analytics.refresh')}</span>
            </Button>
            {/* 导出按钮 */}
            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={14} />}
              onClick={() => handleExport('excel')}
              className="min-w-[44px]"
            >
              <span className="hidden sm:inline">{t('pages.analytics.exportCsv')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={14} />}
              onClick={() => handleExport('json')}
              className="min-w-[44px]"
            >
              <span className="hidden sm:inline">{t('pages.analytics.exportJson')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 筛选工具栏 */}
      <div ref={filterRef} className="relative">
        <div className="flex items-center gap-[var(--space-apple-sm)]">
          {/* 时间范围 */}
          <select
            value={filters.timeRange}
            onChange={(e) => setFilters({ ...filters, timeRange: e.target.value as FilterConfig['timeRange'] })}
            className="px-[var(--space-apple-sm)] py-2 text-sm input min-w-[110px] min-h-[44px]"
          >
            <option value="7d">{t('pages.analytics.last7d')}</option>
            <option value="30d">{t('pages.analytics.last30d')}</option>
            <option value="90d">{t('pages.analytics.last90d')}</option>
            <option value="1y">{t('pages.analytics.last1y')}</option>
          </select>

          {/* 高级筛选 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-[var(--space-apple-sm)] py-2 text-sm rounded-[var(--radius-Apple-sm)] border transition-colors flex items-center gap-1.5 ${
              showFilters
                ? 'bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/40 border-[var(--color-primary-border)] dark:border-[var(--color-primary)] text-[var(--color-primary-text)]'
                : 'border-border text-[var(--text-secondary)] dark:text-[var(--text-muted)] hover:bg-surface-hover'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            {t('pages.analytics.filter')}
          </button>
        </div>

        {/* 高级筛选面板 */}
        {showFilters && (
          <div className="absolute top-full left-0 mt-2 bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] shadow-lg border border-[var(--border-color)] z-50 p-5 w-full animate-micro-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('pages.analytics.dataCategory')}</label>
                <div className="space-y-1.5">
                  {[t('pages.analytics.categories.functionalFood'), t('pages.analytics.categories.healthProducts'), t('pages.analytics.categories.nutritionSupplements'), t('pages.analytics.categories.foodHomology')].map((category) => (
                    <label key={category} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-border text-[var(--color-primary-text)]"
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
                      <span className="text-sm text-[var(--text-primary)]">{category}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('pages.analytics.status')}</label>
                <div className="space-y-1.5">
                  {[t('pages.analytics.statusOptions.draft'), t('pages.analytics.statusOptions.inReview'), t('pages.analytics.statusOptions.published'), t('pages.analytics.statusOptions.archived')].map((status) => (
                    <label key={status} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-border text-[var(--color-primary-text)]"
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
                      <span className="text-sm text-[var(--text-primary)]">{status}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('pages.analytics.owner')}</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {apiFilters?.users?.length ? (
                    apiFilters.users.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-border text-[var(--color-primary-text)]"
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
                        <span className="text-sm text-[var(--text-primary)]">{u.full_name || u.username}</span>
                      </label>
                    ))
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">{t('pages.analytics.noUserData')}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-[var(--space-apple-md)] pt-[var(--space-apple-md)] border-t border-[var(--border-color)]">
              <button
                onClick={() => {
                  setFilters({ timeRange: '30d', categories: [], status: [], users: [] })
                  setShowFilters(false)
                  refresh()
                }}
                className="px-[var(--space-apple-sm)] py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {t('pages.analytics.reset')}
              </button>
              <button
                onClick={() => { setShowFilters(false); refresh() }}
                className="px-[var(--space-apple-md)] py-1.5 bg-primary-container hover:bg-primary-container text-[var(--color-primary)] text-sm rounded-[var(--radius-Apple-sm)] transition-colors"
              >
                {t('pages.analytics.applyFilters')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 统计概览行 — 使用 StatCard 风格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[var(--space-apple-sm)]">
        {[
          { label: t('pages.analytics.statTotalFormulas'), value: stats?.total_formulas ?? 0, icon: FlaskConical as LucideIcon, variant: 'primary' as const },
          { label: t('pages.analytics.statExperiments'), value: stats?.total_experiments ?? 0, icon: Activity as LucideIcon, variant: 'secondary' as const },
          { label: t('pages.analytics.statActiveUsers'), value: stats?.active_users ?? 0, icon: Users as LucideIcon, variant: 'info' as const },
          { label: t('pages.analytics.statAiGenerated'), value: stats?.data_points ?? 0, icon: BarChart3 as LucideIcon, variant: 'success' as const },
          { label: t('pages.analytics.statSuccessRate'), value: `${stats?.success_rate ?? 0}%`, icon: TrendingUp as LucideIcon, variant: 'warning' as const },
          { label: t('pages.analytics.statStorage'), value: `${(stats?.avg_processing_time ?? 0).toFixed(1)} MB`, icon: Zap as LucideIcon, variant: 'primary' as const },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[var(--text-muted)]">{label}</p>
              <div className="w-7 h-7 rounded-[var(--radius-Apple-sm)] bg-[var(--color-primary-container)] flex items-center justify-center">
                <Icon size={14} className="text-[var(--color-primary-text)]" />
              </div>
            </div>
            <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
          </Card>
        ))}
      </div>

      {/* 错误提示 */}
      {dataError && (
        <div className="p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/20 border border-[var(--color-error-border)] dark:border-error-900/40 text-[var(--color-error-text)] dark:text-[var(--color-error-text)] text-sm">
          {dataErrorStatus === 403
            ? t('pages.analytics.loadFailedForbiddenDesc')
            : dataError}
        </div>
      )}

      {/* Tab 导航 — 与 Dashboard 一致的药丸风格 */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as AnalyticsTab)}>
        <TabsList className="mb-0 w-full max-w-full overflow-x-auto justify-start lg:justify-center [&>*]:shrink-0">
          {TABS.map(({ key, labelKey, icon: Icon }) => (
            <TabsTrigger key={key} value={key} icon={<Icon className="w-3.5 h-3.5" />}>
              {t(labelKey)}
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
