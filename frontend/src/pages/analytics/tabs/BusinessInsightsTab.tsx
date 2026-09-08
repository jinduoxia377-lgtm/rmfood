/**
 * BusinessInsightsTab — 药食同源业务洞察
 *
 * 展示：
 * - 配方生命周期转化漏斗
 * - 食材关联网络（频繁共现）
 * - AI 生成质量评估
 * - 药食同源占比
 */
import React, { useEffect, useState } from 'react'
import {
  FlaskConical, Users, Zap, Leaf,
  Loader2, AlertCircle,
} from 'lucide-react'
import api from '@/api/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { AnalyticsChart, ChartDataItem } from '@/components/analytics/charts/RechartsWrapper'
import { SankeyFunnelChart } from '@/components/analytics/charts/SankeyFunnelChart'
import { IngredientNetworkChart } from '@/components/analytics/charts/IngredientNetworkChart'

interface FunnelStage {
  stage: string
  label: string
  count: number
  conversion_rate: number | null
}

interface BusinessOverview {
  lifecycle_funnel: {
    funnel: FunnelStage[]
    total_conversion: number
    total_formulas: number
  }
  ingredient_associations: Array<{
    ingredient_a: string
    ingredient_b: string
    co_occurrence: number
  }>
  ai_quality: {
    total_generations: number
    adopted_count: number
    adoption_rate: number
    avg_components_per_generation: number
  }
  food_homology_ratio: {
    total_formulas: number
    food_homology_formulas: number
    ratio_percent: number
  }
}

interface Props {
  filters?: {
    timeRange: '7d' | '30d' | '90d' | '1y'
    categories: string[]
    status: string[]
    users: string[]
  }
}

export default function BusinessInsightsTab({ filters }: Props) {
  const _filters = filters ?? { timeRange: '30d' as const, categories: [], status: [], users: [] }
  const [data, setData] = useState<BusinessOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params: Record<string, string> = { time_range: _filters.timeRange }
    if (_filters.categories.length) params.categories = _filters.categories.join(',')
    if (_filters.status.length) params.status = _filters.status.join(',')
    if (_filters.users.length) params.users = _filters.users.join(',')

    api.get('/analytics/business-metrics', { params })
      .then(res => {
        if (!cancelled) {
          setData(res.data)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err?.response?.data?.detail || err?.message || '加载失败')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_filters.timeRange, _filters.categories, _filters.status])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          <span className="text-sm text-text-muted">正在加载业务洞察…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-error-50 dark:bg-error-950/20 border border-error-200 dark:border-error-900/40 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-error-600 flex-shrink-0" />
        <span className="text-sm text-error-700 dark:text-error-400">{error}</span>
      </div>
    )
  }

  if (!data) return null

  const { lifecycle_funnel, ingredient_associations, ai_quality, food_homology_ratio } = data

  // Sankey 漏斗数据
  const sankeyStages = lifecycle_funnel.funnel.map(s => ({
    id: s.stage,
    label: s.label,
    count: s.count,
    color: ['#94a3b8', '#3b82f6', '#10b981', '#f59e0b'][
      ['draft', 'pending_review', 'approved', 'archived'].indexOf(s.stage)
    ] || '#94a3b8',
  }))

  // 食材网络数据
  const networkNodes = Array.from(
    new Map(
      ingredient_associations.flatMap(a => [
        [a.ingredient_a, { name: a.ingredient_a, count: a.co_occurrence }],
        [a.ingredient_b, { name: a.ingredient_b, count: a.co_occurrence }],
      ])
    ).entries()
  ).slice(0, 20).map(([id, v], i) => ({ id: String(i), ...v }))

  const networkEdges = ingredient_associations.slice(0, 30).map(a => {
    const si = networkNodes.findIndex(n => n.name === a.ingredient_a)
    const ti = networkNodes.findIndex(n => n.name === a.ingredient_b)
    return { source: String(si), target: String(ti), weight: a.co_occurrence }
  }).filter(e => e.source !== '-1' && e.target !== '-1')

  return (
    <div className="space-y-4">

      {/* ── KPI 概览行 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="药食同源占比"
          value={`${food_homology_ratio.ratio_percent}%`}
          sub={`${food_homology_ratio.food_homology_formulas} / ${food_homology_ratio.total_formulas} 个配方`}
          icon={<Leaf className="w-4 h-4" />}
          color="text-success-600"
        />
        <StatCard
          label="AI 采纳率"
          value={`${ai_quality.adoption_rate}%`}
          sub={`${ai_quality.adopted_count} / ${ai_quality.total_generations} 次生成`}
          icon={<Zap className="w-4 h-4" />}
          color="text-warning-600"
        />
        <StatCard
          label="总配方数"
          value={lifecycle_funnel.total_formulas.toLocaleString()}
          sub="含全部状态"
          icon={<FlaskConical className="w-4 h-4" />}
          color="text-primary-600"
        />
        <StatCard
          label="平均成分数"
          value={ai_quality.avg_components_per_generation.toFixed(1)}
          sub="每次 AI 生成"
          icon={<Users className="w-4 h-4" />}
          color="text-secondary-600"
        />
      </div>

      {/* ── 配方生命周期漏斗（桑基图） ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="w-4 h-4 text-primary-600" />
            配方生命周期转化漏斗
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sankeyStages.length > 0 ? (
            <SankeyFunnelChart stages={sankeyStages} height={180} />
          ) : (
            <div className="h-[180px] flex items-center justify-center text-text-muted text-sm">暂无漏斗数据</div>
          )}
          {sankeyStages.length > 1 && (
            <div className="mt-2 text-xs text-text-muted text-right">
              整体转化率 <span className="font-bold text-primary-600">{lifecycle_funnel.total_conversion}%</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 食材关联分析 + AI 质量 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 食材关联网络图 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="w-4 h-4 text-secondary-600" />
              食材共现网络（Top 20 食材）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {networkNodes.length > 0 ? (
              <IngredientNetworkChart
                nodes={networkNodes}
                edges={networkEdges}
                height={320}
              />
            ) : (
              <div className="h-[320px] flex items-center justify-center text-text-muted text-sm">暂无食材关联数据</div>
            )}
          </CardContent>
        </Card>

        {/* AI 生成质量 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="w-4 h-4 text-warning-600" />
              AI 生成质量评估（{
                _filters.timeRange === '7d' ? '近 7 天' :
                _filters.timeRange === '30d' ? '近 30 天' :
                _filters.timeRange === '90d' ? '近 90 天' : '近 1 年'
              }）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                <span className="text-sm text-text-muted">总生成次数</span>
                <span className="text-lg font-bold text-text-primary">{ai_quality.total_generations}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                <span className="text-sm text-text-muted">已采纳（审核通过）</span>
                <span className="text-lg font-bold text-success-600">{ai_quality.adopted_count}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                <span className="text-sm text-text-muted">采纳率</span>
                <span className={`text-lg font-bold ${ai_quality.adoption_rate >= 20 ? 'text-success-600' : ai_quality.adoption_rate >= 10 ? 'text-warning-600' : 'text-error-600'}`}>
                  {ai_quality.adoption_rate}%
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                <span className="text-sm text-text-muted">平均每配方成分数</span>
                <span className="text-lg font-bold text-text-primary">{ai_quality.avg_components_per_generation}</span>
              </div>

              {/* 采纳率进度条 */}
              <div>
                <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
                  <span>采纳率进度</span>
                  <span>目标 ≥ 20%</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      ai_quality.adoption_rate >= 20 ? 'bg-success-500' : ai_quality.adoption_rate >= 10 ? 'bg-warning-500' : 'bg-error-500'
                    }`}
                    style={{ width: `${Math.min(100, ai_quality.adoption_rate * 5)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 药食同源说明 ── */}
      <div className="p-4 rounded-lg bg-info-50 dark:bg-info-950/20 border border-info-200 dark:border-info-900/40 text-sm text-info-700 dark:text-info-400">
        <p className="font-medium mb-1">药食同源分析说明</p>
        <p className="text-xs text-info-600 dark:text-info-500">
          药食同源食材指国家卫健委发布的《既是食品又是药品的物品名单》中的原料。
          本模块统计含药食同源食材的配方占比、食材共现规律，以及 AI 辅助设计的采纳率。
        </p>
      </div>
    </div>
  )
}

// ─── 小型 KPI 卡片 ─────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <Card className="px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] text-text-muted">{label}</p>
        <span className={`${color}`}>{icon}</span>
      </div>
      <p className="text-xl font-bold text-text-primary">{value}</p>
      <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>
    </Card>
  )
}
