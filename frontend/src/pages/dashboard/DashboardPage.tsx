/**
 * RMFOOD 仪表盘 - 深度增强版
 * 新增：个性化配置、可拖拽布局、通知中心、AI智能洞察、KPI监控
 */
import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  Sparkles, Download, Settings, AlertTriangle, Search, RefreshCw, ArrowRight,
} from 'lucide-react'
import { useDashboardStatistics, useDashboardTrends, useFormulas, useExperiments } from '@/hooks/useQueries'
import { ErrorCard } from '@/components/dashboard/cards/ErrorCard'
import { useAuthStore } from '@/stores/auth'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, StatCard } from '@/components/ui'
import { StatusBadge, Skeleton, EmptyState } from '@/components/ui/Common'
import { activityApi, type TimelineEvent, type TodoItem, type ReviewQueueItem } from '@/api/activity'
import { notificationApi } from '@/api/notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { STATUS_CONFIG, DASHBOARD_CONFIG } from '@/config'

const STATUS_LABELS = STATUS_CONFIG.labels
import DashboardConfigManager, { CARD_CATALOG, DEFAULT_CARDS, type CardConfig, type DashboardLayout } from '@/config/dashboard'
import { DraggableCard, DashboardLayout as GridLayout, LayoutEditor, LayoutSwitcher } from '@/pages/formula/components/DashboardLayout'
import { NotificationCenter, NotificationBadge } from '@/pages/formula/components/NotificationCenter'
import { AIInsights, KPIDashboard } from '@/pages/formula/components/AIInsights'
import { aiInsightsApi } from '@/api/aiInsights'
import { subscribeToChannel } from '@/services/websocket'

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
  'kpi-dashboard': () => <KPIDashboard />,
  'team-activity': () => (
    <Card>
      <CardHeader className="px-6 pt-6 pb-4">
        <CardTitle as="h3" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>团队活动</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        <EmptyState icon={<Sparkles size={48} />} title="即将上线" description="团队协作功能开发中，敬请期待" />
      </CardContent>
    </Card>
  ),
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
  data: { formulas: { total: number; by_status: Record<string, number> }; experiments: { total: number; by_status: Record<string, number> } } | null
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

function renderCard({ card, data, trendsData, formulasData, experimentsData, todos, reviewQueue, timeline, navigate, currentLayout, setCurrentLayout, statsLoading, statsError, refetchStats, trendsLoading, trendsError, refetchTrends, formulasLoading, formulasError, refetchFormulas, experimentsLoading, experimentsError, refetchExperiments, todosLoading, todosError, refetchTodos, reviewQueueLoading, reviewQueueError, refetchReviewQueue, timelineLoading, timelineError, refetchTimeline, refetchAIInsights }: CardRenderProps) {
  // Lazy-access to currentLayout/setCurrentLayout for the components that need them
  const lazyLayout = { currentLayout, setCurrentLayout }

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
          name: (STATUS_LABELS as Record<string, string>)[status] ?? status, value, key: status,
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
          name: (STATUS_LABELS as Record<string, string>)[status] ?? status, count: value, key: status,
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
      <CardContent className="p-6">
        <EmptyState icon={<Sparkles size={48} />} title={card.title} description="此卡片功能即将上线" />
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [trendPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStatistics()
  const { data: trendsData, isLoading: trendsLoading, error: trendsError, refetch: refetchTrends } = useDashboardTrends(trendPeriod)
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
  const [showNotifications, setShowNotifications] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)

  // 从后端 API 获取未读通知数（契约：GET /notifications/unread-count → { unread_count }）
  useEffect(() => {
    notificationApi.unreadCount()
      .then((data) => setNotificationCount(data.unread_count ?? 0))
      .catch(() => setNotificationCount(0))
  }, [])

  // WebSocket 推送更新通知计数
  useEffect(() => {
    const unsubscribe = subscribeToChannel('notifications', (msg) => {
      if (msg.type === 'notification.created' || msg.type === 'notification.marked_read') {
        notificationApi.unreadCount()
          .then((data) => setNotificationCount(data.unread_count ?? 0))
          .catch(() => {})
      }
    })
    return unsubscribe
  }, [])
  const [layoutColumns, setLayoutColumns] = useState(() => currentLayout.gridColumns ?? 4)
  const [layoutGap, setLayoutGap] = useState(() => currentLayout.gridGap ?? 16)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ type: string; id: number; title: string; to: string }>>([])
  const [showSearch, setShowSearch] = useState(false)

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([])
        return
      }
      const q = searchQuery.toLowerCase()
      const results: Array<{ type: string; id: number; title: string; to: string }> = []
      const formulaItems = (formulasData?.items ?? []) as { id?: number; name?: string; code?: string }[]
      const experimentItems = (experimentsData?.items ?? []) as { id?: number; title?: string; code?: string }[]
      formulaItems.forEach((f) => {
        if (f.name?.toLowerCase().includes(q) || f.code?.toLowerCase().includes(q)) {
          results.push({ type: '配方', id: f.id ?? 0, title: f.name ?? '', to: `/formulas/${f.id ?? 0}` })
        }
      })
      experimentItems.forEach((e) => {
        if (e.title?.toLowerCase().includes(q) || e.code?.toLowerCase().includes(q)) {
          results.push({ type: '实验', id: e.id ?? 0, title: e.title ?? '', to: `/experiments/${e.id ?? 0}` })
        }
      })
      setSearchResults(results.slice(0, 8))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, formulasData, experimentsData])

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
    setCurrentLayout(upgraded)
    DashboardConfigManager.saveLayout(upgraded as any)
  }, [user, currentLayout, setCurrentLayout])

  const handleExportDashboard = () => {
    const rows = [['类别', '名称', '数值']]
    if (stats?.formulas && stats.experiments) {
      rows.push(['配方', '总数', String(stats.formulas.total ?? 0)])
      Object.entries(stats.formulas.by_status || {}).forEach(([k, v]) => {
        if (v > 0) rows.push(['配方', (STATUS_LABELS as Record<string, string>)[k] ?? k, String(v)])
      })
      rows.push(['实验', '总数', String(stats.experiments.total ?? 0)])
      Object.entries(stats.experiments.by_status || {}).forEach(([k, v]) => {
        if (v > 0) rows.push(['实验', (STATUS_LABELS as Record<string, string>)[k] ?? k, String(v)])
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
    <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="space-y-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* 欢迎横幅 + 内嵌布局控制 */}
      <div className="surface-primary rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold leading-snug tracking-tight">
              {DASHBOARD_CONFIG.messages.welcomeBack}, {user?.fullName ?? user?.username}
            </h2>
            <p className="mt-1 text-white/80 text-sm">{DASHBOARD_CONFIG.messages.startWork}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* 全局搜索 */}
            <div className="relative">
              <div className="flex items-center gap-2 bg-white/15 rounded-full px-4 py-2">
                <Search size={14} className="text-white/70 shrink-0" />
                <input
                  type="text"
                  placeholder="搜索配方/实验…"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true) }}
                  onFocus={() => setShowSearch(true)}
                  onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && searchResults[0]) navigate(searchResults[0].to) }}
                  className="bg-transparent text-white placeholder-white/60 text-sm outline-none w-40 sm:w-52"
                  aria-label="搜索配方或实验"
                />
              </div>
              {showSearch && searchResults.length > 0 && (
                <div className="absolute top-full mt-2 right-0 w-72 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 py-2 z-50">
                  {searchResults.map((r) => (
                    <Link
                      key={`${r.type}-${r.id}`}
                      to={r.to}
                      onClick={() => { setShowSearch(false); setSearchQuery('') }}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${r.type === '配方' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-400'}`}>{r.type}</span>
                      <span className="text-sm text-neutral-900 dark:text-white truncate">{r.title}</span>
                      <ArrowRight size={12} className="text-neutral-400 ml-auto shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={<Sparkles size={16} />}
              onClick={() => navigate('/ai')}
            >
              {DASHBOARD_CONFIG.messages.aiReady}
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

            <NotificationBadge
              count={notificationCount}
              onClick={() => setShowNotifications(true)}
            />

            <Button
              variant={isEditMode ? 'primary' : 'secondary'}
              size="sm"
              icon={<Settings size={14} />}
              onClick={() => setIsEditMode(!isEditMode)}
              className={isEditMode ? 'bg-white text-primary-600 hover:bg-neutral-100' : ''}
              aria-label={isEditMode ? '退出编辑模式' : '进入编辑模式'}
            >
              {isEditMode ? '完成编辑' : '编辑布局'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={14} />}
              onClick={handleExportDashboard}
              aria-label="导出仪表盘数据"
            >
              {DASHBOARD_CONFIG.messages.exportData}
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
              title="刷新数据"
              aria-label="刷新仪表盘数据"
            >
              刷新
            </Button>

            {/* 编辑模式下的布局控制 — 内嵌于横幅右侧 */}
            {isEditMode && (
              <div className="flex items-center gap-3 pl-4 border-l border-white/20 ml-1" role="group" aria-label="布局设置">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-white/70 font-medium uppercase tracking-wider">列</span>
                  <div className="flex items-center bg-white/15 rounded-full overflow-hidden">
                    {[2, 3, 4].map((col) => (
                      <button
                        key={col}
                        onClick={() => handleColumnsChange(col)}
                        className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                          layoutColumns === col
                            ? 'bg-white text-primary-600'
                            : 'text-white/80 hover:text-white'
                        }`}
                        aria-label={`切换为${col}列布局`}
                        aria-pressed={layoutColumns === col}
                      >
                        {col}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-white/70 font-medium uppercase tracking-wider">距</span>
                  <div className="flex items-center bg-white/15 rounded-full overflow-hidden">
                    {[8, 16, 24].map((g) => (
                      <button
                        key={g}
                        onClick={() => handleGapChange(g)}
                        className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                          layoutGap === g
                            ? 'bg-white text-primary-600'
                            : 'text-white/80 hover:text-white'
                        }`}
                        aria-label={`间距${g}px`}
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
      </div>

      {/* 编辑模式提示 */}
      {isEditMode && (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-warning-600" />
              <p className="text-sm text-warning-800 dark:text-warning-400">
                编辑模式已开启 — 拖拽卡片调整位置，点击卡片右上角按钮进行配置
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowEditor(true)}
              aria-label="添加卡片"
            >
              添加卡片
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
                aria-label={`卡片: ${card.title}，拖拽调整位置`}
              >
                {renderCard({
                  card,
                  data: stats ? { formulas: { total: stats.formulas?.total ?? 0, by_status: stats.formulas?.by_status || {} }, experiments: { total: stats.experiments?.total ?? 0, by_status: stats.experiments?.by_status || {} } } : null,
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

      {/* 通知中心 */}
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => {
          setShowNotifications(false)
          setNotificationCount(0)
        }}
      />
      </div>
    </div>
  )
}




