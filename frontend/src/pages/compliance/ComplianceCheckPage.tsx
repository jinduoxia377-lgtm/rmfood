/**
 * 合规检查页面 — 完整功能版
 * 十八反十九畏 + GB16740限量 + 自动修复 + 配方历史
 * 主题系统：对齐 Dashboard 设计系统规范（bg-grid + brand banner + Card/Button + design tokens）
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t, i18n } = useTranslation()
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
      addToast({ type: 'warning', message: t('pages.compliance.toastNeedIngredient') })
      return
    }
    setLoading(true)
    try {
      const res = await complianceApi.bulkCheck(ingredients, population as any)
      setCheckResult(res.data)
      addToast({ type: 'success', message: t('pages.compliance.toastScore', { score: res.data?.score ?? '?' }) })
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
        message: t('pages.compliance.toastFixed', { count: data.fixes.length, from: data.original_score, to: data.fixed_score }),
      })
    } catch (e: any) { addToast({ type: 'error', message: String(e) }) }
    finally { setLoading(false) }
  }

  const handleSaveFormula = () => {
    if (!checkResult) { addToast({ type: 'warning', message: t('pages.compliance.toastRunCheckFirst') }); return }
    const name = formulaName.trim() || `配方-${new Date().toLocaleDateString(i18n.language)}`
    const item = {
      id: Date.now(),
      name,
      ingredients: ingredients.map(i => `${i.name}(${i.dosage_mg}mg)`).join(', '),
      score: checkResult.score,
      status: checkResult.status,
      date: new Date().toLocaleDateString(i18n.language),
    }
    const newFormulas = [item, ...formulas].slice(0, 30)
    setFormulas(newFormulas)
    saveFormulas(newFormulas)
    setFormulaName('')
    addToast({ type: 'success', message: t('pages.compliance.toastFormulaSaved', { name }) })
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

  const scoreColor = (s: number) => s >= 80 ? 'text-[var(--color-success-text)]0 dark:text-[var(--color-success-text)]' : s >= 60 ? 'text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]' : 'text-danger-500 dark:text-danger-600'

  // Build radar data for risk dimensions
  const radarData = checkResult ? [
    { dimension: t('pages.compliance.compatibilityTaboo'), value: Math.max(0, 100 - (checkResult.violations ?? []).length * 25) },
    { dimension: t('pages.compliance.dosageCompliance'), value: Math.max(0, 100 - (checkResult.warnings ?? []).filter((w: any) => w.type === 'dosage').length * 20) },
    { dimension: t('pages.compliance.populationFit'), value: population === 'adults' ? 90 : population === 'children' ? 70 : 75 },
    { dimension: t('pages.compliance.foodHomology'), value: homologyList.length > 0 ? 85 : 60 },
    { dimension: t('pages.compliance.overallSafety'), value: checkResult.score ?? 50 },
  ] : []

  const selectClass = 'h-9 px-2 text-sm rounded-[var(--radius-Apple-sm)] border border-input bg-transparent text-[var(--text-primary)] shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)] space-y-[var(--space-apple-md)]">
        {/* 页头横幅 — 对齐 Dashboard 品牌横幅规范 */}
        <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-semibold leading-snug tracking-tight flex items-center gap-2">
                <ShieldCheck size={20} className="text-white/80 shrink-0" />
                {t('pages.compliance.title')}
              </h1>
              <p className="mt-1 text-white/80 text-sm">{t('pages.compliance.subtitle')}</p>
            </div>
            {formulas.length > 0 && (
              <button onClick={() => setShowFormulas(!showFormulas)}
                className="flex items-center gap-1.5 px-[var(--space-apple-sm)] py-1.5 min-h-[44px] text-xs font-medium bg-[var(--bg-secondary)]/15 hover:bg-[var(--bg-secondary)]/25 rounded-[var(--radius-pill)] transition-colors">
                <History size={12} />{t('pages.compliance.formulaHistory', { count: formulas.length })}
              </button>
            )}
          </div>
        </div>

        {/* 配方历史 */}
        {showFormulas && formulas.length > 0 && (
          <Card>
            <CardContent className="p-[var(--space-apple-md)]">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wide">{t('pages.compliance.savedFormulas')}</div>
              <div className="flex gap-2 flex-wrap">
                {formulas.map(f => (
                  <div key={f.id} className="flex items-center gap-2 px-[var(--space-apple-sm)] py-1.5 bg-[var(--bg-tertiary)]/60 rounded-[var(--radius-Apple-sm)] text-xs">
                    <span className="font-medium text-[var(--text-primary)]">{f.name}</span>
                    <span className={`font-bold ${f.score >= 80 ? 'text-[var(--color-success-text)]0 dark:text-[var(--color-success-text)]' : f.score >= 60 ? 'text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]' : 'text-danger-500 dark:text-danger-600'}`}>
                      {f.score}
                    </span>
                    <span className="text-[var(--text-muted)] truncate max-w-[150px]">{f.ingredients}</span>
                    <span className="text-[var(--text-muted)] dark:text-[var(--text-muted)]">{f.date}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 标签页 — 对齐设计系统 Apple Segmented Control 规范 */}
        <div className="mt-[var(--space-apple-md)]">
          <div className="tabs-list w-fit">
            {[
              { key: 'check' as const, label: t('pages.compliance.tabCheck'), icon: Scale },
              { key: 'prohibited' as const, label: t('pages.compliance.tabProhibited'), icon: AlertTriangle },
              { key: 'limits' as const, label: t('pages.compliance.tabLimits'), icon: BookOpen },
              { key: 'db' as const, label: t('pages.compliance.tabDb'), icon: Search },
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
            <div className="space-y-[var(--space-apple-md)]">
              {/* 药材输入 */}
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                      <Plus size={14} className="text-[var(--color-primary-text)]0 dark:text-[var(--color-primary-text)]" />
                      {t('pages.compliance.ingredients')}
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                      <select value={population} onChange={e => setPopulation(e.target.value)} className={`flex-1 min-w-0 ${selectClass}`}>
                        {POPULATION_OPTIONS.map(p => <option key={p.value} value={p.value}>{t(`pages.compliance.population.${p.value}`)}</option>)}
                      </select>
                      <Button variant="secondary" size="sm" onClick={addIngredient} icon={<Plus size={12} />} className="text-xs">{t('pages.compliance.addHerb')}</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-2">
                  {ingredients.map((ing, i) => (
                    <div key={i} className="flex items-center gap-[var(--space-apple-sm)]">
                      <Input value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)}
                        placeholder={t('pages.compliance.herbNamePlaceholder')} className="flex-1 h-9" />
                      <Input type="number" value={ing.dosage_mg} onChange={e => updateIngredient(i, 'dosage_mg', parseFloat(e.target.value) || 0)}
                        className="w-28 h-9 text-center tabular-nums" />
                      <span className="text-xs text-[var(--text-muted)] w-8">mg</span>
                      <Button variant="ghost" size="sm" onClick={() => removeIngredient(i)} disabled={ingredients.length <= 1}
                        icon={<Trash2 size={14} />}
                        className="text-[var(--text-muted)] hover:text-danger-500 dark:hover:text-danger-400" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* 操作按钮 */}
              <div className="flex gap-[var(--space-apple-sm)] flex-wrap">
                <Button onClick={handleCheck} disabled={loading}
                  icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}>
                  {loading ? t('pages.compliance.checking') : t('pages.compliance.runCheck')}
                </Button>
                <Button variant="secondary" onClick={handleFix} disabled={loading || !checkResult}
                  icon={<ShieldCheck size={14} />}>{t('pages.compliance.autoFix')}</Button>
                <div className="flex items-center gap-2">
                  <Input value={formulaName} onChange={e => setFormulaName(e.target.value)}
                    placeholder={t('pages.compliance.formulaNamePlaceholder')} className="h-9 w-48" />
                  <Button variant="outline" onClick={handleSaveFormula} disabled={!checkResult} icon={<Save size={14} />}>{t('pages.compliance.saveFormula')}</Button>
                </div>
              </div>

              {/* 结果 */}
              {checkResult && (
                <div className="space-y-[var(--space-apple-md)]">
                  {/* 评分总览 */}
                  <div className={`rounded-[var(--radius-Apple-md)] p-5 border ${
                    checkResult.status === 'compliant' ? 'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/20 border-[var(--color-success-border)] dark:border-success-900' :
                    checkResult.status === 'warning' ? 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/20 border-[var(--color-warning-border)] dark:border-warning-900' :
                    'bg-danger-50 dark:bg-danger-950/20 border-danger-200 dark:border-danger-900'
                  }`}>
                    <div className="flex items-center gap-6">
                      {checkResult.status === 'compliant' ? <CheckCircle2 className="text-[var(--color-success-text)]0 dark:text-[var(--color-success-text)]" size={32} /> : <AlertTriangle className="text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]" size={32} />}
                      <div>
                        <div className={`text-3xl font-bold ${scoreColor(checkResult.score ?? 0)}`}>{checkResult.score ?? '?'}</div>
                        <div className="text-sm text-[var(--text-muted)]">{t('pages.compliance.complianceScore', { status: checkResult.status === 'compliant' ? t('pages.compliance.statusCompliant') : checkResult.status === 'warning' ? t('pages.compliance.statusWarning') : t('pages.compliance.statusNonCompliant') })}</div>
                      </div>
                      <div className="ml-auto text-right">
                        {checkResult.violations?.length > 0 && <div className="text-danger-500 dark:text-danger-600 font-semibold">{t('pages.compliance.violationsCount', { count: checkResult.violations.length })}</div>}
                        {checkResult.warnings?.length > 0 && <div className="text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)] font-semibold">{t('pages.compliance.warningsCount', { count: checkResult.warnings.length })}</div>}
                      </div>
                    </div>
                  </div>

                  {/* 风险雷达图 */}
                  <Card>
                    <CardHeader className="px-5 pt-5 pb-3">
                      <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                        <Lightbulb size={14} className="text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]" />
                        {t('pages.compliance.riskRadar')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-md)]">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsRadarChart data={radarData}>
                              <PolarGrid stroke="var(--border-color)" />
                              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                              <RechartsTooltip
                                formatter={(value: number) => [`${value}${t('pages.compliance.riskScore')}`, t('pages.compliance.riskDimension')]}
                                contentStyle={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}
                              />
                              <Radar name={t('pages.compliance.riskDimension')} dataKey="value" stroke="var(--color-warning)" fill="var(--color-warning)" fillOpacity={0.2} strokeWidth={2} />
                            </RechartsRadarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 self-center">
                          <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{t('pages.compliance.riskDetails')}</div>
                          {radarData.map(d => (
                            <div key={d.dimension} className="flex items-center gap-[var(--space-apple-sm)]">
                              <span className="text-sm text-[var(--text-secondary)] w-20 shrink-0">{d.dimension}</span>
                              <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-[var(--radius-pill)] overflow-hidden">
                                <div className={`h-full rounded-[var(--radius-pill)] ${d.value >= 80 ? 'bg-[var(--color-success-container)]0' : d.value >= 60 ? 'bg-[var(--color-warning-container)]0' : 'bg-danger-500'}`}
                                  style={{ width: `${d.value}%` }} />
                              </div>
                              <span className="text-xs font-mono text-[var(--text-muted)] w-10 text-right">{d.value.toFixed(0)}</span>
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
                          <XCircle size={14} className="text-danger-500 dark:text-danger-600" />
                          {t('pages.compliance.violations', { count: checkResult.violations.length })}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-5 pt-0 space-y-2">
                        {checkResult.violations.map((v: any, i: number) => (
                          <div key={i} className="flex items-start gap-[var(--space-apple-sm)] px-[var(--space-apple-sm)] py-2 bg-danger-50 dark:bg-danger-950/20 rounded-[var(--radius-Apple-sm)] border border-danger-200 dark:border-danger-900">
                            <XCircle size={14} className="text-danger-500 dark:text-danger-600 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <div className="text-sm text-[var(--text-primary)] font-medium">{v.description}</div>
                              <div className="text-xs text-[var(--text-muted)] mt-0.5">{v.rule_name} · {t('pages.compliance.severity', { value: (v.severity * 100).toFixed(0) })}</div>
                            </div>
                            <Badge variant="danger" size="sm">{v.type}</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* 警告项 */}
                  {checkResult.warnings?.length > 0 && (
                    <Card className="border-[var(--color-warning-border)] dark:border-[var(--color-warning)]/60">
                      <CardHeader className="px-5 pt-5 pb-3">
                        <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                          <AlertTriangle size={14} className="text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]" />
                          {t('pages.compliance.warnings', { count: checkResult.warnings.length })}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-5 pt-0 space-y-2">
                        {checkResult.warnings.map((w: any, i: number) => (
                          <div key={i} className="flex items-start gap-[var(--space-apple-sm)] px-[var(--space-apple-sm)] py-2 bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/20 rounded-[var(--radius-Apple-sm)] border border-[var(--color-warning-border)] dark:border-warning-900">
                            <AlertTriangle size={14} className="text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)] mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <div className="text-sm text-[var(--text-primary)]">{w.description}</div>
                              <div className="text-xs text-[var(--text-muted)] mt-0.5">{w.rule_name}</div>
                            </div>
                            <Badge variant="warning" size="sm">{w.type}</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* 优化建议 */}
                  {checkResult.suggestions?.length > 0 && (
                    <Card className="border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)]/60">
                      <CardHeader className="px-5 pt-5 pb-3">
                        <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                          <Lightbulb size={14} className="text-[var(--color-secondary-text)]0 dark:text-[var(--color-secondary-text)]" />
                          {t('pages.compliance.suggestions')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-5 pt-0 space-y-2">
                        {checkResult.suggestions.map((s: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 px-[var(--space-apple-sm)] py-2 bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 rounded-[var(--radius-Apple-sm)] border border-[var(--color-secondary-border)] dark:border-secondary-900">
                            <span className="text-[var(--color-secondary-text)]0 dark:text-[var(--color-secondary-text)] mt-0.5">→</span>
                            <span className="text-sm text-[var(--text-primary)]">{s}</span>
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
                  <AlertTriangle size={14} className="text-danger-500 dark:text-danger-600" />
                  {t('pages.compliance.prohibitedTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-2">
                {prohibitedList.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] text-center py-8">{t('pages.compliance.loading')}</p>
                ) : (
                  <div className="space-y-2">
                    {prohibitedList.map((pair: any, i: number) => (
                      <div key={i} className="flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-sm)] py-2 bg-danger-50 dark:bg-danger-950/20 rounded-[var(--radius-Apple-sm)] border border-danger-200 dark:border-danger-900">
                        <span className="text-xs font-mono text-danger-400 dark:text-danger-700 w-16 shrink-0">{pair.rule || '十八反'}</span>
                        <span className="text-sm text-[var(--text-primary)]">
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
                  <BookOpen size={14} className="text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]" />
                  {t('pages.compliance.limitsTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-sm)]">
                <div className="overflow-x-auto">
                  <table className="data-table w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase">
                        <th className="pb-2 pr-3 text-left">{t('pages.compliance.thHerb')}</th>
                        <th className="pb-2 px-2 text-center">{t('pages.compliance.thMaxDosage')}</th>
                        <th className="pb-2 px-2 text-center">{t('pages.compliance.thStatus')}</th>
                        <th className="pb-2 pl-2 text-center">{t('pages.compliance.thApprovedDate')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(dosageLimits).map(([name, limit]) => (
                        <tr key={name} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/50">
                          <td className="py-2 pr-3 text-[var(--text-primary)] font-medium">{name}</td>
                          <td className="py-2 px-2 text-center font-mono text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]">{limit}mg</td>
                          <td className="py-2 px-2 text-center"><span className="text-[var(--color-success-text)]0 dark:text-[var(--color-success-text)]">{t('pages.compliance.allowed')}</span></td>
                          <td className="py-2 pl-2 text-[var(--text-muted)] text-center">2025版</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-[var(--text-muted)] text-center">{t('pages.compliance.limitsCount', { count: Object.keys(dosageLimits).length })}</div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'db' && (
            <Card>
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                  <Search size={14} className="text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]" />
                  {t('pages.compliance.dbTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-md)]">
                <div className="flex gap-[var(--space-apple-sm)]">
                  <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder={t('pages.compliance.searchPlaceholder')} className="flex-1 h-9" />
                  <Button onClick={handleDbSearch} disabled={loading} icon={<Search size={14} />}>{t('pages.compliance.search')}</Button>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {dbItems.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)] text-center py-8">{loading ? t('pages.compliance.loading') : t('pages.compliance.noHerbsFound')}</p>
                  ) : dbItems.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-4 px-[var(--space-apple-sm)] py-2.5 bg-[var(--bg-tertiary)]/60 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)]">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{item.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">{item.latin_name}</span>
                      <span className="text-xs text-[var(--text-muted)] ml-auto">{item.category}</span>
                      <span className="text-xs font-mono text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]">{t('pages.compliance.maxDosage', { value: item.max_dosage })}</span>
                    </div>
                  ))}
                </div>
                {dbTotal > 0 && <div className="text-xs text-[var(--text-muted)] text-right">{t('pages.compliance.recordsCount', { count: dbTotal })}</div>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
