import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { usePersistentState } from '@/hooks/usePersistentState';
import { useUserPreferenceStore } from '@/stores/userPreferenceStore';
import { useGenerationStore } from '@/stores/generationStore';
import { STORAGE_KEYS } from '@/config';
import { Card } from '@/components/ui';
import { logger } from '@/utils/safeLogger';
import type { AICandidate } from '@/api/ai';
import { validateAiFormula, type AiFormulaValidationRequest, type AiFormulaValidationResponse } from '@/api/ai';
import { formulaApi } from '@/api/formula';
import type { FormulaCreatePayload } from '@/types/formula';
import { FormulaValidationModal } from './components/FormulaValidationModal'
import { parseDosageToGramsOrZero } from './utils/dosage';
import type { InputMode, ViewMode } from './GenerateTab/config/generateTabConfig';
import { HERB_ROLES } from './GenerateTab/config/generateTabConfig';
import { AcademicReportEnhanced } from '@/components/ai/AcademicReportEnhanced';
import { FormulaVersionManager, VersionComparePanel } from '@/components/ai/FormulaVersionManager';

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

/** 从剂量字符串解析克数（"1.0-3.0g" / "500mg" / "10g" / "约15克"），单位统一归一化为克。 */
export function parseDosageGrams(raw: string): number {
  return parseDosageToGramsOrZero(raw)
}

/** 将候选配方组装为校验请求 payload（含 formula_name + 成分 name + dosage_g） */
export function buildCandidateValidationPayload(
  candidate: AICandidate,
  targetEffects: string[],
): AiFormulaValidationRequest {
  return {
    formula_name: candidate.formula_name || candidate.name || '未知配方',
    ingredients: (candidate.herb_combination ?? [])
      .map(h => ({ name: h.name ? String(h.name) : '', dosage_g: parseDosageGrams(typeof h.dosage === 'string' ? h.dosage : '') }))
      .filter(item => item.name.length > 0),
    target_effects: targetEffects,
  }
}

/** 将单个 herb_combination 项的剂量归一化为克（数值）。
 * 兼容：dosage_g（克）、dosage_mg（GA 系列实际即克）、数值 dosage、字符串 "10g"/"500mg"。 */
function herbDosageInGrams(h: { dosage?: string | number; dosage_g?: number; dosage_mg?: number }): number {
  if (typeof h.dosage_g === 'number' && Number.isFinite(h.dosage_g)) return h.dosage_g
  if (typeof h.dosage_mg === 'number' && Number.isFinite(h.dosage_mg)) return h.dosage_mg
  if (typeof h.dosage === 'number' && Number.isFinite(h.dosage)) return h.dosage
  return parseDosageGrams(typeof h.dosage === 'string' ? h.dosage : '')
}

/** 将单个 herb_combination 项格式化为展示用剂量字符串。 */
function formatHerbDosage(h: { dosage?: string | number; dosage_g?: number; dosage_mg?: number }): string {
  if (typeof h.dosage === 'string' && h.dosage) return h.dosage
  if (typeof h.dosage_g === 'number' && h.dosage_g > 0) return `${h.dosage_g}g`
  if (typeof h.dosage_mg === 'number' && h.dosage_mg > 0) return `${h.dosage_mg}g`
  if (typeof h.dosage === 'number' && h.dosage > 0) return `${h.dosage}g`
  return ''
}

/** 将 herb_combination 映射为保存 payload 成分列表：
 * - dosage 使用真实剂量字符串（"10g" / "500mg"），缺失时留空；
 * - role 优先使用后端返回的角色；缺失时按剂量降序推导君臣佐使（君>臣>佐>使）。 */
function mapHerbsToSaveIngredients(candidate: AICandidate): { name: string; role: string; dosage: string }[] {
  const herbs = (candidate.herb_combination ?? []).filter(h => h.name)
  if (herbs.length === 0) return []

  // 按剂量降序排序，建立「剂量排名 → 角色」映射
  const sorted = [...herbs].sort((a, b) => herbDosageInGrams(b) - herbDosageInGrams(a))
  const roleByHerbName = new Map<string, string>()
  sorted.forEach((h, rank) => {
    const derivedRole = HERB_ROLES[Math.min(rank, HERB_ROLES.length - 1)] || '佐药'
    roleByHerbName.set(String(h.name), h.role || derivedRole)
  })

  // 保持原始顺序输出
  return herbs.map(h => ({
    name: h.name ? String(h.name) : '',
    role: roleByHerbName.get(String(h.name)) || h.role || '佐药',
    dosage: formatHerbDosage(h),
  }))
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
      // P1：使用 herb_combination 的真实 dosage/role，不再硬编码 '1.0-3.0g'/'佐药'
      ingredients: mapHerbsToSaveIngredients(candidate),
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
    onGenerate: () => {
      // 唯一一处 Ctrl+Enter 生成注册（GenerationInputPro 内的重复注册已移除）。
      // 未选择功效时不发空请求，避免后端 422。
      if (effectsHook.effectLabels.length > 0) {
        generationHook.mutation.mutate(effectsHook.effectLabels);
      }
    },
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
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [paramPanelExpanded, setParamPanelExpanded] = useState(false);
  const [showCacheInfo, setShowCacheInfo] = useState(false);
  // ── 批量保存：成分级校验报告弹窗 + 诚实降级提示 ──
  const [batchValidation, setBatchValidation] = useState<{
    result: AiFormulaValidationResponse
    formulaName: string
    candidate: AICandidate
  } | null>(null)
  const [batchNotice, setBatchNotice] = useState<string | null>(null)

  // Process result once（P3：去重标记提升到全局 store，切 tab 重挂载后不会重复写入版本/历史）
  const lastProcessedResultId = useGenerationStore((s) => s.lastProcessedResultId);
  const setLastProcessedResultId = useGenerationStore((s) => s.setLastProcessedResultId);

  useEffect(() => {
    if (generationHook.generateResult && generationHook.generateResult.length > 0) {
      const resultId = generationHook.generateResult.map((c) => c.id || c.name).join('|');
      if (lastProcessedResultId === resultId) return;

      setLastProcessedResultId(resultId);
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
    lastProcessedResultId,
    setLastProcessedResultId,
  ]);

  // Cache optimization
  const handleGenerateWithCache = useCallback(async (effects: string[]) => {
    // P2：缓存键加入算法关键参数，与 useAlgorithmConfig.toApiParams 实际传参一致，
    // 避免修改算法参数后仍命中旧缓存。
    const cacheKey = generateCacheKey(effects, {
      useLlm,
      population_size: algorithmHook.toApiParams.population_size,
      generations: algorithmHook.toApiParams.generations,
      max_candidates: algorithmHook.toApiParams.max_candidates,
      strategy: algorithmHook.toApiParams.strategy,
      taste_preference: algorithmHook.toApiParams.taste_preference,
    });
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
  }, [generationHook, getCachedResult, setCachedResult, useLlm, algorithmHook.toApiParams]);

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
      // P1-3：手动输入模式采用 FormulaInputWindow 分析得到的候选配方，
      // 直接写入全局结果面板，不再把配方名当功效关键词重新生成。
      if (!candidate) {
        logger.warn('Invalid manual input: 缺少候选配方');
        return;
      }
      try {
        generationHook.setGenerateResult([candidate]);
        generationHook.setGenerator('rule_engine');
      } catch (error) {
        logger.error('Manual input failed', { error });
      }
    },
    [generationHook],
  );

  const handleViewReport = useCallback((candidate: AICandidate) => {
    setSelectedReport(candidate);
  }, []);

  const [selectedCandidate, setSelectedCandidate] = useState<AICandidate | null>(null);
  const handleSelectCandidate = useCallback(
    (candidate: AICandidate) => {
      setSelectedCandidate(candidate);
      // P2：双对比弹窗互斥——打开增强对比时关闭版本对比弹窗
      setCompareVersions(null);
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

  // Chat 模式真实生成完成后，将候选配方同步到结果面板（供保存/对比/报告）
  const handleChatCandidates = useCallback((candidates: AICandidate[]) => {
    if (!candidates || candidates.length === 0) return;
    generationHook.setGenerateResult(candidates);
    generationHook.setGenerator('ga');
  }, [generationHook]);

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
          专业版
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="hidden lg:flex items-center gap-4 px-6 py-2 bg-muted/50 border-b border-border text-caption text-muted-foreground">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">
            Ctrl+Enter
          </kbd>
          生成
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">
            Esc
          </kbd>
          取消
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">
            Ctrl+K
          </kbd>
          聊天
        </span>
        <button
          onClick={() => setShowCacheInfo(!showCacheInfo)}
          className="ml-auto flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          缓存: {cacheStats.size}/{cacheStats.maxSize}
        </button>
      </div>

      {/* Cache info panel */}
      {showCacheInfo && (
        <div className="px-6 py-3 bg-info/5 border-b border-info/10">
          <div className="flex items-center justify-between">
            <div className="text-body-sm text-info-foreground">
              <strong>缓存统计</strong>
              <span className="ml-2 text-info-foreground/70">
                TTL: {Math.round(cacheStats.ttl / 1000 / 60)}分钟 | 
                条目: {cacheStats.size}
              </span>
            </div>
            <button
              onClick={clearCache}
              className="text-caption text-info hover:underline"
            >
              清除缓存
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
        onViewHistory={() => setShowVersionHistory(true)}
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
              onCandidatesGenerated={(candidates) => {
                // P1-7：高级模式结果写入全局 store，与简单模式共用结果面板/版本历史/批量保存。
                generationHook.setGenerateResult(candidates);
                generationHook.setGenerator('ga');
                logger.info('Neural generation complete', { count: candidates.length });
              }}
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
                onChatCandidates={handleChatCandidates}
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
                  // P2：双对比弹窗互斥——打开版本对比时关闭增强对比弹窗
                  // 语义约定：v1 = 较新版本（候选 1），v2 = 较旧版本（候选 2）
                  setCompareVersions({ v1, v2 });
                  setCompareVersionsEnhanced(false);
                }}
                onExportFormula={handleExportFormula}
                effectLabels={effectsHook.effectLabels}
                onSaveAll={handleSaveAllCandidates}
                onSaveSuccess={(formulaId, candidateId) =>
                  savedHook.handleSaveSuccess(formulaId, candidateId, generationHook.generateResult)
                }
                savedFormulas={savedHook.savedFormulas}
              />
            )}
          </>
        )}
      </div>

      {/* Academic Report Modal */}
      {selectedReport && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="button" tabIndex={0}
          onClick={() => setSelectedReport(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault(); setSelectedReport(null)
            }
          }}
        >
          <div
            className="bg-surface rounded-xl max-w-5xl w-full mx-4 overflow-hidden shadow-2xl border border-border"
            role="button" tabIndex={0}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
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
          role="button" tabIndex={0}
          onClick={() => setCompareVersions(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault(); setCompareVersions(null)
            }
          }}
        >
          <div
            className="bg-surface rounded-xl max-w-4xl w-full mx-4 overflow-hidden shadow-2xl border border-border"
            role="button" tabIndex={0}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {/* P3-4：version1 固定为「旧版本」，version2 固定为「新版本」；
             formulaVersions 为最新在前，因此 v1（较新）→ index v1-1 → version2（新），
             v2（较旧）→ index v2-1 → version1（旧），与面板标签语义一致。 */}
            <VersionComparePanel
              version1={versionsHook.formulaVersions[compareVersions.v2 - 1]}
              version2={versionsHook.formulaVersions[compareVersions.v1 - 1]}
              onClose={() => setCompareVersions(null)}
            />
          </div>
        </div>
      )}

      {/* Version History Modal — P3-2：HeaderPro 历史按钮接入版本历史面板 */}
      {showVersionHistory && versionsHook.formulaVersions.length > 0 && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="button" tabIndex={0}
          onClick={() => setShowVersionHistory(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault(); setShowVersionHistory(false)
            }
          }}
        >
          <div
            className="bg-surface rounded-xl max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-border"
            role="button" tabIndex={0}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
              <h3 className="text-title-md font-semibold">配方版本历史</h3>
              <button
                onClick={() => setShowVersionHistory(false)}
                className="text-caption text-muted-foreground hover:text-foreground"
                aria-label="关闭版本历史"
              >
                关闭
              </button>
            </div>
            <div className="p-6">
              <FormulaVersionManager
                versions={versionsHook.formulaVersions}
              />
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Version Compare Modal — 六维评分 + 药材组成对比 */}
      {compareVersionsEnhanced && selectedCandidate && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="button" tabIndex={0}
          onClick={() => setCompareVersionsEnhanced(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault(); setCompareVersionsEnhanced(false)
            }
          }}
        >
          <div
            className="bg-surface rounded-xl max-w-5xl w-full mx-4 overflow-y-auto max-h-[80vh] shadow-2xl border border-border p-6"
            role="button" tabIndex={0}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
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
