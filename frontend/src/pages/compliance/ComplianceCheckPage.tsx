/**
 * 合规检查页面 — 完整功能版
 * 十八反十九畏 + GB16740限量 + 自动修复 + 配方历史
 * 主题系统：对齐 Dashboard 设计系统规范（bg-grid + brand banner + Card/Button + design tokens）
 */
import { useState, useEffect } from 'react'
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Trash2, Plus,
  RefreshCw, Search, BookOpen, Scale, Save, History,
  Lightbulb, XCircle,
} from 'lucide-react'
import {
  RadarChart as RechartsRadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts'
import { complianceApi, type Ingredient } from '@/api/compliance'
import { ingredientApi } from '@/api/ingredient'
import { useToast } from '@/components/ui/Toast'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui'

const POPULATION_OPTIONS = [
  { value: 'adults', label: '成人' },
  { value: 'children', label: '儿童' },
  { value: 'elderly', label: '老年人' },
]

// ─── 本地存储 ────────────────────────────────────────────────
const FORMULA_KEY = 'rmfood_formula_history'
const loadFormulas = () => { try { return JSON.parse(localStorage.getItem(FORMULA_KEY) ?? '[]') } catch { return [] } }
const saveFormulas = (items: any[]) => localStorage.setItem(FORMULA_KEY, JSON.stringify(items.slice(0, 30)))

export default function ComplianceCheckPage() {
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState<'check' | 'prohibited' | 'limits' | 'db'>('check')
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: '黄芪', dosage_mg: 5000 },
    { name: '党参', dosage_mg: 3000 },
  ])
  const [population, setPopulation] = useState('adults')
  const [checkResult, setCheckResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [prohibitedList, setProhibitedList] = useState<any[]>([])
  const [dosageLimits, setDosageLimits] = useState<Record<string, number>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [dbItems, setDbItems] = useState<any[]>([])
  const [dbTotal, setDbTotal] = useState(0)
  const [homologyList, setHomologyList] = useState<any[]>([])
  const [formulaName, setFormulaName] = useState('')
  const [formulas, setFormulas] = useState<any[]>(loadFormulas)
  const [showFormulas, setShowFormulas] = useState(false)

  useEffect(() => {
    complianceApi.getProhibited().then(r => { if (r.success) setProhibitedList(r.data.combinations ?? []) })
    complianceApi.getLimits().then(r => { if (r.success) setDosageLimits(r.data.limits ?? {}) })
    complianceApi.getFoodHomology().then((r: any) => { if (r.success && r.data?.materials) setHomologyList(r.data.materials) })
  }, [])

  const addIngredient = () => setIngredients([...ingredients, { name: '', dosage_mg: 1000 }])
  const removeIngredient = (i: number) => setIngredients(ingredients.filter((_, idx) => idx !== i))
  const updateIngredient = (i: number, field: string, value: string | number) => {
    const next = [...ingredients]
    next[i] = { ...next[i], [field]: value }
    setIngredients(next)
  }

  const handleCheck = async () => {
    if (!ingredients.some(x => x.name.trim())) {
      addToast({ type: 'warning', message: '请至少添加一种药材' })
      return
    }
    setLoading(true)
    try {
      const res = await complianceApi.bulkCheck(ingredients, population as any)
      setCheckResult(res.data)
      addToast({ type: 'success', message: `综合评分：${res.data?.score ?? '?'}` })
    } catch (e: any) {
      addToast({ type: 'error', message: String(e) })
    } finally { setLoading(false) }
  }

  const handleFix = async () => {
    setLoading(true)
    try {
      const res = await complianceApi.autoFix(ingredients, population as any)
      const data = res.data
      setIngredients(data.fixed_ingredients ?? ingredients)
      setCheckResult({
        score: data.fixed_score,
        status: data.fixed_status,
        violations: data.remaining_violations ?? [],
        warnings: [],
        suggestions: [],
      })
      addToast({
        type: data.fixed_score > data.original_score ? 'success' : 'warning',
        message: `已修正 ${data.fixes.length} 项。评分：${data.original_score} → ${data.fixed_score}`,
      })
    } catch (e: any) { addToast({ type: 'error', message: String(e) }) }
    finally { setLoading(false) }
  }

  const handleSaveFormula = () => {
    if (!checkResult) { addToast({ type: 'warning', message: '请先执行合规检查' }); return }
    const name = formulaName.trim() || `配方-${new Date().toLocaleDateString('zh-CN')}`
    const item = {
      id: Date.now(),
      name,
      ingredients: ingredients.map(i => `${i.name}(${i.dosage_mg}mg)`).join(', '),
      score: checkResult.score,
      status: checkResult.status,
      date: new Date().toLocaleDateString('zh-CN'),
    }
    const newFormulas = [item, ...formulas].slice(0, 30)
    setFormulas(newFormulas)
    saveFormulas(newFormulas)
    setFormulaName('')
    addToast({ type: 'success', message: `配方「${name}」已保存` })
  }

  const handleDbSearch = async () => {
    setLoading(true)
    const search = searchTerm.trim()
    try {
      const homRes: any = await complianceApi.getFoodHomology(search || undefined)
      if (homRes.success && homRes.data?.materials?.length > 0) {
        setDbItems(homRes.data.materials)
        setDbTotal(homRes.data.count ?? homRes.data.materials.length)
        return
      }
      const res: any = await ingredientApi.getIngredients({ page: 1, page_size: 20, search: search })
      if (res.data) { setDbItems(res.data.items ?? []); setDbTotal(res.data.total ?? 0) }
    } catch (e: any) { addToast({ type: 'error', message: String(e) }) }
    finally { setLoading(false) }
  }

  // 供带参数的二次调用（如后续扩展）
  const runDbSearch = async (term?: string) => {
    const search = (term ?? searchTerm).trim()
    const homRes: any = await complianceApi.getFoodHomology(search || undefined)
    if (homRes.success && homRes.data?.materials?.length > 0) {
      setDbItems(homRes.data.materials)
      setDbTotal(homRes.data.count ?? homRes.data.materials.length)
      return
    }
    const res: any = await ingredientApi.getIngredients({ page: 1, page_size: 20, search: search })
    if (res.data) { setDbItems(res.data.items ?? []); setDbTotal(res.data.total ?? 0) }
  }

  useEffect(() => {
    // 切换到 db tab 时若列表为空则自动加载
    if (activeTab === 'db' && dbItems.length === 0) handleDbSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const scoreColor = (s: number) => s >= 80 ? 'text-success-500 dark:text-success-400' : s >= 60 ? 'text-warning-500 dark:text-warning-400' : 'text-danger-500 dark:text-danger-400'

  // Build radar data for risk dimensions
  const radarData = checkResult ? [
    { dimension: '配伍禁忌', value: Math.max(0, 100 - (checkResult.violations ?? []).length * 25) },
    { dimension: '剂量合规', value: Math.max(0, 100 - (checkResult.warnings ?? []).filter((w: any) => w.type === 'dosage').length * 20) },
    { dimension: '人群适配', value: population === 'adults' ? 90 : population === 'children' ? 70 : 75 },
    { dimension: '药食同源', value: homologyList.length > 0 ? 85 : 60 },
    { dimension: '整体安全', value: checkResult.score ?? 50 },
  ] : []

  const selectClass = 'h-9 px-2 text-sm rounded-md border border-input bg-transparent text-neutral-900 dark:text-neutral-100 shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* 页头横幅 — 对齐 Dashboard 品牌横幅规范 */}
        <div className="surface-primary rounded-xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-semibold leading-snug tracking-tight flex items-center gap-2">
                <ShieldCheck size={20} className="text-white/80 shrink-0" />
                合规检查
              </h2>
              <p className="mt-1 text-white/80 text-sm">十八反十九畏 · GB 16740 限量标准 · 配方自动修复 · 配方历史</p>
            </div>
            {formulas.length > 0 && (
              <button onClick={() => setShowFormulas(!showFormulas)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/15 hover:bg-white/25 rounded-full transition-colors">
                <History size={12} />配方历史 ({formulas.length})
              </button>
            )}
          </div>
        </div>

        {/* 配方历史 */}
        {showFormulas && formulas.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wide">已保存配方</div>
              <div className="flex gap-2 flex-wrap">
                {formulas.map(f => (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg text-xs">
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">{f.name}</span>
                    <span className={`font-bold ${f.score >= 80 ? 'text-success-500 dark:text-success-400' : f.score >= 60 ? 'text-warning-500 dark:text-warning-400' : 'text-danger-500 dark:text-danger-400'}`}>
                      {f.score}
                    </span>
                    <span className="text-neutral-400 dark:text-neutral-500 truncate max-w-[150px]">{f.ingredients}</span>
                    <span className="text-neutral-300 dark:text-neutral-500">{f.date}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 标签页 — 对齐设计系统 Apple Segmented Control 规范 */}
        <div className="mt-4">
          <div className="tabs-list w-fit">
            {[
              { key: 'check' as const, label: '配方检查', icon: Scale },
              { key: 'prohibited' as const, label: '禁忌组合', icon: AlertTriangle },
              { key: 'limits' as const, label: '限量标准', icon: BookOpen },
              { key: 'db' as const, label: '药材数据库', icon: Search },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={'tabs-trigger ' + (activeTab === tab.key ? 'tabs-trigger-active' : '')}>
                <span className="icon"><tab.icon size={14} /></span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {activeTab === 'check' && (
            <div className="space-y-4">
              {/* 药材输入 */}
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                      <Plus size={14} className="text-primary-500 dark:text-primary-400" />
                      药材成分
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <select value={population} onChange={e => setPopulation(e.target.value)} className={selectClass}>
                        {POPULATION_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                      <Button variant="secondary" size="sm" onClick={addIngredient} icon={<Plus size={12} />} className="text-xs">添加药材</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-2">
                  {ingredients.map((ing, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Input value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)}
                        placeholder="药材名称" className="flex-1 h-9" />
                      <Input type="number" value={ing.dosage_mg} onChange={e => updateIngredient(i, 'dosage_mg', parseFloat(e.target.value) || 0)}
                        className="w-28 h-9 text-center tabular-nums" />
                      <span className="text-xs text-neutral-400 dark:text-neutral-500 w-8">mg</span>
                      <Button variant="ghost" size="sm" onClick={() => removeIngredient(i)} disabled={ingredients.length <= 1}
                        icon={<Trash2 size={14} />}
                        className="text-neutral-400 dark:text-neutral-500 hover:text-danger-500 dark:hover:text-danger-400" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* 操作按钮 */}
              <div className="flex gap-3 flex-wrap">
                <Button onClick={handleCheck} disabled={loading}
                  icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}>
                  {loading ? '检查中...' : '执行合规检查'}
                </Button>
                <Button variant="secondary" onClick={handleFix} disabled={loading || !checkResult}
                  icon={<ShieldCheck size={14} />}>自动修复</Button>
                <div className="flex items-center gap-2">
                  <Input value={formulaName} onChange={e => setFormulaName(e.target.value)}
                    placeholder="配方名称（可选）" className="h-9 w-48" />
                  <Button variant="outline" onClick={handleSaveFormula} disabled={!checkResult} icon={<Save size={14} />}>保存配方</Button>
                </div>
              </div>

              {/* 结果 */}
              {checkResult && (
                <div className="space-y-4">
                  {/* 评分总览 */}
                  <div className={`rounded-xl p-5 border ${
                    checkResult.status === 'compliant' ? 'bg-success-50 dark:bg-success-950/20 border-success-200 dark:border-success-900' :
                    checkResult.status === 'warning' ? 'bg-warning-50 dark:bg-warning-950/20 border-warning-200 dark:border-warning-900' :
                    'bg-danger-50 dark:bg-danger-950/20 border-danger-200 dark:border-danger-900'
                  }`}>
                    <div className="flex items-center gap-6">
                      {checkResult.status === 'compliant' ? <CheckCircle2 className="text-success-500 dark:text-success-400" size={32} /> : <AlertTriangle className="text-warning-500 dark:text-warning-400" size={32} />}
                      <div>
                        <div className={`text-3xl font-bold ${scoreColor(checkResult.score ?? 0)}`}>{checkResult.score ?? '?'}</div>
                        <div className="text-sm text-neutral-500 dark:text-neutral-400">合规评分（{checkResult.status === 'compliant' ? '通过' : checkResult.status === 'warning' ? '需关注' : '不合规'}）</div>
                      </div>
                      <div className="ml-auto text-right">
                        {checkResult.violations?.length > 0 && <div className="text-danger-500 dark:text-danger-400 font-semibold">{checkResult.violations.length} 项违规</div>}
                        {checkResult.warnings?.length > 0 && <div className="text-warning-500 dark:text-warning-400 font-semibold">{checkResult.warnings.length} 项警告</div>}
                      </div>
                    </div>
                  </div>

                  {/* 风险雷达图 */}
                  <Card>
                    <CardHeader className="px-5 pt-5 pb-3">
                      <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                        <Lightbulb size={14} className="text-warning-500 dark:text-warning-400" />
                        风险维度雷达图
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-5 pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsRadarChart data={radarData}>
                              <PolarGrid stroke="var(--border-color)" />
                              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                              <RechartsTooltip
                                formatter={(value: number) => [`${value}分`, '风险得分']}
                                contentStyle={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}
                              />
                              <Radar name="风险维度" dataKey="value" stroke="var(--color-warning)" fill="var(--color-warning)" fillOpacity={0.2} strokeWidth={2} />
                            </RechartsRadarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 self-center">
                          <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">风险维度明细</div>
                          {radarData.map(d => (
                            <div key={d.dimension} className="flex items-center gap-3">
                              <span className="text-sm text-neutral-600 dark:text-neutral-300 w-20 shrink-0">{d.dimension}</span>
                              <div className="flex-1 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${d.value >= 80 ? 'bg-success-500' : d.value >= 60 ? 'bg-warning-500' : 'bg-danger-500'}`}
                                  style={{ width: `${d.value}%` }} />
                              </div>
                              <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 w-10 text-right">{d.value.toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 违规项 */}
                  {checkResult.violations?.length > 0 && (
                    <Card className="border-danger-200 dark:border-danger-800/60">
                      <CardHeader className="px-5 pt-5 pb-3">
                        <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                          <XCircle size={14} className="text-danger-500 dark:text-danger-400" />
                          违规项（{checkResult.violations.length}）
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-5 pt-0 space-y-2">
                        {checkResult.violations.map((v: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 px-3 py-2 bg-danger-50 dark:bg-danger-950/20 rounded-lg border border-danger-200 dark:border-danger-900">
                            <XCircle size={14} className="text-danger-500 dark:text-danger-400 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <div className="text-sm text-neutral-700 dark:text-neutral-300 font-medium">{v.description}</div>
                              <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{v.rule_name} · 严重程度 {(v.severity * 100).toFixed(0)}%</div>
                            </div>
                            <Badge variant="danger" size="sm">{v.type}</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* 警告项 */}
                  {checkResult.warnings?.length > 0 && (
                    <Card className="border-warning-200 dark:border-warning-800/60">
                      <CardHeader className="px-5 pt-5 pb-3">
                        <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                          <AlertTriangle size={14} className="text-warning-500 dark:text-warning-400" />
                          警告项（{checkResult.warnings.length}）
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-5 pt-0 space-y-2">
                        {checkResult.warnings.map((w: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 px-3 py-2 bg-warning-50 dark:bg-warning-950/20 rounded-lg border border-warning-200 dark:border-warning-900">
                            <AlertTriangle size={14} className="text-warning-500 dark:text-warning-400 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <div className="text-sm text-neutral-700 dark:text-neutral-300">{w.description}</div>
                              <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{w.rule_name}</div>
                            </div>
                            <Badge variant="warning" size="sm">{w.type}</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* 优化建议 */}
                  {checkResult.suggestions?.length > 0 && (
                    <Card className="border-secondary-200 dark:border-secondary-800/60">
                      <CardHeader className="px-5 pt-5 pb-3">
                        <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                          <Lightbulb size={14} className="text-secondary-500 dark:text-secondary-400" />
                          优化建议
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-5 pt-0 space-y-2">
                        {checkResult.suggestions.map((s: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 px-3 py-2 bg-secondary-50 dark:bg-secondary-950/20 rounded-lg border border-secondary-200 dark:border-secondary-900">
                            <span className="text-secondary-500 dark:text-secondary-400 mt-0.5">→</span>
                            <span className="text-sm text-neutral-700 dark:text-neutral-300">{s}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'prohibited' && (
            <Card>
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle size={14} className="text-danger-500 dark:text-danger-400" />
                  十八反十九畏禁忌组合
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-2">
                {prohibitedList.length === 0 ? (
                  <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8">加载中...</p>
                ) : (
                  <div className="space-y-2">
                    {prohibitedList.map((pair: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 bg-danger-50 dark:bg-danger-950/20 rounded-lg border border-danger-200 dark:border-danger-900">
                        <span className="text-xs font-mono text-danger-400 dark:text-danger-500 w-16 shrink-0">{pair.rule || '十八反'}</span>
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                          <strong>{pair.herb1 || pair.pair?.[0]}</strong> ↔ <strong>{pair.herb2 || pair.pair?.[1]}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'limits' && (
            <Card>
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                  <BookOpen size={14} className="text-warning-500 dark:text-warning-400" />
                  GB 16740 药食同源目录限量标准
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-3">
                <div className="overflow-x-auto">
                  <table className="data-table w-full text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 uppercase">
                        <th className="pb-2 pr-3 text-left">药材名</th>
                        <th className="pb-2 px-2 text-center">最大用量</th>
                        <th className="pb-2 px-2 text-center">状态</th>
                        <th className="pb-2 pl-2 text-center">批准日期</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(dosageLimits).map(([name, limit]) => (
                        <tr key={name} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                          <td className="py-2 pr-3 text-neutral-700 dark:text-neutral-300 font-medium">{name}</td>
                          <td className="py-2 px-2 text-center font-mono text-warning-600 dark:text-warning-400">{limit}mg</td>
                          <td className="py-2 px-2 text-center"><span className="text-success-500 dark:text-success-400">允许</span></td>
                          <td className="py-2 pl-2 text-neutral-400 dark:text-neutral-500 text-center">2025版</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-neutral-400 dark:text-neutral-500 text-center">共 {Object.keys(dosageLimits).length} 条限量标准</div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'db' && (
            <Card>
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                  <Search size={14} className="text-warning-500 dark:text-warning-400" />
                  药食同源药材数据库
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-4">
                <div className="flex gap-3">
                  <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="搜索药材名称..." className="flex-1 h-9" />
                  <Button onClick={handleDbSearch} disabled={loading} icon={<Search size={14} />}>搜索</Button>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {dbItems.length === 0 ? (
                    <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8">{loading ? '加载中...' : '未找到相关药材'}</p>
                  ) : dbItems.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-4 px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg border border-neutral-200 dark:border-neutral-700">
                      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{item.name}</span>
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">{item.latin_name}</span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-auto">{item.category}</span>
                      <span className="text-xs font-mono text-warning-600 dark:text-warning-400">最大 {item.max_dosage}</span>
                    </div>
                  ))}
                </div>
                {dbTotal > 0 && <div className="text-xs text-neutral-400 dark:text-neutral-500 text-right">共 {dbTotal} 条记录</div>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
