/**
 * 仪表盘可拖拽卡片组件
 * 支持拖放重排、尺寸调整、编辑配置
 */
import { useState, useCallback, useContext, createContext, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card } from '@/components/ui'
import { GripVertical, Settings, X, Eye, EyeOff, Maximize2, Minimize2, Plus, Maximize, Lock, Unlock, ChevronDown, Star, Copy, RotateCcw, Palette, Layers, Grid, AlignLeft, Zap, PieChart, Users, Brain, Search, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CardConfig } from '@/config/dashboard'

/* ═══ A-18：响应式列数下 clamp 卡片跨列 ═══
   DraggableCard 原本无条件输出 `gridColumn: span ${card.size.w}`。但外层网格是
   响应式的（grid-cols-1 sm:2 lg:3 xl:4）——当实际列数少于 size.w 时，`span N`
   会【隐式生成】第 2 条 auto 轨道：内容撑到 max-content（实测 369px），把
   显式的 1fr 轨道挤成 0px，卡片被压成 26px 宽（实测 390px 视口，快捷操作
   五个入口全部不可点）。这里用 matchMedia 求出真实列数，把跨列 clamp 到它。 */

const DashColsContext = createContext<number>(4)

/** 与 DashboardLayout 的断点类名保持一致：1 / sm:2 / lg:3 / xl:4 */
function useResponsiveCols(): number {
  const read = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return 4
    if (window.matchMedia('(min-width: 1280px)').matches) return 4
    if (window.matchMedia('(min-width: 1024px)').matches) return 3
    if (window.matchMedia('(min-width: 640px)').matches) return 2
    return 1
  }
  const [cols, setCols] = useState<number>(read)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const qs = ['(min-width: 1280px)', '(min-width: 1024px)', '(min-width: 640px)'].map(window.matchMedia)
    const onChange = () => setCols(read())
    qs.forEach(q => q.addEventListener('change', onChange))
    return () => qs.forEach(q => q.removeEventListener('change', onChange))
  }, [])
  return cols
}

interface DraggableCardProps {
  card: CardConfig
  onUpdate: (cardId: string, updates: Partial<CardConfig>) => void
  onRemove?: (cardId: string) => void
  onConfig?: (cardId: string) => void
  onDuplicate?: (cardId: string) => void
  children: React.ReactNode
  disabled?: boolean
  theme?: 'light' | 'dark' | 'system'
  /**
   * L-05：编辑状态统一由页面 isEditMode 单源控制。
   * 传入时：卡片自身不再维护本地编辑态，操作栏可见性/禁用性随该 prop 与 disabled 联动；
   * 未传入（旧调用方）：回退到本地 isEditing 语义（向后兼容）。
   */
  isEditing?: boolean
  onExitEdit?: () => void
}

export function DraggableCard({
  card,
  onUpdate,
  onRemove,
  onConfig,
  onDuplicate,
  children,
  disabled = false,
  theme = 'system',
  isEditing: externalEditing,
  onExitEdit,
}: DraggableCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [localEditing, setLocalEditing] = useState(false)
  // L-05：外部受控优先；未受控时回退本地态
  const isEditing = externalEditing !== undefined ? externalEditing : localEditing
  const setIsEditing = externalEditing !== undefined ? onExitEdit ?? (() => {}) : setLocalEditing
  const [aspectRatioLocked, setAspectRatioLocked] = useState(false)
  const [cardTheme, setCardTheme] = useState<'light' | 'dark' | 'system'>(theme)
  const [showThemeOptions, setShowThemeOptions] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSorting,
  } = useSortable({
    id: card.id,
    disabled: disabled || !card.isVisible,
  })

  const cols = useContext(DashColsContext)
  /* A-18：跨列 clamp 到真实列数 —— 1 列网格里 span 2+ 会隐式造轨道，
     把 1fr 轨道挤成 0px（见文件头 A-18 注释）。 */
  const spanW = Math.max(1, Math.min(card.size.w, cols))
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSorting ? 0.3 : 1,
    zIndex: isSorting ? 50 : 'auto',
    gridColumn: `span ${spanW}`,
    gridRow: `span ${card.size.h}`,
  }

  const handleSizeIncrease = () => {
    const newW = Math.min(card.size.w + 1, 4)
    const newH = Math.min(card.size.h + 1, 3)
    onUpdate(card.id, { size: { w: newW, h: newH } })
  }

  const handleSizeDecrease = () => {
    const newW = Math.max(card.size.w - 1, 1)
    const newH = Math.max(card.size.h - 1, 1)
    onUpdate(card.id, { size: { w: newW, h: newH } })
  }

  const handleToggleVisibility = () => {
    onUpdate(card.id, { isVisible: !card.isVisible })
  }

  const handleToggleAspectRatio = () => {
    setAspectRatioLocked(!aspectRatioLocked)
  }

  if (!card.isVisible) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'border border-dotted border-neutral-200 dark:border-neutral-700 rounded-lg flex items-center justify-center bg-neutral-50 dark:bg-neutral-800/30',
          'transition-all duration-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/50',
        )}
      >
        <div className="flex flex-col items-center gap-2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          <Eye size={20} />
          <span className="text-xs">{card.title} - 已隐藏</span>
          <button
            onClick={handleToggleVisibility}
            className="text-xs text-primary-700 hover:text-primary-700 font-medium"
          >
            显示
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group',
        isSorting && 'scale-[1.02] shadow-md',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 卡片操作栏 - 仅在编辑模式或悬停时显示 */}
      {isEditing && (
        <div className="absolute -top-10 left-0 right-0 flex items-center justify-between bg-white dark:bg-neutral-800 rounded-t-xl border border-b-0 border-neutral-200 dark:border-neutral-700 px-3 py-2 z-20">
          <button
            {...attributes}
            {...listeners}
            className="flex items-center gap-1 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-grab active:cursor-grabbing"
            aria-label={`拖拽卡片 ${card.title} 调整位置`}
            role="button"
          >
            <GripVertical size={16} aria-hidden="true" />
            <span className="text-xs font-medium">拖拽</span>
          </button>
          <div className="flex items-center gap-1">
            {/* 尺寸调整 */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleSizeDecrease}
                className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                title="缩小"
              >
                <Minimize2 size={14} />
              </button>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {card.size.w}×{card.size.h}
              </span>
              <button
                onClick={handleSizeIncrease}
                className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                title="放大"
              >
                <Maximize2 size={14} />
              </button>
            </div>

            {/* 高级设置 */}
            <button
              onClick={handleToggleAspectRatio}
              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              title={aspectRatioLocked ? "比例锁定" : "比例解锁"}
            >
              {aspectRatioLocked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>

            {/* 主题切换 */}
            <div className="relative group">
              <button
                onClick={() => setShowThemeOptions(!showThemeOptions)}
                className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                title="主题设置"
              >
                <Palette size={14} />
              </button>
              {showThemeOptions && (
                <div className="absolute bottom-full right-0 mb-2 w-36 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 z-50 p-2">
                  <button
                    onClick={() => {
                      setCardTheme('light');
                      setShowThemeOptions(false);
                      onUpdate(card.id, { theme: 'light' });
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs ${cardTheme === 'light' ? 'bg-primary-50 dark:bg-primary-300/20 text-primary-700 dark:text-primary-700' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}
                  >
                    <div className="w-3 h-3 rounded-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"></div>
                    浅色主题
                  </button>
                  <button
                    onClick={() => {
                      setCardTheme('dark');
                      setShowThemeOptions(false);
                      onUpdate(card.id, { theme: 'dark' });
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs ${cardTheme === 'dark' ? 'bg-primary-50 dark:bg-primary-300/20 text-primary-700 dark:text-primary-700' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}
                  >
                    <div className="w-3 h-3 rounded-full bg-neutral-900 border border-neutral-700"></div>
                    深色主题
                  </button>
                  <button
                    onClick={() => {
                      setCardTheme('system');
                      setShowThemeOptions(false);
                      onUpdate(card.id, { theme: 'system' });
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs ${cardTheme === 'system' ? 'bg-primary-50 dark:bg-primary-300/20 text-primary-700 dark:text-primary-700' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'}`}
                  >
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-white via-neutral-300 to-neutral-800 border border-neutral-400"></div>
                    跟随系统
                  </button>
                </div>
              )}
            </div>

            {/* 卡片复制 */}
            {onDuplicate && (
              <button
                onClick={() => onDuplicate(card.id)}
                className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                title="复制卡片"
              >
                <Copy size={14} />
              </button>
            )}

            {onConfig && (
              <button
                onClick={() => onConfig(card.id)}
                className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                title="配置"
              >
                <Settings size={14} />
              </button>
            )}

            <button
              onClick={handleToggleVisibility}
              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              title="隐藏"
            >
              <EyeOff size={14} />
            </button>

            {onRemove && (
              <button
                onClick={() => onRemove(card.id)}
                className="p-1 rounded hover:bg-error-100 dark:hover:bg-error-900/30 text-error-500 hover:text-error-700"
                title="移除"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 主卡片内容 */}
      <Card
        hoverable
        className={cn(
          'h-full shadow-sm hover:shadow-md transition-shadow duration-200',
          isEditing && 'ring-2 ring-primary-500/30',
        )}
      >
        {children}
      </Card>

      {/* 编辑按钮 - L-05：仅在本地（未受控）且非编辑模式时悬停显示；受控模式由页面横幅统一开关 */}
      {!isEditing && externalEditing === undefined && (isHovered || isSorting) && (
        <button
          onClick={() => setIsEditing(true)}
          className="absolute top-2 right-2 p-1.5 bg-white dark:bg-neutral-800 rounded-md shadow-sm border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-primary-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
        >
          <Settings size={16} />
        </button>
      )}
    </div>
  )
}

interface DashboardLayoutProps {
  children: React.ReactNode
  columns?: number
  gap?: number
  responsive?: boolean
  onColumnsChange?: (columns: number) => void
}

export function DashboardLayout({ children, columns = 4, gap = 16, responsive = true }: DashboardLayoutProps) {
  /* A-18：把响应式列数下发给 DraggableCard，供其 clamp 跨列。 */
  const cols = useResponsiveCols()
  const ColsCtx = DashColsContext
  return (
    <ColsCtx.Provider value={responsive ? cols : Math.max(1, Math.min(columns, cols))}>
      <div className="w-full">
        {/* 网格布局 */}
        <div
          className={cn(
            'grid w-full',
            responsive && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
          )}
          style={{
            gridTemplateColumns: responsive ? undefined : `repeat(${columns}, 1fr)`,
            gap: `${gap}px`,
            gridAutoFlow: 'row dense',
          }}
        >
          {children}
        </div>
      </div>
    </ColsCtx.Provider>
  )
}

interface LayoutEditorProps {
  isOpen: boolean
  onClose: () => void
  availableCards: { type: string; name: string; description: string; icon: string }[]
  onAddCard: (type: string) => void
  /** 应用预设布局（整卡替换当前布局，而非逐个追加） */
  onApplyPreset?: (layout: { type: string; position: { x: number; y: number }; size: { w: number; h: number } }[]) => void
}

interface PresetLayout {
  id: string
  name: string
  description: string
  layout: { type: string; position: { x: number; y: number }; size: { w: number; h: number } }[]
}

const PRESET_LAYOUTS: PresetLayout[] = [
  {
    id: 'default',
    name: '默认布局',
    description: '标准仪表板布局',
    layout: [
      { type: 'stats-formulas', position: { x: 0, y: 0 }, size: { w: 1, h: 1 } },
      { type: 'stats-experiments', position: { x: 1, y: 0 }, size: { w: 1, h: 1 } },
      { type: 'stats-in-progress', position: { x: 2, y: 0 }, size: { w: 1, h: 1 } },
      { type: 'stats-completed', position: { x: 3, y: 0 }, size: { w: 1, h: 1 } },
      { type: 'chart-trends', position: { x: 0, y: 1 }, size: { w: 2, h: 1 } },
      { type: 'chart-formula-pie', position: { x: 2, y: 1 }, size: { w: 1, h: 1 } },
      { type: 'chart-experiment-bar', position: { x: 3, y: 1 }, size: { w: 1, h: 1 } },
      { type: 'quick-actions', position: { x: 0, y: 2 }, size: { w: 1, h: 1 } },
      { type: 'recent-formulas', position: { x: 1, y: 2 }, size: { w: 1, h: 1 } },
      { type: 'recent-experiments', position: { x: 2, y: 2 }, size: { w: 1, h: 1 } },
      { type: 'todos', position: { x: 3, y: 2 }, size: { w: 1, h: 1 } },
    ],
  },
  {
    id: 'compact',
    name: '紧凑布局',
    description: '适合小屏幕设备',
    layout: [
      { type: 'stats-formulas', position: { x: 0, y: 0 }, size: { w: 2, h: 1 } },
      { type: 'stats-experiments', position: { x: 2, y: 0 }, size: { w: 2, h: 1 } },
      { type: 'chart-trends', position: { x: 0, y: 1 }, size: { w: 4, h: 1 } },
      { type: 'chart-formula-pie', position: { x: 0, y: 2 }, size: { w: 2, h: 1 } },
      { type: 'chart-experiment-bar', position: { x: 2, y: 2 }, size: { w: 2, h: 1 } },
      { type: 'recent-formulas', position: { x: 0, y: 3 }, size: { w: 2, h: 1 } },
      { type: 'recent-experiments', position: { x: 2, y: 3 }, size: { w: 2, h: 1 } },
    ],
  },
  {
    id: 'data-focused',
    name: '数据聚焦',
    description: '突出图表和数据',
    layout: [
      { type: 'chart-trends', position: { x: 0, y: 0 }, size: { w: 4, h: 2 } },
      { type: 'chart-formula-pie', position: { x: 0, y: 2 }, size: { w: 2, h: 2 } },
      { type: 'chart-experiment-bar', position: { x: 2, y: 2 }, size: { w: 2, h: 2 } },
      { type: 'stats-formulas', position: { x: 0, y: 4 }, size: { w: 1, h: 1 } },
      { type: 'stats-experiments', position: { x: 1, y: 4 }, size: { w: 1, h: 1 } },
      { type: 'stats-in-progress', position: { x: 2, y: 4 }, size: { w: 1, h: 1 } },
      { type: 'stats-completed', position: { x: 3, y: 4 }, size: { w: 1, h: 1 } },
    ],
  },
  {
    id: 'team-collaboration',
    name: '团队协作',
    description: '适合团队协作场景',
    layout: [
      { type: 'team-online-status', position: { x: 0, y: 0 }, size: { w: 2, h: 1 } },
      { type: 'team-dashboard-share', position: { x: 2, y: 0 }, size: { w: 2, h: 1 } },
      { type: 'change-history', position: { x: 0, y: 1 }, size: { w: 4, h: 2 } },
      { type: 'chart-trends', position: { x: 0, y: 3 }, size: { w: 2, h: 2 } },
      { type: 'websocket-status', position: { x: 2, y: 3 }, size: { w: 2, h: 2 } },
    ],
  },
]

export function LayoutEditor({ isOpen, onClose, availableCards, onAddCard, onApplyPreset }: LayoutEditorProps) {
  if (!isOpen) return null

  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // 分类卡片
  const categories = [
    { id: 'all', name: '全部', icon: 'Grid' },
    { id: 'stats', name: '统计卡片', icon: 'BarChart3' },
    { id: 'chart', name: '图表卡片', icon: 'PieChart' },
    { id: 'list', name: '列表卡片', icon: 'AlignLeft' },
    { id: 'action', name: '操作卡片', icon: 'Plus' },
    { id: 'team', name: '团队卡片', icon: 'Users' },
    { id: 'ai', name: 'AI 卡片', icon: 'Brain' },
  ]

  // 根据分类筛选卡片
  const filteredCards = availableCards.filter(card => {
    // 分类筛选
    if (selectedCategory !== 'all') {
      const categoryMap: Record<string, string[]> = {
        stats: ['stats-formulas', 'stats-experiments', 'stats-in-progress', 'stats-completed'],
        chart: ['chart-trends', 'chart-formula-pie', 'chart-experiment-bar'],
        list: ['recent-formulas', 'recent-experiments', 'todos', 'review-queue', 'activity-timeline'],
        action: ['quick-actions'],
        team: ['team-activity', 'team-dashboard-share', 'team-online-status', 'change-history'],
        ai: ['ai-insights', 'ai-analysis'],
      }
      if (!categoryMap[selectedCategory]?.includes(card.type)) {
        return false
      }
    }
    // 搜索筛选
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      return card.name.toLowerCase().includes(searchLower) || card.description.toLowerCase().includes(searchLower)
    }
    return true
  })

  const handleApplyPreset = (preset: PresetLayout) => {
    // 应用预设布局：整卡替换当前布局（存在回调时走替换语义，未提供时降级为逐个追加）
    if (onApplyPreset) {
      onApplyPreset(preset.layout)
    } else {
      preset.layout.forEach((item) => {
        onAddCard(item.type)
      })
    }
    onClose()
  }

  const handleBatchAdd = () => {
    // 批量添加选中的卡片
    filteredCards.forEach(card => {
      onAddCard(card.type)
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-end">
      <div className="bg-white dark:bg-neutral-900 w-96 h-full shadow-2xl overflow-y-auto">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">布局编辑器</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* 预设布局模板 */}
          <section>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">预设布局模板</h3>
            <div className="space-y-2">
              {PRESET_LAYOUTS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all duration-200 text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-300/25 flex items-center justify-center">
                    <Maximize size={18} className="text-primary-700 dark:text-primary-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">{preset.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{preset.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* 搜索和分类 */}
          <section>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">添加卡片</h3>
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="搜索卡片..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 pl-10 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  <Search size={16} />
                </div>
              </div>
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${selectedCategory === category.id ? 'bg-primary-container text-primary-main' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
                  >
                    <span className="w-4 h-4 flex items-center justify-center">
                      {category.icon === 'Grid' && <Grid size={12} />}
                      {category.icon === 'BarChart3' && <BarChart3 size={12} />}
                      {category.icon === 'PieChart' && <PieChart size={12} />}
                      {category.icon === 'AlignLeft' && <AlignLeft size={12} />}
                      {category.icon === 'Plus' && <Plus size={12} />}
                      {category.icon === 'Users' && <Users size={12} />}
                      {category.icon === 'Brain' && <Brain size={12} />}
                    </span>
                    {category.name}
                  </button>
                ))}
              </div>
              {filteredCards.length > 1 && (
                <button
                  onClick={handleBatchAdd}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-container text-primary-main text-sm font-medium hover:bg-primary-container transition-colors"
                >
                  <Grid size={16} />
                  批量添加 ({filteredCards.length} 个)
                </button>
              )}
            </div>
          </section>

          {/* 可用卡片库 */}
          <section>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredCards.length > 0 ? (
                filteredCards.map((card) => (
                  <button
                    key={card.type}
                    onClick={() => onAddCard(card.type)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all duration-200 text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-300/25 flex items-center justify-center">
                      <Plus size={18} className="text-primary-700 dark:text-primary-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{card.name}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{card.description}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-6 text-center text-neutral-500 dark:text-neutral-400">
                  <Brain size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">未找到匹配的卡片</p>
                </div>
              )}
            </div>
          </section>

          {/* 布局提示 */}
          <section className="p-4 rounded-xl bg-warning-50 dark:bg-warning-300/15 border border-warning-200 dark:border-warning-800/30">
            <h4 className="text-sm font-medium text-warning-800 dark:text-warning-700 mb-2">布局提示</h4>
            <ul className="text-xs text-warning-700 dark:text-warning-700 space-y-1">
              <li>• 拖拽卡片可改变位置</li>
              <li>• 点击放大/缩小调整尺寸</li>
              <li>• 点击眼睛图标隐藏卡片</li>
              <li>• 配置保存后立即生效</li>
              <li>• 使用预设模板快速布局</li>
              <li>• 按分类筛选卡片更高效</li>
              <li>• 支持批量添加卡片</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

interface LayoutSwitcherProps {
  currentId: string
  layouts: { id: string; name: string; isDefault: boolean }[]
  onSwitch: (id: string) => void
  onCreate: (name: string) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string) => void
}

export function LayoutSwitcher({
  currentId,
  layouts,
  onSwitch,
  onCreate,
  onDelete,
  onSetDefault,
}: LayoutSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [newLayoutName, setNewLayoutName] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const handleCreate = () => {
    if (newLayoutName.trim()) {
      onCreate(newLayoutName.trim())
      setNewLayoutName('')
      setShowCreate(false)
    }
  }

  return (
    <div className="relative">
      {/* D-61：本下拉触发器在仪表盘被放在 .surface-primary 品牌实底横幅上，
          但内部文字用浅色卡片配色 text-neutral-700（#334155），压在绿底
          #047857 上仅 1.89:1。补一层自身底色把控件托回浅色卡片语境。 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        /* D-73：暗色下 dark:bg-white/10 是【浅色蒙版】，压在暗色品牌实底横幅
           (--color-primary-surface ≈ rgb(6,95,69)) 上得到 rgb(31,111,88)，
           而文字 dark:text-neutral-300 #cbd5e1 在其上只有 4.07:1。
           暗色改用【深色蒙版】bg-black/25 → rgb(5,71,52)，同一文字 7.21:1；
           亮色 bg-white dark:bg-neutral-800 原本就达标，保持不动。
           A-10：实测 114×38 低于 WCAG 2.5.5 的 44×44，补 min-h-[44px]。 */
        className="flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl bg-white dark:bg-black/25 border border-neutral-200 dark:border-white/20 hover:bg-neutral-100 dark:hover:bg-black/35 transition-colors"
      >
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {layouts.find(l => l.id === currentId)?.name || '视图'}
        </span>
        <ChevronDown size={16} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
      </button>

      {isOpen && (
        <>
          <div className="absolute inset-0 fixed z-40"  role="button" tabIndex={0} onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 z-50 overflow-hidden">
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">保存的视图</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {layouts.map((layout) => (
                <button
                  key={layout.id}
                  type="button"
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                    currentId === layout.id && 'bg-primary-50 dark:bg-primary-300/15',
                  )}
                  onClick={() => {
                    onSwitch(layout.id)
                    setIsOpen(false)
                  }}
                  aria-selected={currentId === layout.id}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'text-sm font-medium',
                      currentId === layout.id ? 'text-primary-700 dark:text-primary-700' : 'text-neutral-700 dark:text-neutral-300',
                    )}>
                      {layout.name}
                    </span>
                    {layout.isDefault && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-300/25 text-primary-700 dark:text-primary-700">
                        默认
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!layout.isDefault && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSetDefault(layout.id)
                        }}
                        className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600"
                        title="设为默认"
                      >
                        <Star size={14} />
                      </button>
                    )}
                    {!layout.isDefault && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(layout.id)
                        }}
                        className="p-1 rounded hover:bg-error-100 dark:hover:bg-error-900/30 text-neutral-400 hover:text-error-600"
                        title="删除"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-neutral-200 dark:border-neutral-800">
              {showCreate ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newLayoutName}
                    onChange={(e) => setNewLayoutName(e.target.value)}
                    placeholder="视图名称"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCreate}
                      disabled={!newLayoutName.trim()}
                      className="flex-1 px-3 py-2 rounded-lg bg-primary-container text-primary-main text-sm font-medium hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      创建
                    </button>
                    <button
                      onClick={() => {
                        setShowCreate(false)
                        setNewLayoutName('')
                      }}
                      className="px-3 py-2 rounded-lg text-neutral-600 dark:text-neutral-400 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  <Plus size={16} />
                  创建新视图
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
