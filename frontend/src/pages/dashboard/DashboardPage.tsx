/**
 * RMFOOD 仪表盘 - 深度增强版
 * 新增：个性化配置、可拖拽布局、AI智能洞察、KPI监控
 */
import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  Sparkles, Download, Settings, AlertTriangle, Search, RefreshCw, ArrowRight, Loader2,
} from 'lucide-react'
import { useDashboardStatistics, useDashboardTrends, useFormulas, useExperiments } from '@/hooks/useQueries'
import { useAuthStore } from '@/stores/auth'
import { Card, CardContent, Button } from '@/components/ui'
import { EmptyState } from '@/components/ui/Common'
import { activityApi } from '@/api/activity'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DASHBOARD_CONFIG } from '@/config'
import { cn } from '@/lib/utils'
import { searchApi } from '@/api/search'
import i18n from '@/i18n'

import DashboardConfigManager, { CARD_CATALOG, DEFAULT_CARDS, type CardConfig, type DashboardLayout } from '@/config/dashboard'
import { DraggableCard, DashboardLayout as GridLayout, LayoutEditor, LayoutSwitcher } from '@/pages/formula/components/DashboardLayout'

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

import {
  StatsCards,
  TrendChart,
  FormulaPieChart,
  ExperimentBarChart,
  QuickActions,
  RecentFormulas,
  RecentExperiments,
  TodosList,
  ReviewQueueList,
  ActivityTimeline,
  UserRoleStats,
  TeamActivity,
} from '@/components/dashboard/cards'
import { CardSkeleton as CardSkeletonComp } from '@/components/ui/SkeletonPresets'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'

import { logger } from '@/utils/safeLogger';
// Card component mapping — replaces the ~440-line switch statement
const CARD_COMPONENTS: Record<string, React.ComponentType<any>> = {
  'stats-formulas': StatsCards,
  'stats-experiments': StatsCards,
  'stats-in-progress': StatsCards,
  'stats-completed': StatsCards,
  'chart-trends': TrendChart,
  'chart-formula-pie': FormulaPieChart,
  'chart-experiment-bar': ExperimentBarChart,
  'quick-actions': QuickActions,
  'recent-formulas': RecentFormulas,
  'recent-experiments': RecentExperiments,
  'todos': TodosList,
  'review-queue': ReviewQueueList,
  'activity-timeline': ActivityTimeline,
  'user-role-stats': UserRoleStats,
  'team-activity': TeamActivity,
  'kpi-dashboard': () => <KPIDashboard />,
  'ai-insights': () => <AIInsights />,
  'websocket-status': () => <Suspense fallback={<CardSkeletonComp className="h-32" />}><WebSocketStatus /></Suspense>,
  'real-time-sync': () => <Suspense fallback={<CardSkeletonComp className="h-32" />}><RealTimeSync /></Suspense>,
  'export-manager': () => <Suspense fallback={<CardSkeletonComp className="h-32" />}><ExportManager /></Suspense>,
  'api-integration': () => <Suspense fallback={<CardSkeletonComp className="h-32" />}><ApiIntegrationManager /></Suspense>,
  'ai-analysis': () => <Suspense fallback={<CardSkeletonComp className="h-32" />}><AIAnalysisPanel /></Suspense>,
}

// Lazy components that need layout props — rendered inline in renderCard
function renderTeamDashboardShare(currentLayout: DashboardLayout, setCurrentLayout: (layout: DashboardLayout) => void) {
  return <Suspense fallback={<CardSkeletonComp className="h-32" />}><TeamDashboardShare dashboard={currentLayout} onUpdate={setCurrentLayout} /></Suspense>
}
function renderTeamOnlineStatus(dashboardId: string) {
  return <Suspense fallback={<CardSkeletonComp className="h-32" />}><TeamOnlineStatus dashboardId={dashboardId} /></Suspense>
}
function renderChangeHistory(dashboardId: string) {
  return <Suspense fallback={<CardSkeletonComp className="h-32" />}><ChangeHistory dashboardId={dashboardId} /></Suspense>
}
function renderTemplateManager(currentLayout: DashboardLayout, setCurrentLayout: (layout: DashboardLayout) => void) {
  return <Suspense fallback={<CardSkeletonComp className="h-32" />}><TemplateManager currentLayout={currentLayout} onUpdate={setCurrentLayout} /></Suspense>
}

interface CardRenderProps {
  card: CardConfig
  data: {
    formulas: { total: number; by_status: Record<string, number> }
    experiments: { total: number; by_status: Record<string, number> }
    users?: { total: number; by_role?: Record<string, number> }
  } | null
  trendsData: { data: { date: string; formulas_created: number; experiments_created: number; formulas_approved: number }[] } | null
  // C-02: 卡片直接消费 API 分页响应（items），去掉 renderCard 中间映射
  formulasData: { items?: any[] } | null
  experimentsData: { items?: any[] } | null
  todos: { type: string; id: number | string; title: string; detail: string; priority: 'high' | 'medium' | 'low' }[]
  reviewQueue: { id: number | string; name: string; code: string; creator_name: string; target_effects: string[] }[]
  timeline: { type: string; id: number | string; event: string; title: string; created_at: string; status: string }[]
  navigate: (url: string) => void
  currentLayout: DashboardLayout
  setCurrentLayout: (layout: DashboardLayout) => void
  // 加载/错误/重试状态
  statsLoading?: boolean
  statsError?: Error | null
  refetchStats?: () => void
  trendsLoading?: boolean
  trendsError?: Error | null
  formulasLoading?: boolean
  formulasError?: Error | null
  refetchFormulas?: () => void
  experimentsLoading?: boolean
  experimentsError?: Error | null
  refetchExperiments?: () => void
  todosLoading?: boolean
  todosError?: Error | null
  refetchTodos?: () => void
  reviewQueueLoading?: boolean
  reviewQueueError?: Error | null
  refetchReviewQueue?: () => void
  timelineLoading?: boolean
  timelineError?: Error | null
  refetchTimeline?: () => void
  refetchTrends?: () => void
  refetchAIInsights?: () => void
}

function renderCard({ card, data, trendsData, formulasData, experimentsData, todos, reviewQueue, timeline, navigate, currentLayout, setCurrentLayout, statsLoading, statsError, refetchStats, trendsLoading, trendsError, formulasLoading, formulasError, refetchFormulas, experimentsLoading, experimentsError, refetchExperiments, todosLoading, todosError, refetchTodos, reviewQueueLoading, reviewQueueError, refetchReviewQueue, timelineLoading, timelineError, refetchTimeline }: CardRenderProps) {
  // Data preparation moved into individual card components
  const statIndexMap: Record<string, number> = {
    'stats-formulas': 0, 'stats-experiments': 1, 'stats-in-progress': 2, 'stats-completed': 3,
  }

  // Prepare data for each card type
  const props: Record<string, any> = {
    card, data, trendsData, formulasData, experimentsData, todos, reviewQueue, timeline, navigate, currentLayout, setCurrentLayout,
  }

  // Stats cards — idx 0=formulas total, 1=experiments total, 2=in-progress experiments, 3=completed experiments
  if (statIndexMap[card.type] !== undefined) {
    const idx = statIndexMap[card.type]
    const formulasTotal = (data?.formulas?.total ?? 0) as number
    const experimentsTotal = (data?.experiments?.total ?? 0) as number
    const experimentsByStatus = (data?.experiments?.by_status || {}) as Record<string, number>

    if (idx === 0) {
      props.total = formulasTotal
    } else if (idx === 1) {
      props.total = experimentsTotal
    } else if (idx === 2) {
      props.total = experimentsByStatus['in_progress'] ?? 0
    } else {
      props.total = experimentsByStatus['completed'] ?? 0
    }
    // P0-01: 统计卡需按索引映射图标与文案，缺失会导致 4 张卡渲染同一内容
    props.statIndex = idx
    props.loading = statsLoading
    props.error = statsError
    props.onRetry = refetchStats
  }

  // Trend chart
  if (card.type === 'chart-trends') {
    props.data = trendsData?.data ?? []
    props.loading = trendsLoading
    props.error = trendsError
  }

  // Pie chart
  if (card.type === 'chart-formula-pie') {
    const byStatus = data?.formulas?.by_status
    const entries = byStatus
      ? Object.entries(byStatus).filter(([, value]) => typeof value === 'number' && value > 0).map(([status, value]) => ({
          name: i18n.exists(`common.statusLabels.${status}`) ? i18n.t(`common.statusLabels.${status}`) : status, value, key: status,
        }))
      : []
    props.data = entries
    props.loading = statsLoading
    props.error = statsError
    props.onRetry = refetchStats
  }

  // Bar chart
  if (card.type === 'chart-experiment-bar') {
    const byStatus = data?.experiments?.by_status
    const entries = byStatus
      ? Object.entries(byStatus).filter(([, value]) => typeof value === 'number' && value > 0).map(([status, value]) => ({
          name: i18n.exists(`common.statusLabels.${status}`) ? i18n.t(`common.statusLabels.${status}`) : status, count: value, key: status,
        }))
      : []
    props.data = entries
    props.loading = statsLoading
    props.error = statsError
    props.onRetry = refetchStats
  }

  // C-02: 直接传 API 响应，卡片内部消费 items
  // Recent formulas
  if (card.type === 'recent-formulas') {
    props.items = (formulasData?.items ?? null) as Parameters<typeof RecentFormulas>[0]['items']
    props.loading = formulasLoading
    props.error = formulasError
    props.onRetry = refetchFormulas
  }

  // Recent experiments
  if (card.type === 'recent-experiments') {
    props.items = (experimentsData?.items ?? null) as Parameters<typeof RecentExperiments>[0]['items']
    props.loading = experimentsLoading
    props.error = experimentsError
    props.onRetry = refetchExperiments
  }

  // Todos
  if (card.type === 'todos') {
    props.items = todos
    props.loading = todosLoading
    props.error = todosError
    props.onRetry = refetchTodos
  }

  // Review queue
  if (card.type === 'review-queue') {
    props.items = reviewQueue
    props.loading = reviewQueueLoading
    props.error = reviewQueueError
    props.onRetry = refetchReviewQueue
  }

  // Activity timeline
  if (card.type === 'activity-timeline') {
    props.items = timeline
    props.loading = timelineLoading
    props.error = timelineError
    props.onRetry = refetchTimeline
  }

  // API-05：用户角色分布
  if (card.type === 'user-role-stats') {
    props.byRole = (data?.users?.by_role || {}) as Record<string, number>
    props.total = data?.users?.total ?? 0
    props.loading = statsLoading
  }

  // 团队活动：聚合「在线协作者 + 最近动态」，替代原「即将上线」占位
  if (card.type === 'team-activity') {
    const Cmp = CARD_COMPONENTS['team-activity'] as React.ComponentType<{
      timeline: typeof timeline
      timelineLoading?: boolean
    }>
    return <Cmp timeline={timeline} timelineLoading={timelineLoading} />
  }

  // AI insights — API-03: 由卡片内部 useAIInsights 统一管理加载/错误态，
  // 页面不再注入 loading/error/onRetry（否则会与卡片自身查询状态冲突）

  // Layout-dependent lazy components
  if (card.type === 'team-dashboard-share') {
    return renderTeamDashboardShare(currentLayout, setCurrentLayout)
  }
  if (card.type === 'team-online-status') {
    return renderTeamOnlineStatus(currentLayout.id)
  }
  if (card.type === 'change-history') {
    return renderChangeHistory(currentLayout.id)
  }
  if (card.type === 'template-manager') {
    return renderTemplateManager(currentLayout, setCurrentLayout)
  }

  const Component = CARD_COMPONENTS[card.type]
  if (Component) {
    return <Component {...props} />
  }

  // Fallback for unknown card types
  return (
    <Card>
      <CardContent className="p-[var(--space-apple-lg)]">
        <EmptyState icon={<Sparkles size={48} />} title={card.title} description={i18n.t('pages.dashboard.comingSoon')} />
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [trendPeriod, setTrendPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStatistics()
  const { data: trendsData, isLoading: trendsLoading, error: trendsError } = useDashboardTrends(trendPeriod)
  const { data: formulasData, isLoading: formulasLoading, error: formulasError, refetch: refetchFormulas } = useFormulas({ page: 1, page_size: 5 })
  const { data: experimentsData, isLoading: experimentsLoading, error: experimentsError, refetch: refetchExperiments } = useExperiments({ page: 1, page_size: 5 })

  // 活动数据 — 延迟加载（staleTime 5 分钟，不阻塞首屏）
  const { data: timelineData, isLoading: timelineLoading, error: timelineError, refetch: refetchTimeline } = useQuery({
    queryKey: ['activity-timeline'],
    queryFn: ({ signal }) => activityApi.timeline(7, signal),
    staleTime: 5 * 60_000,
    enabled: !statsLoading && !trendsLoading,
  })
  const { data: todosData, isLoading: todosLoading, error: todosError, refetch: refetchTodos } = useQuery({
    queryKey: ['activity-todos'],
    queryFn: ({ signal }) => activityApi.todos(signal),
    staleTime: 5 * 60_000,
    enabled: !statsLoading && !trendsLoading,
  })
  const { data: reviewQueueData, isLoading: reviewQueueLoading, error: reviewQueueError, refetch: refetchReviewQueue } = useQuery({
    queryKey: ['activity-review-queue'],
    queryFn: ({ signal }) => activityApi.reviewQueue(signal),
    staleTime: 5 * 60_000,
    enabled: !statsLoading && !trendsLoading,
  })

  const todos = todosData?.items ?? []
  const reviewQueue = reviewQueueData?.items ?? []
  const timeline = timelineData?.items ?? []

  // AI 洞察数据 — API-03：卡片组件内部 useAIInsights 使用同一 queryKey 与 staleTime（5min），
  // 页面级不再持有独立查询（避免同页双查）；「刷新」按钮通过 invalidate 使卡片侧缓存失效后重新拉取
  const qc = useQueryClient()
  const refetchAIInsights = useCallback(
    () => qc.invalidateQueries({ queryKey: ['ai-insights'], refetchType: 'none' }),
    [qc],
  )

  // 全局加载状态：关键数据未就绪时显示全局骨架
  const isInitialLoading = statsLoading || trendsLoading || formulasLoading || experimentsLoading

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

  const [layoutColumns, setLayoutColumns] = useState(() => currentLayout.gridColumns ?? 4)
  const [layoutGap, setLayoutGap] = useState(() => currentLayout.gridGap ?? 16)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ type: string; id: number; title: string; to: string }>>([])
  const [showSearch, setShowSearch] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [searching, setSearching] = useState(false)

  // 搜索防抖 — 调用后端 /search/global API
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([])
        setHasSearched(false)
        return
      }
      setSearching(true)
      try {
        const response = await searchApi.global(searchQuery, 'formula,experiment', 10)
        if (cancelled) return
        const results: Array<{ type: string; id: number; title: string; to: string }> = []
        // 后端返回结构: { types: { formula: { items: [...] }, experiment: { items: [...] } } }
        response.types?.formula?.items?.forEach((f) => {
          results.push({ type: 'formula', id: f.id, title: f.title, to: f.url || `/formulas/${f.id}` })
        })
        response.types?.experiment?.items?.forEach((e) => {
          results.push({ type: 'experiment', id: e.id, title: e.title, to: e.url || `/experiments/${e.id}` })
        })
        setSearchResults(results.slice(0, 8))
        setHasSearched(true)
        setSelectedIndex(-1)
      } catch {
        if (!cancelled) {
          setSearchResults([])
          setHasSearched(true)
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [searchQuery])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // L-03：拖拽后同步回写 position（dnd-kit 以数组序渲染网格，position 作为语义坐标保持一致）
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeIndex = currentLayout.cards.findIndex(card => card.id === active.id)
    const overIndex = currentLayout.cards.findIndex(card => card.id === over.id)

    if (activeIndex !== -1 && overIndex !== -1) {
      const moved = arrayMove(currentLayout.cards, activeIndex, overIndex)
      const newCards = moved.map((card, index) => ({
        ...card,
        position: { x: index, y: Math.floor(index / layoutColumns) },
      }))
      const newLayout = { ...currentLayout, cards: newCards, updatedAt: new Date().toISOString() }
      setCurrentLayout(newLayout)
      DashboardConfigManager.saveLayout(newLayout)
    }
  }, [currentLayout, layoutColumns])

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

  // L-02：列/间距变更后落盘到当前布局（随 saveLayout 写入 localStorage）
  const persistGridConfig = useCallback((columns: number, gap: number) => {
    const newLayout = { ...currentLayout, gridColumns: columns, gridGap: gap, updatedAt: new Date().toISOString() }
    setCurrentLayout(newLayout)
    DashboardConfigManager.saveLayout(newLayout)
  }, [currentLayout])

  const handleColumnsChange = useCallback((col: number) => {
    setLayoutColumns(col)
    persistGridConfig(col, layoutGap)
  }, [persistGridConfig, layoutGap])

  const handleGapChange = useCallback((g: number) => {
    setLayoutGap(g)
    persistGridConfig(layoutColumns, g)
  }, [persistGridConfig, layoutColumns])

  // 切换布局时恢复该布局的网格配置（刷新/切换后保持）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 切换布局时同步网格配置到本地编辑状态
    setLayoutColumns(currentLayout.gridColumns ?? 4)
    setLayoutGap(currentLayout.gridGap ?? 16)
    // 仅随 currentLayout.id 变化触发（同布局内的卡片编辑不改网格）
  }, [currentLayout.id, currentLayout.gridColumns, currentLayout.gridGap])

  // L-06：共享 ownerId/ownerName 注入真实用户（占位值 current-user 在登录态下自动升级一次）
  useEffect(() => {
    const currentUser = user
    if (!currentUser) return
    if (currentLayout.ownerId !== 'current-user' && currentLayout.ownerId) return
    const uid = String(currentUser.id ?? 'current-user')
    const uname = currentUser.fullName || currentUser.username || ''
    if (currentLayout.ownerId === uid && currentLayout.ownerName === uname) return
    const upgraded: DashboardLayout = {
      ...currentLayout,
      ownerId: uid,
      ownerName: uname || currentLayout.ownerName,
      lastModifiedBy: uid,
      lastModifiedAt: new Date().toISOString(),
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 登录态下将布局 owner 升级为真实用户（一次性同步）
    setCurrentLayout(upgraded)
    DashboardConfigManager.saveLayout(upgraded)
  }, [user, currentLayout, setCurrentLayout])

  const handleExportDashboard = () => {
    const statusLabel = (status: string) =>
      i18n.exists(`common.statusLabels.${status}`) ? i18n.t(`common.statusLabels.${status}`) : status
    const cat = i18n.t('pages.dashboard.export.category')
    const nameCol = i18n.t('pages.dashboard.export.name')
    const valueCol = i18n.t('pages.dashboard.export.value')
    const totalLabel = i18n.t('pages.dashboard.export.total')
    const formulaLabel = i18n.t('pages.dashboard.resultTypeFormula')
    const experimentLabel = i18n.t('pages.dashboard.resultTypeExperiment')
    const rows = [[cat, nameCol, valueCol]]
    if (stats?.formulas && stats.experiments) {
      rows.push([formulaLabel, totalLabel, String(stats.formulas.total ?? 0)])
      Object.entries(stats.formulas.by_status || {}).forEach(([k, v]) => {
        if (v > 0) rows.push([formulaLabel, statusLabel(k), String(v)])
      })
      rows.push([experimentLabel, totalLabel, String(stats.experiments.total ?? 0)])
      Object.entries(stats.experiments.by_status || {}).forEach(([k, v]) => {
        if (v > 0) rows.push([experimentLabel, statusLabel(k), String(v)])
      })
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    // macOS Excel \u4e0d\u9700\u8981 BOM\uff0cWindows Excel \u9700\u8981
    const isMac = /Mac/.test(navigator.userAgent)
    const blob = new Blob([isMac ? csv : '\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `仪表盘数据_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const visibleCards = currentLayout.cards.filter(card => card.isVisible)

  // L-01：预设布局「应用」为整卡替换语义（而非追加），并落盘
  const applyPresetLayout = useCallback((presetCards: Array<{ type: string; position: { x: number; y: number }; size: { w: number; h: number } }>) => {
    const newCards: CardConfig[] = presetCards.map((item, index) => {
      const allCards = [...CARD_CATALOG.default, ...CARD_CATALOG.premium]
      const info = allCards.find(c => c.type === item.type)
      return {
        id: `card-${Date.now()}-${index}`,
        type: item.type as CardConfig['type'],
        title: info?.name ?? item.type,
        description: info?.description ?? '',
        position: item.position,
        size: item.size,
        isVisible: true,
      }
    })
    const newLayout = { ...currentLayout, cards: newCards, updatedAt: new Date().toISOString() }
    setCurrentLayout(newLayout)
    DashboardConfigManager.saveLayout(newLayout)
    setShowEditor(false)
  }, [currentLayout])

  return (
    <div className="min-h-screen">
      <div className="space-y-4 max-w-[1600px] mx-auto px-2 sm:px-5 lg:px-[var(--space-apple-lg)] py-4 sm:py-[var(--space-apple-lg)]">
      {/* 欢迎横幅 + 内嵌布局控制 — 移动端紧凑化（避免“大色块+大按钮”的粗放观感） */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-4 sm:p-[var(--space-apple-lg)] shadow-sm">
        {/* 第一行：欢迎信息 + 趋势周期切换 */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {/* A-13：站品牌名已由 <h1> 降级为 <div>（见 MainLayout），
                页面主标题顺位升级为 h1，保证「按标题导航」能直达页面主题。 */}
            <h1 className="text-lg sm:text-xl font-semibold leading-snug tracking-tight truncate">
              {t('pages.dashboard.welcomeBack')}, {user?.fullName ?? user?.username}
            </h1>
            <p className="mt-0.5 text-white/80 text-xs sm:text-sm truncate">{t('pages.dashboard.startWork')}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label={t('pages.dashboard.trend')}>
            <span className="hidden sm:inline text-xs font-medium uppercase tracking-wider">{t('pages.dashboard.trend')}</span>
            <div className="flex items-center bg-black/15 dark:bg-[var(--bg-secondary)]/15 rounded-[var(--radius-pill)] overflow-hidden">
              {DASHBOARD_CONFIG.periodOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setTrendPeriod(opt.key)}
                  className={`px-3 sm:px-[var(--space-apple-md)] py-1.5 sm:py-2 min-h-[44px] text-xs font-medium transition-colors ${
                    trendPeriod === opt.key
                      ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-tertiary)] text-[var(--color-primary-text)] dark:text-neutral-50'
                      : 'text-white/90 hover:text-white'
                  }`}
                  aria-label={t('pages.dashboard.switchPeriodAria', { label: t(`pages.dashboard.period.${opt.key}`) })}
                  aria-pressed={trendPeriod === opt.key}
                >
                  {t(`pages.dashboard.period.${opt.key}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* 第二行：操作工具栏 */}
        <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 sm:pt-[var(--space-apple-sm)] sm:mt-[var(--space-apple-sm)] border-t border-white/10">
            {/* 全局搜索 */}
            <div className="relative flex items-center gap-2 bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)]/15 rounded-[var(--radius-pill)] px-[var(--space-apple-md)] py-1.5 focus-within:ring-0 focus-within:outline-none flex-1 min-w-[200px]">
              <Search size={14} className="text-[var(--text-muted)] shrink-0" aria-hidden="true" />
              <input
                type="text"
                placeholder={t('pages.dashboard.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true) }}
                onFocus={() => setShowSearch(true)}
                onBlur={() => setTimeout(() => setShowSearch(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowSearch(false)
                    setSearchQuery('')
                    setSelectedIndex(-1)
                    return
                  }
                  if (e.key === 'ArrowDown' && searchResults.length > 0) {
                    e.preventDefault()
                    setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0))
                    return
                  }
                  if (e.key === 'ArrowUp' && searchResults.length > 0) {
                    e.preventDefault()
                    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1))
                    return
                  }
                  if (e.key === 'Enter') {
                    const target = searchResults[selectedIndex] || searchResults[0]
                    if (target) {
                      navigate(target.to)
                      setShowSearch(false)
                      setSearchQuery('')
                      setSelectedIndex(-1)
                    }
                  }
                }}
                className="bg-transparent text-[var(--text-primary)] placeholder-neutral-400 dark:placeholder-white/60 text-sm outline-none focus:ring-0 focus-visible:ring-0 focus:outline-none focus-visible:outline-none flex-1 min-w-0"
                style={{ outline: 'none', boxShadow: 'none' }}
                aria-label={t('pages.dashboard.searchAria')}
              />
              {searching && <Loader2 size={12} className="animate-spin text-[var(--text-muted)] shrink-0" role="status" aria-label={t('pages.dashboard.searching')} />}
              {showSearch && hasSearched && (
                <div className="absolute top-full mt-2 left-0 w-72 bg-[var(--card-bg)] rounded-[var(--radius-Apple-md)] shadow-lg border border-[var(--border-color)] py-2 z-50">
                  {searchResults.length > 0 ? (
                    searchResults.map((r, idx) => (
                      <Link
                        key={`${r.type}-${r.id}`}
                        to={r.to}
                        onMouseDown={(e) => { e.preventDefault(); setShowSearch(false); setSearchQuery(''); navigate(r.to) }}
                        className={cn(
                          'flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-md)] py-2.5 hover:bg-[var(--bg-secondary)] transition-colors',
                          selectedIndex === idx && 'bg-[var(--bg-secondary)]'
                        )}
                      >
                        <span className="text-xs px-1.5 py-0.5 rounded-[var(--radius-pill)] font-medium" style={r.type === 'formula' ? { backgroundColor: 'var(--color-primary-container)', color: 'var(--color-primary-text)' } : { backgroundColor: 'var(--color-secondary-container)', color: 'var(--color-secondary)' }}>{r.type === 'formula' ? t('pages.dashboard.resultTypeFormula') : t('pages.dashboard.resultTypeExperiment')}</span>
                        <span className="text-sm text-[var(--text-primary)] truncate">{r.title}</span>
                        <ArrowRight size={12} className="text-[var(--text-muted)] ml-auto shrink-0" aria-hidden="true" />
                      </Link>
                    ))
                  ) : (
                    <div className="px-[var(--space-apple-md)] py-[var(--space-apple-sm)] text-sm text-[var(--text-muted)] text-center">{t('pages.dashboard.noResults')}</div>
                  )}
                </div>
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={<Sparkles size={16} />}
              onClick={() => navigate('/ai')}
            >
              <span className="hidden sm:inline">{t('pages.dashboard.aiReady')}</span>
            </Button>

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

            <Button
              variant="ghost"
              size="sm"
              icon={<Settings size={14} />}
              onClick={() => setIsEditMode(!isEditMode)}
              className={isEditMode
                ? 'bg-[var(--bg-secondary)]/95 text-[var(--color-primary-text)] hover:bg-[var(--bg-secondary)] shadow-sm'
                : 'text-white/90 hover:text-white hover:bg-[var(--bg-secondary)]/10'
              }
              aria-label={isEditMode ? t('pages.dashboard.exitEditMode') : t('pages.dashboard.enterEditMode')}
            >
              <span className="hidden sm:inline">{isEditMode ? t('pages.dashboard.finishEdit') : t('pages.dashboard.editLayout')}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={14} />}
              onClick={handleExportDashboard}
              aria-label={t('pages.dashboard.exportDashboardAria')}
            >
              <span className="hidden sm:inline">{t('pages.dashboard.exportData')}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={() => {
                refetchStats()
                refetchFormulas()
                refetchExperiments()
                refetchAIInsights()
              }}
              title={t('pages.dashboard.refreshData')}
              aria-label={t('pages.dashboard.refreshDashboardAria')}
            >
              <span className="hidden sm:inline">{t('pages.dashboard.refresh')}</span>
            </Button>

            {/* 编辑模式下的布局控制 — 内嵌于横幅右侧 */}
            {isEditMode && (
              <div className="flex items-center gap-[var(--space-apple-sm)] pl-[var(--space-apple-md)] border-l border-white/20 ml-1" role="group" aria-label={t('pages.dashboard.layoutSettings')}>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-white/90 font-medium uppercase tracking-wider">{t('pages.dashboard.columns')}</span>
                  <div className="flex items-center bg-black/15 dark:bg-[var(--bg-secondary)]/15 rounded-[var(--radius-pill)] overflow-hidden">
                    {[2, 3, 4, 5, 6].map((col) => (
                      <button
                        key={col}
                        onClick={() => handleColumnsChange(col)}
                        className={`px-[var(--space-apple-sm)] py-2 min-h-[44px] text-xs font-medium transition-colors ${
                          layoutColumns === col
                            ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-tertiary)] text-[var(--color-primary-text)] dark:text-neutral-50'
                            : 'text-white/90 hover:text-white'
                        }`}
                        aria-label={t('pages.dashboard.switchToColLayout', { col })}
                        aria-pressed={layoutColumns === col}
                      >
                        {col}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-white/90 font-medium uppercase tracking-wider">{t('pages.dashboard.gap')}</span>
                  <div className="flex items-center bg-black/15 dark:bg-[var(--bg-secondary)]/15 rounded-[var(--radius-pill)] overflow-hidden">
                    {[8, 16, 24].map((g) => (
                      <button
                        key={g}
                        onClick={() => handleGapChange(g)}
                        className={`px-[var(--space-apple-sm)] py-2 min-h-[44px] text-xs font-medium transition-colors ${
                          layoutGap === g
                            ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-tertiary)] text-[var(--color-primary-text)] dark:text-neutral-50'
                            : 'text-white/90 hover:text-white'
                        }`}
                        aria-label={t('pages.dashboard.gapAria', { g })}
                        aria-pressed={layoutGap === g}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* 编辑模式提示 */}
      {isEditMode && (
        <div className="p-[var(--space-apple-md)] rounded-[var(--radius-Apple-sm)] border" style={{ backgroundColor: 'var(--color-warning-container)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />
              <p className="text-sm" style={{ color: 'var(--color-warning-text)' }}>
                {t('pages.dashboard.editModeEnabled')}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowEditor(true)}
              aria-label={t('pages.dashboard.addCard')}
            >
              {t('pages.dashboard.addCard')}
            </Button>
          </div>
        </div>
      )}

      {/* 主要内容区域 — 全局骨架或真实内容 */}
      {isInitialLoading ? (
        <DashboardSkeleton />
      ) : (
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
          >
            {visibleCards.map((card) => (
              <DraggableCard
                key={card.id}
                card={card}
                onUpdate={updateCard}
                onRemove={() => updateCard(card.id, { isVisible: false })}
                onDuplicate={duplicateCard}
                disabled={!isEditMode}
                // L-05：编辑状态统一由页面 isEditMode 单源控制
                isEditing={isEditMode}
                onExitEdit={() => setIsEditMode(false)}
                aria-label={t('pages.dashboard.cardAria', { title: card.title })}
              >
                {renderCard({
                  card,
                  data: stats ? {
                    formulas: { total: stats.formulas?.total ?? 0, by_status: stats.formulas?.by_status || {} },
                    experiments: { total: stats.experiments?.total ?? 0, by_status: stats.experiments?.by_status || {} },
                    users: stats.users ? { total: stats.users.total ?? 0, by_role: stats.users.by_role ?? {} } : undefined,
                  } : null,
                  trendsData: trendsData || null,
                  formulasData: formulasData || null,
                  experimentsData: experimentsData || null,
                  todos,
                  reviewQueue,
                  timeline,
                  navigate,
                  currentLayout,
                  setCurrentLayout,
                  statsLoading,
                  statsError,
                  refetchStats,
                  trendsLoading,
                  trendsError,
                  formulasLoading,
                  formulasError,
                  refetchFormulas,
                  experimentsLoading,
                  experimentsError,
                  refetchExperiments,
                  todosLoading,
                  todosError,
                  refetchTodos,
                  reviewQueueLoading,
                  reviewQueueError,
                  refetchReviewQueue,
                  timelineLoading,
                  timelineError,
                  refetchTimeline,
                  refetchAIInsights,
                })}
              </DraggableCard>
            ))}
          </GridLayout>
        </SortableContext>

        <DragOverlay />
      </DndContext>
      )}

      {/* 布局编辑器 */}
      <LayoutEditor
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        availableCards={[
          ...CARD_CATALOG.default,
          ...CARD_CATALOG.premium,
        ]}
        onAddCard={addCard}
        onApplyPreset={applyPresetLayout}
      />

      </div>
    </div>
  )
}

