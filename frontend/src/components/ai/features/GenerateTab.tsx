import React, { useState, useRef, useEffect, useCallback, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { usePersistentState } from '@/hooks/usePersistentState';
import { useUserPreferenceStore } from '@/stores/userPreferenceStore';
import { useOperationFeedback } from '@/hooks/useOperationFeedback';
import { STORAGE_KEYS } from '@/config';
import { Card } from '@/components/ui';
import { logger } from '@/utils/safeLogger';
import type { AICandidate } from '@/api/ai';
import type { InputMode, ViewMode, FormulaCategory } from './GenerateTab/config/generateTabConfig';
import { AcademicReportEnhanced } from '@/components/ai/AcademicReportEnhanced';
import { VersionComparePanel } from '@/components/ai/FormulaVersionManager';

// Hooks
import { useGenerateEffects } from './GenerateTab/hooks/useGenerateEffects';
import { useFormulaGeneration } from './GenerateTab/hooks/useFormulaGeneration';
import { useFormulaVersions } from './GenerateTab/hooks/useFormulaVersions';
import { useSavedFormulas } from './GenerateTab/hooks/useSavedFormulas';
import { useFormulaFilters } from './GenerateTab/hooks/useFormulaFilters';
import { useExportFormula } from './GenerateTab/hooks/useExportFormula';
import { useGenerationShortcuts } from './GenerateTab/hooks/useGenerationShortcuts';
import { useGenerationCache, generateCacheKey } from './GenerateTab/hooks/useGenerationCache';
import { useAlgorithmConfig } from './GenerateTab/hooks/useAlgorithmConfig';
import type { AlgorithmConfig, ConstraintConfig } from './GenerateTab/hooks/useAlgorithmConfig';

// Professional Components
import { HeaderPro } from './GenerateTab/components/HeaderPro';
import { GenerationInputPro } from './GenerateTab/components/GenerationInputPro';
import { FormulaResultsPro } from './GenerateTab/components/FormulaResultsPro';

// Legacy Components
import { Header } from './GenerateTab/components/Header';
import { ErrorMessage } from './GenerateTab/components/ErrorMessage';
import { SuccessMessage } from './GenerateTab/components/SuccessMessage';
import { GenerationInputEnhanced } from './GenerateTab/components/GenerationInputEnhanced';
import { FormulaResultsEnhanced } from './GenerateTab/components/FormulaResultsEnhanced';

// Lazy components
const NeuralGeneratePanel = lazy(() => import('@/components/ai/NeuralGeneratePanel'));

interface ModelStatus {
  llm?: { provider: string; model: string; available: boolean };
  neural?: { available: boolean; version: string };
}

interface GenerateTabProps {
  llmAvailable: boolean;
  modelStatus: ModelStatus | null;
  onGenerateSuccess?: (candidates: AICandidate[]) => void;
}

export function GenerateTab({ llmAvailable, modelStatus, onGenerateSuccess }: GenerateTabProps) {
  const { t } = useTranslation();
  const { addGenerationHistory } = useUserPreferenceStore();
  const feedback = useOperationFeedback();

  // Hooks
  const effectsHook = useGenerateEffects();
  const algorithmHook = useAlgorithmConfig();
  const generationHook = useFormulaGeneration({
    effectLabels: effectsHook.effectLabels,
    selectedEffects: effectsHook.selectedEffects,
    onGenerateSuccess,
    algorithmConfig: algorithmHook.toApiParams,
  });
  const versionsHook = useFormulaVersions();
  const savedHook = useSavedFormulas();
  const filtersHook = useFormulaFilters();
  const exportHook = useExportFormula(generationHook.generateResult);
  
  // New hooks
  const shortcuts = useGenerationShortcuts({
    onGenerate: () => generationHook.mutation.mutate(effectsHook.effectLabels),
    onCancel: generationHook.handleCancelGeneration,
    onReset: () => {
      generationHook.handleReset();
      effectsHook.clearEffects();
    },
    onSwitchToChat: () => setInputMode('chat'),
    onToggleAdvanced: () => setAdvancedMode(!advancedMode),
  });
  const { getCachedResult, setCachedResult, clearCache, stats: cacheStats } = useGenerationCache();

  // UI State
  const [useLlm, setUseLlm] = usePersistentState<boolean>(STORAGE_KEYS.GENERATE_USE_LLM, false);
  const [advancedMode, setAdvancedMode] = usePersistentState<boolean>(STORAGE_KEYS.GENERATE_ADVANCED_MODE, false);
  const [viewMode, setViewMode] = usePersistentState<ViewMode>(STORAGE_KEYS.GENERATE_VIEW_MODE, 'card');
  const [inputMode, setInputMode] = useState<InputMode | 'chat'>('effects');
  const [selectedReport, setSelectedReport] = useState<AICandidate | null>(null);
  const [selectedCompareIndex, setSelectedCompareIndex] = useState<number | undefined>(undefined);
  const [compareVersions, setCompareVersions] = useState<{ v1: number; v2: number } | null>(null);
  const [paramPanelExpanded, setParamPanelExpanded] = useState(false);
  const [showCacheInfo, setShowCacheInfo] = useState(false);

  // Process result once
  const processedResultRef = useRef<string | null>(null);

  useEffect(() => {
    if (generationHook.generateResult && generationHook.generateResult.length > 0) {
      const resultId = generationHook.generateResult.map((c) => c.id || c.name).join('|');
      if (processedResultRef.current === resultId) return;

      processedResultRef.current = resultId;
      versionsHook.addVersion(generationHook.generateResult, effectsHook.effectLabels);

      const topCandidate = generationHook.generateResult[0];
      addGenerationHistory({
        effects: effectsHook.effectLabels,
        ingredients: (topCandidate.herb_combination || []).map((h: any) =>
          typeof h.name === 'string' ? h.name : 'Unknown',
        ),
        scores: {
          synergy: topCandidate.synergy_score || 0,
          taste: (topCandidate as AICandidate).taste_score || 0,
          stability: (topCandidate as AICandidate).stability_score || 0,
          overall: (topCandidate as AICandidate).overall_score || topCandidate.synergy_score || 0,
        },
        generator: generationHook.generator,
        liked: false,
      });
    }
  }, [
    generationHook.generateResult,
    effectsHook.effectLabels,
    generationHook.generator,
    versionsHook,
    addGenerationHistory,
  ]);

  // Cache optimization
  const handleGenerateWithCache = useCallback(async (effects: string[]) => {
    const cacheKey = generateCacheKey(effects, { useLlm });
    const cached = getCachedResult(cacheKey);

    if (cached) {
      logger.info('Using cached result', { key: cacheKey });
      generationHook.setGenerateResult(cached.candidates);
      generationHook.setGenerator(cached.generator as Parameters<typeof generationHook.setGenerator>[0]);
      return;
    }
    
    generationHook.mutation.mutate(effects, {
      onSuccess: (data) => {
        if (data?.candidates) {
          setCachedResult(cacheKey, {
            candidates: data.candidates,
            generator: data.generator,
          });
        }
      },
    });
  }, [generationHook, getCachedResult, setCachedResult, useLlm]);

  // Handlers
  const handleFullReset = useCallback(() => {
    generationHook.handleReset();
    effectsHook.clearEffects();
    setSelectedReport(null);
    setCompareVersions(null);
    savedHook.resetSavedFormulas();
  }, [generationHook, effectsHook, savedHook]);

  const handleManualFormulaInput = useCallback(
    (candidate: AICandidate) => {
      if (!candidate || typeof candidate.formula_name !== 'string' || candidate.formula_name.trim() === '') {
        logger.warn('Invalid manual input');
        return;
      }
      try {
        generationHook.mutation.mutate([candidate.formula_name.trim()]);
      } catch (error) {
        logger.error('Manual input failed', { error });
      }
    },
    [generationHook.mutation],
  );

  const handleViewReport = useCallback((candidate: AICandidate) => {
    setSelectedReport(candidate);
  }, []);

  const handleSelectCandidate = useCallback(
    (candidate: AICandidate) => {
      const index = generationHook.generateResult?.findIndex((c) => c === candidate);
      if (index !== undefined && index >= 0) {
        setSelectedCompareIndex(index);
      }
    },
    [generationHook.generateResult],
  );

  const handleExportFormula = useCallback(
    (
      format: 'json' | 'csv' | 'pdf',
      options: { includePatentScores?: boolean; includeDetailedInfo?: boolean } = {},
    ) => {
      exportHook.exportData({
        format,
        includePatentScores: options.includePatentScores || false,
        includeDetailedInfo: options.includeDetailedInfo || false,
      });
    },
    [exportHook],
  );

  const handleSwitchToChat = useCallback(() => {
    setInputMode('chat');
  }, []);

  const filteredResults = filtersHook.filteredAndSortedResults(generationHook.generateResult);

  // Unified Professional theme (single theme)
  const HeaderComponent = HeaderPro;
  const InputComponent = GenerationInputPro;
  const ResultsComponent = FormulaResultsPro;

  return (
    <Card className="overflow-hidden relative">
      {/* Theme indicator - Professional (unified) */}
      <div className="absolute top-4 right-4 z-10">
        <div className="px-3 py-1.5 rounded-full text-caption font-medium bg-primary/10 text-primary border border-primary/20">
          Professional
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="hidden lg:flex items-center gap-4 px-6 py-2 bg-muted/50 border-b border-border text-caption text-muted-foreground">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">
            Ctrl+Enter
          </kbd>
          Generate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">
            Esc
          </kbd>
          Cancel
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">
            Ctrl+K
          </kbd>
          Chat
        </span>
        <button
          onClick={() => setShowCacheInfo(!showCacheInfo)}
          className="ml-auto flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          Cache: {cacheStats.size}/{cacheStats.maxSize}
        </button>
      </div>

      {/* Cache info panel */}
      {showCacheInfo && (
        <div className="px-6 py-3 bg-info/5 border-b border-info/10">
          <div className="flex items-center justify-between">
            <div className="text-body-sm text-info-foreground">
              <strong>Cache Stats</strong>
              <span className="ml-2 text-info-foreground/70">
                TTL: {Math.round(cacheStats.ttl / 1000 / 60)}min | 
                Items: {cacheStats.size}
              </span>
            </div>
            <button
              onClick={clearCache}
              className="text-caption text-info hover:underline"
            >
              Clear Cache
            </button>
          </div>
        </div>
      )}

      {/* Notifications */}
      {generationHook.errorMessage && (
        <ErrorMessage message={generationHook.errorMessage} onClose={() => generationHook.setErrorMessage(null)} />
      )}
      {savedHook.saveSuccess && (
        <SuccessMessage
          formulaId={savedHook.saveSuccess.formulaId}
          formulaName={savedHook.saveSuccess.formulaName}
          onClose={() => savedHook.setSaveSuccess(null)}
        />
      )}

      {/* Header */}
      <HeaderComponent
        advancedMode={advancedMode}
        onToggleAdvancedMode={() => setAdvancedMode(!advancedMode)}
        useLlm={useLlm}
        onToggleUseLlm={setUseLlm}
        llmAvailable={llmAvailable}
        modelStatus={modelStatus}
        generateResult={generationHook.generateResult}
        onFullReset={handleFullReset}
        onSwitchToChat={handleSwitchToChat}
        historyCount={versionsHook.formulaVersions.length}
        generator={generationHook.generator}
      />

      {/* Main Content */}
      <div className="px-6 py-5">
        {advancedMode ? (
          <Suspense
            fallback={
              <div className="animate-pulse p-8 bg-muted rounded-xl">
                {t('ai.formula.generateTab.loading')}
              </div>
            }
          >
            <NeuralGeneratePanel
              onCandidatesGenerated={(candidates) =>
                logger.info('Neural generation complete', { count: candidates.length })
              }
            />
          </Suspense>
        ) : (
          <>
            {!generationHook.generateResult && (
              <InputComponent
                inputMode={inputMode as InputMode | 'chat'}
                onInputModeChange={(mode) => setInputMode(mode as InputMode)}
                selectedEffects={effectsHook.selectedEffects}
                onToggleEffect={effectsHook.toggleEffect}
                onClearEffects={effectsHook.clearEffects}
                effectLabels={effectsHook.effectLabels}
                canSelectMore={effectsHook.canSelectMore}
                selectionCount={effectsHook.selectionCount}
                onGenerate={handleGenerateWithCache}
                isGenerating={generationHook.isGenerating}
                progress={generationHook.progress}
                onCancelGeneration={generationHook.handleCancelGeneration}
                onManualFormulaInput={handleManualFormulaInput}
                onSetSelectedEffects={effectsHook.setSelectedEffects}
                paramPanelExpanded={paramPanelExpanded}
                onToggleParamPanel={() => setParamPanelExpanded(!paramPanelExpanded)}
                onFullReset={handleFullReset}
                useLlm={useLlm}
                llmAvailable={llmAvailable}
                algorithmConfig={algorithmHook.config}
                onAlgorithmConfigChange={algorithmHook.updateConfig}
                constraints={algorithmHook.constraints}
                onConstraintsChange={algorithmHook.updateConstraints}
              />
            )}

            {generationHook.generateResult && (
              <ResultsComponent
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
                onCompareVersions={(v1, v2) => setCompareVersions({ v1, v2 })}
                onExportFormula={handleExportFormula}
                effectLabels={effectsHook.effectLabels}
              />
            )}
          </>
        )}
      </div>

      {/* Academic Report Modal */}
      {selectedReport && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
           role="button" tabIndex={0} onClick={() => setSelectedReport(null)}
        >
          <div
            className="bg-surface rounded-xl max-w-3xl w-full mx-4 overflow-hidden shadow-2xl border border-border"
             role="button" tabIndex={0} onClick={(e) => e.stopPropagation()}
          >
            <AcademicReportEnhanced
              candidate={selectedReport}
              effects={effectsHook.effectLabels}
              onClose={() => setSelectedReport(null)}
            />
          </div>
        </div>
      )}

      {/* Version Compare Modal */}
      {compareVersions && versionsHook.formulaVersions.length >= 2 && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
           role="button" tabIndex={0} onClick={() => setCompareVersions(null)}
        >
          <div
            className="bg-surface rounded-xl max-w-4xl w-full mx-4 overflow-hidden shadow-2xl border border-border"
             role="button" tabIndex={0} onClick={(e) => e.stopPropagation()}
          >
            <VersionComparePanel
              version1={versionsHook.formulaVersions[compareVersions.v2 - 1]}
              version2={versionsHook.formulaVersions[compareVersions.v1 - 1]}
              onClose={() => setCompareVersions(null)}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
