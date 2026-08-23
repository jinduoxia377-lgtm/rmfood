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
  Sparkles, Download, Settings, AlertTriangle,
} from 'lucide-react'
import { useDashboardStatistics, useDashboardTrends, useFormulas, useExperiments } from '@/hooks/useQueries'
import { useAuthStore } from '@/stores/auth'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, StatCard } from '@/components/ui'
import { StatusBadge, Skeleton, EmptyState } from '@/components/ui/Common'
import { activityApi, type TimelineEvent, type TodoItem, type ReviewQueueItem } from '@/api/activity'
import { notificationApi } from '@/api/notifications'
import { useQuery } from '@tanstack/react-query'
import { STATUS_CONFIG, DASHBOARD_CONFIG } from '@/config'

const STATUS_LABELS = STATUS_CONFIG.labels
import DashboardConfigManager, { CARD_CATALOG, DEFAULT_CARDS, type CardConfig, type DashboardLayout } from '@/config/dashboard'
import { DraggableCard, DashboardLayout as GridLayout, LayoutEditor, LayoutSwitcher } from '@/pages/formula/components/DashboardLayout'
import { NotificationCenter, NotificationBadge } from '@/pages/formula/components/NotificationCenter'
import { AIInsights, KPIDashboard } from '@/pages/formula/components/AIInsights'
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
import { CardSkeleton as CardSkeletonComp } from '@/components/ui/Skeleton'


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
        <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>团队活动</CardTitle>
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
  formulasData: { data: { id: number; name: string; code: string; status: string; created_at: string; creator_name: string }[] } | null
  experimentsData: { data: { id: number; title: string; code: string; formula_id: number; formula_name: string; status: string; created_at: string }[] } | null
  todos: { type: string; id: number | string; title: string; detail: string; priority: 'high' | 'medium' | 'low' }[]
  reviewQueue: { id: number | string; name: string; code: string; creator_name: string; target_effects: string[] }[]
  timeline: { type: string; id: number | string; event: string; title: string; created_at: string; status: string }[]
  navigate: (url: string) => void
  currentLayout: DashboardLayout
  setCurrentLayout: (layout: DashboardLayout) => void
}

function renderCard({ card, data, trendsData, formulasData, experimentsData, todos, reviewQueue, timeline, navigate, currentLayout, setCurrentLayout }: CardRenderProps) {
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
  }

  // Trend chart
  if (card.type === 'chart-trends') {
    props.data = trendsData?.data ?? []
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
  }

  // Recent formulas
  if (card.type === 'recent-formulas') {
    props.items = formulasData?.data ?? null
    props.loading = !formulasData
  }

  // Recent experiments
  if (card.type === 'recent-experiments') {
    props.items = experimentsData?.data ?? null
    props.loading = !experimentsData
  }

  // Todos
  if (card.type === 'todos') {
    props.items = todos
  }

  // Review queue
  if (card.type === 'review-queue') {
    props.items = reviewQueue
  }

  // Activity timeline
  if (card.type === 'activity-timeline') {
    props.items = timeline
  }

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
  const { data: stats } = useDashboardStatistics()
  const { data: trendsData } = useDashboardTrends(trendPeriod)
  const { data: formulasData } = useFormulas({ page: 1, page_size: 5 })
  const { data: experimentsData } = useExperiments({ page: 1, page_size: 5 })

  // 活动数据 — 延迟加载（staleTime 5 分钟，不阻塞首屏）
  const { data: timelineData } = useQuery({
    queryKey: ['activity-timeline'],
    queryFn: ({ signal }) => activityApi.timeline(7, signal),
    staleTime: 5 * 60_000,
  })
  const { data: todosData } = useQuery({
    queryKey: ['activity-todos'],
    queryFn: ({ signal }) => activityApi.todos(signal),
    staleTime: 5 * 60_000,
  })
  const { data: reviewQueueData } = useQuery({
    queryKey: ['activity-review-queue'],
    queryFn: ({ signal }) => activityApi.reviewQueue(signal),
    staleTime: 5 * 60_000,
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
  const [notificationCount, setNotificationCount] = useState(0)

  // 从后端 API 获取未读通知数
  useEffect(() => {
    notificationApi.unreadCount()
      .then((data) => setNotificationCount(data.count))
      .catch(() => setNotificationCount(0))
  }, [])

  // WebSocket 推送更新通知计数
  useEffect(() => {
    const unsubscribe = subscribeToChannel('notifications', (msg) => {
      if (msg.type === 'notification.created' || msg.type === 'notification.marked_read') {
        notificationApi.unreadCount()
          .then((data) => setNotificationCount(data.count))
          .catch(() => {})
      }
    })
    return unsubscribe
  }, [])
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

  return (
    <div className="space-y-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* 欢迎横幅 */}
      <div className="rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold leading-snug">
              {DASHBOARD_CONFIG.messages.welcomeBack}, {user?.fullName ?? user?.username}
            </h1>
            <p className="mt-1 text-white/90 text-sm">{DASHBOARD_CONFIG.messages.startWork}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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
              className={isEditMode ? 'bg-primary-500' : ''}
            >
              {isEditMode ? '完成编辑' : '编辑布局'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={14} />}
              onClick={handleExportDashboard}
            >
              {DASHBOARD_CONFIG.messages.exportData}
            </Button>
          </div>
        </div>
      </div>

      {/* 编辑模式提示 */}
      {isEditMode && (
        <div className="p-4 rounded-xl bg-warning-50 dark:bg-warning-900/10 border border-amber-200 dark:border-amber-800/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-warning-600" />
              <p className="text-sm text-warning-800 dark:text-warning-400">
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
                  formulasData: formulasData ? { data: (formulasData as any).data } : null,
                  experimentsData: experimentsData ? { data: (experimentsData as any).data } : null,
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
