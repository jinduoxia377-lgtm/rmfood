/**
 * 自定义仪表盘 Tab
 * 支持拖拽布局、Widget 添加/移除、保存/加载布局
 * 使用真实后端数据渲染 KPI / 图表 / 表格 / 动态流
 */
import React, { useState, useMemo, useEffect } from 'react'
import {
  LayoutGrid, Plus, Save, Share2,
  Eye, GripVertical, X, Check,
  BarChart3, PieChart as PieIcon, Activity, Users, TrendingUp, Zap,
  ArrowUp, ArrowDown, FileText,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import {
  KPIWidget,
  ChartWidget,
  TableWidget,
  ActivityFeedWidget,
} from '@/components/analytics/widgets'
import { SankeyFunnelChart } from '@/components/analytics/charts/SankeyFunnelChart'
import { IngredientNetworkChart } from '@/components/analytics/charts/IngredientNetworkChart'
import { useAnalyticsData } from '@/hooks/useAnalyticsData'
import type { DashboardResponse } from '@/hooks/useAnalyticsData'
import { useToast } from '@/components/ui'

interface FilterConfig {
  timeRange: '7d' | '30d' | '90d' | '1y'
  categories: string[]
  status: string[]
  users: string[]
}

export interface DashboardWidget {
  id: string
  type: 'kpi' | 'chart' | 'table' | 'activity_feed' | 'sankey' | 'network'
  title: string
  size: 'small' | 'medium' | 'large'
  config: Record<string, any>
}

const AVAILABLE_WIDGETS: Array<{
  id: string
  type: DashboardWidget['type']
  title: string
  size: DashboardWidget['size']
  icon: LucideIcon
  defaultConfig: Record<string, any>
}> = [
  { id: 'kpi-formulas',    type: 'kpi',      title: '配方总数',    size: 'small', icon: Zap,     defaultConfig: { metricId: 'total_formulas' } },
  { id: 'kpi-experiments', type: 'kpi',      title: '实验次数',    size: 'small', icon: Activity, defaultConfig: { metricId: 'total_experiments' } },
  { id: 'kpi-users',       type: 'kpi',      title: '活跃用户',    size: 'small', icon: Users,   defaultConfig: { metricId: 'active_users' } },
  { id: 'kpi-ai',          type: 'kpi',      title: 'AI 生成次数', size: 'small', icon: Zap,     defaultConfig: { metricId: 'ai_generations' } },
  { id: 'chart-trend',     type: 'chart',    title: '月度趋势',    size: 'large', icon: TrendingUp, defaultConfig: { chartKey: 'monthly_creation_trend' } },
  { id: 'chart-status',    type: 'chart',    title: '状态分布',    size: 'medium', icon: PieIcon, defaultConfig: { chartKey: 'formula_status_distribution' } },
  { id: 'chart-category',  type: 'chart',    title: '分类分析',    size: 'medium', icon: BarChart3, defaultConfig: { chartKey: 'category_breakdown' } },
  { id: 'table-activities',type: 'activity_feed', title: '近期动态', size: 'large', icon: Activity, defaultConfig: { limit: 8 } },
  { id: 'table-top',       type: 'table',    title: 'TOP 配方',    size: 'large', icon: FileText,  defaultConfig: { limit: 10 } },
  { id: 'sankey-funnel',   type: 'sankey',   title: '生命周期漏斗', size: 'large', icon: TrendingUp, defaultConfig: {} },
  { id: 'network-ingredients', type: 'network', title: '食材关联网络', size: 'large', icon: BarChart3, defaultConfig: {} },
]

interface SavedLayout {
  id: string
  name: string
  widgets: DashboardWidget[]
  createdAt: string
}

interface Props {
  filters: FilterConfig
  dashboard?: DashboardResponse | null
  refresh: () => void
}

// ─── Widget 渲染映射 ─────────────────────────────────────────────
function renderWidgetContent(widget: DashboardWidget, data: CustomTabData): React.ReactNode {
  const { type, config } = widget
  switch (type) {
    case 'kpi':
      return <KPIWidget metricId={config.metricId} size={widget.size} kpiMap={data.kpiMap} />
    case 'chart':
      return <ChartWidget chartKey={config.chartKey} title={widget.title} charts={data.charts} />
    case 'table':
      return <TableWidget title={widget.title} limit={config.limit ?? 10} activities={data.activities} />
    case 'activity_feed':
      return <ActivityFeedWidget title={widget.title} limit={config.limit ?? 10} activities={data.activities} />
    case 'sankey':
      return (
        <div className="h-full">
          <SankeyFunnelChart stages={widget.config.stages ?? []} height={200} />
        </div>
      )
    case 'network':
      return (
        <div className="h-full">
          <IngredientNetworkChart nodes={widget.config.nodes ?? []} edges={widget.config.edges ?? []} height={300} />
        </div>
      )
    default:
      return <span className="text-text-muted text-xs">未知组件</span>
  }
}

interface CustomTabData {
  kpiMap: Record<string, { id: string; name: string; value: number; unit: string; change_percent?: number | null; target?: number | null }> | null
  charts: Record<string, { chart_type: string; title: string; labels: string[]; datasets: Array<{ label: string; data: number[] }> }> | null
  activities: Array<{ type: string; title: string; timestamp?: string | null; author?: string | null }>
}

function buildCustomTabData(dashboard: DashboardResponse | null): CustomTabData {
  const kpiMap = dashboard?.kpi
    ? Object.fromEntries(dashboard.kpi.map((k: any) => [k.id, k]))
    : null
  const charts = dashboard?.charts ?? null
  const activities = dashboard?.recent_activity ?? []
  return { kpiMap, charts, activities }
}

// ─── 默认布局 ──────────────────────────────────────────────────────
function getDefaultWidgets(): DashboardWidget[] {
  return [
    { id: 'kpi-1', type: 'kpi',   title: '配方总数',  size: 'small', config: { metricId: 'total_formulas' } },
    { id: 'kpi-2', type: 'kpi',   title: '实验次数',  size: 'small', config: { metricId: 'total_experiments' } },
    { id: 'kpi-3', type: 'kpi',   title: '活跃用户',  size: 'small', config: { metricId: 'active_users' } },
    { id: 'kpi-4', type: 'kpi',   title: 'AI 生成',   size: 'small', config: { metricId: 'ai_generations' } },
    { id: 'chart-1', type: 'chart', title: '月度趋势', size: 'large', config: { chartKey: 'monthly_creation_trend' } },
    { id: 'feed-1', type: 'activity_feed', title: '近期动态', size: 'large', config: { limit: 8 } },
  ]
}

export default function CustomTab({ filters, dashboard, refresh }: Props) {
  const toast = useToast()
  const [isEditMode, setIsEditMode] = useState(false)
  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => {
    const saved = localStorage.getItem('analytics-custom-layout')
    if (saved) {
      try { return JSON.parse(saved) } catch {}
    }
    return getDefaultWidgets()
  })
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>(() => {
    const saved = localStorage.getItem('analytics-saved-layouts')
    if (saved) {
      try { return JSON.parse(saved) } catch {}
    }
    return []
  })
  const [currentLayoutName, setCurrentLayoutName] = useState('我的仪表盘')
  const [showWidgetPicker, setShowWidgetPicker] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newLayoutName, setNewLayoutName] = useState('')

  // 共享数据源 — 所有 Widget 共用同一份 dashboard 数据，不重复发请求
  const customTabData = buildCustomTabData(dashboard ?? null)

  // 持久化
  React.useEffect(() => {
    localStorage.setItem('analytics-custom-layout', JSON.stringify(widgets))
  }, [widgets])

  React.useEffect(() => {
    localStorage.setItem('analytics-saved-layouts', JSON.stringify(savedLayouts))
  }, [savedLayouts])

  const handleAddWidget = (tpl: typeof AVAILABLE_WIDGETS[0]) => {
    const newWidget: DashboardWidget = {
      id: `${tpl.id}-${Date.now()}`,
      type: tpl.type,
      title: tpl.title,
      size: tpl.size,
      config: { ...tpl.defaultConfig },
    }
    setWidgets(prev => [...prev, newWidget])
    setShowWidgetPicker(false)
  }

  const handleRemoveWidget = (widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId))
  }

  const handleSaveLayout = () => {
    if (!newLayoutName.trim()) return
    const layout: SavedLayout = {
      id: Date.now().toString(),
      name: newLayoutName.trim(),
      widgets: [...widgets],
      createdAt: new Date().toISOString(),
    }
    setSavedLayouts(prev => [...prev, layout])
    setNewLayoutName('')
    setShowSaveDialog(false)
    setIsEditMode(false)
  }

  const handleLoadLayout = (layout: SavedLayout) => {
    setWidgets(layout.widgets)
    setCurrentLayoutName(layout.name)
    setIsEditMode(false)
  }

  const handleShare = () => {
    const data = JSON.stringify({ widgets, name: currentLayoutName })
    navigator.clipboard.writeText(data).then(() => {
      toast.success('布局配置已复制到剪贴板')
    })
  }

  // ─── Widget 上下移动 ──────────────────────────────────────
  const moveWidget = (index: number, direction: -1 | 1) => {
    setWidgets(prev => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  return (
    <div className="space-y-4">

      {/* ── 操作工具栏 ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={currentLayoutName}
            onChange={(e) => setCurrentLayoutName(e.target.value)}
            disabled={!isEditMode}
            className={`px-3 py-1.5 text-base font-semibold bg-transparent border-b transition-colors ${
              isEditMode
                ? 'border-primary-500 text-primary-600 focus:outline-none'
                : 'border-transparent text-text-primary'
            }`}
          />

          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-1.5 ${
              isEditMode
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-surface-hover text-text-primary hover:bg-surface-pressed'
            }`}
          >
            {isEditMode ? <Check className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
            {isEditMode ? '完成编辑' : '编辑布局'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* 布局选择 */}
          <select
            onChange={(e) => {
              if (e.target.value) {
                const layout = savedLayouts.find(l => l.id === e.target.value)
                if (layout) handleLoadLayout(layout)
              }
            }}
            className="px-3 py-1.5 text-sm input min-w-[150px]"
          >
            <option value="">已保存的布局…</option>
            {savedLayouts.map((layout) => (
              <option key={layout.id} value={layout.id}>{layout.name}</option>
            ))}
          </select>

          {isEditMode && (
            <button
              onClick={() => setShowWidgetPicker(!showWidgetPicker)}
              className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              添加组件
            </button>
          )}

          {isEditMode && widgets.length > 0 && (
            <button
              onClick={() => { setNewLayoutName(currentLayoutName); setShowSaveDialog(true) }}
              className="px-3 py-1.5 bg-secondary-600 hover:bg-secondary-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              保存布局
            </button>
          )}

          {!isEditMode && widgets.length > 0 && (
            <button
              onClick={handleShare}
              className="px-3 py-1.5 bg-surface-hover hover:bg-surface-pressed text-text-primary text-sm rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Share2 className="w-4 h-4" />
              分享
            </button>
          )}
        </div>
      </div>

      {/* ── 组件选择面板 ── */}
      {showWidgetPicker && (
        <div className="p-4 rounded-lg bg-surface-hover border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-text-primary">选择组件</span>
            <button onClick={() => setShowWidgetPicker(false)} className="text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {AVAILABLE_WIDGETS.map((widget) => {
              const alreadyAdded = widgets.some(w => w.type === widget.type && w.config.metricId === widget.defaultConfig.metricId)
              return (
                <button
                  key={widget.id}
                  onClick={() => !alreadyAdded && handleAddWidget(widget)}
                  disabled={alreadyAdded}
                  className="p-3 rounded-lg bg-background border border-border hover:border-primary-400 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <widget.icon className="w-5 h-5 text-primary-600 mb-2" />
                  <p className="text-xs font-medium text-text-primary">{widget.title}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{widget.size === 'large' ? '大块' : widget.size === 'medium' ? '中块' : '小块'}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 保存布局对话框 ── */}
      {showSaveDialog && (
        <div className="p-4 rounded-lg bg-surface-hover border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-text-primary">保存布局</span>
            <button onClick={() => setShowSaveDialog(false)} className="text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={newLayoutName}
              onChange={(e) => setNewLayoutName(e.target.value)}
              placeholder="输入布局名称…"
              className="w-full px-3 py-2 text-sm input"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveLayout()}
            />
            <button
              onClick={handleSaveLayout}
              disabled={!newLayoutName.trim()}
              className="w-full py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              保存
            </button>
          </div>
        </div>
      )}

      {/* ── Widget 网格 ── */}
      {widgets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {widgets.map((widget, index) => {
            const canMoveUp = index > 0
            const canMoveDown = index < widgets.length - 1
            return (
              <div
                key={widget.id}
                className={`relative group ${widget.size === 'large' ? 'lg:col-span-2' : ''}`}
              >
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center gap-1.5 pb-3">
                    {isEditMode && (
                      <GripVertical className="w-4 h-4 text-text-muted cursor-grab flex-shrink-0 mt-0.5" />
                    )}
                    <CardTitle className="text-sm font-semibold truncate flex-1">{widget.title}</CardTitle>
                    {isEditMode && (
                      <div className="flex items-center gap-0.5 ml-auto">
                        <button
                          onClick={() => moveWidget(index, -1)}
                          disabled={!canMoveUp}
                          className="p-1 text-text-muted hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="上移"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveWidget(index, 1)}
                          disabled={!canMoveDown}
                          className="p-1 text-text-muted hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="下移"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveWidget(widget.id)}
                          className="p-1 text-text-muted hover:text-error-500 transition-colors"
                          title="移除组件"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="min-h-[120px]">
                      {renderWidgetContent(widget, customTabData)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          })}

          {/* 添加组件占位 */}
          {isEditMode && (
            <button
              onClick={() => setShowWidgetPicker(true)}
              className="p-4 rounded-lg border-2 border-dashed border-border hover:border-primary-400 transition-colors flex flex-col items-center gap-2 text-text-muted hover:text-primary-600 h-full min-h-[200px]"
            >
              <Plus className="w-8 h-8" />
              <span className="text-sm font-medium">添加组件</span>
            </button>
          )}
        </div>
      ) : (
        <div className="p-10 text-center rounded-lg bg-surface-hover">
          <LayoutGrid className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted text-sm">暂无组件</p>
          <p className="text-xs text-text-muted mt-1">点击右上角「添加组件」开始搭建您的仪表盘</p>
        </div>
      )}
    </div>
  )
}
