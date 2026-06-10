/**
 * 配方对比组件
 * 左右对比两个配方的成分、功效、参数等差异
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { formulaApi } from '@/api/formula'
import { StatusBadge, Skeleton } from '@/components/ui/Common'
import { Badge, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { CompositionChart } from './CompositionChart'
import { cn } from '@/lib/utils'

interface FormulaCompareProps {
  leftId: number | null
  rightId: number | null
}

interface ParsedIngredient {
  name: string
  category: string
  dosage: string
  role: string
  is_food_homology: boolean
}

interface ParsedFormula {
  id: number
  name: string
  code: string
  status: string
  description: string | null
  target_effects: string[]
  dosage: string | null
  processing_method: string | null
  storage_conditions: string | null
  shelf_life: number | null
  safety_check: Record<string, unknown> | null
  synergy_analysis: Record<string, unknown> | null
  ingredients: ParsedIngredient[]
}

function parseFormula(formula: any): ParsedFormula | null {
  if (!formula) return null
  const comp = formula.composition || {}
  const list = Array.isArray(comp.ingredients) ? comp.ingredients :
               Array.isArray(comp.components) ? comp.components : []
  return {
    id: formula.id,
    name: formula.name,
    code: formula.code,
    status: formula.status,
    description: formula.description,
    target_effects: formula.target_effects || [],
    dosage: formula.dosage,
    processing_method: formula.processing_method,
    storage_conditions: formula.storage_conditions,
    shelf_life: formula.shelf_life,
    safety_check: formula.safety_check,
    synergy_analysis: formula.synergy_analysis,
    ingredients: list.map((item: any, idx: number) => ({
      name: item.name || item.name_cn || `成分${idx + 1}`,
      category: item.category || item.classification || '-',
      dosage: item.dosage || item.amount || '-',
      role: item.role || '',
      is_food_homology: item.is_food_homology === true || item.is_medical_food === true,
    })),
  }
}

function parseSafety(formula: ParsedFormula | null): { passed: boolean | null; summary: string } {
  if (!formula?.safety_check || typeof formula.safety_check !== 'object') return { passed: null, summary: '' }
  const sc = formula.safety_check
  return {
    passed: (sc.passed ?? sc.is_passed ?? null) as boolean | null,
    summary: (sc.summary ?? '') as string,
  }
}

function parseSynergy(formula: ParsedFormula | null): number | null {
  if (!formula?.synergy_analysis || typeof formula.synergy_analysis !== 'object') return null
  const sa = formula.synergy_analysis
  return (sa.score ?? sa.overall_score ?? null) as number | null
}

export function FormulaCompare({ leftId, rightId }: FormulaCompareProps) {
  const { data: leftRaw, isLoading: leftLoading } = useQuery({
    queryKey: ['formula', leftId],
    queryFn: () => formulaApi.get(leftId!),
    enabled: !!leftId,
  })
  const { data: rightRaw, isLoading: rightLoading } = useQuery({
    queryKey: ['formula', rightId],
    queryFn: () => formulaApi.get(rightId!),
    enabled: !!rightId,
  })

  const left = parseFormula(leftRaw)
  const right = parseFormula(rightRaw)

  // 成分对比分析
  const ingredientsComparison = useMemo(() => {
    if (!left && !right) return { onlyLeft: [], onlyRight: [], shared: [] }
    const leftNames = new Set(left?.ingredients.map(i => i.name) || [])
    const rightNames = new Set(right?.ingredients.map(i => i.name) || [])
    const shared = left?.ingredients.filter(i => rightNames.has(i.name)).map(i => i.name) || []
    const onlyLeft = left?.ingredients.filter(i => !rightNames.has(i.name)).map(i => i.name) || []
    const onlyRight = right?.ingredients.filter(i => !leftNames.has(i.name)).map(i => i.name) || []
    return { onlyLeft, onlyRight, shared }
  }, [left, right])

  // 功效对比
  const effectsComparison = useMemo(() => {
    if (!left && !right) return { onlyLeft: [], onlyRight: [], shared: [] }
    const leftSet = new Set(left?.target_effects || [])
    const rightSet = new Set(right?.target_effects || [])
    const shared = [...leftSet].filter(e => rightSet.has(e))
    const onlyLeft = [...leftSet].filter(e => !rightSet.has(e))
    const onlyRight = [...rightSet].filter(e => !leftSet.has(e))
    return { onlyLeft, onlyRight, shared }
  }, [left, right])

  if (!leftId && !rightId) {
    return (
      <div className="text-center py-12">
        <Sparkles size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-slate-500">请从配方列表中选择两个配方进行对比</p>
        <p className="text-xs text-slate-400 mt-1">点击配方卡片上的对比按钮，或在配方详情页点击「对比」</p>
      </div>
    )
  }

  const leftSafety = parseSafety(left)
  const rightSafety = parseSafety(right)
  const leftSynergy = parseSynergy(left)
  const rightSynergy = parseSynergy(right)

  return (
    <div className="space-y-4">
      {/* 对比概览 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 左侧 */}
        <Card className={cn('overflow-hidden', leftId ? '' : 'opacity-50')}>
          <CardContent className="p-3">
            {leftLoading ? (
              <Skeleton className="h-5 w-28 mb-1.5" />
            ) : left ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Link to={`/formulas/${left.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-primary-600">
                    {left.name}
                  </Link>
                  <StatusBadge status={left.status} />
                </div>
                <p className="text-sm text-slate-500">{left.code}</p>
              </>
            ) : (
              <p className="text-slate-400">选择配方 A</p>
            )}
          </CardContent>
        </Card>

        <Card className={cn('overflow-hidden', rightId ? '' : 'opacity-50')}>
          <CardContent className="p-3">
            {rightLoading ? (
              <Skeleton className="h-5 w-28 mb-1.5" />
            ) : right ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Link to={`/formulas/${right.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-primary-600">
                    {right.name}
                  </Link>
                  <StatusBadge status={right.status} />
                </div>
                <p className="text-sm text-slate-500">{right.code}</p>
              </>
            ) : (
              <p className="text-slate-400">选择配方 B</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 指标对比 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1.5">安全检查</p>
          <div className="flex justify-center gap-3">
            <span className={leftSafety.passed === true ? 'text-green-500' : leftSafety.passed === false ? 'text-red-500' : 'text-slate-400'}>
              {leftSafety.passed === null ? '-' : leftSafety.passed ? '通过' : '未通过'}
            </span>
            <span className="text-slate-300">vs</span>
            <span className={rightSafety.passed === true ? 'text-green-500' : rightSafety.passed === false ? 'text-red-500' : 'text-slate-400'}>
              {rightSafety.passed === null ? '-' : rightSafety.passed ? '通过' : '未通过'}
            </span>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1.5">协同评分</p>
          <div className="flex justify-center gap-3">
            <span className="text-lg font-semibold text-primary-600">{leftSynergy ?? '-'}</span>
            <span className="text-slate-300">vs</span>
            <span className="text-lg font-semibold text-primary-600">{rightSynergy ?? '-'}</span>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1.5">成分数量</p>
          <div className="flex justify-center gap-3">
            <span className="text-lg font-semibold text-slate-700 dark:text-slate-300">{left?.ingredients.length ?? 0}</span>
            <span className="text-slate-300">vs</span>
            <span className="text-lg font-semibold text-slate-700 dark:text-slate-300">{right?.ingredients.length ?? 0}</span>
          </div>
        </div>
      </div>

      {/* 成分对比 */}
      <Card>
        <CardHeader className="py-2.5 px-3">
          <CardTitle as="h3" className="text-sm">成分对比</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-3">
          {ingredientsComparison.shared.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">共同成分</span>
                <Badge variant="primary" size="sm">{ingredientsComparison.shared.length}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ingredientsComparison.shared.map(name => (
                  <Badge key={name} variant="primary" size="sm">{name}</Badge>
                ))}
              </div>
            </div>
          )}

          {(ingredientsComparison.onlyLeft.length > 0 || ingredientsComparison.onlyRight.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">配方 A 独有</span>
                  <Badge variant="info" size="sm">{ingredientsComparison.onlyLeft.length}</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ingredientsComparison.onlyLeft.map(name => (
                    <Badge key={name} variant="info" size="sm">{name}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">配方 B 独有</span>
                  <Badge variant="warning" size="sm">{ingredientsComparison.onlyRight.length}</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ingredientsComparison.onlyRight.map(name => (
                    <Badge key={name} variant="warning" size="sm">{name}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 成分可视化 */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-500 mb-2">配方 A 成分分布</p>
              {left && left.ingredients.length > 0 ? (
                <CompositionChart ingredients={left.ingredients} compact />
              ) : (
                <p className="text-sm text-slate-400">暂无数据</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2">配方 B 成分分布</p>
              {right && right.ingredients.length > 0 ? (
                <CompositionChart ingredients={right.ingredients} compact />
              ) : (
                <p className="text-sm text-slate-400">暂无数据</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 功效对比 */}
      <Card>
        <CardHeader className="py-2.5 px-3">
          <CardTitle as="h3" className="text-sm">功效对比</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-slate-500 mb-1.5">配方 A 独有</p>
              <div className="flex flex-wrap gap-1">
                {effectsComparison.onlyLeft.length > 0 ? effectsComparison.onlyLeft.map(e => (
                  <Badge key={e} variant="info" size="sm">{e}</Badge>
                )) : <span className="text-xs text-slate-400">无</span>}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1.5">共同功效</p>
              <div className="flex flex-wrap gap-1">
                {effectsComparison.shared.length > 0 ? effectsComparison.shared.map(e => (
                  <Badge key={e} variant="primary" size="sm">{e}</Badge>
                )) : <span className="text-xs text-slate-400">无</span>}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1.5">配方 B 独有</p>
              <div className="flex flex-wrap gap-1">
                {effectsComparison.onlyRight.length > 0 ? effectsComparison.onlyRight.map(e => (
                  <Badge key={e} variant="warning" size="sm">{e}</Badge>
                )) : <span className="text-xs text-slate-400">无</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 描述对比 */}
      {left?.description && right?.description && (
        <Card>
          <CardHeader className="py-2.5 px-3">
            <CardTitle as="h3" className="text-sm">配方描述对比</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5">
                <p className="text-xs text-slate-500 mb-1">{left.name}</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{left.description}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5">
                <p className="text-xs text-slate-500 mb-1">{right.name}</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{right.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
