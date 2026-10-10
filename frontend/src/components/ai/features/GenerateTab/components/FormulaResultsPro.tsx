/**
 * FormulaResultsPro - Professional Formula Results Component
 * 
 * @description Clean layout following RMFOOD design system
 * @version 5.0.0 - Unified Layout
 */
import React, { useCallback, useMemo, useState, Suspense, lazy } from 'react'
import {
  Filter, Lightbulb, Share2, TrendingUp, CheckCircle,
  ChevronDown, Download, RefreshCw, BookOpen, Sparkles, FlaskConical,
} from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { NeuralResultCard } from '@/components/ai/NeuralResultCard'
import { MultiCandidateCompare } from '@/components/ai/MultiCandidateCompare'
import { ResultsViewSwitcher } from './ResultsViewSwitcher'
import { FormulaRecommendPanel } from './FormulaRecommendPanel'
import { FormulaExplanationPanel } from './FormulaExplanationPanel'
import { DEFAULTS } from '@/config'
import { type FormulaCategory } from '../config/generateTabConfig'
import { logger } from '@/utils/safeLogger'
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
  className = '',
}) => {
  const [showOptimizationAdvisor, setShowOptimizationAdvisor] = React.useState(false)
  const [showSharePanel, setShowSharePanel] = React.useState(false)
  const [showStats, setShowStats] = React.useState(true)
  const [selectedForExplanation, setSelectedForExplanation] = React.useState<AICandidate | null>(null)
  const [showRecommend, setShowRecommend] = React.useState(false)
  const [showExplanation, setShowExplanation] = React.useState(false)

  const stats = useMemo(() => {
    if (!generateResult || generateResult.length === 0) return null
    const total = generateResult.length
    const avgScore = generateResult.reduce((sum, c) => sum + (c.overall_score || c.synergy_score || 0), 0) / total
    const maxScore = Math.max(...generateResult.map(c => c.overall_score || c.synergy_score || 0))
    const passedSafety = generateResult.filter(c => c.safety_passed).length
    return { total, avgScore, maxScore, passedSafety }
  }, [generateResult])

  const getGeneratorLabel = (gen: GeneratorType | undefined): string => {
    switch (gen) {
      case 'llm': return 'AI 大模型'
      case 'neural_network': return '神经网络'
      default: return '规则引擎'
    }
  }

  const getGeneratorBadge = (gen: GeneratorType | undefined): 'primary' | 'danger' | 'neutral' => {
    switch (gen) {
      case 'llm': return 'primary'
      case 'neural_network': return 'danger'
      default: return 'neutral'
    }
  }

  return (
    <div className={className}>
      {/* Stats panel */}
      {stats && showStats && (
        <div className="grid grid-cols-4 gap-3 mb-4 p-4 bg-muted/30 rounded-xl border border-border">
          <div className="text-center">
            <div className="text-display-sm font-bold text-primary">{stats.total}</div>
            <div className="text-caption text-muted-foreground mt-0.5">配方数</div>
          </div>
          <div className="text-center">
            <div className="text-display-sm font-bold text-success">{stats.avgScore.toFixed(1)}</div>
            <div className="text-caption text-muted-foreground mt-0.5">平均分</div>
          </div>
          <div className="text-center">
            <div className="text-display-sm font-bold text-warning">{stats.maxScore.toFixed(1)}</div>
            <div className="text-caption text-muted-foreground mt-0.5">最高分</div>
          </div>
          <div className="text-center">
            <div className="text-display-sm font-bold text-info">{stats.passedSafety}/{stats.total}</div>
            <div className="text-caption text-muted-foreground mt-0.5">安全通过</div>
          </div>
          <button onClick={() => setShowStats(false)} className="col-span-4 self-center text-caption text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ChevronDown className="w-3 h-3" />收起
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-title-sm font-semibold">{generateResult?.length || 0} 个配方</h3>
            <Badge variant={getGeneratorBadge(generator)} className="text-label-sm">{getGeneratorLabel(generator)}</Badge>
          </div>
          <p className="text-caption text-muted-foreground">点击配方可查看详情</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg border border-border">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value as FormulaCategory | 'all')}
              className="bg-transparent text-body-sm font-medium border-none outline-none cursor-pointer"
            >
              <option value="all">全部</option>
              {formulaCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
            </select>
            {selectedCategory !== 'all' && (
              <span className="text-caption px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">{filteredResults.length}</span>
            )}
          </div>

          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            <button onClick={() => onToggleSort('score')} className={`px-2 py-1 rounded text-caption font-medium ${sortBy === 'score' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>
              综合 {sortBy === 'score' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button onClick={() => onToggleSort('synergy')} className={`px-2 py-1 rounded text-caption font-medium ${sortBy === 'synergy' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>
              协同 {sortBy === 'synergy' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          </div>

          {(generateResult?.length || 0) >= 2 && <ResultsViewSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />}

          <button onClick={() => setShowOptimizationAdvisor(!showOptimizationAdvisor)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-sm font-medium border ${showOptimizationAdvisor ? 'bg-warning/10 text-warning border-warning/20' : 'bg-muted text-muted-foreground hover:text-foreground border-border'}`}>
            <Lightbulb className="w-3.5 h-3.5" />优化建议
          </button>

          <button onClick={() => setShowSharePanel(!showSharePanel)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-sm font-medium border ${showSharePanel ? 'bg-info/10 text-info border-info/20' : 'bg-muted text-muted-foreground hover:text-foreground border-border'}`}>
            <Share2 className="w-3.5 h-3.5" />分享
          </button>

          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-sm font-medium bg-muted text-muted-foreground hover:text-foreground border border-border">
              <Download className="w-3.5 h-3.5" />导出
            </button>
            <div className="absolute right-0 mt-1 w-32 bg-surface rounded-lg shadow-lg border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="py-1">
                <button onClick={() => onExportFormula('json')} className="w-full px-3 py-2 text-left text-body-sm hover:bg-muted">JSON</button>
                <button onClick={() => onExportFormula('csv')} className="w-full px-3 py-2 text-left text-body-sm hover:bg-muted">CSV</button>
                <button className="w-full px-3 py-2 text-left text-body-sm hover:bg-muted opacity-50 cursor-not-allowed">PDF (即将推出)</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Optimization panel */}
      {showOptimizationAdvisor && generateResult && generateResult.length > 0 && (
        <div className="mb-4">
          <Suspense fallback={<div className="animate-pulse p-4 bg-muted rounded-xl h-32"></div>}>
            <OptimizationAdvisor
              formula={{ formulaName: generateResult?.[0]?.formula_name || '当前配方', effects: effectLabels, ingredients: [], scores: { synergy: generateResult[0]?.synergy_score || 0, taste: 80, stability: 75, safety: 90, cost: 70, overall: generateResult[0]?.overall_score || 0 } }}
              onApplySuggestion={() => {}}
            />
          </Suspense>
        </div>
      )}

      {/* Share panel */}
      {showSharePanel && generateResult && generateResult.length > 0 && (
        <div className="mb-4">
          <Suspense fallback={<div className="animate-pulse p-4 bg-muted rounded-xl h-32"></div>}>
            <FormulaSharePanel
              formula={{ formulaName: generateResult?.[0]?.formula_name || '当前配方', effects: effectLabels, ingredients: [], scores: { synergy: generateResult[0]?.synergy_score || 0, taste: 80, stability: 75, overall: generateResult[0]?.overall_score || 0 } }}
              onClose={() => setShowSharePanel(false)}
              onShare={() => setShowSharePanel(false)}
            />
          </Suspense>
        </div>
      )}

      {/* Results */}
      {filteredResults.length === 0 ? (
        <div className="text-center py-12 bg-muted/20 rounded-xl border-2 border-dashed border-border">
          <Filter className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <h3 className="text-title-sm font-semibold text-foreground mb-1">暂无结果</h3>
          <p className="text-body-sm text-muted-foreground mb-3">请尝试调整筛选条件</p>
          <button onClick={() => onToggleSort('score')} className="px-3 py-1.5 text-caption bg-muted rounded-lg hover:bg-background">重置</button>
        </div>
      ) : viewMode === 'card' ? (
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
            />
          ))}
        </div>
      ) : (
        <MultiCandidateCompare candidates={filteredResults} selectedIndex={selectedCompareIndex} onSelectCandidate={onSelectCandidate} />
      )}

      {/* Formula Explanation Modal */}
      <FormulaExplanationModal
        candidate={selectedForExplanation}
        isOpen={!!selectedForExplanation}
        onClose={() => setSelectedForExplanation(null)}
      />

      {/* Bottom bar */}
      {filteredResults.length > 0 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <div className="flex items-center gap-4 text-caption text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-success" />{filteredResults.filter(c => c.safety_passed).length} 通过安全</span>
            <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-primary" />平均: {stats?.avgScore.toFixed(1) || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* 配方解释按钮 */}
            <button
              onClick={() => {
                if (filteredResults.length > 0) {
                  setSelectedForExplanation(filteredResults[0])
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              解读最佳配方
            </button>
            {!showStats && (
              <button onClick={() => setShowStats(true)} className="px-3 py-1.5 text-caption text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />显示统计
              </button>
            )}
            {onSaveAll && (
              <Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={onSaveAll}>全部保存</Button>
            )}
          </div>
          {filteredResults.length >= 2 && onCompareVersions && (
            <button
              onClick={() => onCompareVersions(1, 2)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-sm font-medium bg-info/10 text-info hover:bg-info/20 border border-info/20"
            >
              版本对比
            </button>
          )}
          <button
            onClick={() => setShowRecommend(!showRecommend)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-sm font-medium border ${showRecommend ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground hover:text-foreground border-border'}`}
          >
            <Sparkles className="w-3.5 h-3.5" />智能推荐
          </button>
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-sm font-medium border ${showExplanation ? 'bg-accent-50 text-accent-700 border-accent-200 dark:bg-accent-300/25 dark:text-accent-700 dark:border-accent-800' : 'bg-muted text-muted-foreground hover:text-foreground border-border'}`}
          >
            <FlaskConical className="w-3.5 h-3.5" />配方方解
          </button>
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
