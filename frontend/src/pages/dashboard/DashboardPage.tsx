/**
 * RMFOOD 仪表盘 - 深度增强版
 * 新增：个性化配置、可拖拽布局、通知中心、AI智能洞察、KPI监控
 */
import { useState, useCallback, lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  FlaskConical, TestTubes, TrendingUp, Clock, BarChart3, Plus,
  ArrowRight, Brain, Database, Sparkles, ClipboardList, CheckCircle2,
  AlertTriangle, Activity, Download, Settings,
} from 'lucide-react'
import { useDashboardStatistics, useDashboardTrends, useFormulas, useExperiments } from '@/hooks/useQueries'
import { useAuthStore } from '@/stores/auth'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import { StatusBadge, Skeleton, EmptyState } from '@/components/ui/Common'
import { activityApi, type TimelineEvent, type TodoItem, type ReviewQueueItem } from '@/api/activity'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { STATUS_CONFIG, DASHBOARD_CONFIG } from '@/config'
import DashboardConfigManager, { CARD_CATALOG, DEFAULT_CARDS, type CardConfig, type DashboardLayout } from '@/config/dashboard'
import { DraggableCard, DashboardLayout as GridLayout, LayoutEditor, LayoutSwitcher } from '@/pages/formula/components/DashboardLayout'
import { NotificationCenter, NotificationBadge } from '@/pages/formula/components/NotificationCenter'
import { AIInsights, KPIDashboard } from '@/pages/formula/components/AIInsights'

// 懒加载非首屏组件
const RealTimeSync = lazy(() => import('@/components/dashboard/RealTimeSync').then(m => ({ default: m.RealTimeSync })))
const TeamDashboardShare = lazy(() => import('@/components/dashboard/TeamDashboardShare').then(m => ({ default: m.TeamDashboardShare })))
const TeamOnlineStatus = lazy(() => import('@/components/dashboard/TeamOnlineStatus').then(m => ({ default: m.TeamOnlineStatus })))
const ChangeHistory = lazy(() => import('@/components/dashboard/ChangeHistory').then(m => ({ default: m.ChangeHistory })))
const TemplateManager = lazy(() => import('@/components/dashboard/TemplateManager').then(m => ({ default: m.TemplateManager })))
const ExportManager = lazy(() => import('@/components/dashboard/ExportManager').then(m => ({ default: m.ExportManager })))
const ApiIntegrationManager = lazy(() => import('@/components/dashboard/ApiIntegrationManager').then(m => ({ default: m.ApiIntegrationManager })))
const AIAnalysisPanel = lazy(() => import('@/components/dashboard/AIAnalysisPanel').then(m => ({ default: m.AIAnalysisPanel })))
const WebSocketStatus = lazy(() => import('@/components/ui/WebSocketStatus').then(m => ({ default: m.WebSocketStatus })))

const STATUS_COLORS = STATUS_CONFIG.colors
const STATUS_LABELS = STATUS_CONFIG.labels

import { CHART_TYPOGRAPHY } from '../../utils/typography';
import { logger } from '@/utils/safeLogger';

// 懒加载骨架屏占位
function CardSkeleton() {
  return (
    <Card className="shadow-md">
      <CardContent className="p-6 space-y-3 animate-pulse">
        <div className="h-5 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-20 w-full rounded bg-slate-200 dark:bg-slate-700" />
      </CardContent>
    </Card>
  )
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    backdropFilter: 'blur(16px)',
    borderRadius: '14px',
    border: '1px solid rgba(226,232,240,0.9)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
    padding: '14px 18px',
    fontSize: CHART_TYPOGRAPHY.tooltipContent.fontSize + 'px',
  },
  itemStyle: { padding: '4px 0' },
  labelStyle: {
    fontWeight: CHART_TYPOGRAPHY.tooltipTitle.fontWeight,
    marginBottom: 6,
    color: 'var(--color-text-primary, #1E293B)',
  },
}

interface DashboardData {
  formulas: {
    total: number
    by_status: Record<string, number>
  }
  experiments: {
    total: number
    by_status: Record<string, number>
  }
}

interface TrendsData {
  data: {
    date: string
    formulas_created: number
    experiments_created: number
    formulas_approved: number
  }[]
}

interface FormulaData {
  id: number
  name: string
  code: string
  status: string
  created_at: string
  creator_name: string
}

interface ExperimentData {
  id: number
  title: string
  code: string
  formula_id: number
  formula_name: string
  status: string
  created_at: string
}

interface CardRenderProps {
  card: CardConfig
  data: DashboardData | null
  trendsData: TrendsData | null
  formulasData: { items: FormulaData[] } | null
  experimentsData: { items: ExperimentData[] } | null
  todos: TodoItem[]
  reviewQueue: ReviewQueueItem[]
  timeline: TimelineEvent[]
  navigate: (url: string) => void
  currentLayout: DashboardLayout
  setCurrentLayout: (layout: DashboardLayout) => void
}

interface PieData {
  name: string
  value: number
  key: string
}

interface BarData {
  name: string
  count: number
  key: string
}

function renderCard({ card, data, trendsData, formulasData, experimentsData, todos, reviewQueue, timeline, navigate, currentLayout, setCurrentLayout }: CardRenderProps) {
  const statCards = [
    { label: DASHBOARD_CONFIG.statCardLabels.formulas, value: data?.formulas?.total ?? 0, icon: FlaskConical, variant: 'primary' as const, iconBg: 'bg-primary-100 dark:bg-primary-900/30', iconColor: 'var(--color-primary)' },
    { label: DASHBOARD_CONFIG.statCardLabels.experiments, value: data?.experiments?.total ?? 0, icon: TestTubes, variant: 'secondary' as const, iconBg: 'bg-secondary-100 dark:bg-secondary-900/30', iconColor: 'var(--color-secondary)' },
    { label: DASHBOARD_CONFIG.statCardLabels.inProgressExperiments, value: data?.experiments?.by_status?.in_progress ?? 0, icon: TrendingUp, variant: 'info' as const, iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'var(--color-info)' },
    { label: DASHBOARD_CONFIG.statCardLabels.completedExperiments, value: data?.experiments?.by_status?.completed ?? 0, icon: CheckCircle2, variant: 'success' as const, iconBg: 'bg-green-100 dark:bg-green-900/30', iconColor: 'var(--color-success)' },
  ]

  const formulaPieData: PieData[] = data?.formulas?.by_status
    ? Object.entries(data.formulas.by_status).filter(([, value]) => value > 0).map(([status, value]) => ({ name: (STATUS_LABELS as any)[status] ?? status, value, key: status }))
    : []

  const experimentBarData: BarData[] = data?.experiments?.by_status
    ? Object.entries(data.experiments.by_status).filter(([, value]) => value > 0).map(([status, value]) => ({ name: (STATUS_LABELS as any)[status] ?? status, count: value, key: status }))
    : []

  const trendChartData = trendsData?.data?.map((d) => ({
    date: d.date.slice(5),
    [DASHBOARD_CONFIG.chartLabels.newFormulas]: d.formulas_created,
    [DASHBOARD_CONFIG.chartLabels.newExperiments]: d.experiments_created,
    [DASHBOARD_CONFIG.chartLabels.approvedFormulas]: d.formulas_approved,
  })) ?? []

  const quickActions = [
    { to: '/formulas/new', icon: Plus, title: '新建配方', desc: '药食同源配方', color: 'from-primary-500 to-primary-600' },
    { to: '/experiments', icon: TestTubes, title: '实验管理', desc: '查看所有实验', color: 'from-violet-500 to-purple-600' },
    { to: '/formulas?status=pending_review', icon: Clock, title: '待审核配方', desc: '审核配方方案', color: 'from-amber-500 to-orange-500' },
    { to: '/ai', icon: Brain, title: 'AI智能助手', desc: '配方生成/分析', color: 'from-primary-500 to-teal-600' },
    { to: '/databases', icon: Database, title: '数据库检索', desc: 'TCMSP / DFBP', color: 'from-sky-500 to-blue-600' },
  ]

  switch (card.type) {
    case 'stats-formulas': {
      const stat1 = statCards[0]
      const Icon1 = stat1.icon
      return (
        <Card hoverable className="h-full px-6 py-4 shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
          <div className="flex flex-col h-full">
            <p className="text-sm font-semibold mb-4 text-gray-600 dark:text-gray-400">{stat1.label}</p>
            <div className="flex items-center justify-between flex-1">
              <div className="flex items-center gap-4">
                <p className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">{stat1.value}</p>
                <div className={`w-10 h-10 rounded-xl ${stat1.iconBg} flex items-center justify-center transition-all duration-300`} style={{ minWidth: '2.5rem', backgroundColor: stat1.iconBg.includes('primary') ? 'var(--color-primary-container)' : undefined }}>
                  <Icon1 size={20} style={{ color: stat1.iconColor }} />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )
    }

    case 'stats-experiments': {
      const stat2 = statCards[1]
      const Icon2 = stat2.icon
      return (
        <Card hoverable className="h-full px-6 py-4 shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
          <div className="flex flex-col h-full">
            <p className="text-sm font-semibold mb-4 text-gray-600 dark:text-gray-400">{stat2.label}</p>
            <div className="flex items-center justify-between flex-1">
              <div className="flex items-center gap-4">
                <p className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">{stat2.value}</p>
                <div className={`w-10 h-10 rounded-xl ${stat2.iconBg} flex items-center justify-center transition-all duration-300`} style={{ minWidth: '2.5rem' }}>
                  <Icon2 size={20} style={{ color: stat2.iconColor }} />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )
    }

    case 'stats-in-progress': {
      const stat3 = statCards[2]
      const Icon3 = stat3.icon
      return (
        <Card hoverable className="h-full px-6 py-4 shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
          <div className="flex flex-col h-full">
            <p className="text-sm font-semibold mb-4 text-gray-600 dark:text-gray-400">{stat3.label}</p>
            <div className="flex items-center justify-between flex-1">
              <div className="flex items-center gap-4">
                <p className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">{stat3.value}</p>
                <div className={`w-10 h-10 rounded-xl ${stat3.iconBg} flex items-center justify-center transition-all duration-300`} style={{ minWidth: '2.5rem' }}>
                  <Icon3 size={20} style={{ color: stat3.iconColor }} />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )
    }

    case 'stats-completed': {
      const stat4 = statCards[3]
      const Icon4 = stat4.icon
      return (
        <Card hoverable className="h-full px-6 py-4 shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
          <div className="flex flex-col h-full">
            <p className="text-sm font-semibold mb-4 text-gray-600 dark:text-gray-400">{stat4.label}</p>
            <div className="flex items-center justify-between flex-1">
              <div className="flex items-center gap-4">
                <p className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">{stat4.value}</p>
                <div className={`w-10 h-10 rounded-xl ${stat4.iconBg} flex items-center justify-center transition-all duration-300`} style={{ minWidth: '2.5rem' }}>
                  <Icon4 size={20} style={{ color: stat4.iconColor }} />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )
    }

    case 'chart-trends':
      return (
        <Card className="shadow-md hover:shadow-lg transition-all duration-300">
          <CardContent className="px-6 pt-6 pb-6">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 size={20} className="text-slate-500 dark:text-slate-400" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">研发趋势</h3>
            </div>
            {trendChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <defs>
                    <linearGradient id="colorFormula" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-purple-500, #8B5CF6)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="var(--color-purple-500, #8B5CF6)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #E2E8F0)" opacity={0.8} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-muted, #475569)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted, #475569)' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12 }} iconType="circle" iconSize={8} />
                  <Area type="monotone" dataKey="新增配方" stroke="var(--color-success)" fill="url(#colorFormula)" strokeWidth={2} />
                  <Area type="monotone" dataKey="新增实验" stroke="var(--color-purple-500, #8B5CF6)" fill="url(#colorExp)" strokeWidth={2} />
                  <Area type="monotone" dataKey="批准配方" stroke="var(--color-info)" fill="none" strokeWidth={1.5} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">暂无趋势数据</div>
            )}
          </CardContent>
        </Card>
      )

    case 'chart-formula-pie':
      return (
        <Card className="shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="px-6 pt-6 pb-4">
            <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary, #1e293b)' }}>配方状态分布</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            {formulaPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={formulaPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: 'var(--text-muted, #64748B)', strokeWidth: 1.2 }}>
                    {formulaPieData.map((entry) => (
                      <Cell key={entry.key} fill={(STATUS_COLORS as any)[entry.key] ?? 'var(--color-neutral-500, #64748B)'} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">暂无配方数据</div>
            )}
          </CardContent>
        </Card>
      )

    case 'chart-experiment-bar':
      return (
        <Card className="shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="px-6 pt-6 pb-4">
            <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary, #1e293b)' }}>实验状态统计</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            {experimentBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={experimentBarData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #E2E8F0)" horizontal={false} opacity={0.8} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--text-muted, #475569)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted, #475569)' }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={28}>
                    {experimentBarData.map((entry) => (
                      <Cell key={entry.key} fill={(STATUS_COLORS as any)[entry.key] ?? 'var(--color-neutral-500, #64748B)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">暂无实验数据</div>
            )}
          </CardContent>
        </Card>
      )

    case 'quick-actions':
      return (
        <Card className="shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="px-6 pt-6 pb-4">
            <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary, #1e293b)' }}>快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer hover:border-primary-200 dark:hover:border-primary-800/60 bg-white dark:bg-slate-900"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-md transition-all duration-300 hover:scale-110 text-white`}>
                    <action.icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{action.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{action.desc}</p>
                  </div>
                  <ArrowRight size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-primary-500 transition-all duration-300" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )

    case 'recent-formulas':
      return (
        <Card className="overflow-hidden shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary, #1e293b)' }}>最近配方</CardTitle>
              <Link to="/formulas" className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-semibold flex items-center gap-1 transition-colors">
                查看全部 <ArrowRight size={14} />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
              {!formulasData ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-6 py-3"><Skeleton className="h-5 w-3/4 mb-2" /><Skeleton className="h-3 w-1/2" /></div>
                ))
              ) : (formulasData?.items?.length ?? 0) === 0 ? (
                <div className="px-6 py-10 text-center text-slate-500 dark:text-slate-400 text-sm">暂无配方数据</div>
              ) : (
                (formulasData?.items ?? []).slice(0, 5).map((f) => (
                  <Link key={f.id} to={`/formulas/${f.id}`} className="block px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-200 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{f.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{f.code}</p>
                      </div>
                      <StatusBadge status={f.status} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )

    case 'recent-experiments':
      return (
        <Card className="overflow-hidden shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary, #1e293b)' }}>最近实验</CardTitle>
              <Link to="/experiments" className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-semibold flex items-center gap-1 transition-colors">
                查看全部 <ArrowRight size={14} />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
              {!experimentsData ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-6 py-3"><Skeleton className="h-5 w-3/4 mb-2" /><Skeleton className="h-3 w-1/2" /></div>
                ))
              ) : (experimentsData?.items?.length ?? 0) === 0 ? (
                <div className="px-6 py-10 text-center text-slate-500 dark:text-slate-400 text-sm">暂无实验数据</div>
              ) : (
                (experimentsData?.items ?? []).slice(0, 5).map((e) => (
                  <Link key={e.id} to={`/experiments/${e.id}`} className="block px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-200 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{e.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{e.code}</p>
                      </div>
                      <StatusBadge status={e.status} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )

    case 'todos':
      return (
        <Card className="overflow-hidden shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClipboardList size={18} className="text-amber-500" />
                <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary, #1e293b)' }}>待办事项</CardTitle>
              </div>
              <Badge variant="neutral" size="sm">{todos.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
              {todos.length === 0 ? (
                <div className="px-6 py-10 text-center text-slate-500 dark:text-slate-400 text-sm">暂无待办事项</div>
              ) : (
                todos.slice(0, 6).map((todo: TodoItem) => (
                  <Link
                    key={`${todo.type}-${todo.id}`}
                    to={
                      todo.type === 'review_formula' ? `/formulas/${todo.id}` :
                      `/experiments/${todo.id}`
                    }
                    className="block px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        todo.priority === 'high' ? 'bg-amber-500' :
                        todo.priority === 'medium' ? 'bg-blue-500' : 'bg-slate-300',
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{todo.title}</p>
                        <p className="text-xs text-slate-400 mt-1">{todo.detail}</p>
                      </div>
                      <ArrowRight size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )

    case 'review-queue':
      return (
        <Card className="overflow-hidden shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} className="text-amber-500" />
                <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary, #1e293b)' }}>待审核配方</CardTitle>
              </div>
              <Badge variant="neutral" size="sm">{reviewQueue.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
              {reviewQueue.length === 0 ? (
                <div className="px-6 py-10 text-center text-slate-500 dark:text-slate-400 text-sm">暂无待审核配方</div>
              ) : (
                reviewQueue.slice(0, 6).map((item: ReviewQueueItem) => (
                  <Link
                    key={item.id}
                    to={`/formulas/${item.id}`}
                    className="block px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-200 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-400">{item.code}</span>
                          <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
                          <span className="text-xs text-slate-400">{item.creator_name}</span>
                        </div>
                        {item.target_effects.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.target_effects.slice(0, 3).map((e: string) => (
                              <Badge key={e} variant="primary" size="sm">{e}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <ArrowRight size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )

    case 'activity-timeline':
      return (
        <Card className="overflow-hidden shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <Activity size={18} className="text-primary-500" />
              <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary, #1e293b)' }}>最近动态</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
              {timeline.length === 0 ? (
                <div className="px-6 py-10 text-center text-slate-500 dark:text-slate-400 text-sm">暂无动态</div>
              ) : (
                timeline.slice(0, 8).map((event: TimelineEvent) => (
                  <Link
                    key={`${event.type}-${event.id}-${event.created_at}`}
                    to={event.type === 'formula' ? `/formulas/${event.id}` : `/experiments/${event.id}`}
                    className="block px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-200 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                        event.type === 'formula' ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-blue-50 dark:bg-blue-900/20',
                      )}>
                        {event.type === 'formula' ? (
                          <FlaskConical size={12} className="text-primary-600" />
                        ) : (
                          <TestTubes size={12} className="text-blue-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          <span className="font-semibold">{event.event}</span>: {event.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(event.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <StatusBadge status={event.status} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )

    case 'kpi-dashboard':
      return <KPIDashboard />

    case 'team-activity':
      return (
        <Card className="shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="px-6 pt-6 pb-4">
            <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary, #1e293b)' }}>团队活动</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            <EmptyState icon={<Sparkles size={48} />} title="即将上线" description="团队协作功能开发中，敬请期待" />
          </CardContent>
        </Card>
      )

    case 'ai-insights':
      return <AIInsights />

    case 'websocket-status':
      return <Suspense fallback={<CardSkeleton />}><WebSocketStatus /></Suspense>

    case 'real-time-sync':
      return <Suspense fallback={<CardSkeleton />}><RealTimeSync /></Suspense>

    case 'team-dashboard-share':
      return <Suspense fallback={<CardSkeleton />}><TeamDashboardShare dashboard={currentLayout} onUpdate={setCurrentLayout} /></Suspense>

    case 'team-online-status':
      return <Suspense fallback={<CardSkeleton />}><TeamOnlineStatus dashboardId={currentLayout.id} /></Suspense>

    case 'change-history':
      return <Suspense fallback={<CardSkeleton />}><ChangeHistory dashboardId={currentLayout.id} /></Suspense>

    case 'template-manager':
      return <Suspense fallback={<CardSkeleton />}><TemplateManager currentLayout={currentLayout} onUpdate={setCurrentLayout} /></Suspense>

    case 'export-manager':
      return <Suspense fallback={<CardSkeleton />}><ExportManager /></Suspense>

    case 'api-integration':
      return <Suspense fallback={<CardSkeleton />}><ApiIntegrationManager /></Suspense>

    case 'ai-analysis':
      return <Suspense fallback={<CardSkeleton />}><AIAnalysisPanel /></Suspense>

    default:
      return (
        <Card className="shadow-md hover:shadow-lg transition-all duration-300">
          <CardContent className="p-6">
            <EmptyState icon={<Sparkles size={48} />} title={card.title} description="此卡片功能即将上线" />
          </CardContent>
        </Card>
      )
  }
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [trendPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const { data: stats } = useDashboardStatistics()
  const { data: trendsData } = useDashboardTrends(trendPeriod)
  const { data: formulasData } = useFormulas({ page: 1, page_size: 5 })
  const { data: experimentsData } = useExperiments({ page: 1, page_size: 5 })

  // 活动数据
  const { data: timelineData } = useQuery({
    queryKey: ['activity-timeline'],
    queryFn: ({ signal }) => activityApi.timeline(7, signal),
    staleTime: 60_000,
  })
  const { data: todosData } = useQuery({
    queryKey: ['activity-todos'],
    queryFn: ({ signal }) => activityApi.todos(signal),
    staleTime: 60_000,
  })
  const { data: reviewQueueData } = useQuery({
    queryKey: ['activity-review-queue'],
    queryFn: ({ signal }) => activityApi.reviewQueue(signal),
    staleTime: 60_000,
  })

  const todos = todosData?.items ?? []
  const reviewQueue = reviewQueueData?.items ?? []
  const timeline = timelineData?.items ?? []

  // 仪表盘配置状态
  const [currentLayout, setCurrentLayout] = useState<DashboardLayout>(() => {
    try {
      return DashboardConfigManager.getCurrentLayout()
    } catch (error) {
      logger.error('Error loading dashboard layout:', error)
      return {
        id: 'default',
        name: '默认视图',
        isDefault: true,
        cards: DEFAULT_CARDS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isShared: false,
        ownerId: 'current-user',
        ownerName: '当前用户',
        shares: [],
        lastModifiedBy: 'current-user',
        lastModifiedAt: new Date().toISOString(),
      }
    }
  })
  const [layouts, setLayouts] = useState<DashboardLayout[]>(() => {
    try {
      return DashboardConfigManager.getAllLayouts()
    } catch (error) {
      logger.error('Error loading dashboard layouts:', error)
      return [
        {
          id: 'default',
          name: '默认视图',
          isDefault: true,
          cards: DEFAULT_CARDS,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isShared: false,
          ownerId: 'current-user',
          ownerName: '当前用户',
          shares: [],
          lastModifiedBy: 'current-user',
          lastModifiedAt: new Date().toISOString(),
        },
      ]
    }
  })
  const [isEditMode, setIsEditMode] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notificationCount, setNotificationCount] = useState(3)
  const [layoutColumns, setLayoutColumns] = useState(4)
  const [layoutGap, setLayoutGap] = useState(16)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeIndex = currentLayout.cards.findIndex(card => card.id === active.id)
    const overIndex = currentLayout.cards.findIndex(card => card.id === over.id)

    if (activeIndex !== -1 && overIndex !== -1) {
      const newCards = arrayMove(currentLayout.cards, activeIndex, overIndex)
      const newLayout = { ...currentLayout, cards: newCards, updatedAt: new Date().toISOString() }
      setCurrentLayout(newLayout)
      DashboardConfigManager.saveLayout(newLayout)
    }
  }, [currentLayout])

  const updateCard = useCallback((cardId: string, updates: Partial<CardConfig>) => {
    const newCards = currentLayout.cards.map(card =>
      card.id === cardId ? { ...card, ...updates } : card,
    )
    const newLayout = { ...currentLayout, cards: newCards, updatedAt: new Date().toISOString() }
    setCurrentLayout(newLayout)
    DashboardConfigManager.saveLayout(newLayout)
  }, [currentLayout])

  const addCard = useCallback((type: string) => {
    // 将卡片目录转换为以类型为键的对象
    const allCards = [...CARD_CATALOG.default, ...CARD_CATALOG.premium]
    const cardCatalog = allCards.reduce((acc, card) => {
      acc[card.type] = card
      return acc
    }, {} as Record<string, typeof allCards[0]>)

    const cardInfo = cardCatalog[type]
    if (!cardInfo) return

    const newCard: CardConfig = {
      id: `card-${Date.now()}`,
      type: type as CardConfig['type'],
      title: cardInfo.name,
      description: cardInfo.description,
      position: { x: 0, y: 0 },
      size: { w: 1, h: 1 },
      isVisible: true,
    }

    const newCards = [...currentLayout.cards, newCard]
    const newLayout = { ...currentLayout, cards: newCards, updatedAt: new Date().toISOString() }
    setCurrentLayout(newLayout)
    DashboardConfigManager.saveLayout(newLayout)
  }, [currentLayout])

  const duplicateCard = useCallback((cardId: string) => {
    const cardToDuplicate = currentLayout.cards.find(card => card.id === cardId)
    if (!cardToDuplicate) return

    const allCards = [...CARD_CATALOG.default, ...CARD_CATALOG.premium]
    const cardInfo = allCards.find(card => card.type === cardToDuplicate.type)
    if (!cardInfo) return

    const newCard: CardConfig = {
      id: `card-${Date.now()}`,
      type: cardToDuplicate.type,
      title: `${cardToDuplicate.title} (副本)`,
      description: cardToDuplicate.description || cardInfo.description,
      position: { x: cardToDuplicate.position.x, y: cardToDuplicate.position.y + 1 },
      size: { ...cardToDuplicate.size },
      isVisible: true,
      theme: cardToDuplicate.theme,
    }

    const newCards = [...currentLayout.cards, newCard]
    const newLayout = { ...currentLayout, cards: newCards, updatedAt: new Date().toISOString() }
    setCurrentLayout(newLayout)
    DashboardConfigManager.saveLayout(newLayout)
  }, [currentLayout])

  const switchLayout = useCallback((layoutId: string) => {
    const layout = layouts.find(l => l.id === layoutId)
    if (layout) {
      setCurrentLayout(layout)
      DashboardConfigManager.switchLayout(layoutId)
    }
  }, [layouts])

  const handleExportDashboard = () => {
    const rows = [['类别', '名称', '数值']]
    if (stats?.formulas && stats.experiments) {
      rows.push(['配方', '总数', String(stats.formulas.total ?? 0)])
      Object.entries(stats.formulas.by_status || {}).forEach(([k, v]) => {
        if (v > 0) rows.push(['配方', (STATUS_LABELS as any)[k] ?? k, String(v)])
      })
      rows.push(['实验', '总数', String(stats.experiments.total ?? 0)])
      Object.entries(stats.experiments.by_status || {}).forEach(([k, v]) => {
        if (v > 0) rows.push(['实验', (STATUS_LABELS as any)[k] ?? k, String(v)])
      })
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const BOM = '\ufeff'
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `仪表盘数据_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const visibleCards = currentLayout.cards.filter(card => card.isVisible)

  return (
    <div className="space-y-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* 欢迎横幅 */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 p-8 text-white shadow-xl">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary-400/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-primary-300/10 rounded-full translate-y-1/2 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
              {DASHBOARD_CONFIG.messages.welcomeBack}, {user?.full_name ?? user?.username}
            </h1>
            <p className="mt-2 text-white/95 text-base leading-relaxed">{DASHBOARD_CONFIG.messages.startWork}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <Button
              variant="secondary"
              size="sm"
              icon={<Sparkles size={18} />}
              onClick={() => navigate('/ai')}
              className="bg-white/12 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 hover:border-white/30 transition-all duration-200"
            >
              {DASHBOARD_CONFIG.messages.aiReady}
            </Button>

            {/* 布局切换器 */}
            <LayoutSwitcher
              currentId={currentLayout.id}
              layouts={layouts}
              onSwitch={switchLayout}
              onCreate={(name) => {
                const newLayout = DashboardConfigManager.createLayout(name)
                setLayouts(DashboardConfigManager.getAllLayouts())
                setCurrentLayout(newLayout)
              }}
              onDelete={(id) => {
                DashboardConfigManager.deleteLayout(id)
                const newLayouts = DashboardConfigManager.getAllLayouts()
                setLayouts(newLayouts)
                if (currentLayout.id === id) {
                  const defaultLayout = newLayouts.find(l => l.isDefault) || newLayouts[0]
                  setCurrentLayout(defaultLayout)
                }
              }}
              onSetDefault={(id) => {
                const newLayouts = layouts.map(l => ({ ...l, isDefault: l.id === id }))
                setLayouts(newLayouts)
                const updatedLayout = newLayouts.find(l => l.id === id)
                if (updatedLayout) {
                  setCurrentLayout(updatedLayout)
                  DashboardConfigManager.saveLayout(updatedLayout)
                }
              }}
            />

            {/* 通知徽章 */}
            <NotificationBadge
              count={notificationCount}
              onClick={() => setShowNotifications(true)}
            />

            {/* 编辑模式按钮 */}
            <Button
              variant={isEditMode ? 'primary' : 'secondary'}
              size="sm"
              icon={<Settings size={16} />}
              onClick={() => setIsEditMode(!isEditMode)}
              className={isEditMode ? 'bg-primary-500' : ''}
            >
              {isEditMode ? '完成编辑' : '编辑布局'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={16} />}
              onClick={handleExportDashboard}
              className="!text-white hover:!text-white hover:!bg-white/18 border border-white/25 transition-all duration-200"
            >
              {DASHBOARD_CONFIG.messages.exportData}
            </Button>
          </div>
        </div>
      </div>

      {/* 编辑模式提示 */}
      {isEditMode && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-amber-600" />
              <p className="text-sm text-amber-800 dark:text-amber-400">
                编辑模式已开启 - 拖拽卡片调整位置，点击卡片右上角按钮进行配置
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowEditor(true)}
            >
              添加卡片
            </Button>
          </div>
        </div>
      )}

      {/* 主要内容区域 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleCards.map(card => card.id)}
          strategy={verticalListSortingStrategy}
        >
          <GridLayout
            columns={layoutColumns}
            gap={layoutGap}
            responsive={true}
            onColumnsChange={(columns) => setLayoutColumns(columns)}
          >
            {visibleCards.map((card) => (
              <DraggableCard
                key={card.id}
                card={card}
                onUpdate={updateCard}
                onRemove={() => updateCard(card.id, { isVisible: false })}
                onDuplicate={duplicateCard}
                disabled={!isEditMode}
              >
                {renderCard({
                  card,
                  data: stats ? { formulas: { total: stats.formulas?.total ?? 0, by_status: stats.formulas?.by_status || {} }, experiments: { total: stats.experiments?.total ?? 0, by_status: stats.experiments?.by_status || {} } } : null,
                  trendsData: trendsData || null,
                  formulasData: formulasData ? { items: formulasData.items as any } : null,
                  experimentsData: experimentsData ? { items: experimentsData.items as any } : null,
                  todos,
                  reviewQueue,
                  timeline,
                  navigate,
                  currentLayout,
                  setCurrentLayout,
                })}
              </DraggableCard>
            ))}
          </GridLayout>
        </SortableContext>

        <DragOverlay />
      </DndContext>

      {/* 布局编辑器 */}
      <LayoutEditor
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        availableCards={[
          ...CARD_CATALOG.default,
          ...CARD_CATALOG.premium,
        ]}
        onAddCard={addCard}
      />

      {/* 通知中心 */}
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => {
          setShowNotifications(false)
          setNotificationCount(0)
        }}
      />
    </div>
  )
}
