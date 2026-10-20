/**
 * 配方成本计算组件
 * 计算成分成本、营养分析和用量优化建议
 */
import { Calculator, AlertCircle, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Badge, Progress } from '@/components/ui'

interface IngredientCost {
  name: string
  dosage: string
  estimatedCost: number
  category: string
  isFoodHomology: boolean
}

interface FormulaCostAnalysisProps {
  ingredients: IngredientCost[]
  totalWeight: number
  onCostOptimization?: (suggestions: string[]) => void
}

// 模拟药材价格数据 (元/克)
const INGREDIENT_PRICES: Record<string, number> = {
  '枸杞': 0.15,
  '山药': 0.08,
  '黄芪': 0.25,
  '党参': 0.20,
  '当归': 0.30,
  '川芎': 0.18,
  '白术': 0.12,
  '茯苓': 0.10,
  '甘草': 0.08,
  '蜂蜜': 0.05,
  '红枣': 0.06,
  '生姜': 0.03,
  'default': 0.10,
}

// 模拟营养成分数据 (每克含量)
const NUTRITION_DATA: Record<string, { calories: number; protein: number; fiber: number }> = {
  'default': { calories: 0.3, protein: 0.01, fiber: 0.02 },
}

export function FormulaCostAnalysis({ ingredients = [], totalWeight = 0 }: FormulaCostAnalysisProps) {
  // 处理空状态
  if (!ingredients || ingredients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle as="h3" className="text-base flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[var(--color-primary-text)]0" />
            成本与营养分析
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-[var(--radius-pill)] bg-[var(--bg-tertiary)] flex items-center justify-center">
              <Calculator size={24} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
            </div>
            <h4 className="text-lg font-medium text-[var(--text-primary)]">
              暂无成分数据
            </h4>
            <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] max-w-md">
              请添加配方成分后查看成本与营养分析
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 计算总成本和明细
  const breakdown = ingredients.map(ing => {
    const pricePerGram = INGREDIENT_PRICES[ing.name] || INGREDIENT_PRICES.default
    const weight = parseFloat(ing.dosage) || 0
    const cost = pricePerGram * weight

    return {
      ...ing,
      estimatedCost: cost,
      pricePerGram,
      costRatio: 0,
    }
  })

  // 计算总成本
  const totalCost = breakdown.reduce((sum, item) => sum + item.estimatedCost, 0)

  // 计算成本占比
  breakdown.forEach(item => {
    item.costRatio = totalCost > 0 ? (item.estimatedCost / totalCost) * 100 : 0
  })

  // 按成本排序
  breakdown.sort((a, b) => b.estimatedCost - a.estimatedCost)

  // 计算营养成分
  let totalCalories = 0
  let totalProtein = 0
  let totalFiber = 0

  ingredients.forEach(ing => {
    const weight = parseFloat(ing.dosage) || 0
    const nutrition = NUTRITION_DATA[ing.name] || NUTRITION_DATA.default

    totalCalories += nutrition.calories * weight
    totalProtein += nutrition.protein * weight
    totalFiber += nutrition.fiber * weight
  })

  // 成本优化建议
  const suggestions: string[] = []

  if (totalCost > 100) {
    suggestions.push('配方总成本较高，可考虑用价格相近的替代药材降低成本')
  }

  if (breakdown.length > 0) {
    const expensiveIngredients = breakdown.filter(
      item => item.costRatio > 40,
    )
    if (expensiveIngredients.length > 0) {
      suggestions.push(`${expensiveIngredients[0].name}占总成本的${Math.round(expensiveIngredients[0].costRatio)}%，可考虑优化用量`)
    }
  }

  if (ingredients.length > 10) {
    suggestions.push('成分种类较多，可考虑精简配方，保留核心功效成分')
  }

  if (ingredients.length >= 4) {
    const noRoleIngredients = ingredients.filter(ing =>
      !ing.name && ingredients.indexOf(ing) < 4,
    )
    if (noRoleIngredients.length === 0) {
      suggestions.push('建议明确君臣佐使的角色分配，优化配方结构')
    }
  }

  // 成本评级
  const avgCost = totalWeight > 0 ? totalCost / totalWeight : 0
  const costLevel = avgCost <= 0.05
    ? { level: 'low', label: '低成本', color: 'success' as const }
    : avgCost <= 0.15
    ? { level: 'medium', label: '中等成本', color: 'warning' as const }
    : { level: 'high', label: '高成本', color: 'danger' as const }

  // 营养分析结果
  const nutritionAnalysis = {
    calories: Math.round(totalCalories * 10) / 10,
    protein: Math.round(totalProtein * 100) / 100,
    fiber: Math.round(totalFiber * 100) / 100,
    caloriesPer100g: totalWeight > 0 ? Math.round((totalCalories / totalWeight) * 1000) / 10 : 0,
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle as="h3" className="text-base flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[var(--color-primary-text)]0" />
            成本与营养分析
          </CardTitle>
          <Badge variant={costLevel.color} size="sm">
            {costLevel.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 成本概览 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-apple-sm)]">
          <div className="text-center p-[var(--space-apple-sm)] bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-md)]">
            <div className="text-xl font-bold text-[var(--text-primary)]">
              ¥{Math.round(totalCost * 100) / 100}
            </div>
            <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">总成本</div>
          </div>
          <div className="text-center p-[var(--space-apple-sm)] bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-md)]">
            <div className="text-xl font-bold text-[var(--text-primary)]">
              ¥{Math.round(avgCost * 1000) / 1000}
            </div>
            <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">元/克</div>
          </div>
          <div className="text-center p-[var(--space-apple-sm)] bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-md)]">
            <div className="text-xl font-bold text-[var(--text-primary)]">
              {totalWeight}g
            </div>
            <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">总重量</div>
          </div>
        </div>

        {/* 营养概览 */}
        <div className="p-[var(--space-apple-md)] bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/15 rounded-[var(--radius-Apple-md)] border border-[var(--color-success-border)] dark:border-[var(--color-success)]">
          <h4 className="text-sm font-medium text-[var(--color-success-text)] dark:text-[var(--color-success-text)] mb-[var(--space-apple-sm)]">
            营养成分估算
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">热量</span>
                <span className="font-medium text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">
                  {nutritionAnalysis.calories} kcal
                </span>
              </div>
              <Progress value={Math.min((nutritionAnalysis.calories / 500) * 100, 100)} variant="success" className="h-1.5" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">蛋白质</span>
                <span className="font-medium text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">
                  {nutritionAnalysis.protein}g
                </span>
              </div>
              <Progress value={Math.min((nutritionAnalysis.protein / 20) * 100, 100)} variant="success" className="h-1.5" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">膳食纤维</span>
                <span className="font-medium text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">
                  {nutritionAnalysis.fiber}g
                </span>
              </div>
              <Progress value={Math.min((nutritionAnalysis.fiber / 10) * 100, 100)} variant="success" className="h-1.5" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">每100g热量</span>
                <span className="font-medium text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">
                  {nutritionAnalysis.caloriesPer100g} kcal
                </span>
              </div>
              <Progress value={Math.min((nutritionAnalysis.caloriesPer100g / 300) * 100, 100)} variant="success" className="h-1.5" />
            </div>
          </div>
        </div>

        {/* 成本分解 */}
        {breakdown.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-apple-sm)]">
              成本分解
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {breakdown.map((item, index) => (
                <div key={index} className="flex items-center gap-[var(--space-apple-sm)]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {item.name || '未知成分'}
                      </span>
                      {item.isFoodHomology && (
                        <Badge variant="success" size="sm">药食同源</Badge>
                      )}
                    </div>
                    <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{item.dosage || '未知用量'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-[var(--text-primary)]">
                      ¥{item.estimatedCost.toFixed(2)}
                    </div>
                    <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      {item.costRatio.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 优化建议 */}
        {suggestions.length > 0 && (
          <div className="border-t border-[var(--border-color)] pt-[var(--space-apple-md)]">
            <h4 className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-apple-sm)] flex items-center gap-2">
              <Info size={14} className="text-[var(--color-secondary-text)]0" />
              优化建议
            </h4>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-2 bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/15 rounded-[var(--radius-Apple-sm)] text-sm"
                >
                  <AlertCircle size={14} className="text-[var(--color-secondary-text)]0 mt-0.5 shrink-0" />
                  <span className="text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]">{suggestion}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
