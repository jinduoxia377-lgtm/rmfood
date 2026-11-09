import React from 'react'
import { Layers, BarChart3 } from 'lucide-react'
import { DEFAULTS } from '@/config'

interface ResultsViewSwitcherProps {
  viewMode: 'card' | 'compare'
  onViewModeChange: (mode: 'card' | 'compare') => void
}

/**
 * 卡片/对比视图切换。遵循设计系统 v4.0：使用语义令牌（bg-muted / bg-card /
 * text-primary / text-muted-foreground）自动适配明暗主题，不硬编码灰阶色值、
 * 不使用内联 style 色值。最小触摸目标 44px（py-2）。
 */
export const ResultsViewSwitcher: React.FC<ResultsViewSwitcherProps> = ({
  viewMode,
  onViewModeChange,
}) => {
  const base =
    'px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5'
  const active = 'bg-card shadow-sm text-primary'
  const inactive = 'text-muted-foreground hover:text-primary'

  return (
    <div className="flex bg-muted rounded-xl p-1 gap-1" role="tablist" aria-label="结果视图切换">
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'card'}
        onClick={() => onViewModeChange('card')}
        className={`${base} ${viewMode === 'card' ? active : inactive}`}
      >
        <Layers className="w-3.5 h-3.5" />
        {DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_CARD_VIEW}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'compare'}
        onClick={() => onViewModeChange('compare')}
        className={`${base} ${viewMode === 'compare' ? active : inactive}`}
      >
        <BarChart3 className="w-3.5 h-3.5" />
        {DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_COMPARE_VIEW}
      </button>
    </div>
  )
}

export default ResultsViewSwitcher
