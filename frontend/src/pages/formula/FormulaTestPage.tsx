/**
 * 配方功能测试页面
 * 深度完善版：使用真实公式数据，对接实际 API
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Share2, Star, Calculator,
  FlaskConical, Activity, Shield, CheckCircle2,
  AlertCircle, Loader,
} from 'lucide-react'
import { Button, PageHeader, Tabs, TabsList, TabsTrigger, TabsContent, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { formulaApi, listFormulas, getFormula } from '@/api/formula'
import { ShareFormula } from './components/ShareFormula'
import { FormulaRating } from './components/FormulaRating'
import { FormulaCostAnalysis } from './components/FormulaCostAnalysis'
import { useToast } from '@/components/ui/Toast'

// ── 通用测试面板 ───────────────────────────────────────────────
function TestPanel({
  title, icon, desc, runFn, runLabel,
}: {
  title: string
  icon: React.ReactNode
  desc: string
  runFn: () => Promise<any>
  runLabel: string
}) {
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRun = async () => {
    setLoading(true); setError(null); setResult(null)
    try {
      const r = await runFn()
      setResult(r)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? '请求失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-accent-500">{icon}</span>
        <h3 className="font-medium text-neutral-900 dark:text-white text-sm">{title}</h3>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{desc}</p>
      <Button variant="primary" size="sm" disabled={loading} onClick={handleRun}>
        {loading ? <span className="flex items-center gap-2"><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />运行中...</span> : runLabel}
      </Button>
      {error && (
        <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-300/20 border border-danger-200 dark:border-danger-800 text-xs text-danger-600 dark:text-danger-700">
          <span className="flex items-center gap-1"><AlertCircle size={12} />{error}</span>
        </div>
      )}
      {result && (
        <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
          <pre className="text-xs text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export function FormulaTestPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState('formulas')
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedFormulaId, setSelectedFormulaId] = useState<number | null>(null)
  const [formulas, setFormulas] = useState<any[]>([])
  const [formulasLoading, setFormulasLoading] = useState(false)
  const [selectedFormula, setSelectedFormula] = useState<any>(null)
  const [selectedFormulaLoading, setSelectedFormulaLoading] = useState(false)

  // 加载真实配方列表
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormulasLoading(true)
    listFormulas({ page: 1, page_size: 20 })
      .then((res: any) => {
        const data = res?.data ?? res
        setFormulas(Array.isArray(data?.items) ? data.items : [])
        if (data?.items?.length > 0 && !selectedFormulaId) {
          setSelectedFormulaId(data.items[0].id)
        }
      })
      .catch(() => addToast({ type: 'error', message: '加载配方列表失败' }))
      .finally(() => setFormulasLoading(false))
  }, [])

  // 加载选中配方详情
  useEffect(() => {
    if (!selectedFormulaId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedFormulaLoading(true)
    getFormula(selectedFormulaId)
      .then(setSelectedFormula)
      .catch(() => setSelectedFormula(null))
      .finally(() => setSelectedFormulaLoading(false))
  }, [selectedFormulaId])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      <PageHeader
        title="配方功能测试"
        description="使用真实配方数据测试各功能模块"
      />

      {/* 配方选择器 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">选择配方：</span>
            {formulasLoading ? (
              <Loader className="w-4 h-4 animate-spin text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
            ) : formulas.length === 0 ? (
              <span className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">暂无配方，请先创建</span>
            ) : (
              <select
                value={selectedFormulaId ?? ''}
                onChange={e => setSelectedFormulaId(Number(e.target.value))}
                className="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {formulas.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.id}. {f.name || f.code || `配方#${f.id}`}
                  </option>
                ))}
              </select>
            )}
            {selectedFormula && (
              <>
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">|</span>
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  {selectedFormula.ingredients?.length ?? 0} 味药材
                  {selectedFormula.status ? ` · ${selectedFormula.status}` : ''}
                </span>
                <Button size="sm" variant="outline" onClick={() => navigate(`/formulas/${selectedFormulaId}`)}>
                  查看详情
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="formulas" value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto pb-2">
          <TabsList className="min-w-max">
            <TabsTrigger value="formulas" icon={<FlaskConical size={16} />}>配方管理</TabsTrigger>
            <TabsTrigger value="cost" icon={<Calculator size={16} />}>成本分析</TabsTrigger>
            <TabsTrigger value="rating" icon={<Star size={16} />}>评分系统</TabsTrigger>
            <TabsTrigger value="share" icon={<Share2 size={16} />}>分享功能</TabsTrigger>
            <TabsTrigger value="analysis" icon={<Activity size={16} />}>深度分析</TabsTrigger>
          </TabsList>
        </div>

        {/* 配方管理 */}
        <TabsContent value="formulas" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>配方列表</CardTitle></CardHeader>
            <CardContent>
              {formulasLoading ? (
                <div className="text-center py-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]"><Loader className="w-6 h-6 animate-spin mx-auto mb-2" />加载配方...</div>
              ) : formulas.length === 0 ? (
                <div className="text-center py-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">暂无配方数据</div>
              ) : (
                <div className="space-y-2">
                  {formulas.map(f => (
                    <button
                      key={f.id}
                      onClick={() => { setSelectedFormulaId(f.id) }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                        selectedFormulaId === f.id
                          ? 'border-primary bg-primary/5 dark:bg-primary/10'
                          : 'border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:bg-neutral-800 dark:hover:bg-neutral-800/50'
                      }`}
                    >
                      <div>
                        <div className="font-mono text-xs text-primary">{f.id}</div>
                        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{f.name || f.code || `配方#${f.id}`}</div>
                      </div>
                      <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex items-center gap-3">
                        <span>{f.ingredients?.length ?? 0} 味药材</span>
                        <span className={`px-2 py-0.5 rounded-full ${
                          f.status === 'APPROVED' ? 'bg-success-100 text-success-700' :
                          f.status === 'DRAFT' ? 'bg-warning-100 text-warning-700' :
                          'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'
                        }`}>{f.status || '未知'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 成本分析 */}
        <TabsContent value="cost" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>成本分析测试</CardTitle></CardHeader>
            <CardContent>
              {selectedFormulaLoading ? (
                <div className="text-center py-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]"><Loader className="w-6 h-6 animate-spin mx-auto mb-2" />加载配方...</div>
              ) : !selectedFormula ? (
                <div className="text-center py-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">请先选择一个配方</div>
              ) : (
                <FormulaCostAnalysis
                  ingredients={(selectedFormula.ingredients ?? []).map((ing: any) => ({
                    name: ing.name,
                    dosage: ing.dosage || `${ing.amount || '?'}g`,
                    estimatedCost: ing.cost || 0,
                    category: ing.category || '其他',
                    isFoodHomology: ing.is_food_homology || false,
                  }))}
                  totalWeight={selectedFormula.total_weight || 0}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 评分系统 */}
        <TabsContent value="rating" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>评分系统测试</CardTitle></CardHeader>
            <CardContent>
              {selectedFormulaLoading ? (
                <div className="text-center py-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]"><Loader className="w-6 h-6 animate-spin mx-auto mb-2" />加载配方...</div>
              ) : !selectedFormula ? (
                <div className="text-center py-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">请先选择一个配方</div>
              ) : (
                <FormulaRating
                  formulaId={selectedFormulaId!}
                  formulaName={selectedFormula.name || `配方#${selectedFormulaId}`}
                  onRatingChange={(rating: number) => addToast({ type: 'success', message: `评分已更新：${rating} 星` })}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 分享功能 */}
        <TabsContent value="share" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>分享功能测试</CardTitle></CardHeader>
            <CardContent>
              {selectedFormulaLoading ? (
                <div className="text-center py-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]"><Loader className="w-6 h-6 animate-spin mx-auto mb-2" />加载配方...</div>
              ) : !selectedFormula ? (
                <div className="text-center py-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">请先选择一个配方</div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg text-sm">
                    <div className="font-medium mb-1">{selectedFormula.name || `配方#${selectedFormulaId}`}</div>
                    <div className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">配方ID: {selectedFormula.id} | 成分数: {selectedFormula.ingredients?.length ?? 0}</div>
                  </div>
                  <Button
                    variant="primary"
                    icon={<Share2 size={16} />}
                    onClick={() => setShowShareModal(true)}
                    disabled={!selectedFormulaId}
                  >
                    打开分享弹窗
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          <ShareFormula
            formulaId={selectedFormulaId ?? 0}
            formulaName={selectedFormula?.name || '配方'}
            open={showShareModal}
            onClose={() => setShowShareModal(false)}
          />
        </TabsContent>

        {/* 深度分析 */}
        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>深度分析测试</CardTitle></CardHeader>
            <CardContent>
              {!selectedFormulaId ? (
                <div className="text-center py-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">请先选择一个配方</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <TestPanel
                    title="协同效应分析"
                    icon={<FlaskConical size={16} />}
                    desc={`配方 #${selectedFormulaId} 的药材协同作用分析（取前2味）`}
                    runFn={() => {
                      const ings = (selectedFormula?.ingredients ?? [])
                      if (ings.length < 2) return Promise.resolve({ error: '配方至少需要2味药材' })
                      return formulaApi.analyzeSynergy({ ingredient_a: ings[0].name, ingredient_b: ings[1].name })
                    }}
                    runLabel="运行协同分析"
                  />
                  <TestPanel
                    title="兼容性检测"
                    icon={<CheckCircle2 size={16} />}
                    desc={`检查配方 #${selectedFormulaId} 中各成分间的配伍禁忌`}
                    runFn={() => {
                      const ings = (selectedFormula?.ingredients ?? [])
                      return formulaApi.checkCompatibility({
                        ingredients: ings.map((ing: any) => ({
                          name: ing.name,
                          amount_mg: ing.dosage_mg ?? ing.amount_mg ?? 1000,
                          percentage: ing.percentage ?? 0,
                        })),
                        formula_id: String(selectedFormulaId),
                      })
                    }}
                    runLabel="运行兼容性检测"
                  />
                  <TestPanel
                    title="效果预测"
                    icon={<Activity size={16} />}
                    desc={`预测配方 #${selectedFormulaId} 的药理功效`}
                    runFn={() => {
                      const ings = (selectedFormula?.ingredients ?? [])
                      return formulaApi.predictEffect({
                        formula_ingredients: ings.map((ing: any) => ({
                          name: ing.name,
                          amount_mg: ing.dosage_mg ?? ing.amount_mg ?? 1000,
                          percentage: ing.percentage ?? 0,
                        })),
                        body_weight_kg: 70,
                      })
                    }}
                    runLabel="运行效果预测"
                  />
                  <TestPanel
                    title="安全检查"
                    icon={<Shield size={16} />}
                    desc={`检查配方 #${selectedFormulaId} 的安全性（毒性、用量）`}
                    runFn={() => {
                      const ings = (selectedFormula?.ingredients ?? [])
                      return formulaApi.checkSafety({
                        ingredients: ings.map((ing: any) => ({
                          name: ing.name,
                          amount_mg: ing.dosage_mg ?? ing.amount_mg ?? 1000,
                          percentage: ing.percentage ?? 0,
                        })),
                        target_group: 'adult',
                        daily_dosage_g: 10,
                      })
                    }}
                    runLabel="运行安全检查"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default FormulaTestPage
