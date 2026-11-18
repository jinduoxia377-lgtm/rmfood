/**
 * FormulaResultsPro - Professional Formula Results Component
 * 
 * @description Clean layout following RMFOOD design system
 * @version 5.0.0 - Unified Layout
 */
import React, { useMemo, Suspense, lazy } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Filter, Lightbulb, Share2, TrendingUp, CheckCircle,
  ChevronDown, Download, RefreshCw, BookOpen, Sparkles, FlaskConical,
  AlertTriangle, MoreHorizontal,
} from 'lucide-react'
import { Badge, Button, useToast } from '@/components/ui'
import { NeuralResultCard } from '@/components/ai/NeuralResultCard'
import { MultiCandidateCompare } from '@/components/ai/MultiCandidateCompare'
import { ResultsViewSwitcher } from './ResultsViewSwitcher'
import { DegradedBanner } from './DegradedBanner'
import { FormulaRecommendPanel } from './FormulaRecommendPanel'
import { FormulaExplanationPanel } from './FormulaExplanationPanel'
import { FormulaOverviewComparePanel } from './FormulaOverviewComparePanel'
import { type FormulaCategory } from '../config/generateTabConfig'
import type { AICandidate } from '@/api/ai'
import type { GeneratorType, ViewMode } from '../config/generateTabConfig'
import { FormulaExplanationModal } from './FormulaExplanationModal'

const OptimizationAdvisor = lazy(() =>
  import('@/components/ai/OptimizationAdvisor').then((module) => ({ default: module.OptimizationAdvisor }))
)
const FormulaSharePanel = lazy(() =>
  import('@/components/ai/FormulaSharePanel').then((module) => ({ default: module.FormulaSharePanel }))
)

interface FormulaResultsProProps {
  generateResult: AICandidate[] | null
  generator: GeneratorType
  generatorType?: string
  viewMode: ViewMode
  onViewModeChange: (mode: 'card' | 'compare') => void
  selectedCategory: FormulaCategory | 'all'
  onCategoryChange: (cat: FormulaCategory | 'all') => void
  sortBy: 'score' | 'name' | 'synergy'
  sortOrder: 'asc' | 'desc'
  onToggleSort: (sort: 'score' | 'name' | 'synergy') => void
  filteredResults: AICandidate[]
  formulaCategories: { id: FormulaCategory; label: string; color: string }[]
  onViewReport: (candidate: AICandidate) => void
  onSelectCandidate: (candidate: AICandidate) => void
  selectedCompareIndex: number | undefined
  onExportFormula: (format: 'json' | 'csv' | 'pdf') => void
  effectLabels: string[]
  onCompareVersions?: (v1: number, v2: number) => void
  onSaveAll?: () => void
  /** 单个候选保存成功回调（透传给 NeuralResultCard，触发保存成功反馈） */
  onSaveSuccess?: (formulaId: number, candidateId: string) => void
  /** 已保存候选映射（候选 ID → 配方 ID），用于卡片「已保存」标记（跨 tab 保留） */
  savedFormulas?: Map<string, { formulaId: number; savedAt: number }>
  /**
   * 降级标志（可信呈现·原则2）：true=本次结果由规则引擎兜底、未经 GA 优化，
   * 顶部显示降级横幅。来自 generationStore.degraded（api→hook→store 透传）。
   */
  degraded?: boolean
  /** 降级原因（后端 fallback_reason 原文），供降级横幅展示 */
  fallbackReason?: string | null
  className?: string
}

export const FormulaResultsPro: React.FC<FormulaResultsProProps> = ({
  generateResult,
  generator,
  generatorType,
  viewMode,
  onViewModeChange,
  selectedCategory,
  onCategoryChange,
  sortBy,
  sortOrder,
  onToggleSort,
  filteredResults,
  formulaCategories,
  onViewReport,
  onSelectCandidate,
  selectedCompareIndex,
  onExportFormula,
  effectLabels,
  onCompareVersions,
  onSaveAll,
  onSaveSuccess,
  savedFormulas = new Map(),
  degraded = false,
  fallbackReason,
  className = '',
}) => {
  const { t } = useTranslation()
  const { info: toastInfo } = useToast()
  const [showOptimizationAdvisor, setShowOptimizationAdvisor] = React.useState(false)
  const [showSharePanel, setShowSharePanel] = React.useState(false)
  const [showStats, setShowStats] = React.useState(true)
  const [selectedForExplanation, setSelectedForExplanation] = React.useState<AICandidate | null>(null)
  const [showRecommend, setShowRecommend] = React.useState(false)
  const [showExplanation, setShowExplanation] = React.useState(false)
  const [moreOpen, setMoreOpen] = React.useState(false)
  const [exportOpen, setExportOpen] = React.useState(false)

  const stats = useMemo(() => {
    if (!generateResult || generateResult.length === 0) return null
    const total = generateResult.length
    const avgScore = generateResult.reduce((sum, c) => sum + (c.overall_score || c.synergy_score || 0), 0) / total
    const maxScore = Math.max(...generateResult.map(c => c.overall_score || c.synergy_score || 0))
    const passedSafety = generateResult.filter(c => c.safety_passed).length
    return { total, avgScore, maxScore, passedSafety }
  }, [generateResult])

  // P1-4：从 generateResult[0].herb_combination 映射真实 ingredients 与评分，
  // 删除空成分与硬编码 taste:80/stability:75 占位数据；缺失时由 UI 标注「暂无数据」。
  const topCandidate = generateResult?.[0] ?? null
  // P1：rag_evidence 为响应级字段（归一化层已透传到每个候选），取顶部候选即可
  const ragEvidence = topCandidate?.rag_evidence
  // P0 防御（根因见下方 RAG 区注释）：rag_evidence 可能为 truthy 但缺数组字段（后端未回全），
  // 归一化时统一兜底为空数组，避免下方直接读 `.chunks.length` / `.whitelist.length` / `.blacklist.length`
  // 在字段缺失/非数组时抛 TypeError 导致整块结果面板崩溃（ErrorBoundary 接管，用户看不到候选）。
  const ragChunks = Array.isArray(ragEvidence?.chunks) ? ragEvidence.chunks : []
  const ragWhitelist = Array.isArray(ragEvidence?.whitelist) ? ragEvidence.whitelist : []
  const ragBlacklist = Array.isArray(ragEvidence?.blacklist) ? ragEvidence.blacklist : []

  const mappedIngredients = useMemo(() => {
    if (!topCandidate) return []
    return (topCandidate.herb_combination ?? [])
      .filter(h => h.name)
      .map(h => ({
        name: String(h.name),
        dosage: typeof h.dosage === 'string' && h.dosage
          ? h.dosage
          : typeof h.dosage_g === 'number' && h.dosage_g > 0
            ? `${h.dosage_g}g`
            : typeof h.dosage_mg === 'number' && h.dosage_mg > 0
              ? `${h.dosage_mg}g`
              : typeof h.dosage === 'number' && h.dosage > 0
                ? `${h.dosage}g`
                : '',
        role: h.role || '',
      }))
  }, [topCandidate])

  const topScores = useMemo(() => {
    if (!topCandidate) return null
    return {
      synergy: topCandidate.synergy_score ?? 0,
      taste: topCandidate.taste_score ?? 0,
      stability: topCandidate.stability_score ?? 0,
      safety: topCandidate.safety_passed == null ? 0 : (topCandidate.safety_passed ? 1 : 0),
      cost: topCandidate.cost_score ?? 0,
      overall: topCandidate.overall_score ?? 0,
    }
  }, [topCandidate])

  const scoreMissing = useMemo(() => {
    if (!topCandidate) return false
    return (
      topCandidate.taste_score == null ||
      topCandidate.stability_score == null ||
      topCandidate.synergy_score == null ||
      topCandidate.overall_score == null
    )
  }, [topCandidate])

  const getGeneratorLabel = (gen: GeneratorType | undefined): string => {
    switch (gen) {
      case 'llm': return t('ai.formula.generateTab.generatorLlm')
      case 'neural_network': return t('ai.formula.generateTab.generatorNeural')
      case 'ga': return t('ai.formula.generateTab.generatorGa')
      default: return t('ai.formula.generateTab.generatorRule')
    }
  }

  const getGeneratorBadge = (gen: GeneratorType | undefined): 'primary' | 'danger' | 'neutral' => {
    switch (gen) {
      case 'llm': return 'primary'
      case 'neural_network': return 'danger'
      case 'ga': return 'primary'
      default: return 'neutral'
    }
  }

  return (
    <div className={className}>
      {/* 可信呈现·原则2：降级横幅 —— degraded=true 时明示本次由规则引擎兜底、未经 GA 优化 */}
      <DegradedBanner degraded={degraded} fallbackReason={fallbackReason} />

      {/* Stats panel */}
      {stats && showStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-4 bg-muted/30 dark:bg-muted/10 rounded-xl border border-border">
          <div className="text-center">
            <div className="text-h5 font-bold font-mono text-[var(--text-primary)]">{stats.total}</div>
            <div className="text-caption text-muted-foreground mt-0.5">{t('ai.formula.generateTab.formulaCountLabel')}</div>
          </div>
          <div className="text-center">
            <div className="text-h5 font-bold font-mono text-success">{stats.avgScore.toFixed(1)}</div>
            <div className="text-caption text-muted-foreground mt-0.5">{t('ai.formula.generateTab.avgScore')}</div>
          </div>
          <div className="text-center">
            <div className="text-h5 font-bold font-mono text-warning">{stats.maxScore.toFixed(1)}</div>
            <div className="text-caption text-muted-foreground mt-0.5">{t('ai.formula.generateTab.maxScore')}</div>
          </div>
          <div className="text-center">
            <div className="text-h5 font-bold font-mono text-info">{stats.passedSafety}/{stats.total}</div>
            <div className="text-caption text-muted-foreground mt-0.5">{t('ai.formula.generateTab.safetyPassed')}</div>
          </div>
          <button onClick={() => setShowStats(false)} className="col-span-4 self-center inline-flex items-center justify-center min-h-[44px] gap-1 text-caption text-muted-foreground hover:text-foreground">
            <ChevronDown className="w-3 h-3" />{t('ai.formula.generateTab.collapse')}
          </button>
        </div>
      )}

      {/* P1：RAG 知识库证据摘要（后端 formula_generation_service 返回 rag_evidence） */}
      {generateResult && generateResult.length > 0 && (
        ragEvidence ? (
          <div className="mb-4 p-4 rounded-xl border border-border bg-surface/60">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-h4 font-semibold">
                {t('ai.formula.generateTab.ragEvidenceTitle')}
              </span>
              {ragEvidence.enabled ? (
                <Badge variant="success" className="text-caption">
                  {t('ai.formula.generateTab.ragEvidenceEnabled')}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-caption">
                  {t('ai.formula.generateTab.ragEvidenceDisabled')}
                </Badge>
              )}
              {/* P0 防御：用归一化后的空数组兜底，字段缺失/非数组时安全降级为「无知识块」 */}
              {ragChunks.length > 0 && (
                <span className="text-caption text-muted-foreground">
                  {t('ai.formula.generateTab.ragEvidenceChunks', { count: ragChunks.length })}
                </span>
              )}
            </div>
            {ragEvidence.query && (
              <p className="text-caption text-muted-foreground mb-2">
                {t('ai.formula.generateTab.ragEvidenceQuery', { query: ragEvidence.query })}
              </p>
            )}
            {ragWhitelist.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span className="text-caption text-muted-foreground mr-1">
                  {t('ai.formula.generateTab.ragEvidenceWhitelist')}
                </span>
                {ragWhitelist.map((name) => (
                  <Badge key={`rag-wl-${name}`} variant="success" className="text-caption">{name}</Badge>
                ))}
              </div>
            )}
            {ragBlacklist.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span className="text-caption text-muted-foreground mr-1">
                  {t('ai.formula.generateTab.ragEvidenceBlacklist')}
                </span>
                {ragBlacklist.map((name) => (
                  <Badge key={`rag-bl-${name}`} variant="destructive" className="text-caption">{name}</Badge>
                ))}
              </div>
            )}
            {ragEvidence.summary && (
              <p className="text-body-sm text-muted-foreground leading-relaxed">{ragEvidence.summary}</p>
            )}
          </div>
        ) : (
          <div className="mb-4 p-3 rounded-xl border border-border dark:border-border bg-muted/20 dark:bg-muted/10 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-caption text-muted-foreground">
              {t('ai.formula.generateTab.ragEvidenceNone')}
            </span>
          </div>
        )
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-h4 font-semibold">{t('ai.formula.generateTab.formulaCount', { count: generateResult?.length || 0 })}</h3>
            <Badge variant={getGeneratorBadge(generator)} className="text-overline">{getGeneratorLabel(generator)}</Badge>
          </div>
          <p className="text-caption text-muted-foreground">{t('ai.formula.generateTab.clickFormulaForDetails')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 筛选分组 */}
          <div className="flex items-center gap-2 px-3 min-h-[44px] bg-muted dark:bg-muted/20 rounded-lg border border-border dark:border-border">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value as FormulaCategory | 'all')}
              className="min-h-[44px] py-2 bg-transparent text-body-sm font-medium border-none outline-none cursor-pointer"
            >
              <option value="all">{t('ai.formula.generateTab.all')}</option>
              {formulaCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
            </select>
            {selectedCategory !== 'all' && (
              <span className="text-caption px-1.5 py-0.5 bg-primary/10 dark:bg-primary/20 text-primary rounded-full">{filteredResults.length}</span>
            )}
          </div>

          {/* 排序分组 */}
          <div className="flex items-center gap-1 bg-muted dark:bg-muted/20 rounded-lg p-0.5">
            <button onClick={() => onToggleSort('score')} className={`inline-flex items-center min-h-[44px] px-3 rounded text-caption font-medium ${sortBy === 'score' ? 'bg-background dark:bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>
              {t('ai.formula.generateTab.composite')} {sortBy === 'score' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button onClick={() => onToggleSort('synergy')} className={`inline-flex items-center min-h-[44px] px-3 rounded text-caption font-medium ${sortBy === 'synergy' ? 'bg-background dark:bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>
              {t('ai.formula.generateTab.synergyShort')} {sortBy === 'synergy' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          </div>

          {(generateResult?.length || 0) >= 2 && <ResultsViewSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />}

          <button onClick={() => setShowOptimizationAdvisor(!showOptimizationAdvisor)} className={`inline-flex items-center min-h-[44px] gap-1.5 px-3 rounded-lg text-body-sm font-medium border ${showOptimizationAdvisor ? 'bg-warning/10 dark:bg-warning/20 text-warning dark:text-warning-300 border-warning/20 dark:border-warning/30' : 'bg-muted dark:bg-muted/20 text-muted-foreground hover:text-foreground border-border'}`}>
            <Lightbulb className="w-3.5 h-3.5" />{t('ai.formula.generateTab.optimizationAdvice')}
          </button>

          <button onClick={() => setShowSharePanel(!showSharePanel)} className={`inline-flex items-center min-h-[44px] gap-1.5 px-3 rounded-lg text-body-sm font-medium border ${showSharePanel ? 'bg-info/10 dark:bg-info/20 text-info dark:text-info-300 border-info/20 dark:border-info/30' : 'bg-muted dark:bg-muted/20 text-muted-foreground hover:text-foreground border-border'}`}>
            <Share2 className="w-3.5 h-3.5" />{t('ai.formula.generateTab.share')}
          </button>

          {/* 导出下拉（点击展开，仿「更多」菜单范式：state + aria-expanded + 遮罩关闭） */}
          <div className="relative">
            <button
              onClick={() => setExportOpen(!exportOpen)}
              aria-expanded={exportOpen}
              className="inline-flex items-center min-h-[44px] gap-1.5 px-3 rounded-lg text-body-sm font-medium bg-muted dark:bg-muted/20 text-muted-foreground hover:text-foreground border border-border"
            >
              <Download className="w-3.5 h-3.5" />{t('ai.formula.generateTab.export')}
            </button>
            {exportOpen && (
              <>
                {/* 点击遮罩关闭 */}
                <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} aria-hidden="true" />
                <div className="absolute right-0 mt-1 w-40 bg-surface dark:bg-slate-900 rounded-lg shadow-lg border border-border dark:border-slate-700 z-50">
                  <div className="py-1">
                    <button onClick={() => { onExportFormula('json'); setExportOpen(false) }} className="w-full min-h-[44px] px-3 py-2 text-left text-body-sm text-foreground hover:bg-muted dark:hover:bg-slate-800">JSON</button>
                    <button onClick={() => { onExportFormula('csv'); setExportOpen(false) }} className="w-full min-h-[44px] px-3 py-2 text-left text-body-sm text-foreground hover:bg-muted dark:hover:bg-slate-800">CSV</button>
                    {/* P2-4/P3-3：PDF 导出逻辑已实现（useExportFormula），启用菜单项并移除「即将推出」 */}
                    <button onClick={() => { onExportFormula('pdf'); setExportOpen(false) }} className="w-full min-h-[44px] px-3 py-2 text-left text-body-sm text-foreground hover:bg-muted dark:hover:bg-slate-800">{t('ai.formula.generateTab.exportPdf')}</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Optimization panel */}
      {showOptimizationAdvisor && generateResult && generateResult.length > 0 && (
        <div className="mb-4">
          {scoreMissing && (
            <div role="status" className="mb-2 px-3 py-2 rounded-lg text-caption font-medium bg-warning/10 dark:bg-warning/20 text-warning dark:text-warning-300 border border-warning/20 dark:border-warning/30 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{t('ai.formula.generateTab.scorePartialUnavailableAdvisor')}</span>
            </div>
          )}
          <Suspense fallback={<div className="animate-pulse p-4 bg-muted rounded-xl h-32"></div>}>
            <OptimizationAdvisor
              formula={{ formulaName: generateResult?.[0]?.formula_name || t('ai.formula.generateTab.currentFormula'), effects: effectLabels, ingredients: mappedIngredients, scores: topScores || { synergy: 0, taste: 0, stability: 0, safety: 0, cost: 0, overall: 0 } }}
              onApplySuggestion={(suggestion) => {
                // P2：优化建议应用后给出明确反馈（当前建议为记录型，不伪造配方数据）
                const value = suggestion.suggestedValue ? t('ai.formula.generateTab.suggestedValue', { value: suggestion.suggestedValue }) : ''
                toastInfo(t('ai.formula.generateTab.optimizationRecorded', { title: suggestion.title, value }))
              }}
            />
          </Suspense>
        </div>
      )}

      {/* Share panel */}
      {showSharePanel && generateResult && generateResult.length > 0 && (
        <div className="mb-4">
          {scoreMissing && (
            <div role="status" className="mb-2 px-3 py-2 rounded-lg text-caption font-medium bg-warning/10 dark:bg-warning/20 text-warning dark:text-warning-300 border border-warning/20 dark:border-warning/30 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{t('ai.formula.generateTab.scorePartialUnavailableShare')}</span>
            </div>
          )}
          <Suspense fallback={<div className="animate-pulse p-4 bg-muted rounded-xl h-32"></div>}>
            <FormulaSharePanel
              formula={{ formulaName: generateResult?.[0]?.formula_name || t('ai.formula.generateTab.currentFormula'), effects: effectLabels, ingredients: mappedIngredients, scores: { synergy: topScores?.synergy || 0, taste: topScores?.taste || 0, stability: topScores?.stability || 0, overall: topScores?.overall || 0 } }}
              onClose={() => setShowSharePanel(false)}
              onShare={() => setShowSharePanel(false)}
            />
          </Suspense>
        </div>
      )}

      {/* Results */}
      {filteredResults.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 dark:bg-muted/10 rounded-xl border border-border dark:border-border">
          <Filter className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <h3 className="text-h4 font-semibold text-foreground mb-1">{t('ai.formula.generateTab.noResults')}</h3>
          <p className="text-body-sm text-muted-foreground mb-3">{t('ai.formula.generateTab.noResultsHint')}</p>
          <button onClick={() => onToggleSort('score')} className="min-h-[44px] px-4 py-2 text-caption bg-muted dark:bg-muted/20 rounded-lg hover:bg-background border border-border">{t('ai.formula.generateTab.reset')}</button>
        </div>
      ) : viewMode === 'card' ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredResults.map((candidate, index) => (
              <NeuralResultCard
                key={index}
                candidate={candidate}
                index={index}
                generatorType={generatorType}
                onViewReport={() => onViewReport(candidate)}
                onSelect={() => onSelectCandidate(candidate)}
                isSelected={selectedCompareIndex === index}
                onSaveSuccess={onSaveSuccess}
                savedFormulas={savedFormulas}
              />
            ))}
          </div>
          {/* 卡片视图：前 N 候选概览对比（药材多样性/总剂量/安全/角色结构） */}
          {filteredResults.length >= 2 && <FormulaOverviewComparePanel candidates={filteredResults} />}
        </>
      ) : (
        <MultiCandidateCompare candidates={filteredResults} selectedIndex={selectedCompareIndex} onSelectCandidate={onSelectCandidate} />
      )}

      {/* Formula Explanation Modal */}
      <FormulaExplanationModal
        candidate={selectedForExplanation}
        isOpen={!!selectedForExplanation}
        onClose={() => setSelectedForExplanation(null)}
      />

      {/* Bottom bar：左侧状态信息 + 右侧主操作（保存全部 / 最佳配方解释）+「更多」溢出菜单 */}
      {filteredResults.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-border dark:border-slate-700">
          {/* 左侧：状态信息（只读，非操作） */}
          <div className="flex items-center gap-4 text-caption text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-success" />{t('ai.formula.generateTab.passedSafety', { count: filteredResults.filter(c => c.safety_passed).length })}</span>
            <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-primary" />{t('ai.formula.generateTab.average', { value: stats?.avgScore.toFixed(1) || 0 })}</span>
          </div>

          {/* 右侧：主操作 2 个 + 更多溢出菜单 */}
          <div className="flex items-center gap-2">
            {/* 配方解释按钮（主操作） */}
            <button
              onClick={() => {
                if (filteredResults.length > 0) {
                  setSelectedForExplanation(filteredResults[0])
                }
              }}
              className="inline-flex items-center min-h-[44px] gap-1.5 px-3 rounded-lg text-body-sm font-medium bg-primary/10 dark:bg-primary/20 text-primary hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              {t('ai.formula.generateTab.interpretBestFormula')}
            </button>
            {onSaveAll && (
              <Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={onSaveAll}>{t('ai.formula.generateTab.saveAll')}</Button>
            )}

            {/* 更多溢出菜单：智能推荐 / 配方解释 / 版本对比 / 显示统计 */}
            <div className="relative">
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                aria-label={t('common.more')}
                aria-expanded={moreOpen}
                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] gap-1 px-2 rounded-lg text-body-sm font-medium bg-muted dark:bg-slate-800 text-muted-foreground hover:text-foreground border border-border dark:border-slate-700"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {moreOpen && (
                <>
                  {/* 点击遮罩关闭 */}
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} aria-hidden="true" />
                  <div className="absolute right-0 bottom-full mb-2 w-48 bg-surface dark:bg-slate-900 rounded-lg shadow-lg border border-border dark:border-slate-700 z-50">
                    <div className="py-1">
                      <button
                        onClick={() => { setShowRecommend(!showRecommend); setMoreOpen(false) }}
                        className="w-full inline-flex items-center gap-2 min-h-[44px] px-3 py-2 text-left text-body-sm text-foreground hover:bg-muted dark:hover:bg-slate-800"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-accent-500" />{t('ai.formula.generateTab.smartRecommend')}
                      </button>
                      <button
                        onClick={() => { setShowExplanation(!showExplanation); setMoreOpen(false) }}
                        className="w-full inline-flex items-center gap-2 min-h-[44px] px-3 py-2 text-left text-body-sm text-foreground hover:bg-muted dark:hover:bg-slate-800"
                      >
                        <FlaskConical className="w-3.5 h-3.5 text-accent-500" />{t('ai.formula.generateTab.formulaExplanation')}
                      </button>
                      {filteredResults.length >= 2 && onCompareVersions && (
                        <button
                          onClick={() => { onCompareVersions(1, 2); setMoreOpen(false) }}
                          className="w-full inline-flex items-center gap-2 min-h-[44px] px-3 py-2 text-left text-body-sm text-foreground hover:bg-muted dark:hover:bg-slate-800"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-info" />{t('ai.formula.generateTab.versionCompare')}
                        </button>
                      )}
                      {!showStats && (
                        <button
                          onClick={() => { setShowStats(true); setMoreOpen(false) }}
                          className="w-full inline-flex items-center gap-2 min-h-[44px] px-3 py-2 text-left text-body-sm text-foreground hover:bg-muted dark:hover:bg-slate-800"
                        >
                          <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />{t('ai.formula.generateTab.showStats')}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Smart Recommend panel */}
      {showRecommend && (
        <div className="mb-4">
          <FormulaRecommendPanel
            targetEffects={effectLabels}
            onClose={() => setShowRecommend(false)}
          />
        </div>
      )}

      {/* Formula Explanation panel */}
      {showExplanation && generateResult && generateResult.length > 0 && (
        <div className="mb-4">
          <FormulaExplanationPanel
            candidate={generateResult[0]}
            targetEffects={effectLabels}
            onClose={() => setShowExplanation(false)}
          />
        </div>
      )}
    </div>
  )
}

export default FormulaResultsPro
