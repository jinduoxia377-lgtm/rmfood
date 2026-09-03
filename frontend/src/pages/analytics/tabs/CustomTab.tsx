/**
 * 自定义仪表盘 Tab — 参考 Dashboard 设计风格
 * 使用 Card+CardHeader+CardContent 统一卡片样式
 */
import React, { useState } from 'react'
import {
  LayoutGrid, Plus, Save, Share2,
  Eye, GripVertical, X, Check,
  BarChart3, PieChart as PieIcon, Activity, Users, TrendingUp, Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

interface FilterConfig {
  timeRange: '7d' | '30d' | '90d' | '1y'
  categories: string[]
  status: string[]
  users: string[]
}

interface WidgetConfig {
  id: string
  type: 'kpi' | 'line_chart' | 'bar_chart' | 'pie_chart' | 'table' | 'activity_feed'
  title: string
  size: 'small' | 'medium' | 'large'
  icon: LucideIcon
}

const AVAILABLE_WIDGETS: WidgetConfig[] = [
  { id: 'kpi-formulas', type: 'kpi', title: '配方数量 KPI', size: 'small', icon: Zap },
  { id: 'kpi-experiments', type: 'kpi', title: '实验次数 KPI', size: 'small', icon: Activity },
  { id: 'line-trend', type: 'line_chart', title: '趋势折线图', size: 'large', icon: TrendingUp },
  { id: 'bar-comparison', type: 'bar_chart', title: '对比柱状图', size: 'medium', icon: BarChart3 },
  { id: 'pie-distribution', type: 'pie_chart', title: '分布饼图', size: 'medium', icon: PieIcon },
  { id: 'table-ranking', type: 'table', title: '排行榜表格', size: 'large', icon: Users },
  { id: 'feed-activity', type: 'activity_feed', title: '动态信息流', size: 'large', icon: Activity },
]

interface SavedLayout {
  id: string
  name: string
  widgets: WidgetConfig[]
  createdAt: Date
}

interface Props {
  filters: FilterConfig
}

export default function CustomTab({ filters }: Props) {
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedWidgets, setSelectedWidgets] = useState<WidgetConfig[]>([
    AVAILABLE_WIDGETS[0], AVAILABLE_WIDGETS[1], AVAILABLE_WIDGETS[2],
  ])
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([
    {
      id: 'default',
      name: '默认仪表盘',
      widgets: [AVAILABLE_WIDGETS[0], AVAILABLE_WIDGETS[1], AVAILABLE_WIDGETS[2]],
      createdAt: new Date(),
    },
  ])
  const [currentLayoutName, setCurrentLayoutName] = useState('我的自定义仪表盘')
  const [showWidgetPicker, setShowWidgetPicker] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  const handleAddWidget = (widget: WidgetConfig) => {
    if (!selectedWidgets.find(w => w.id === widget.id)) {
      setSelectedWidgets([...selectedWidgets, widget])
    }
    setShowWidgetPicker(false)
  }

  const handleRemoveWidget = (widgetId: string) => {
    setSelectedWidgets(selectedWidgets.filter(w => w.id !== widgetId))
  }

  const handleSaveLayout = () => {
    const newLayout: SavedLayout = {
      id: Date.now().toString(),
      name: currentLayoutName,
      widgets: selectedWidgets,
      createdAt: new Date(),
    }
    setSavedLayouts([...savedLayouts, newLayout])
    setShowSaveDialog(false)
    setIsEditMode(false)
  }

  const handleLoadLayout = (layout: SavedLayout) => {
    setSelectedWidgets(layout.widgets)
    setCurrentLayoutName(layout.name)
    setIsEditMode(false)
  }

  return (
    <div className="space-y-4">

      {/* 操作工具栏 */}
      <div className="flex items-center justify-between">
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

          {isEditMode && selectedWidgets.length > 0 && (
            <button
              onClick={() => setShowSaveDialog(true)}
              className="px-3 py-1.5 bg-secondary-600 hover:bg-secondary-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              保存布局
            </button>
          )}

          {!isEditMode && selectedWidgets.length > 0 && (
            <button className="px-3 py-1.5 bg-surface-hover hover:bg-surface-pressed text-text-primary text-sm rounded-lg transition-colors flex items-center gap-1.5">
              <Share2 className="w-4 h-4" />
              分享
            </button>
          )}
        </div>
      </div>

      {/* 组件选择面板 */}
      {showWidgetPicker && (
        <div className="p-4 rounded-lg bg-surface-hover border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-text-primary">选择组件</span>
            <button onClick={() => setShowWidgetPicker(false)} className="text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {AVAILABLE_WIDGETS.map((widget) => (
              <button
                key={widget.id}
                onClick={() => handleAddWidget(widget)}
                disabled={!!selectedWidgets.find(w => w.id === widget.id)}
                className="p-3 rounded-lg bg-background border border-border hover:border-primary-400 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <widget.icon className="w-5 h-5 text-primary-600 mb-2" />
                <p className="text-xs font-medium text-text-primary">{widget.title}</p>
                <p className="text-xs text-text-muted mt-0.5">{widget.size === 'large' ? '大块' : widget.size === 'medium' ? '中块' : '小块'}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 已保存布局面板 */}
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
              value={currentLayoutName}
              onChange={(e) => setCurrentLayoutName(e.target.value)}
              placeholder="输入布局名称…"
              className="w-full px-3 py-2 text-sm input"
            />
            <button
              onClick={handleSaveLayout}
              className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              保存
            </button>
          </div>
        </div>
      )}

      {/* 组件网格 */}
      {selectedWidgets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedWidgets.map((widget) => (
            <Card key={widget.id} className="relative group">
              {isEditMode && (
                <button
                  onClick={() => handleRemoveWidget(widget.id)}
                  className="absolute top-2 right-2 p-1 bg-error-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <CardHeader className="flex flex-row items-center gap-2 pb-3">
                <div className="p-1.5 bg-primary-100 dark:bg-primary-900/40 rounded-lg">
                  <widget.icon className="w-4 h-4 text-primary-600" />
                </div>
                <CardTitle className="text-sm font-semibold">{widget.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-40 bg-surface-hover rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <widget.icon className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                    <p className="text-xs text-text-muted">组件内容将在此渲染</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* 添加组件占位 */}
          {isEditMode && (
            <button
              onClick={() => setShowWidgetPicker(true)}
              className="p-4 rounded-lg border-2 border-dashed border-border hover:border-primary-400 transition-colors flex flex-col items-center gap-2 text-text-muted hover:text-primary-600"
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
          <p className="text-xs text-text-muted mt-1">点击右上角"添加组件"开始搭建您的仪表盘</p>
        </div>
      )}
    </div>
  )
}
