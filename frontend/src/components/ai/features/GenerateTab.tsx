import React, { useState, useRef, useEffect, useCallback, Suspense, lazy } from 'react'
import { useTranslation } from 'react-i18next'
import { usePersistentState } from '@/hooks/usePersistentState'
import { useUserPreferenceStore } from '@/stores/userPreferenceStore'
import { useOperationFeedback } from '@/hooks/useOperationFeedback'
import { STORAGE_KEYS } from '@/config'
import { Card } from '@/components/ui'
import { logger } from '@/utils/safeLogger'
import type { AICandidate } from '@/api/ai'
import type { InputMode, ViewMode, FormulaCategory } from './GenerateTab/config/generateTabConfig'

// Hooks
import { useGenerateEffects } from './GenerateTab/hooks/useGenerateEffects'
import { useFormulaGeneration } from './GenerateTab/hooks/useFormulaGeneration'
import { useFormulaVersions } from './GenerateTab/hooks/useFormulaVersions'
import { useSavedFormulas } from './GenerateTab/hooks/useSavedFormulas'
import { useFormulaFilters } from './GenerateTab/hooks/useFormulaFilters'
import { useExportFormula } from './GenerateTab/hooks/useExportFormula'

// Components
import { Header } from './GenerateTab/components/Header'
import { ErrorMessage } from './GenerateTab/components/ErrorMessage'
import { SuccessMessage } from './GenerateTab/components/SuccessMessage'
import { GenerationInput } from './GenerateTab/components/GenerationInput'
import { FormulaResults } from './GenerateTab/components/FormulaResults'
import { ExportPanel } from './GenerateTab/components/ExportPanel'

// Lazy components
const NeuralGeneratePanel = lazy(() => import('@/components/ai/NeuralGeneratePanel'))

interface ModelStatus {
  llm?: { provider: string; model: string; available: boolean }
  neural?: { available: boolean; version: string }
}

interface GenerateTabProps {
  llmAvailable: boolean
  modelStatus: ModelStatus | null
  onGenerateSuccess?: (candidates: AICandidate[]) => void
}

export function GenerateTab({
  llmAvailable,
  modelStatus,
  onGenerateSuccess,
}: GenerateTabProps) {
  // ===== i18n =====
  const { t } = useTranslation()

  const { addGenerationHistory } = useUserPreferenceStore()
  const feedback = useOperationFeedback()

  // Hooks
  const effectsHook = useGenerateEffects()
  const generationHook = useFormulaGeneration({
    effectLabels: effectsHook.effectLabels,
    selectedEffects: effectsHook.selectedEffects,
    onGenerateSuccess,
  })
  const versionsHook = useFormulaVersions()
  const savedHook = useSavedFormulas()
  const filtersHook = useFormulaFilters()
  const exportHook = useExportFormula(generationHook.generateResult)

  // UI State
  const [useLlm, setUseLlm] = usePersistentState<boolean>(STORAGE_KEYS.GENERATE_USE_LLM, false)
  const [advancedMode, setAdvancedMode] = usePersistentState<boolean>(STORAGE_KEYS.GENERATE_ADVANCED_MODE, false)
  const [viewMode, setViewMode] = usePersistentState<ViewMode>(STORAGE_KEYS.GENERATE_VIEW_MODE, 'card')
  const [inputMode, setInputMode] = useState<InputMode>('effects')
  const [selectedReport, setSelectedReport] = useState<AICandidate | null>(null)
  const [selectedCompareIndex, setSelectedCompareIndex] = useState<number | undefined>(undefined)
  const [paramPanelExpanded, setParamPanelExpanded] = useState(false)

  // Process result once
  const processedResultRef = useRef<string | null>(null)

  useEffect(() => {
    if (generationHook.generateResult && generationHook.generateResult.length > 0) {
      const resultId = generationHook.generateResult.map(c => c.id || c.name).join('|')
      if (processedResultRef.current === resultId) return

      processedResultRef.current = resultId
      versionsHook.addVersion(generationHook.generateResult, effectsHook.effectLabels)

      const topCandidate = generationHook.generateResult[0]
      addGenerationHistory({
        effects: effectsHook.effectLabels,
        ingredients: (topCandidate.herb_combination || []).map((h: any) => typeof h.name === 'string' ? h.name : 'Unknown'),
        scores: {
          synergy: topCandidate.synergy_score || 0,
          taste: (topCandidate as any).taste_score || 0,
          stability: (topCandidate as any).stability_score || 0,
          overall: (topCandidate as any).overall_score || (topCandidate.synergy_score || 0),
        },
        generator: generationHook.generator,
        liked: false,
      })
    }
  }, [generationHook.generateResult, effectsHook.effectLabels, generationHook.generator, versionsHook, addGenerationHistory])

  // Handlers
  const handleFullReset = useCallback(() => {
    generationHook.handleReset()
    effectsHook.clearEffects()
    setSelectedReport(null)
    savedHook.resetSavedFormulas()
  }, [generationHook, effectsHook, savedHook])

  const handleManualFormulaInput = useCallback((candidate: AICandidate) => {
    if (!candidate || typeof candidate.formula_name !== 'string' || candidate.formula_name.trim() === '') {
      logger.warn('Invalid manual input')
      return
    }
    try {
      generationHook.mutation.mutate([candidate.formula_name.trim()])
    } catch (error) {
      logger.error('Manual input failed', { error })
    }
  }, [generationHook.mutation])

  const handleViewReport = useCallback((candidate: AICandidate) => {
    setSelectedReport(candidate)
  }, [])

  const handleSelectCandidate = useCallback((candidate: AICandidate) => {
    const index = generationHook.generateResult?.findIndex(c => c === candidate)
    if (index !== undefined && index >= 0) {
      setSelectedCompareIndex(index)
    }
  }, [generationHook.generateResult])

  const handleExportFormula = useCallback((format: 'json' | 'csv' | 'pdf', options: { includePatentScores?: boolean; includeDetailedInfo?: boolean } = {}) => {
    exportHook.exportData({
      format,
      includePatentScores: options.includePatentScores || false,
      includeDetailedInfo: options.includeDetailedInfo || false,
    })
  }, [exportHook])

  const filteredResults = filtersHook.filteredAndSortedResults(generationHook.generateResult)

  return (
    <Card className="p-0 overflow-hidden">
      {/* Notifications */}
      {generationHook.errorMessage && (
        <ErrorMessage
          message={generationHook.errorMessage}
          onClose={() => generationHook.setErrorMessage(null)}
        />
      )}
      {savedHook.saveSuccess && (
        <SuccessMessage
          formulaId={savedHook.saveSuccess.formulaId}
          formulaName={savedHook.saveSuccess.formulaName}
          onClose={() => savedHook.setSaveSuccess(null)}
        />
      )}

      {/* Header */}
      <Header
        advancedMode={advancedMode}
        onToggleAdvancedMode={() => setAdvancedMode(!advancedMode)}
        useLlm={useLlm}
        onToggleUseLlm={setUseLlm}
        llmAvailable={llmAvailable}
        modelStatus={modelStatus}
        generateResult={generationHook.generateResult}
        onFullReset={handleFullReset}
      />

      {/* Main Content */}
      <div className="p-6">
        {advancedMode ? (
          <Suspense fallback={<div className="animate-pulse p-8 bg-gray-100 dark:bg-gray-800 rounded-xl">{t('ai.formula.generateTab.loading')}</div>}>
            <NeuralGeneratePanel onCandidatesGenerated={(candidates) => logger.info('Neural generation complete', { count: candidates.length })} />
          </Suspense>
        ) : (
          <>
            {!generationHook.generateResult && (
              <GenerationInput
                inputMode={inputMode}
                onInputModeChange={setInputMode}
                selectedEffects={effectsHook.selectedEffects}
                onToggleEffect={effectsHook.toggleEffect}
                onClearEffects={effectsHook.clearEffects}
                effectLabels={effectsHook.effectLabels}
                canSelectMore={effectsHook.canSelectMore}
                selectionCount={effectsHook.selectionCount}
                onGenerate={generationHook.mutation.mutate}
                isGenerating={generationHook.isGenerating}
                progress={generationHook.progress}
                onCancelGeneration={generationHook.handleCancelGeneration}
                onManualFormulaInput={handleManualFormulaInput}
                onSetSelectedEffects={effectsHook.setSelectedEffects}
                paramPanelExpanded={paramPanelExpanded}
                onToggleParamPanel={() => setParamPanelExpanded(!paramPanelExpanded)}
                onFullReset={handleFullReset}
                useLlm={useLlm}
              />
            )}

            {generationHook.generateResult && (
              <FormulaResults
                generateResult={generationHook.generateResult}
                generator={generationHook.generator}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                selectedCategory={filtersHook.selectedCategory}
                onCategoryChange={filtersHook.setSelectedCategory}
                sortBy={filtersHook.sortBy}
                sortOrder={filtersHook.sortOrder}
                onToggleSort={filtersHook.toggleSort}
                filteredResults={filteredResults}
                formulaCategories={filtersHook.formulaCategories}
                onViewReport={handleViewReport}
                onSelectCandidate={handleSelectCandidate}
                selectedCompareIndex={selectedCompareIndex}
                onExportFormula={handleExportFormula}
                effectLabels={effectsHook.effectLabels}
              />
            )}
          </>
        )}
      </div>

      {/* Academic Report Modal (simplified) */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedReport(null)}>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl max-w-3xl w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">{selectedReport.formula_name || t('ai.formula.generateTab.formulaDetails')}</h3>
            <div className="flex justify-end">
              <button onClick={() => setSelectedReport(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg">{t('ai.formula.generateTab.close')}</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
