/**
 * 自定义仪表盘 Tab 组件
 * 提供拖拽式布局编辑、组件选择、保存/分享功能
 */
import React, { useState } from 'react'
import {
  LayoutGrid, Plus, Save, Share2,
  Eye, GripVertical, X, Check, Sparkles,
  BarChart3, PieChart as PieIcon, Activity, Users, TrendingUp, Zap,
} from 'lucide-react'

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
  icon: React.ElementType
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
  const [selectedWidgets, setSelectedWidgets] = useState<WidgetConfig[]>([])
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
    <div className="w-full space-y-6">
      {/* 操作工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* 布局名称 */}
          <input
            type="text"
            value={currentLayoutName}
            onChange={(e) => setCurrentLayoutName(e.target.value)}
            disabled={!isEditMode}
            className={`px-4 py-2 text-lg font-bold bg-transparent border-b-2 transition-colors ${
              isEditMode
                ? 'border-primary-500 text-primary-600 focus:outline-none'
                : 'border-transparent text-text-primary'
            }`}
          />

          {/* 编辑模式切换 */}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-4 py-2 text-sm rounded-lg transition-all flex items-center gap-2 ${
              isEditMode
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-neutral-100 dark:bg-neutral-800 text-text-primary hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            {isEditMode ? <Check className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
            {isEditMode ? '完成编辑' : '编辑布局'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* 已保存的布局列表 */}
          <select
            onChange={(e) => {
              if (e.target.value) {
                const layout = savedLayouts.find(l => l.id === e.target.value)
                if (layout) handleLoadLayout(layout)
              }
            }}
            className="px-3 py-2 text-sm input min-w-[160px]"
          >
            <option value="">已保存的布局...</option>
            {savedLayouts.map((layout) => (
              <option key={layout.id} value={layout.id}>{layout.name}</option>
            ))}
          </select>

          {/* 添加组件按钮 */}
          {isEditMode && (
            <button
              onClick={() => setShowWidgetPicker(true)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              添加组件
            </button>
          )}

          {/* 保存布局按钮 */}
          {isEditMode && selectedWidgets.length > 0 && (
            <button
              onClick={() => setShowSaveDialog(true)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              保存布局
            </button>
          )}

          {/* 分享按钮 */}
          {!isEditMode && selectedWidgets.length > 0 && (
            <button className="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              分享
            </button>
          )}
        </div>
      </div>

      {/* 组件选择面板 */}
      {showWidgetPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden animate-micro-in">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-bold text-text-primary">选择要添加的组件</h3>
              <button
                onClick={() => setShowWidgetPicker(false)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {AVAILABLE_WIDGETS.map((widget) => {
                  const isSelected = selectedWidgets.find(w => w.id === widget.id)
                  const Icon = widget.icon

                  return (
                    <button
                      key={widget.id}
                      onClick={() => !isSelected && handleAddWidget(widget)}
                      disabled={!!isSelected}
                      className={`p-6 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? 'border-emerald-500 bg-primary-50 dark:bg-emerald-950/20 cursor-not-allowed opacity-60'
                          : 'border-neutral-200 dark:border-neutral-700 hover:border-primary-500 hover:shadow-md cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={`p-3 rounded-lg ${isSelected ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-primary-50 dark:bg-primary-950/40'}`}>
                          <Icon className={`w-6 h-6 ${isSelected ? 'text-primary-600' : 'text-primary-600'}`} />
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-primary-600" />}
                      </div>
                      <h4 className="font-bold text-text-primary mb-1">{widget.title}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-text-muted rounded">
                          {widget.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-text-muted">{widget.size}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 保存确认对话框 */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-micro-in">
            <h3 className="text-lg font-bold text-text-primary mb-4">保存当前布局</h3>
            <p className="text-sm text-text-muted mb-6">
              确定要保存包含 {selectedWidgets.length} 个组件的布局吗？保存后可以随时加载。
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-sm text-text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveLayout}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                确认保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 仪表盘画布区域 */}
      <div className="min-h-[600px]">
        {selectedWidgets.length === 0 ? (
          /* 空状态提示 */
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950/20 rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700">
            <div className="text-center max-w-md">
              <LayoutGrid className="w-20 h-20 text-neutral-300 dark:text-neutral-600 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-text-primary mb-3">开始构建您的仪表盘</h3>
              <p className="text-text-muted mb-6">
                从左侧选择组件，拖拽到画布上，创建专属的数据分析视图。
                支持实时预览、自由调整布局、一键分享给团队成员。
              </p>
              <button
                onClick={() => setIsEditMode(true)}
                className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2 shadow-lg"
              >
                <Sparkles className="w-5 h-5" />
                开始设计
              </button>
            </div>
          </div>
        ) : (
          /* 组件网格布局 */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {selectedWidgets.map((widget) => {
              const Icon = widget.icon

              return (
                <div
                  key={widget.id}
                  className={`bg-white dark:bg-neutral-900 rounded-xl border p-6 transition-all group relative ${
                    isEditMode
                      ? 'border-dashed border-primary-300 dark:border-primary-700 hover:border-primary-500'
                      : 'border-neutral-200 dark:border-neutral-700 hover:shadow-lg'
                  }`}
                >
                  {/* 编辑模式下的控制按钮 */}
                  {isEditMode && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700">
                        <GripVertical className="w-4 h-4 text-neutral-500" />
                      </button>
                      <button
                        onClick={() => handleRemoveWidget(widget.id)}
                        className="p-1.5 bg-error-100 dark:bg-error-900/40 rounded hover:bg-error-200 dark:hover:bg-error-900/60"
                      >
                        <X className="w-4 h-4 text-error-600" />
                      </button>
                    </div>
                  )}

                  {/* 组件头部 */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary-50 dark:bg-primary-950/40 rounded-lg">
                      <Icon className="w-5 h-5 text-primary-600" />
                    </div>
                    <h4 className="font-bold text-text-primary">{widget.title}</h4>
                  </div>

                  {/* 组件内容占位符 */}
                  <div className="h-48 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Icon className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                      <p className="text-xs text-text-muted">组件内容将在此渲染</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
