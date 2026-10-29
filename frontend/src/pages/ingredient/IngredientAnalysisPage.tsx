/**
 * 配料六维分析页面 — 完整功能版
 * 雷达图可视化 + 添加剂替代建议 + 药食同源检索
 * 主题系统：对齐设计令牌规范（violet→accent, emerald→success, amber/yellow→warning, red→danger, blue→secondary）
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Beaker, FlaskConical, AlertTriangle,
  Activity, ShieldAlert, BookOpen, Lightbulb, XCircle,
} from 'lucide-react'
import {
  RadarChart as RechartsRadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts'
import { ingredientApi, type AnalysisResult, type AdditiveInfo } from '@/api/ingredient'
import { complianceApi } from '@/api/compliance'
import { useToast } from '@/components/ui/Toast'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'

// ─── 本地存储 ────────────────────────────────────────────────
const STORAGE_KEY = 'rmfood_ingredient_history'
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] } }
const saveHistory = (items: any[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 20)))

// ─── 图表配色（设计令牌）────────────────────────────────────
const CHART_COLORS = {
  accent: 'var(--color-accent)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-error)',
  secondary: 'var(--color-secondary)',
}

// ─── 风险分级 ────────────────────────────────────────────────
const riskColor = (risk: string) =>
  risk === 'high' ? 'text-danger-500 dark:text-danger-600' : risk === 'medium' ? 'text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]' : 'text-[var(--color-success-text)]0 dark:text-[var(--color-success-text)]'
const riskBg = (risk: string) =>
  risk === 'high' ? 'bg-danger-50 dark:bg-danger-950/20 border-danger-200 dark:border-danger-900' :
  risk === 'medium' ? 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/20 border-[var(--color-warning-border)] dark:border-warning-900' :
  'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/20 border-[var(--color-success-border)] dark:border-success-900'

export default function IngredientAnalysisPage() {
  const { t, i18n } = useTranslation()
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState<'analyze' | 'additives' | 'homology'>('analyze')
  const [ingredientText, setIngredientText] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [additives, setAdditives] = useState<AdditiveInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredAdditives, setFilteredAdditives] = useState<AdditiveInfo[]>([])
  const [homologyList, setHomologyList] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>(loadHistory)
  const [showHistory, setShowHistory] = useState(false)

  const handleAnalyze = async () => {
    if (!ingredientText.trim()) { addToast({ type: 'warning', message: t('pages.ingredient.toastInputRequired') }); return }
    setLoading(true)
    try {
      const res: any = await ingredientApi.analyze({ ingredient_text: ingredientText })
      // 后端返回 { success, data: AnalysisResult, message }，axios res.data 即该对象
      const data = res.data?.data ?? res.data
      setResult(data)
      // Save to history
      const histItem = {
        id: Date.now(),
        text: ingredientText.substring(0, 50) + (ingredientText.length > 50 ? '...' : ''),
        score: data?.overallScore ?? 0,
        grade: data?.riskLevel ?? '?',
        date: new Date().toLocaleDateString(i18n.language),
      }
      const newHistory = [histItem, ...history].slice(0, 20)
      setHistory(newHistory)
      saveHistory(newHistory)
      addToast({ type: 'success', message: t('pages.ingredient.toastScore', { score: data?.overallScore ?? 0 }) })
    } catch (e: any) {
      addToast({ type: 'error', message: String(e) })
    } finally { setLoading(false) }
  }

  const handleLoadAdditives = async () => {
    try {
      const res: any = await ingredientApi.getAdditives()
      // 后端返回 { success, data: AdditiveInfo[], total }，axios res.data 即该对象
      const items = res.data?.data ?? res.data ?? []
      setAdditives(items); setFilteredAdditives(items)
    } catch (e: any) { addToast({ type: 'error', message: String(e) }) }
  }

  const handleLoadHomology = async () => {
    try {
      const res: any = await complianceApi.getFoodHomology()
      // 后端返回 { success, data: { source, count, materials: [...] } }，直连 JSON 非 axios
      if (res.success && res.data?.materials) setHomologyList(res.data.materials)
    } catch (e: any) { addToast({ type: 'error', message: String(e) }) }
  }

  const handleSearchAdditive = (term: string) => {
    setSearchTerm(term)
    if (!term) { setFilteredAdditives(additives); return }
    const filtered = additives.filter(a =>
      (a.name || '').toLowerCase().includes(term.toLowerCase()) ||
      ((a.eCode || '') as string).toLowerCase().includes(term.toLowerCase())
    )
    setFilteredAdditives(filtered)
  }

  // Build radar chart data from analysis result
  const radarData = result ? [
    { dimension: t('pages.ingredient.radarDimensions.nutrition'), value: result.nutriScore, fullMark: 100 },
    { dimension: t('pages.ingredient.radarDimensions.nova'), value: Math.max(0, 100 - ((result.novaResult?.group as number ?? 1)) * 25), fullMark: 100 },
    { dimension: t('pages.ingredient.radarDimensions.safety'), value: result.overallScore >= 70 ? 80 : result.overallScore >= 40 ? 50 : 20, fullMark: 100 },
    { dimension: t('pages.ingredient.radarDimensions.allergenRisk'), value: Math.max(0, 100 - (result.allergens?.length ?? 0) * 20), fullMark: 100 },
    { dimension: t('pages.ingredient.radarDimensions.herbalCompliance'), value: ((result.herbalIngredients?.length ?? 0) > 0) ? 70 : 90, fullMark: 100 },
    { dimension: t('pages.ingredient.radarDimensions.additiveRisk'), value: Math.max(0, 100 - result.additives.length * 15), fullMark: 100 },
  ] : []

  // Get substitution suggestions for high-risk additives
  const getSubstitutions = (additive: AdditiveInfo) => {
    const subs: Record<string, string[]> = {
      '苯甲酸钠': ['山梨酸钾', '乳酸链球菌素', '天然防腐剂（nistatin）'],
      '丙二醇': ['甘油', '聚乙二醇', '植物甘油'],
      '阿斯巴甜': ['赤藓糖醇', '甜菊糖苷', '罗汉果甜苷'],
      '亮蓝': ['螺旋藻提取物', '姜黄素', '甜菜红'],
      '柠檬黄': ['姜黄素', '枸杞提取物', '红曲红'],
    }
    return subs[additive.name] ?? [t('pages.ingredient.consultProfessional')]
  }

  return (
    <div className="min-h-screen">
      {/* 品牌横幅 — 对齐设计系统 */}
      <div className="max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)]">
        <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)]/15 flex items-center justify-center">
                <Beaker className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">{t('pages.ingredient.title')}</h1>
                <p className="text-white/80 text-sm">{t('pages.ingredient.subtitle')}</p>
              </div>
            </div>
            {history.length > 0 && (
              <button onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 px-[var(--space-apple-sm)] py-1.5 min-h-[44px] text-xs font-medium bg-[var(--bg-secondary)]/15 hover:bg-[var(--bg-secondary)]/25 text-[var(--color-primary-text)] dark:text-white rounded-[var(--radius-pill)] transition-colors">
                <BookOpen size={12} />{t('pages.ingredient.history', { count: history.length })}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)] space-y-[var(--space-apple-md)]">
        {/* 历史面板 */}
        {showHistory && history.length > 0 && (
          <Card>
            <CardContent className="p-[var(--space-apple-md)]">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wide">{t('pages.ingredient.recentAnalysis')}</div>
              <div className="flex gap-2 flex-wrap">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-2 px-[var(--space-apple-sm)] py-1.5 bg-[var(--bg-tertiary)]/60 rounded-[var(--radius-Apple-sm)] text-xs">
                    <span className="font-mono text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]">{h.score}/100</span>
                    <span className={`font-medium ${h.grade === 'low' ? 'text-[var(--color-success-text)]0 dark:text-[var(--color-success-text)]' : h.grade === 'medium' ? 'text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]' : 'text-danger-500 dark:text-danger-600'}`}>
                      {h.grade === 'low' ? t('pages.ingredient.riskLow') : h.grade === 'medium' ? t('pages.ingredient.riskMedium') : t('pages.ingredient.riskHigh')}
                    </span>
                    <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] truncate max-w-[120px]">{h.text}</span>
                    <span className="text-[var(--text-muted)] dark:text-[var(--text-muted)]">{h.date}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs — 对齐 Apple Segmented Control 规范 */}
        <div className="tabs-list w-fit">
          {[
            { key: 'analyze' as const, label: t('pages.ingredient.tabAnalyze'), icon: Activity },
            { key: 'additives' as const, label: t('pages.ingredient.tabAdditives'), icon: ShieldAlert },
            { key: 'homology' as const, label: t('pages.ingredient.tabHomology'), icon: BookOpen },
          ].map(tab => (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); if (tab.key === 'additives' && additives.length === 0) handleLoadAdditives(); if (tab.key === 'homology' && homologyList.length === 0) handleLoadHomology() }}
              className={`tabs-trigger ${activeTab === tab.key ? 'tabs-trigger-active' : ''}`}>
              <span className="icon"><tab.icon size={14} /></span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══ 六维分析 Tab ═══ */}
        {activeTab === 'analyze' && (
          <div className="space-y-[var(--space-apple-md)]">
            <Card>
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                  <FlaskConical size={14} className="text-[var(--color-accent-text)]0 dark:text-[var(--color-accent-text)]" />{t('pages.ingredient.ingredientList')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                <textarea
                  value={ingredientText}
                  onChange={e => setIngredientText(e.target.value)}
                  placeholder={t('pages.ingredient.textareaPlaceholder')}
                  rows={5}
                  className="w-full px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-sm rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-tertiary)] dark:text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
                <div className="mt-[var(--space-apple-sm)]">
                  <Button onClick={handleAnalyze} disabled={loading}>
                    {loading ? <Activity size={14} className="animate-spin" /> : <Activity size={14} />}
                    {loading ? t('pages.ingredient.analyzing') : t('pages.ingredient.runAnalyze')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {result && (
              <>
                {/* 六维雷达图 */}
                <Card>
                  <CardHeader className="px-5 pt-5 pb-3">
                    <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                      <Activity size={14} className="text-[var(--color-accent-text)]0 dark:text-[var(--color-accent-text)]" />{t('pages.ingredient.radarTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsRadarChart data={radarData}>
                            <PolarGrid stroke="var(--border-color)" />
                            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                            <RechartsTooltip
                              formatter={(value: number) => [`${value}${t('pages.ingredient.scoreUnit')}`, t('pages.ingredient.overallScoreName')]}
                              contentStyle={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}
                            />
                            <Radar name={t('pages.ingredient.overallScoreName')} dataKey="value" stroke={CHART_COLORS.accent} fill={CHART_COLORS.accent} fillOpacity={0.2} strokeWidth={2} />
                          </RechartsRadarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-[var(--space-apple-sm)]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
                          <div className="rounded-[var(--radius-Apple-md)] p-[var(--space-apple-sm)] bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/20 border border-[var(--color-success-border)] dark:border-success-900">
                            <div className="text-xs text-[var(--text-muted)] mb-1">{t('pages.ingredient.nutriScore')}</div>
                            <div className="text-xl font-bold text-[var(--color-success-text)]0 dark:text-[var(--color-success-text)]">{result.nutriScore}/100</div>
                            <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">{t('pages.ingredient.grade', { grade: String(result.nutriGrade?.grade ?? '?') })}</div>
                          </div>
                          <div className="rounded-[var(--radius-Apple-md)] p-[var(--space-apple-sm)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 border border-[var(--color-secondary-border)] dark:border-secondary-900">
                            <div className="text-xs text-[var(--text-muted)] mb-1">{t('pages.ingredient.novaGroup')}</div>
                            <div className="text-xl font-bold text-[var(--color-secondary-text)]0 dark:text-[var(--color-secondary-text)]">{String(result.novaResult?.group ?? "?")}</div>
                            <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">{String(result.novaResult?.label ?? "")}</div>
                          </div>
                          <div className="rounded-[var(--radius-Apple-md)] p-[var(--space-apple-sm)] bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                            <div className="text-xs text-[var(--text-muted)] mb-1">{t('pages.ingredient.overallScore')}</div>
                            <div className={`text-xl font-bold ${result.overallScore >= 70 ? 'text-[var(--color-success-text)]0 dark:text-[var(--color-success-text)]' : result.overallScore >= 40 ? 'text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]' : 'text-danger-500 dark:text-danger-600'}`}>
                              {result.overallScore}
                            </div>
                            <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                              {result.riskLevel === 'high' ? t('pages.ingredient.riskHigh') : result.riskLevel === 'medium' ? t('pages.ingredient.riskMedium') : t('pages.ingredient.riskLow')}
                            </div>
                          </div>
                          <div className="rounded-[var(--radius-Apple-md)] p-[var(--space-apple-sm)] bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/20 border border-[var(--color-warning-border)] dark:border-warning-900">
                            <div className="text-xs text-[var(--text-muted)] mb-1">{t('pages.ingredient.allergens')}</div>
                            <div className="text-xl font-bold text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]">{result.allergens?.length ?? 0}</div>
                            <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">{t('pages.ingredient.allergensCount')}</div>
                          </div>
                        </div>

                        {/* 过敏原列表 */}
                        {result.allergens.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-[var(--text-muted)] mb-2">{t('pages.ingredient.identifiedAllergens')}</div>
                            <div className="flex flex-wrap gap-1">
                              {result.allergens.map((a, i) => (
                                <span key={i} className="px-2 py-0.5 bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/25 text-[var(--color-warning-text)] text-xs rounded-[var(--radius-Apple-sm)] font-medium">
                                  {a.name} ({a.level})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 中草药识别 */}
                        {result.herbalIngredients.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-[var(--text-muted)] mb-2">{t('pages.ingredient.herbalIngredients')}</div>
                            <div className="flex flex-wrap gap-1">
                              {result.herbalIngredients.map((h, i) => (
                                <span key={i} className="px-2 py-0.5 bg-[var(--color-accent-container)] dark:bg-[var(--color-accent-container)]/25 text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)] text-xs rounded-[var(--radius-Apple-sm)] font-medium">
                                  {h.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 添加剂分析 */}
                {result.additives.length > 0 && (
                  <Card>
                    <CardHeader className="px-5 pt-5 pb-3">
                      <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                        <ShieldAlert size={14} className="text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]" />{t('pages.ingredient.additivesSuggestions')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-5 pt-0">
                      <div className="space-y-2">
                        {result.additives.map((a, i) => (
                          <div key={i} className={`rounded-[var(--radius-Apple-sm)] border p-[var(--space-apple-sm)] ${riskBg(a.risk)}`}>
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-mono text-[var(--text-muted)] w-16">{a.eCode}</span>
                              <span className="text-sm font-medium text-[var(--text-primary)]">{a.name}</span>
                              <span className="text-xs text-[var(--text-muted)]">{a.function}</span>
                              <span className={`text-xs font-bold ${riskColor(a.risk)}`}>{a.risk === 'high' ? t('pages.ingredient.riskHigh') : a.risk === 'medium' ? t('pages.ingredient.riskMedium') : t('pages.ingredient.riskLow')}</span>
                              {a.carcinogen && <span className="text-xs bg-danger-100 dark:bg-danger-300/25 text-danger-600 dark:text-danger-600 px-1.5 py-0.5 rounded">{t('pages.ingredient.carcinogen')}</span>}
                              {a.allergen && <span className="text-xs bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/25 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)] px-1.5 py-0.5 rounded">{t('pages.ingredient.allergen')}</span>}
                              {a.maxUsage && <span className="ml-auto text-xs text-[var(--text-muted)]">{t('pages.ingredient.maxUsage', { value: a.maxUsage })}</span>}
                            </div>
                            {a.risk === 'high' && (
                              <div className="mt-2 pt-2 border-t border-inherit">
                                <div className="text-xs font-semibold text-[var(--text-muted)] mb-1 flex items-center gap-1">
                                  <Lightbulb size={12} className="text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]" />{t('pages.ingredient.substitution')}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {getSubstitutions(a).map((sub, j) => (
                                    <span key={j} className="px-2 py-0.5 bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/25 text-[var(--color-success-text)] dark:text-[var(--color-success-text)] text-xs rounded-[var(--radius-Apple-sm)]">
                                      → {sub}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 风险消息 */}
                {result.riskMessages.length > 0 && (
                  <div className="rounded-[var(--radius-Apple-md)] bg-danger-50 dark:bg-danger-950/20 border border-danger-200 dark:border-danger-900 p-5">
                    <h2 className="text-sm font-semibold text-danger-600 dark:text-danger-600 mb-[var(--space-apple-sm)] flex items-center gap-2">
                      <AlertTriangle size={14} />{t('pages.ingredient.riskMessages')}
                    </h2>
                    <div className="space-y-1">
                      {result.riskMessages.map((m, i) => (
                        <div key={i} className="flex items-start gap-2 px-[var(--space-apple-sm)] py-1.5 text-sm text-[var(--text-primary)]">
                          <XCircle size={12} className="text-danger-400 mt-0.5 shrink-0" />{m}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 优化建议 */}
                {result.suggestions.length > 0 && (
                  <div className="rounded-[var(--radius-Apple-md)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 border border-[var(--color-secondary-border)] dark:border-secondary-900 p-5">
                    <h2 className="text-sm font-semibold text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] mb-[var(--space-apple-sm)] flex items-center gap-2">
                      <Lightbulb size={14} />{t('pages.ingredient.suggestions')}
                    </h2>
                    <div className="space-y-1">
                      {result.suggestions.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 px-[var(--space-apple-sm)] py-1.5 text-sm text-[var(--text-primary)]">
                          <span className="text-[var(--color-secondary-text)]">→</span>{typeof s === 'string' ? s : (s as unknown as { text?: string; message?: string; type?: string }).text || (s as unknown as { text?: string; message?: string; type?: string }).message || (s as unknown as { text?: string; message?: string; type?: string }).type || JSON.stringify(s)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ 添加剂库 Tab ═══ */}
        {activeTab === 'additives' && (
          <Card>
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                <ShieldAlert size={14} className="text-[var(--color-warning-text)]0 dark:text-[var(--color-warning-text)]" />{t('pages.ingredient.additivesDb')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <div className="mb-[var(--space-apple-md)]">
                <Input value={searchTerm} onChange={e => handleSearchAdditive(e.target.value)}
                  placeholder={t('pages.ingredient.searchAdditive')} className="h-9 text-sm" />
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredAdditives.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] text-center py-8">
                    {additives.length === 0 ? t('pages.ingredient.loading') : t('pages.ingredient.noMatch')}
                  </p>
                ) : filteredAdditives.map((a, i) => (
                  <div key={i} className={`flex items-center gap-4 px-[var(--space-apple-sm)] py-2.5 rounded-[var(--radius-Apple-sm)] border ${riskBg(a.risk)}`}>
                    <span className="text-xs font-mono text-[var(--text-muted)] w-16">{a.eCode}</span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{a.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">{a.function}</span>
                    <span className={`text-xs font-bold ${riskColor(a.risk)}`}>{a.risk === 'high' ? t('pages.ingredient.riskHighShort') : a.risk === 'medium' ? t('pages.ingredient.riskMediumShort') : t('pages.ingredient.riskLowShort')}</span>
                    {a.carcinogen && <span className="text-xs bg-danger-100 dark:bg-danger-300/25 text-danger-600 dark:text-danger-600 px-1.5 py-0.5 rounded">{t('pages.ingredient.carcinogen')}</span>}
                    {a.allergen && <span className="text-xs bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/25 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)] px-1.5 py-0.5 rounded">{t('pages.ingredient.allergen')}</span>}
                    {a.maxUsage && <span className="ml-auto text-xs text-[var(--text-muted)]">{a.maxUsage}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ 药食同源 Tab ═══ */}
        {activeTab === 'homology' && (
          <Card>
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                <BookOpen size={14} className="text-[var(--color-accent-text)]0 dark:text-[var(--color-accent-text)]" />{t('pages.ingredient.homologyCatalog')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              {homologyList.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-8">{t('pages.ingredient.loading')}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                  {homologyList.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-[var(--space-apple-sm)] px-[var(--space-apple-sm)] py-2.5 bg-[var(--bg-tertiary)]/60 rounded-[var(--radius-Apple-sm)]">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{item.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">{item.category}</span>
                      <span className="text-xs font-mono text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)] ml-auto">{t('pages.ingredient.maxDosage', { value: item.max_dosage })}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
