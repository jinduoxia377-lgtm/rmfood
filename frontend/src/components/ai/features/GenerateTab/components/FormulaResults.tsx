import React, { useCallback, useMemo, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, Lightbulb, Share2, FileText } from 'lucide-react';
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

interface FormulaResultsProps {
  generateResult: AICandidate[] | null;
  generator: GeneratorType;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
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
}

interface SavedFormulaState {
  formulaId: number;
  savedAt: number;
}

interface OptimizationSuggestion {
  type: 'ingredient' | 'dosage' | 'effect' | 'combination';
  priority: 'high' | 'medium' | 'low';
  description: string;
  suggestion: string;
}

interface SharedFormula {
  id: string;
  name: string;
  effects: string[];
  ingredients: { name: string; dosage: string; role: string }[];
  createdAt: number;
  shareUrl?: string;
}

export const FormulaResults: React.FC<FormulaResultsProps> = ({
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
}) => {
  // ===== i18n =====
  const { t } = useTranslation();

  const [showOptimizationAdvisor, setShowOptimizationAdvisor] = React.useState(false);
  const [showSharePanel, setShowSharePanel] = React.useState(false);

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
      formulaName:
        typeof candidate.formula_name === 'string'
          ? candidate.formula_name
          : DEFAULTS.PLACEHOLDER_TEXTS.UNKNOWN_FORMULA,
      ingredients: herbCombination.map((h: any, i: number) => ({
        name: typeof h.name === 'string' ? h.name : DEFAULTS.PLACEHOLDER_TEXTS.UNKNOWN_INGREDIENT,
        dosage: h.dosage || DEFAULTS.DEFAULT_DOSAGE_RANGE,
        role: HERB_ROLES[i % HERB_ROLES.length],
      })),
      scores: {
        synergy: candidate.synergy_score || 0,
        taste: (candidate as Record<string, unknown>).taste_score as number || DEFAULTS.DEFAULT_TASTE_SCORE,
        stability: (candidate as Record<string, unknown>).stability_score as number || DEFAULTS.DEFAULT_STABILITY_SCORE,
        safety: (candidate as Record<string, unknown>).safety_score as number || DEFAULTS.DEFAULT_SAFETY_SCORE,
        cost: (candidate as Record<string, unknown>).cost_score as number || DEFAULTS.DEFAULT_COST_SCORE,
        overall: (candidate as Record<string, unknown>).overall_score as number || candidate.synergy_score || 0,
      },
    };
  }, []);

  const getGeneratorBadgeVariant = useMemo(() => {
    switch (generator) {
      case 'llm':
        return 'primary';
      case 'neural_network':
        return 'danger';
      default:
        return 'neutral';
    }
  }, [generator]);

  const getGeneratorBadgeLabel = useMemo(() => {
    switch (generator) {
      case 'llm':
        return DEFAULTS.PLACEHOLDER_TEXTS.BADGE_AI_MODEL;
      case 'neural_network':
        return DEFAULTS.PLACEHOLDER_TEXTS.BADGE_NEURAL_NETWORK;
      default:
        return DEFAULTS.PLACEHOLDER_TEXTS.BADGE_RULE_ENGINE;
    }
  }, [generator]);

  return (
    <div className="space-y-6 animate-slide-up">
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

          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-neutral-800 rounded-xl p-1">
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

          {(generateResult?.length || 0) >= 2 && (
            <ResultsViewSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
          )}

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

          <div className="relative group">
            <button
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 flex items-center gap-1.5 border ${'bg-slate-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:shadow-md'}`}
            >
              <FileText className="w-3.5 h-3.5" />
              {t('ai.formula.generateTab.export')}
            </button>
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="py-1">
                <button
                  onClick={() => onExportFormula('json')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
                >
                  <span className="text-success-500">📋 {t('ai.formula.generateTab.json')}</span>
                </button>
                <button
                  onClick={() => onExportFormula('csv')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
                >
                  <span className="text-secondary-500">📊 {t('ai.formula.generateTab.csv')}</span>
                </button>
                <button
                  onClick={() => onExportFormula('pdf')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
                >
                  <span className="text-error-500">📄 {t('ai.formula.generateTab.pdfDeveloping')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showOptimizationAdvisor && generateResult && generateResult.length > 0 && (
        <div className="animate-slide-up">
          <Suspense
            fallback={
              <div className="animate-pulse p-6 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                {DEFAULTS.PLACEHOLDER_TEXTS.LOADING_TEXT}
              </div>
            }
          >
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

      {showSharePanel && generateResult && generateResult.length > 0 && (
        <div className="animate-slide-up">
          <Suspense
            fallback={
              <div className="animate-pulse p-6 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                {DEFAULTS.PLACEHOLDER_TEXTS.LOADING_TEXT}
              </div>
            }
          >
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

      {viewMode === 'card' ? (
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
    </div>
  );
};
