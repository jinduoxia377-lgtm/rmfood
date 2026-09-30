/**
 * 配料六维分析页面 — 完整功能版
 * 雷达图可视化 + 添加剂替代建议 + 药食同源检索
 * 主题系统：对齐设计令牌规范（violet→accent, emerald→success, amber/yellow→warning, red→danger, blue→secondary）
 */
import { useState, useEffect } from 'react'
import {
  Beaker, Search, FlaskConical, AlertTriangle, CheckCircle2,
  Activity, ShieldAlert, BookOpen, Lightbulb, XCircle,
} from 'lucide-react'
import {
  RadarChart as RechartsRadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
} from 'recharts'
import { ingredientApi, type AnalysisResult, type AdditiveInfo } from '@/api/ingredient'
import { complianceApi } from '@/api/compliance'
import { useToast } from '@/components/ui/Toast'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui'

// ─── 本地存储 ────────────────────────────────────────────────
const STORAGE_KEY = 'rmfood_ingredient_history'
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] } }
const saveHistory = (items: any[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 20)))

// ─── 图表配色（设计令牌）────────────────────────────────────
const CHART_COLORS = {
  accent: 'var(--color-accent)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  secondary: 'var(--color-secondary)',
}

// ─── 风险分级 ────────────────────────────────────────────────
const riskColor = (risk: string) =>
  risk === 'high' ? 'text-danger-500 dark:text-danger-400' : risk === 'medium' ? 'text-warning-500 dark:text-warning-400' : 'text-success-500 dark:text-success-400'
const riskBg = (risk: string) =>
  risk === 'high' ? 'bg-danger-50 dark:bg-danger-950/20 border-danger-200 dark:border-danger-900' :
  risk === 'medium' ? 'bg-warning-50 dark:bg-warning-950/20 border-warning-200 dark:border-warning-900' :
  'bg-success-50 dark:bg-success-950/20 border-success-200 dark:border-success-900'

export default function IngredientAnalysisPage() {
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
    if (!ingredientText.trim()) { addToast({ type: 'warning', message: '请输入配料列表文本' }); return }
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
        date: new Date().toLocaleDateString('zh-CN'),
      }
      const newHistory = [histItem, ...history].slice(0, 20)
      setHistory(newHistory)
      saveHistory(newHistory)
      addToast({ type: 'success', message: `综合评分：${(data?.overallScore ?? 0)}/100` })
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
    { dimension: '营养评分', value: result.nutriScore, fullMark: 100 },
    { dimension: 'NOVA等级', value: Math.max(0, 100 - ((result.novaResult?.group as number ?? 1)) * 25), fullMark: 100 },
    { dimension: '安全性', value: result.overallScore >= 70 ? 80 : result.overallScore >= 40 ? 50 : 20, fullMark: 100 },
    { dimension: '过敏风险', value: Math.max(0, 100 - (result.allergens?.length ?? 0) * 20), fullMark: 100 },
    { dimension: '中草药合规', value: ((result.herbalIngredients?.length ?? 0) > 0) ? 70 : 90, fullMark: 100 },
    { dimension: '添加剂风险', value: Math.max(0, 100 - result.additives.length * 15), fullMark: 100 },
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
    return subs[additive.name] ?? ['建议咨询专业人士寻找替代方案']
  }

  return (
    <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      {/* 品牌横幅 — 对齐设计系统 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="surface-primary rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
                <Beaker className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">配料六维分析</h1>
                <p className="text-white/80 text-sm">Nutri-Score · NOVA分类 · 添加剂库 · 过敏原 · 中草药识别 · 药食同源</p>
              </div>
            </div>
            {history.length > 0 && (
              <button onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors">
                <BookOpen size={12} />历史 ({history.length})
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* 历史面板 */}
        {showHistory && history.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wide">最近分析历史</div>
              <div className="flex gap-2 flex-wrap">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg text-xs">
                    <span className="font-mono text-accent-600 dark:text-accent-400">{h.score}/100</span>
                    <span className={`font-medium ${h.grade === 'low' ? 'text-success-500 dark:text-success-400' : h.grade === 'medium' ? 'text-warning-500 dark:text-warning-400' : 'text-danger-500 dark:text-danger-400'}`}>
                      {h.grade === 'low' ? '低风险' : h.grade === 'medium' ? '中风险' : '高风险'}
                    </span>
                    <span className="text-neutral-400 truncate max-w-[120px]">{h.text}</span>
                    <span className="text-neutral-300 dark:text-neutral-600">{h.date}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs — 对齐 Apple Segmented Control 规范 */}
        <div className="tabs-list w-fit">
          {[
            { key: 'analyze' as const, label: '六维分析', icon: Activity },
            { key: 'additives' as const, label: '添加剂库', icon: ShieldAlert },
            { key: 'homology' as const, label: '药食同源', icon: BookOpen },
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
          <div className="space-y-4">
            <Card>
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle as="h3" className="text-sm font-semibold flex items-center gap-2">
                  <FlaskConical size={14} className="text-accent-500 dark:text-accent-400" />配料列表（逗号或换行分隔）
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                <textarea
                  value={ingredientText}
                  onChange={e => setIngredientText(e.target.value)}
                  placeholder={"水、蔗糖、抗坏血酸（VC）、柠檬酸、苯甲酸钠、丙二醇、天然香草香料、花粉提取物、人参提取物..."}
                  rows={5}
                  className="w-full px-4 py-3 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-100 resize-none focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
                <div className="mt-3">
                  <Button onClick={handleAnalyze} disabled={loading}>
                    {loading ? <Activity size={14} className="animate-spin" /> : <Activity size={14} />}
                    {loading ? '分析中...' : '执行六维分析'}
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
                      <Activity size={14} className="text-accent-500 dark:text-accent-400" />六维雷达图
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsRadarChart data={radarData}>
                            <PolarGrid stroke="var(--border-color)" />
                            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                            <RechartsTooltip
                              formatter={(value: number) => [`${value}分`, '评分']}
                              contentStyle={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}
                            />
                            <Radar name="综合评分" dataKey="value" stroke={CHART_COLORS.accent} fill={CHART_COLORS.accent} fillOpacity={0.2} strokeWidth={2} />
                          </RechartsRadarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl p-3 bg-success-50 dark:bg-success-950/20 border border-success-200 dark:border-success-900">
                            <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Nutri-Score</div>
                            <div className="text-xl font-bold text-success-500 dark:text-success-400">{result.nutriScore}/100</div>
                            <div className="text-xs text-neutral-400 mt-1">{String(result.nutriGrade?.grade ?? '?')} 等级</div>
                          </div>
                          <div className="rounded-xl p-3 bg-secondary-50 dark:bg-secondary-950/20 border border-secondary-200 dark:border-secondary-900">
                            <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">NOVA 分组</div>
                            <div className="text-xl font-bold text-secondary-500 dark:text-secondary-400">{String(result.novaResult?.group ?? "?")}</div>
                            <div className="text-xs text-neutral-400 mt-1">{String(result.novaResult?.label ?? "")}</div>
                          </div>
                          <div className="rounded-xl p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                            <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">综合评分</div>
                            <div className={`text-xl font-bold ${result.overallScore >= 70 ? 'text-success-500 dark:text-success-400' : result.overallScore >= 40 ? 'text-warning-500 dark:text-warning-400' : 'text-danger-500 dark:text-danger-400'}`}>
                              {result.overallScore}
                            </div>
                            <div className="text-xs text-neutral-400 mt-1">
                              {result.riskLevel === 'high' ? '高风险' : result.riskLevel === 'medium' ? '中风险' : '低风险'}
                            </div>
                          </div>
                          <div className="rounded-xl p-3 bg-warning-50 dark:bg-warning-950/20 border border-warning-200 dark:border-warning-900">
                            <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">过敏原</div>
                            <div className="text-xl font-bold text-warning-500 dark:text-warning-400">{result.allergens?.length ?? 0}</div>
                            <div className="text-xs text-neutral-400 mt-1">个已识别</div>
                          </div>
                        </div>

                        {/* 过敏原列表 */}
                        {result.allergens.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">已识别过敏原</div>
                            <div className="flex flex-wrap gap-1">
                              {result.allergens.map((a, i) => (
                                <span key={i} className="px-2 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 text-xs rounded-md font-medium">
                                  {a.name} ({a.level})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 中草药识别 */}
                        {result.herbalIngredients.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">中草药成分</div>
                            <div className="flex flex-wrap gap-1">
                              {result.herbalIngredients.map((h, i) => (
                                <span key={i} className="px-2 py-0.5 bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 text-xs rounded-md font-medium">
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
                        <ShieldAlert size={14} className="text-warning-500 dark:text-warning-400" />已识别添加剂及替代建议
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-5 pt-0">
                      <div className="space-y-2">
                        {result.additives.map((a, i) => (
                          <div key={i} className={`rounded-lg border p-3 ${riskBg(a.risk)}`}>
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500 w-16">{a.eCode}</span>
                              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{a.name}</span>
                              <span className="text-xs text-neutral-500 dark:text-neutral-400">{a.function}</span>
                              <span className={`text-xs font-bold ${riskColor(a.risk)}`}>{a.risk === 'high' ? '高风险' : a.risk === 'medium' ? '中风险' : '低风险'}</span>
                              {a.carcinogen && <span className="text-xs bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 px-1.5 py-0.5 rounded">致癌</span>}
                              {a.allergen && <span className="text-xs bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400 px-1.5 py-0.5 rounded">过敏</span>}
                              {a.maxUsage && <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500">最大用量: {a.maxUsage}</span>}
                            </div>
                            {a.risk === 'high' && (
                              <div className="mt-2 pt-2 border-t border-inherit">
                                <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 flex items-center gap-1">
                                  <Lightbulb size={12} className="text-warning-500 dark:text-warning-400" />替代建议
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {getSubstitutions(a).map((sub, j) => (
                                    <span key={j} className="px-2 py-0.5 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 text-xs rounded-md">
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
                  <div className="rounded-xl bg-danger-50 dark:bg-danger-950/20 border border-danger-200 dark:border-danger-900 p-5">
                    <h3 className="text-sm font-semibold text-danger-600 dark:text-danger-400 mb-3 flex items-center gap-2">
                      <AlertTriangle size={14} />风险提示
                    </h3>
                    <div className="space-y-1">
                      {result.riskMessages.map((m, i) => (
                        <div key={i} className="flex items-start gap-2 px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-300">
                          <XCircle size={12} className="text-danger-400 mt-0.5 shrink-0" />{m}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 优化建议 */}
                {result.suggestions.length > 0 && (
                  <div className="rounded-xl bg-secondary-50 dark:bg-secondary-950/20 border border-secondary-200 dark:border-secondary-900 p-5">
                    <h3 className="text-sm font-semibold text-secondary-600 dark:text-secondary-400 mb-3 flex items-center gap-2">
                      <Lightbulb size={14} />优化建议
                    </h3>
                    <div className="space-y-1">
                      {result.suggestions.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-300">
                          <span className="text-secondary-400">→</span>{typeof s === 'string' ? s : (s as any).text || (s as any).message || (s as any).type || JSON.stringify(s)}
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
                <ShieldAlert size={14} className="text-warning-500 dark:text-warning-400" />食品添加剂数据库
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <div className="mb-4">
                <Input value={searchTerm} onChange={e => handleSearchAdditive(e.target.value)}
                  placeholder="搜索添加剂名称或E编码..." className="h-9 text-sm" />
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredAdditives.length === 0 ? (
                  <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8">
                    {additives.length === 0 ? '加载中...' : '无匹配结果'}
                  </p>
                ) : filteredAdditives.map((a, i) => (
                  <div key={i} className={`flex items-center gap-4 px-3 py-2.5 rounded-lg border ${riskBg(a.risk)}`}>
                    <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500 w-16">{a.eCode}</span>
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{a.name}</span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">{a.function}</span>
                    <span className={`text-xs font-bold ${riskColor(a.risk)}`}>{a.risk === 'high' ? '高' : a.risk === 'medium' ? '中' : '低'}</span>
                    {a.carcinogen && <span className="text-xs bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 px-1.5 py-0.5 rounded">致癌</span>}
                    {a.allergen && <span className="text-xs bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400 px-1.5 py-0.5 rounded">过敏</span>}
                    {a.maxUsage && <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500">{a.maxUsage}</span>}
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
                <BookOpen size={14} className="text-accent-500 dark:text-accent-400" />药食同源目录（2025版）
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              {homologyList.length === 0 ? (
                <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8">加载中...</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                  {homologyList.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg">
                      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{item.name}</span>
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">{item.category}</span>
                      <span className="text-xs font-mono text-accent-600 dark:text-accent-400 ml-auto">最大 {item.max_dosage}</span>
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
