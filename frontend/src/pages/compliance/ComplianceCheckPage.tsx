/**
 * 合规检查页面 — 完整功能版
 * 十八反十九畏 + GB16740限量 + 自动修复 + 配方历史
 * 主题系统：对齐 Dashboard 设计系统规范（bg-grid + brand banner + Card/Button + design tokens）
 */
import { useState, useEffect, useRef, useCallback } from 'react'
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

// 人群选项仅保留 value；中文文案走 i18n（pages.compliance.population.*）
const POPULATION_VALUES = ['adults', 'children', 'elderly']

// ─── API 错误信息提取 ────────────────────────────────────────
// 后端错误体形如 { detail: string }；兜底走 i18n 文案，避免把
// "AxiosError: Request failed with status code 500" 原始串直接展示给用户。
const getApiErrorMsg = (e: any, t: (k: string) => string): string => {
  const detail = e?.response?.data?.detail ?? e?.response?.data?.message
  if (typeof detail === 'string' && detail.trim()) return detail
  return t('pages.compliance.toastCheckFailed')
}

// ─── 本地存储 ────────────────────────────────────────────────
const FORMULA_KEY = 'rmfood_formula_history'
// 结构守卫：写坏/被篡改的 localStorage 不应导致白屏
const loadFormulas = (): any[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(FORMULA_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter(f => f && typeof f === 'object' && typeof f.score === 'number')
  } catch { return [] }
}
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
  // 初始加载态：区分「加载中 / 加载失败 / 空」，避免失败时永远显示"加载中..."
  const [prohibitedLoading, setProhibitedLoading] = useState(true)
  const [prohibitedError, setProhibitedError] = useState(false)
  const [dosageLimits, setDosageLimits] = useState<Record<string, number>>({})
  const [limitsLoading, setLimitsLoading] = useState(true)
  const [limitsError, setLimitsError] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dbItems, setDbItems] = useState<any[]>([])
  const [dbTotal, setDbTotal] = useState(0)
  const [dbError, setDbError] = useState(false)
  const [homologyList, setHomologyList] = useState<any[]>([])
  const [formulaName, setFormulaName] = useState('')
  const [formulas, setFormulas] = useState<any[]>(loadFormulas)
  const [showFormulas, setShowFormulas] = useState(false)
  // db 搜索竞态防护：仅采纳最后一次请求的结果
  const dbSearchIdRef = useRef(0)

  // 违规类型 → 本地化名（后端 violations[].type 为英文枚举），缺失时兜底显示原值
  const violationTypeLabel = (type?: string) =>
    type ? t(`pages.compliance.violationType.${type}`, { defaultValue: type }) : ''

  const loadProhibited = useCallback(async () => {
    setProhibitedLoading(true); setProhibitedError(false)
    try {
      const r = await complianceApi.getProhibited()
      if (r.success) setProhibitedList(r.data.combinations ?? [])
      else setProhibitedError(true)
    } catch { setProhibitedError(true) }
    finally { setProhibitedLoading(false) }
  }, [])

  const loadLimits = useCallback(async () => {
    setLimitsLoading(true); setLimitsError(false)
    try {
      const r = await complianceApi.getLimits()
      if (r.success) setDosageLimits(r.data.limits ?? {})
      else setLimitsError(true)
    } catch { setLimitsError(true) }
    finally { setLimitsLoading(false) }
  }, [])

  // 药食同源目录为预取缓存（雷达图已不再依赖其长度），失败静默、不影响界面
  const loadHomology = useCallback(async () => {
    try {
      const r: any = await complianceApi.getFoodHomology()
      if (r.success && r.data?.materials) setHomologyList(r.data.materials)
    } catch { /* 静默：非关键预取 */ }
  }, [])

  useEffect(() => {
    void loadProhibited()
    void loadLimits()
    void loadHomology()
  }, [loadProhibited, loadLimits, loadHomology])

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
      // 提交前过滤空 name 行：空行会被后端判为 not_in_directory 假违规，污染雷达图
      const validIngredients = ingredients.filter(i => i.name.trim())
      const res = await complianceApi.bulkCheck(validIngredients, population)
      setCheckResult(res.data)
      addToast({ type: 'success', message: t('pages.compliance.toastScore', { score: res.data?.score ?? '?' }) })
    } catch (e: any) {
      addToast({ type: 'error', message: getApiErrorMsg(e, t) })
    } finally { setLoading(false) }
  }

  const handleFix = async () => {
    setLoading(true)
    try {
      const res = await complianceApi.autoFix(ingredients, population)
      const data = res.data
      // fixes 为空：配方本已合规，不弹「已修复0处」的误导提示
      if (!data.fixes || data.fixes.length === 0) {
        addToast({ type: 'info', message: t('pages.compliance.toastAlreadyCompliant') })
        return
      }
      const fixedIngredients = data.fixed_ingredients ?? ingredients
      setIngredients(fixedIngredients)
      // remaining_violations 无 type 字段（且已过滤 exceeds_limit）。
      // 为避免用空 warnings/suggestions 伪装「已无警告」，以修复后的配方重新跑一次
      // bulkCheck 取回真实 score/status/violations/warnings/suggestions；
      // remaining_violations 仅作 violations 的权威兜底。
      let refreshed: any = null
      try {
        const recheck = await complianceApi.bulkCheck(fixedIngredients, population)
        if (recheck.success) refreshed = recheck.data
      } catch { /* 重新检查失败则退回 fix 返回值 */ }
      setCheckResult({
        score: refreshed?.score ?? data.fixed_score,
        status: refreshed?.status ?? data.fixed_status,
        violations: data.remaining_violations ?? refreshed?.violations ?? [],
        warnings: refreshed?.warnings ?? [],
        suggestions: refreshed?.suggestions ?? [],
      })
      addToast({
        type: data.fixed_score > data.original_score ? 'success' : 'warning',
        message: t('pages.compliance.toastFixed', { count: data.fixes.length, from: data.original_score, to: data.fixed_score }),
      })
    } catch (e: any) { addToast({ type: 'error', message: getApiErrorMsg(e, t) }) }
    finally { setLoading(false) }
  }

  const handleSaveFormula = () => {
    if (!checkResult) { addToast({ type: 'warning', message: t('pages.compliance.toastRunCheckFirst') }); return }
    const name = formulaName.trim() || t('pages.compliance.formulaNameDefault', { date: new Date().toLocaleDateString(i18n.language) })
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
    const requestId = ++dbSearchIdRef.current
    setLoading(true)
    setDbError(false)
    const search = searchTerm.trim()
    try {
      const homRes: any = await complianceApi.getFoodHomology(search || undefined)
      if (requestId !== dbSearchIdRef.current) return // 已有更新的请求，丢弃本次过期结果
      if (homRes.success && homRes.data?.materials?.length > 0) {
        setDbItems(homRes.data.materials)
        setDbTotal(homRes.data.count ?? homRes.data.materials.length)
        return
      }
      const res: any = await ingredientApi.getIngredients({ page: 1, page_size: 20, search: search })
      if (requestId !== dbSearchIdRef.current) return
      if (res.data) { setDbItems(res.data.items ?? []); setDbTotal(res.data.total ?? 0) }
    } catch (e: any) {
      if (requestId !== dbSearchIdRef.current) return
      setDbError(true)
      addToast({ type: 'error', message: getApiErrorMsg(e, t) })
    } finally {
      if (requestId === dbSearchIdRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    // 切换到 db tab 时若列表为空则自动加载（浮动 promise 加 void）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeTab === 'db' && dbItems.length === 0) void handleDbSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const scoreColor = (s: number) => s >= 80 ? 'text-[var(--color-success-text)] dark:text-[var(--color-success-text)]' : s >= 60 ? 'text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]' : 'text-danger-500 dark:text-danger-600'

  // Build radar data for risk dimensions — 全部由 checkResult 真实数据驱动
  const radarData = checkResult ? (() => {
    const violations: any[] = checkResult.violations ?? []
    const cnt = (type: string) => violations.filter(v => v.type === type).length
    const prohibited = cnt('prohibited_combo')
    const exceeds = cnt('exceeds_limit')
    const childForbidden = cnt('child_forbidden')
    const notInDir = cnt('not_in_directory')
    // 食药同源：按配方中"非目录成分"占比计算（不使用全库 homologyList 恒定值）
    const namedIngredients = ingredients.filter(i => i.name.trim())
    const homologyRatio = namedIngredients.length > 0
      ? Math.max(0, 1 - notInDir / namedIngredients.length)
      : 1
    return [
      // 配伍禁忌：仅按禁忌搭配违规数扣分
      { dimension: t('pages.compliance.compatibilityTaboo'), value: Math.max(0, 100 - prohibited * 30) },
      // 剂量合规：按超量违规数扣分（不再误用 warnings）
      { dimension: t('pages.compliance.dosageCompliance'), value: Math.max(0, 100 - exceeds * 25) },
      // 人群适配：按当前人群下的儿童禁忌违规数扣分
      { dimension: t('pages.compliance.populationFit'), value: Math.max(0, 100 - childForbidden * 30) },
      // 食药同源：按当前配方在目录内成分占比
      { dimension: t('pages.compliance.foodHomology'), value: Math.round(homologyRatio * 100) },
      // 整体安全：后端真实总分（唯一真实维度）
      { dimension: t('pages.compliance.overallSafety'), value: checkResult.score ?? 50 },
    ]
  })() : []

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
                    <span className={`font-bold ${f.score >= 80 ? 'text-[var(--color-success-text)] dark:text-[var(--color-success-text)]' : f.score >= 60 ? 'text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]' : 'text-danger-500 dark:text-danger-600'}`}>
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
          <div className="tabs-list w-fit" role="tablist" aria-label={t('pages.compliance.title')}>
            {[
              { key: 'check' as const, label: t('pages.compliance.tabCheck'), icon: Scale },
              { key: 'prohibited' as const, label: t('pages.compliance.tabProhibited'), icon: AlertTriangle },
              { key: 'limits' as const, label: t('pages.compliance.tabLimits'), icon: BookOpen },
              { key: 'db' as const, label: t('pages.compliance.tabDb'), icon: Search },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                role="tab" id={`tab-${tab.key}`} aria-controls={`panel-${tab.key}`}
                aria-selected={activeTab === tab.key}
                className={'tabs-trigger ' + (activeTab === tab.key ? 'tabs-trigger-active' : '')}>
                <span className="icon"><tab.icon size={14} /></span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {activeTab === 'check' && (
            <div className="space-y-[var(--space-apple-md)]" role="tabpanel" id="panel-check" aria-labelledby="tab-check">
              {/* 药材输入 */}
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                      <Plus size={14} className="text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)]" />
                      {t('pages.compliance.ingredients')}
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                      <select value={population} onChange={e => setPopulation(e.target.value)} aria-label={t('pages.compliance.populationLabel')} className={`flex-1 min-w-0 ${selectClass}`}>
                        {POPULATION_VALUES.map(v => <option key={v} value={v}>{t(`pages.compliance.population.${v}`)}</option>)}
                      </select>
                      <Button variant="secondary" size="sm" onClick={addIngredient} icon={<Plus size={12} />} className="text-xs">{t('pages.compliance.addHerb')}</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-2">
                  {ingredients.map((ing, i) => (
                    <div key={i} className="flex items-center gap-[var(--space-apple-sm)]">
                      <Input value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)}
                        aria-label={t('pages.compliance.herbNameLabel')}
                        placeholder={t('pages.compliance.herbNamePlaceholder')} className="flex-1 h-9" />
                      <Input type="number" min={0} value={ing.dosage_mg} aria-label={t('pages.compliance.dosageMgLabel')} onChange={e => {
                        const raw = e.target.value
                        // 允许清空（空字符串不立即置0，避免输入卡死）；负数拦截为0
                        if (raw === '') { updateIngredient(i, 'dosage_mg', '' as any); return }
                        const num = parseFloat(raw)
                        updateIngredient(i, 'dosage_mg', isNaN(num) ? 0 : Math.max(0, num))
                      }}
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
                    aria-label={t('pages.compliance.formulaNameLabel')}
                    placeholder={t('pages.compliance.formulaNamePlaceholder')} className="h-9 w-48" />
                  <Button variant="outline" onClick={handleSaveFormula} disabled={!checkResult} icon={<Save size={14} />}>{t('pages.compliance.saveFormula')}</Button>
                </div>
              </div>

              {/* 结果：aria-live 播报检查结论，供屏幕阅读器感知异步结果 */}
              {checkResult && (
                <div className="space-y-[var(--space-apple-md)]" aria-live="polite">
                  <p className="sr-only">
                    {checkResult.violations?.length > 0
                      ? t('pages.compliance.checkCompleteViolations', { count: checkResult.violations.length })
                      : t('pages.compliance.checkCompleteClean')}
                  </p>
                  {/* 评分总览 */}
                  <div className={`rounded-[var(--radius-Apple-md)] p-5 border ${
                    checkResult.status === 'compliant' ? 'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/20 border-[var(--color-success-border)] dark:border-success-900' :
                    checkResult.status === 'warning' ? 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/20 border-[var(--color-warning-border)] dark:border-warning-900' :
                    'bg-danger-50 dark:bg-danger-950/20 border-danger-200 dark:border-danger-900'
                  }`}>
                    <div className="flex items-center gap-6">
                      {checkResult.status === 'compliant' ? <CheckCircle2 className="text-[var(--color-success-text)] dark:text-[var(--color-success-text)]" size={32} /> : <AlertTriangle className="text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" size={32} />}
                      <div>
                        <div className={`text-3xl font-bold ${scoreColor(checkResult.score ?? 0)}`}>{checkResult.score ?? '?'}</div>
                        <div className="text-sm text-[var(--text-muted)]">{t('pages.compliance.complianceScore', { status: checkResult.status === 'compliant' ? t('pages.compliance.statusCompliant') : checkResult.status === 'warning' ? t('pages.compliance.statusWarning') : t('pages.compliance.statusNonCompliant') })}</div>
                      </div>
                      <div className="ml-auto text-right">
                        {checkResult.violations?.length > 0 && <div className="text-danger-500 dark:text-danger-600 font-semibold">{t('pages.compliance.violationsCount', { count: checkResult.violations.length })}</div>}
                        {checkResult.warnings?.length > 0 && <div className="text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)] font-semibold">{t('pages.compliance.warningsCount', { count: checkResult.warnings.length })}</div>}
                      </div>
                    </div>
                  </div>

                  {/* 风险雷达图 */}
                  <Card>
                    <CardHeader className="px-5 pt-5 pb-3">
                      <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                        <Lightbulb size={14} className="text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />
                        {t('pages.compliance.riskRadar')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-md)]">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 雷达图为纯视觉呈现，右侧明细列表已提供等价文本，故对 SR 隐藏 */}
                        <div className="h-64" aria-hidden="true">
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
                                <div className={`h-full rounded-[var(--radius-pill)] ${d.value >= 80 ? 'bg-[var(--color-success-container)]' : d.value >= 60 ? 'bg-[var(--color-warning-container)]' : 'bg-danger-500'}`}
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
                              <div className="text-sm text-[var(--text-primary)] font-medium">{v.message}</div>
                              <div className="text-xs text-[var(--text-muted)] mt-0.5">{v.ingredient}{v.type ? ` · ${violationTypeLabel(v.type)}` : ''}</div>
                            </div>
                            {v.type && <Badge variant="danger" size="sm">{violationTypeLabel(v.type)}</Badge>}
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
                          <AlertTriangle size={14} className="text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />
                          {t('pages.compliance.warnings', { count: checkResult.warnings.length })}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-5 pt-0 space-y-2">
                        {checkResult.warnings.map((w: any, i: number) => (
                          <div key={i} className="flex items-start gap-[var(--space-apple-sm)] px-[var(--space-apple-sm)] py-2 bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/20 rounded-[var(--radius-Apple-sm)] border border-[var(--color-warning-border)] dark:border-warning-900">
                            <AlertTriangle size={14} className="text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)] mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <div className="text-sm text-[var(--text-primary)]">{w}</div>
                            </div>
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
                          <Lightbulb size={14} className="text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]" />
                          {t('pages.compliance.suggestions')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-5 pt-0 space-y-2">
                        {checkResult.suggestions.map((s: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 px-[var(--space-apple-sm)] py-2 bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 rounded-[var(--radius-Apple-sm)] border border-[var(--color-secondary-border)] dark:border-secondary-900">
                            <span className="text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] mt-0.5">→</span>
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
            <Card role="tabpanel" id="panel-prohibited" aria-labelledby="tab-prohibited">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle size={14} className="text-danger-500 dark:text-danger-600" />
                  {t('pages.compliance.prohibitedTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-2">
                {prohibitedLoading ? (
                  <p className="text-sm text-[var(--text-muted)] text-center py-8">{t('pages.compliance.loading')}</p>
                ) : prohibitedError ? (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-sm text-danger-500 dark:text-danger-400">{t('pages.compliance.loadFailed')}</p>
                    <Button variant="outline" size="sm" onClick={loadProhibited}>{t('pages.compliance.retry')}</Button>
                  </div>
                ) : prohibitedList.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] text-center py-8">{t('pages.compliance.noData')}</p>
                ) : (
                  <div className="space-y-2">
                    {prohibitedList.map((pair: any, i: number) => (
                      <div key={i} className="flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-sm)] py-2 bg-danger-50 dark:bg-danger-950/20 rounded-[var(--radius-Apple-sm)] border border-danger-200 dark:border-danger-900">
                        <span className="text-xs font-mono text-danger-400 dark:text-danger-700 w-16 shrink-0">{pair.rule || t('pages.compliance.defaultRuleName')}</span>
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
            <Card role="tabpanel" id="panel-limits" aria-labelledby="tab-limits">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                  <BookOpen size={14} className="text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />
                  {t('pages.compliance.limitsTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-sm)]">
                {limitsLoading ? (
                  <p className="text-sm text-[var(--text-muted)] text-center py-8">{t('pages.compliance.loading')}</p>
                ) : limitsError ? (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-sm text-danger-500 dark:text-danger-400">{t('pages.compliance.loadFailed')}</p>
                    <Button variant="outline" size="sm" onClick={loadLimits}>{t('pages.compliance.retry')}</Button>
                  </div>
                ) : (
                <>
                <div className="overflow-x-auto">
                  <table className="data-table w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase">
                        <th className="pb-2 pr-3 text-left">{t('pages.compliance.thHerb')}</th>
                        <th className="pb-2 px-2 text-center">{t('pages.compliance.thMaxDosage')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(dosageLimits).map(([name, limit]) => (
                        <tr key={name} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/50">
                          <td className="py-2 pr-3 text-[var(--text-primary)] font-medium">{name}</td>
                          <td className="py-2 px-2 text-center font-mono text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]">{limit}mg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-[var(--text-muted)] text-center">{t('pages.compliance.limitsCount', { count: Object.keys(dosageLimits).length })}</div>
                </>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'db' && (
            <Card role="tabpanel" id="panel-db" aria-labelledby="tab-db">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                  <Search size={14} className="text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />
                  {t('pages.compliance.dbTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-md)]">
                <div className="flex gap-[var(--space-apple-sm)]">
                  <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    aria-label={t('pages.compliance.searchLabel')}
                    placeholder={t('pages.compliance.searchPlaceholder')} className="flex-1 h-9" />
                  <Button onClick={handleDbSearch} disabled={loading} icon={<Search size={14} />}>{t('pages.compliance.search')}</Button>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {dbItems.length === 0 ? (
                    loading ? (
                      <p className="text-sm text-[var(--text-muted)] text-center py-8">{t('pages.compliance.loading')}</p>
                    ) : dbError ? (
                      <div className="text-center py-8 space-y-3">
                        <p className="text-sm text-danger-500 dark:text-danger-400">{t('pages.compliance.loadFailed')}</p>
                        <Button variant="outline" size="sm" onClick={handleDbSearch}>{t('pages.compliance.retry')}</Button>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--text-muted)] text-center py-8">{t('pages.compliance.noHerbsFound')}</p>
                    )
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
