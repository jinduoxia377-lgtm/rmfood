import React from 'react'
import { Sparkles, Zap, Brain, RefreshCw } from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { DEFAULTS } from '@/config'

interface HeaderProps {
  advancedMode: boolean
  onToggleAdvancedMode: () => void
  useLlm: boolean
  onToggleUseLlm: (checked: boolean) => void
  llmAvailable: boolean
  modelStatus: any
  generateResult: any
  onFullReset: () => void
}

export const Header: React.FC<HeaderProps> = ({
  advancedMode,
  onToggleAdvancedMode,
  useLlm,
  onToggleUseLlm,
  llmAvailable,
  modelStatus,
  generateResult,
  onFullReset,
}) => {
  return (
    <div className="relative px-6 py-6 border-b border-neutral-100 dark:border-neutral-800 overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-primary-500/5 via-primary-400/3 to-transparent rounded-bl-full -translate-y-1/2 translate-x-1/2" />

      <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-success-500 border-2 border-white dark:border-neutral-900 flex items-center justify-center">
              <Zap className="w-2.5 h-2.5 text-white" />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {DEFAULTS.PLACEHOLDER_TEXTS.PAGE_TITLE_GENERATE}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {DEFAULTS.PLACEHOLDER_TEXTS.PAGE_SUBTITLE_GENERATE}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onToggleAdvancedMode}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              advancedMode
                ? 'shadow-md hover:shadow-lg text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
            }`}
            style={{
              backgroundColor: advancedMode ? 'var(--color-accent-500)' : undefined,
            }}
          >
            <Brain className="w-4 h-4" />
            {advancedMode
              ? DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_SIMPLE_MODE
              : DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_ADVANCED_MODE
            }
          </button>

          {generateResult && (
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={onFullReset}
            >
              {DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_REGENERATE}
            </Button>
          )}

          {llmAvailable && (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={useLlm}
                  onChange={(e) => onToggleUseLlm(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-700 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-primary-600 shadow-sm">
                </div>
              </div>
              <span className="text-neutral-600 dark:text-neutral-400 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
                {DEFAULTS.PLACEHOLDER_TEXTS.LABEL_ENABLE_AI_ENHANCEMENT}
              </span>
              <Badge variant="neutral" className="text-xs px-1.5 py-0.5">
                {modelStatus?.llm?.provider || 'local'}
              </Badge>
            </label>
          )}
        </div>
      </div>
    </div>
  )
}
