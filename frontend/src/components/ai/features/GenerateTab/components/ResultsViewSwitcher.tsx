import React from 'react'
import { Layers, BarChart3 } from 'lucide-react'
import { DEFAULTS } from '@/config'

interface ResultsViewSwitcherProps {
  viewMode: 'card' | 'compare'
  onViewModeChange: (mode: 'card' | 'compare') => void
}

export const ResultsViewSwitcher: React.FC<ResultsViewSwitcherProps> = ({
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
      <button
        onClick={() => onViewModeChange('card')}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
          viewMode === 'card'
            ? 'bg-white dark:bg-gray-700 shadow-sm'
            : ''
        }`}
        style={{
          color: viewMode === 'card'
            ? 'var(--color-primary-600)'
            : 'var(--text-muted)',
        }}
      >
        <Layers className="w-3.5 h-3.5" />
        {DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_CARD_VIEW}
      </button>
      <button
        onClick={() => onViewModeChange('compare')}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
          viewMode === 'compare'
            ? 'bg-white dark:bg-gray-700 shadow-sm'
            : ''
        }`}
        style={{
          color: viewMode === 'compare'
            ? 'var(--color-primary-600)'
            : 'var(--text-muted)',
        }}
      >
        <BarChart3 className="w-3.5 h-3.5" />
        {DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_COMPARE_VIEW}
      </button>
    </div>
  )
}
