import React, { Suspense, lazy, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Target, FileText, RefreshCw, Wand2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui'
import { GenerationProgressPanel } from '@/components/ai/GenerationProgressPanel'
import { FormulaInputWindow } from '@/components/ai/FormulaInputWindow'
import { EFFECT_OPTIONS } from '@/config/ai'
import { DEFAULTS, VALIDATION } from '@/config'
import { CheckCircle } from 'lucide-react'
import { logger } from '@/utils/safeLogger'

const PersonalizedRecommendations = lazy(() =>
  import('@/components/ai/PersonalizedRecommendations').then(module => ({
    default: module.PersonalizedRecommendations,
  })),
)
const ParameterAdjustPanel = lazy(() =>
  import('@/components/ai/ParameterAdjustPanel').then(module => ({
    default: module.ParameterAdjustPanel,
  })),
)

interface EffectOption {
  id: string
  label: string
  labelKey: string
  category: string
  categoryKey: string
  popular: boolean
}

interface GenerationInputProps {
  inputMode: 'effects' | 'manual'
  onInputModeChange: (mode: 'effects' | 'manual') => void
  selectedEffects: EffectOption[]
  onToggleEffect: (effect: EffectOption) => void
  onClearEffects: () => void
  effectLabels: string[]
  canSelectMore: boolean
  selectionCount: number
  onGenerate: (effects: string[]) => void
  isGenerating: boolean
  progress: any
  onCancelGeneration: () => void
  onManualFormulaInput: (candidate: any) => void
  onSetSelectedEffects: (effects: EffectOption[]) => void
  paramPanelExpanded: boolean
  onToggleParamPanel: () => void
  onFullReset: () => void
  useLlm: boolean
}

export const GenerationInput: React.FC<GenerationInputProps> = ({
  inputMode,
  onInputModeChange,
  selectedEffects,
  onToggleEffect,
  effectLabels,
  canSelectMore,
  selectionCount,
  onGenerate,
  isGenerating,
  progress,
  onCancelGeneration,
  onManualFormulaInput,
  onSetSelectedEffects,
  paramPanelExpanded,
  onToggleParamPanel,
  useLlm,
}) => {
  const { t } = useTranslation()
  const isEffectSelected = useCallback((effectId: string) => {
    return selectedEffects.some(e => e.id === effectId)
  }, [selectedEffects])

  return (
    <div className="space-y-6 animate-[fadeInUp_0.4s_cubic-bezier(0.16,1,0.3,1)_both]">
      {/* 输入模式切换 — 分段控制器 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            {DEFAULTS.PLACEHOLDER_TEXTS.LABEL_INPUT_MODE}
          </span>
          <div className="flex bg-neutral-100 dark:bg-neutral-800/80 rounded-xl p-1 shadow-inner">
            <button
              onClick={() => onInputModeChange('effects')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                inputMode === 'effects'
                  ? 'bg-white dark:bg-neutral-700 shadow-md text-neutral-900 dark:text-neutral-100 scale-105'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <Target className="w-4 h-4" />
              {DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_SELECT_EFFECTS}
            </button>
            <button
              onClick={() => onInputModeChange('manual')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                inputMode === 'manual'
                  ? 'bg-white dark:bg-neutral-700 shadow-md text-neutral-900 dark:text-neutral-100 scale-105'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              {DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_MANUAL_INPUT}
            </button>
          </div>
        </div>
      </div>

      {inputMode === 'manual' && (
        <div className="animate-fade-in">
          <FormulaInputWindow
            onClose={() => onInputModeChange('effects')}
            onSubmit={onManualFormulaInput}
          />
        </div>
      )}

      {inputMode === 'effects' && (
        <>
          <Suspense fallback={
            <div className="animate-pulse p-6 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              {DEFAULTS.PLACEHOLDER_TEXTS.LOADING_TEXT}
            </div>
          }>
            <PersonalizedRecommendations
              onSelectRecommendation={(history: { effects: string[] }) => {
                const effectObjects = history.effects.map((effectName: string) => {
                  const effect = EFFECT_OPTIONS.find(e => e.label === effectName)
                  return effect || {
                    id: `custom_${effectName}`,
                    label: effectName,
                    labelKey: effectName,
                    category: DEFAULTS.PLACEHOLDER_TEXTS.CATEGORY_CUSTOM,
                    categoryKey: 'custom',
                    popular: false,
                  }
                })
                onSetSelectedEffects(effectObjects)
              }}
              maxDisplay={3}
            />
          </Suspense>

          <Suspense fallback={
            <div className="animate-pulse p-6 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              {DEFAULTS.PLACEHOLDER_TEXTS.LOADING_TEXT}
            </div>
          }>
            <ParameterAdjustPanel
              expanded={paramPanelExpanded}
              onToggle={onToggleParamPanel}
              onParameterChange={(params: Record<string, unknown>) => {
                logger.info('参数更新', params)
              }}
            />
          </Suspense>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <div className="w-6 h-6 rounded-lg bg-primary-100 dark:bg-primary-300/25 flex items-center justify-center">
                  <RefreshCw className="w-3.5 h-3.5 text-primary-700 dark:text-primary-700" />
                </div>
                {DEFAULTS.PLACEHOLDER_TEXTS.TITLE_SELECT_EFFECTS}
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[var(--color-primary-surface)] to-[var(--color-accent-surface-deep)] text-white shadow-sm">
                  {selectionCount}/{VALIDATION.maxEffectSelection}
                </span>
              </h3>
            </div>

            <div className="flex flex-wrap gap-2">
              {EFFECT_OPTIONS.map((effect) => {
                const isSelected = isEffectSelected(effect.id)

                return (
                  <button
                    key={effect.id}
                    onClick={() => onToggleEffect(effect)}
                    disabled={!isSelected && !canSelectMore}
                    className={`group/effect relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 overflow-hidden ${
                      isSelected
                        ? 'shadow-lg scale-105'
                        : !isSelected && !canSelectMore
                          ? 'opacity-30 cursor-not-allowed'
                          : 'hover:shadow-md hover:scale-102 active:scale-98'
                    }`}
                    style={{
                      backgroundColor: isSelected
                        ? 'var(--color-primary-500)'
                        : 'var(--bg-secondary)',
                      border: isSelected
                        ? 'none'
                        : '1px solid var(--border-color)',
                      color: isSelected
                        ? 'white'
                        : 'var(--text-secondary)',
                      boxShadow: isSelected
                        ? '0 8px 24px rgba(99, 102, 241, 0.3)'
                        : 'none',
                    }}
                  >
                    {/* 选中状态光晕 */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-50" />
                    )}

                    <span className="relative flex items-center gap-2">
                      {t(`ai.formula.effects.labels.${effect.labelKey}`, { defaultValue: effect.label })}

                      {effect.popular && !isSelected && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-warning-500/15 dark:bg-warning-500/25 text-warning-600 dark:text-warning-700 font-semibold border border-warning-200 dark:border-warning-700">
                          {DEFAULTS.PLACEHOLDER_TEXTS.BADGE_POPULAR}
                        </span>
                      )}

                      {isSelected && (
                        <CheckCircle className="w-3.5 h-3.5 ml-1" />
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            {progress.stage !== 'idle' && (
              <div className="flex-1 w-full">
                <GenerationProgressPanel
                  progress={progress}
                  onCancel={onCancelGeneration}
                  showCancelButton={progress.canCancel}
                />
              </div>
            )}

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* 生成按钮 — 渐变增强 */}
              <Button
                disabled={selectedEffects.length === 0 || isGenerating}
                onClick={() => onGenerate(effectLabels)}
                loading={isGenerating}
                icon={
                  useLlm
                    ? <Wand2 className="w-4 h-4" />
                    : <Sparkles className="w-4 h-4" />
                }
                size="lg"
                className="min-w-[180px] rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-r from-primary-500 via-accent-500 to-accent-500 hover:from-primary-600 hover:via-accent-600 hover:to-accent-600"
              >
                {useLlm
                  ? DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_AI_GENERATE
                  : DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_START_GENERATE
                }
              </Button>

              {/* 快捷提示 */}
              {selectedEffects.length > 0 && (
                <span className="text-xs text-neutral-400 dark:text-neutral-400 hidden sm:inline">
                  ✓ {selectedEffects.length} 个功效已选择
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
