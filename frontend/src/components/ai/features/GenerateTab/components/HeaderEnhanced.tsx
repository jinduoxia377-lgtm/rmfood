import React from 'react'
import { Sparkles, Zap, Brain, RefreshCw, MessageSquare, Settings, History, Download } from 'lucide-react'
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
  onSwitchToChat?: () => void
  onExportHistory?: () => void
  historyCount?: number
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
  onSwitchToChat,
  onExportHistory,
  historyCount = 0,
}) => {
  return (
    <div className="relative px-6 py-5 border-b border-neutral-100 dark:border-neutral-800 overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-primary-500/5 via-primary-400/3 to-transparent rounded-bl-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-gradient-to-tr from-accent-500/5 to-transparent rounded-full" />

      <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* 左侧：标题区域 */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-success-500 border-2 border-white dark:border-neutral-900 flex items-center justify-center">
              <Zap className="w-2.5 h-2.5 text-white" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {DEFAULTS.PLACEHOLDER_TEXTS.PAGE_TITLE_GENERATE}
              </h2>
              {llmAvailable && (
                <Badge variant="success" className="text-[10px] px-1.5 py-0.5">
                  AI就绪
                </Badge>
              )}
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {DEFAULTS.PLACEHOLDER_TEXTS.PAGE_SUBTITLE_GENERATE}
            </p>
          </div>
        </div>

        {/* 右侧：操作按钮组 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 切换到对话模式 */}
          {onSwitchToChat && (
            <button
              onClick={onSwitchToChat}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-neutral-700 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">对话生成</span>
            </button>
          )}

          {/* 高级模式切换 */}
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

          {/* 重新生成 */}
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

          {/* AI增强开关 */}
          {llmAvailable && (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none group px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={useLlm}
                  onChange={(e) => onToggleUseLlm(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-neutral-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-700 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:bg-primary-600" />
              </div>
              <span className="text-neutral-600 dark:text-neutral-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                AI增强
              </span>
              <Badge variant="neutral" className="text-[10px] px-1.5 py-0.5">
                {modelStatus?.llm?.provider || 'local'}
              </Badge>
            </label>
          )}

          {/* 历史记录 */}
          {historyCount > 0 && onExportHistory && (
            <button
              onClick={onExportHistory}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="查看历史记录"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">{historyCount}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
