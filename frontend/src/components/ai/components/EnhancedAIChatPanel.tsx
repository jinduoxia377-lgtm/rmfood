/**
 * EnhancedAIChatPanel v2.0 - 增强型智能对话专业面板
 *
 * 整合功能:
 * - 配方智能评分与优化建议
 * - 成分深度分析可视化
 * - 协同效果动态模拟
 * - 个性化应用推荐
 * - 多维度数据联动
 */

import React, { useState, useMemo, useCallback } from 'react'
import {
  BarChart3,
  Network,
  Lightbulb,
  Activity,
  Zap,
  Target,
  Info,
  Minimize2,
  Maximize2,
  Filter,
  Layers,
  GitBranch,
  Award,
  Heart,
  Microscope,
  Sparkles,
  FileText,
  Download,
} from 'lucide-react'

import type { FormulaTableData, Ingredient } from '@/types/ai.types'

import {
  useEnhancedFormulaAnalysis,
} from './EnhancedFormulaAnalyzer'

import {
  useIngredientDeepAnalysis,
} from './IngredientDeepAnalysis'

import {
  useSynergySimulator,
} from './SynergySimulator'

import {
  useIntelligentRecommendation,
} from './IntelligentRecommendationEngine'

// ==================== 类型定义 ====================

export interface EnhancedPanelProps {
  data: FormulaTableData | null
  onExport?: (format: 'pdf' | 'word' | 'excel') => void
  onAction?: (action: string, payload?: unknown) => void
}

type PanelTab =
  | 'overview'
  | 'formula-analysis'
  | 'ingredient-deep-dive'
  | 'synergy-simulation'
  | 'smart-recommendations'
  | 'comparison'

// ==================== 主组件 ====================

export const EnhancedAIChatPanel: React.FC<EnhancedPanelProps> = ({
  data,
  onExport,
  onAction,
}) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('overview')
  const [isExpanded, setIsExpanded] = useState(true)
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([])

  const formulaAnalysis = useEnhancedFormulaAnalysis(data)
  const ingredientAnalysis = useIngredientDeepAnalysis()
  const synergySim = useSynergySimulator()
  const recommendationEngine = useIntelligentRecommendation()

  const ingredients = useMemo(() => data?.ingredients || [], [data])

  const handleTabChange = useCallback((tab: PanelTab) => {
    setActiveTab(tab)
    onAction?.('tab-change', tab)
  }, [onAction])

  const handleIngredientSelect = useCallback((ingredientName: string) => {
    setSelectedIngredients(prev =>
      prev.includes(ingredientName)
        ? prev.filter(n => n !== ingredientName)
        : [...prev, ingredientName],
    )
  }, [])

  if (!data || ingredients.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 text-center">
        <Info className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
        <p className="text-neutral-500 dark:text-neutral-400">
          检测到配方数据后将自动显示增强分析面板
        </p>
      </div>
    )
  }

  return (
    <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 transition-all duration-300 ${isExpanded ? 'max-h-[1200px]' : 'max-h-[60px]'}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750"
         role="button" tabIndex={0} onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            AI 增强分析系统
          </h3>
          {formulaAnalysis.score && (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreBadgeClass(formulaAnalysis.score.level)}`}>
              {formulaAnalysis.score.overall}分 · {formulaAnalysis.getScoreLabel(formulaAnalysis.score.level)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onExport && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onExport('pdf'); }}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
                title="导出PDF报告"
              >
                <FileText className="w-4 h-4 text-error-600" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onExport('excel'); }}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
                title="导出Excel数据"
              >
                <Download className="w-4 h-4 text-success-600" />
              </button>
            </>
          )}
          {isExpanded ? (
            <Minimize2 className="w-4 h-4 text-neutral-500" />
          ) : (
            <Maximize2 className="w-4 h-4 text-neutral-500" />
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Tab Navigation */}
          <div className="flex border-b border-neutral-200 dark:border-neutral-700 px-4 overflow-x-auto">
            {[
              { id: 'overview' as PanelTab, label: '总览', icon: <BarChart3 className="w-4 h-4" /> },
              { id: 'formula-analysis' as PanelTab, label: '配方分析', icon: <Microscope className="w-4 h-4" /> },
              { id: 'ingredient-deep-dive' as PanelTab, label: '成分深析', icon: <Zap className="w-4 h-4" /> },
              { id: 'synergy-simulation' as PanelTab, label: '协同模拟', icon: <Network className="w-4 h-4" /> },
              { id: 'smart-recommendations' as PanelTab, label: '智能推荐', icon: <Lightbulb className="w-4 h-4" /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-6 max-h-[900px] overflow-y-auto">
            {activeTab === 'overview' && (
              <OverviewTab
                formulaAnalysis={formulaAnalysis}
                ingredients={ingredients}
                selectedIngredients={selectedIngredients}
                onSelectIngredient={handleIngredientSelect}
              />
            )}

            {activeTab === 'formula-analysis' && (
              <FormulaAnalysisTab
                data={data}
                formulaAnalysis={formulaAnalysis}
              />
            )}

            {activeTab === 'ingredient-deep-dive' && (
              <IngredientDeepDiveTab
                ingredients={ingredients}
                analysis={ingredientAnalysis}
                selectedIngredients={selectedIngredients}
                onSelectIngredient={handleIngredientSelect}
              />
            )}

            {activeTab === 'synergy-simulation' && (
              <SynergySimulationTab
                ingredients={ingredients}
                simulator={synergySim}
              />
            )}

            {activeTab === 'smart-recommendations' && (
              <SmartRecommendationsTab
                data={data}
                engine={recommendationEngine}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ==================== 子组件：总览 ====================

interface OverviewTabProps {
  formulaAnalysis: ReturnType<typeof useEnhancedFormulaAnalysis>
  ingredients: Ingredient[]
  selectedIngredients: string[]
  onSelectIngredient: (name: string) => void
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  formulaAnalysis,
  ingredients,
  selectedIngredients,
  onSelectIngredient,
}) => {
  const score = formulaAnalysis.score

  return (
    <div className="space-y-6">
      {/* Score Overview */}
      {score && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ScoreCard
            title="整体评分"
            score={score.overall}
            level={score.level}
            icon={<Award className="w-6 h-6" />}
          />

          <DimensionCard
            dimensions={score.dimensions}
          />

          <SuggestionsCard
            suggestions={score.suggestions}
          />
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Layers className="w-5 h-5" />}
          label="成分数量"
          value={`${ingredients.length}种`}
          color="blue"
        />
        <StatCard
          icon={<GitBranch className="w-5 h-5" />}
          label="相互作用"
          value={`${formulaAnalysis.relations.length}对`}
          color="purple"
        />
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="剂量优化项"
          value={`${formulaAnalysis.dosageOptimizations.length}项`}
          color="green"
        />
        <StatCard
          icon={<Heart className="w-5 h-5" />}
          label="营养估算"
          value={formulaAnalysis.nutrition ? `${formulaAnalysis.nutrition.totalCalories}kcal` : '-'}
          color="red"
        />
      </div>

      {/* Ingredient List with Selection */}
      <div>
        <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
          <Filter className="w-4 h-4" />
          选择成分进行深度分析（已选{selectedIngredients.length}个）
        </h4>
        <div className="flex flex-wrap gap-2">
          {ingredients.map(ing => (
            <button
              key={ing.name}
              onClick={() => onSelectIngredient(ing.name)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedIngredients.includes(ing.name)
                  ? 'bg-primary-container text-primary-main shadow-md'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
              }`}
            >
              {ing.name} ({ing.amount}{ing.unit})
            </button>
          ))}
        </div>
      </div>

      {/* Key Relations Preview */}
      {formulaAnalysis.relations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
            关键成分关系
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {formulaAnalysis.relations.slice(0, 5).map((rel, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  rel.type === 'antagonistic'
                    ? 'border-red-200 bg-error-50 dark:bg-error-900/10'
                    : rel.type === 'synergistic'
                      ? 'border-green-200 bg-success-50 dark:bg-success-900/10'
                      : 'border-neutral-200 bg-slate-50 dark:bg-neutral-700/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">
                    {rel.source} + {rel.target}
                  </span>
                  <span className={`text-xs font-semibold ${
                    rel.type === 'antagonistic' ? 'text-error-600' :
                    rel.type === 'synergistic' ? 'text-success-600' : 'text-neutral-600'
                  }`}>
                    {rel.type === 'synergistic' ? '✓' : rel.type === 'antagonistic' ? '⚠' : '○'}
                    {' '}{rel.strength.toFixed(1)}
                  </span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                  {rel.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== 子组件：配方分析 ====================

interface FormulaAnalysisTabProps {
  data: FormulaTableData
  formulaAnalysis: ReturnType<typeof useEnhancedFormulaAnalysis>
}

const FormulaAnalysisTab: React.FC<FormulaAnalysisTabProps> = ({ formulaAnalysis }) => {
  const score = formulaAnalysis.score
  const optimizations = formulaAnalysis.dosageOptimizations
  const nutrition = formulaAnalysis.nutrition

  return (
    <div className="space-y-6">
      {/* Detailed Score Breakdown */}
      {score && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-750 rounded-xl p-6">
          <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">
            六维评分详情
          </h4>
          <div className="space-y-4">
            {(Object.entries(score.dimensions)).map(([key, value]) => {
              const labels: Record<string, string> = {
                efficacy: '功效强度',
                safety: '安全系数',
                synergy: '协同效应',
                stability: '稳定性',
                taste: '口感平衡',
                costEffectiveness: '成本效益',
              }

              return (
                <div key={key}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {labels[key]}
                    </span>
                    <span className="text-sm font-bold text-neutral-900 dark:text-white">
                      {value}/10
                    </span>
                  </div>
                  <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${getScoreBarColor(value)}`}
                      style={{ width: `${value * 10}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Dosage Optimizations */}
      {optimizations.length > 0 && (
        <div>
          <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            剂量优化建议
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-750">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">成分</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">当前用量</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">建议范围</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">说明</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-neutral-800 divide-y divide-slate-200 dark:divide-slate-700">
                {optimizations.map((opt, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white">
                      {opt.ingredientName}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                      {opt.currentDosage}g
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                      {opt.recommendedRange.min}-{opt.recommendedRange.max}g（最佳{opt.recommendedRange.optimal}g）
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getOptimizationBadgeClass(opt.optimizationType)}`}>
                        {opt.optimizationType === 'increase' ? '偏低' :
                         opt.optimizationType === 'decrease' ? '偏高' :
                         opt.optimizationType === 'optimal' ? '最佳' : '未知'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                      {opt.rationale}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Nutrition Estimate */}
      {nutrition && (
        <div>
          <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5" />
            营养成分估算
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <NutrientCard label="热量" value={nutrition.totalCalories || 0} unit="kcal" />
            <NutrientCard label="蛋白质" value={nutrition.macronutrients.protein || 0} unit="g" />
            <NutrientCard label="碳水" value={nutrition.macronutrients.carbs || 0} unit="g" />
            <NutrientCard label="脂肪" value={nutrition.macronutrients.fat || 0} unit="g" />
            <NutrientCard label="纤维" value={nutrition.macronutrients.fiber || 0} unit="g" />
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            置信度: {nutrition.confidence}%（基于已知成分营养数据库）
          </p>
        </div>
      )}
    </div>
  )
}

// ==================== 辅助UI组件 ====================

const ScoreCard: React.FC<{
  title: string
  score: number
  level: string
  icon: React.ReactNode
}> = React.memo(({ title, score, level, icon }) => (
  <div className="bg-white dark:bg-slate-750 rounded-lg p-4 shadow-sm border border-neutral-200 dark:border-neutral-700">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{title}</span>
      {icon}
    </div>
    <div className="text-3xl font-bold text-neutral-900 dark:text-white">{score}</div>
    <div className={`text-xs font-medium ${getScoreTextColor(level)}`}>
      {level === 'excellent' ? '优秀' : level === 'good' ? '良好' : level === 'moderate' ? '中等' : '待改进'}
    </div>
  </div>
))

const DimensionCard: React.FC<{ dimensions: Record<string, number> }> = React.memo(({ dimensions }) => (
  <div className="bg-white dark:bg-slate-750 rounded-lg p-4 shadow-sm border border-neutral-200 dark:border-neutral-700">
    <h5 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-3">维度得分</h5>
    <div className="space-y-2">
      {Object.entries(dimensions).slice(0, 4).map(([key, val]) => (
        <div key={key} className="flex justify-between items-center">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {key === 'efficacy' ? '功效' : key === 'safety' ? '安全' : key === 'synergy' ? '协同' : key}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-16 bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${getScoreBarColor(val)}`}
                style={{ width: `${val}%` }}
              ></div>
            </div>
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 w-8 text-right">{val}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
))

const SuggestionsCard: React.FC<{ suggestions: string[] }> = React.memo(({ suggestions }) => (
  <div className="bg-white dark:bg-slate-750 rounded-lg p-4 shadow-sm border border-neutral-200 dark:border-neutral-700">
    <h5 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-3">优化建议</h5>
    <ul className="space-y-1.5">
      {suggestions.slice(0, 3).map((suggestion, idx) => (
        <li key={idx} className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
          <Lightbulb className="w-3 h-3 mt-0.5 text-yellow-500 flex-shrink-0" />
          <span>{suggestion}</span>
        </li>
      ))}
    </ul>
  </div>
))

const StatCard: React.FC<{
  icon: React.ReactNode
  label: string
  value: string
  color: string
}> = React.memo(({ icon, label, value, color }) => (
  <div className="bg-slate-50 dark:bg-slate-750 rounded-lg p-3 text-center">
    <div className={`inline-flex p-2 rounded-lg bg-${color}-100 dark:bg-${color}-900/20 mb-2`}>
      <div className={`text-${color}-600 dark:text-${color}-400`}>{icon}</div>
    </div>
    <div className="text-lg font-bold text-neutral-900 dark:text-white">{value}</div>
    <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
  </div>
))

const NutrientCard: React.FC<{ label: string; value: number; unit: string }> = React.memo(({ label, value, unit }) => (
  <div className="bg-slate-50 dark:bg-slate-750 rounded-lg p-3 text-center">
    <div className="text-lg font-bold text-neutral-900 dark:text-white">{value}</div>
    <div className="text-xs text-neutral-500">{unit}</div>
    <div className="text-xs text-neutral-400 mt-1">{label}</div>
  </div>
))

// ==================== 样式工具函数 ====================

function getScoreBadgeClass(level: string): string {
  switch (level) {
    case 'excellent': return 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300'
    case 'good': return 'bg-secondary-100 text-secondary-800 dark:bg-secondary-900/30 dark:text-secondary-300'
    case 'moderate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    default: return 'bg-error-100 text-error-800 dark:bg-error-900/30 dark:text-error-300'
  }
}

function getScoreTextColor(level: string): string {
  switch (level) {
    case 'excellent': return 'text-success-600 dark:text-success-400'
    case 'good': return 'text-secondary-600 dark:text-secondary-400'
    case 'moderate': return 'text-yellow-600 dark:text-yellow-400'
    default: return 'text-error-600 dark:text-error-400'
  }
}

function getScoreBarColor(score: number): string {
  if (score >= 8) return 'bg-success-500'
  if (score >= 6) return 'bg-secondary-500'
  if (score >= 4) return 'bg-yellow-500'
  return 'bg-error-500'
}

function getOptimizationBadgeClass(type: string): string {
  switch (type) {
    case 'increase': return 'bg-secondary-100 text-secondary-800 dark:bg-secondary-900/30 dark:text-secondary-300'
    case 'decrease': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
    case 'optimal': return 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300'
    default: return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300'
  }
}

// ==================== 占位组件（其他Tab） ====================

interface IngredientDeepDiveTabProps {
  ingredients: Ingredient[]
  analysis: ReturnType<typeof useIngredientDeepAnalysis>
  selectedIngredients: string[]
  onSelectIngredient: (ingredientName: string) => void
}

interface SynergySimulationTabProps {
  ingredients: Ingredient[]
  simulator: ReturnType<typeof useSynergySimulator>
}

interface SmartRecommendationsTabProps {
  data: FormulaTableData | null
  engine: ReturnType<typeof useIntelligentRecommendation>
}

const IngredientDeepDiveTab: React.FC<IngredientDeepDiveTabProps> = () => (
  <div className="text-center py-12 text-neutral-500">
    <Microscope className="w-12 h-12 mx-auto mb-3 opacity-50" />
    <p>成分深度分析模块开发中...</p>
    <p className="text-sm mt-2">将包含：成分画像、对比分析、智能推荐</p>
  </div>
)

const SynergySimulationTab: React.FC<SynergySimulationTabProps> = () => (
  <div className="text-center py-12 text-neutral-500">
    <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
    <p>协同效果模拟模块开发中...</p>
    <p className="text-sm mt-2">将包含：动态雷达图、时间轴预测、场景优化</p>
  </div>
)

const SmartRecommendationsTab: React.FC<SmartRecommendationsTabProps> = () => (
  <div className="text-center py-12 text-neutral-500">
    <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
    <p>智能推荐系统开发中...</p>
    <p className="text-sm mt-2">将包含：个性化配方、剂量优化、禁忌检测</p>
  </div>
)

export default EnhancedAIChatPanel
