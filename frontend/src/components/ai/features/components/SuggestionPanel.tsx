import React, { memo, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Lightbulb,
  Sparkles,
  ChevronRight,
  History,
  TrendingUp,
  Zap,
  X,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Copy,
  Check,
  Star,
  BarChart3,
  ChevronDown,
  Microscope,
  Scale,
  Cog,
  FlaskConical,
  ChartLine,
  DollarSign,
  Target,
  AlertTriangle,
  Rocket,
  Info,
} from 'lucide-react'
import type { LanguageCode } from '../services/languageService'

// 从 useChatInputState 导入接口，避免重复定义
import type { SmartSuggestion, EnhancedSuggestion } from '../hooks/useChatInputState'


import { logger } from '@/utils/safeLogger';
// SuggestionItem 类型别名
export type SuggestionItem = SmartSuggestion | EnhancedSuggestion

export interface SuggestionPanelProps {
  suggestions: SuggestionItem[]
  isVisible: boolean
  isStreaming: boolean
  detectedLanguage: LanguageCode
  onApplySuggestion: (suggestion: SuggestionItem) => void
  onClose: () => void
  onFeedback?: (suggestionId: string, rating: 'HELPFUL' | 'NOT_HELPFUL', reason?: string) => void
  onRegenerate?: (suggestionId: string) => void

  currentInput?: string
  onInputChange?: (input: string) => void
}

function isEnhanced(suggestion: SuggestionItem): suggestion is EnhancedSuggestion {
  return 'qScore' in suggestion && 'sections' in suggestion
}

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  history: History,
  trending: TrendingUp,
  ai: Sparkles,
  language: Zap,
  context: Lightbulb,
  optimization: Star,
  expert: Star,
  expert_formula: Star,
  expert_targeting: Star,
  expert_process: Star,
}

const STYLE_MAP: Record<string, string> = {
  history: 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500',
  trending: 'bg-warning-100 dark:bg-warning-300/25 text-warning-500',
  ai: 'bg-accent-100 dark:bg-accent-300/25 text-accent-500',
  language: 'bg-secondary-100 dark:bg-secondary-300/25 text-secondary-500',
  context: 'bg-secondary-100 dark:bg-secondary-300/25 text-secondary-500',
  optimization: 'bg-primary-100 dark:bg-primary-300/25 text-primary-500',
  expert: 'bg-accent-100 dark:bg-accent-300/25 text-accent-500',
  expert_formula: 'bg-accent-100 dark:bg-accent-300/25 text-accent-500',
  expert_targeting: 'bg-danger-100 dark:bg-danger-300/25 text-danger-500',
  expert_process: 'bg-success-100 dark:bg-success-300/25 text-success-500',
}

// 分类分组配置
interface CategoryGroup {
  id: string
  label: string
  icon: React.ComponentType<any>
  color: string
  bgColor: string
  priority: number
}

const CATEGORY_GROUPS: Record<string, CategoryGroup> = {
  '🔬 作用机制': {
    id: 'mechanism',
    label: '技术深化',
    icon: Microscope,
    color: 'text-accent-600 dark:text-accent-700',
    bgColor: 'bg-accent-50 dark:bg-accent-300/20',
    priority: 1,
  },
  '⚖️ 法规路径': {
    id: 'regulatory',
    label: '法规合规',
    icon: Scale,
    color: 'text-secondary-600 dark:text-secondary-700',
    bgColor: 'bg-secondary-50 dark:bg-secondary-300/20',
    priority: 2,
  },
  '⚙️ 工艺路线': {
    id: 'process',
    label: '工艺优化',
    icon: Cog,
    color: 'text-success-600 dark:text-success-700',
    bgColor: 'bg-success-50 dark:bg-success-300/20',
    priority: 3,
  },
  '⚙️ 关键工序': {
    id: 'process-detail',
    label: '工艺细节',
    icon: Cog,
    color: 'text-info-600 dark:text-info-700',
    bgColor: 'bg-info-50 dark:bg-info-300/20',
    priority: 4,
  },
  '🧪 原料推荐': {
    id: 'ingredient',
    label: '原料策略',
    icon: FlaskConical,
    color: 'text-success-600 dark:text-success-600',
    bgColor: 'bg-success-50 dark:bg-success-300/20',
    priority: 5,
  },
  '📊 验证路径': {
    id: 'efficacy',
    label: '功效验证',
    icon: ChartLine,
    color: 'text-accent-600 dark:text-accent-700',
    bgColor: 'bg-accent-50 dark:bg-accent-300/20',
    priority: 6,
  },
  '💰 成本参考': {
    id: 'cost',
    label: '成本价值',
    icon: DollarSign,
    color: 'text-warning-600 dark:text-warning-700',
    bgColor: 'bg-warning-50 dark:bg-warning-300/20',
    priority: 7,
  },
  '🎯 差异化': {
    id: 'market',
    label: '市场定位',
    icon: Target,
    color: 'text-danger-600 dark:text-danger-700',
    bgColor: 'bg-danger-50 dark:bg-danger-300/20',
    priority: 8,
  },
  '⚠️ 风险提示': {
    id: 'risk',
    label: '风险预警',
    icon: AlertTriangle,
    color: 'text-error-600 dark:text-error-600',
    bgColor: 'bg-error-50 dark:bg-error-300/20',
    priority: 9,
  },
  '🚀 开发路线图': {
    id: 'roadmap',
    label: '快速启动',
    icon: Rocket,
    color: 'text-warning-600 dark:text-warning-700',
    bgColor: 'bg-warning-50 dark:bg-warning-300/20',
    priority: 10,
  },
  '🧪 成分矩阵': {
    id: 'matrix',
    label: '成分推荐',
    icon: FlaskConical,
    color: 'text-primary-700 dark:text-primary-700',
    bgColor: 'bg-primary-50 dark:bg-primary-300/20',
    priority: 11,
  },
  '⚖️ 合规自检': {
    id: 'compliance-check',
    label: '合规检查',
    icon: Scale,
    color: 'text-info-700 dark:text-info-700',
    bgColor: 'bg-info-50 dark:bg-info-300/20',
    priority: 12,
  },
  '💡 信息补充引导': {
    id: 'info-guide',
    label: '信息引导',
    icon: Info,
    color: 'text-neutral-600 dark:text-neutral-400',
    bgColor: 'bg-neutral-50 dark:bg-neutral-900/20',
    priority: 13,
  },
}

const VIRTUAL_SCROLL_THRESHOLD = 20
const COPY_DEBOUNCE_MS = 300
const MIN_INPUT_LENGTH_FOR_DYNAMIC = 2

interface LegacySuggestionCardProps {
  suggestion: SmartSuggestion
  index: number
  isSelected: boolean
  onSelect: () => void
  onApply: () => void
}

const LegacySuggestionCard = memo<LegacySuggestionCardProps>(({
  suggestion,
  index,
  isSelected,
  onSelect,
  onApply,
}) => {
  const Icon = ICON_MAP[suggestion.type] || Lightbulb
  const iconStyle = STYLE_MAP[suggestion.type] || STYLE_MAP.context

  return (
    <button
      key={suggestion.id}
      data-index={index}
      onClick={onApply}
      onMouseEnter={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150 border-b border-neutral-100 dark:border-neutral-700 last:border-0 ${
        isSelected
          ? 'bg-gradient-to-r from-secondary-50 to-accent-50 dark:from-secondary-900/20 dark:to-accent-900/20 shadow-sm'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-700'
      }`}
      role="option"
      aria-selected={isSelected}
      aria-posinset={index + 1}
      aria-setsize={1}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconStyle} shadow-sm`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 text-left">
        <div className="text-neutral-800 dark:text-neutral-200 font-medium text-sm leading-tight">
          {suggestion.text}
        </div>
        {suggestion.category && (
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
            {suggestion.category}
            {suggestion.score > 0 && (
              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-1">
                (相关度: {Math.round(suggestion.score * 100)}%)
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <ChevronRight className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
      </div>
    </button>
  )
})
LegacySuggestionCard.displayName = 'LegacySuggestionCard'

const SuggestionPanel = memo<SuggestionPanelProps>(({
  suggestions,
  isVisible,
  isStreaming,
  detectedLanguage,
  onApplySuggestion,
  onClose,
  onFeedback,
  onRegenerate,
  currentInput = '',

  onInputChange,
}) => {
  void onInputChange
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isUpdating, setIsUpdating] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const panelRef = useRef<HTMLDivElement>(null)

  // 分组建议（按 category 字段）
  const groupedSuggestions = useMemo(() => {
    const groups: Record<string, SmartSuggestion[]> = {}

    suggestions.forEach(suggestion => {
      if (!isEnhanced(suggestion)) {
        const category = suggestion.category || '其他'
        if (!groups[category]) {
          groups[category] = []
        }
        groups[category].push(suggestion)
      }
    })

    // 按优先级排序
    return Object.entries(groups)
      .sort((a, b) => {
        const groupA = CATEGORY_GROUPS[a[0]]
        const groupB = CATEGORY_GROUPS[b[0]]
        const priorityA = groupA?.priority ?? 99
        const priorityB = groupB?.priority ?? 99
        return priorityA - priorityB
      })
      .map(([category, items]) => ({
        category,
        items,
        config: CATEGORY_GROUPS[category],
      }))
  }, [suggestions])

  // 切换分组折叠状态（使用 useCallback 优化性能）
  const toggleGroup = useCallback((categoryId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }, [])

  // 仅用于显示更新状态（不触发循环）
  useEffect(() => {
    if (!isVisible || !currentInput || currentInput.length < MIN_INPUT_LENGTH_FOR_DYNAMIC) {
      return
    }

    setIsUpdating(true)
    const timer = setTimeout(() => setIsUpdating(false), 100)

    return () => clearTimeout(timer)
  }, [currentInput, isVisible])

  const enhancedSuggestions = suggestions.filter(isEnhanced)
  const hasEnhanced = enhancedSuggestions.length > 0
  const avgQScore = hasEnhanced
    ? Math.round(enhancedSuggestions.reduce((sum, s) => sum + s.qScore, 0) / enhancedSuggestions.length)
    : 0

  useEffect(() => {
    if (!isVisible) {
      setSelectedIndex(0)
    }
  }, [isVisible])

  useEffect(() => {
    if (!isVisible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (suggestions.length === 0) return

      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selected = suggestions[selectedIndex]
        if (selected) onApplySuggestion(selected)
      } else if (e.key === ']') {
        // 展开所有分组
        e.preventDefault()
        setCollapsedGroups(new Set())
      } else if (e.key === '[') {
        // 折叠所有分组
        e.preventDefault()
        const allCategoryIds = groupedSuggestions.map(g => g.category)
        setCollapsedGroups(new Set(allCategoryIds))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, suggestions, selectedIndex, onApplySuggestion, onClose, groupedSuggestions])

  useEffect(() => {
    if (selectedIndex >= 0 && panelRef.current) {
      const selectedElement = panelRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  if (!isVisible || suggestions.length === 0 || isStreaming) {
    return null
  }

  const useVirtualScroll = suggestions.length > VIRTUAL_SCROLL_THRESHOLD
  const languageLabel = detectedLanguage === 'zh-CN' ? '中文' : 'English'

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full left-4 right-4 sm:left-6 sm:right-6 lg:left-8 lg:right-8 mb-2 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden z-50 animate-in slide-in-from-bottom-2 fade-in duration-200"
      role="listbox"
      aria-label="专业级智能建议"
      style={{ maxHeight: '400px' }}
    >
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 bg-gradient-to-r from-neutral-50/50 to-transparent dark:from-neutral-700/30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <div className={`p-1.5 rounded-lg ${isUpdating ? 'bg-secondary-100 dark:bg-secondary-300/25' : 'bg-warning-100 dark:bg-warning-300/25'}`}>
              <Lightbulb className={`w-4 h-4 ${isUpdating ? 'text-secondary-500 animate-pulse' : 'text-warning-600 dark:text-warning-700'}`} />
            </div>
            <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              专业级智能建议
            </span>
          </div>
          <Badge variant="outline" className="text-xs h-5">
            {languageLabel}
          </Badge>
          {isUpdating && (
            <Badge className="text-xs h-5 bg-secondary-100 text-secondary-600 dark:bg-secondary-300/35 dark:text-secondary-700 border-secondary-200 dark:border-secondary-800">
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              实时更新中...
            </Badge>
          )}
          {hasEnhanced && !isUpdating && (
            <Badge className="text-xs h-5 bg-accent-100 text-accent-600 dark:bg-accent-300/35 dark:text-accent-700 border-accent-200 dark:border-accent-800">
              <Star className="w-3 h-3 mr-1" />
              AI Engine v2.0
            </Badge>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          aria-label="关闭建议"
        >
          <X className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
        </button>
      </div>

      <div className={`max-h-64 sm:max-h-72 overflow-y-auto ${useVirtualScroll ? 'virtual-scroll-container' : ''}`}>
        {/* 分组渲染 */}
        {groupedSuggestions.map((group, groupIndex) => {
          const GroupIcon = group.config?.icon || Lightbulb
          const isCollapsed = collapsedGroups.has(group.category)
          const globalIndexOffset = groupedSuggestions
            .slice(0, groupIndex)
            .reduce((sum, g) => sum + g.items.length, 0)

          return (
            <div key={group.category} className="border-b border-neutral-100 dark:border-neutral-700 last:border-0">
              {/* 分类标题 */}
              <button
                onClick={() => toggleGroup(group.category)}
                className={`w-full flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors ${
                  group.config?.bgColor || 'bg-neutral-50 dark:bg-neutral-800'
                } hover:opacity-80`}
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                <GroupIcon className={`w-3.5 h-3.5 ${group.config?.color || 'text-neutral-600'}`} />
                <span className={group.config?.color || 'text-neutral-700 dark:text-neutral-300'}>
                  {group.category}
                </span>
                <span className="ml-auto text-xs text-neutral-400 bg-white dark:bg-neutral-700 px-1.5 py-0.5 rounded-full">
                  {group.items.length}
                </span>
              </button>

              {/* 分类内容 */}
              {!isCollapsed && (
                <div className="py-1">
                  {group.items.map((suggestion, index) => {
                    const globalIndex = globalIndexOffset + index
                    const isSelected = globalIndex === selectedIndex

                    return (
                      <LegacySuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        index={globalIndex}
                        isSelected={isSelected}
                        onSelect={() => setSelectedIndex(globalIndex)}
                        onApply={() => onApplySuggestion(suggestion)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* 增强型建议（单独渲染在最后） */}
        {enhancedSuggestions.length > 0 && enhancedSuggestions.map((suggestion, index) => {
          const globalIndex = suggestions.length - enhancedSuggestions.length + index
          const isSelected = globalIndex === selectedIndex

          return (
            <EnhancedSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              index={globalIndex}
              isSelected={isSelected}
              onSelect={() => setSelectedIndex(globalIndex)}
              onApply={() => onApplySuggestion(suggestion)}
              onFeedback={onFeedback}
              onRegenerate={onRegenerate}
              detectedLanguage={detectedLanguage}
            />
          )
        })}
      </div>

      <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-700 flex items-center justify-between text-xs text-neutral-400">
        <span>
          ↑↓ 选择 · Enter 应用 · Esc 关闭 · [ 折叠全部 ] 展开全部
        </span>
        {groupedSuggestions.length > 0 && (
          <span className="flex items-center gap-1.5">
            <BarChart3 className="w-3 h-3" />
            共 {suggestions.length} 条建议
            {' '}·{' '}
            {groupedSuggestions.length} 个分类
            {avgQScore > 0 && <> | 平均质量分: <strong className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{avgQScore}</strong></>}
          </span>
        )}
      </div>
    </div>
  )
})

SuggestionPanel.displayName = 'SuggestionPanel'
export default SuggestionPanel

// 增强型建议卡片组件（简化版）
function EnhancedSuggestionCard({
  suggestion,
  index,
  isSelected,
  onSelect,
  onApply,
  onFeedback,

  onRegenerate,
  detectedLanguage,
}: {
  suggestion: EnhancedSuggestion
  index: number
  isSelected: boolean
  onSelect: () => void
  onApply: () => void
  onFeedback?: (id: string, rating: 'HELPFUL' | 'NOT_HELPFUL', reason?: string) => void
  onRegenerate?: (id: string) => void
  detectedLanguage: LanguageCode
}) {
  void detectedLanguage
  void onRegenerate
  const [feedbackGiven, setFeedbackGiven] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(suggestion.title)
      setCopied(true)
      setTimeout(() => setCopied(false), COPY_DEBOUNCE_MS)
    } catch (err) {
      logger.warn('Copy failed:', err)
    }
  }

  const handleFeedback = (rating: 'HELPFUL' | 'NOT_HELPFUL') => {
    if (onFeedback) {
      onFeedback(suggestion.id, rating)
      setFeedbackGiven(true)
    }
  }

  const qScoreColor = getQualityScoreColor(suggestion.qScore)
  const qualityLabel = formatQualityLabel(suggestion.qScore)

  return (
    <div
      data-index={index}
      onMouseEnter={onSelect}
      className={`group w-full p-4 cursor-pointer border-b border-neutral-100 dark:border-neutral-700 last:border-0 transition-all duration-200 ${
        isSelected
          ? 'bg-gradient-to-r from-accent-50 to-accent-50 dark:from-accent-900/20 dark:to-accent-900/20 shadow-md ring-1 ring-accent-200 dark:ring-accent-800'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-750'
      }`}
      role="option"
      aria-selected={isSelected}
      data-quality={suggestion.qScore}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 pr-3">
          <h4 className="font-semibold text-sm text-neutral-800 dark:text-neutral-200 leading-tight line-clamp-2">
            {formatSuggestionTitle(suggestion.title)}
          </h4>
        </div>

        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy() }}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-600 rounded-lg transition-colors"
            title="复制标题"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-success-500" /> : <Copy className="w-3.5 h-3.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
          </button>

          {onRegenerate && (
            <button
              onClick={(e) => { e.stopPropagation(); onRegenerate(suggestion.id) }}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-600 rounded-lg transition-colors"
              title="重新生成"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
            </button>
          )}
        </div>
      </div>

      {/* Sections Preview */}
      {suggestion.sections.slice(0, 2).map((section, idx) => (
        <div key={idx} className="mb-2 pl-2 border-l-2 border-neutral-200 dark:border-neutral-600">
          <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-0.5">{section.heading}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">{section.content}</p>
        </div>
      ))}

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${qScoreColor} border`}>
            {qualityLabel}
          </Badge>
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
            {getFrameworkLabel(suggestion.framework)}
          </Badge>
        </div>

        {!feedbackGiven && onFeedback && (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); handleFeedback('HELPFUL') }}
              className="p-1 hover:bg-success-50 dark:hover:bg-success-900/20 rounded transition-colors"
              title="有帮助"
            >
              <ThumbsUp className="w-3.5 h-3.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-success-500" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleFeedback('NOT_HELPFUL') }}
              className="p-1 hover:bg-error-50 dark:hover:bg-error-900/20 rounded transition-colors"
              title="无帮助"
            >
              <ThumbsDown className="w-3.5 h-3.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-error-500" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper functions
function getQualityScoreColor(score: number): string {
  if (score >= 90) return 'border-success-300 text-success-600 dark:border-success-700 dark:text-success-600'
  if (score >= 75) return 'border-secondary-300 text-secondary-600 dark:border-secondary-700 dark:text-secondary-700'
  if (score >= 60) return 'border-warning-300 text-warning-600 dark:border-warning-700 dark:text-warning-700'
  return 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400'
}

function formatQualityLabel(score: number): string {
  if (score >= 90) return `${score}% 优秀`
  if (score >= 75) return `${score}% 良好`
  if (score >= 60) return `${score}% 合格`
  return `${score}% 待优化`
}

function formatSuggestionTitle(title: string): string {
  return escapeForMarkdown(title).replace(/\*\*/g, '')
}

function escapeForMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!|]/g, '\\$&')
}

function getFrameworkLabel(framework: string): string {
  const labels: Record<string, string> = {
    'FORMULA_DESIGN': '配方设计框架',
    'SAFETY_ASSESSMENT': '安全评估框架',
    'PERFORMANCE_OPT': '性能优化框架',
    'COST_REDUCTION': '成本控制框架',
    'MARKET_ANALYSIS': '市场分析框架',
    'INGREDIENT_ANALYSIS': '原料分析框架',
    'PROCESS_TECHNOLOGY': '工艺技术框架',
    'REGULATORY_COMPLIANCE': '法规合规框架',
  }
  return labels[framework] || framework
}

// Badge component (simple version)
function Badge({ children, variant, className }: { children: React.ReactNode; variant?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
      variant === 'outline' ? 'border border-current' : ''
    } ${className || ''}`}>
      {children}
    </span>
  )
}
