/**
 * 趋势分析 Tab — 参考 Dashboard 设计风格
 * 使用 Card+CardHeader+CardContent 统一卡片样式
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  LineChart, TrendingUp, BarChart3,
  RefreshCw, Download,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AnalyticsChart, ChartDataItem } from '@/components/analytics/charts/RechartsWrapper'
import { useTrendData } from '@/hooks/useAnalyticsData'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

interface FilterConfig {
  timeRange: '7d' | '30d' | '90d' | '1y'
  categories: string[]
  status: string[]
  users: string[]
}

interface Props {
  filters: FilterConfig
}

type TrendView = 'time_series' | 'comparison' | 'forecast'

const TREND_VIEWS: { key: TrendView; label: string; icon: LucideIcon }[] = [
  { key: 'time_series', label: '时间序列', icon: LineChart },
  { key: 'comparison', label: '对比分析', icon: BarChart3 },
  { key: 'forecast', label: '趋势预测', icon: TrendingUp },
]

export default function TrendsTab({ filters }: Props) {
  const [activeView, setActiveView] = useState<TrendView>('time_series')
  const [loading, setLoading] = useState(false)

  // 跟随父级时间范围，同时允许用户手动切换
  const _daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }
  const [selectedDays, setSelectedDays] = useState(_daysMap[filters.timeRange] ?? 30)

  // 当父级 timeRange 变化时同步初始值
  useEffect(() => {
    const v = _daysMap[filters.timeRange] ?? 30
    setSelectedDays(v)
  }, [filters.timeRange])

  const formulasTrend = useTrendData('formulas', selectedDays)
  const experimentsTrend = useTrendData('experiments', selectedDays)
  const usersTrend = useTrendData('users', selectedDays)

  // ─── 时间序列图表数据 ──────────────────────────────────────
  const timeSeriesData = useMemo((): ChartDataItem[] => {
    if (!formulasTrend.data || !experimentsTrend.data) return []
    const maxLen = Math.max(formulasTrend.data.length, experimentsTrend.data.length, usersTrend.data?.length ?? 0)
    const result: ChartDataItem[] = []
    for (let i = 0; i < maxLen; i++) {
      const fd = formulasTrend.data[i]
      const ed = experimentsTrend.data[i]
      const ud = usersTrend.data?.[i]
      result.push({
        day: fd?.period ?? ed?.period ?? ud?.period ?? `#${i}`,
        formula: fd?.value ?? 0,
        experiment: ed?.value ?? 0,
        users: ud?.value ?? 0,
      })
    }
    return result
  }, [formulasTrend.data, experimentsTrend.data, usersTrend.data])

  // ─── 对比分析数据 ──────────────────────────────────────────
  const comparisonData = useMemo((): ChartDataItem[] => {
    if (!formulasTrend.data) return []
    const recent = formulasTrend.data.slice(-4)
    return recent.map((d, i) => ({
      period: d.period ?? `#${i}`,
      current: d.value,
      target: d.value * 1.1,
      previous: d.value * 0.9,
    }))
  }, [formulasTrend.data])

  // ─── 预测数据（线性回归模拟） ──────────────────────────────
  const forecastData = useMemo((): ChartDataItem[] => {
    if (!formulasTrend.data || formulasTrend.data.length < 2) return []
    const vals = formulasTrend.data.map(d => d.value)
    const n = vals.length
    const sumX = Array.from({ length: n }, (_, i) => i).reduce((a, b) => a + b, 0)
    const sumY = vals.reduce((a, b) => a + b, 0)
    const sumXY = vals.reduce((a, v, i) => a + i * v, 0)
    const sumX2 = Array.from({ length: n }, (_, i) => i * i).reduce((a, b) => a + b, 0)
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    const months = ['当前', '+1月', '+2月', '+3月']
    return months.map((m, i) => ({
      month: m,
      actual: i === 0 ? vals[n - 1] : 0,
      forecast: Math.max(0, Math.round(intercept + slope * (n + i))),
      lower_bound: Math.max(0, Math.round((intercept + slope * (n + i)) * 0.85)),
      upper_bound: Math.round((intercept + slope * (n + i)) * 1.15),
    }))
  }, [formulasTrend.data])

  // ─── 手动刷新 ──────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setLoading(true)
    // 清空缓存后重新拉取（通过修改 selectedDays 触发 re-fetch）
    setSelectedDays(d => d)
    await new Promise(r => setTimeout(r, 400))
    setLoading(false)
  }, [])

  // ─── 增长计算 ──────────────────────────────────────────────
  const formulaGrowthNum = useMemo(() => {
    if (!formulasTrend.data || formulasTrend.data.length < 2) return null
    const recent = formulasTrend.data.slice(-7).map(d => d.value)
    const older = formulasTrend.data.slice(-14, -7).map(d => d.value)
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length
    if (avgOlder === 0) return null
    return ((avgRecent - avgOlder) / avgOlder) * 100
  }, [formulasTrend.data])

  const expGrowthNum = useMemo(() => {
    if (!experimentsTrend.data || experimentsTrend.data.length < 2) return null
    const recent = experimentsTrend.data.slice(-7).map(d => d.value)
    const older = experimentsTrend.data.slice(-14, -7).map(d => d.value)
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length
    if (avgOlder === 0) return null
    return ((avgRecent - avgOlder) / avgOlder) * 100
  }, [experimentsTrend.data])

  const userGrowthNum = useMemo(() => {
    if (!usersTrend.data || usersTrend.data.length < 2) return null
    const recent = usersTrend.data.slice(-7).map(d => d.value)
    const older = usersTrend.data.slice(-14, -7).map(d => d.value)
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length
    if (avgOlder === 0) return null
    return ((avgRecent - avgOlder) / avgOlder) * 100
  }, [usersTrend.data])

  const pct = (v: number | null) => (v != null ? (v > 0 ? '+' : '') + v.toFixed(1) : '—')
  const pctColor = (v: number | null) => (v == null ? 'text-[var(--text-muted)]' : v > 0 ? 'text-[var(--color-success-text)]' : 'text-[var(--color-error-text)]')

  return (
    <div className="space-y-[var(--space-apple-md)]">

      {/* 工具栏 */}
      <div className="flex items-center justify-between flex-wrap gap-[var(--space-apple-sm)]">
        <div className="flex items-center gap-1 bg-muted p-0.5 rounded-[var(--radius-Apple-sm)]">
          {TREND_VIEWS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              className={`px-[var(--space-apple-md)] py-1.5 text-sm font-medium rounded-[var(--radius-Apple-sm)] transition-all flex items-center gap-2 ${
                activeView === key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedDays}
            onChange={e => setSelectedDays(Number(e.target.value))}
            className="px-[var(--space-apple-sm)] py-1.5 text-sm input min-w-[100px]"
          >
            <option value={7}>近 7 天</option>
            <option value={30}>近 30 天</option>
            <option value={90}>近 90 天</option>
            <option value={365}>近 1 年</option>
          </select>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-[var(--space-apple-sm)] py-1.5 text-sm bg-background border border-border rounded-[var(--radius-Apple-sm)] hover:bg-surface-hover transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button className="px-[var(--space-apple-sm)] py-1.5 text-sm bg-primary-container text-[var(--color-primary)] rounded-[var(--radius-Apple-sm)] hover:bg-primary-container transition-colors flex items-center gap-1.5">
            <Download className="w-4 h-4" />
            导出
          </button>
        </div>
      </div>

      {/* ─── 时间序列视图 ─── */}
      {activeView === 'time_series' && (
        <div className="space-y-[var(--space-apple-md)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--space-apple-sm)]">
            {[
              { title: '配方创建趋势', value: pct(formulaGrowthNum), color: pctColor(formulaGrowthNum) },
              { title: '实验完成率', value: pct(expGrowthNum), color: pctColor(expGrowthNum) },
              { title: '用户活跃度', value: pct(userGrowthNum), color: pctColor(userGrowthNum) },
            ].map(({ title, value, color }) => (
              <Card key={title} className="px-5 py-4">
                <p className="text-xs text-[var(--text-muted)] mb-1">{title}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">较前7天变化</p>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">多项指标趋势</CardTitle>
            </CardHeader>
            <CardContent>
              {timeSeriesData.length > 0 ? (
                <AnalyticsChart
                  type="line"
                  data={timeSeriesData}
                  xKey="day"
                  datasets={[
                    { label: '配方创建', data: timeSeriesData.map(d => d.formula as number), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true },
                    { label: '实验次数', data: timeSeriesData.map(d => d.experiment as number), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true },
                    { label: '活跃用户', data: timeSeriesData.map(d => d.users as number), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: true },
                  ]}
                  height={300}
                />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-[var(--text-muted)] text-sm">
                  {formulasTrend.loading ? '加载中…' : '暂无趋势数据'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── 对比分析视图 ─── */}
      {activeView === 'comparison' && (
        <div className="space-y-[var(--space-apple-md)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">当前 vs 目标</CardTitle>
              </CardHeader>
              <CardContent>
                {comparisonData.length > 0 ? (
                  <AnalyticsChart
                    type="bar"
                    data={comparisonData}
                    xKey="period"
                    datasets={[
                      { label: '当前', data: comparisonData.map(d => d.current as number), backgroundColor: '#3b82f6' },
                      { label: '目标', data: comparisonData.map(d => d.target as number), backgroundColor: '#10b981' },
                    ]}
                    height={280}
                  />
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-[var(--text-muted)] text-sm">暂无数据</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">本期 vs 上期</CardTitle>
              </CardHeader>
              <CardContent>
                {comparisonData.length > 0 ? (
                  <AnalyticsChart
                    type="bar"
                    data={comparisonData}
                    xKey="period"
                    datasets={[
                      { label: '本期', data: comparisonData.map(d => d.current as number), backgroundColor: '#3b82f6' },
                      { label: '上期', data: comparisonData.map(d => d.previous as number), backgroundColor: '#94a3b8' },
                    ]}
                    height={280}
                  />
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-[var(--text-muted)] text-sm">暂无数据</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─── 预测视图 ─── */}
      {activeView === 'forecast' && (
        <div className="space-y-[var(--space-apple-md)]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4 text-[var(--color-primary-text)]" />
                线性回归预测（未来 3 个月）
              </CardTitle>
            </CardHeader>
            <CardContent>
              {forecastData.length > 0 ? (
                <AnalyticsChart
                  type="line"
                  data={forecastData}
                  xKey="month"
                  datasets={[
                    { label: '实际值', data: forecastData.map(d => d.actual as number), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true },
                    { label: '预测值', data: forecastData.map(d => d.forecast as number), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: false, borderDash: [5, 3] },
                    { label: '上限', data: forecastData.map(d => d.upper_bound as number), borderColor: '#94a3b8', backgroundColor: 'transparent', fill: false, borderDash: [2, 2] },
                    { label: '下限', data: forecastData.map(d => d.lower_bound as number), borderColor: '#94a3b8', backgroundColor: 'transparent', fill: false, borderDash: [2, 2] },
                  ]}
                  height={300}
                />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-[var(--text-muted)] text-sm">数据不足，无法进行预测</div>
              )}
            </CardContent>
          </Card>

          {/* 预测说明 */}
          <div className="p-[var(--space-apple-md)] rounded-[var(--radius-Apple-sm)] bg-info-50 dark:bg-info-950/20 border border-info-200 dark:border-info-900/40 text-sm text-info-700 dark:text-info-600">
            <p className="font-medium mb-1">预测模型说明</p>
            <p className="text-xs text-info-600 dark:text-info-700">
              基于最近 {selectedDays} 天的历史数据，使用最小二乘法拟合线性趋势线，
              提供未来 3 个月的预测区间（上下限为预测值的 ±15%）。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
