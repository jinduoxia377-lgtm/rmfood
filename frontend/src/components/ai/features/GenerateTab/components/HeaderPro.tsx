/**
 * HeaderPro - Professional Formula Generation Header Component
 * 
 * @description Header component following RMFOOD design system specifications
 * @version 4.0.0 - UI/UX Optimized
 */
import React from 'react'
import { Sparkles, Zap, Brain, RefreshCw, MessageSquare, Settings, History, ChevronDown, Info } from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { DEFAULTS } from '@/config'
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
  historyCount = 0,
  generator,
  className = '',
}) => {
  // Get generator label
  const getGeneratorLabel = (gen: GeneratorType | undefined): string => {
    switch (gen) {
      case 'llm': return 'AI LLM'
      case 'neural_network': return '神经网络'
      default: return '规则引擎'
    }
  }

  // Get generator color variant
  const getGeneratorColor = (gen: GeneratorType | undefined): 'accent' | 'danger' | 'neutral' => {
    switch (gen) {
      case 'llm': return 'accent'
      case 'neural_network': return 'danger'
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
            <div className="flex items-center gap-2.5">
              <h2 className="text-headline-sm font-semibold text-foreground">
                {DEFAULTS.PLACEHOLDER_TEXTS.PAGE_TITLE_GENERATE}
              </h2>
              {llmAvailable && (
                <Badge variant="success" className="text-label-sm font-semibold">
                  AI就绪
                </Badge>
              )}
            </div>
            <p className="text-body-sm text-muted-foreground mt-1">
              {DEFAULTS.PLACEHOLDER_TEXTS.PAGE_SUBTITLE_GENERATE}
            </p>
          </div>
        </div>

        {/* Right: Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Generator status */}
          {generator && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 rounded-xl border border-border">
              <span className="text-caption text-muted-foreground font-medium">Generator:</span>
              <Badge variant={getGeneratorColor(generator) as "default" | "success" | "warning" | "error" | "info" | "danger" | "neutral" | "primary" | "secondary" | "outline" | "destructive"} className="text-label-sm font-semibold">
                {getGeneratorLabel(generator)}
              </Badge>
            </div>
          )}

          {/* Switch to chat mode */}
          {onSwitchToChat && (
            <button
              onClick={onSwitchToChat}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-body-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-fast"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">对话模式</span>
            </button>
          )}

          {/* History */}
          {historyCount > 0 && (
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-body-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="查看历史"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline font-medium">{historyCount}</span>
              <Badge variant="neutral" className="text-label-sm font-semibold ml-1">{historyCount}</Badge>
            </button>
          )}

          {/* AI enhancement toggle */}
          {llmAvailable && (
            <label className="flex items-center gap-2.5 text-body-sm cursor-pointer select-none group px-4 py-2 rounded-xl hover:bg-muted transition-colors">
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
                AI增强
              </span>
              <Badge variant="neutral" className="text-label-sm font-semibold">
                {modelStatus?.llm?.provider || 'local'}
              </Badge>
            </label>
          )}

          {/* Advanced mode toggle */}
          <button
            onClick={onToggleAdvancedMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-body-sm font-semibold transition-all duration-fast
              ${advancedMode
                ? 'bg-accent/10 text-accent border border-accent/20'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-background border border-border'
              }`}
          >
            <Brain className="w-4 h-4" />
            {advancedMode
              ? DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_SIMPLE_MODE
              : DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_ADVANCED_MODE
            }
          </button>

          {/* Regenerate */}
          {generateResult && generateResult.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={onFullReset}
              className="rounded-xl font-semibold"
            >
              {DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_REGENERATE}
            </Button>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="flex items-center gap-4 text-caption text-muted-foreground px-6 py-3 border-t border-border/50 bg-muted/20">
        <span className="flex items-center gap-1.5">
          <kbd className="px-2 py-1 bg-muted rounded-md border border-border font-mono">Ctrl+Enter</kbd>
          <span>生成配方</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="px-2 py-1 bg-muted rounded-md border border-border font-mono">Esc</kbd>
          <span>取消</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="px-2 py-1 bg-muted rounded-md border border-border font-mono">Ctrl+K</kbd>
          <span>对话</span>
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-muted-foreground/60">
          <Info className="w-3.5 h-3.5" />
          <span>按快捷键提升操作效率</span>
        </span>
      </div>
    </div>
  )
}

export default HeaderPro
