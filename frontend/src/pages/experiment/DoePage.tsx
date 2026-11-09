/**
 * DOE 实验设计页面 — 完整功能版 * CCD / BBD / 混料 设计矩阵 + 多响应面拟合 + 反向搜索 + 主动学习 + 散点图 *
 * 真实数据链路? *   实验管理(实验ID） /doe/experiments/{id}/runs  → runs(真实参数） 选择响应值 /doe/fit
 *   配方种子          /doe/seed-from-formula/{id}  → runs(成分占比因子+真实响应） /doe/fit
 */
import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Beaker, Plus, Trash2, Play, Search, Sparkles, TrendingUp,
  FileText, Target, RefreshCw,
  Save, ClipboardList, Eye, EyeOff, Lightbulb,
  FolderInput, Send, FlaskConical, PieChart,
} from 'lucide-react'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Legend,
} from 'recharts'
import { doeApi, type DOEFactor, type DOERun, type FittedModel } from '@/api/doe'
import { useToast } from '@/components/ui/Toast'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, StatCard, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui'

const STORAGE_KEY = 'rmfood_doe_history'
const loadHistory = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
const saveHistory = (items: any[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items))

/** 推导 runs 中实际值值出现的响应参数名（response_values 的键*/
const deriveResponseNames = (runs: DOERun[]): string[] => {
  const names = new Set<string>()
  for (const r of runs) {
    if (r.response_values && typeof r.response_values === 'object') {
      for (const k of Object.keys(r.response_values)) names.add(k)
    }
  }
  return Array.from(names)
}

function FactorRow({ factor, index, onChange, onRemove, canRemove }: {
  factor: DOEFactor; index: number
  onChange: (f: DOEFactor) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-[var(--space-apple-sm)] p-[var(--space-apple-sm)] bg-[var(--bg-tertiary)]/70 dark:bg-[var(--bg-tertiary)]/40 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] flex-wrap">
      <span className="text-xs font-mono text-[var(--text-muted)] w-6">{index + 1}</span>
      <Input className="flex-1 min-w-0 text-sm"
        placeholder={t('pages.doe.factorNamePlaceholder')} value={factor.name}
        onChange={e => onChange({ ...factor, name: e.target.value })} />
      {(['low', 'high', 'center'] as const).map(k => (
        <div key={k} className="flex flex-col items-center gap-1">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">{k === 'low' ? t('pages.doe.factorRowLowLevel') : k === 'high' ? t('pages.doe.factorRowHighLevel') : t('pages.doe.factorRowCenterLevel')}</span>
          <Input type="number" step="0.1"
            aria-label={`${factor.name} ${k === 'low' ? t('pages.doe.lowLevel') : k === 'high' ? t('pages.doe.highLevel') : t('pages.doe.centerLevel')}`}
            className="w-20 text-sm text-center tabular-nums"
            value={factor[k]}
            onChange={e => onChange({ ...factor, [k]: parseFloat(e.target.value) || 0 })} />
        </div>
      ))}
      <Button variant="ghost" size="icon" type="button" onClick={onRemove} disabled={!canRemove} aria-label={t('pages.doe.ariaRemoveFactor')}
        className="text-[var(--text-muted)] hover:bg-[var(--color-error-container)] hover:text-[var(--color-error-text)] transition-colors">
        <Trash2 size={14} />
      </Button>
    </div>
  )
}

function MixtureComponentRow({ comp, index, onChange, onRemove }: {
  comp: { name: string; lower: number; upper: number }; index: number
  onChange: (c: { name: string; lower: number; upper: number }) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-[var(--space-apple-sm)] p-[var(--space-apple-sm)] bg-[var(--bg-tertiary)]/70 dark:bg-[var(--bg-tertiary)]/40 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] flex-wrap">
      <span className="text-xs font-mono text-[var(--text-muted)] w-6">{index + 1}</span>
      <Input className="flex-1 min-w-0 text-sm"
        placeholder={t('pages.doe.componentNamePlaceholder')} value={comp.name}
        onChange={e => onChange({ ...comp, name: e.target.value })} />
      {(['lower', 'upper'] as const).map(k => (
        <div key={k} className="flex flex-col items-center gap-1">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">{k === 'lower' ? t('pages.doe.componentLowerLimit') : t('pages.doe.componentUpperLimit')}</span>
          <Input type="number" step="0.01"
            aria-label={`${comp.name} ${k === 'lower' ? t('pages.doe.componentLowerLimit') : t('pages.doe.componentUpperLimit')}`}
            className="w-20 text-sm text-center tabular-nums"
            value={comp[k]}
            onChange={e => onChange({ ...comp, [k]: parseFloat(e.target.value) || 0 })} />
        </div>
      ))}
      <Button variant="ghost" size="icon" type="button" onClick={onRemove} aria-label={t('pages.doe.ariaRemoveComponent')} className="text-[var(--text-muted)] hover:bg-[var(--color-error-container)] hover:text-[var(--color-error-text)] transition-colors">
        <Trash2 size={14} />
      </Button>
    </div>
  )
}

function ResponseInputTable({ runs, factors, values, onChange }: {
  runs: DOERun[]
  factors: DOEFactor[]
  values: Record<number, number>
  onChange: (runId: number, v: number) => void
}) {
  const { t } = useTranslation()
  const factorNames = factors.map(f => f.name)
  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full text-xs">
        <thead>
          <tr>
            <th className="pr-3 text-left w-10">#</th>
            {factorNames.map(name => <th key={name} className="px-2 text-center min-w-[80px]">{name}</th>)}
            <th className="pl-2 text-center min-w-[100px]">{t('pages.doe.responseValue')}</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => {
            const shown = values[run.run_id]
            return (
              <tr key={run.run_id}>
                <td className="pr-3 text-[var(--text-muted)] font-mono">{run.run_id}</td>
                {factorNames.map(name => (
                  <td key={name} className="px-2 text-center font-mono text-[var(--text-secondary)] tabular-nums">
                    {((run.factor_levels?.[name] ?? run.coded_levels?.[name] ?? 0) as number).toFixed(2)}
                  </td>
                ))}
                <td className="pl-2">
                  <Input type="number" step="0.01" value={shown ?? ''}
                    onChange={e => onChange(run.run_id, parseFloat(e.target.value) || 0)}
                    placeholder={t('pages.doe.inputResponseValue')}
                    className="w-full text-center tabular-nums" />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ScatterPlot({ runs, factors, values }: {
  runs: DOERun[]
  factors: DOEFactor[]
  values: Record<number, number>
}) {
  const { t } = useTranslation()
  if (factors.length < 2) return null
  const f1 = factors[0].name
  const f2 = factors[1].name
  const scatterData = runs.filter(r => values[r.run_id] != null).map(r => ({
    x: (r.coded_levels?.[f1] ?? r.factor_levels?.[f1] ?? 0),
    y: (r.coded_levels?.[f2] ?? r.factor_levels?.[f2] ?? 0),
    z: values[r.run_id] ?? 0,
    run_id: r.run_id,
    f1_val: (r.factor_levels?.[f1] ?? r.coded_levels?.[f1] ?? 0),
    f2_val: (r.factor_levels?.[f2] ?? r.coded_levels?.[f2] ?? 0),
  }))
  if (scatterData.length < 3) {
    return (
      <div className="h-56 flex items-center justify-center text-[var(--text-muted)] text-sm bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-md)]">
        {t('pages.doe.scatterNeedMore')}      </div>
    )
  }
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, rgba(148,163,184,0.12))" opacity={0.35} />
          <XAxis type="number" dataKey="x" name={f1} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-color)' }} tickLine={{ stroke: 'var(--border-color)' }} label={{ value: f1, position: 'bottom', offset: 0, fontSize: 12, fill: 'var(--text-muted)' }} />
          <YAxis type="number" dataKey="y" name={f2} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-color)' }} tickLine={{ stroke: 'var(--border-color)' }} label={{ value: f2, angle: -90, position: 'left', offset: 0, fontSize: 12, fill: 'var(--text-muted)' }} />
          <ZAxis type="number" dataKey="z" range={[60, 400]} name={t('pages.doe.scatterResponseName')} />
          <RechartsTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const d = payload[0].payload as unknown as { run_id: number; f1_val: number; f2_val: number; z: number }
              return (
                <div className="bg-card border border-[var(--border-color)] rounded-[var(--radius-Apple-sm)] p-2 text-xs shadow-lg">
                  <div className="font-semibold mb-1">{t('pages.doe.groupLabel', { id: d.run_id })}</div>
                  <div>{f1}: {d.f1_val.toFixed(2)}</div>
                  <div>{f2}: {d.f2_val.toFixed(2)}</div>
                  <div className="text-[var(--color-primary-text)] font-bold">{t('pages.doe.scatterResponseTooltip', { value: d.z.toFixed(2) })}</div>
                </div>
              )
            }}
          />
          <Legend />
          <Scatter name={t('pages.doe.scatterName')} data={scatterData} fill="var(--color-primary, var(--color-primary-surface, #047857))" fillOpacity={0.7} />
        </ScatterChart>
      </ResponsiveContainer>
      <p className="text-xs text-[var(--text-muted)] text-center mt-1">
        {t('pages.doe.bubbleLegend', { f1, f2 })}
      </p>
    </div>
  )
}

export default function DoePage() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<'design' | 'fit' | 'search' | 'active'>('design')
  const [factors, setFactors] = useState<DOEFactor[]>([
    { name: '温度', low: 60, high: 100, center: 80 },
    { name: '时间', low: 10, high: 60, center: 35 },
  ])
  // 混料组分
  const [mixtureComponents, setMixtureComponents] = useState<Array<{ name: string; lower: number; upper: number }>>([
    { name: '组分A', lower: 0, upper: 1 },
    { name: '组分B', lower: 0, upper: 1 },
    { name: '组分C', lower: 0, upper: 1 },
  ])
  const [mixtureDesignType, setMixtureDesignType] = useState<'lattice' | 'centroid'>('lattice')
  const [mixtureDegree, setMixtureDegree] = useState(2)
  // CCD/BBD 中心点重复次数（n_center），默认 6 保持既有行为
  const [nCenterPoints, setNCenterPoints] = useState<number>(6)
  // 生成标签页当前设计类型：n_center 仅适用于 CCD / BBD（混料不适用）
  const [designType, setDesignType] = useState<'ccd' | 'bbd' | 'mixture'>('ccd')
  const [designResult, setDesignResult] = useState<null | { type: string; runs: DOERun[]; notes: string }>(null)
  const [showResponseInput, setShowResponseInput] = useState(false)
  const [responseValues, setResponseValues] = useState<Record<number, number>>({})
  const [fittingRuns, setFittingRuns] = useState<DOERun[]>([])
  const [fitResult, setFitResult] = useState<FittedModel[] | null>(null)
  const [activeFitIdx, setActiveFitIdx] = useState<number>(0)
  const [targetValue, setTargetValue] = useState('')
  const [searchResult, setSearchResult] = useState<any>(null)
  const [activeLearningResult, setActiveLearningResult] = useState<any[]>([])
  const [activeStrategy, setActiveStrategy] = useState<string>('')
  const [expIdInput, setExpIdInput] = useState('')
  const [respParamInput, setRespParamInput] = useState('')
  const [importedMeta, setImportedMeta] = useState<null | { expId: number; totalRuns: number; factors: string[]; responseCandidates: string[] }>(null)
  // 配方种子
  const [seedFormulas, setSeedFormulas] = useState<Array<{ id: number; name: string }>>([])
  const [seedFormulaId, setSeedFormulaId] = useState('')
  const [seedRespParam, setSeedRespParam] = useState('')
  const [seedExpId, setSeedExpId] = useState('')
  const [seedFormulasLoading, setSeedFormulasLoading] = useState(true)
  const [seedMeta, setSeedMeta] = useState<null | {
    formulaId: number; formulaName: string; totalRuns: number; responseParam: string
    experimentId: number | null; responsePool: number[]
  }>(null)
  // 拟合响应参数选择（默认'y'，可改为真实参数名）
  const [fitResponseParam, setFitResponseParam] = useState('y')
  // P2-1：记录用户是否手动改过响应参数；一旦手动改过，不再被自动切换覆盖
  const [respParamTouched, setRespParamTouched] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const isLoading = (k: string) => loading === k
  const [history, setHistory] = useState<any[]>(loadHistory)
  const [showHistory, setShowHistory] = useState(false)

  // 从 fittingRuns → response_values 自动推导可用响应参数
  const responseCandidates = useMemo(() => deriveResponseNames(fittingRuns), [fittingRuns])

  // H3：拟合/搜索/主动学习结果仅在关键输入变化时失效，避免陈旧结果继续展示（设置结果本身不触发本效应）
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setFitResult(null)
    setSearchResult(null)
    setActiveLearningResult([])
    setActiveFitIdx(0)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [fittingRuns, factors, fitResponseParam])

  // 当 fittingRuns 变化时，自动把默认响应参数切到首个真实参数（P2-1 修复：仅当用户没有手动改过 respParamTouched=false 时才自动切换，尊重用户选择）
  useEffect(() => {
    if (!respParamTouched && responseCandidates.length > 0 && fitResponseParam === 'y') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFitResponseParam(responseCandidates[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responseCandidates])

  // 加载真实配方列表（供"从配方生成种子"下拉框）
  useEffect(() => {
    let cancelled = false
    doeApi.listSeedFormulas().then((body: any) => {
      if (cancelled) return
      const imp = body?.data ?? body
      const list = Array.isArray(imp?.formulas) ? imp.formulas : []
      setSeedFormulas(list)
      if (import.meta.env.DEV) console.log('[DOE] listSeedFormulas total', imp?.total, 'recipes', list.length)
      if (list.length === 0) {
        addToast({ type: 'warning', message: t('pages.doe.toastFormulaListEmpty', { total: imp?.total ?? '?' }) })
      }
    }).catch((e: any) => {
      if (cancelled) return
      if (import.meta.env.DEV) console.warn('[DOE] listSeedFormulas failed', e?.response?.status, e?.response?.data ?? e)
      addToast({ type: 'error', message: t('pages.doe.toastLoadFormulasFailed', { err: e?.response?.status ?? e?.message }) })
    }).finally(() => {
      if (!cancelled) setSeedFormulasLoading(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * → runs 的某个真实响应参数映射成后端 /fit 能识别的 response_values。
   * - 手动 'y' 模式：run.response_values = { y: responseValues[run.run_id] }
   */
  const buildFittingPayload = (respParam: string) => {
    const manual = respParam === 'y'
    const payload = fittingRuns.map(run => {
      const raw = run.response_values ?? {}
      let v: number | null = null
      if (manual) {
        v = responseValues[run.run_id] != null ? responseValues[run.run_id] : null
      } else {
        v = raw[respParam] != null ? raw[respParam] : null
      }
      return {
        ...run,
        response_values: v != null ? { [respParam]: v } : null,
      }
    }).filter(r => r.response_values != null)
    return payload
  }

  // 从真实配方生成种子runs →回填因子 + 拟合队列
  const handleSeedFromFormula = () => {
    const fid = parseInt(seedFormulaId, 10)
    if (!fid) { addToast({ type: 'warning', message: t('pages.doe.toastSelectFormula') }); return }
    setLoading('seed')
    ;(async () => {
      try {
        // P0-1：把 seedExpId 传给后端 →按该实验真实数据点取响应值（pool 循环使用）
        const expId = seedExpId ? parseInt(seedExpId, 10) : undefined
        const body: any = await doeApi.seedFromFormula(fid, {
          n_center: 2,
          response_parameter: seedRespParam || undefined,
          experiment_id: expId,
        })
        const imp = body?.data ?? body
        const runs: DOERun[] = imp.runs ?? []
        if (runs.length === 0) {
          addToast({ type: 'warning', message: t('pages.doe.toastSeedUnavailable') })
          return
        }
        setFittingRuns(runs)
        setFactors((imp.factors ?? []).map((f: any) => ({ name: f.name, low: f.low, high: f.high, center: f.center })))
        // P0-1：seedMeta 携带 experimentId主动学习闭环可写回该实验
        setSeedMeta({
          formulaId: fid,
          formulaName: imp.formula?.name ?? t('pages.doe.seedFormulaFallback', { id: fid }),
          totalRuns: runs.length,
          responseParam: imp.response_parameter ?? '感官评分',
          experimentId: imp.experiment_id ?? expId ?? null,
          responsePool: imp.response_pool ?? [],
        })
        // 自动把拟合响应参数指向种子真实响应值（尊重用户手选）
        const firstResp = Object.keys(runs[0]?.response_values ?? {})
        if (!respParamTouched && firstResp.length > 0) setFitResponseParam(firstResp[0])
        const pool = imp.response_pool ?? []
        if (imp.degenerate) {
          const di = imp.degenerate_info ?? {}
          const cands = (di.multi_value_candidates ?? []).map((c: any) => c?.name).filter(Boolean)
          addToast({
            type: 'warning',
            duration: 10000,
            title: t('pages.doe.seedDegenerateTitle'),
            message: t('pages.doe.seedDegenerateDetail', {
              resp: imp.response_parameter ?? '感官评分',
              count: di.n_distinct_real_values ?? 1,
              cand: cands.length ? cands.join(t('pages.doe.listSeparator')) : t('pages.doe.seedDegenerateNoCand'),
            }),
          })
        } else {
          const poolNote = pool.length > 1 ? t('pages.doe.seedPoolNote', { count: pool.length }) : ''
          addToast({ type: 'success', message: t('pages.doe.seedGeneratedFromFormula', { name: imp.formula?.name ?? t('pages.doe.seedFormulaFallback', { id: fid }), count: runs.length, resp: imp.response_parameter, pool: poolNote }) })
        }
        setActiveTab('fit')
      } catch (e: any) {
        addToast({ type: 'error', message: e?.response?.data?.detail ?? t('pages.doe.networkError') })
      } finally {
        setLoading(null)
      }
    })()
  }

    // 从实验管理跳转进来时（doe?exp=12）自动填入实验ID 并导入
  useEffect(() => {
    const expParam = searchParams.get('exp')
    if (expParam) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpIdInput(expParam)
      // eslint-disable-next-line react-hooks/immutability
      handleImportFromExperiment(expParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 从实验管理导入数据自动填充因子 + 拟合队列
  const handleImportFromExperiment = (expIdOverride?: string) => {
    const expIdRaw = expIdOverride ?? expIdInput
    const expId = parseInt(expIdRaw, 10)
    if (!expId) { addToast({ type: 'warning', message: t('pages.doe.toastEnterExpId') }); return }
    setLoading('import')
    ;(async () => {
      try {
        const imp: any = await doeApi.importExperimentRuns(expId, respParamInput ? { response_parameter: respParamInput } : undefined)
        const runs: DOERun[] = imp?.runs ?? []
        if (runs.length === 0) {
          addToast({ type: 'warning', message: t('pages.doe.toastNoImportableRuns') })
          return
        }
        const factorNames = (imp.factors ?? []).map((f: any) => f.name)
        setFittingRuns(runs)
        if (imp.factors?.length) {
          setFactors((imp.factors ?? []).map((f: any) => ({ name: f.name, low: f.low, high: f.high, center: f.center })))
        }
        const respCands: string[] = imp.response_candidates ?? []
        setImportedMeta({ expId, totalRuns: runs.length, factors: factorNames, responseCandidates: respCands })
        // 自动把拟合响应参数指向导入的真实响应（尊重用户手选）
        if (!respParamTouched && respCands.length > 0) setFitResponseParam(respCands[0])
        addToast({ type: 'success', message: t('pages.doe.importedRuns', { count: runs.length, id: expId, candidates: respCands.length }) })
        setActiveTab('fit')
        if (expIdOverride && searchParams.get('exp')) {
          setSearchParams({}, { replace: true })
        }
      } catch (e: any) {
        addToast({ type: 'error', message: e?.response?.data?.detail ?? t('pages.doe.networkError') })
      } finally {
        setLoading(null)
      }
    })()
  }

  // 把主动学习推荐写回实验管理（闭环）  // P0-1：支持两种来源 — 实验导入(importedMeta) 或 配方种子(seedMeta.experimentId)
  const closeLoopExpId = importedMeta?.expId ?? seedMeta?.experimentId ?? null
  const handleExportRecommendations = async () => {
    if (activeLearningResult.length === 0) { addToast({ type: 'warning', message: t('pages.doe.toastNoRecommendations') }); return }
    const targetExp = closeLoopExpId
    if (!targetExp) {
      addToast({ type: 'warning', message: importedMeta
        ? t('pages.doe.toastMissingExpId')
        : t('pages.doe.toastNeedExpIdForExport') })
      return
    }
    setLoading('export')
    try {
      const body: any = await doeApi.exportToExperiment({
        experiment_id: targetExp,
        recommendations: activeLearningResult,
        note: `strategy=${activeStrategy || 'auto'}${seedMeta?.formulaName ? ` seed=${seedMeta.formulaName}` : ''}`,
      })
      const imp = body?.data ?? body
      addToast({ type: 'success', message: t('pages.doe.writtenBack', { count: imp.created_data_points ?? 0, id: targetExp }) })
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.detail ?? t('pages.doe.networkError') })
    } finally {
      setLoading(null)
    }
  }

  const handleActiveLearning = async () => {
    if (buildFittingPayload(fitResponseParam).length < 2) { addToast({ type: 'warning', message: t('pages.doe.minRunsToFit', { param: fitResponseParam }) }); return }
    setLoading('active')
    try {
      const res: any = await doeApi.activeLearning({
        existing_runs: fittingRuns.map(r => ({
          run_id: r.run_id,
          coded_levels: r.coded_levels ?? {},
          factor_levels: r.factor_levels ?? {},
          response_values: r.response_values ?? {},
        })),
        n_recommend: 3,
        fitted_model: fitResult?.[0] ?? undefined,
      })
      const imp = res?.data ?? res
      const recs = imp.recommendations ?? []
      setActiveLearningResult(recs)
      setActiveStrategy(imp.strategy ?? '')
      addToast({ type: 'success', message: t('pages.doe.recommendedPoints', { count: recs.length, strategy: imp.strategy ?? 'default' }) })
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.detail ?? t('pages.doe.networkError') })
    } finally {
      setLoading(null)
    }
  }

  const addFactor = () => setFactors([...factors, { name: '', low: 0, high: 100, center: 50 }])
  const removeFactor = (i: number) => setFactors(factors.filter((_, idx) => idx !== i))
  const updateFactor = (i: number, f: DOEFactor) => { const n = [...factors]; n[i] = f; setFactors(n) }
  const updateResponseValue = (runId: number, v: number) => setResponseValues(prev => ({ ...prev, [runId]: v }))

  const addMixtureComponent = () => setMixtureComponents([...mixtureComponents, { name: `组分${String.fromCharCode(65 + mixtureComponents.length)}`, lower: 0, upper: 1 }])
  const removeMixtureComponent = (i: number) => setMixtureComponents(mixtureComponents.filter((_, idx) => idx !== i))
  const updateMixtureComponent = (i: number, c: { name: string; lower: number; upper: number }) => {
    const n = [...mixtureComponents]; n[i] = c; setMixtureComponents(n)
  }

  const handleGenerate = async (type: 'ccd' | 'bbd') => {
    if (factors.length < 2) { addToast({ type: 'warning', message: t('pages.doe.toastMinFactors') }); return }
    setDesignType(type)
    setLoading('generate')
    try {
      const res = await doeApi[type === 'ccd' ? 'generateCCD' : 'generateBBD']({ factors, n_center_points: nCenterPoints })
      const data = res.data?.data ?? res.data
      setDesignResult({ type, runs: data.runs ?? [], notes: data.notes ?? '' })
      setResponseValues({}); setShowResponseInput(false); setSearchResult(null); setFitResult(null); setActiveFitIdx(0); setActiveLearningResult([])
      addToast({ type: 'success', message: t('pages.doe.generateAddedHint', { count: data.total_runs }) })
    } catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail ?? t('pages.doe.networkError') }) }
    finally { setLoading(null) }
  }

  const handleGenerateMixture = async () => {
    if (mixtureComponents.length < 2) { addToast({ type: 'warning', message: t('pages.doe.toastMinComponents') }); return }
    setDesignType('mixture')
    setLoading('generate')
    try {
      const res = await doeApi.generateMixture({
        components: mixtureComponents.map(c => ({ name: c.name, lower: Math.min(c.lower, c.upper), upper: Math.max(c.lower, c.upper) })),
        design_type: mixtureDesignType,
        degree: mixtureDesignType === 'lattice' ? mixtureDegree : 3,
      })
      const data = res.data?.data ?? res.data
      setDesignResult({ type: `mixture_${mixtureDesignType}`, runs: data.runs ?? [], notes: data.notes ?? '' })
      setResponseValues({}); setShowResponseInput(false); setSearchResult(null); setFitResult(null); setActiveFitIdx(0); setActiveLearningResult([])
      addToast({ type: 'success', message: t('pages.doe.generateAddedHint', { count: data.total_runs }) })
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.detail ?? t('pages.doe.networkError') })
    } finally {
      setLoading(null)
    }
  }

  const handleFit = async () => {
    // P0-2 修复：保留真实响应名。后端 /fit 接受任意 response_names，模型 responses/equation/coefficients/r_squared 都会用该真实参数名（不再使用 'y'）
    const runsWithResponses = buildFittingPayload(fitResponseParam)
    if (runsWithResponses.length < 2) {
    addToast({ type: 'warning', message: t('pages.doe.minRunsToFit', { param: fitResponseParam }) })
      return
    }
    setLoading('fit')
    try {
      const res = await doeApi.fitResponseSurface({
        runs: runsWithResponses,
      response_names: [fitResponseParam],  // 真实参数名（如 "感官评分"），而非 'y'
        include_interaction: true,
        include_quadratic: true,
      })
      const models = res.data?.models ?? res.data
      setFitResult(models); setActiveFitIdx(0); setSearchResult(null)
      const r2 = models?.[0]?.r_squared?.[fitResponseParam] ?? 0
      addToast({ type: 'success', message: t('pages.doe.fittedDone', { param: fitResponseParam, r2: Number(r2).toFixed(4) }) })
    } catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail ?? t('pages.doe.networkError') }) }
    finally { setLoading(null) }
  }
  const handleSearch = async () => {
    if (!fitResult?.length || !fitResult[0]) { addToast({ type: 'warning', message: t('pages.doe.toastFitFirst') }); return }
    // L5：目标响应值不允许静默回退到 50 — 空/非法时提示并返回
    const target = parseFloat(targetValue)
    if (!targetValue || Number.isNaN(target)) {
      addToast({ type: 'warning', message: t('pages.doe.targetRequired') })
      return
    }
    setLoading('search')
    try {
      // 把因子实际值单位范围(low/high)传给后端 → 反解回实际值
      const factor_bounds: Record<string, [number, number]> = {}
      for (const f of factors) factor_bounds[f.name] = [f.low, f.high]
      // P0-2：target_values 用真实响应名（与 fit 的 response_names 一致），模型才能匹配
      const targetKey = fitResponseParam
      const res: any = await doeApi.inverseSearch({
        model: fitResult[0],
        target_values: { [targetKey]: target },
        factor_bounds,
      })
      const data = res.data ?? res
      setSearchResult(data)
      addToast({ type: data.converged ? 'success' : 'warning', message: t(data.converged ? 'pages.doe.inverseConverged' : 'pages.doe.searchNotConverged') })
    } catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail ?? t('pages.doe.networkError') }) }
    finally { setLoading(null) }
  }

  const handleSaveDesign = () => {
    if (!designResult) return
    const item = { id: Date.now(), type: designResult.type.toUpperCase(), factors: factors.map(f => f.name), runs: designResult.runs.length, date: new Date().toLocaleDateString() }
    const newHistory = [item, ...history].slice(0, 20)
    setHistory(newHistory)
    try {
      saveHistory(newHistory)
      addToast({ type: 'success', message: t('pages.doe.designSaved') })
    } catch {
      // L6：localStorage 可能因配额/隐私模式抛错，给出警告而非崩溃
      addToast({ type: 'warning', message: t('pages.doe.saveDesignFailed') })
    }
  }

  /** 一键把整张设计矩阵加入拟合队列（去重），并跳到拟合标签页 */
  const handleAddAllToFitting = () => {
    if (!designResult) return
    const existing = new Set(fittingRuns.map(r => r.run_id))
    const newRuns = designResult.runs.filter(r => !existing.has(r.run_id))
    if (newRuns.length === 0) {
      addToast({ type: 'info', message: t('pages.doe.toastAllInQueue') })
      return
    }
    setFittingRuns(prev => [...prev, ...newRuns])
    setActiveTab('fit')
    addToast({ type: 'success', message: t('pages.doe.addedToFitQueueWithSkip', { added: newRuns.length, skipped: designResult.runs.length - newRuns.length }) })
  }

  // L1：清空拟合队列 — 同时清掉陈旧的主动学习推荐；队列非空时给出成功提示（空队列不弹提示）
  const handleClearQueue = () => {
    setFittingRuns([])
    setResponseValues({})
    setFitResult(null)
    setActiveFitIdx(0)
    setSearchResult(null)
    setActiveLearningResult([])
    if (fittingRuns.length > 0) {
      addToast({ type: 'success', message: t('pages.doe.queueCleared') })
    }
  }

  // L1：从拟合队列移除单个 run — 给成功提示，避免静默失败
  const handleRemoveRun = (runId: number) => {
    setFittingRuns(fittingRuns.filter(r => r.run_id !== runId))
    addToast({ type: 'success', message: t('pages.doe.runRemoved') })
  }

  // 当前要展示的响应参数名（用于 fit 结果 R² 标签）
  const displayRespName = fitResponseParam
  // 实际可参与拟合的运行数（过滤掉无响应值的运行；与 buildFittingPayload 逻辑一致）
  const fitPayloadCount = (() => { try { return buildFittingPayload(fitResponseParam).length } catch { return 0 } })()
  // 多响应模型：当前选中的拟合模型下标（越界/空数组时钳制到合法下标，避免 -1）
  const fitIdx = Math.max(0, Math.min(activeFitIdx, (fitResult?.length ?? 1) - 1))
  const fitModel = fitResult?.[fitIdx]
  const modelRespName = fitModel?.responses?.[0] ?? displayRespName
  // H7：统计卡数值缺失时以 '—' 占位，避免误导性的 0
  const statVal = (v: number | null | undefined, digits: number) =>
    v == null ? t('pages.doe.statNotAvail') : Number(v.toFixed(digits))

  return (
    <div className="min-h-screen">
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
      <div className="max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)] space-y-[var(--space-apple-md)]">
      {/* 页头横幅 — 对齐 Dashboard 品牌横幅规范 */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-[var(--space-apple-md)]">
          <div className="flex-1">
            <h1 className="text-xl font-semibold leading-snug tracking-tight flex items-center gap-2">
              <Beaker size={20} className="text-white shrink-0" />
              {t('pages.doe.title')}
            </h1>
            <p className="mt-1 text-white text-sm">{t('pages.doe.subtitle')}</p>
          </div>
          {history.length > 0 && (
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowHistory(!showHistory)}
              className="gap-1.5 bg-[var(--bg-secondary)]/15 hover:bg-[var(--bg-secondary)]/25 rounded-[var(--radius-pill)] text-xs font-medium transition-colors">
              <ClipboardList size={12} />{t('pages.doe.history', { count: history.length })}
            </Button>
          )}
        </div>
      </div>

      {/* 历史记录 */}
      {showHistory && history.length > 0 && (
        <Card className="animate-[fadeSlideIn_.2s_ease-out] motion-reduce:animate-none">
          <CardContent className="p-[var(--space-apple-md)]">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wide">{t('pages.doe.recentDesigns')}</div>
            <div className="flex gap-2 flex-wrap">
              {history.map(h => (
                <div key={h.id} className="flex items-center gap-2 px-[var(--space-apple-sm)] py-1.5 bg-[var(--bg-tertiary)]/60 rounded-[var(--radius-Apple-sm)] text-xs">
                  <span className="font-mono text-[var(--color-primary-text)]">{h.type}</span>
                  <span className="text-[var(--text-muted)]">{h.factors.join('×')}</span>
                    <span className="text-[var(--text-muted)]">{t('pages.doe.runsCount', { count: h.runs })}</span>
                  <span className="text-[var(--text-muted)]">{h.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 实验管理 → DOE 导入DOE 导入 */}
      <Card className="border-[var(--color-primary-border)] dark:border-[var(--color-primary)]/60">
        <CardHeader className="pt-5 pb-0">
          <CardTitle as="h2" className="flex items-center gap-2">
            <FolderInput size={14} className="text-[var(--color-primary-text)]" />
            <span className="text-[var(--color-primary-text)]">{t('pages.doe.importFromExperiment')}</span>
            <span className="text-xs font-normal text-[var(--text-muted)] ml-1">{t('pages.doe.importFromExperimentDesc')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-0">
          <div className="flex flex-wrap items-center gap-[var(--space-apple-sm)]">
            <Input value={expIdInput} onChange={e => setExpIdInput(e.target.value)}
              placeholder={t('pages.doe.expIdPlaceholder')} className="w-32 text-sm" />
            <Input value={respParamInput} onChange={e => setRespParamInput(e.target.value)}
                  placeholder={t('pages.doe.respParamPlaceholder')} className="w-48 text-sm" />
            <Button onClick={() => handleImportFromExperiment()} loading={isLoading('import')}
              icon={<FolderInput size={14} />}>{t('pages.doe.import')}</Button>
            {importedMeta && (
                  <span className="text-xs text-[var(--text-muted)]">{t('pages.doe.importedMeta', { id: importedMeta.expId, runs: importedMeta.totalRuns, candidates: importedMeta.responseCandidates.join(', ') })}</span>
            )}
          </div>
        </CardContent>
      </Card>

        {/* 配方 → DOE 种子生成（真实配方成分占比，非模拟） */}
      <Card>
        <CardHeader className="pt-5 pb-0">
          <CardTitle as="h2" className="flex items-center gap-2">
            <FlaskConical size={14} className="text-[var(--color-secondary-text)]" />
            <span className="text-[var(--color-secondary-text)]">{t('pages.doe.seedFromFormula')}</span>
            <span className="text-xs font-normal text-[var(--text-muted)] ml-1">{t('pages.doe.seedFromFormulaDesc')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-0">
          <div className="flex flex-wrap items-center gap-[var(--space-apple-sm)]">
            <Button variant="outline" onClick={() => doeApi.listSeedFormulas().then((body: any) => {
              const imp = body?.data ?? body
              setSeedFormulas(Array.isArray(imp?.formulas) ? imp.formulas : [])
      if (import.meta.env.DEV) console.log('[DOE] 重新加载配方', imp?.formulas?.length ?? 0)
            }).catch((e: any) => {
              if (import.meta.env.DEV) console.warn('[DOE] 重新加载配方失败', e?.response?.status, e?.response?.data ?? e)
              addToast({ type: 'error', message: t('pages.doe.toastReloadFailed') })
            })}
              className="text-xs"
              icon={<RefreshCw size={12} />}>{t('pages.doe.reloadFormulas')}</Button>
            <Select value={seedFormulaId} onValueChange={setSeedFormulaId} disabled={seedFormulasLoading}>
              <SelectTrigger className="w-44" aria-label={t('pages.doe.selectFormula')}>
                <SelectValue placeholder={t('pages.doe.selectFormula')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('pages.doe.selectFormula')}</SelectItem>
                {seedFormulas.map(f => (
                  <SelectItem key={f.id} value={String(f.id)}>{f.name}（{f.id}）</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={seedRespParam} onChange={e => setSeedRespParam(e.target.value)}
              placeholder={t('pages.doe.respParamDefault')} className="w-48 text-sm" />
            <Input value={seedExpId} onChange={e => setSeedExpId(e.target.value)}
              placeholder={t('pages.doe.expIdOptional')} className="w-40 text-sm" />
            <Button variant="secondary" onClick={handleSeedFromFormula} disabled={!seedFormulaId} loading={isLoading('seed')}
              icon={<FlaskConical size={14} />}>{t('pages.doe.generateSeed')}</Button>
            {seedMeta && (
              <span className="text-xs text-[var(--text-muted)]">
                {t('pages.doe.seedMeta', { name: seedMeta.formulaName, runs: seedMeta.totalRuns, resp: seedMeta.responseParam })}
                {seedMeta.responsePool?.length > 1 ? t('pages.doe.responsePool', { count: seedMeta.responsePool.length }) : ''}
              </span>
            )}
          </div>
          {seedFormulasLoading ? (
            <div className="mt-2 text-xs text-[var(--text-muted)]">{t('pages.doe.loadingSeedFormulas')}</div>
          ) : seedFormulas.length === 0 ? (
                <div className="mt-2 text-xs text-[var(--text-muted)]">{t('pages.doe.noSeedFormulas')}</div>
          ) : null}
        </CardContent>
      </Card>

      {/* 标签对齐设计系统 Apple Segmented Control 规范 */}
      <div className="mt-[var(--space-apple-md)]">
      <div className="tabs-list w-full max-w-full" role="tablist" aria-label={t('pages.doe.tabListLabel')}
        onKeyDown={(e) => {
          const keys = ['design', 'fit', 'search', 'active']
          const idx = keys.indexOf(activeTab)
          if (idx === -1) return
          let next: string | null = null
          if (e.key === 'ArrowLeft') next = keys[(idx - 1 + keys.length) % keys.length]
          else if (e.key === 'ArrowRight') next = keys[(idx + 1) % keys.length]
          else if (e.key === 'Home') next = keys[0]
          else if (e.key === 'End') next = keys[keys.length - 1]
          if (next) {
            e.preventDefault()
            setActiveTab(next as 'design' | 'fit' | 'search' | 'active')
            document.getElementById(`doe-tab-${next}`)?.focus()
          }
        }}>
        {[
          { key: 'design' as const, label: t('pages.doe.tabDesign'), icon: Play },
          { key: 'fit' as const, label: t('pages.doe.tabFit'), icon: TrendingUp },
          { key: 'search' as const, label: t('pages.doe.tabSearch'), icon: Search },
          { key: 'active' as const, label: t('pages.doe.tabActive'), icon: Lightbulb },
        ].map(tab => (
          <button key={tab.key} role="tab" id={`doe-tab-${tab.key}`} aria-controls={`doe-panel-${tab.key}`} aria-selected={activeTab === tab.key} tabIndex={activeTab === tab.key ? 0 : -1} onClick={() => setActiveTab(tab.key)}
            className={`tabs-trigger ${activeTab === tab.key ? 'tabs-trigger-active' : ''}`}>
            <span className="icon"><tab.icon size={14} /></span>
            {tab.label}
          </button>
        ))}
      </div>
      </div>

      <div className="mt-[var(--space-apple-lg)] space-y-[var(--space-apple-lg)]">
        {/* 实验设计标签 */}
        {activeTab === 'design' && (
          <div className="space-y-6 animate-[fadeSlideIn_.2s_ease-out] motion-reduce:animate-none" id="doe-panel-design" role="tabpanel" aria-labelledby="doe-tab-design">
            {/* 因子设置 */}
            <Card>
              <CardHeader className="pt-5 pb-0">
                <div className="flex items-center justify-between">
                  <CardTitle as="h2" className="flex items-center gap-2">
                    <Plus size={14} className="text-[var(--color-primary-text)]" />{t('pages.doe.factorSettings')}
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addFactor} icon={<Plus size={12} />} className="text-xs">{t('pages.doe.addFactor')}</Button>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-sm)]">
                <div className="flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-sm)] py-1.5 text-xs text-[var(--text-muted)] uppercase tracking-wider flex-wrap">
                  <span className="w-6">#</span><span className="flex-1">{t('pages.doe.factorName')}</span>
                  <span className="w-20 text-center">{t('pages.doe.lowLevel')}</span>
                  <span className="w-20 text-center">{t('pages.doe.highLevel')}</span>
                  <span className="w-20 text-center">{t('pages.doe.centerPoint')}</span>
                  <span className="w-8" />
                </div>
                {factors.map((f, i) => (
                  <FactorRow key={i} factor={f} index={i} onChange={v => updateFactor(i, v)} onRemove={() => removeFactor(i)} canRemove={factors.length > 2} />
                ))}
              </CardContent>
            </Card>

            {/* 混料设计设置 */}
            <Card className="border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)]/60">
              <CardHeader className="pt-5 pb-0">
                <div className="flex items-center justify-between">
                  <CardTitle as="h2" className="flex items-center gap-2">
                    <PieChart size={14} className="text-[var(--color-secondary-text)]" />{t('pages.doe.mixtureDesign')}
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addMixtureComponent} icon={<Plus size={12} />} className="text-xs">{t('pages.doe.addComponent')}</Button>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-md)]">
                <div className="space-y-[var(--space-apple-sm)]">
                  <div className="flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-sm)] py-1.5 text-xs text-[var(--text-muted)] uppercase tracking-wider flex-wrap">
                    <span className="w-6">#</span><span className="flex-1">{t('pages.doe.componentName')}</span>
                    <span className="w-20 text-center">{t('pages.doe.lowerLimit')}</span>
                    <span className="w-20 text-center">{t('pages.doe.upperLimit')}</span>
                    <span className="w-8" />
                  </div>
                  {mixtureComponents.map((c, i) => (
                    <MixtureComponentRow key={i} comp={c} index={i} onChange={v => updateMixtureComponent(i, v)} onRemove={() => removeMixtureComponent(i)} />
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-[var(--space-apple-md)]">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--text-muted)]">{t('pages.doe.designType')}</span>
                    <Select value={mixtureDesignType} onValueChange={(v) => setMixtureDesignType(v as 'lattice' | 'centroid')}>
                      <SelectTrigger className="w-36" aria-label={t('pages.doe.designType')}>
                        <SelectValue placeholder={t('pages.doe.designType')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lattice">{t('pages.doe.lattice')}</SelectItem>
                        <SelectItem value="centroid">{t('pages.doe.centroid')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {mixtureDesignType === 'lattice' && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[var(--text-muted)]">{t('pages.doe.degree')}</span>
                      <Select value={String(mixtureDegree)} onValueChange={(v) => setMixtureDegree(Number(v))}>
                        <SelectTrigger className="w-24" aria-label={t('pages.doe.degree')}>
                          <SelectValue placeholder={t('pages.doe.degree')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">{t('pages.doe.degree2')}</SelectItem>
                          <SelectItem value="3">{t('pages.doe.degree3')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 生成按钮 */}
            <div className="flex flex-wrap gap-[var(--space-apple-sm)]">
              {(designType === 'ccd' || designType === 'bbd') ? (
                <div className="flex items-center gap-[var(--space-apple-sm)]">
                  <label htmlFor="n-center-points" className="text-xs text-[var(--text-muted)]">{t('pages.doe.centerPointsLabel')}</label>
                  <Input id="n-center-points" type="number" min={0} max={20} step={1}
                    className="w-20 text-sm text-center tabular-nums"
                    value={nCenterPoints}
                    onChange={e => setNCenterPoints(Math.max(0, Math.min(20, parseInt(e.target.value, 10) || 0)))} />
                </div>
              ) : (
                <span className="text-xs text-[var(--text-muted)]">{t('pages.doe.nCenterNotApplicable')}</span>
              )}
              <Button onClick={() => handleGenerate('ccd')} loading={isLoading('generate')}
                icon={<Play size={14} />}>{t('pages.doe.generateCCD')}</Button>
              <Button variant="secondary" onClick={() => handleGenerate('bbd')} loading={isLoading('generate')}
                icon={<Play size={14} />}>{t('pages.doe.generateBBD')}</Button>
              <Button variant="outline" onClick={handleGenerateMixture} loading={isLoading('generate')}
                icon={<PieChart size={14} />}>{t('pages.doe.generateMixture')}</Button>
              {designResult && <Button variant="ghost" onClick={handleSaveDesign}
                icon={<Save size={14} />}>{t('pages.doe.saveDesign')}</Button>}
            </div>

            {/* 设计结果 */}
            <Card>
                <CardHeader className="pt-5 pb-0">
                  <div className="flex items-center justify-between">
                    <CardTitle as="h2" className="flex items-center gap-2">
                      <Sparkles size={14} className="text-[var(--color-primary-text)]" />
                      {designResult
                        ? t('pages.doe.designMatrix', { type: designResult.type.toUpperCase() })
                        : t('pages.doe.designResultTitle')}
                    </CardTitle>
                    {designResult && (
                    <div className="flex items-center gap-2">
                    <Badge variant="neutral" size="sm">{t('pages.doe.runsCountGroup', { count: designResult.runs.length })}</Badge>
                      <Button size="sm" onClick={handleAddAllToFitting}
                        icon={<TrendingUp size={12} />} className="text-xs">
                        {t('pages.doe.addAllToFit')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowResponseInput(!showResponseInput)}
                        icon={showResponseInput ? <EyeOff size={12} /> : <Eye size={12} />} className="text-xs">
                        {showResponseInput ? t('pages.doe.hideResponseInput') : t('pages.doe.showResponseInput')}
                      </Button>
                    </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-md)]">
                  {!designResult ? (
                    <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                      {t('pages.doe.designEmptyHint')}
                    </div>
                  ) : (
                  <>
                  {designResult.notes && <p className="text-xs text-[var(--text-muted)] px-1">{designResult.notes}</p>}

                  {/* 响应值输出*/}
                  {showResponseInput && (
                    <div className="p-[var(--space-apple-sm)] bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/20 rounded-[var(--radius-Apple-sm)] border border-[var(--color-primary-border)] dark:border-[var(--color-primary)]/40 animate-[fadeSlideIn_.2s_ease-out] motion-reduce:animate-none">
                    <div className="text-xs font-semibold text-[var(--color-primary-text)] mb-2">{t('pages.doe.enterResponseValues')}</div>
                      <ResponseInputTable runs={designResult.runs} factors={factors} values={responseValues} onChange={updateResponseValue} />
                      <div className="text-xs text-[var(--text-muted)] mt-2">{t('pages.doe.responseFilled', { filled: Object.keys(responseValues).length, total: designResult.runs.length })}</div>
                    </div>
                  )}

                {/* 因子空间可视化 */}
                  {designResult.runs.length >= 2 && factors.length >= 2 && (
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-muted)] mb-2">{t('pages.doe.factorSpaceViz')}</div>
                      <ScatterPlot runs={designResult.runs} factors={factors} values={responseValues} />
                    </div>
                  )}

                  {/* 设计矩阵表格 */}
                  <div className="overflow-x-auto">
                    <table className="data-table w-full text-xs">
                      <thead>
                        <tr>
                          <th className="pr-3 text-left w-10">#</th>
                          {designResult.runs[0]?.coded_levels &&
                            Object.keys(designResult.runs[0].coded_levels).map(k => <th key={k} className="px-2 text-center">{k}</th>)}
                          <th className="pl-2 text-center">{t('pages.doe.addToFitQueue')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {designResult.runs.map(run => (
                          <tr key={run.run_id}>
                            <td className="pr-3 text-[var(--text-muted)] font-mono">{run.run_id}</td>
                            {Object.entries(run.coded_levels).map(([k, v]) => (
                              <td key={k} className="px-2 text-center font-mono text-[var(--color-primary-text)] tabular-nums">{(v as number).toFixed(4)}</td>
                            ))}
                            <td className="pl-2 text-center">
                              {fittingRuns.some(r => r.run_id === run.run_id) ? (
                                <span className="text-xs text-[var(--color-primary-text)]">{t('pages.doe.alreadyInQueue')}</span>
                              ) : (
                                <Button variant="ghost" size="icon" type="button"
                                  onClick={() => {
                                    setFittingRuns(prev => [...prev, run])
                                    setActiveTab('fit')
                                    addToast({ type: 'success', message: t('pages.doe.addedToQueue', { id: run.run_id }) })
                                  }}
                                  aria-label={t('pages.doe.ariaAddToQueue')}
                                  className="text-[var(--color-primary-text)] hover:text-[var(--color-primary-text)] transition-colors">
                                  <Plus size={14} />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                  )}
                </CardContent>
              </Card>
          </div>
        )}

        {/* 响应面拟合标签*/}
        {activeTab === 'fit' && (
          <div className="space-y-6 animate-[fadeSlideIn_.2s_ease-out] motion-reduce:animate-none" id="doe-panel-fit" role="tabpanel" aria-labelledby="doe-tab-fit">
            <Card>
              <CardHeader className="pt-5 pb-0">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle as="h2" className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-[var(--color-primary-text)]" />
                    {t('pages.doe.fitQueue', { count: fittingRuns.length })}
                  </CardTitle>
                  {/* 响应参数选选择*/}
                  <div className="flex items-center gap-2">
                    <label htmlFor="doe-fit-response" className="text-xs text-[var(--text-muted)]">{t('pages.doe.fitResponse')}</label>
                    <Select value={fitResponseParam} onValueChange={(v) => { setFitResponseParam(v); setRespParamTouched(true) }}>
                      <SelectTrigger id="doe-fit-response" className="w-32" aria-label={t('pages.doe.fitResponse')}>
                        <SelectValue placeholder={t('pages.doe.fitResponse')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="y">{t('pages.doe.manualY')}</SelectItem>
                        {responseCandidates.map(n => <SelectItem key={n} value={n}>{t('pages.doe.realData', { name: n })}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-md)]">
                {fittingRuns.length === 0 ? (
                  <div className="text-center py-12 text-[var(--text-muted)]">
                    <FileText size={32} className="mx-auto mb-[var(--space-apple-sm)] opacity-30" />
                    <p className="text-sm">{t('pages.doe.fitEmptyDesc')}</p>
                  </div>
                ) : (
                  <div className="space-y-[var(--space-apple-sm)] max-h-80 overflow-y-auto">
                    {fittingRuns.map(run => (
                      <div key={run.run_id} className="flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-sm)] py-2 bg-[var(--bg-tertiary)]/70 dark:bg-[var(--bg-tertiary)]/40 rounded-[var(--radius-Apple-sm)] flex-wrap">
                        <span className="text-xs font-mono text-[var(--text-muted)] w-6">#{run.run_id}</span>
                        {Object.entries(run.factor_levels ?? run.coded_levels ?? {}).slice(0, 6).map(([k, v]) => (
                          <span key={k} className="text-xs font-mono text-[var(--text-secondary)] tabular-nums">{k}={(v as number).toFixed(2)}</span>
                        ))}
                        {run.response_values && Object.keys(run.response_values).length > 0 && (
                          <span className="text-xs font-mono text-[var(--color-primary-text)]">
                            {Object.entries(run.response_values).map(([k, v]) => `${k}=${(v as number).toFixed(2)}`).join(' ')}
                          </span>
                        )}
                        <Button variant="ghost" size="icon" type="button" onClick={() => handleRemoveRun(run.run_id)} aria-label={t('pages.doe.ariaRemoveFromQueue')}
                          className="ml-auto text-[var(--text-muted)] hover:text-danger-500 transition-colors">
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 手动输入响应（选择 y（手动输入） 或没有真实响应时） */}
                {(fitResponseParam === 'y' || responseCandidates.length === 0) && fittingRuns.length > 0 && (
                  <div className="p-[var(--space-apple-sm)] bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/20 rounded-[var(--radius-Apple-sm)] border border-[var(--color-primary-border)] dark:border-[var(--color-primary)]/40 animate-[fadeSlideIn_.2s_ease-out] motion-reduce:animate-none">
                    <div className="text-xs font-semibold text-[var(--color-primary-text)] mb-2">{t('pages.doe.manualResponseValues')}</div>
                    <ResponseInputTable runs={fittingRuns} factors={factors} values={responseValues} onChange={updateResponseValue} />
                    <div className="text-xs text-[var(--text-muted)] mt-2">{t('pages.doe.responseFilledShort', { filled: Object.keys(responseValues).length, total: fittingRuns.length })}</div>
                  </div>
                )}

                <div className="flex items-center gap-[var(--space-apple-sm)]">
                  <Button onClick={handleFit} disabled={fitPayloadCount < 2} loading={isLoading('fit')}
                    icon={<RefreshCw size={14} />}>
                    {isLoading('fit') ? t('pages.doe.fitInProgress') : t('pages.doe.fitResponseSurface', { param: fitResponseParam })}
                  </Button>
                  {fitPayloadCount < 2 && (
                    <span className="text-xs text-[var(--text-muted)]">{t('pages.doe.fitNeedTwoRuns')}</span>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleClearQueue}
                    className="text-xs">
                    {t('pages.doe.clearQueue')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 拟合结果 */}
            <Card className="border-[var(--color-primary-border)] dark:border-[var(--color-primary)]/60">
                <CardHeader className="pt-5 pb-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle as="h2" className="flex items-center gap-2">
                      <Sparkles size={14} className="text-[var(--color-primary-text)]" />
                      <span className="text-[var(--color-primary-text)]">{t('pages.doe.fitResultTitle', { name: modelRespName })}</span>
                    </CardTitle>
                    {/* 多响应模型选择器（仅当有 2+ 个模型时显示） */}
                    {fitResult && fitResult.length > 1 && (
                      <div className="flex items-center gap-2">
                        <label htmlFor="doe-active-fit" className="text-xs text-[var(--text-muted)]">{t('pages.doe.fitModelSelectorLabel')}</label>
                        <Select value={String(activeFitIdx)} onValueChange={(v) => setActiveFitIdx(Number(v))}>
                          <SelectTrigger id="doe-active-fit" className="w-32" aria-label={t('pages.doe.fitModelSelectorLabel')}>
                            <SelectValue placeholder={t('pages.doe.fitModelSelectorLabel')} />
                          </SelectTrigger>
                          <SelectContent>
                            {fitResult.map((m, i) => (
                              <SelectItem key={i} value={String(i)}>{m?.responses?.[0] ?? m?.responses?.[0] ?? 'y'}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-md)]">
                  {!fitResult || fitResult.length === 0 ? (
                    <div className="text-center py-8 text-[var(--text-muted)]">
                      <FileText size={32} className="mx-auto mb-[var(--space-apple-sm)] opacity-30" />
                      <p className="text-sm">{t('pages.doe.fitEmptyHint')}</p>
                    </div>
                  ) : (
                  <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-[var(--space-apple-md)]">
                    <StatCard label={t('pages.doe.statR2', { name: modelRespName })} value={statVal(fitModel?.r_squared?.y ?? fitModel?.r_squared?.[modelRespName], 4)} icon={TrendingUp} variant="primary" />
                    <StatCard label={t('pages.doe.statAdjR2', { name: modelRespName })} value={statVal(fitModel?.adjusted_r_squared?.y ?? fitModel?.adjusted_r_squared?.[modelRespName], 4)} icon={TrendingUp} variant="secondary" />
                    <StatCard label={t('pages.doe.statRMSE', { name: modelRespName })} value={statVal(fitModel?.rmse?.y ?? fitModel?.rmse?.[modelRespName], 6)} icon={Search} variant="info" />
                    <StatCard label={t('pages.doe.statSignificantTerms')} value={fitModel?.significant_terms?.length ?? t('pages.doe.statNotAvail')} icon={Sparkles} variant="warning" />
                  </div>

                  {/* 回归方程 */}
                  <div className="bg-[var(--bg-tertiary)]/60 rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)]">
                    <div className="text-xs text-[var(--text-muted)] mb-1">{t('pages.doe.regressionEquation')}</div>
                    <div className="font-mono text-sm text-[var(--text-primary)] break-all">{fitModel?.equation}</div>
                  </div>

                  {/* 模型系数表（完整）*/}
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-muted)] mb-2">{t('pages.doe.modelCoefficients')}</div>
                    <div className="overflow-x-auto">
                      <table className="data-table w-full text-xs">
                        <thead>
                          <tr>
                          <th className="pr-3 text-left">#</th>
                            <th className="px-2 text-right">{t('pages.doe.coefficientCol')}</th>
                            <th className="px-2 text-right">{t('pages.doe.statTCol')}</th>
                            <th className="px-2 text-right">{t('pages.doe.statPCol')}</th>
                            <th className="px-2 text-center">{t('pages.doe.significantCol')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(fitModel?.coefficients?.y ?? fitModel?.coefficients?.[modelRespName] ?? {}).map(([term, coef]) => {
                            const sig = fitModel?.significant_terms?.includes(term) ?? false
                            const tval = fitModel?.t_values?.y?.[term] ?? fitModel?.t_values?.[modelRespName]?.[term]
                            const pval = fitModel?.p_values?.y?.[term] ?? fitModel?.p_values?.[modelRespName]?.[term]
                            return (
                              <tr key={term}>
                                <td className="pr-3 font-mono text-[var(--text-secondary)]">{term}</td>
                                <td className="px-2 text-right font-mono text-[var(--text-primary)] tabular-nums">{(coef as number).toFixed(6)}</td>
                                <td className="px-2 text-right font-mono tabular-nums">
                                  {tval == null ? t('pages.doe.statNotAvail') : Number(tval).toFixed(3)}
                                </td>
                                <td className={`px-2 text-right font-mono tabular-nums ${pval != null && Number(pval) < 0.05 ? 'text-[var(--color-primary-text)]' : 'text-[var(--text-muted)]'}`}>
                                  {pval == null ? t('pages.doe.statNotAvail') : Number(pval).toFixed(4)}
                                </td>
                                <td className="px-2 text-center">
                                  {sig
                                    ? <span className="inline-block w-2 h-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)]" role="img" aria-label={t('pages.doe.significant')} />
                                    : <span className="inline-block w-2 h-2 rounded-[var(--radius-pill)] bg-neutral-500" role="img" aria-label={t('pages.doe.notSignificant')} />
                                  }
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 方差分析 (ANOVA) */}
                  {(() => {
                    const anova = fitModel?.anova?.y ?? fitModel?.anova?.[modelRespName]
                    if (!anova) return null
                    const fmt = (v: number | null | undefined) => v == null ? t('pages.doe.statNotAvail') : Number(v).toFixed(4)
                    const pval = anova.p_value
                    return (
                      <div>
                        <div className="text-xs font-semibold text-[var(--text-muted)] mb-2">{t('pages.doe.anovaTitle')}</div>
                        <div className="overflow-x-auto">
                          <table className="data-table w-full text-xs">
                            <thead>
                              <tr>
                                <th className="pr-3 text-left">{t('pages.doe.anovaSourceCol')}</th>
                                <th className="px-2 text-right">{t('pages.doe.anovaSsCol')}</th>
                                <th className="px-2 text-right">{t('pages.doe.anovaDfCol')}</th>
                                <th className="px-2 text-right">{t('pages.doe.anovaMsCol')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="pr-3 text-[var(--text-secondary)]">{t('pages.doe.anovaRegression')}</td>
                                <td className="px-2 text-right font-mono tabular-nums">{fmt(anova.ss_reg)}</td>
                                <td className="px-2 text-right font-mono tabular-nums">{fmt(anova.df_reg)}</td>
                                <td className="px-2 text-right font-mono tabular-nums">{fmt(anova.ms_reg)}</td>
                              </tr>
                              <tr>
                                <td className="pr-3 text-[var(--text-secondary)]">{t('pages.doe.anovaResidual')}</td>
                                <td className="px-2 text-right font-mono tabular-nums">{fmt(anova.ss_res)}</td>
                                <td className="px-2 text-right font-mono tabular-nums">{fmt(anova.df_res)}</td>
                                <td className="px-2 text-right font-mono tabular-nums">{fmt(anova.ms_res)}</td>
                              </tr>
                              <tr>
                                <td className="pr-3 text-[var(--text-secondary)]">{t('pages.doe.anovaTotal')}</td>
                                <td className="px-2 text-right font-mono tabular-nums">{fmt(anova.ss_tot)}</td>
                                <td className="px-2 text-right font-mono tabular-nums">{fmt(anova.df_tot)}</td>
                                <td className="px-2 text-right font-mono tabular-nums">{t('pages.doe.statNotAvail')}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        {/* F 值 / p 值 */}
                        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs">
                          <span className="text-[var(--text-muted)]">{t('pages.doe.anovaFRow')}: <span className="font-mono tabular-nums text-[var(--text-primary)]">{fmt(anova.F)}</span></span>
                          <span className="text-[var(--text-muted)]">{t('pages.doe.anovaPRow')}: <span className={`font-mono tabular-nums ${pval != null && Number(pval) < 0.05 ? 'text-[var(--color-primary-text)]' : 'text-[var(--text-primary)]'}`}>{fmt(pval)}</span></span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* 显著项列表*/}
                  {(fitModel?.significant_terms?.length ?? 0) > 0 && (
                    <div>
                      <div className="text-xs text-[var(--text-muted)] mb-1">{t('pages.doe.significantTermsList')}</div>
                      <div className="flex flex-wrap gap-1">
                        {(fitModel?.significant_terms ?? []).map((t: string, i: number) => (
                          <Badge key={i} variant="success" size="sm" className="font-mono">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  </>
                  )}
                </CardContent>
              </Card>
          </div>
        )}

        {/* 反向搜索标签 */}
        {activeTab === 'search' && (
          <div className="space-y-6 animate-[fadeSlideIn_.2s_ease-out] motion-reduce:animate-none" id="doe-panel-search" role="tabpanel" aria-labelledby="doe-tab-search">
            <Card>
              <CardHeader className="pt-5 pb-0">
                <CardTitle as="h2" className="flex items-center gap-2">
                  <Target size={14} className="text-[var(--color-primary-text)]" />
                  {t('pages.doe.inverseSearch')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-md)]">
                {fitResult ? (
                  <>
                    <div className="max-w-xs">
                    <label htmlFor="doe-target-value" className="text-xs text-[var(--text-muted)] mb-1 block">{t('pages.doe.targetResponseValue', { name: displayRespName })}</label>
                      <Input id="doe-target-value" type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)}
                        className="mt-1 text-sm tabular-nums" />
                    </div>
                    <Button onClick={handleSearch} loading={isLoading('search')}
                      icon={<Search size={14} />}>{t('pages.doe.runInverseSearch')}</Button>
                  </>
                ) : (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                  <p className="text-sm">{t('pages.doe.searchFitFirst')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 搜索结果 */}
            {searchResult && (
              <Card className={searchResult.converged
                ? 'border-[var(--color-primary-border)] dark:border-[var(--color-primary)]/60'
                : 'border-[var(--color-warning-border)] dark:border-[var(--color-warning)]/60'}>
                <CardHeader className="pt-5 pb-0">
                  <CardTitle as="h2" className={`flex items-center gap-2 ${searchResult.converged ? 'text-[var(--color-primary-text)]' : 'text-[var(--color-warning-text)]'}`}>
                    <Sparkles size={14} />
                    {t('pages.doe.searchResultTitle')}{!searchResult.converged && t('pages.doe.searchResultNotConvergedSuffix')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-md)]">
                {/* P2-2 修复：未收敛时强警示，禁用下游操作 */}
                {!searchResult.converged && (
                  <div className="p-[var(--space-apple-sm)] bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/30 rounded-[var(--radius-Apple-sm)] border border-[var(--color-warning-border)] dark:border-[var(--color-warning)] text-xs text-[var(--color-warning-text)]">
                    <div>⚠️ {t('pages.doe.searchNotConvergedWarning')}</div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-[var(--space-apple-md)]">
                  <div className={`rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)] ${searchResult.converged ? 'bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/30' : 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/30'}`}>
                    <div className="text-xs text-[var(--text-muted)] mb-1">{t('pages.doe.convergenceStatus')}</div>
                    <div className={`text-lg font-bold ${searchResult.converged ? 'text-[var(--color-primary-text)]' : 'text-[var(--color-warning-text)]'}`}>
                    {searchResult.converged ? t('pages.doe.converged') : t('pages.doe.notConverged')}
                    </div>
                  </div>
                  <div className="bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/30 rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)]">
                    <div className="text-xs text-[var(--text-muted)] mb-1">{t('pages.doe.feasibilityScore')}</div>
                    <div className="text-lg font-bold text-[var(--color-secondary-text)] tabular-nums">{(searchResult.feasibility_score ?? 0).toFixed(3)}</div>
                  </div>
                  {Object.entries(searchResult.predicted_factors ?? {}).map(([k, v]) => {
                    const ci = searchResult.confidence_interval?.[k]
                    const coded = searchResult.predicted_coded?.[k]
                    return (
                    <div key={k} className="bg-[var(--bg-tertiary)]/60 rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)]">
                        <div className="text-xs text-[var(--text-muted)] mb-1">{t('pages.doe.actualValue', { name: k })}</div>
                        <div className={`text-lg font-bold tabular-nums ${searchResult.converged ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                          {Number(v).toFixed(2)}
                        {!searchResult.converged && <span className="text-xs text-[var(--color-warning-text)] ml-1">≈</span>}
                        </div>
                        {coded != null && <div className="text-xs text-[var(--text-muted)] mt-0.5">{t('pages.doe.codedValue', { value: Number(coded).toFixed(2) })}</div>}
                        {ci && <div className="text-xs text-[var(--text-muted)] mt-0.5">{t('pages.doe.rangeValue', { min: Number(ci[0]).toFixed(2), max: Number(ci[1]).toFixed(2) })}</div>}
                      </div>
                    )
                  })}
                </div>
                {searchResult.iteration_count > 0 && (
                  <div className="text-xs text-[var(--text-muted)]">{t('pages.doe.iterationsCount', { count: searchResult.iteration_count })}</div>
                )}
                {searchResult.converged && (
                  <div className="text-xs text-[var(--color-primary-text)]">
                    {t('pages.doe.suggestNextDoe')}                  </div>
                )}
              </CardContent>
            </Card>
          )}
          </div>
        )}

        {/* 主动学习标签 */}
        {activeTab === 'active' && (
          <div className="space-y-6 animate-[fadeSlideIn_.2s_ease-out] motion-reduce:animate-none" id="doe-panel-active" role="tabpanel" aria-labelledby="doe-tab-active">
            <Card>
              <CardHeader className="pt-5 pb-0">
                <CardTitle as="h2" className="flex items-center gap-2">
                  <Lightbulb size={14} className="text-[var(--color-warning-text)]" />
                  {t('pages.doe.activeLearning')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-md)]">
                <p className="text-xs text-[var(--text-muted)]">
                  {t('pages.doe.activeLearningDesc')}
                </p>
                <div className="flex items-center gap-[var(--space-apple-sm)]">
                  <div className="flex items-center">
                    <Button variant="warning" onClick={handleActiveLearning}
                      disabled={fitPayloadCount < 2} loading={isLoading('active')}
                      icon={<Lightbulb size={14} />}>
                      {isLoading('active') ? t('pages.doe.computing') : t('pages.doe.recommendPoints', { count: 3 })}
                    </Button>
                  </div>
                </div>
                {fitPayloadCount < 2 && (
                  <div className="text-xs text-[var(--text-muted)]">
                    {fittingRuns.length === 0 ? t('pages.doe.activeLearningNeedRuns') : t('pages.doe.fitNeedTwoRuns')}
                  </div>
                )}
              </CardContent>
            </Card>

            {activeLearningResult.length > 0 && (
              <Card className="border-[var(--color-warning-border)] dark:border-[var(--color-warning)]/60">
                <CardHeader className="pt-5 pb-0">
                  <CardTitle as="h2" className="flex items-center gap-2">
                    <Sparkles size={14} className="text-[var(--color-warning-text)]" />
                    <span className="text-[var(--color-warning-text)]">{t('pages.doe.recommendedPointsTitle')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-md)]">
                  <div className="overflow-x-auto">
                    <table className="data-table w-full text-xs">
                      <thead>
                        <tr>
                          <th className="pr-2 text-left w-10">#</th>
                          {Object.keys(activeLearningResult[0]?.coded_levels ?? {}).map(k => (
                            <th key={k} className="px-2 text-center">{k}</th>
                          ))}
                          {Object.keys(activeLearningResult[0]?.factor_levels ?? {}).map(k => (
                            <th key={`fl-${k}`} className="px-2 text-center text-[var(--color-warning-text)]">{t('pages.doe.actualValue', { name: k })}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeLearningResult.map((rec: any, i: number) => (
                          <tr key={i}>
                            <td className="pr-2 text-[var(--text-muted)] font-mono">{rec.run_id}</td>
                            {Object.entries(rec.coded_levels ?? {}).map(([k, v]) => (
                              <td key={k} className="px-2 text-center font-mono text-[var(--color-primary-text)] tabular-nums">{(v as number).toFixed(4)}</td>
                            ))}
                            {Object.entries(rec.factor_levels ?? {}).map(([k, v]) => (
                              <td key={`fl-${k}`} className="px-2 text-center font-mono text-[var(--color-warning-text)] tabular-nums">{(v as number).toFixed(2)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {activeStrategy && (
                    <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                      <Badge variant="warning" size="sm" className="font-mono">{activeStrategy}</Badge>
                      {t('pages.doe.samplingStrategy')}
                      <Badge variant="info" size="sm" className="font-mono">{t('pages.doe.activeLearningCount', { count: activeLearningResult.length })}</Badge>
                    </div>
                  )}
                  <div className="text-xs text-[var(--text-muted)]">
                    {t('pages.doe.activeLearningHint')}
                  </div>
                  <div className="pt-3 border-t border-[var(--border-color)]">
                    <Button variant="warning" size="sm" onClick={handleExportRecommendations}
                      disabled={!closeLoopExpId} loading={isLoading('export')}
                      icon={<Send size={13} />} className="text-xs">
                      {t('pages.doe.writeBackPoints', { id: closeLoopExpId ?? '—' })}
                    </Button>
                    {!closeLoopExpId && (
                      <div className="mt-1.5 text-xs text-[var(--text-muted)]">{t('pages.doe.exportNeedsSource')}</div>
                    )}
                    <div className="mt-1.5 text-xs text-[var(--text-muted)]">
                      {t('pages.doe.sourceLabel', { source: importedMeta ? t('pages.doe.sourceExperiment', { id: importedMeta.expId }) : seedMeta ? t('pages.doe.sourceSeed', { name: seedMeta.formulaName, id: seedMeta.experimentId }) : '-' })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
      </div>
      </div>
  )
}
