import React, { Suspense, lazy, useCallback } from 'react'
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
  category: string
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
  onClearEffects,
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
  onFullReset,
  useLlm,
}) => {
  const isEffectSelected = useCallback((effectId: string) => {
    return selectedEffects.some(e => e.id === effectId)
  }, [selectedEffects])

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {DEFAULTS.PLACEHOLDER_TEXTS.LABEL_INPUT_MODE}
          </span>
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1.5 gap-1.5">
            <button
              onClick={() => onInputModeChange('effects')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                inputMode === 'effects'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <Target className="w-4 h-4 inline mr-1.5" />
              {DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_SELECT_EFFECTS}
            </button>
            <button
              onClick={() => onInputModeChange('manual')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                inputMode === 'manual'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-1.5" />
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
            <div className="animate-pulse p-6 bg-gray-100 dark:bg-gray-800 rounded-xl">
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
                    category: DEFAULTS.PLACEHOLDER_TEXTS.CATEGORY_CUSTOM,
                    popular: false,
                  }
                })
                onSetSelectedEffects(effectObjects)
              }}
              maxDisplay={3}
            />
          </Suspense>

          <Suspense fallback={
            <div className="animate-pulse p-6 bg-gray-100 dark:bg-gray-800 rounded-xl">
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
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <RefreshCw className="w-4 h-4" style={{ color: 'var(--color-primary-500)' }} />
                {DEFAULTS.PLACEHOLDER_TEXTS.TITLE_SELECT_EFFECTS}
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-primary-500/8 dark:bg-primary-500/16 text-primary-600 dark:text-primary-400">
                  {selectionCount}/{VALIDATION.maxEffectSelection}
                </span>
              </h3>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {EFFECT_OPTIONS.map((effect) => {
                const isSelected = isEffectSelected(effect.id)

                return (
                  <button
                    key={effect.id}
                    onClick={() => onToggleEffect(effect)}
                    disabled={!isSelected && !canSelectMore}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden group ${
                      isSelected
                        ? 'shadow-md hover:shadow-lg'
                        : 'hover:shadow-sm'
                    } ${
                      !isSelected && !canSelectMore
                        ? 'opacity-40 cursor-not-allowed'
                        : ''
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
                        ? '0 4px 14px rgba(5, 150, 105, 0.35)'
                        : 'none',
                    }}
                  >
                    {effect.label}

                    {effect.popular && !isSelected && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-amber-500/12 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                        {DEFAULTS.PLACEHOLDER_TEXTS.BADGE_POPULAR}
                      </span>
                    )}

                    {isSelected && (
                      <span className="ml-1.5">
                        <CheckCircle className="w-3.5 h-3.5 inline" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
            {progress.stage !== 'idle' && (
              <div className="flex-1 w-full">
                <GenerationProgressPanel
                  progress={progress}
                  onCancel={onCancelGeneration}
                  showCancelButton={progress.canCancel}
                />
              </div>
            )}

            <div className="flex gap-3">
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
                className="min-w-[160px]"
              >
                {useLlm
                  ? DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_AI_GENERATE
                  : DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_START_GENERATE
                }
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
