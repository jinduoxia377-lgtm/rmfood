/**
 * 智能配方优化建议组件
 * 基于AI分析提供配方改进方向
 * 增强版：支持预览、确认、回退和历史记录
 */
import { useState, useMemo, useCallback, useEffect } from 'react'
import { Card } from '@/components/ui'
import {
  Lightbulb, TrendingUp, AlertTriangle, CheckCircle, DollarSign,
  Heart, RefreshCw, ChevronDown, ChevronUp, Sparkles,
  Eye, Undo2, Clock, X, Check, ArrowRight, AlertCircle,
} from 'lucide-react'

export interface OptimizationSuggestion {
  id: string
  type: 'ingredient' | 'dosage' | 'taste' | 'stability' | 'cost' | 'safety'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  expectedImprovement?: number
  currentValue?: string
  suggestedValue?: string
  reasoning?: string
  confidence: number
}

export interface SuggestionPreview {
  suggestionId: string
  changes: {
    field: string
    before: unknown
    after: unknown
  }[]
  estimatedScoreChange: {
    synergy?: number
    taste?: number
    stability?: number
    safety?: number
    overall?: number
  }
}

interface SuggestionHistoryEntry {
  id: string
  timestamp: number
  suggestion: OptimizationSuggestion
  changes: SuggestionPreview['changes']
  estimatedScoreChange: SuggestionPreview['estimatedScoreChange']
  reverted: boolean
}

interface FormulaData {
  formulaName: string
  effects: string[]
  ingredients: {
    name: string
    dosage: string
    role: string
  }[]
  scores: {
    synergy: number
    taste: number
    stability: number
    safety: number
    cost: number
    overall: number
  }
}

interface OptimizationAdvisorProps {
  formula: FormulaData
  onApplySuggestion?: (suggestion: OptimizationSuggestion) => void
  onApplyAll?: (suggestions: OptimizationSuggestion[]) => void
  onRevert?: (historyId: string, suggestion: OptimizationSuggestion) => void
}

const STORAGE_KEY = 'formula_suggestion_history'
const MAX_HISTORY_SIZE = 5

export function OptimizationAdvisor({
  formula,
  onApplySuggestion,
  onApplyAll,
  onRevert,
}: OptimizationAdvisorProps) {
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(new Set())
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set())
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewSuggestion, setPreviewSuggestion] = useState<OptimizationSuggestion | null>(null)
  const [confirmSuggestion, setConfirmSuggestion] = useState<OptimizationSuggestion | null>(null)
  const [suggestionHistory, setSuggestionHistory] = useState<SuggestionHistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SuggestionHistoryEntry[]
        setSuggestionHistory(parsed)
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  const saveHistory = useCallback((history: SuggestionHistoryEntry[]) => {
    const trimmed = history.slice(0, MAX_HISTORY_SIZE)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    setSuggestionHistory(trimmed)
  }, [])

  const generatePreview = useCallback((suggestion: OptimizationSuggestion): SuggestionPreview => {
    const changes: SuggestionPreview['changes'] = []
    let scoreChange: SuggestionPreview['estimatedScoreChange'] = {}

    switch (suggestion.type) {
      case 'ingredient':
        if (suggestion.suggestedValue) {
          changes.push({
            field: 'ingredients',
            before: formula.ingredients,
            after: [...formula.ingredients, { name: '甘草', dosage: '2g', role: '使药' }],
          })
        }
        scoreChange = { synergy: 0.15, overall: 0.12 }
        break
      case 'dosage':
        if (suggestion.suggestedValue && formula.ingredients.length > 0) {
          const newIngredients = [...formula.ingredients]
          newIngredients[0] = { ...newIngredients[0], dosage: suggestion.suggestedValue }
          changes.push({
            field: `ingredients.${formula.ingredients[0].name}.dosage`,
            before: formula.ingredients[0].dosage,
            after: suggestion.suggestedValue,
          })
        }
        scoreChange = { synergy: 0.12, overall: 0.08 }
        break
      case 'taste':
        if (suggestion.suggestedValue) {
          changes.push({
            field: 'ingredients',
            before: formula.ingredients,
            after: [...formula.ingredients, { name: '罗汉果', dosage: '0.5g', role: '矫味剂' }],
          })
        }
        scoreChange = { taste: 0.2, overall: 0.1 }
        break
      case 'stability':
        changes.push({
          field: 'scores.stability',
          before: formula.scores.stability,
          after: Math.min(1, formula.scores.stability + 0.18),
        })
        scoreChange = { stability: 0.18, overall: 0.1 }
        break
      case 'cost':
        if (suggestion.suggestedValue) {
          changes.push({
            field: 'estimatedCost',
            before: formula.scores.cost,
            after: 0.72,
          })
        }
        scoreChange = { overall: 0.05 }
        break
      case 'safety':
        changes.push({
          field: 'scores.safety',
          before: formula.scores.safety,
          after: Math.min(1, formula.scores.safety + 0.15),
        })
        scoreChange = { safety: 0.15, overall: 0.1 }
        break
    }

    if (suggestion.type === 'ingredient' && formula.effects.includes('补气')) {
      scoreChange = { synergy: 0.22, overall: 0.18 }
    }

    return {
      suggestionId: suggestion.id,
      changes,
      estimatedScoreChange: scoreChange,
    }
  }, [formula])

  const handlePreview = useCallback((suggestion: OptimizationSuggestion) => {
    setPreviewSuggestion(suggestion)
  }, [])

  const handleConfirm = useCallback((suggestion: OptimizationSuggestion) => {
    setConfirmSuggestion(suggestion)
    setPreviewSuggestion(null)
  }, [])

  const handleApplySuggestion = useCallback((suggestion: OptimizationSuggestion) => {
    const preview = generatePreview(suggestion)
    const historyEntry: SuggestionHistoryEntry = {
      id: `hist-${Date.now()}`,
      timestamp: Date.now(),
      suggestion,
      changes: preview.changes,
      estimatedScoreChange: preview.estimatedScoreChange,
      reverted: false,
    }

    const newHistory = [historyEntry, ...suggestionHistory].slice(0, MAX_HISTORY_SIZE)
    saveHistory(newHistory)

    setAppliedSuggestions((prev) => new Set(prev).add(suggestion.id))
    setConfirmSuggestion(null)
    onApplySuggestion?.(suggestion)
  }, [suggestionHistory, saveHistory, generatePreview, onApplySuggestion])

  const handleRevert = useCallback((historyId: string) => {
    const entry = suggestionHistory.find((h) => h.id === historyId)
    if (!entry) return

    saveHistory(suggestionHistory.map((h) =>
      h.id === historyId ? { ...h, reverted: true } : h,
    ))

    setAppliedSuggestions((prev) => {
      const next = new Set(prev)
      next.delete(entry.suggestion.id)
      return next
    })

    onRevert?.(historyId, entry.suggestion)
  }, [suggestionHistory, saveHistory, onRevert])

  const suggestions = useMemo(() => {
    const result: OptimizationSuggestion[] = []

    // 成分协同优化建议
    if (formula.ingredients.length > 1) {
      const herbNames = formula.ingredients.map(i => i.name)
      const hasLicorice = herbNames.some(name => name.includes('甘草'))
      const hasAstragalus = herbNames.some(name => name.includes('黄芪'))
      const hasGinseng = herbNames.some(name => name.includes('人参') || name.includes('党参'))

      if (!hasLicorice) {
        result.push({
          id: 'ing-1',
          type: 'ingredient',
          priority: 'high',
          title: '添加调和成分增强协同效应',
          description: '根据药食同源理论和传统方剂配伍原则，建议添加甘草作为调和成分。',
          expectedImprovement: 0.15,
          suggestedValue: '+2g 甘草',
          reasoning: '甘草具有"调和诸药"的核心作用，在中药方剂中被誉为"国老"，能够缓和烈性药物的毒性，协调各成分之间的作用，使配方整体功效更加协同一致。',
          confidence: 0.92,
        })
      }

      // 补气类配方优化
      if ((formula.effects.includes('补气') || formula.effects.includes('益气') || formula.effects.includes('健脾')) && !hasAstragalus) {
        result.push({
          id: 'ing-2',
          type: 'ingredient',
          priority: 'high',
          title: '强化补气核心成分',
          description: '针对补气功效，建议增加黄芪作为君药，增强配方核心功效。',
          expectedImprovement: 0.22,
          suggestedValue: '+3g 黄芪',
          reasoning: '黄芪为补气要药，归脾肺经，具有补气升阳、固表止汗、利水消肿等功效。现代研究表明黄芪多糖具有显著的免疫调节作用，是气虚调理的首选成分。',
          confidence: 0.91,
        })
      }

      // 补气配方辅助成分
      if ((formula.effects.includes('补气') || formula.effects.includes('益气')) && hasAstragalus && !hasGinseng) {
        result.push({
          id: 'ing-3',
          type: 'ingredient',
          priority: 'medium',
          title: '添加党参增强健脾益气',
          description: '黄芪配伍党参，形成经典的补气组合，增强健脾益气效果。',
          expectedImprovement: 0.18,
          suggestedValue: '+2g 党参',
          reasoning: '党参性味甘平，归脾肺经，与黄芪配伍可增强健脾益气功效。"黄芪补气走表，党参补气走里"，二者合用可全面调理气虚体质。',
          confidence: 0.88,
        })
      }
    }

    // 剂量优化建议
    const lowScoreIngredients = formula.ingredients.filter((_, i) => {
      const score = formula.scores.synergy * (1 - i * 0.1)
      return score < 0.6
    })
    if (lowScoreIngredients.length > 0) {
      const monarchHerb = formula.ingredients[0]
      result.push({
        id: 'dos-1',
        type: 'dosage',
        priority: 'high',
        title: '优化君药剂量比例',
        description: `建议提高${monarchHerb?.name || '君药'}的剂量比例，增强核心功效。`,
        currentValue: monarchHerb?.dosage || '1.0-2.0g',
        suggestedValue: '1.5-3.0g',
        expectedImprovement: 0.15,
        reasoning: '君药是配方的核心成分，其剂量直接决定配方的整体疗效。根据中药方剂配伍原则，君药剂量通常占配方总量的40%-60%，适当增加君药剂量可显著提升功效强度。',
        confidence: 0.85,
      })
    }

    // 君臣佐使配伍优化
    if (formula.ingredients.length >= 3) {
      const roles = formula.ingredients.map(i => i.role)
      const hasMonarch = roles.some(r => r.includes('君'))
      const hasMinister = roles.some(r => r.includes('臣'))
      const hasAssistant = roles.some(r => r.includes('佐'))

      if (!hasMonarch || !hasMinister || !hasAssistant) {
        result.push({
          id: 'dos-2',
          type: 'dosage',
          priority: 'medium',
          title: '优化君臣佐使配伍比例',
          description: '建议调整各成分剂量，明确君臣佐使关系，符合方剂配伍原则。',
          expectedImprovement: 0.12,
          suggestedValue: '君40%:臣30%:佐20%:使10%',
          reasoning: '中药方剂讲究"君、臣、佐、使"的配伍原则：君药起主要治疗作用，臣药辅助君药，佐药制约毒性或反佐，使药引导药力直达病所。合理的比例关系是配方疗效的关键。',
          confidence: 0.82,
        })
      }
    }

    // 口感优化建议
    if (formula.scores.taste < 0.7) {
      const bitterIngredients = formula.ingredients.filter(i =>
        ['黄连', '黄芩', '黄柏', '苦参', '龙胆草', '金银花', '连翘'].includes(i.name),
      )

      if (bitterIngredients.length > 0) {
        result.push({
          id: 'tas-1',
          type: 'taste',
          priority: 'high',
          title: '改善苦味口感',
          description: `检测到${bitterIngredients.length}种苦味成分，建议添加甜味调节剂改善适口性。`,
          expectedImprovement: 0.25,
          suggestedValue: '+1g 罗汉果或+0.5g 甜叶菊',
          reasoning: `配方中含有${bitterIngredients.map(i => i.name).join('、')}等苦味成分。罗汉果性凉味甘，不仅能有效掩盖苦味，还具有清热润肺的功效，与配方功效协同。甜叶菊是天然高甜度低热量甜味剂，用量少效果显著。`,
          confidence: 0.88,
        })
      } else {
        result.push({
          id: 'tas-2',
          type: 'taste',
          priority: 'medium',
          title: '优化风味协调性',
          description: '当前配方风味协调性不足，建议添加陈皮或山楂提升风味层次。',
          expectedImprovement: 0.18,
          suggestedValue: '+1.5g 陈皮',
          reasoning: '陈皮具有理气健脾、燥湿化痰的功效，其独特的柑橘香气能提升配方整体风味，掩盖异味，使口感更加圆润协调。',
          confidence: 0.82,
        })
      }
    }

    // 稳定性优化建议
    if (formula.scores.stability < 0.7) {
      const heatSensitiveIngredients = formula.ingredients.filter(i =>
        ['人参', '党参', '黄芪', '枸杞', '当归'].includes(i.name),
      )

      result.push({
        id: 'sta-1',
        type: 'stability',
        priority: 'high',
        title: '提升活性成分稳定性',
        description: `检测到${heatSensitiveIngredients.length}种热敏性成分，建议添加稳定剂或优化制剂工艺。`,
        expectedImprovement: 0.2,
        suggestedValue: '+0.5% HPMC',
        reasoning: `${heatSensitiveIngredients.map(i => i.name).join('、')}等成分中的多糖、皂苷等活性物质对温度和湿度敏感。添加羟丙基甲基纤维素(HPMC)作为稳定剂，可形成保护膜，显著提升产品保质期至24个月以上。`,
        confidence: 0.85,
      })
    }

    // 成本优化建议
    if (formula.scores.cost > 0.5) {
      const expensiveIngredients = formula.ingredients.filter(i =>
        ['人参', '鹿茸', '虫草', '燕窝', '阿胶'].includes(i.name),
      )

      if (expensiveIngredients.length > 0) {
        result.push({
          id: 'cos-1',
          type: 'cost',
          priority: 'medium',
          title: '优化成本结构',
          description: `检测到${expensiveIngredients.length}种高价成分，建议使用功效相近的替代成分。`,
          expectedImprovement: 0.25,
          currentValue: '高成本',
          suggestedValue: '中等成本',
          reasoning: `${expensiveIngredients.map(i => i.name).join('、')}等成分价格较高。建议用人参须替代人参主根（保留85%以上活性成分，成本降低60%），或用黄芪+党参组合替代部分人参用量。`,
          confidence: 0.78,
        })
      }
    }

    // 安全性优化建议
    if (formula.scores.safety < 0.8) {
      const cautionIngredients = formula.ingredients.filter(i =>
        ['附子', '川乌', '草乌', '半夏', '天南星', '细辛'].includes(i.name),
      )

      if (cautionIngredients.length > 0) {
        result.push({
          id: 'saf-1',
          type: 'safety',
          priority: 'high',
          title: '强化安全性控制',
          description: `检测到${cautionIngredients.length}种需要特别注意的成分，建议调整剂量或添加制约成分。`,
          expectedImprovement: 0.18,
          suggestedValue: '降低剂量或添加制约成分',
          reasoning: `${cautionIngredients.map(i => i.name).join('、')}等成分具有一定毒性或刺激性。根据中药"相反相成"理论，建议降低剂量至安全范围，或添加甘草等制约成分降低毒性。孕妇、儿童及体质虚弱者应避免使用。`,
          confidence: 0.92,
        })
      } else {
        result.push({
          id: 'saf-2',
          type: 'safety',
          priority: 'medium',
          title: '完善安全性评估',
          description: '建议增加过敏成分筛查和特殊人群禁忌标注。',
          expectedImprovement: 0.12,
          reasoning: '虽然当前配方成分相对安全，但建议增加过敏原检测（如大豆、花生、芝麻等），并针对孕妇、哺乳期妇女、儿童、肝肾功能不全者制定明确的使用禁忌和注意事项。',
          confidence: 0.85,
        })
      }
    }

    // 功效针对性优化
    if (formula.effects.includes('清热解毒') || formula.effects.includes('抗炎')) {
      const hasChrysanthemum = formula.ingredients.some(i => i.name.includes('菊花'))
      if (!hasChrysanthemum) {
        result.push({
          id: 'eff-1',
          type: 'ingredient',
          priority: 'medium',
          title: '增强清热解毒效果',
          description: '针对清热解毒功效，建议添加菊花增强疏风清热作用。',
          expectedImprovement: 0.16,
          suggestedValue: '+2g 菊花',
          reasoning: '菊花性微寒，具有疏风清热、平肝明目的功效。现代药理研究表明菊花提取物具有显著的抗炎、抗氧化活性，与清热解毒类配方配伍可增强整体疗效。',
          confidence: 0.86,
        })
      }
    }

    if (formula.effects.includes('滋阴') || formula.effects.includes('润燥')) {
      const hasLily = formula.ingredients.some(i => i.name.includes('百合'))
      if (!hasLily) {
        result.push({
          id: 'eff-2',
          type: 'ingredient',
          priority: 'medium',
          title: '增强滋阴润燥效果',
          description: '针对滋阴润燥功效，建议添加百合增强养阴润肺作用。',
          expectedImprovement: 0.15,
          suggestedValue: '+3g 百合',
          reasoning: '百合性味甘微寒，归心肺经，具有养阴润肺、清心安神的功效。其富含的百合多糖和皂苷具有良好的滋阴润燥作用，适合搭配麦冬、沙参等使用。',
          confidence: 0.84,
        })
      }
    }

    // 剂型适配建议
    if (formula.scores.taste < 0.6 && formula.scores.stability < 0.7) {
      result.push({
        id: 'form-1',
        type: 'ingredient',
        priority: 'medium',
        title: '建议采用胶囊或片剂剂型',
        description: '当前配方口感和稳定性均存在挑战，建议考虑改变剂型以提升产品适用性。',
        expectedImprovement: 0.22,
        suggestedValue: '胶囊/片剂剂型',
        reasoning: '胶囊或片剂剂型可有效掩盖苦味，提高成分稳定性，便于控制剂量和携带。对于含有热敏性成分的配方，建议采用低温压片或包衣技术。',
        confidence: 0.80,
      })
    }

    return result.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }, [formula])

  const handleApplyAll = useCallback(() => {
    const unapplied = suggestions.filter((s) => !appliedSuggestions.has(s.id))
    unapplied.forEach((s) => {
      const preview = generatePreview(s)
      const historyEntry: SuggestionHistoryEntry = {
        id: `hist-${Date.now()}-${s.id}`,
        timestamp: Date.now(),
        suggestion: s,
        changes: preview.changes,
        estimatedScoreChange: preview.estimatedScoreChange,
        reverted: false,
      }
      saveHistory([historyEntry, ...suggestionHistory].slice(0, MAX_HISTORY_SIZE))
      setAppliedSuggestions((prev) => new Set(prev).add(s.id))
    })
  }, [suggestions, appliedSuggestions, suggestionHistory, saveHistory, generatePreview])

  const toggleExpanded = useCallback((id: string) => {
    setExpandedSuggestions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const highPriorityCount = suggestions.filter((s) => s.priority === 'high' && !appliedSuggestions.has(s.id)).length
  const activeHistoryCount = suggestionHistory.filter((h) => !h.reverted).length

  return (
    <>
      <Card className="overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-warning-600 dark:text-warning-400" />
              <span className="font-medium text-warning-700 dark:text-warning-300">智能优化建议</span>
              <span className="text-xs px-1.5 py-0.5 bg-warning-100 dark:bg-warning-900/40 text-warning-700 dark:text-warning-400 rounded-full">
                {suggestions.length}条
              </span>
            </div>
            <div className="flex items-center gap-3">
              {highPriorityCount > 0 && (
                <span className="text-xs text-error-500">{highPriorityCount}条高优先级</span>
              )}
              {activeHistoryCount > 0 && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                >
                  <Clock className="w-3 h-3" />
                  历史({activeHistoryCount})
                </button>
              )}
            </div>
          </div>
        </div>

        {showHistory && suggestionHistory.length > 0 && (
          <SuggestionHistoryPanel
            history={suggestionHistory}
            onRevert={handleRevert}
            onClose={() => setShowHistory(false)}
          />
        )}

        {previewSuggestion && (
          <SuggestionPreviewPanel
            suggestion={previewSuggestion}
            preview={generatePreview(previewSuggestion)}
            formula={formula}
            onConfirm={() => handleConfirm(previewSuggestion)}
            onCancel={() => setPreviewSuggestion(null)}
          />
        )}

        {confirmSuggestion && (
          <SuggestionConfirmDialog
            suggestion={confirmSuggestion}
            preview={generatePreview(confirmSuggestion)}
            onConfirm={() => handleApplySuggestion(confirmSuggestion)}
            onCancel={() => setConfirmSuggestion(null)}
          />
        )}

        <div className="max-h-96 overflow-y-auto">
          {suggestions.length === 0 ? (
            <div className="p-6 text-center">
              <Sparkles className="w-8 h-8 text-warning-400 mx-auto mb-2" />
              <p className="text-sm text-neutral-600 dark:text-neutral-400">当前配方已接近最优</p>
              <p className="text-xs text-neutral-500 mt-1">暂无明显的优化空间</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {suggestions.map((suggestion) => (
                <SuggestionItem
                  key={suggestion.id}
                  suggestion={suggestion}
                  isExpanded={expandedSuggestions.has(suggestion.id)}
                  isApplied={appliedSuggestions.has(suggestion.id)}
                  onToggle={() => toggleExpanded(suggestion.id)}
                  onPreview={() => handlePreview(suggestion)}
                  onApply={() => handleConfirm(suggestion)}
                />
              ))}
            </div>
          )}
        </div>

        {suggestions.length > 0 && appliedSuggestions.size < suggestions.length && (
          <div className="p-3 border-t border-neutral-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800/50">
            <button
              onClick={handleApplyAll}
              disabled={appliedSuggestions.size === suggestions.length}
              className="w-full py-2 flex items-center justify-center gap-2 text-sm bg-warning-500 text-white rounded-lg hover:bg-warning-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4" />
              应用全部建议 ({suggestions.length - appliedSuggestions.size}条)
            </button>
          </div>
        )}
      </Card>
    </>
  )
}

interface SuggestionItemProps {
  suggestion: OptimizationSuggestion
  isExpanded: boolean
  isApplied: boolean
  onToggle: () => void
  onPreview: () => void
  onApply: () => void
}

function SuggestionItem({ suggestion, isExpanded, isApplied, onToggle, onPreview, onApply }: SuggestionItemProps) {
  const TypeIcon = {
    ingredient: Heart,
    dosage: TrendingUp,
    taste: Heart,
    stability: AlertTriangle,
    cost: DollarSign,
    safety: AlertTriangle,
  }[suggestion.type]

  const TypeColor = {
    ingredient: 'text-rose-500',
    dosage: 'text-secondary-500',
    taste: 'text-pink-500',
    stability: 'text-warning-500',
    cost: 'text-success-500',
    safety: 'text-error-500',
  }[suggestion.type]

  const PriorityBadge = {
    high: { label: '高', class: 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-400' },
    medium: { label: '中', class: 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-400' },
    low: { label: '低', class: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' },
  }[suggestion.priority]

  return (
    <div className={`transition-colors ${isApplied ? 'bg-success-50 dark:bg-success-900/10' : ''}`}>
      <div
        className="px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800/50"
        onClick={onToggle}
      >
        <div className={`w-8 h-8 rounded-lg ${isApplied ? 'bg-success-100' : 'bg-neutral-100 dark:bg-neutral-800'} flex items-center justify-center shrink-0`}>
          {isApplied ? (
            <CheckCircle className="w-4 h-4 text-success-500" />
          ) : (
            <TypeIcon className={`w-4 h-4 ${TypeColor}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-1.5 py-0.5 rounded ${PriorityBadge.class}`}>
              {PriorityBadge.label}
            </span>
            <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{suggestion.title}</h4>
          </div>

          <p className="text-xs text-neutral-500 line-clamp-2">{suggestion.description}</p>

          {suggestion.expectedImprovement && (
            <div className="flex items-center gap-1 mt-1.5">
              <TrendingUp className="w-3 h-3 text-success-500" />
              <span className="text-xs text-success-600 dark:text-success-400">
                预期提升: +{(suggestion.expectedImprovement * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}

          {!isApplied && (
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onPreview()
                }}
                className="px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors flex items-center gap-1"
              >
                <Eye className="w-3 h-3" />
                预览
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onApply()
                }}
                className="px-2 py-1 text-xs bg-warning-100 dark:bg-warning-900/40 text-warning-700 dark:text-warning-400 rounded hover:bg-warning-200 dark:hover:bg-warning-900/60 transition-colors"
              >
                应用
              </button>
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-3 pl-14 animate-fade-in">
          <div className="p-3 bg-slate-50 dark:bg-neutral-800/50 rounded-lg space-y-2">
            {suggestion.currentValue && suggestion.suggestedValue && (
              <div>
                <span className="text-xs text-neutral-500">调整建议：</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-error-500 line-through">{suggestion.currentValue}</span>
                  <span className="text-neutral-400">→</span>
                  <span className="text-xs text-success-500 font-medium">{suggestion.suggestedValue}</span>
                </div>
              </div>
            )}

            {suggestion.reasoning && (
              <div>
                <span className="text-xs text-neutral-500">优化原理：</span>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{suggestion.reasoning}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-700">
              <span className="text-xs text-neutral-500">置信度</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full"
                    style={{ width: `${suggestion.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
                  {(suggestion.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface SuggestionPreviewPanelProps {
  suggestion: OptimizationSuggestion
  preview: SuggestionPreview
  formula: FormulaData
  onConfirm: () => void
  onCancel: () => void
}

function SuggestionPreviewPanel({ suggestion, preview, formula, onConfirm, onCancel }: SuggestionPreviewPanelProps) {
  return (
    <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 bg-secondary-50 dark:bg-secondary-900/20 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-secondary-500" />
          <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">效果预览</span>
        </div>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-secondary-100 dark:hover:bg-secondary-900/40 rounded"
        >
          <X className="w-4 h-4 text-neutral-400" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="p-3 bg-white dark:bg-neutral-800 rounded-lg">
          <p className="text-xs text-neutral-500 mb-2">将要应用的更改：</p>
          <div className="space-y-2">
            {preview.changes.map((change, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="text-neutral-600 dark:text-neutral-400 w-24 truncate">{change.field}</span>
                <span className="text-error-500 line-through">
                  {typeof change.before === 'object' ? JSON.stringify(change.before).slice(0, 30) + '...' : typeof change.before === 'string' ? change.before : String(change.before)}
                </span>
                <ArrowRight className="w-3 h-3 text-neutral-400" />
                <span className="text-success-500">
                  {typeof change.after === 'object' ? JSON.stringify(change.after).slice(0, 30) + '...' : typeof change.after === 'string' ? change.after : String(change.after)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-neutral-800 rounded-lg">
          <p className="text-xs text-neutral-500 mb-2">预估评分变化：</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(preview.estimatedScoreChange).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  {key === 'synergy' ? '协同' : key === 'taste' ? '口感' : key === 'stability' ? '稳定' : '综合'}
                </span>
                <span className={`text-xs font-medium ${value && value > 0 ? 'text-success-500' : 'text-error-500'}`}>
                  {value && value > 0 ? '+' : ''}{(value * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs bg-warning-500 text-white rounded hover:bg-warning-600"
          >
            确认应用
          </button>
        </div>
      </div>
    </div>
  )
}

interface SuggestionConfirmDialogProps {
  suggestion: OptimizationSuggestion
  preview: SuggestionPreview
  onConfirm: () => void
  onCancel: () => void
}

function SuggestionConfirmDialog({ suggestion, preview, onConfirm, onCancel }: SuggestionConfirmDialogProps) {
  const isSafetyRelated = suggestion.type === 'safety' || suggestion.priority === 'high'

  return (
    <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 bg-warning-50 dark:bg-warning-900/20 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-warning-500" />
          <span className="text-sm font-medium text-warning-700 dark:text-warning-300">确认应用建议</span>
        </div>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-warning-100 dark:hover:bg-warning-900/40 rounded"
        >
          <X className="w-4 h-4 text-neutral-400" />
        </button>
      </div>

      {isSafetyRelated && (
        <div className="mb-3 p-2 bg-error-100 dark:bg-error-900/40 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-error-500 mt-0.5 shrink-0" />
          <p className="text-xs text-error-700 dark:text-error-300">
            此建议涉及安全性或高优先级更改，请确认后再应用。
          </p>
        </div>
      )}

      <div className="p-3 bg-white dark:bg-neutral-800 rounded-lg mb-3">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">{suggestion.title}</p>
        <p className="text-xs text-neutral-500">{suggestion.description}</p>
      </div>

      <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400 mb-3">
        <Check className="w-3 h-3 text-success-500" />
        <span>应用后可从历史记录回退</span>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
        >
          取消
        </button>
        <button
          onClick={onConfirm}
          className="px-3 py-1.5 text-xs bg-success-500 text-white rounded hover:bg-success-600 flex items-center gap-1"
        >
          <Check className="w-3 h-3" />
          确认应用
        </button>
      </div>
    </div>
  )
}

interface SuggestionHistoryPanelProps {
  history: SuggestionHistoryEntry[]
  onRevert: (historyId: string) => void
  onClose: () => void
}

function SuggestionHistoryPanel({ history, onRevert, onClose }: SuggestionHistoryPanelProps) {
  return (
    <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">建议历史</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded"
        >
          <X className="w-4 h-4 text-neutral-400" />
        </button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {history.map((entry) => (
          <div
            key={entry.id}
            className={`p-3 rounded-lg ${
              entry.reverted
                ? 'bg-neutral-100 dark:bg-neutral-700/50 opacity-60'
                : 'bg-white dark:bg-neutral-800'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {entry.reverted && (
                    <span className="text-xs px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-600 text-neutral-500 dark:text-neutral-400 rounded">
                      已回退
                    </span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    entry.suggestion.priority === 'high'
                      ? 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-400'
                      : entry.suggestion.priority === 'medium'
                      ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-400'
                      : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'
                  }`}>
                    {entry.suggestion.priority === 'high' ? '高' : entry.suggestion.priority === 'medium' ? '中' : '低'}
                  </span>
                  <span className="text-xs text-neutral-500 truncate">{entry.suggestion.title}</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  {new Date(entry.timestamp).toLocaleString('zh-CN')}
                </p>
              </div>

              {!entry.reverted && (
                <button
                  onClick={() => onRevert(entry.id)}
                  className="p-1.5 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded flex items-center gap-1"
                >
                  <Undo2 className="w-3 h-3" />
                  回退
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ScoreInterpretationProps {
  scores: FormulaData['scores']
}

export function ScoreInterpretation({ scores }: ScoreInterpretationProps) {
  const dimensions = [
    { key: 'synergy', label: '协同效应', icon: Heart, color: 'rose' },
    { key: 'taste', label: '口感风味', icon: Heart, color: 'pink' },
    { key: 'stability', label: '稳定性', icon: AlertTriangle, color: 'amber' },
    { key: 'safety', label: '安全性', icon: AlertTriangle, color: 'red' },
    { key: 'cost', label: '成本效益', icon: DollarSign, color: 'green' },
    { key: 'overall', label: '综合评分', icon: Sparkles, color: 'primary' },
  ] as const

  const getScoreLevel = (score: number) => {
    if (score >= 0.8) return { label: '优秀', class: 'text-success-600 dark:text-success-400' }
    if (score >= 0.6) return { label: '良好', class: 'text-secondary-600 dark:text-secondary-400' }
    if (score >= 0.4) return { label: '一般', class: 'text-warning-600 dark:text-warning-400' }
    return { label: '需改进', class: 'text-error-600 dark:text-error-400' }
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-4">评分解读</h3>

      <div className="space-y-3">
        {dimensions.map(({ key, label, icon: Icon, color }) => {
          const score = scores[key]
          const level = getScoreLevel(score)
          const colorClass = `text-${color}-500`

          return (
            <div key={key} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg bg-${color}-100 dark:bg-${color}-900/20 flex items-center justify-center`}>
                <Icon className={`w-4 h-4 text-${color}-500`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-neutral-600 dark:text-neutral-400">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${level.class}`}>{level.label}</span>
                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      {score.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-${color}-500 rounded-full transition-all duration-500`}
                    style={{ width: `${score * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
        <div className="flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-primary-500 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-primary-700 dark:text-primary-300">优化建议</p>
            <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">
              配方整体表现良好，建议重点关注口感优化，可通过添加天然甜味剂提升适口性。
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
