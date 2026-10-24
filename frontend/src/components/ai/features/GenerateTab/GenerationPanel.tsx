import React from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { GenerationProgressPanel } from '@/components/ai/GenerationProgressPanel'
import { DEFAULTS, VALIDATION } from '@/config'
import { EFFECT_OPTIONS } from '@/config/ai/effects'
import { usePersistentState } from '@/hooks/usePersistentState'
import type { AICandidate } from '@/api/ai'
import type { GenerationProgress } from '@/hooks/useGenerationProgress'

interface EffectOption {
  id: string
  label: string
  labelKey: string
  category: string
  categoryKey: string
  popular: boolean
}

interface GenerationPanelProps {
  selectedEffects: EffectOption[]
  setSelectedEffects: (effects: EffectOption[]) => void
  toggleEffect: (effect: EffectOption) => void
  clearEffects: () => void
  effectLabels: string[]
  canSelectMore: boolean
  selectionCount: number
  generateResult: AICandidate[] | null
  generator: 'rule_engine' | 'ga' | 'llm' | 'neural_network'
  errorMessage: string | null
  setErrorMessage: (msg: string | null) => void
  mutation: any
  progress: GenerationProgress
  handleCancelGeneration: () => void
  handleReset: () => void
  isGenerating: boolean
  llmAvailable: boolean
}

export function GenerationPanel({
  selectedEffects,
  toggleEffect,
  effectLabels,
  canSelectMore,
  selectionCount,
  generateResult,
  mutation,
  progress,
  handleCancelGeneration,
  isGenerating,
  llmAvailable,
}: GenerationPanelProps) {
  const { t } = useTranslation()
  const [useLlm] = usePersistentState<boolean>(
    'generate_use_llm',
    false,
  )

  const MAX_EFFECT_SELECTION = VALIDATION.maxEffectSelection

  return (
    <>
      {!generateResult && (
        <div className="space-y-6">
          {/* 功效选择网格 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
                {DEFAULTS.PLACEHOLDER_TEXTS.TITLE_SELECT_EFFECTS}
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-primary-500/8 dark:bg-primary-500/16 text-primary-700 dark:text-primary-700">
                  {selectionCount}/{MAX_EFFECT_SELECTION}
                </span>
              </h3>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {EFFECT_OPTIONS.map((effect: any) => {
                const isSelected = selectedEffects.some(e => e.id === effect.id)

                return (
                  <button
                    key={effect.id}
                    onClick={() => toggleEffect(effect)}
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
                    {t(`ai.formula.effects.labels.${effect.labelKey}`, { defaultValue: effect.label })}
                    {effect.popular && !isSelected && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-warning-500/12 dark:bg-warning-500/20 text-warning-600 dark:text-warning-700">
                        {t('ai.formula.generateTab.popular')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 操作按钮区 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
            {/* 进度显示 */}
            {progress.stage !== 'idle' && (
              <div className="flex-1 w-full">
                <GenerationProgressPanel
                  progress={progress}
                  onCancel={handleCancelGeneration}
                  showCancelButton={progress.canCancel}
                />
              </div>
            )}

            {/* 生成按钮 */}
            <div className="flex gap-3">
              {!generateResult && (
                <Button
                  disabled={selectedEffects.length === 0 || isGenerating}
                  onClick={() => mutation.mutate(effectLabels)}
                  loading={isGenerating}
                  icon={
                    useLlm && llmAvailable
                      ? <Wand2 className="w-4 h-4" />
                      : <Sparkles className="w-4 h-4" />
                  }
                  size="lg"
                  className="min-w-[160px]"
                >
                  {useLlm && llmAvailable
                    ? DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_AI_GENERATE
                    : DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_START_GENERATE
                  }
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default GenerationPanel
