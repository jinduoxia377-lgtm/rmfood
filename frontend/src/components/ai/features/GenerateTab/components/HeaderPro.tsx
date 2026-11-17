/**
 * HeaderPro - Professional Formula Generation Header Component
 * 
 * @description Header component following RMFOOD design system specifications
 * @version 4.0.0 - UI/UX Optimized
 */
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Zap, Brain, RefreshCw, MessageSquare, History, Info } from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import type { GeneratorType } from '../config/generateTabConfig'

interface HeaderProProps {
  advancedMode: boolean
  onToggleAdvancedMode: () => void
  useLlm: boolean
  onToggleUseLlm: (checked: boolean) => void
  llmAvailable: boolean
  modelStatus: { llm?: { provider: string; model: string }; neural?: { available: boolean } } | null
  generateResult: any[] | null
  onFullReset: () => void
  onSwitchToChat?: () => void
  /** 历史按钮点击回调（打开版本历史面板） */
  onViewHistory?: () => void
  historyCount?: number
  generator?: GeneratorType
  className?: string
}

export const HeaderPro: React.FC<HeaderProProps> = ({
  advancedMode,
  onToggleAdvancedMode,
  useLlm,
  onToggleUseLlm,
  llmAvailable,
  modelStatus,
  generateResult,
  onFullReset,
  onSwitchToChat,
  onViewHistory,
  historyCount = 0,
  generator,
  className = '',
}) => {
  const { t } = useTranslation()

  // Get generator label
  const getGeneratorLabel = (gen: GeneratorType | undefined): string => {
    switch (gen) {
      case 'llm': return t('ai.formula.generateTab.generatorLlm')
      case 'neural_network': return t('ai.formula.generateTab.generatorNeural')
      case 'ga': return t('ai.formula.generateTab.generatorGa')
      default: return t('ai.formula.generateTab.generatorRule')
    }
  }

  // Get generator color variant
  const getGeneratorColor = (gen: GeneratorType | undefined): 'accent' | 'danger' | 'neutral' => {
    switch (gen) {
      case 'llm': return 'accent'
      case 'neural_network': return 'danger'
      case 'ga': return 'accent'
      default: return 'neutral'
    }
  }

  return (
    <div className={`border-b border-border bg-surface ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 py-5 px-6">
        {/* Left: Brand title */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-md">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            {llmAvailable && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-success border-2 border-surface flex items-center justify-center">
                <Zap className="w-2.5 h-2.5 text-primary-foreground" />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="h2 font-semibold text-foreground">
                {t('ai.formula.title')}
              </h2>
              {/* 专业版标识：从 GenerateTab 顶部浮层徽章迁移至此，避免与标题/按钮重叠 */}
              <Badge variant="neutral" className="text-overline font-semibold gap-1">
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                {t('ai.formula.generateTab.professional')}
              </Badge>
              {llmAvailable && (
                <Badge variant="success" className="text-overline font-semibold">
                  {t('ai.formula.generateTab.aiReady')}
                </Badge>
              )}
            </div>
            <p className="text-body-sm text-muted-foreground mt-1">
              {t('ai.formula.ui.subtitle')}
            </p>
          </div>
        </div>

        {/* Right: Action buttons — 状态分组 + 图标化次要操作 + 主操作，避免拥挤换行 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Generator status（状态信息，非操作） */}
          {generator && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 dark:bg-muted/40 rounded-xl border border-border dark:border-border">
              <span className="text-caption text-muted-foreground font-medium">{t('ai.formula.generateTab.generationEngine')}:</span>
              <Badge variant={getGeneratorColor(generator) as "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "danger" | "neutral" | "primary"} className="text-overline font-semibold">
                {getGeneratorLabel(generator)}
              </Badge>
            </div>
          )}

          {/* Secondary actions group（图标按钮，≥44×44 触摸目标） */}
          <div className="flex items-center gap-1.5">
            {/* Switch to chat mode */}
            {onSwitchToChat && (
              <button
                onClick={onSwitchToChat}
                aria-label={t('ai.formula.generateTab.chatMode')}
                title={t('ai.formula.generateTab.chatMode')}
                className="flex items-center justify-center w-11 h-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/40 transition-all duration-fast"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            )}

            {/* History（去重：仅保留一处计数显示 + sr-only 完整标签） */}
            {historyCount > 0 && (
              <button
                onClick={onViewHistory}
                className="relative flex items-center justify-center w-11 h-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/40 transition-colors"
                title={t('ai.formula.generateTab.viewHistory')}
              >
                <History className="w-5 h-5" />
                <span className="sr-only">{t('ai.formula.generateTab.viewHistory')}</span>
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-tiny font-semibold font-mono">
                  {historyCount}
                </span>
              </button>
            )}
          </div>

          {/* AI enhancement toggle（保持语义不变，触摸目标 ≥44px） */}
          {llmAvailable && (
            <label className="flex items-center gap-2.5 text-body-sm cursor-pointer select-none group min-h-[44px] px-3 rounded-xl hover:bg-muted dark:hover:bg-muted/40 transition-colors">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={useLlm}
                  onChange={(e) => onToggleUseLlm(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer dark:bg-border peer-checked:bg-primary after:content-[\'\'] after:absolute after:top-0.5 after:left-0.5 after:bg-background after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-primary-foreground" />
              </div>
              <span className="text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                {t('ai.formula.generateTab.aiEnhanced')}
              </span>
              <Badge variant="neutral" className="text-overline font-semibold">
                {modelStatus?.llm?.provider || t('ai.formula.generateTab.localProvider')}
              </Badge>
            </label>
          )}

          {/* Advanced mode toggle */}
          <button
            onClick={onToggleAdvancedMode}
            aria-pressed={advancedMode}
            className={`flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-body-sm font-semibold transition-all duration-fast
              ${advancedMode
                ? 'bg-accent/10 text-accent border border-accent/20'
                : 'bg-muted/60 dark:bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-background dark:hover:bg-surface-elevated border border-border dark:border-border'
              }`}
          >
            <Brain className="w-4 h-4" />
            {advancedMode
              ? t('ai.formula.generateTab.simpleMode')
              : t('ai.formula.generateTab.advancedMode')
            }
          </button>

          {/* Regenerate */}
          {generateResult && generateResult.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={onFullReset}
              className="rounded-xl font-semibold min-h-[44px]"
            >
              {t('ai.formula.generateTab.regenerate')}
            </Button>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="flex items-center gap-4 text-caption text-muted-foreground px-6 py-3 border-t border-border/50 bg-muted/20">
        <span className="flex items-center gap-1.5">
          <kbd className="px-2 py-1 bg-muted rounded-md border border-border font-mono">Ctrl+Enter</kbd>
          <span>{t('ai.formula.generateTab.generateFormula')}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="px-2 py-1 bg-muted rounded-md border border-border font-mono">Esc</kbd>
          <span>{t('ai.formula.generateTab.cancel')}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="px-2 py-1 bg-muted rounded-md border border-border font-mono">Ctrl+K</kbd>
          <span>{t('ai.formula.generateTab.chat')}</span>
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-muted-foreground/60">
          <Info className="w-3.5 h-3.5" />
          <span>{t('ai.formula.generateTab.shortcutHint')}</span>
        </span>
      </div>
    </div>
  )
}

export default HeaderPro
