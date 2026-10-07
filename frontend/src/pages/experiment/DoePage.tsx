/**
 * DOE 实验设计页面 — 完整功能版 * CCD / BBD / 混料 设计矩阵 + 多响应面拟合 + 反向搜索 + 主动学习 + 散点图 *
 * 真实数据链路? *   实验管理(实验ID） /doe/experiments/{id}/runs  → runs(真实参数） 选择响应值 /doe/fit
 *   配方种子          /doe/seed-from-formula/{id}  → runs(成分占比因子+真实响应） /doe/fit
 */
import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Beaker, Plus, Trash2, Play, Search, Sparkles, TrendingUp,
  ChevronRight, FileText, Target, RefreshCw,
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
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, StatCard } from '@/components/ui'

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
  return (
    <div className="flex items-center gap-3 p-3 bg-neutral-50/70 dark:bg-neutral-800/40 rounded-lg border border-neutral-200 dark:border-neutral-700">
      <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500 w-6">{index + 1}</span>
      <Input className="flex-1 h-8 text-sm"
        placeholder="因子名称（例如：温度）" value={factor.name}
        onChange={e => onChange({ ...factor, name: e.target.value })} />
      {(['low', 'high', 'center'] as const).map(k => (
        <div key={k} className="flex flex-col items-center gap-1">
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">{k === 'low' ? '低水平 (-1)' : k === 'high' ? '高水平 (+1)' : '中心点 (0)'}</span>
          <Input type="number" step="0.1"
            className="w-20 h-8 text-sm text-center tabular-nums"
            value={factor[k]}
            onChange={e => onChange({ ...factor, [k]: parseFloat(e.target.value) || 0 })} />
        </div>
      ))}
      <button onClick={onRemove} disabled={!canRemove}
        className="p-1.5 rounded-md hover:bg-danger-50 dark:hover:bg-danger-950/40 text-neutral-400 dark:text-neutral-500 hover:text-danger-500 disabled:opacity-30 transition-colors">
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function MixtureComponentRow({ comp, index, onChange, onRemove }: {
  comp: { name: string; lower: number; upper: number }; index: number
  onChange: (c: { name: string; lower: number; upper: number }) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-neutral-50/70 dark:bg-neutral-800/40 rounded-lg border border-neutral-200 dark:border-neutral-700">
      <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500 w-6">{index + 1}</span>
      <Input className="flex-1 h-8 text-sm"
        placeholder="组分名称（例如：黄芪）" value={comp.name}
        onChange={e => onChange({ ...comp, name: e.target.value })} />
      {(['lower', 'upper'] as const).map(k => (
        <div key={k} className="flex flex-col items-center gap-1">
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">{k === 'lower' ? '下限' : '上限'}</span>
          <Input type="number" step="0.01"
            className="w-20 h-8 text-sm text-center tabular-nums"
            value={comp[k]}
            onChange={e => onChange({ ...comp, [k]: parseFloat(e.target.value) || 0 })} />
        </div>
      ))}
      <button onClick={onRemove} className="p-1.5 rounded-md hover:bg-danger-50 dark:hover:bg-danger-950/40 text-neutral-400 dark:text-neutral-500 hover:text-danger-500 transition-colors">
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function ResponseInputTable({ runs, factors, values, onChange, autoFill }: {
  runs: DOERun[]
  factors: DOEFactor[]
  values: Record<number, number>
  onChange: (runId: number, v: number) => void
  autoFill?: (run: DOERun) => number | null
}) {
  const factorNames = factors.map(f => f.name)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500">
            <th className="pb-2 pr-2 text-left w-10">#</th>
            {factorNames.map(name => <th key={name} className="pb-2 px-2 text-center min-w-[80px]">{name}</th>)}
            <th className="pb-2 px-2 text-center min-w-[100px]">响应值?y)</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => {
            const shown = values[run.run_id] ?? (autoFill ? autoFill(run) : undefined)
            return (
              <tr key={run.run_id} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:bg-neutral-800 dark:hover:bg-neutral-800/50">
                <td className="py-2 pr-2 text-neutral-500 dark:text-neutral-400 font-mono">{run.run_id}</td>
                {factorNames.map(name => (
                  <td key={name} className="py-2 px-2 text-center font-mono text-neutral-600 dark:text-neutral-300 tabular-nums">
                    {((run.factor_levels?.[name] ?? run.coded_levels?.[name] ?? 0) as number).toFixed(2)}
                  </td>
                ))}
                <td className="py-2 px-2">
                  <Input type="number" step="0.01" value={shown ?? ''}
                    onChange={e => onChange(run.run_id, parseFloat(e.target.value) || 0)}
                    placeholder="输入响应值"
                    className="h-7 w-full text-center tabular-nums" />
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
      <div className="h-56 flex items-center justify-center text-neutral-400 dark:text-neutral-500 text-sm bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
        请输入至少组响应值以生成分散图      </div>
    )
  }
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, rgba(148,163,184,0.12))" opacity={0.35} />
          <XAxis type="number" dataKey="x" name={f1} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-color)' }} tickLine={{ stroke: 'var(--border-color)' }} label={{ value: f1, position: 'bottom', offset: 0, fontSize: 11, fill: 'var(--text-muted)' }} />
          <YAxis type="number" dataKey="y" name={f2} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-color)' }} tickLine={{ stroke: 'var(--border-color)' }} label={{ value: f2, angle: -90, position: 'left', offset: 0, fontSize: 11, fill: 'var(--text-muted)' }} />
          <ZAxis type="number" dataKey="z" range={[60, 400]} name="响应值" />
          <RechartsTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const d = payload[0].payload as any
              return (
                <div className="bg-card border border-neutral-200 dark:border-neutral-700 rounded-lg p-2 text-xs shadow-lg">
                  <div className="font-semibold mb-1">第#{d.run_id} 组</div>
                  <div>{f1}: {d.f1_val.toFixed(2)}</div>
                  <div>{f2}: {d.f2_val.toFixed(2)}</div>
                  <div className="text-primary-600 dark:text-primary-400 font-bold">响应值 {d.z.toFixed(2)}</div>
                </div>
              )
            }}
          />
          <Legend />
          <Scatter name="散点" data={scatterData} fill="var(--color-primary, #10b981)" fillOpacity={0.7} />
        </ScatterChart>
      </ResponsiveContainer>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center mt-1">
        气泡大小 = 响应值· X值= {f1} · Y值= {f2}
      </p>
    </div>
  )
}

export default function DoePage() {
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
  const [designResult, setDesignResult] = useState<null | { type: string; runs: DOERun[]; notes: string }>(null)
  const [showResponseInput, setShowResponseInput] = useState(false)
  const [responseValues, setResponseValues] = useState<Record<number, number>>({})
  const [fittingRuns, setFittingRuns] = useState<DOERun[]>([])
  const [fitResult, setFitResult] = useState<FittedModel[] | null>(null)
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
  const [seedRespParam, setSeedRespParam] = useState('感官评分')
  const [seedExpId, setSeedExpId] = useState('')
  const [seedMeta, setSeedMeta] = useState<null | {
    formulaId: number; formulaName: string; totalRuns: number; responseParam: string
    experimentId: number | null; responsePool: number[]
  }>(null)
  // 拟合响应参数选择（默认'y'，可改为真实参数名）
  const [fitResponseParam, setFitResponseParam] = useState('y')
  // P2-1：记录用户是否手动改过响应参数；一旦手动改过，不再被自动切换覆盖
  const [respParamTouched, setRespParamTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<any[]>(loadHistory)
  const [showHistory, setShowHistory] = useState(false)

  // 从 fittingRuns → response_values 自动推导可用响应参数
  const responseCandidates = useMemo(() => deriveResponseNames(fittingRuns), [fittingRuns])

  // 当 fittingRuns 变化时，自动把默认响应参数切到首个真实参数（P2-1 修复：仅当用户没有手动改过 respParamTouched=false 时才自动切换，尊重用户选择）
  useEffect(() => {
    if (!respParamTouched && responseCandidates.length > 0 && fitResponseParam === 'y') {
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
        addToast({ type: 'warning', message: `配方列表为空（API 返回 total=${imp?.total ?? '?'})，请确认 /doe/formulas 端点正常` })
      }
    }).catch((e: any) => {
      if (cancelled) return
      if (import.meta.env.DEV) console.warn('[DOE] listSeedFormulas failed', e?.response?.status, e?.response?.data ?? e)
      addToast({ type: 'error', message: `加载配方列表失败 ${e?.response?.status ?? e?.message}` })
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
    if (!fid) { addToast({ type: 'warning', message: '请选择至少一个配方' }); return }
    setLoading(true)
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
          addToast({ type: 'warning', message: '该配方无法生成种子（有效成分不足 2 个）' })
          return
        }
        setFittingRuns(runs)
        setFactors((imp.factors ?? []).map((f: any) => ({ name: f.name, low: f.low, high: f.high, center: f.center })))
        // P0-1：seedMeta 携带 experimentId主动学习闭环可写回该实验
        setSeedMeta({
          formulaId: fid,
          formulaName: imp.formula?.name ?? `配方 ${fid}`,
          totalRuns: runs.length,
          responseParam: imp.response_parameter ?? '感官评分',
          experimentId: imp.experiment_id ?? expId ?? null,
          responsePool: imp.response_pool ?? [],
        })
        // 自动把拟合响应参数指向种子真实响应值
        const firstResp = Object.keys(runs[0]?.response_values ?? {})
        if (firstResp.length > 0) setFitResponseParam(firstResp[0])
        const pool = imp.response_pool ?? []
        const poolNote = pool.length > 1 ? `，响应池 ${pool.length} 个不同真实响应` : ''
        addToast({ type: 'success', message: `已用真实配方{imp.formula?.name}」生成${runs.length} 组种子（响应：{imp.response_parameter}${poolNote}）` })
        setActiveTab('fit')
      } catch (e: any) {
        addToast({ type: 'error', message: e?.response?.data?.detail ?? String(e) })
      } finally {
        setLoading(false)
      }
    })()
  }

    // 从实验管理跳转进来时（doe?exp=12）自动填入实验ID 并导入
  useEffect(() => {
    const expParam = searchParams.get('exp')
    if (expParam) {
      setExpIdInput(expParam)
      handleImportFromExperiment(expParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 从实验管理导入数据自动填充因子 + 拟合队列
  const handleImportFromExperiment = (expIdOverride?: string) => {
    const expIdRaw = expIdOverride ?? expIdInput
    const expId = parseInt(expIdRaw, 10)
    if (!expId) { addToast({ type: 'warning', message: '请输入实验ID' }); return }
    setLoading(true)
    ;(async () => {
      try {
        const imp: any = await doeApi.importExperimentRuns(expId, respParamInput ? { response_parameter: respParamInput } : undefined)
        const runs: DOERun[] = imp?.runs ?? []
        if (runs.length === 0) {
          addToast({ type: 'warning', message: '该实验暂无可导入的运行（数据点为空或无时间戳）' })
          return
        }
        const factorNames = (imp.factors ?? []).map((f: any) => f.name)
        setFittingRuns(runs)
        if (imp.factors?.length) {
          setFactors((imp.factors ?? []).map((f: any) => ({ name: f.name, low: f.low, high: f.high, center: f.center })))
        }
        const respCands: string[] = imp.response_candidates ?? []
        setImportedMeta({ expId, totalRuns: runs.length, factors: factorNames, responseCandidates: respCands })
        // 自动把拟合响应参数指向导入的真实响应
        if (respCands.length > 0) setFitResponseParam(respCands[0])
        addToast({ type: 'success', message: `已导入 ${runs.length} 组运行（实验 ${expId}，响应候选 ${respCands.length} 个）` })
        setActiveTab('fit')
        if (expIdOverride && searchParams.get('exp')) {
          setSearchParams({}, { replace: true })
        }
      } catch (e: any) {
        addToast({ type: 'error', message: e?.response?.data?.detail ?? String(e) })
      } finally {
        setLoading(false)
      }
    })()
  }

  // 把主动学习推荐写回实验管理（闭环）  // P0-1：支持两种来源 — 实验导入(importedMeta) 或 配方种子(seedMeta.experimentId)
  const closeLoopExpId = importedMeta?.expId ?? seedMeta?.experimentId ?? null
  const handleExportRecommendations = async () => {
    if (activeLearningResult.length === 0) { addToast({ type: 'warning', message: '暂无可导出的推荐点' }); return }
    const targetExp = closeLoopExpId
    if (!targetExp) {
      addToast({ type: 'warning', message: importedMeta
        ? '实验导入来源缺少 expId'
        : '请先在从实验导入数据，或在配方种子中填写实验ID 再导出推荐点' })
      return
    }
    setLoading(true)
    try {
      const body: any = await doeApi.exportToExperiment({
        experiment_id: targetExp,
        recommendations: activeLearningResult,
        note: `strategy=${activeStrategy || 'auto'}${seedMeta?.formulaName ? ` seed=${seedMeta.formulaName}` : ''}`,
      })
      const imp = body?.data ?? body
      addToast({ type: 'success', message: `已写回 ${imp.created_data_points ?? 0} 个数据点到实验 ${targetExp}` })
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.detail ?? String(e) })
    } finally {
      setLoading(false)
    }
  }

  const handleActiveLearning = async () => {
    if (fittingRuns.length === 0) { addToast({ type: 'warning', message: '请先在在拟合队列中添加加实验数据' }); return }
    setLoading(true)
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
      addToast({ type: 'success', message: `已推荐${recs.length} 组新实验验点（策略{imp.strategy ?? 'default'}）` })
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.detail ?? String(e) })
    } finally {
      setLoading(false)
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
    if (factors.length < 2) { addToast({ type: 'warning', message: '请至少添加 2 个因子' }); return }
    setLoading(true)
    try {
      const res = await doeApi[type === 'ccd' ? 'generateCCD' : 'generateBBD']({ factors, n_center_points: Math.max(6, factors.length * 2) })
      const data = res.data?.data ?? res.data
      setDesignResult({ type, runs: data.runs ?? [], notes: data.notes ?? '' })
      setFittingRuns(data.runs ?? []); setResponseValues({}); setShowResponseInput(false); setSearchResult(null)
      addToast({ type: 'success', message: `已生成${data.total_runs} 组实验设计` })
    } catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail ?? String(e) }) }
    finally { setLoading(false) }
  }

  const handleGenerateMixture = async () => {
    if (mixtureComponents.length < 2) { addToast({ type: 'warning', message: '混料设计至少需要 2 个组分' }); return }
    setLoading(true)
    try {
      const res = await doeApi.generateMixture({
        components: mixtureComponents.map(c => ({ name: c.name, lower: Math.min(c.lower, c.upper), upper: Math.max(c.lower, c.upper) })),
        design_type: mixtureDesignType,
        degree: mixtureDesignType === 'lattice' ? mixtureDegree : 3,
      })
      const data = res.data?.data ?? res.data
      setDesignResult({ type: `mixture_${mixtureDesignType}`, runs: data.runs ?? [], notes: data.notes ?? '' })
      setFittingRuns(data.runs ?? []); setResponseValues({}); setShowResponseInput(false); setSearchResult(null)
      addToast({ type: 'success', message: `已生成${data.total_runs} 组混料设计` })
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.detail ?? String(e) })
    } finally {
      setLoading(false)
    }
  }

  const handleFit = async () => {
    // P0-2 修复：保留真实响应名。后端 /fit 接受任意 response_names，模型 responses/equation/coefficients/r_squared 都会用该真实参数名（不再使用 'y'）
    const runsWithResponses = buildFittingPayload(fitResponseParam)
    if (runsWithResponses.length < 2) {
    addToast({ type: 'warning', message: `至少需要 2 组带响应值(${fitResponseParam})的实验才能拟合` })
      return
    }
    setLoading(true)
    try {
      const res = await doeApi.fitResponseSurface({
        runs: runsWithResponses,
      response_names: [fitResponseParam],  // 真实参数名（如 "感官评分"），而非 'y'
        include_interaction: true,
        include_quadratic: true,
      })
      const models = res.data?.models ?? res.data
      setFitResult(models); setSearchResult(null)
      const r2 = models?.[0]?.r_squared?.[fitResponseParam] ?? 0
      addToast({ type: 'success', message: `拟合「${fitResponseParam}」完成，R² = ${Number(r2).toFixed(4)}` })
    } catch (e: any) { addToast({ type: 'error', message: e?.response?.data?.detail ?? String(e) }) }
    finally { setLoading(false) }
  }
  const handleSearch = async () => {
    if (!fitResult?.length || !fitResult[0]) { addToast({ type: 'warning', message: '请先在「响应面拟合」标签页执行模型拟合' }); return }
    setLoading(true)
    try {
      // 把因子实际值单位范围(low/high)传给后端 → 反解回实际值
      const factor_bounds: Record<string, [number, number]> = {}
      for (const f of factors) factor_bounds[f.name] = [f.low, f.high]
      // P0-2：target_values 用真实响应名（与 fit 的 response_names 一致），模型才能匹配
      const targetKey = fitResponseParam
      const res: any = await doeApi.inverseSearch({
        model: fitResult[0],
        target_values: { [targetKey]: parseFloat(targetValue) || 50 },
        factor_bounds,
      })
      const data = res.data ?? res
      setSearchResult(data)
      addToast({ type: 'success', message: data.converged ? '反向搜索已收敛' : '搜索未收敛，结果可能不精确（仅供参考）' })
    } catch (e: any) { addToast({ type: 'error', message: String(e) }) }
    finally { setLoading(false) }
  }

  const handleSaveDesign = () => {
    if (!designResult) return
    const item = { id: Date.now(), type: designResult.type.toUpperCase(), factors: factors.map(f => f.name), runs: designResult.runs.length, date: new Date().toLocaleDateString() }
    const newHistory = [item, ...history].slice(0, 20)
    setHistory(newHistory); saveHistory(newHistory)
    addToast({ type: 'success', message: '设计已保存到历史记录' })
  }

  /** 一键把整张设计矩阵加入拟合队列（去重），并跳到拟合标签页 */
  const handleAddAllToFitting = () => {
    if (!designResult) return
    const existing = new Set(fittingRuns.map(r => r.run_id))
    const newRuns = designResult.runs.filter(r => !existing.has(r.run_id))
    if (newRuns.length === 0) {
      addToast({ type: 'info', message: '该设计的所有组均已在拟合队列中' })
      return
    }
    setFittingRuns(prev => [...prev, ...newRuns])
    setActiveTab('fit')
    addToast({ type: 'success', message: `已将 ${newRuns.length} 组设计加入拟合队列（跳过 ${designResult.runs.length - newRuns.length} 组已存在）` })
  }

  // 当前要展示的响应参数名（用于 fit 结果 R² 标签）
  const displayRespName = fitResponseParam

  return (
    <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      {/* 页头横幅 — 对齐 Dashboard 品牌横幅规范 */}
      <div className="surface-primary rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold leading-snug tracking-tight flex items-center gap-2">
              <Beaker size={20} className="text-white/80 shrink-0" />
              DOE 实验设计
            </h2>
            <p className="mt-1 text-white/80 text-sm">CCD / BBD / 混料设计 · 多响应面拟合 · 反向搜索 · 主动学习闭环</p>
          </div>
          {history.length > 0 && (
            <button onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-neutral-900/15 hover:bg-white dark:bg-neutral-900/25 rounded-full transition-colors">
              <ClipboardList size={12} />历史记录 ({history.length})
            </button>
          )}
        </div>
      </div>

      {/* 历史记录 */}
      {showHistory && history.length > 0 && (
        <Card>
          <CardContent className="p-4">
              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wide">最近设计</div>
            <div className="flex gap-2 flex-wrap">
              {history.map(h => (
                <div key={h.id} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg text-xs">
                  <span className="font-mono text-primary-600 dark:text-primary-400">{h.type}</span>
                  <span className="text-neutral-400 dark:text-neutral-500">{h.factors.join('×')}</span>
                    <span className="text-neutral-400 dark:text-neutral-500">· {h.runs} 组</span>
                  <span className="text-neutral-400 dark:text-neutral-500">{h.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 实验管理 → DOE 导入DOE 导入 */}
      <Card className="border-primary-200 dark:border-primary-800/60">
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
            <FolderInput size={14} className="text-primary-500 dark:text-primary-400" />
            <span className="text-primary-700 dark:text-primary-300">从实验管理导入</span>
            <span className="text-xs font-normal text-neutral-400 dark:text-neutral-500 ml-1">读取真实实验数据点，自动推断因子/响应，直接进入响应面拟合</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-0">
          <div className="flex flex-wrap items-center gap-3">
            <Input value={expIdInput} onChange={e => setExpIdInput(e.target.value)}
              placeholder="实验 ID（如 12）" className="w-32 h-9 text-sm" />
            <Input value={respParamInput} onChange={e => setRespParamInput(e.target.value)}
                  placeholder="响应参数名（可选，留空=全部）" className="w-48 h-9 text-sm" />
            <Button onClick={() => handleImportFromExperiment()} disabled={loading}
              icon={<FolderInput size={14} />}>导入</Button>
            {importedMeta && (
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">已导入实验 #{importedMeta.expId}：{importedMeta.totalRuns} 组 · 响应候选 [{importedMeta.responseCandidates.join(', ')}]</span>
            )}
          </div>
        </CardContent>
      </Card>

        {/* 配方 → DOE 种子生成（真实配方成分占比，非模拟） */}
      <Card>
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
            <FlaskConical size={14} className="text-secondary-500 dark:text-secondary-400" />
            <span className="text-secondary-600 dark:text-secondary-400">从配方生成种子</span>
            <span className="text-xs font-normal text-neutral-400 dark:text-neutral-500 ml-1">读取真实配方的成分占比作因子、真实实验指标作响应，生成可直接拟合的DOE 种子运行</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-0">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => doeApi.listSeedFormulas().then((body: any) => {
              const imp = body?.data ?? body
              setSeedFormulas(Array.isArray(imp?.formulas) ? imp.formulas : [])
      if (import.meta.env.DEV) console.log('[DOE] 重新加载配方', imp?.formulas?.length ?? 0)
            }).catch((e: any) => {
              if (import.meta.env.DEV) console.warn('[DOE] 重新加载配方失败', e?.response?.status, e?.response?.data ?? e)
              addToast({ type: 'error', message: `重新加载配方失败 ` })
            })}
              className="text-xs"
              icon={<RefreshCw size={12} />}>重新加载配方</Button>
            <select value={seedFormulaId} onChange={e => setSeedFormulaId(e.target.value)}
              className="w-44 h-9 px-3 text-sm rounded-md border border-input bg-transparent text-neutral-900 dark:text-neutral-100 shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">选择配方</option>
              {seedFormulas.map(f => (
                <option key={f.id} value={f.id}>{f.name}（{f.id}）</option>
              ))}
            </select>
            <Input value={seedRespParam} onChange={e => setSeedRespParam(e.target.value)}
              placeholder="响应参数名（默认：感官评分）" className="w-48 h-9 text-sm" />
            <Input value={seedExpId} onChange={e => setSeedExpId(e.target.value)}
              placeholder="实验 ID（可选，决定响应值来源）" className="w-40 h-9 text-sm" />
            <Button variant="secondary" onClick={handleSeedFromFormula} disabled={loading || !seedFormulaId}
              icon={<FlaskConical size={14} />}>生成种子</Button>
            {seedMeta && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      已用「{seedMeta.formulaName}」生成 {seedMeta.totalRuns} 组种子（响应：{seedMeta.responseParam}）
                {seedMeta.responsePool?.length > 1 ? ` · 响应池 ${seedMeta.responsePool.length} 个` : ''}
              </span>
            )}
          </div>
          {seedFormulas.length === 0 && (
                <div className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">暂无真实配方数据可作种子。请确认 /doe/formulas 端点是否返回数据，或点击「重新加载配方」</div>
          )}
        </CardContent>
      </Card>

      {/* 标签对齐设计系统 Apple Segmented Control 规范 */}
      <div className="mt-4">
      <div className="tabs-list w-fit">
        {[
          { key: 'design' as const, label: '实验设计', icon: Play },
          { key: 'fit' as const, label: '响应面拟合', icon: TrendingUp },
          { key: 'search' as const, label: '反向搜索', icon: Search },
          { key: 'active' as const, label: '主动学习', icon: Lightbulb },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`tabs-trigger ${activeTab === tab.key ? 'tabs-trigger-active' : ''}`}>
            <span className="icon"><tab.icon size={14} /></span>
            {tab.label}
          </button>
        ))}
      </div>
      </div>

      <div className="mt-6 space-y-6">
        {/* 实验设计标签 */}
        {activeTab === 'design' && (
          <div className="space-y-6">
            {/* 因子设置 */}
            <Card>
              <CardHeader className="px-5 pt-5 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                    <Plus size={14} className="text-primary-500 dark:text-primary-400" />因子设置（CCD / BBD）
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addFactor} icon={<Plus size={12} />} className="text-xs">添加因子</Button>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-2">
                <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                  <span className="w-6">#</span><span className="flex-1">因子名称</span>
                  <span className="w-20 text-center">低水平(-1)</span>
                  <span className="w-20 text-center">高水平(+1)</span>
                  <span className="w-20 text-center">中心点(0)</span>
                  <span className="w-8" />
                </div>
                {factors.map((f, i) => (
                  <FactorRow key={i} factor={f} index={i} onChange={v => updateFactor(i, v)} onRemove={() => removeFactor(i)} canRemove={factors.length > 2} />
                ))}
              </CardContent>
            </Card>

            {/* 混料设计设置 */}
            <Card className="border-secondary-200 dark:border-secondary-800/60">
              <CardHeader className="px-5 pt-5 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                    <PieChart size={14} className="text-secondary-500 dark:text-secondary-400" />混料设计（Mixture，组分比例之和 = 1）
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addMixtureComponent} icon={<Plus size={12} />} className="text-xs">添加组分</Button>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                    <span className="w-6">#</span><span className="flex-1">组分名称</span>
                    <span className="w-20 text-center">下限(0~1)</span>
                    <span className="w-20 text-center">上限(0~1)</span>
                    <span className="w-8" />
                  </div>
                  {mixtureComponents.map((c, i) => (
                    <MixtureComponentRow key={i} comp={c} index={i} onChange={v => updateMixtureComponent(i, v)} onRemove={() => removeMixtureComponent(i)} />
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400">设计类型</span>
                    <select value={mixtureDesignType} onChange={e => setMixtureDesignType(e.target.value as any)}
                      className="h-8 px-2 text-xs rounded-md border border-input bg-transparent text-neutral-900 dark:text-neutral-100 shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="lattice">网格（Lattice）</option>
                      <option value="centroid">重心（Centroid）</option>
                    </select>
                  </div>
                  {mixtureDesignType === 'lattice' && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-neutral-500 dark:text-neutral-400">阶数</span>
                      <select value={mixtureDegree} onChange={e => setMixtureDegree(parseInt(e.target.value, 10))}
                        className="h-8 px-2 text-xs rounded-md border border-input bg-transparent text-neutral-900 dark:text-neutral-100 shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                        <option value={2}>2（二阶）</option>
                        <option value={3}>3（三阶）</option>
                      </select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 生成按钮 */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => handleGenerate('ccd')} disabled={loading}
                icon={<Play size={14} />}>生成 CCD 设计</Button>
              <Button variant="secondary" onClick={() => handleGenerate('bbd')} disabled={loading}
                icon={<Play size={14} />}>生成 BBD 设计</Button>
              <Button variant="outline" onClick={handleGenerateMixture} disabled={loading}
                icon={<PieChart size={14} />}>生成混料设计</Button>
              {designResult && <Button variant="ghost" onClick={handleSaveDesign}
                icon={<Save size={14} />}>保存设计</Button>}
            </div>

            {/* 设计结果 */}
            {designResult && (
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                      <Sparkles size={14} className="text-primary-500 dark:text-primary-400" />
                      {designResult.type.toUpperCase()} 设计矩阵
                    </CardTitle>
                    <div className="flex items-center gap-2">
                    <Badge variant="neutral" size="sm">{designResult.runs.length} 组</Badge>
                      <Button size="sm" onClick={handleAddAllToFitting}
                        icon={<TrendingUp size={12} />} className="text-xs">
                        全部加入拟合
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowResponseInput(!showResponseInput)}
                        icon={showResponseInput ? <EyeOff size={12} /> : <Eye size={12} />} className="text-xs">
                        {showResponseInput ? '收起响应输入' : '输入响应值'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-4">
                  {designResult.notes && <p className="text-xs text-neutral-500 dark:text-neutral-400 px-1">{designResult.notes}</p>}

                  {/* 响应值输出*/}
                  {showResponseInput && (
                    <div className="p-3 bg-primary-50 dark:bg-primary-950/20 rounded-lg border border-primary-200 dark:border-primary-900">
                    <div className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-2">请输入实验响应值（y）</div>
                      <ResponseInputTable runs={designResult.runs} factors={factors} values={responseValues} onChange={updateResponseValue} />
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">{Object.keys(responseValues).length} / {designResult.runs.length} 组响应已填写</div>
                    </div>
                  )}

                {/* 因子空间可视化 */}
                  {designResult.runs.length >= 2 && factors.length >= 2 && (
                    <div>
                      <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">因子空间可视化化（前两个因子）</div>
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
                          <th className="pl-2 text-center">加入拟合队列</th>
                        </tr>
                      </thead>
                      <tbody>
                        {designResult.runs.map(run => (
                          <tr key={run.run_id}>
                            <td className="pr-3 text-neutral-500 dark:text-neutral-400 font-mono">{run.run_id}</td>
                            {Object.entries(run.coded_levels).map(([k, v]) => (
                              <td key={k} className="px-2 text-center font-mono text-primary-600 dark:text-primary-400 tabular-nums">{(v as number).toFixed(4)}</td>
                            ))}
                            <td className="pl-2">
                              {fittingRuns.some(r => r.run_id === run.run_id) ? (
                                <span className="text-xs text-primary-500 dark:text-primary-400">已在队列</span>
                              ) : (
                                <button
                                  onClick={() => {
                                    setFittingRuns(prev => [...prev, run])
                                    addToast({ type: 'success', message: `已将 #${run.run_id} 加入拟合队列` })
                                  }}
                                  className="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300 transition-colors">
                                  <ChevronRight size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* 响应面拟合标签*/}
        {activeTab === 'fit' && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="px-5 pt-5 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp size={14} className="text-primary-500 dark:text-primary-400" />
                    拟合队列（{fittingRuns.length} 组）
                  </CardTitle>
                  {/* 响应参数选选择*/}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-neutral-500 dark:text-neutral-400">拟合响应</label>
                    <select value={fitResponseParam}
                      onChange={e => { setFitResponseParam(e.target.value); setRespParamTouched(true) }}
                      className="h-8 px-2 text-xs rounded-md border border-input bg-transparent text-neutral-900 dark:text-neutral-100 shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="y">y（手动输入）</option>
                      {responseCandidates.map(n => <option key={n} value={n}>{n}（真实数据）</option>)}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-4">
                {fittingRuns.length === 0 ? (
                  <div className="text-center py-12 text-neutral-400 dark:text-neutral-500">
                    <FileText size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">请通过上方「实验管理导入」或「配方种子」获取真实数据，或在「实验设计」标签页添加</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {fittingRuns.map(run => (
                      <div key={run.run_id} className="flex items-center gap-3 px-3 py-2 bg-neutral-50/70 dark:bg-neutral-800/40 rounded-lg flex-wrap">
                        <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500 w-6">#{run.run_id}</span>
                        {Object.entries(run.factor_levels ?? run.coded_levels ?? {}).slice(0, 6).map(([k, v]) => (
                          <span key={k} className="text-xs font-mono text-neutral-600 dark:text-neutral-300 tabular-nums">{k}={(v as number).toFixed(2)}</span>
                        ))}
                        {run.response_values && Object.keys(run.response_values).length > 0 && (
                          <span className="text-xs font-mono text-primary-600 dark:text-primary-400">
                            {Object.entries(run.response_values).map(([k, v]) => `${k}=${(v as number).toFixed(2)}`).join(' ')}
                          </span>
                        )}
                        <button onClick={() => setFittingRuns(fittingRuns.filter(r => r.run_id !== run.run_id))}
                          className="ml-auto text-neutral-400 dark:text-neutral-500 hover:text-danger-500 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 手动输入响应（选择 y（手动输入） 或没有真实响应时） */}
                {(fitResponseParam === 'y' || responseCandidates.length === 0) && fittingRuns.length > 0 && (
                  <div className="p-3 bg-primary-50 dark:bg-primary-950/20 rounded-lg border border-primary-200 dark:border-primary-900">
                    <div className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-2">手动输入响应值（y组</div>
                    <ResponseInputTable runs={fittingRuns} factors={factors} values={responseValues} onChange={updateResponseValue} />
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">{Object.keys(responseValues).length} / {fittingRuns.length} 组已填写</div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button onClick={handleFit} disabled={loading || fittingRuns.length < 2}
                    icon={loading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}>
                    {loading ? '拟合中..' : `拟合「${fitResponseParam}」响应面`}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setFittingRuns([]); setResponseValues({}); setFitResult(null); setSearchResult(null) }}
                    className="text-xs">
                    清空队列
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 拟合结果 */}
            {fitResult && (
              <Card className="border-primary-200 dark:border-primary-800/60">
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles size={14} className="text-primary-500 dark:text-primary-400" />
                    <span className="text-primary-700 dark:text-primary-300">拟合结果（响应：{displayRespName}）</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label={`R² (${displayRespName})`} value={Number((fitResult[0]?.r_squared?.y ?? fitResult[0]?.r_squared?.[displayRespName] ?? 0).toFixed(4))} icon={TrendingUp} variant="primary" />
                    <StatCard label={`Adj R² (${displayRespName})`} value={Number((fitResult[0]?.adjusted_r_squared?.y ?? fitResult[0]?.adjusted_r_squared?.[displayRespName] ?? 0).toFixed(4))} icon={TrendingUp} variant="secondary" />
                    <StatCard label={`RMSE (${displayRespName})`} value={Number((fitResult[0]?.rmse?.y ?? fitResult[0]?.rmse?.[displayRespName] ?? 0).toFixed(6))} icon={Search} variant="info" />
                    <StatCard label="显著项数" value={(fitResult[0]?.significant_terms?.length ?? 0)} icon={Sparkles} variant="warning" />
                  </div>

                  {/* 回归方程 */}
                  <div className="bg-neutral-50 dark:bg-neutral-800/60 rounded-lg p-3">
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">回归方程</div>
                    <div className="font-mono text-sm text-neutral-700 dark:text-neutral-300 break-all">{fitResult[0]?.equation}</div>
                  </div>

                  {/* 模型系数表（完整）*/}
                  <div>
                    <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">模型系数</div>
                    <div className="overflow-x-auto">
                      <table className="data-table w-full text-xs">
                        <thead>
                          <tr>
                          <th className="pr-3 text-left">#</th>
                            <th className="px-2 text-right">系数</th>
                            <th className="px-2 text-center">显著</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(fitResult[0]?.coefficients?.y ?? fitResult[0]?.coefficients?.[displayRespName] ?? {}).map(([term, coef]) => {
                            const sig = fitResult[0]?.significant_terms?.includes(term) ?? false
                            return (
                              <tr key={term}>
                                <td className="pr-3 font-mono text-neutral-600 dark:text-neutral-300">{term}</td>
                                <td className="px-2 text-right font-mono text-neutral-700 dark:text-neutral-200 tabular-nums">{(coef as number).toFixed(6)}</td>
                                <td className="px-2 text-center">
                                  {sig
                                    ? <span className="inline-block w-2 h-2 rounded-full bg-primary-500" title="显著" />
                                    : <span className="inline-block w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600" title="不显著" />
                                  }
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 显著项列表*/}
                  {(fitResult[0]?.significant_terms?.length ?? 0) > 0 && (
                    <div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">显著项列表（|b| &gt; 2·RMSE）</div>
                      <div className="flex flex-wrap gap-1">
                        {(fitResult[0]?.significant_terms ?? []).map((t: string, i: number) => (
                          <Badge key={i} variant="success" size="sm" className="font-mono">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* 反向搜索标签 */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                  <Target size={14} className="text-primary-500 dark:text-primary-400" />
                  反向参数搜索
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-4">
                {fitResult ? (
                  <>
                    <div className="max-w-xs">
                    <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">目标响应值（{displayRespName}）</label>
                      <Input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)}
                        className="mt-1 h-9 text-sm tabular-nums" />
                      <Input placeholder="例如 85" className="mt-1 h-9 text-sm tabular-nums" />
                    </div>
                    <Button onClick={handleSearch} disabled={loading}
                      icon={<Search size={14} />}>执行反向搜索</Button>
                  </>
                ) : (
                  <div className="text-center py-8 text-neutral-400 dark:text-neutral-500">
                  <p className="text-sm">请先在「响应面拟合」标签页完成模型拟合</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 搜索结果 */}
            {searchResult && (
              <Card className={searchResult.converged
                ? 'border-primary-200 dark:border-primary-800/60'
                : 'border-warning-300 dark:border-warning-800/60'}>
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h3" className={`text-sm font-semibold flex items-center gap-2 ${searchResult.converged ? 'text-primary-700 dark:text-primary-300' : 'text-warning-600 dark:text-warning-400'}`}>
                    <Sparkles size={14} />
                    搜索结果{!searchResult.converged && '（未收敛，仅供参考）'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-4">
                {/* P2-2 修复：未收敛时强警示，禁用下游操作 */}
                {!searchResult.converged && (
                  <div className="p-3 bg-warning-50 dark:bg-warning-950/30 rounded-lg border border-warning-200 dark:border-warning-800 text-xs text-warning-700 dark:text-warning-400">
                    <div>⚠️ 本次搜索未收敛：梯度可能停在局部极小，或目标值超出响应面可达范围。以下数值仅供参考，请勿直接用于生产决策。建议：调整目标值或扩大 factor_bounds，或增加拟合样本后重试。</div>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className={`rounded-lg p-3 ${searchResult.converged ? 'bg-primary-50 dark:bg-primary-950/30' : 'bg-warning-50 dark:bg-warning-950/30'}`}>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">收敛状态</div>
                    <div className={`text-lg font-bold ${searchResult.converged ? 'text-primary-500 dark:text-primary-400' : 'text-warning-600 dark:text-warning-400'}`}>
                    {searchResult.converged ? '✓ 已收敛' : '✗ 未收敛'}
                    </div>
                  </div>
                  <div className="bg-secondary-50 dark:bg-secondary-950/30 rounded-lg p-3">
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">可行性评分</div>
                    <div className="text-lg font-bold text-secondary-600 dark:text-secondary-400 tabular-nums">{(searchResult.feasibility_score ?? 0).toFixed(3)}</div>
                  </div>
                  {Object.entries(searchResult.predicted_factors ?? {}).map(([k, v]) => {
                    const ci = searchResult.confidence_interval?.[k]
                    const coded = searchResult.predicted_coded?.[k]
                    return (
                    <div key={k} className="bg-neutral-50 dark:bg-neutral-800/60 rounded-lg p-3">
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">{k}（实际值）</div>
                        <div className={`text-lg font-bold tabular-nums ${searchResult.converged ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-500 dark:text-neutral-400'}`}>
                          {Number(v).toFixed(2)}
                        {!searchResult.converged && <span className="text-xs text-warning-600 dark:text-warning-400 ml-1">≈</span>}
                        </div>
                        {coded != null && <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">编码 {Number(coded).toFixed(2)}</div>}
                        {ci && <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">范围 [{Number(ci[0]).toFixed(2)}, {Number(ci[1]).toFixed(2)}]</div>}
                      </div>
                    )
                  })}
                </div>
                {searchResult.iteration_count > 0 && (
                  <div className="text-xs text-neutral-400 dark:text-neutral-500">迭代 {searchResult.iteration_count} 组</div>
                )}
                {searchResult.converged && (
                  <div className="text-xs text-primary-600 dark:text-primary-400">
                    建议：将以上因子组合纳入下一个DOE实验验证                  </div>
                )}
              </CardContent>
            </Card>
          )}
          </div>
        )}

        {/* 主动学习标签 */}
        {activeTab === 'active' && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                  <Lightbulb size={14} className="text-warning-500 dark:text-warning-400" />
                  主动学习推荐
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-4">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  基于已有实验数据，使用不确定性采样策略推荐下一批最优实验点，最大化信息增益。
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-between">
                    <Button variant="warning" onClick={handleActiveLearning}
                      disabled={loading || fittingRuns.length === 0}
                      icon={<Lightbulb size={14} className={loading ? 'animate-pulse' : ''} />}>
                      {loading ? '计算中...' : '推荐 3 组新实验点'}
                    </Button>
                  </div>
                </div>
                {fittingRuns.length === 0 && (
                  <div className="text-xs text-neutral-400 dark:text-neutral-500">请先在「实验设计」标签页将实验组加入拟合队列</div>
                )}
              </CardContent>
            </Card>

            {activeLearningResult.length > 0 && (
              <Card className="border-warning-200 dark:border-warning-800/60">
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles size={14} className="text-warning-500 dark:text-warning-400" />
                    <span className="text-warning-700 dark:text-warning-400">推荐实验点</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="data-table w-full text-xs">
                      <thead>
                        <tr>
                          <th className="pr-2 text-left w-10">#</th>
                          {Object.keys(activeLearningResult[0]?.coded_levels ?? {}).map(k => (
                            <th key={k} className="px-2 text-center">{k}</th>
                          ))}
                          {Object.keys(activeLearningResult[0]?.factor_levels ?? {}).map(k => (
                            <th key={`fl-${k}`} className="px-2 text-center text-warning-700 dark:text-warning-400">{k}（实际值）</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeLearningResult.map((rec: any, i: number) => (
                          <tr key={i}>
                            <td className="pr-2 text-neutral-500 dark:text-neutral-400 font-mono">{rec.run_id}</td>
                            {Object.entries(rec.coded_levels ?? {}).map(([k, v]) => (
                              <td key={k} className="px-2 text-center font-mono text-primary-600 dark:text-primary-400 tabular-nums">{(v as number).toFixed(4)}</td>
                            ))}
                            {Object.entries(rec.factor_levels ?? {}).map(([k, v]) => (
                              <td key={`fl-${k}`} className="px-2 text-center font-mono text-warning-700 dark:text-warning-400 tabular-nums">{(v as number).toFixed(2)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {activeStrategy && (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                      <Badge variant="warning" size="sm" className="font-mono">{activeStrategy}</Badge>
                      采样策略
                    </div>
                  )}
                  <div className="text-xs text-neutral-400 dark:text-neutral-500">
                    提示：将以上推荐点加入实验队列，执行实验后回填响应值，可进一步改善响应面模型精度。
                  </div>
                  {closeLoopExpId && (
                    <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
                      <Button variant="warning" size="sm" onClick={handleExportRecommendations} disabled={loading}
                        icon={<Send size={13} />} className="text-xs">
                        把推荐点写回实验 {closeLoopExpId}（闭环）
                      </Button>
                      <div className="mt-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
                        来源：{importedMeta ? `实验导入 #${importedMeta.expId}` : seedMeta ? `配方种子「${seedMeta.formulaName}」→ 实验 ${seedMeta.experimentId}` : '-'}
                      </div>
                    </div>
                  )}
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
