import React, { useState, useRef, useEffect, useCallback, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { usePersistentState } from '@/hooks/usePersistentState';
import { useUserPreferenceStore } from '@/stores/userPreferenceStore';
import { STORAGE_KEYS } from '@/config';
import { Card } from '@/components/ui';
import { logger } from '@/utils/safeLogger';
import type { AICandidate } from '@/api/ai';
import { validateAiFormula, type AiFormulaValidationRequest, type AiFormulaValidationResponse } from '@/api/ai';
import { formulaApi } from '@/api/formula';
import type { FormulaCreatePayload } from '@/types/formula';
import { FormulaValidationModal } from './components/FormulaValidationModal';
import type { InputMode, ViewMode } from './GenerateTab/config/generateTabConfig';
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

// Professional Components
import { HeaderPro } from './GenerateTab/components/HeaderPro';
import { GenerationInputPro } from './GenerateTab/components/GenerationInputPro';
import { FormulaResultsPro } from './GenerateTab/components/FormulaResultsPro';

// Legacy Components
import { ErrorMessage } from './GenerateTab/components/ErrorMessage';
import { SuccessMessage } from './GenerateTab/components/SuccessMessage';
import { FormulaComparePanel } from './GenerateTab/components/FormulaComparePanel';

// Lazy components
const AdvancedGeneratePanel = lazy(() => import('@/components/ai/AdvancedGeneratePanel'));

// ===== 批量保存辅助函数（可独立测试）=====

/** 从剂量字符串解析克数（"1.0-3.0g" / "10g" / "约15克"）。区间取上限。 */
export function parseDosageGrams(raw: string): number {
  if (!raw) return 0
  const range = /(\d+(?:\.\d+)?)\s*[-–~至]\s*(\d+(?:\.\d+)?)/.exec(raw)
  const val = range ? Number(range[2]) : Number((/^[\s约]*([\d.]+)/.exec(raw) || [0, '0'])[1])
  return Number.isFinite(val) ? val : 0
}

/** 将候选配方组装为校验请求 payload（含 formula_name + 成分 name + dosage_g） */
export function buildCandidateValidationPayload(
  candidate: AICandidate,
  targetEffects: string[],
): AiFormulaValidationRequest {
  return {
    formula_name: candidate.formula_name || candidate.name || '未知配方',
    ingredients: (candidate.herb_combination ?? [])
      .map(h => ({ name: h.name ? String(h.name) : '', dosage_g: parseDosageGrams(h.dosage ?? '') }))
      .filter(item => item.name.length > 0),
    target_effects: targetEffects,
  }
}

/** 将候选配方组装为保存到配方库的 payload */
export function buildCandidateSavePayload(
  candidate: AICandidate,
  targetEffects: string[],
  notes?: string,
): FormulaCreatePayload {
  return {
    name: candidate.formula_name || candidate.name || '未知配方',
    description: candidate.description || '',
    target_effects: targetEffects,
    composition: {
      ingredients: (candidate.herb_combination ?? []).map(h => ({
        name: h.name ? String(h.name) : '',
        role: h.role || '佐药',
        dosage: '1.0-3.0g',
      })),
      peptides: candidate.peptide_candidates,
    },
    safety_check: candidate.safety_details,
    synergy_analysis: { score: candidate.synergy_score },
    notes,
  }
}

export interface SaveAllCandidatesParams {
  candidates: AICandidate[]
  targetEffects: string[]
  validate: (payload: AiFormulaValidationRequest) => Promise<AiFormulaValidationResponse>
  create: (payload: FormulaCreatePayload) => Promise<{ id: number }>
  getCandidateId: (candidate: AICandidate, index: number) => string
  onCandidateSaved: (formulaId: number, candidateId: string) => void
  onBlocked: (result: AiFormulaValidationResponse, candidate: AICandidate) => void
}

export interface SaveAllCandidatesResult {
  savedCount: number
  blocked: boolean
  degraded: boolean
}

/**
 * 批量保存候选配方（保存前逐候选调用 AI 校验）：
 * - 任一候选 blocked_by_critical → 停止批量保存并回调 onBlocked（弹窗展示成分级报告）
 * - warnings 未阻断 → 保存并把校验建议追加到 notes（【AI校验】前缀）
 * - 校验接口异常 → 诚实降级：跳过该校验继续保存，返回 degraded=true
 */
export async function saveAllCandidatesWithValidation(
  params: SaveAllCandidatesParams,
): Promise<SaveAllCandidatesResult> {
  const { candidates, targetEffects, validate, create, getCandidateId, onCandidateSaved, onBlocked } = params
  let savedCount = 0
  let blocked = false
  let degraded = false

  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index]
    const validationPayload = buildCandidateValidationPayload(candidate, targetEffects)
    let validation: AiFormulaValidationResponse | null = null
    try {
      validation = await validate(validationPayload)
    } catch (e) {
      // 接口异常 → 诚实降级：跳过校验继续保存
      degraded = true
      logger.warn('[GenerateTab] AI 配方校验服务调用失败，已跳过校验继续保存:', e)
    }

    if (validation) {
      if (validation.blocked_by_critical) {
        // CRITICAL：停止批量保存并弹出该候选的成分级校验报告
        blocked = true
        onBlocked(validation, candidate)
        return { savedCount, blocked, degraded }
      }

      // warnings 未阻断 → 保存并把校验建议追加到 notes（【AI校验】前缀）
      const warnings = validation.warnings?.length
        ? validation.warnings
        : (validation.alerts ?? [])
            .filter(a => a.level === 'warning' || !a.blocking)
            .map(a => a.message)
      const suggestions = validation.suggestions?.length
        ? validation.suggestions
        : (validation.recommendations ?? [])
      const notes = warnings.length > 0 || suggestions.length > 0
        ? `【AI校验】${[
            ...warnings.filter(Boolean),
            ...suggestions.map(s => `建议：${s}`),
          ].join('；')}`
        : undefined

      const payload = buildCandidateSavePayload(candidate, targetEffects, notes)
      const result = await create(payload)
      savedCount++
      onCandidateSaved(result.id, getCandidateId(candidate, index))
    } else {
      // 校验被跳过（接口异常）→ 直接保存
      const payload = buildCandidateSavePayload(candidate, targetEffects, undefined)
      const result = await create(payload)
      savedCount++
      onCandidateSaved(result.id, getCandidateId(candidate, index))
    }
  }

  return { savedCount, blocked, degraded }
}

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

  // Hooks
  const effectsHook = useGenerateEffects();
  const algorithmHook = useAlgorithmConfig();

  // UI State
  const [useLlm, setUseLlm] = usePersistentState<boolean>(STORAGE_KEYS.GENERATE_USE_LLM, false);
  const [advancedMode, setAdvancedMode] = usePersistentState<boolean>(STORAGE_KEYS.GENERATE_ADVANCED_MODE, false);

  const generationHook = useFormulaGeneration({
    effectLabels: effectsHook.effectLabels,
    selectedEffects: effectsHook.selectedEffects,
    onGenerateSuccess,
    algorithmConfig: algorithmHook.toApiParams,
    useLlm,
  });
  const versionsHook = useFormulaVersions();
  const savedHook = useSavedFormulas();
  const filtersHook = useFormulaFilters();
  const exportHook = useExportFormula(generationHook.generateResult);
  
  // New hooks
  useGenerationShortcuts({
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

  // UI State (useLlm / advancedMode 已在上方声明，此处保留其余状态)
  const [viewMode, setViewMode] = usePersistentState<ViewMode>(STORAGE_KEYS.GENERATE_VIEW_MODE, 'card');
  const [inputMode, setInputMode] = useState<InputMode | 'chat'>('effects');
  const [selectedReport, setSelectedReport] = useState<AICandidate | null>(null);
  const [selectedCompareIndex, setSelectedCompareIndex] = useState<number | undefined>(undefined);
  const [compareVersions, setCompareVersions] = useState<{ v1: number; v2: number } | null>(null);
  const [compareVersionsEnhanced, setCompareVersionsEnhanced] = useState(false);
  const [paramPanelExpanded, setParamPanelExpanded] = useState(false);
  const [showCacheInfo, setShowCacheInfo] = useState(false);
  // ── 批量保存：成分级校验报告弹窗 + 诚实降级提示 ──
  const [batchValidation, setBatchValidation] = useState<{
    result: AiFormulaValidationResponse
    formulaName: string
    candidate: AICandidate
  } | null>(null)
  const [batchNotice, setBatchNotice] = useState<string | null>(null)

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
      generationHook.setGenerator(
        (['rule_engine', 'llm', 'neural_network'] as const).includes(
          cached.generator as 'rule_engine' | 'llm' | 'neural_network',
        )
          ? (cached.generator as Parameters<typeof generationHook.setGenerator>[0])
          : 'rule_engine',
      );
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

  const [selectedCandidate, setSelectedCandidate] = useState<AICandidate | null>(null);
  const handleSelectCandidate = useCallback(
    (candidate: AICandidate) => {
      setSelectedCandidate(candidate);
      setCompareVersionsEnhanced(true);
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

  // ── 保存全部：逐候选过 AI 校验，CRITICAL 弹窗停止、warnings 追加【AI校验】备注、接口异常诚实降级 ──
  const handleSaveAllCandidates = useCallback(async () => {
    const candidates = generationHook.generateResult
    if (!candidates || candidates.length === 0) return
    setBatchNotice(null)
    try {
      const outcome = await saveAllCandidatesWithValidation({
        candidates,
        targetEffects: effectsHook.effectLabels,
        validate: validateAiFormula,
        create: (payload) => formulaApi.create(payload),
        getCandidateId: savedHook.getCandidateId,
        onCandidateSaved: (formulaId, candidateId) =>
          savedHook.handleSaveSuccess(formulaId, candidateId, candidates),
        onBlocked: (result, candidate) => {
          const formulaName =
            typeof candidate.formula_name === 'string' && candidate.formula_name.trim()
              ? candidate.formula_name
              : (typeof candidate.name === 'string' ? candidate.name : '候选配方')
          setBatchValidation({ result, formulaName, candidate })
        },
      })
      if (outcome.degraded) {
        setBatchNotice('部分候选的配方校验服务暂不可用，已跳过校验继续保存（诚实降级）')
      } else if (!outcome.blocked && outcome.savedCount > 0) {
        setBatchNotice(`已保存 ${outcome.savedCount} 个候选配方`)
      }
    } catch (e) {
      logger.error('[GenerateTab] 批量保存失败:', e)
      setBatchNotice('批量保存失败：' + (e instanceof Error ? e.message : '服务端未接受请求'))
    }
  }, [generationHook.generateResult, effectsHook.effectLabels, savedHook])

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
            <AdvancedGeneratePanel
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
                generatorType={generationHook.generator}
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
                onCompareVersions={(v1, v2) => {
                  setCompareVersions({ v1, v2 });
                  setCompareVersionsEnhanced(true);
                }}
                onExportFormula={handleExportFormula}
                effectLabels={effectsHook.effectLabels}
                onSaveAll={handleSaveAllCandidates}
                onSaveSuccess={(formulaId, candidateId) =>
                  savedHook.handleSaveSuccess(formulaId, candidateId, generationHook.generateResult)
                }
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

      {/* Enhanced Version Compare Modal — 六维评分 + 药材组成对比 */}
      {compareVersionsEnhanced && selectedCandidate && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="button" tabIndex={0}
          onClick={() => setCompareVersionsEnhanced(false)}
        >
          <div
            className="bg-surface rounded-xl max-w-3xl w-full mx-4 overflow-y-auto max-h-[80vh] shadow-2xl border border-border p-6"
            role="button" tabIndex={0}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-title-md font-semibold">配方对比分析</h3>
              <button onClick={() => setCompareVersionsEnhanced(false)} className="text-caption text-muted-foreground hover:text-foreground">
                关闭
              </button>
            </div>
            <FormulaComparePanel
              version1={selectedCandidate}
              version2={generationHook.generateResult?.[0] || selectedCandidate}
              label1={selectedCandidate.formula_name || selectedCandidate.name || '候选配方'}
              label2={generationHook.generateResult?.[0]?.formula_name || generationHook.generateResult?.[0]?.name || '最优配方'}
            />
          </div>
        </div>
      )}

      {/* 批量保存提示条（降级/结果/失败） */}
      {batchNotice && (
        <div
          role="status"
          className="mx-6 mb-4 px-3 py-2 rounded-lg text-xs font-medium bg-info/10 text-info-foreground border border-info/20 flex items-center justify-between"
        >
          <span>{batchNotice}</span>
          <button onClick={() => setBatchNotice(null)} className="ml-3 text-info-foreground/70 hover:text-info-foreground" aria-label="关闭提示">✕</button>
        </div>
      )}

      {/* 批量保存：成分级校验报告弹窗（CRITICAL 候选被阻断时展示） */}
      <FormulaValidationModal
        open={!!batchValidation}
        result={batchValidation?.result ?? null}
        formulaName={batchValidation?.formulaName}
        onConfirm={() => setBatchValidation(null)}
        onCancel={() => setBatchValidation(null)}
      />
    </Card>
  );
}
