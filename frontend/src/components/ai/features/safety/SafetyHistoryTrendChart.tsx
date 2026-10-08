import React, { useState, useCallback, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { SafetyHistoryEntry } from '../SafetyTab'

interface SafetyHistoryTrendChartProps {
  history: SafetyHistoryEntry[]
  className?: string
}

export function SafetyHistoryTrendChart({ history, className = '' }: SafetyHistoryTrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const chartData = React.useMemo(() => {
    if (history.length === 0) return []
    // Take last 30 entries, reverse to show oldest first
    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp).slice(-30)
    return sorted.map(entry => ({
      time: new Date(entry.timestamp).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      complianceRate: entry.complianceRate,
      ingredients: entry.ingredients.length,
    }))
  }, [history])

  const avgRate = chartData.length > 0
    ? Math.round(chartData.reduce((s, d) => s + d.complianceRate, 0) / chartData.length)
    : 0

  const latestRate = chartData.length > 0 ? chartData[chartData.length - 1].complianceRate : 0
  const firstRate = chartData.length > 0 ? chartData[0].complianceRate : 0
  const trend = latestRate > firstRate + 2 ? 'up' : latestRate < firstRate - 2 ? 'down' : 'stable'

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-3 h-3 text-emerald-500" />
    if (trend === 'down') return <TrendingDown className="w-3 h-3 text-red-500" />
    return <Minus className="w-3 h-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
  }

  const getTrendColor = () => {
    if (trend === 'up') return 'text-emerald-500'
    if (trend === 'down') return 'text-red-500'
    return 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'
  }

  if (history.length < 2) {
    return (
      <div className={`rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">安全趋势</span>
        </div>
        <p className="text-sm text-neutral-400 dark:text-neutral-500 py-8 text-center">
          至少需要 2 条历史记录才能显示趋势
        </p>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">安全合规趋势</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-neutral-500">平均: <strong className="text-neutral-700 dark:text-neutral-200">{avgRate}%</strong></span>
          <span className={`flex items-center gap-1 ${getTrendColor()}`}>
            {getTrendIcon()}
            <span>最新: {latestRate}%</span>
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="safetyTrendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-primary-500, #10b981)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--color-primary-500, #10b981)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-neutral-200 dark:text-neutral-700" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const item = payload[0].payload
              return (
                <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-xs shadow-lg">
                  <p className="font-medium text-neutral-700 dark:text-neutral-200">{item.time}</p>
                  <p className="text-primary-500 font-semibold">{item.complianceRate}% 合规</p>
                  <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{item.ingredients} 味原料</p>
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="complianceRate"
            stroke="var(--color-primary-500, #10b981)"
            strokeWidth={2}
            fill="url(#safetyTrendGrad)"
            animationDuration={600}
            onMouseEnter={() => {}}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
