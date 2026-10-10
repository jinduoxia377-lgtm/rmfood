/**
 * ChartWidget — 通用图表渲染器
 *
 * 接收 charts prop，根据 chartKey 从传入数据中取图表，
 * 自动选择合适的图表类型渲染。
 */
import React, { useMemo } from 'react'
import { BarChart3, PieChart, LineChart, TrendingUp } from 'lucide-react'
import { AnalyticsChart } from '@/components/analytics/charts/RechartsWrapper'

interface Props {
  chartKey: string
  height?: number
  title?: string
  charts?: Record<string, { chart_type: string; title: string; labels: string[]; datasets: Array<{ label: string; data: number[]; backgroundColor?: string; borderColor?: string; fill?: boolean }> }> | null
}

const CHART_ICON_MAP: Record<string, React.ElementType> = {
  pie: PieChart,
  bar: BarChart3,
  line: LineChart,
  area: TrendingUp,
}

export const ChartWidget: React.FC<Props> = ({ chartKey, height = 280, title, charts }) => {
  const chart = charts?.[chartKey]

  const chartTitle = title || chart?.title || chartKey

  // 将 API 返回的 datasets 转换为 Recharts 格式
  const rechartsData = useMemo(() => {
    if (!chart?.labels) return []
    const labels = chart.labels
    // 取第一个 dataset 的数据作为 X 轴对应值
    const dataset = chart.datasets?.[0]
    if (!dataset?.data) return []
    return labels.map((label, idx) => ({
      name: label,
      value: dataset.data[idx] ?? 0,
    }))
  }, [chart])

  // 多数据集折线图/面积图
  const multiSeriesData = useMemo(() => {
    if (!chart?.labels || !chart.datasets || chart.datasets.length < 2) return null
    const result: Record<string, any> = {}
    chart.labels.forEach((label, idx) => {
      result[label] = { name: label }
      chart.datasets.forEach((ds, dsIdx) => {
        result[label][ds.label || `series_${dsIdx}`] = ds.data?.[idx] ?? 0
      })
    })
    return Object.values(result)
  }, [chart])

  const chartType = (chart?.chart_type || 'bar') as 'line' | 'bar' | 'pie' | 'area'
  const Icon = CHART_ICON_MAP[chartType] || BarChart3

  if (!chart) {
    return (
      <div className="rounded-xl bg-surface border border-border p-6 flex items-center justify-center min-h-[200px]">
        <span className="text-text-muted text-sm">暂无图表数据</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-surface border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-primary-700" />
        <h4 className="font-semibold text-sm text-text-primary">{chartTitle}</h4>
      </div>

      <div className="h-[280px]">
        {chartType === 'pie' ? (
          <AnalyticsChart
            type="pie"
            data={rechartsData}
            nameKey="name"
            dataKey="value"
            datasets={[{
              label: '数量',
              data: rechartsData.map(d => d.value as number),
              backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
            }]}
            height={280}
          />
        ) : multiSeriesData ? (
          <AnalyticsChart
            type={chartType}
            data={multiSeriesData}
            xKey="name"
            datasets={chart.datasets.map((ds, i) => ({
              label: ds.label || `系列${i + 1}`,
              data: ds.data?.map(v => v as number) || [],
              borderColor: ds.borderColor || undefined,
              backgroundColor: ds.backgroundColor || undefined,
              fill: ds.fill ?? false,
            }))}
            height={280}
          />
        ) : (
          <AnalyticsChart
            type={chartType}
            data={rechartsData}
            xKey="name"
            datasets={[{
              label: '数值',
              data: rechartsData.map(d => d.value as number),
              backgroundColor: chart.datasets?.[0]?.backgroundColor || '#3b82f6',
              borderColor: chart.datasets?.[0]?.borderColor || '#3b82f6',
              fill: chart.datasets?.[0]?.fill ?? false,
            }]}
            height={280}
          />
        )}
      </div>
    </div>
  )
}

export default ChartWidget
