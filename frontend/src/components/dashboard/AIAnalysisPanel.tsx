/**
 * AI 智能分析面板组件
 * 集成配方智能分析、推荐、趋势预测和实验分析
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Brain, BarChart3, TrendingUp, FlaskConical, TestTube, Lightbulb, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { cn } from '@/lib/utils'
import api from '@/api/client'
import { useFormulas, useExperiments } from '@/hooks/useQueries'
import { logger } from '@/utils/safeLogger';
import { ErrorCard } from '@/components/dashboard/cards/ErrorCard'


// 类型定义
interface FormulaAnalysisResult {
  formula_id: number | null
  ingredient_analysis: {
    total_count: number
    herb_count: number
    peptide_count: number
    potential_interactions: any[]
  }
  effect_prediction: {
    predicted_effects: string[]
    confidence_score: number
    suggested_enhancements: string[]
  }
  safety_assessment: {
    overall_status: string
    warnings: any[]
    contraindications: any[]
    pregnancy_safety: string
  }
  market_analysis: {
    trending_score: number
    competitive_advantage: string
    suggested_target_market: string
  }
  optimization_suggestions: string[]
  confidence: number
  generated_at: string
}

interface Recommendation {
  formula_id: number
  name: string
  description: string
  relevance_score: number
  match_reason: string
  target_effects: string[]
  ingredient_count: number
  created_at: string
}

interface TrendPrediction {
  formulas: {
    current: number
    predicted: number
    trend: string
    change_percent: number
    confidence: number
    insights: string
  }
  experiments: {
    current: number
    predicted: number
    trend: string
    change_percent: number
    confidence: number
    insights: string
  }
  success_rate: {
    current: number
    predicted: number
    trend: string
    change_percent: number
    confidence: number
    insights: string
  }
  top_trending_effects: {
    effect: string
    growth_rate: number
  }[]
  timeframe: string
  generated_at: string
}

interface ExperimentAnalysisResult {
  experiment_id: number | null
  status?: string
  message?: string
  result_summary?: {
    overall_status: string
    key_metrics: {
      effectiveness: number
      stability: number
      taste_score: number
      safety: number
    }
    comparison_to_baseline: {
      improvement: number
      statistical_significance: number
    }
  }
  anomaly_detection: {
    anomalies: any[]
    warnings: any[]
    recommendations: any[]
  }
  interpretation: {
    key_findings: string[]
    limitations: string[]
  }
  recommendations: {
    formula_optimization: string[]
    next_experiments: string[]
    marketing_suggestions: string[]
  }
  confidence: number
  generated_at: string
}

interface AIAnalysisPanelProps {
  className?: string
  defaultTab?: 'analysis' | 'recommendations' | 'trends' | 'experiments'
  loading?: boolean
  error?: Error | null
  onRetry?: () => void
}

export function AIAnalysisPanel({ className, defaultTab = 'analysis', loading: parentLoading, error: parentError, onRetry: parentRetry }: AIAnalysisPanelProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<typeof defaultTab>(defaultTab)
  const [isLoading, setIsLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<FormulaAnalysisResult | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [trendPrediction, setTrendPrediction] = useState<TrendPrediction | null>(null)
  const [experimentAnalysis, setExperimentAnalysis] = useState<ExperimentAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  // P1-08：当前展示数据是否来自 mock 兜底（用于渲染「模拟数据」标识）
  const [isMockData, setIsMockData] = useState(false)

  // 获取真实配方和实验 ID
  const { data: formulasData } = useFormulas({ page: 1, page_size: 1 })
  const { data: experimentsData } = useExperiments({ page: 1, page_size: 1 })
  // useFormulas 返回完整响应对象，useExperiments 返回数组（.then(r => r.data)）
  const formulaItems = ((formulasData as { items?: { id?: number }[] })?.items) ?? []
  const experimentItems = Array.isArray(experimentsData) ? experimentsData : ((experimentsData as { items?: { id?: number }[] })?.items) ?? []
  const formulaId = formulaItems[0]?.id ?? null
  const experimentId = experimentItems[0]?.id ?? null

  // A-05: 4 个 AI 端点改 React Query 缓存（staleTime 5min），tab 切换不再重复请求
  const qc = useQueryClient()

  // 配方分析
  const formulaQuery = useQuery({
    queryKey: ['ai', 'analyze-formula', formulaId],
    queryFn: () => api.post<FormulaAnalysisResult>('/ai/analyze/formula', {
      formula_id: formulaId,
      target_effects: ['增强免疫', '抗疲劳'],
    }).then((r) => r.data),
    enabled: formulaId !== null,
    staleTime: 5 * 60_000,
  })

  // 推荐配方
  const recommendQuery = useQuery({
    queryKey: ['ai', 'recommend-formulas'],
    queryFn: () => api.post<{ recommendations: Recommendation[] }>('/ai/recommend/formulas', {
      target_effects: ['增强免疫'],
      limit: 5,
    }).then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  // 趋势预测
  const trendQuery = useQuery({
    queryKey: ['ai', 'predict-trends'],
    queryFn: () => api.post<TrendPrediction>('/ai/predict/trends', {
      period: '30d',
    }).then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  // 实验分析
  const experimentQuery = useQuery({
    queryKey: ['ai', 'analyze-experiment', experimentId],
    queryFn: () => api.post<ExperimentAnalysisResult>('/ai/analyze/experiment', {
      experiment_id: experimentId,
    }).then((r) => r.data),
    enabled: experimentId !== null,
    staleTime: 5 * 60_000,
  })

  // 保持旧版 API 兼容：将 query 数据同步到 state（UI 仍消费 state）
  useEffect(() => {
    if (formulaQuery.data) {
      setAnalysisResult(formulaQuery.data)
      setIsMockData(false)
    } else if (formulaQuery.isError) {
      // mock 降级
      setAnalysisResult(createMockFormulaAnalysis())
      setIsMockData(true)
    }
  }, [formulaQuery.data, formulaQuery.isError])

  useEffect(() => {
    if (recommendQuery.data) {
      setRecommendations(recommendQuery.data.recommendations ?? [])
      setIsMockData(false)
    } else if (recommendQuery.isError) {
      setRecommendations(createMockRecommendations())
      setIsMockData(true)
    }
  }, [recommendQuery.data, recommendQuery.isError])

  useEffect(() => {
    if (trendQuery.data) {
      setTrendPrediction(trendQuery.data)
      setIsMockData(false)
    } else if (trendQuery.isError) {
      setTrendPrediction(createMockTrendPrediction())
      setIsMockData(true)
    }
  }, [trendQuery.data, trendQuery.isError])

  useEffect(() => {
    if (experimentQuery.data) {
      setExperimentAnalysis(experimentQuery.data)
      setIsMockData(false)
    } else if (experimentQuery.isError) {
      setExperimentAnalysis(createMockExperimentAnalysis())
      setIsMockData(true)
    }
  }, [experimentQuery.data, experimentQuery.isError])

  // 组件挂载时自动加载配方分析（等待真实 ID 可用）
  useEffect(() => {
    if (formulaId !== null) {
      formulaQuery.refetch()
    }
  }, [formulaId, formulaQuery])

  // 实验分析在 formulaId 加载后也触发（避免重复加载）
  useEffect(() => {
    if (experimentId !== null && !analysisResult) {
      experimentQuery.refetch()
    }
  }, [experimentId, experimentQuery, analysisResult])

  // 获取配方分析 — 旧版 fetchFormulaAnalysis 保留为 refetch 入口（UI 刷新按钮调用）
  const fetchFormulaAnalysis = useCallback(() => {
    formulaQuery.refetch()
  }, [formulaQuery])

  const fetchRecommendations = useCallback(() => {
    recommendQuery.refetch()
  }, [recommendQuery])

  const fetchTrendPrediction = useCallback(() => {
    trendQuery.refetch()
  }, [trendQuery])

  const fetchExperimentAnalysis = useCallback(() => {
    experimentQuery.refetch()
  }, [experimentQuery])

  // A-05：mock 工厂函数（保留 4 个原 mock 数据体）
  function createMockFormulaAnalysis(): FormulaAnalysisResult {
    return {
      formula_id: null,
      ingredient_analysis: { total_count: 8, herb_count: 6, peptide_count: 2, potential_interactions: [] },
      effect_prediction: {
        predicted_effects: ['增强免疫', '抗疲劳', '抗氧化'],
        confidence_score: 0.85,
        suggested_enhancements: ['增加黄芪以增强免疫效果', '考虑添加西洋参提升抗疲劳功效'],
      },
      safety_assessment: { overall_status: 'safe', warnings: [], contraindications: [], pregnancy_safety: 'safe' },
      market_analysis: { trending_score: 0.78, competitive_advantage: '药食同源复合配伍', suggested_target_market: '健康管理人群' },
      optimization_suggestions: ['优化黄芪:西洋参比例', '考虑添加陈皮改善适口性'],
      confidence: 0.82,
      generated_at: new Date().toISOString(),
    }
  }

  function createMockRecommendations(): Recommendation[] {
    return [
      { formula_id: 1, name: '益气补血膏', description: '黄芪、当归、白术等配伍', relevance_score: 0.92, match_reason: '功效目标匹配度高', target_effects: ['增强免疫'], ingredient_count: 8, created_at: new Date().toISOString() },
      { formula_id: 2, name: '健脾养胃饮', description: '山药、茯苓、陈皮等', relevance_score: 0.85, match_reason: '协同增效', target_effects: ['健脾'], ingredient_count: 6, created_at: new Date().toISOString() },
    ]
  }

  function createMockTrendPrediction(): TrendPrediction {
    return {
      formulas: { current: 120, predicted: 140, trend: '上升', change_percent: 16.7, confidence: 0.78, insights: '配方开发活跃度持续上升' },
      experiments: { current: 45, predicted: 55, trend: '上升', change_percent: 22.2, confidence: 0.72, insights: '实验验证节奏加快' },
      success_rate: { current: 72, predicted: 78, trend: '上升', change_percent: 8.3, confidence: 0.81, insights: '配方成功率稳步提升' },
      top_trending_effects: [{ effect: '增强免疫', growth_rate: 25 }, { effect: '改善睡眠', growth_rate: 18 }],
      timeframe: '30d',
      generated_at: new Date().toISOString(),
    }
  }

  function createMockExperimentAnalysis(): ExperimentAnalysisResult {
    return {
      experiment_id: null,
      anomaly_detection: { anomalies: [], warnings: [], recommendations: [] },
      interpretation: {
        key_findings: ['配方有效性良好', '稳定性达标'],
        limitations: ['样本量较小'],
      },
      recommendations: {
        formula_optimization: ['优化黄芪用量'],
        next_experiments: ['对比不同剂型'],
        marketing_suggestions: ['突出免疫功效'],
      },
      confidence: 0.76,
      generated_at: new Date().toISOString(),
    }
  }
  // 切换标签时获取数据（A-05：refetch 命中 5min 缓存则不发请求）
  useEffect(() => {
    switch (activeTab) {
      case 'analysis':
        fetchFormulaAnalysis()
        break
      case 'recommendations':
        fetchRecommendations()
        break
      case 'trends':
        fetchTrendPrediction()
        break
      case 'experiments':
        fetchExperimentAnalysis()
        break
    }
  }, [activeTab, fetchFormulaAnalysis, fetchRecommendations, fetchTrendPrediction, fetchExperimentAnalysis])

  // 渲染错误状态 — A-05：error 从当前 tab 的 query 同步（替代手动 setError）
  useEffect(() => {
    let activeErr: unknown = null
    switch (activeTab) {
      case 'analysis': activeErr = formulaQuery.error; break
      case 'recommendations': activeErr = recommendQuery.error; break
      case 'trends': activeErr = trendQuery.error; break
      case 'experiments': activeErr = experimentQuery.error; break
    }
    // mock 降级路径已消费 isError，此处仅保留真实错误信息（mock 数据仍展示，不整卡报错）
    setError(activeErr ? 'AI 服务暂时不可用，已展示模拟数据' : null)
  }, [activeTab, formulaQuery.error, recommendQuery.error, trendQuery.error, experimentQuery.error])

  // 父级 loading 优先：卡片级骨架
  if (parentLoading) {
    return (
      <Card className={className}>
        <CardHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="skeleton w-10 h-10 rounded-lg shrink-0" />
            <div className="space-y-1.5">
              <div className="skeleton h-4 w-28 rounded" />
              <div className="skeleton h-3 w-40 rounded" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          <div className="skeleton h-32 rounded-xl" />
        </CardContent>
      </Card>
    )
  }

  // 父级 error：显示错误状态
  if (parentError) {
    return <ErrorCard title="AI分析加载失败" message="数据获取异常，请稍后重试" onRetry={parentRetry} className={className} />
  }

  // 渲染加载状态
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
              <Brain size={20} className="text-accent-600 dark:text-accent-700" />
            </div>
            <div>
              <CardTitle as="h3" className="text-sm font-semibold">AI 智能分析</CardTitle>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">正在分析数据，请稍候...</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 size={24} className="text-primary-500 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // 渲染错误状态
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-error-100 flex items-center justify-center">
              <AlertTriangle size={20} className="text-error-600" />
            </div>
            <div>
              <CardTitle as="h3" className="text-sm font-semibold">AI 智能分析</CardTitle>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">分析失败</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-sm text-error-600 mb-4">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => {
              switch (activeTab) {
                case 'analysis':
                  fetchFormulaAnalysis()
                  break
                case 'recommendations':
                  fetchRecommendations()
                  break
                case 'trends':
                  fetchTrendPrediction()
                  break
                case 'experiments':
                  fetchExperimentAnalysis()
                  break
              }
            }}>
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
              <Brain size={20} className="text-accent-600 dark:text-accent-700" />
            </div>
            <div>
              <CardTitle as="h3" className="text-sm font-semibold">AI 智能分析</CardTitle>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">实时数据分析与智能洞察</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isMockData && (
              <Badge variant="neutral" size="sm" className="text-xs" title="后端 AI 服务不可用，当前展示模拟数据">
                模拟数据
              </Badge>
            )}
            <Badge variant="primary" size="sm">智能</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="analysis" className="text-xs">配方分析</TabsTrigger>
            <TabsTrigger value="recommendations" className="text-xs">智能推荐</TabsTrigger>
            <TabsTrigger value="trends" className="text-xs">趋势预测</TabsTrigger>
            <TabsTrigger value="experiments" className="text-xs">实验分析</TabsTrigger>
          </TabsList>

          {/* 配方分析 */}
          <TabsContent value="analysis" className="space-y-4">
            {analysisResult && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-secondary-50 dark:bg-secondary-900/20">
                    <p className="text-xs text-secondary-700 dark:text-secondary-700 mb-1">成分分析</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-neutral-900 dark:text-white">
                        {analysisResult.ingredient_analysis?.total_count ?? 0}
                      </span>
                      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">成分</span>
                    </div>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                      {analysisResult.ingredient_analysis?.herb_count ?? 0} 药材, {analysisResult.ingredient_analysis?.peptide_count ?? 0} 肽
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-success-50 dark:bg-success-900/20">
                    <p className="text-xs text-success-700 dark:text-success-600 mb-1">功效预测</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-neutral-900 dark:text-white">
                        {Math.round((analysisResult.effect_prediction?.confidence_score ?? 0) * 100)}%
                      </span>
                      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">置信度</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(analysisResult.effect_prediction?.predicted_effects ?? []).slice(0, 3).map((effect, index) => (
                        <Badge key={index} variant="success" size="sm" className="text-xs">
                          {effect}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Lightbulb size={16} className="text-warning-500" />
                    优化建议
                  </h4>
                  <ul className="space-y-2">
                    {(analysisResult.optimization_suggestions ?? []).map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <ArrowRight size={14} className="text-primary-500 mt-0.5 shrink-0" />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-lg bg-accent-50 dark:bg-accent-900/20">
                  <h4 className="text-sm font-semibold mb-2 text-accent-700 dark:text-accent-700">市场分析</h4>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                    <span className="font-medium">竞争优势：</span>
                    {analysisResult.market_analysis?.competitive_advantage ?? '无'}
                  </p>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    <span className="font-medium">目标市场：</span>
                    {analysisResult.market_analysis?.suggested_target_market ?? '无'}
                  </p>
                </div>
              </>
            )}
          </TabsContent>

          {/* 智能推荐 */}
          <TabsContent value="recommendations" className="space-y-3">
            {recommendations.map((rec, index) => (
              <div key={rec.formula_id} className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">
                      {rec.name}
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 line-clamp-2">
                      {rec.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {rec.target_effects.map((effect, idx) => (
                        <Badge key={idx} variant="primary" size="sm" className="text-xs">
                          {effect}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      <span className="font-medium">匹配原因：</span>{rec.match_reason}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-4">
                    <Badge variant="neutral" size="sm" className="text-xs">
                      相关度 {Math.round(rec.relevance_score * 100)}%
                    </Badge>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => navigate(`/formulas/${rec.formula_id}`)}
                    >
                      查看详情
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* 趋势预测 */}
          <TabsContent value="trends" className="space-y-4">
            {trendPrediction && (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-secondary-50 dark:bg-secondary-900/20">
                    <p className="text-xs text-secondary-700 dark:text-secondary-700 mb-1">配方趋势</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-neutral-900 dark:text-white">
                        {trendPrediction.formulas.current}
                      </span>
                      <span className="text-xs text-success-700">→ {trendPrediction.formulas.predicted}</span>
                    </div>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                      +{trendPrediction.formulas.change_percent}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-success-50 dark:bg-success-900/20">
                    <p className="text-xs text-success-700 dark:text-success-600 mb-1">实验趋势</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-neutral-900 dark:text-white">
                        {trendPrediction.experiments.current}
                      </span>
                      <span className="text-xs text-success-700">→ {trendPrediction.experiments.predicted}</span>
                    </div>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                      +{trendPrediction.experiments.change_percent}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-warning-50 dark:bg-warning-900/20">
                    <p className="text-xs text-warning-700 dark:text-warning-700 mb-1">成功率</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-neutral-900 dark:text-white">
                        {trendPrediction.success_rate.current}%
                      </span>
                      <span className="text-xs text-success-700">→ {trendPrediction.success_rate.predicted}%</span>
                    </div>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                      +{trendPrediction.success_rate.change_percent}%
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp size={16} className="text-secondary-700" />
                    热门功效趋势
                  </h4>
                  <div className="space-y-2">
                    {trendPrediction.top_trending_effects.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">{item.effect}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-success-700">+{item.growth_rate}%</span>
                          <div className="w-20 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-success-500 rounded-full"
                              style={{ width: `${Math.min(item.growth_rate, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* 实验分析 */}
          <TabsContent value="experiments" className="space-y-4">
            {experimentAnalysis?.status === 'no_data' ? (
              <div className="py-10 text-center">
                <p className="text-sm text-neutral-500 dark:text-neutral-400">暂无实验数据可供分析</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-400 mt-1">创建并完成后，实验分析将自动更新</p>
              </div>
            ) : experimentAnalysis?.result_summary ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-secondary-50 dark:bg-secondary-900/20">
                    <p className="text-xs text-secondary-700 dark:text-secondary-700 mb-1">实验状态</p>
                    <div className="flex items-baseline gap-2">
                      <Badge
                        variant={experimentAnalysis.result_summary.overall_status === 'success' ? 'success' : 'danger'}
                        size="sm"
                      >
                        {experimentAnalysis.result_summary.overall_status === 'success' ? '成功' : '失败'}
                      </Badge>
                    </div>
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                      较基线提升 {experimentAnalysis.result_summary.comparison_to_baseline?.improvement ?? 0}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-success-50 dark:bg-success-900/20">
                    <p className="text-xs text-success-700 dark:text-success-600 mb-1">关键指标</p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">有效性</span>
                        <span className="text-xs font-semibold">{experimentAnalysis.result_summary.key_metrics?.effectiveness ?? 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">稳定性</span>
                        <span className="text-xs font-semibold">{experimentAnalysis.result_summary.key_metrics?.stability ?? 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">口感</span>
                        <span className="text-xs font-semibold">{experimentAnalysis.result_summary.key_metrics?.taste_score ?? 0}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Lightbulb size={16} className="text-warning-500" />
                    核心发现
                  </h4>
                  <ul className="space-y-2">
                    {experimentAnalysis.interpretation.key_findings.map((finding, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <ArrowRight size={14} className="text-primary-500 mt-0.5 shrink-0" />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-lg bg-accent-50 dark:bg-accent-900/20">
                  <h4 className="text-sm font-semibold mb-2 text-accent-700 dark:text-accent-700">下一步建议</h4>
                  <ul className="space-y-2">
                    {experimentAnalysis.recommendations.next_experiments.slice(0, 3).map((exp, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <TestTube size={14} className="text-accent-700 mt-0.5 shrink-0" />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">{exp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
