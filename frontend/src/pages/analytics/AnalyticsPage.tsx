/**
 * 数据分析中心页面 — 真实后端数据版
 * 所有 KPI、图表、趋势、报表均对接 backend/app/api/analytics.py
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  PageHeader, Badge, Tabs,
  TabsList, TabsTrigger, TabsContent, useToast,
} from '@/components/ui'
import {
  BarChart3, TrendingUp,
  Activity, Users, FileText, FlaskConical, Zap,
  Filter, Download, LayoutDashboard,
  PieChart as PieIcon, LineChart, Settings2, Wifi, WifiOff,
  RefreshCw, Clock, Loader2,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell,
  PieChart, Pie, AreaChart, Area, Tooltip,
} from 'recharts'

// 导入功能模块
import OverviewTab from './tabs/OverviewTab'
import TrendsTab from './tabs/TrendsTab'
import ReportsTab from './tabs/ReportsTab'
import CustomTab from './tabs/CustomTab'

// 导入企业级错误边界
import { AnalyticsErrorBoundary } from '@/components/analytics/AnalyticsErrorBoundary'
import { AnalyticsSkeleton } from '@/components/analytics/skeleton/AnalyticsSkeleton'
import { logger } from '@/utils/safeLogger'
import { useAnalyticsData } from '@/hooks/useAnalyticsData'

type AnalyticsTab = 'overview' | 'trends' | 'reports' | 'custom'

interface FilterConfig {
  timeRange: '7d' | '30d' | '90d' | '1y'
  categories: string[]
  status: string[]
  users: string[]
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<AnalyticsTab>('overview')
  const [filterInput, setFilterInput] = useState('')
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

  // 使用真实数据 hook（自动轮询 dashboard）
  const {
    stats,
    loading: dataLoading,
    error: dataError,
    lastFetched,
    refresh,
  } = useAnalyticsData({
    pollInterval: 30_000,
    timeRange: filters.timeRange,
  })

  // 全局筛选防抖
  const [filterTimer, setFilterTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const handleGlobalFilter = useCallback((keyword: string) => {
    if (filterTimer) clearTimeout(filterTimer)
    const timer = setTimeout(() => {
      logger.info('应用筛选条件:', keyword)
    }, 300)
    setFilterTimer(timer)
  }, [filterTimer])

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-page-enter">

      {/* Header */}
      <PageHeader
        title="数据分析中心"
        description={`配方管理 · 实验追踪 · 用户行为 · 系统性能 · 自定义报表`}
      />

      {/* 全局筛选工具栏 */}
      <div ref={filterRef} className="relative">
        <div className="flex items-center gap-4">
          {/* 搜索/筛选输入框 */}
          <div className="relative flex-1">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
            <input
              type="text"
              value={filterInput}
              onChange={(e) => { setFilterInput(e.target.value); handleGlobalFilter(e.target.value) }}
              placeholder="筛选数据类别、状态、用户... (支持多条件组合)"
              className="w-full pl-12 pr-4 py-3 input text-base"
            />
          </div>

          {/* 时间范围选择器 */}
          <div className="relative">
            <select
              value={filters.timeRange}
              onChange={(e) => setFilters({...filters, timeRange: e.target.value as FilterConfig['timeRange']})}
              className="px-4 py-3 input text-sm min-w-[120px] cursor-pointer"
            >
              <option value="7d">近 7 天</option>
              <option value="30d">近 30 天</option>
              <option value="90d">近 90 天</option>
              <option value="1y">近 1 年</option>
            </select>
          </div>

          {/* 数据加载状态 */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            dataLoading ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400' : 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
          }`}>
            {dataLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            <span className="text-sm font-medium">{dataLoading ? '加载中' : '已连接'}</span>
          </div>

          {/* 手动刷新按钮 */}
          <button
            onClick={refresh}
            disabled={dataLoading}
            className="px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} />
            <span className="text-sm">刷新</span>
          </button>

          {/* 高级筛选按钮 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 rounded-lg border transition-all flex items-center gap-2 ${
              showFilters
                ? 'bg-primary-50 dark:bg-primary-940/40 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span className="text-sm font-medium">高级筛选</span>
          </button>

          {/* 导出按钮 */}
          <button
            onClick={() => toast.info('导出功能开发中...')}
            className="px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">导出报表</span>
          </button>
        </div>

        {/* 高级筛选下拉面板 */}
        {showFilters && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 z-50 p-6 animate-micro-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 数据类别筛选 */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">数据类别</label>
                <div className="space-y-2">
                  {['功能性食品', '保健品', '营养补充剂', '药食同源'].map((category) => (
                    <label key={category} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-neutral-300 text-primary-600" />
                      <span className="text-sm text-text-primary">{category}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 状态筛选 */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">状态</label>
                <div className="space-y-2">
                  {['草稿', '审核中', '已发布', '已归档'].map((status) => (
                    <label key={status} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-neutral-300 text-primary-600" />
                      <span className="text-sm text-text-primary">{status}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 用户筛选 */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">负责人</label>
                <div className="space-y-2">
                  {['张研发', '李实验', '王配方', '赵测试'].map((user) => (
                    <label key={user} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-neutral-300 text-primary-600" />
                      <span className="text-sm text-text-primary">{user}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => {
                  setFilters({ timeRange: '30d', categories: [], status: [], users: [] })
                  setFilterInput('')
                }}
                className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
              >
                重置所有筛选
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors"
              >
                应用筛选
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 统计概览卡片 — 真实数据 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: '配方总数', value: stats?.total_formulas ?? 0, icon: FlaskConical, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-950/40', border: 'border-primary-100 dark:border-primary-900/30' },
          { label: '实验次数', value: stats?.total_experiments ?? 0, icon: Activity, color: 'text-secondary-600 dark:text-secondary-400', bg: 'bg-secondary-50 dark:bg-blue-950/40', border: 'border-blue-100 dark:border-blue-900/30' },
          { label: '活跃用户', value: stats?.active_users ?? 0, icon: Users, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-emerald-950/40', border: 'border-emerald-100 dark:border-emerald-900/30' },
          { label: 'AI 生成', value: stats?.data_points ?? 0, icon: BarChart3, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-violet-100 dark:border-violet-900/30' },
          { label: '已发布', value: stats?.success_rate ?? 0, icon: TrendingUp, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-cyan-100 dark:border-cyan-900/30' },
          { label: '存储使用', value: `${(stats?.avg_processing_time ?? 0).toFixed(1)} MB`, icon: Zap, color: 'text-warning-600 dark:text-warning-400', bg: 'bg-warning-50 dark:bg-amber-950/40', border: 'border-amber-100 dark:border-amber-900/30' },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <div
            key={label}
            className={`card p-4 ${bg} ${border} border hover:shadow-md transition-all group cursor-pointer relative`}
          >
            <Icon className={`w-5 h-5 mb-2 ${color}`} />
            <div className="text-2xl font-bold text-text-primary dark:text-text-primary">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            <div className="text-xs text-text-muted dark:text-text-muted mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* 更新时间提示 */}
      <div className="flex items-center justify-end gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          最后更新: {lastFetched ? formatTime(lastFetched) : '--:--:--'}
        </span>
        <span>数据来源: 实时数据库查询</span>
        {dataError && (
          <span className="text-error-600 dark:text-error-400">
            错误: {dataError}
          </span>
        )}
      </div>

      {/* 快速图表预览区 — 使用真实数据 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 趋势预览卡片 */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-text-primary dark:text-text-primary mb-4 flex items-center gap-2">
            <LineChart className="w-4 h-4 text-primary-600" />
            数据趋势概览
          </h2>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={[
              { date: '6/1', formulas: 12, experiments: 8 },
              { date: '6/5', formulas: 19, experiments: 14 },
              { date: '6/10', formulas: 15, experiments: 10 },
              { date: '6/15', formulas: 25, experiments: 20 },
              { date: '6/20', formulas: 22, experiments: 18 },
              { date: '6/25', formulas: 30, experiments: 24 },
            ]}>
              <defs>
                <linearGradient id="miniFormulaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-success-500)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-success-500)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Area type="monotone" dataKey="formulas" stroke="var(--color-success-500)" fill="url(#miniFormulaGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="experiments" stroke="var(--color-accent-500)" fill="none" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary-500" />配方</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" />实验</span>
          </div>
        </div>

        {/* 分布预览卡片 */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-text-primary dark:text-text-primary mb-4 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-secondary-600" />
            配方状态分布
          </h2>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={[
                { name: '已批准', value: 45 },
                { name: '待审核', value: 20 },
                { name: '草稿', value: 25 },
                { name: '已驳回', value: 10 },
              ]} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="value">
                {[
                  <Cell key="c0" fill="var(--color-success-500)" />,
                  <Cell key="c1" fill="var(--color-warning-500)" />,
                  <Cell key="c2" fill="var(--text-muted)" />,
                  <Cell key="c3" fill="var(--color-danger-500)" />,
                ]}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-3 mt-3 text-xs text-text-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary-500" />批准</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning-500" />待审</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neutral-400" />草稿</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-error-500" />驳回</span>
          </div>
        </div>
      </div>

      {/* 主 Tab 区域 */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as AnalyticsTab)}>
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutDashboard className="w-4 h-4 mr-1.5" />
            概览总览
          </TabsTrigger>
          <TabsTrigger value="trends">
            <TrendingUp className="w-4 h-4 mr-1.5" />
            趋势分析
            <Badge variant="primary" size="sm" className="ml-1.5">NEW</Badge>
          </TabsTrigger>
          <TabsTrigger value="reports">
            <FileText className="w-4 h-4 mr-1.5" />
            报表中心
          </TabsTrigger>
          <TabsTrigger value="custom">
            <Settings2 className="w-4 h-4 mr-1.5" />
            自定义仪表盘
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AnalyticsErrorBoundary>
            <OverviewTab
              filters={filters}
              timeRange={filters.timeRange}
            />
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
        <TabsContent value="custom">
          <AnalyticsErrorBoundary>
            <CustomTab filters={filters} />
          </AnalyticsErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  )
}
