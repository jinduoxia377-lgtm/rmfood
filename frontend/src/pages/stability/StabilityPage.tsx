/**
 * 稳定性分析页面 — 完整功能版
 * Arrhenius 温度加速降解预测 + 交互式图表 + 多条件对比 + Q10 温度系数
 * 主题系统：对齐 Dashboard 设计系统规范（bg-grid + brand banner + Card/Button + design tokens）
 */
import { useState } from 'react'
import {
  Thermometer, Clock, ShieldAlert, Zap, FlaskConical, TrendingDown,
  Activity, AlertTriangle, Save, Download, Layers,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, ReferenceLine, Area,
} from 'recharts'
import { stabilityApi, type StabilityIngredient } from '@/api/stability'
import { useToast } from '@/components/ui/Toast'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui'

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
  'bg-success-500',
  'bg-secondary-500',
  'bg-warning-500',
  'bg-danger-500',
  'bg-accent-500',
]

export default function StabilityPage() {
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
  const [compareMode, setCompareMode] = useState(false)
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
        setCompareResults(prev => [...prev, { ...data, label: `${storageTemp}°C/${humidity}%RH`, temp: storageTemp, humidity }])
        addToast({ type: 'success', message: `已加入对比（${storageTemp}°C / ${humidity}%RH）` })
      } else {
        setResult(data)
        const histItem = { id: Date.now(), ingredients: ingredients.filter(i => i.name).map(i => i.name), temp: storageTemp, humidity, packaging, months, score: data.stability_score, shelfLife: data.estimated_shelf_life_months, date: new Date().toLocaleDateString() }
        const newHistory = [histItem, ...history].slice(0, 20)
        setHistory(newHistory); saveHistory(newHistory)
        addToast({ type: 'success', message: `预测完成，货架期 ${data.estimated_shelf_life_months?.toFixed(1)} 月` })
      }
    } catch (e: any) {
      addToast({ type: 'error', message: `预测失败：${e?.response?.data?.detail ?? e?.message ?? '未知错误'}` })
    } finally { setLoading(false) }
  }

  const scoreColor = (s: number) => s >= 0.7 ? 'text-success-500 dark:text-success-400' : s >= 0.4 ? 'text-warning-500 dark:text-warning-400' : 'text-danger-500 dark:text-danger-400'
  const scoreBg = (s: number) => s >= 0.7 ? 'bg-success-50 dark:bg-success-950/20 border-success-200 dark:border-success-900' : s >= 0.4 ? 'bg-warning-50 dark:bg-warning-950/20 border-warning-200 dark:border-warning-900' : 'bg-danger-50 dark:bg-danger-950/20 border-danger-200 dark:border-danger-900'

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
    v < 1.5 ? '温度不敏感，常温储存即可' :
    v < 2.5 ? '中等敏感，建议阴凉储存' :
    v < 4 ? '高度敏感，建议冷链运输' :
    '极端敏感，必须严格冷链'

  const selectClass = 'h-9 px-2 text-sm rounded-md border border-input bg-transparent text-neutral-900 dark:text-neutral-100 shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* 页头横幅 — 对齐 Dashboard 品牌横幅规范 */}
        <div className="surface-primary rounded-xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-semibold leading-snug tracking-tight flex items-center gap-2">
                <Thermometer size={20} className="text-white/80 shrink-0" />
                稳定性分析
              </h2>
              <p className="mt-1 text-white/80 text-sm">Arrhenius 模型 · 货架期预测 · Q10 温度系数 · 多条件对比</p>
            </div>
            {history.length > 0 && (
              <button onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/15 hover:bg-white/25 rounded-full transition-colors">
                <Save size={12} />历史记录 ({history.length})
              </button>
            )}
          </div>
        </div>

        {/* 历史记录 */}
        {showHistory && history.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wide">最近预测</div>
              <div className="flex gap-2 flex-wrap">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg text-xs">
                    <span className="font-mono text-secondary-600 dark:text-secondary-400">{h.temp}°C</span>
                    <span className="text-neutral-400 dark:text-neutral-500">{h.ingredients.slice(0, 2).join('+')}...</span>
                    <span className="text-neutral-400 dark:text-neutral-500">· 货架期 {h.shelfLife?.toFixed(1)} 月</span>
                    <span className="text-neutral-300 dark:text-neutral-500">{h.date}</span>
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
                  <FlaskConical size={14} className="text-secondary-500 dark:text-secondary-400" />
                  配方成分
                </CardTitle>
                <Button variant="secondary" size="sm" onClick={addIngredient} icon={<FlaskConical size={12} />} className="text-xs">
                  添加成分
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0 space-y-2">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex items-center gap-3">
                  <select value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)}
                    className={`flex-1 ${selectClass}`}>
                    <option value="">选择成分...</option>
                    {KNOWN_HERBS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <Input type="number" value={ing.dosage_mg}
                    onChange={e => updateIngredient(i, 'dosage_mg', parseFloat(e.target.value) || 0)}
                    className="w-24 h-9 text-center tabular-nums" />
                  <span className="text-xs text-neutral-400 dark:text-neutral-500 w-8">mg</span>
                  <Button variant="ghost" size="sm" onClick={() => removeIngredient(i)} disabled={ingredients.length <= 1}
                    icon={<ShieldAlert size={14} />} className="text-neutral-400 dark:text-neutral-500 hover:text-danger-500 dark:hover:text-danger-400" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 储存条件 */}
          <Card>
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                <Thermometer size={14} className="text-warning-500 dark:text-warning-400" />
                储存条件
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">温度 (°C)</label>
                  <input type="range" min={-20} max={60} value={storageTemp} onChange={e => setStorageTemp(+e.target.value)} className="w-full accent-primary-500" />
                  <div className="text-right text-sm font-mono text-neutral-600 dark:text-neutral-300">{storageTemp}°C</div>
                </div>
                <div>
                  <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">湿度 (%RH)</label>
                  <input type="range" min={0} max={100} value={humidity} onChange={e => setHumidity(+e.target.value)} className="w-full accent-primary-500" />
                  <div className="text-right text-sm font-mono text-neutral-600 dark:text-neutral-300">{humidity}%</div>
                </div>
                <div>
                  <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">光照条件</label>
                  <select value={lightExposure} onChange={e => setLightExposure(e.target.value)} className={`w-full ${selectClass}`}>
                    <option value="dark">避光</option>
                    <option value="normal">正常光照</option>
                    <option value="bright">强光</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">包装方式</label>
                  <select value={packaging} onChange={e => setPackaging(e.target.value as any)} className={`w-full ${selectClass}`}>
                    <option value="standard">标准包装</option>
                    <option value="amber_bottle">棕色瓶</option>
                    <option value="vacuum">真空包装</option>
                    <option value="nitrogen_flushed">充氮包装</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-500 dark:text-neutral-400 shrink-0">预测月份:</span>
                <input type="range" min={6} max={60} step={6} value={months} onChange={e => setMonths(+e.target.value)} className="flex-1 accent-primary-500" />
                <span className="text-sm font-mono text-neutral-600 dark:text-neutral-300 w-12 text-right shrink-0">{months}月</span>
              </div>
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => runPredict(false)} disabled={loading} icon={<Activity size={14} />}>
              {loading ? '计算中...' : '运行稳定性预测'}
            </Button>
            <Button variant="secondary" onClick={() => runPredict(true)} disabled={loading} icon={<Layers size={14} />}>
              加入对比
            </Button>
            <Button variant={q10Tab ? 'warning' : 'outline'} onClick={() => setQ10Tab(!q10Tab)}
              icon={<Zap size={14} />}>
              Q10 温度系数
            </Button>
          </div>

          {/* 多条件对比图表 */}
          {compareResults.length > 1 && (
            <Card>
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                  <Layers size={14} className="text-secondary-500 dark:text-secondary-400" />
                  多条件对比
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-3">
                <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                  <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} label={{ value: '月份', position: 'bottom', offset: 0, fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} label={{ value: '保留率 %', angle: -90, position: 'left', offset: 0, fontSize: 11, fill: 'var(--text-muted)' }} />
                    <RechartsTooltip contentStyle={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }} />
                    <Legend />
                    <ReferenceLine y={90} stroke="var(--color-success)" strokeDasharray="3 3" label={{ value: '90% 阈值', position: 'right', fontSize: 10, fill: 'var(--color-success)' }} />
                    <ReferenceLine y={80} stroke="var(--color-warning)" strokeDasharray="3 3" label={{ value: '80% 阈值', position: 'right', fontSize: 10, fill: 'var(--color-warning)' }} />
                    {compareResults.map((cr, idx) => {
                      const data = cr.monthly_curve?.map((pt: any) => ({ month: pt.month, remaining: +(pt.remaining_pct * 100).toFixed(2) })) ?? []
                      return <Line key={idx} type="monotone" data={data} dataKey="remaining" name={cr.label} stroke={CHART_COLORS[idx % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                    })}
                  </LineChart>
                </ResponsiveContainer></div>
                <div className="flex gap-4 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
                  {compareResults.map((cr, idx) => (
                    <span key={idx} className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${CHART_LEGEND[idx % CHART_LEGEND.length]}`} />{cr.label}
                    </span>
                  ))}
                </div>
                <button onClick={() => setCompareResults([])} className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300">清除对比</button>
              </CardContent>
            </Card>
          )}

          {/* 预测结果 */}
          {result && (
            <div className="space-y-4">
              {/* 结果指标卡片 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`rounded-xl p-4 border ${scoreBg(result.stability_score)}`}>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">稳定性评分</div>
                  <div className={`text-2xl font-bold ${scoreColor(result.stability_score)}`}>{(result.stability_score * 100).toFixed(1)}%</div>
                  <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5 mt-2"><div className="bg-success-500 h-1.5 rounded-full transition-all" style={{ width: `${result.stability_score * 100}%` }} /></div>
                </div>
                <div className="rounded-xl p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">预估货架期</div>
                  <div className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">{result.estimated_shelf_life_months.toFixed(1)} <span className="text-sm font-normal text-neutral-400 dark:text-neutral-500">月</span></div>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">90%: {result.shelf_life_details?.months_to_90?.toFixed(1)}月 / 80%: {result.shelf_life_details?.months_to_80?.toFixed(1)}月</div>
                </div>
                <div className="rounded-xl p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">置信度</div>
                  <div className="text-2xl font-bold text-secondary-600 dark:text-secondary-400">{((result.shelf_life_details?.confidence ?? 0) * 100).toFixed(0)}%</div>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">基于已知成分数据库</div>
                </div>
                <div className="rounded-xl p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">风险项</div>
                  <div className={`text-2xl font-bold ${result.risk_factors.length > 2 ? 'text-danger-500 dark:text-danger-400' : result.risk_factors.length > 0 ? 'text-warning-500 dark:text-warning-400' : 'text-success-500 dark:text-success-400'}`}>{result.risk_factors.length}</div>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">被标记的风险项</div>
                </div>
              </div>

              {/* 降解曲线 */}
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                    <TrendingDown size={14} className="text-success-500 dark:text-success-400" />
                    降解曲线
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-3">
                  <div className="h-72"><ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} label={{ value: '月份', position: 'bottom', offset: 0, fontSize: 11, fill: 'var(--text-muted)' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} label={{ value: '保留率 %', angle: -90, position: 'left', offset: 0, fontSize: 11, fill: 'var(--text-muted)' }} />
                      <RechartsTooltip contentStyle={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }} />
                      <Legend />
                      <ReferenceLine y={90} stroke="var(--color-success)" strokeDasharray="3 3" label={{ value: '通过 90%', position: 'right', fontSize: 10, fill: 'var(--color-success)' }} />
                      <ReferenceLine y={80} stroke="var(--color-warning)" strokeDasharray="3 3" label={{ value: '警告 80%', position: 'right', fontSize: 10, fill: 'var(--color-warning)' }} />
                      <Area type="monotone" dataKey="remaining" name="保留率" stroke="var(--color-success)" fill="var(--color-success)" fillOpacity={0.1} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer></div>
                  <div className="flex items-center gap-4 text-xs text-neutral-400 dark:text-neutral-500 flex-wrap">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success-500" />≥90% 合格</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning-500" />80-90% 需关注</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger-500" />&lt;80% 不合格</span>
                  </div>
                </CardContent>
              </Card>

              {/* 风险因子 */}
              {result.risk_factors.length > 0 && (
                <Card className="border-warning-200 dark:border-warning-800/60">
                  <CardHeader className="px-5 pt-5 pb-3">
                    <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle size={14} className="text-warning-500 dark:text-warning-400" />
                      风险因子
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 pt-0 space-y-2">
                    {result.risk_factors.map((rf: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 px-3 py-2 bg-warning-50 dark:bg-warning-950/20 rounded-lg border border-warning-200 dark:border-warning-900">
                        <Zap size={12} className="text-warning-500 dark:text-warning-400 mt-0.5 shrink-0" />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300 flex-1">{rf.description}</span>
                        <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500 shrink-0">严重程度: {(rf.severity * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* 储存建议 */}
              <Card className="border-secondary-200 dark:border-secondary-800/60">
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                    <ShieldAlert size={14} className="text-secondary-500 dark:text-secondary-400" />
                    储存建议
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-2">
                  {result.storage_advice.map((advice: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 bg-secondary-50 dark:bg-secondary-950/20 rounded-lg border border-secondary-200 dark:border-secondary-900">
                      <span className="text-secondary-500 dark:text-secondary-400 mt-0.5 shrink-0">→</span>
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">{advice}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Q10 温度系数 */}
          {q10Tab && (
            <Card className="border-warning-200 dark:border-warning-800/60">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                  <Zap size={14} className="text-warning-500 dark:text-warning-400" />
                  Q10 温度系数计算
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">T1（参考温度 °C）</label>
                    <Input type="number" value={q10T1} onChange={e => setQ10T1(+e.target.value)} className="h-9 tabular-nums" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">T2（测试温度 °C）</label>
                    <Input type="number" value={q10T2} onChange={e => setQ10T2(+e.target.value)} className="h-9 tabular-nums" />
                  </div>
                </div>
                <Button variant="warning" onClick={runQ10} disabled={loading}
                  icon={<Zap size={14} className={loading ? 'animate-pulse' : ''} />}>
                  {loading ? '计算中...' : '计算 Q10'}
                </Button>
                {q10Result != null && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-warning-50 dark:bg-warning-950/20 rounded-xl p-4 border border-warning-200 dark:border-warning-900">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Q10 值</div>
                      <div className="text-3xl font-bold text-warning-600 dark:text-warning-400">{q10Result.q10?.toFixed(2)}</div>
                    </div>
                    <div className="bg-secondary-50 dark:bg-secondary-950/20 rounded-xl p-4 border border-secondary-200 dark:border-secondary-900">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">温度区间</div>
                      <div className="text-lg font-bold text-secondary-600 dark:text-secondary-400">{q10Result.t1_celsius}°C → {q10Result.t2_celsius}°C</div>
                    </div>
                    <div className="bg-success-50 dark:bg-success-950/20 rounded-xl p-4 border border-success-200 dark:border-success-900 md:col-span-1">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">储存建议</div>
                      <div className="text-sm font-medium text-success-700 dark:text-success-400">{q10Interpretation(q10Result.q10)}</div>
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
