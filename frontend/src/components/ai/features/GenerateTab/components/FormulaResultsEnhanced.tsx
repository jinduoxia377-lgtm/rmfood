/**
 * FormulaResultsEnhanced - 增强版配方结果展示组件
 * 
 * @description 优化结果展示，添加统计信息、快速操作、改进卡片布局
 * @version 2.0.0
 */
import React, { useCallback, useMemo, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Filter, Lightbulb, Share2, FileText, GitBranch, 
  TrendingUp, Star, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Eye, Download
} from 'lucide-react';
import { Badge } from '@/components/ui';
import { NeuralResultCard } from '@/components/ai/NeuralResultCard';
import { MultiCandidateCompare } from '@/components/ai/MultiCandidateCompare';
import { FormulaAcademicReport } from '@/components/ai/FormulaAcademicReport';
import { ResultsViewSwitcher } from './ResultsViewSwitcher';
import { DEFAULTS, FORMULA_CATEGORIES } from '@/config';
import { type FormulaCategory } from '../config/generateTabConfig';
import { logger } from '@/utils/safeLogger';
import type { AICandidate } from '@/api/ai';
import type { GeneratorType, ViewMode } from '../config/generateTabConfig';

const OptimizationAdvisor = lazy(() =>
  import('@/components/ai/OptimizationAdvisor').then((module) => ({
    default: module.OptimizationAdvisor,
  })),
);
const FormulaSharePanel = lazy(() =>
  import('@/components/ai/FormulaSharePanel').then((module) => ({
    default: module.FormulaSharePanel,
  })),
);

interface FormulaResultsEnhancedProps {
  generateResult: AICandidate[] | null;
  generator: GeneratorType;
  viewMode: ViewMode;
  onViewModeChange: (mode: 'card' | 'compare') => void;
  selectedCategory: FormulaCategory | 'all';
  onCategoryChange: (cat: FormulaCategory | 'all') => void;
  sortBy: 'score' | 'name' | 'synergy';
  sortOrder: 'asc' | 'desc';
  onToggleSort: (sort: 'score' | 'name' | 'synergy') => void;
  filteredResults: AICandidate[];
  formulaCategories: { id: FormulaCategory; label: string; color: string }[];
  onViewReport: (candidate: AICandidate) => void;
  onSelectCandidate: (candidate: AICandidate) => void;
  selectedCompareIndex: number | undefined;
  onExportFormula: (format: 'json' | 'csv' | 'pdf') => void;
  effectLabels: string[];
  onCompareVersions?: (v1: number, v2: number) => void;
  onSaveAll?: () => void;
}

export const FormulaResultsEnhanced: React.FC<FormulaResultsEnhancedProps> = ({
  generateResult,
  generator,
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
}) => {
  const { t } = useTranslation();
  const [showOptimizationAdvisor, setShowOptimizationAdvisor] = React.useState(false);
  const [showSharePanel, setShowSharePanel] = React.useState(false);
  const [showStats, setShowStats] = React.useState(true);

  const safeExtractFormulaData = useCallback((candidate: AICandidate | null | undefined) => {
    if (!candidate) {
      return {
        formulaName: DEFAULTS.PLACEHOLDER_TEXTS.UNKNOWN_FORMULA,
        effects: [] as string[],
        ingredients: [] as { name: string; dosage: string; role: string }[],
        scores: {
          synergy: 0,
          taste: DEFAULTS.DEFAULT_TASTE_SCORE,
          stability: DEFAULTS.DEFAULT_STABILITY_SCORE,
          safety: DEFAULTS.DEFAULT_SAFETY_SCORE,
          cost: DEFAULTS.DEFAULT_COST_SCORE,
          overall: 0,
        },
      };
    }

    const herbCombination = candidate.herb_combination || [];
    const HERB_ROLES = ['君药', '臣药', '佐药', '使药'] as const;

    return {
      formulaName: typeof candidate.formula_name === 'string'
        ? candidate.formula_name
        : DEFAULTS.PLACEHOLDER_TEXTS.UNKNOWN_FORMULA,
      ingredients: herbCombination.map((h: any, i: number) => ({
        name: typeof h.name === 'string' ? h.name : DEFAULTS.PLACEHOLDER_TEXTS.UNKNOWN_INGREDIENT,
        dosage: h.dosage || DEFAULTS.DEFAULT_DOSAGE_RANGE,
        role: HERB_ROLES[i % HERB_ROLES.length],
      })),
      scores: {
        synergy: candidate.synergy_score || 0,
        taste: ((candidate as unknown) as Record<string, unknown>).taste_score as number || DEFAULTS.DEFAULT_TASTE_SCORE,
        stability: ((candidate as unknown) as Record<string, unknown>).stability_score as number || DEFAULTS.DEFAULT_STABILITY_SCORE,
        safety: ((candidate as unknown) as Record<string, unknown>).safety_score as number || DEFAULTS.DEFAULT_SAFETY_SCORE,
        cost: ((candidate as unknown) as Record<string, unknown>).cost_score as number || DEFAULTS.DEFAULT_COST_SCORE,
        overall: ((candidate as unknown) as Record<string, unknown>).overall_score as number || candidate.synergy_score || 0,
      },
    };
  }, []);

  // 统计数据
  const stats = useMemo(() => {
    if (!generateResult || generateResult.length === 0) return null;
    
    const total = generateResult.length;
    const avgScore = generateResult.reduce((sum, c) => sum + (c.overall_score || c.synergy_score || 0), 0) / total;
    const maxScore = Math.max(...generateResult.map(c => c.overall_score || c.synergy_score || 0));
    const minScore = Math.min(...generateResult.map(c => c.overall_score || c.synergy_score || 0));
    const passedSafety = generateResult.filter(c => c.safety_passed).length;

    return { total, avgScore, maxScore, minScore, passedSafety };
  }, [generateResult]);

  const getGeneratorBadgeVariant = useMemo(() => {
    switch (generator) {
      case 'llm': return 'primary';
      case 'neural_network': return 'danger';
      default: return 'neutral';
    }
  }, [generator]);

  const getGeneratorBadgeLabel = useMemo(() => {
    switch (generator) {
      case 'llm': return DEFAULTS.PLACEHOLDER_TEXTS.BADGE_AI_MODEL;
      case 'neural_network': return DEFAULTS.PLACEHOLDER_TEXTS.BADGE_NEURAL_NETWORK;
      default: return DEFAULTS.PLACEHOLDER_TEXTS.BADGE_RULE_ENGINE;
    }
  }, [generator]);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* 统计信息面板 */}
      {stats && showStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-primary-900/10 dark:to-accent-900/10 rounded-xl border border-primary-100 dark:border-primary-800/30">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{stats.total}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">生成配方数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-success-600 dark:text-success-400">{stats.avgScore.toFixed(1)}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">平均得分</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-warning-600 dark:text-warning-400">{stats.maxScore.toFixed(1)}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">最高得分</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-info-600 dark:text-info-400">{stats.passedSafety}/{stats.total}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">安全通过</div>
          </div>
          <button
            onClick={() => setShowStats(false)}
            className="col-span-2 sm:col-span-1 self-center text-xs text-neutral-400 hover:text-neutral-600"
          >
            <ChevronDown className="w-4 h-4 inline mr-1" />
            收起
          </button>
        </div>
      )}

      {/* 工具栏 */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-primary-600)' }}>
              {`${DEFAULTS.PLACEHOLDER_TEXTS.RESULT_COUNT_PREFIX} ${generateResult?.length || 0} ${DEFAULTS.PLACEHOLDER_TEXTS.RESULT_COUNT_SUFFIX}`}
            </h3>
            <Badge variant={getGeneratorBadgeVariant} className="text-xs">
              {getGeneratorBadgeLabel}
            </Badge>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {DEFAULTS.PLACEHOLDER_TEXTS.RESULT_SUBTITLE}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* 分类筛选 */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-neutral-800 rounded-xl">
            <Filter className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value as FormulaCategory | 'all')}
              className="bg-transparent text-xs font-medium border-none outline-none cursor-pointer"
              style={{ color: 'var(--text-primary)' }}
            >
              <option value="all">{t('ai.formula.generateTab.allCategories')}</option>
              {formulaCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
            {selectedCategory !== 'all' && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: FORMULA_CATEGORIES[selectedCategory]?.color + '20',
                  color: FORMULA_CATEGORIES[selectedCategory]?.color,
                }}
              >
                {filteredResults.length}
              </span>
            )}
          </div>

          {/* 排序选项 */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-neutral-800 rounded-xl p-1">
            <button
              onClick={() => onToggleSort('score')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                sortBy === 'score' ? 'bg-white dark:bg-neutral-700 shadow-sm' : ''
              }`}
              style={{ color: sortBy === 'score' ? 'var(--color-primary-600)' : 'var(--text-muted)' }}
            >
              {t('ai.formula.generateTab.score')} {sortBy === 'score' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => onToggleSort('synergy')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                sortBy === 'synergy' ? 'bg-white dark:bg-neutral-700 shadow-sm' : ''
              }`}
              style={{ color: sortBy === 'synergy' ? 'var(--color-primary-600)' : 'var(--text-muted)' }}
            >
              {t('ai.formula.generateTab.synergy')} {sortBy === 'synergy' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          </div>

          {/* 视图切换 */}
          {(generateResult?.length || 0) >= 2 && (
            <ResultsViewSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
          )}

          {/* 优化建议 */}
          <button
            onClick={() => setShowOptimizationAdvisor(!showOptimizationAdvisor)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 flex items-center gap-1.5 border ${
              showOptimizationAdvisor
                ? 'shadow-md bg-warning-500/10 dark:bg-warning-500/16 text-warning-600 dark:text-warning-400'
                : 'bg-slate-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            {DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_OPTIMIZATION_ADVICE}
          </button>

          {/* 分享 */}
          <button
            onClick={() => setShowSharePanel(!showSharePanel)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 flex items-center gap-1.5 border ${
              showSharePanel
                ? 'shadow-md bg-cyan-500/10 dark:bg-cyan-500/16 text-cyan-600 dark:text-cyan-400'
                : 'bg-slate-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            {DEFAULTS.PLACEHOLDER_TEXTS.BUTTON_SHARE_FORMULA}
          </button>

          {/* 导出 */}
          <div className="relative group">
            <button
              className="px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 flex items-center gap-1.5 border bg-slate-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              {t('ai.formula.generateTab.export')}
            </button>
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="py-1">
                <button
                  onClick={() => onExportFormula('json')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
                >
                  <span className="text-success-500">{t('ai.formula.generateTab.json')}</span>
                </button>
                <button
                  onClick={() => onExportFormula('csv')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
                >
                  <span className="text-secondary-500">{t('ai.formula.generateTab.csv')}</span>
                </button>
                <button
                  onClick={() => onExportFormula('pdf')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
                >
                  <span className="text-error-500">{t('ai.formula.generateTab.pdfDeveloping')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 优化建议面板 */}
      {showOptimizationAdvisor && generateResult && generateResult.length > 0 && (
        <div className="animate-slide-up">
          <Suspense fallback={
            <div className="animate-pulse p-6 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              {DEFAULTS.PLACEHOLDER_TEXTS.LOADING_TEXT}
            </div>
          }>
            {(() => {
              const formulaData = safeExtractFormulaData(generateResult[0]);
              return (
                <OptimizationAdvisor
                  formula={{
                    ...formulaData,
                    effects: effectLabels,
                  }}
                  onApplySuggestion={(suggestion: any) => {
                    logger.info('应用建议', suggestion);
                  }}
                />
              );
            })()}
          </Suspense>
        </div>
      )}

      {/* 分享面板 */}
      {showSharePanel && generateResult && generateResult.length > 0 && (
        <div className="animate-slide-up">
          <Suspense fallback={
            <div className="animate-pulse p-6 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              {DEFAULTS.PLACEHOLDER_TEXTS.LOADING_TEXT}
            </div>
          }>
            {(() => {
              const formulaData = safeExtractFormulaData(generateResult[0]);
              return (
                <FormulaSharePanel
                  formula={{
                    formulaName: formulaData.formulaName,
                    effects: effectLabels,
                    ingredients: formulaData.ingredients as { name: string; dosage: string; role: string }[],
                    scores: formulaData.scores as {
                      synergy: number;
                      taste: number;
                      stability: number;
                      overall: number;
                    },
                  }}
                  onClose={() => setShowSharePanel(false)}
                  onShare={(sharedFormula) => {
                    logger.info('分享配方', sharedFormula);
                  }}
                />
              );
            })()}
          </Suspense>
        </div>
      )}

      {/* 结果展示区域 */}
      {filteredResults.length === 0 ? (
        <div className="text-center py-16 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-700">
          <Filter className="w-12 h-12 mx-auto mb-4 text-neutral-300 dark:text-neutral-600" />
          <h3 className="text-lg font-medium text-neutral-600 dark:text-neutral-400 mb-2">
            暂无匹配的配方
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-500">
            尝试调整筛选条件或重新生成配方
          </p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredResults.map((candidate, index) => (
            <NeuralResultCard
              key={index}
              candidate={candidate}
              index={index}
              onViewReport={() => onViewReport(candidate)}
              onSelect={() => onSelectCandidate(candidate)}
              isSelected={selectedCompareIndex === index}
            />
          ))}
        </div>
      ) : (
        <MultiCandidateCompare
          candidates={filteredResults}
          selectedIndex={selectedCompareIndex}
          onSelectCandidate={onSelectCandidate}
        />
      )}

      {/* 底部操作栏 */}
      {filteredResults.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-success-500" />
              {filteredResults.filter(c => c.safety_passed).length} 个配方通过安全检查
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStats(true)}
              className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              显示统计
            </button>
            {onSaveAll && (
              <button
                onClick={onSaveAll}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
              >
                保存全部
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FormulaResultsEnhanced;
