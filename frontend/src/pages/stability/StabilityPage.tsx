/**
 * 稳定性分析页面 — 完整功能版
 * Arrhenius 温度加速降解预测 + 交互式图表 + 多条件对比 + Q10 温度系数
 * 主题系统：对齐 Dashboard 设计系统规范（bg-grid + brand banner + Card/Button + design tokens）
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Thermometer, ShieldAlert, Zap, FlaskConical, TrendingDown,
  Activity, AlertTriangle, Save, Layers,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, ReferenceLine, Area,
} from 'recharts'
import { stabilityApi, type StabilityIngredient } from '@/api/stability'
import { useToast } from '@/components/ui/Toast'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'

const KNOWN_HERBS = [
  '黄芪多糖', '枸杞多糖', '茯苓多糖',
  '灵芝多糖', '山药多糖', '人参皂苷', '人参皂苷Rg1',
  '黄芪苷IV', '甘草酸', '大豆异黄酮', '槲皮素', '葛根素',
  '芦丁', '大豆肽', '胶原蛋白肽', '乳清蛋白肽',
  '鱼胶原蛋白肽', '维生素C', '维生素E', 'B族维生素',
  '姜黄素', '褪黑素', '枸杞提取物', '山药提取物',
]

const STORAGE_KEY = 'rmfood_stability_history'
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] } }
const saveHistory = (items: any[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 20)))

/** 主题色序列（recharts 折线）— 引用设计令牌变量，明暗主题自动切换 */
const CHART_COLORS = [
  'var(--color-success)',
  'var(--color-secondary)',
  'var(--color-warning)',
  'var(--color-error)',
  'var(--color-accent)',
]

/** 主题色序列（图例圆点）— 与折线一致 */
const CHART_LEGEND = [
  'bg-[var(--color-success-container)]0',
  'bg-[var(--color-secondary-container)]0',
  'bg-[var(--color-warning-container)]0',
  'bg-danger-500',
  'bg-[var(--color-accent-container)]0',
]

export default function StabilityPage() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [ingredients, setIngredients] = useState<StabilityIngredient[]>([
    { name: '黄芪多糖', dosage_mg: 3000 },
    { name: '维生素C', dosage_mg: 500 },
    { name: '胶原蛋白肽', dosage_mg: 2000 },
  ])
  const [storageTemp, setStorageTemp] = useState(25)
  const [humidity, setHumidity] = useState(60)
  const [lightExposure, setLightExposure] = useState('normal')
  const [packaging, setPackaging] = useState<"standard"|"amber_bottle"|"vacuum"|"nitrogen_flushed">("standard")
  const [months, setMonths] = useState(24)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<any[]>(loadHistory)
  const [showHistory, setShowHistory] = useState(false)
  const [compareResults, setCompareResults] = useState<any[]>([])
  const [q10Tab, setQ10Tab] = useState(false)
  const [q10T1, setQ10T1] = useState(25)
  const [q10T2, setQ10T2] = useState(40)
  const [q10Result, setQ10Result] = useState<any>(null)

  const addIngredient = () => setIngredients([...ingredients, { name: '', dosage_mg: 1000 }])
  const updateIngredient = (i: number, field: string, value: string | number) => {
    const next = [...ingredients]; next[i] = { ...next[i], [field]: value }; setIngredients(next)
  }
  const removeIngredient = (i: number) => setIngredients(ingredients.filter((_, idx) => idx !== i))

  const buildPayload = () => ({
    ingredients, storage_temp: storageTemp, storage_humidity: humidity,
    light_exposure: lightExposure as any, packaging, months_to_predict: months,
  })

  const runPredict = async (forCompare = false) => {
    setLoading(true)
    try {
      const res = await stabilityApi.predict(buildPayload())
      const data = res.data?.data ?? res.data
      if (forCompare) {
        setCompareResults(prev => [...prev, { ...data, label: t('pages.stability.compareLabel', { temp: storageTemp, humidity }), temp: storageTemp, humidity }])
        addToast({ type: 'success', message: t('pages.stability.toastCompareAdded', { temp: storageTemp, humidity }) })
      } else {
        setResult(data)
        const histItem = { id: Date.now(), ingredients: ingredients.filter(i => i.name).map(i => i.name), temp: storageTemp, humidity, packaging, months, score: data.stability_score, shelfLife: data.estimated_shelf_life_months, date: new Date().toLocaleDateString() }
        const newHistory = [histItem, ...history].slice(0, 20)
        setHistory(newHistory); saveHistory(newHistory)
        addToast({ type: 'success', message: t('pages.stability.toastPredictionDone', { months: data.estimated_shelf_life_months?.toFixed(1) }) })
      }
    } catch (e: any) {
      addToast({ type: 'error', message: t('pages.stability.toastPredictFailed', { message: e?.response?.data?.detail ?? e?.message ?? '未知错误' }) })
    } finally { setLoading(false) }
  }

  const scoreColor = (s: number) => s >= 0.7 ? 'text-[var(--color-success-text)]0 dark:text-[var(--color-success-text)]' : s >= 0.4 ? 'text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]' : 'text-danger-500 dark:text-danger-600'
  const scoreBg = (s: number) => s >= 0.7 ? 'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/20 border-[var(--color-success-border)] dark:border-success-900' : s >= 0.4 ? 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/20 border-[var(--color-warning-border)] dark:border-warning-900' : 'bg-danger-50 dark:bg-danger-950/20 border-danger-200 dark:border-danger-900'

  const chartData = result?.monthly_curve?.map((pt: any) => ({
    month: pt.month, remaining: +(pt.remaining_pct * 100).toFixed(2),
  })) ?? []

  const runQ10 = async () => {
    setLoading(true)
    try {
      const res: any = await stabilityApi.q10({ ingredients, t1: q10T1, t2: q10T2 })
      const data = res.data?.data ?? res.data
      setQ10Result(data)
    } catch (e: any) { addToast({ type: 'error', message: String(e) }) }
    finally { setLoading(false) }
  }

  const q10Interpretation = (v: number) =>
    v < 1.5 ? t('pages.stability.q10Interpretation.insensitive') :
    v < 2.5 ? t('pages.stability.q10Interpretation.moderate') :
    v < 4 ? t('pages.stability.q10Interpretation.high') :
    t('pages.stability.q10Interpretation.extreme')

  const selectClass = 'h-9 px-2 text-sm rounded-[var(--radius-Apple-sm)] border border-input bg-transparent text-[var(--text-primary)] shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)] space-y-[var(--space-apple-md)]">
        {/* 页头横幅 — 对齐 Dashboard 品牌横幅规范 */}
        <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-semibold leading-snug tracking-tight flex items-center gap-2">
                <Thermometer size={20} className="text-white/80 shrink-0" />
                {t('pages.stability.title')}
              </h1>
              <p className="mt-1 text-white/80 text-sm">{t('pages.stability.subtitle')}</p>
            </div>
            {history.length > 0 && (
              <button onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 px-[var(--space-apple-sm)] py-1.5 min-h-[44px] text-xs font-medium bg-[var(--bg-secondary)]/15 hover:bg-[var(--bg-secondary)]/25 rounded-[var(--radius-pill)] transition-colors">
                <Save size={12} />{t('pages.stability.history', { count: history.length })}
              </button>
            )}
          </div>
        </div>

        {/* 历史记录 */}
        {showHistory && history.length > 0 && (
          <Card>
            <CardContent className="p-[var(--space-apple-md)]">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wide">{t('pages.stability.recentPredictions')}</div>
              <div className="flex gap-2 flex-wrap">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-2 px-[var(--space-apple-sm)] py-1.5 bg-[var(--bg-tertiary)]/60 rounded-[var(--radius-Apple-sm)] text-xs">
                    <span className="font-mono text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]">{h.temp}°C</span>
                    <span className="text-[var(--text-muted)]">{h.ingredients.slice(0, 2).join('+')}...</span>
                    <span className="text-[var(--text-muted)]">{t('pages.stability.shelfLifeShort', { months: h.shelfLife?.toFixed(1) })}</span>
                    <span className="text-[var(--text-muted)] dark:text-[var(--text-muted)]">{h.date}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {/* 配方成分 */}
          <Card>
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                  <FlaskConical size={14} className="text-[var(--color-secondary-text)]0 dark:text-[var(--color-secondary-text)]" />
                  {t('pages.stability.formulaIngredients')}
                </CardTitle>
                <Button variant="secondary" size="sm" onClick={addIngredient} icon={<FlaskConical size={12} />} className="text-xs">
                  {t('pages.stability.addIngredient')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0 space-y-2">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex items-center gap-[var(--space-apple-sm)]">
                  <select value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)}
                    className={`flex-1 ${selectClass}`}>
                    <option value="">{t('pages.stability.selectIngredient')}...</option>
                    {KNOWN_HERBS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <Input type="number" value={ing.dosage_mg}
                    onChange={e => updateIngredient(i, 'dosage_mg', parseFloat(e.target.value) || 0)}
                    className="w-24 h-9 text-center tabular-nums" />
                  <span className="text-xs text-[var(--text-muted)] w-8">mg</span>
                  <Button variant="ghost" size="sm" onClick={() => removeIngredient(i)} disabled={ingredients.length <= 1}
                    icon={<ShieldAlert size={14} />} className="text-[var(--text-muted)] hover:text-danger-500 dark:hover:text-danger-400" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 储存条件 */}
          <Card>
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                <Thermometer size={14} className="text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]" />
                {t('pages.stability.storageConditions')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-md)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">{t('pages.stability.temperature')}</label>
                  <input type="range" min={-20} max={60} value={storageTemp} onChange={e => setStorageTemp(+e.target.value)} className="w-full accent-[var(--color-primary)]" aria-label={t('pages.stability.temperature')} />
                  <div className="text-right text-sm font-mono text-[var(--text-secondary)]">{storageTemp}°C</div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">{t('pages.stability.humidity')}</label>
                  <input type="range" min={0} max={100} value={humidity} onChange={e => setHumidity(+e.target.value)} className="w-full accent-[var(--color-primary)]" aria-label={t('pages.stability.humidity')} />
                  <div className="text-right text-sm font-mono text-[var(--text-secondary)]">{humidity}%</div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">{t('pages.stability.lightCondition')}</label>
                  <select value={lightExposure} onChange={e => setLightExposure(e.target.value)} className={`w-full ${selectClass}`}>
                    <option value="dark">{t('pages.stability.dark')}</option>
                    <option value="normal">{t('pages.stability.normal')}</option>
                    <option value="bright">{t('pages.stability.bright')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">{t('pages.stability.packaging')}</label>
                  <select value={packaging} onChange={e => setPackaging(e.target.value as any)} className={`w-full ${selectClass}`}>
                    <option value="standard">{t('pages.stability.standard')}</option>
                    <option value="amber_bottle">{t('pages.stability.amberBottle')}</option>
                    <option value="vacuum">{t('pages.stability.vacuum')}</option>
                    <option value="nitrogen_flushed">{t('pages.stability.nitrogenFlushed')}</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-[var(--space-apple-sm)]">
                <span className="text-xs text-[var(--text-muted)] shrink-0">{t('pages.stability.predictMonths')}</span>
                <input type="range" min={6} max={60} step={6} value={months} onChange={e => setMonths(+e.target.value)} className="flex-1 accent-[var(--color-primary)]" aria-label={t('pages.stability.predictMonths')} />
                <span className="text-sm font-mono text-[var(--text-secondary)] w-12 text-right shrink-0">{t('pages.stability.monthsUnit', { months })}</span>
              </div>
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex gap-[var(--space-apple-sm)] flex-wrap">
            <Button onClick={() => runPredict(false)} disabled={loading} icon={<Activity size={14} />}>
              {loading ? t('pages.stability.running') : t('pages.stability.runStabilityPrediction')}
            </Button>
            <Button variant="secondary" onClick={() => runPredict(true)} disabled={loading} icon={<Layers size={14} />}>
              {t('pages.stability.addToCompare')}
            </Button>
            <Button variant={q10Tab ? 'warning' : 'outline'} onClick={() => setQ10Tab(!q10Tab)}
              icon={<Zap size={14} />}>
              {t('pages.stability.q10Coefficient')}
            </Button>
          </div>

          {/* 多条件对比图表 */}
          {compareResults.length > 1 && (
            <Card>
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                  <Layers size={14} className="text-[var(--color-secondary-text)]0 dark:text-[var(--color-secondary-text)]" />
                  {t('pages.stability.multiConditionCompare')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-sm)]">
                <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                  <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} label={{ value: t('pages.stability.monthAxis'), position: 'bottom', offset: 0, fontSize: 12, fill: 'var(--text-muted)' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} label={{ value: t('pages.stability.retentionRate'), angle: -90, position: 'left', offset: 0, fontSize: 12, fill: 'var(--text-muted)' }} />
                    <RechartsTooltip contentStyle={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }} />
                    <Legend />
                    <ReferenceLine y={90} stroke="var(--color-success)" strokeDasharray="3 3" label={{ value: t('pages.stability.threshold90'), position: 'right', fontSize: 10, fill: 'var(--color-success)' }} />
                    <ReferenceLine y={80} stroke="var(--color-warning)" strokeDasharray="3 3" label={{ value: t('pages.stability.threshold80'), position: 'right', fontSize: 10, fill: 'var(--color-warning)' }} />
                    {compareResults.map((cr, idx) => {
                      const data = cr.monthly_curve?.map((pt: any) => ({ month: pt.month, remaining: +(pt.remaining_pct * 100).toFixed(2) })) ?? []
                      return <Line key={idx} type="monotone" data={data} dataKey="remaining" name={cr.label} stroke={CHART_COLORS[idx % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                    })}
                  </LineChart>
                </ResponsiveContainer></div>
                <div className="flex gap-4 text-xs text-[var(--text-muted)] flex-wrap">
                  {compareResults.map((cr, idx) => (
                    <span key={idx} className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-[var(--radius-pill)] ${CHART_LEGEND[idx % CHART_LEGEND.length]}`} />{cr.label}
                    </span>
                  ))}
                </div>
                <button onClick={() => setCompareResults([])} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-muted)]">{t('pages.stability.clearCompare')}</button>
              </CardContent>
            </Card>
          )}

          {/* 预测结果 */}
          {result && (
            <div className="space-y-[var(--space-apple-md)]">
              {/* 结果指标卡片 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`rounded-[var(--radius-Apple-md)] p-[var(--space-apple-md)] border ${scoreBg(result.stability_score)}`}>
                  <div className="text-xs text-[var(--text-muted)] mb-1">{t('pages.stability.stabilityScore')}</div>
                  <div className={`text-2xl font-bold ${scoreColor(result.stability_score)}`}>{(result.stability_score * 100).toFixed(1)}%</div>
                  <div className="w-full bg-[var(--border-color)] rounded-[var(--radius-pill)] h-1.5 mt-2"><div className="bg-[var(--color-success-container)]0 h-1.5 rounded-[var(--radius-pill)] transition-all" style={{ width: `${result.stability_score * 100}%` }} /></div>
                </div>
                <div className="rounded-[var(--radius-Apple-md)] p-[var(--space-apple-md)] bg-[var(--bg-secondary)] border border-[var(--border-color)] dark:border-neutral-800">
                  <div className="text-xs text-[var(--text-muted)] mb-1">{t('pages.stability.estimatedShelfLife')}</div>
                  <div className="text-2xl font-bold text-neutral-800 dark:text-[var(--text-primary)]">{result.estimated_shelf_life_months.toFixed(1)} <span className="text-sm font-normal text-[var(--text-muted)]">{t('pages.stability.monthUnit')}</span></div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{t('pages.stability.shelfLifeDetail', { m90: result.shelf_life_details?.months_to_90?.toFixed(1), m80: result.shelf_life_details?.months_to_80?.toFixed(1) })}</div>
                </div>
                <div className="rounded-[var(--radius-Apple-md)] p-[var(--space-apple-md)] bg-[var(--bg-secondary)] border border-[var(--border-color)] dark:border-neutral-800">
                  <div className="text-xs text-[var(--text-muted)] mb-1">{t('pages.stability.confidence')}</div>
                  <div className="text-2xl font-bold text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]">{((result.shelf_life_details?.confidence ?? 0) * 100).toFixed(0)}%</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{t('pages.stability.basedOnDatabase')}</div>
                </div>
                <div className="rounded-[var(--radius-Apple-md)] p-[var(--space-apple-md)] bg-[var(--bg-secondary)] border border-[var(--border-color)] dark:border-neutral-800">
                  <div className="text-xs text-[var(--text-muted)] mb-1">{t('pages.stability.riskItems')}</div>
                  <div className={`text-2xl font-bold ${result.risk_factors.length > 2 ? 'text-danger-500 dark:text-danger-600' : result.risk_factors.length > 0 ? 'text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]' : 'text-[var(--color-success-text)]0 dark:text-[var(--color-success-text)]'}`}>{result.risk_factors.length}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{t('pages.stability.riskItemsDesc')}</div>
                </div>
              </div>

              {/* 降解曲线 */}
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                    <TrendingDown size={14} className="text-[var(--color-success-text)]0 dark:text-[var(--color-success-text)]" />
                    {t('pages.stability.degradationCurve')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-sm)]">
                  <div className="h-72"><ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} label={{ value: t('pages.stability.monthAxis'), position: 'bottom', offset: 0, fontSize: 12, fill: 'var(--text-muted)' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} label={{ value: t('pages.stability.retentionRate'), angle: -90, position: 'left', offset: 0, fontSize: 12, fill: 'var(--text-muted)' }} />
                      <RechartsTooltip contentStyle={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }} />
                      <Legend />
                      <ReferenceLine y={90} stroke="var(--color-success)" strokeDasharray="3 3" label={{ value: t('pages.stability.pass90'), position: 'right', fontSize: 10, fill: 'var(--color-success)' }} />
                      <ReferenceLine y={80} stroke="var(--color-warning)" strokeDasharray="3 3" label={{ value: t('pages.stability.warn80'), position: 'right', fontSize: 10, fill: 'var(--color-warning)' }} />
                      <Area type="monotone" dataKey="remaining" name={t('pages.stability.retentionLegend')} stroke="var(--color-success)" fill="var(--color-success)" fillOpacity={0.1} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer></div>
                  <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] flex-wrap">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-[var(--radius-pill)] bg-[var(--color-success-container)]0" />{t('pages.stability.qualified')}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-[var(--radius-pill)] bg-[var(--color-warning-container)]0" />{t('pages.stability.needAttention')}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-[var(--radius-pill)] bg-danger-500" />{t('pages.stability.unqualified')}</span>
                  </div>
                </CardContent>
              </Card>

              {/* 风险因子 */}
              {result.risk_factors.length > 0 && (
                <Card className="border-[var(--color-warning-border)] dark:border-[var(--color-warning)]/60">
                  <CardHeader className="px-5 pt-5 pb-3">
                    <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle size={14} className="text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]" />
                      {t('pages.stability.riskFactors')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 pt-0 space-y-2">
                    {result.risk_factors.map((rf: any, i: number) => (
                      <div key={i} className="flex items-start gap-[var(--space-apple-sm)] px-[var(--space-apple-sm)] py-2 bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/20 rounded-[var(--radius-Apple-sm)] border border-[var(--color-warning-border)] dark:border-warning-900">
                        <Zap size={12} className="text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)] mt-0.5 shrink-0" />
                        <span className="text-sm text-[var(--text-primary)] flex-1">{rf.description}</span>
                        <span className="text-xs font-mono text-[var(--text-muted)] shrink-0">{t('pages.stability.severity', { value: (rf.severity * 100).toFixed(0) })}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* 储存建议 */}
              <Card className="border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)]/60">
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                    <ShieldAlert size={14} className="text-[var(--color-secondary-text)]0 dark:text-[var(--color-secondary-text)]" />
                    {t('pages.stability.storageAdvice')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-2">
                  {result.storage_advice.map((advice: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 px-[var(--space-apple-sm)] py-2 bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 rounded-[var(--radius-Apple-sm)] border border-[var(--color-secondary-border)] dark:border-secondary-900">
                      <span className="text-[var(--color-secondary-text)]0 dark:text-[var(--color-secondary-text)] mt-0.5 shrink-0">→</span>
                      <span className="text-sm text-[var(--text-primary)]">{advice}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Q10 温度系数 */}
          {q10Tab && (
            <Card className="border-[var(--color-warning-border)] dark:border-[var(--color-warning)]/60">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                  <Zap size={14} className="text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]" />
                  {t('pages.stability.q10Title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-md)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-[var(--text-muted)] mb-1 block">{t('pages.stability.t1')}</label>
                    <Input type="number" value={q10T1} onChange={e => setQ10T1(+e.target.value)} className="h-9 tabular-nums" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)] mb-1 block">{t('pages.stability.t2')}</label>
                    <Input type="number" value={q10T2} onChange={e => setQ10T2(+e.target.value)} className="h-9 tabular-nums" />
                  </div>
                </div>
                <Button variant="warning" onClick={runQ10} disabled={loading}
                  icon={<Zap size={14} className={loading ? 'animate-pulse' : ''} />}>
                  {loading ? t('pages.stability.running') : t('pages.stability.calculateQ10')}
                </Button>
                {q10Result != null && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/20 rounded-[var(--radius-Apple-md)] p-[var(--space-apple-md)] border border-[var(--color-warning-border)] dark:border-warning-900">
                      <div className="text-xs text-[var(--text-muted)] mb-1">{t('pages.stability.q10Value')}</div>
                      <div className="text-3xl font-bold text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]">{q10Result.q10?.toFixed(2)}</div>
                    </div>
                    <div className="bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 rounded-[var(--radius-Apple-md)] p-[var(--space-apple-md)] border border-[var(--color-secondary-border)] dark:border-secondary-900">
                      <div className="text-xs text-[var(--text-muted)] mb-1">{t('pages.stability.temperatureRange')}</div>
                      <div className="text-lg font-bold text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]">{q10Result.t1_celsius}°C → {q10Result.t2_celsius}°C</div>
                    </div>
                    <div className="bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/20 rounded-[var(--radius-Apple-md)] p-[var(--space-apple-md)] border border-[var(--color-success-border)] dark:border-success-900 md:col-span-1">
                      <div className="text-xs text-[var(--text-muted)] mb-1">{t('pages.stability.storageSuggestion')}</div>
                      <div className="text-sm font-medium text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">{q10Interpretation(q10Result.q10)}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
