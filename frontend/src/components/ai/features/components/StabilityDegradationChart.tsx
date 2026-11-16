/**
 * StabilityDegradationChart — 稳定性降解路径可视化组件
 *
 * 展示成分有效性的时间衰减曲线，含置信区间、保质期临界线、
 * 各环境因素贡献度对比。
 *
 * @version 1.0.0
 */
import React, { useMemo } from 'react'
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'
import type { StabilityAssessment, StabilityDataPoint } from '@/types/stability.types'
import { useBreakpoint } from '@/hooks/useMobile'

interface StabilityDegradationChartProps {
  result: StabilityAssessment
  className?: string
}

// 走语义令牌：potency=primary(绿)、impurities=error(红/风险)、shelfLife=warning(琥珀)、
// 置信区间=primary-400/300（弱化的主色带）。Recharts stopColor/fill/stroke 接受 CSS 变量字符串。
const COLORS = {
  potency: 'var(--color-primary)',
  impurities: 'var(--color-error)',
  confidenceUpper: 'var(--color-primary-400)',
  confidenceLower: 'var(--color-primary-300)',
  shelfLife: 'var(--color-warning)',
}

function buildChartData(data: StabilityDataPoint[]): {
  chart: { time: string; potency: number; impurities: number; upper: number; lower: number }[]
  shelfLifeMonth: number | null
} {
  const sorted = [...data].sort((a, b) => a.time - b.time)
  const maxTime = sorted.length > 0 ? sorted[sorted.length - 1].time : 12
  const step = Math.max(1, Math.floor(maxTime / 20))

  const chart: { time: string; potency: number; impurities: number; upper: number; lower: number }[] = []
  let shelfLifeMonth: number | null = null

  sorted.forEach((p, i) => {
    if (i % step !== 0 && i !== sorted.length - 1) return
    const timeLabel = p.timeUnit === 'month' ? `${p.time}月` : `${p.time}天`
    chart.push({
      time: timeLabel,
      potency: Math.round(p.potency * 100) / 100,
      impurities: Math.round(p.impurities * 100) / 100,
      upper: Math.min(100, p.potency + 3),
      lower: Math.max(0, p.potency - 3),
    })
    if (shelfLifeMonth === null && p.potency < 90) {
      shelfLifeMonth = p.time
    }
  })

  return { chart, shelfLifeMonth }
}

export function StabilityDegradationChart({ result, className = '' }: StabilityDegradationChartProps) {
  const { isMobile } = useBreakpoint()
  const chartHeight = isMobile ? 200 : 280
  const { chart, shelfLifeMonth } = useMemo(
    () => buildChartData(result.timeSeriesData),
    [result.timeSeriesData],
  )

  if (chart.length === 0) {
    return (
      <div className={`flex items-center justify-center h-48 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ${className}`}>
        暂无时间序列数据
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 主图表 */}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <AreaChart data={chart} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="potencyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.potency} stopOpacity={0.15} />
              <stop offset="95%" stopColor={COLORS.potency} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #E5E7EB)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 12, fill: 'var(--text-muted, #6B7280)' }}
            axisLine={{ stroke: 'var(--border-color, #E5E7EB)' }}
          />
          <YAxis
            domain={[0, 105]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 12, fill: 'var(--text-muted, #6B7280)' }}
            axisLine={{ stroke: 'var(--border-color, #E5E7EB)' }}
          />
          <RechartsTooltip
            formatter={(value: number, name: string) => [`${value}%`, name === 'potency' ? '有效成分' : name === 'impurities' ? '杂质含量' : name]}
            labelFormatter={(label) => `时间点: ${label}`}
            contentStyle={{
              backgroundColor: 'var(--bg-surface, #fff)',
              border: '1px solid var(--border-color, #E5E7EB)',
              borderRadius: '8px',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {/* 置信区间 */}
          <Area
            type="monotone"
            dataKey="upper"
            stackId="1"
            stroke="none"
            fill={COLORS.confidenceUpper}
            fillOpacity={0.08}
            name="置信上限"
          />
          <Area
            type="monotone"
            dataKey="lower"
            stackId="2"
            stroke="none"
            fill={COLORS.confidenceLower}
            fillOpacity={0.05}
            name="置信下限"
          />
          {/* 有效成分曲线 */}
          <Line
            type="monotone"
            dataKey="potency"
            stroke={COLORS.potency}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="有效成分"
          />
          {/* 杂质曲线 */}
          <Line
            type="monotone"
            dataKey="impurities"
            stroke={COLORS.impurities}
            strokeWidth={2}
            dot={{ r: 2 }}
            name="杂质含量"
            strokeDasharray="4 2"
          />
          {/* 保质期临界线 (90%) */}
          {shelfLifeMonth !== null && (
            <Line
              type="monotone"
              data={chart.map((p) => ({ time: p.time, value: 90 }))}
              stroke={COLORS.shelfLife}
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              name="保质期临界(90%)"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-success-200 dark:border-success-800 bg-success-50/50 dark:bg-success-300/15 p-3 text-center">
          <div className="text-2xl font-bold text-success-600 dark:text-success-400">
            {result.shelfLifeDays >= 365
              ? `${(result.shelfLifeDays / 365).toFixed(1)}年`
              : `${result.shelfLifeDays}天`}
          </div>
          <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">预测保质期</div>
        </div>
        <div className="rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-300/15 p-3 text-center">
          <div className="text-2xl font-bold text-primary-700 dark:text-primary-400">
            {result.score}/100
          </div>
          <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">稳定性评分</div>
        </div>
        <div className="rounded-xl border border-warning-200 dark:border-warning-800 bg-warning-50/50 dark:bg-warning-300/15 p-3 text-center">
          <div className="text-2xl font-bold text-warning-600 dark:text-warning-700">
            {shelfLifeMonth ?? '—'}
          </div>
          <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">临界时间点</div>
        </div>
      </div>

      {/* 降解途径列表 */}
      {result.degradationPathway && result.degradationPathway.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wider">
            主要降解途径
          </h4>
          <div className="flex flex-wrap gap-2">
            {result.degradationPathway.map((path, i) => (
              <span
                key={i}
                className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700"
              >
                {path}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
