/**
 * 配方对比组件
 * 左右对比两个配方的成分、功效、参数等差异
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, FlaskConical } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { formulaApi } from '@/api/formula'
import { StatusBadge, Skeleton } from '@/components/ui/Common'
import { Badge, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { CompositionChart } from './CompositionChart'
import { cn } from '@/lib/utils'


/** 配方对比评估数据 */
interface FormulaCompareData {
  risk_factors?: string[]
  passed_checks?: number
  total_checks?: number
  error_count?: number
}

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
  const [showAnalysis, setShowAnalysis] = useState(false)

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

  // 加载分析缓存
  const { data: leftSynergyData } = useQuery({
    queryKey: ['formula-analysis', leftId, 'synergy'],
    queryFn: () => formulaApi.analyzeFormulaSynergy(leftId!),
    enabled: !!leftId && showAnalysis,
    staleTime: 5 * 60 * 1000,
  })
  const { data: rightSynergyData } = useQuery({
    queryKey: ['formula-analysis', rightId, 'synergy'],
    queryFn: () => formulaApi.analyzeFormulaSynergy(rightId!),
    enabled: !!rightId && showAnalysis,
    staleTime: 5 * 60 * 1000,
  })
  const { data: leftStabilityData } = useQuery({
    queryKey: ['formula-analysis', leftId, 'stability'],
    queryFn: () => formulaApi.predictFormulaStability(leftId!),
    enabled: !!leftId && showAnalysis,
    staleTime: 5 * 60 * 1000,
  })
  const { data: rightStabilityData } = useQuery({
    queryKey: ['formula-analysis', rightId, 'stability'],
    queryFn: () => formulaApi.predictFormulaStability(rightId!),
    enabled: !!rightId && showAnalysis,
    staleTime: 5 * 60 * 1000,
  })
  const { data: leftTasteData } = useQuery({
    queryKey: ['formula-analysis', leftId, 'taste'],
    queryFn: () => formulaApi.predictFormulaTaste(leftId!),
    enabled: !!leftId && showAnalysis,
    staleTime: 5 * 60 * 1000,
  })
  const { data: rightTasteData } = useQuery({
    queryKey: ['formula-analysis', rightId, 'taste'],
    queryFn: () => formulaApi.predictFormulaTaste(rightId!),
    enabled: !!rightId && showAnalysis,
    staleTime: 5 * 60 * 1000,
  })
  const { data: leftCompatData } = useQuery({
    queryKey: ['formula-analysis', leftId, 'compat'],
    queryFn: () => formulaApi.checkFormulaCompatibility(leftId!),
    enabled: !!leftId && showAnalysis,
    staleTime: 5 * 60 * 1000,
  })
  const { data: rightCompatData } = useQuery({
    queryKey: ['formula-analysis', rightId, 'compat'],
    queryFn: () => formulaApi.checkFormulaCompatibility(rightId!),
    enabled: !!rightId && showAnalysis,
    staleTime: 5 * 60 * 1000,
  })
  const { data: leftSafetyData } = useQuery({
    queryKey: ['formula-analysis', leftId, 'safety'],
    queryFn: () => formulaApi.checkFormulaSafety(leftId!, { daily_dosage_g: 10, target_group: 'adult' }),
    enabled: !!leftId && showAnalysis,
    staleTime: 5 * 60 * 1000,
  })
  const { data: rightSafetyData } = useQuery({
    queryKey: ['formula-analysis', rightId, 'safety'],
    queryFn: () => formulaApi.checkFormulaSafety(rightId!, { daily_dosage_g: 10, target_group: 'adult' }),
    enabled: !!rightId && showAnalysis,
    staleTime: 5 * 60 * 1000,
  })

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
        <Sparkles size={48} className="mx-auto text-[var(--text-muted)] dark:text-[var(--text-muted)] mb-[var(--space-apple-sm)]" />
        <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">请从配方列表中选择两个配方进行对比</p>
        <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">点击配方卡片上的对比按钮，或在配方详情页点击「对比」</p>
      </div>
    )
  }

  const leftSafety = parseSafety(left)
  const rightSafety = parseSafety(right)
  const leftSynergy = parseSynergy(left)
  const rightSynergy = parseSynergy(right)

  return (
    <div className="space-y-[var(--space-apple-md)]">
      {/* 对比概览 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
        {/* 左侧 */}
        <Card className={cn('overflow-hidden', leftId ? '' : 'opacity-50')}>
          <CardContent className="p-[var(--space-apple-sm)]">
            {leftLoading ? (
              <Skeleton className="h-5 w-28 mb-1.5" />
            ) : left ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Link to={`/formulas/${left.id}`} className="font-semibold text-[var(--text-primary)] hover:text-[var(--color-primary-text)]">
                    {left.name}
                  </Link>
                  <StatusBadge status={left.status} />
                </div>
                <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{left.code}</p>
              </>
            ) : (
              <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">选择配方 A</p>
            )}
          </CardContent>
        </Card>

        <Card className={cn('overflow-hidden', rightId ? '' : 'opacity-50')}>
          <CardContent className="p-[var(--space-apple-sm)]">
            {rightLoading ? (
              <Skeleton className="h-5 w-28 mb-1.5" />
            ) : right ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Link to={`/formulas/${right.id}`} className="font-semibold text-[var(--text-primary)] hover:text-[var(--color-primary-text)]">
                    {right.name}
                  </Link>
                  <StatusBadge status={right.status} />
                </div>
                <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{right.code}</p>
              </>
            ) : (
              <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">选择配方 B</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 深度分析切换 */}
      {leftId && rightId && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowAnalysis((v) => !v)}
            className={`flex items-center gap-2 px-[var(--space-apple-md)] py-2 rounded-[var(--radius-Apple-sm)] text-sm font-medium transition-colors ${
              showAnalysis
                ? 'bg-[var(--color-accent-container)] dark:bg-[var(--color-accent-container)]/25 text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)] border border-[var(--color-accent-border)] dark:border-[var(--color-accent)]'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[var(--color-accent-border)] dark:hover:border-[var(--color-accent)]'
            }`}
          >
            <FlaskConical size={14} />
            {showAnalysis ? '隐藏深度分析' : '运行深度分析对比'}
          </button>
        </div>
      )}

      {/* 深度分析对比 */}
      {showAnalysis && leftId && rightId && (
        <div className="space-y-[var(--space-apple-md)]">
          {/* 协同效应对比 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
            {[
              { data: leftSynergyData, label: left?.name ?? 'A', loading: false },
              { data: rightSynergyData, label: right?.name ?? 'B', loading: false },
            ].map(({ data, label }) => (
              <div key={label} className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] p-[var(--space-apple-md)] bg-[var(--bg-secondary)]">
                <p className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2">{label} · 协同效应</p>
                {data ? (
                  <div>
                    <p className="text-2xl font-bold text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]">
                      {data.overall_si?.toFixed(2) ?? '—'}
                    </p>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">{data.pairs?.length ?? 0} 个成分对</p>
                  </div>
                ) : (
                  <Skeleton className="h-6 w-16" />
                )}
              </div>
            ))}
          </div>

          {/* 稳定性对比 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
            {[
              { data: leftStabilityData, label: left?.name ?? 'A' },
              { data: rightStabilityData, label: right?.name ?? 'B' },
            ].map(({ data, label }) => (
              <div key={label} className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] p-[var(--space-apple-md)] bg-[var(--bg-secondary)]">
                <p className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2">{label} · 稳定性</p>
                {data ? (
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">
                      {data.stability_score?.toFixed(0) ?? '—'}/100
                    </p>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      预测货架期: {data.predicted_shelf_life_months?.toFixed(0) ?? '—'} 月
                    </p>
                    {((data as FormulaCompareData)?.risk_factors?.length ?? 0) > 0 && (
                      <p className="text-xs text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]">
                        ⚠ {(data as FormulaCompareData)?.risk_factors?.length} 个风险因素
                      </p>
                    )}
                  </div>
                ) : (
                  <Skeleton className="h-6 w-20" />
                )}
              </div>
            ))}
          </div>

          {/* 风味对比 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
            {[
              { data: leftTasteData, label: left?.name ?? 'A' },
              { data: rightTasteData, label: right?.name ?? 'B' },
            ].map(({ data, label }) => (
              <div key={label} className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] p-[var(--space-apple-md)] bg-[var(--bg-secondary)]">
                <p className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2">{label} · 风味</p>
                {data ? (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {(['bitter', 'sweet', 'umami', 'astringent', 'sour'] as const).map((k) => {
                        const val = data.taste_profile?.[k] ?? 0
                        const colors: Record<string, string> = {
                          bitter: 'bg-danger-400', sweet: 'bg-danger-400', umami: 'bg-[var(--color-warning)]',
                          astringent: 'bg-[var(--color-accent)]', sour: 'bg-[var(--color-success)]',
                        }
                        const labels: Record<string, string> = { bitter: '苦', sweet: '甜', umami: '鲜', astringent: '涩', sour: '酸' }
                        return (
                          <div key={k} className="flex-1 text-center">
                            <div className={`h-2 rounded ${colors[k]} opacity-60`} style={{ height: `${Math.max(4, val * 24)}px` }} />
                            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5">{labels[k]}</p>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      平衡度: {data.balance_score?.toFixed(2) ?? '—'} · 接受度: {data.acceptability?.toFixed(2) ?? '—'}
                    </p>
                  </div>
                ) : (
                  <Skeleton className="h-6 w-20" />
                )}
              </div>
            ))}
          </div>

          {/* 兼容性对比 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
            {[
              { data: leftCompatData, label: left?.name ?? 'A' },
              { data: rightCompatData, label: right?.name ?? 'B' },
            ].map(({ data, label }) => (
              <div key={label} className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] p-[var(--space-apple-md)] bg-[var(--bg-secondary)]">
                <p className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2">{label} · 兼容性</p>
                {data ? (
                  <div>
                    <p className="text-2xl font-bold text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]">
                      {data.overall_score?.toFixed(0) ?? '—'}/100
                    </p>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                      {(data as FormulaCompareData)?.passed_checks ?? 0}/{(data as FormulaCompareData)?.total_checks ?? 0} 项通过
                      {((data as FormulaCompareData)?.error_count ?? 0) > 0 && <span className="text-danger-500 ml-1">({(data as FormulaCompareData)?.error_count} 错误)</span>}
                    </p>
                  </div>
                ) : (
                  <Skeleton className="h-6 w-20" />
                )}
              </div>
            ))}
          </div>

          {/* 安全检查对比 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
            {[
              { data: leftSafetyData, label: left?.name ?? 'A' },
              { data: rightSafetyData, label: right?.name ?? 'B' },
            ].map(({ data, label }) => (
              <div key={label} className={`rounded-[var(--radius-Apple-md)] border p-[var(--space-apple-md)] bg-[var(--bg-secondary)] ${
                data?.is_safe ? 'border-[var(--color-success-border)] dark:border-[var(--color-success)]' : 'border-danger-200 dark:border-danger-800'
              }`}>
                <p className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2">{label} · 安全性</p>
                {data ? (
                  <div className="flex items-center gap-2">
                    {data.is_safe ? (
                      <>
                        <span className="text-[var(--color-success-text)]0">✓</span>
                        <span className="text-sm font-medium text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">安全</span>
                      </>
                    ) : (
                      <>
                        <span className="text-danger-500">⚠</span>
                        <span className="text-sm font-medium text-danger-700 dark:text-danger-700">有风险</span>
                      </>
                    )}
                    <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-auto">风险评分: {data.overall_risk_score?.toFixed(0) ?? '—'}</span>
                  </div>
                ) : (
                  <Skeleton className="h-5 w-16" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 指标对比 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)] text-center">
          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1.5">安全检查</p>
          <div className="flex justify-center gap-[var(--space-apple-sm)]">
            <span className={leftSafety.passed === true ? 'text-[var(--color-success-text)]0' : leftSafety.passed === false ? 'text-[var(--color-error-text)]0' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'}>
              {leftSafety.passed === null ? '-' : leftSafety.passed ? '通过' : '未通过'}
            </span>
            <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">vs</span>
            <span className={rightSafety.passed === true ? 'text-[var(--color-success-text)]0' : rightSafety.passed === false ? 'text-[var(--color-error-text)]0' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'}>
              {rightSafety.passed === null ? '-' : rightSafety.passed ? '通过' : '未通过'}
            </span>
          </div>
        </div>
        <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)] text-center">
          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1.5">协同评分</p>
          <div className="flex justify-center gap-[var(--space-apple-sm)]">
            <span className="text-lg font-semibold text-[var(--color-primary-text)]">{leftSynergy ?? '-'}</span>
            <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">vs</span>
            <span className="text-lg font-semibold text-[var(--color-primary-text)]">{rightSynergy ?? '-'}</span>
          </div>
        </div>
        <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)] text-center">
          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1.5">成分数量</p>
          <div className="flex justify-center gap-[var(--space-apple-sm)]">
            <span className="text-lg font-semibold text-[var(--text-primary)]">{left?.ingredients.length ?? 0}</span>
            <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">vs</span>
            <span className="text-lg font-semibold text-[var(--text-primary)]">{right?.ingredients.length ?? 0}</span>
          </div>
        </div>
      </div>

      {/* 成分对比 */}
      <Card>
        <CardHeader className="py-2.5 px-[var(--space-apple-sm)]">
          <CardTitle as="h3" className="text-sm">成分对比</CardTitle>
        </CardHeader>
        <CardContent className="space-y-[var(--space-apple-sm)] p-[var(--space-apple-sm)]">
          {ingredientsComparison.shared.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-medium text-[var(--text-primary)]">共同成分</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-medium text-[var(--text-primary)]">配方 A 独有</span>
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
                  <span className="text-sm font-medium text-[var(--text-primary)]">配方 B 独有</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)] pt-3 border-t border-[var(--border-color)]">
            <div>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2">配方 A 成分分布</p>
              {left && left.ingredients.length > 0 ? (
                <CompositionChart ingredients={left.ingredients} compact />
              ) : (
                <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">暂无数据</p>
              )}
            </div>
            <div>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2">配方 B 成分分布</p>
              {right && right.ingredients.length > 0 ? (
                <CompositionChart ingredients={right.ingredients} compact />
              ) : (
                <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">暂无数据</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 功效对比 */}
      <Card>
        <CardHeader className="py-2.5 px-[var(--space-apple-sm)]">
          <CardTitle as="h3" className="text-sm">功效对比</CardTitle>
        </CardHeader>
        <CardContent className="p-[var(--space-apple-sm)]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-apple-sm)]">
            <div>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1.5">配方 A 独有</p>
              <div className="flex flex-wrap gap-1">
                {effectsComparison.onlyLeft.length > 0 ? effectsComparison.onlyLeft.map(e => (
                  <Badge key={e} variant="info" size="sm">{e}</Badge>
                )) : <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">无</span>}
              </div>
            </div>
            <div>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1.5">共同功效</p>
              <div className="flex flex-wrap gap-1">
                {effectsComparison.shared.length > 0 ? effectsComparison.shared.map(e => (
                  <Badge key={e} variant="primary" size="sm">{e}</Badge>
                )) : <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">无</span>}
              </div>
            </div>
            <div>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1.5">配方 B 独有</p>
              <div className="flex flex-wrap gap-1">
                {effectsComparison.onlyRight.length > 0 ? effectsComparison.onlyRight.map(e => (
                  <Badge key={e} variant="warning" size="sm">{e}</Badge>
                )) : <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">无</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 描述对比 */}
      {left?.description && right?.description && (
        <Card>
          <CardHeader className="py-2.5 px-[var(--space-apple-sm)]">
            <CardTitle as="h3" className="text-sm">配方描述对比</CardTitle>
          </CardHeader>
          <CardContent className="p-[var(--space-apple-sm)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
              <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] p-2.5">
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">{left.name}</p>
                <p className="text-sm text-[var(--text-primary)]">{left.description}</p>
              </div>
              <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] p-2.5">
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">{right.name}</p>
                <p className="text-sm text-[var(--text-primary)]">{right.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

