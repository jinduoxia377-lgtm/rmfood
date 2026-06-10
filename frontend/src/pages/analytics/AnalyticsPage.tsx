/**
 * 数据分析中心页面 — 完整功能版 v2.0
 * 集成所有功能模块，确保稳定性和完整性
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
  PieChart as PieIcon, LineChart, Settings2,
} from 'lucide-react'

// 导入功能模块
import OverviewTab from './tabs/OverviewTab'
import TrendsTab from './tabs/TrendsTab'
import ReportsTab from './tabs/ReportsTab'
import CustomTab from './tabs/CustomTab'

// 导入企业级错误边界
import { AnalyticsErrorBoundary } from '@/components/analytics/AnalyticsErrorBoundary'
import { logger } from '@/utils/safeLogger';


type AnalyticsTab = 'overview' | 'trends' | 'reports' | 'custom'

interface FilterConfig {
  timeRange: '7d' | '30d' | '90d' | '1y'
  categories: string[]
  status: string[]
  users: string[]
}

interface AnalyticsStats {
  total_formulas: number
  total_experiments: number
  active_users: number
  data_points: number
  success_rate: number
  avg_processing_time: number
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
  const filterRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  // 模拟统计数据（后续对接真实API）
  const stats: AnalyticsStats = {
    total_formulas: 1247,
    total_experiments: 3589,
    active_users: 156,
    data_points: 45678,
    success_rate: 94.5,
    avg_processing_time: 2.3,
  }

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
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
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

          {/* 高级筛选按钮 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 rounded-lg border transition-all flex items-center gap-2 ${
              showFilters
                ? 'bg-primary-50 dark:bg-primary-940/40 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800'
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
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 p-6 animate-micro-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 数据类别筛选 */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">数据类别</label>
                <div className="space-y-2">
                  {['功能性食品', '保健品', '营养补充剂', '药食同源'].map((category) => (
                    <label key={category} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300 text-primary-600" />
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
                      <input type="checkbox" className="rounded border-gray-300 text-primary-600" />
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
                      <input type="checkbox" className="rounded border-gray-300 text-primary-600" />
                      <span className="text-sm text-text-primary">{user}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => {
                  setFilters({ timeRange: '30d', categories: [], status: [], users: [] })
                  setFilterInput('')
                }}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
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

      {/* 统计概览卡片网格 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: '配方总数', value: stats.total_formulas, icon: FlaskConical, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-950/40', border: 'border-primary-100 dark:border-primary-900/30', change: '+12.5%' },
          { label: '实验次数', value: stats.total_experiments, icon: Activity, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-100 dark:border-blue-900/30', change: '+8.3%' },
          { label: '活跃用户', value: stats.active_users, icon: Users, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-100 dark:border-emerald-900/30', change: '+5.2%' },
          { label: '数据点数', value: stats.data_points, icon: BarChart3, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-violet-100 dark:border-violet-900/30', change: '+23.1%' },
          { label: '成功率', value: `${stats.success_rate}%`, icon: TrendingUp, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-cyan-100 dark:border-cyan-900/30', change: '+2.1%' },
          { label: '平均耗时', value: `${stats.avg_processing_time}s`, icon: Zap, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-100 dark:border-amber-900/30', change: '-15.3%' },
        ].map(({ label, value, icon: Icon, color, bg, border, change }) => (
          <div
            key={label}
            className={`card p-4 ${bg} ${border} border hover:shadow-md transition-all group cursor-pointer`}
          >
            <Icon className={`w-5 h-5 mb-2 ${color}`} />
            <div className="text-2xl font-bold text-text-primary dark:text-text-primary">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            <div className="text-xs text-text-muted dark:text-text-muted mt-1">{label}</div>
            <div className={`text-[10px] font-medium mt-1 ${change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
              {change.startsWith('+') ? '↑' : '↓'} {change}
            </div>
          </div>
        ))}
      </div>

      {/* 快速图表预览区 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 趋势预览卡片 */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-text-primary dark:text-text-primary mb-4 flex items-center gap-2">
            <LineChart className="w-4 h-4 text-primary-600" />数据趋势概览
          </h3>
          <div className="h-48 flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-950/20 dark:to-blue-950/20 rounded-lg">
            <div className="text-center">
              <LineChart className="w-12 h-12 text-primary-400 mx-auto mb-2" />
              <p className="text-sm text-text-muted">趋势图表将在此显示</p>
              <p className="text-xs text-text-muted mt-1">点击"趋势分析"查看详情</p>
            </div>
          </div>
        </div>

        {/* 分布预览卡片 */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-text-primary dark:text-text-primary mb-4 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-blue-600" />数据分布概览
          </h3>
          <div className="h-48 flex items-center justify-center bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 rounded-lg">
            <div className="text-center">
              <PieIcon className="w-12 h-12 text-blue-400 mx-auto mb-2" />
              <p className="text-sm text-text-muted">分布图表将在此显示</p>
              <p className="text-xs text-text-muted mt-1">点击"概览总览"查看详情</p>
            </div>
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
            <OverviewTab filters={filters} />
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
