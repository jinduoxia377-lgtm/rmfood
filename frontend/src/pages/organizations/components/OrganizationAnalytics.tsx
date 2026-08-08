/**
 * 组织数据分析仪表盘 - KPI 指标 + 趋势图表
 */
import React, { memo, useMemo, useState } from 'react'
import {
  Building2, Users, HardDrive, Zap,
  TrendingUp, TrendingDown, Calendar,
} from 'lucide-react'

interface KPIData {
  label: string
  value: number | string
  change: number
  icon: React.ElementType
  color: string
  unit?: string
  format?: 'number' | 'percent' | 'k'
}

interface ChartDataPoint {
  date: string
  value: number
  value2?: number
}

const MOCK_KPIS: KPIData[] = [
  { label: '总组织数', value: 12, change: 8.5, icon: Building2, color: 'blue' },
  { label: '总成员数', value: 356, change: 12.3, icon: Users, color: 'green' },
  { label: '存储使用率', value: 67.3, change: -2.1, icon: HardDrive, color: 'orange', unit: '%', format: 'percent' },
  { label: 'API 调用量', value: 45200, change: 15.7, icon: Zap, color: 'purple', format: 'k' },
]

const MOCK_MEMBER_TREND: ChartDataPoint[] = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
  value: 320 + Math.floor(Math.random() * 40 + i * 0.8),
  value2: 300 + Math.floor(Math.random() * 20),
}))

const MOCK_STORAGE_TREND: ChartDataPoint[] = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
  value: 5 + Math.random() * 3,
}))

const MOCK_ORG_ACTIVITY = [
  { name: 'RMFOOD 研发中心', activity: 92 },
  { name: '功能性食品项目组', activity: 78 },
  { name: '质量控制部', activity: 65 },
  { name: '市场分析团队', activity: 54 },
  { name: '产品创新实验室', activity: 43 },
]

const MOCK_PLAN_DISTRIBUTION = [
  { name: '企业版', value: 3, color: 'var(--color-tertiary, #AF52DE)' },
  { name: '专业版', value: 5, color: 'var(--color-secondary, #0A84FF)' },
  { name: '免费版', value: 4, color: 'var(--text-muted, #9A9A9F)' },
]

interface OrganizationAnalyticsProps {
  timeRange?: '7d' | '30d' | '90d'
  onTimeRangeChange?: (range: '7d' | '30d' | '90d') => void
}

export const OrganizationAnalytics: React.FC<OrganizationAnalyticsProps> = memo(({
  timeRange = '30d',
  onTimeRangeChange,
}) => {
  const [selectedRange, setSelectedRange] = useState(timeRange)

  const handleRangeChange = (range: typeof selectedRange) => {
    setSelectedRange(range)
    onTimeRangeChange?.(range)
  }

  const formatValue = (kpi: KPIData): string => {
    if (kpi.format === 'k') return `${(Number(kpi.value) / 1000).toFixed(1)}K`
    if (kpi.format === 'percent') return `${kpi.value}%`
    return String(kpi.value)
  }

  return (
    <div className="space-y-6">
      {/* 时间范围选择器 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-600" />
          数据概览
        </h2>
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
          {(['7d', '30d', '90d'] as const).map(range => (
            <button
              key={range}
              onClick={() => handleRangeChange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                selectedRange === range
                  ? 'bg-white dark:bg-neutral-900 text-primary-600 shadow-sm'
                  : 'text-neutral-500 hover:text-text-primary'
              }`}
            >
              {range === '7d' ? '近7天' : range === '30d' ? '近30天' : '近90天'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI 卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {MOCK_KPIS.map((kpi, index) => {
          const Icon = kpi.icon
          const isPositive = kpi.change >= 0

          return (
            <div
              key={index}
              className="bg-white dark:bg-neutral-900 rounded-xl p-5 border border-neutral-200 dark:border-neutral-700 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-lg bg-${kpi.color}-50 dark:bg-${kpi.color}-900/20`}>
                  <Icon className={`w-5 h-5 text-${kpi.color}-600 dark:text-${kpi.color}-400`} />
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  isPositive ? 'text-success-600' : 'text-error-600'
                }`}>
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {Math.abs(kpi.change)}%
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {formatValue(kpi)}
                </p>
                <p className="text-sm text-neutral-500">{kpi.label}</p>
              </div>

              {/* 迷你趋势线 */}
              <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <svg width="100%" height="32" className="overflow-visible">
                  <polyline
                    points={Array.from({ length: 12 }, (_, i) =>
                      `${i * (100 / 11)},${16 - Math.random() * 12}`,
                    ).join(' ')}
                    fill="none"
                    stroke={isPositive ? 'var(--color-primary, #34C759)' : 'var(--color-error, #FF3B30)'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          )
        })}
      </div>

      {/* 趋势图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 成员增长趋势 */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-secondary-500" />
            成员增长趋势
          </h3>
          <div className="h-64 flex items-end space-x-2">
            {MOCK_MEMBER_TREND.slice(-14).map((point, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-secondary-100 dark:bg-secondary-900/30 rounded-t relative" style={{ height: `${(point.value / 400) * 100}%`, minHeight: 8 }}>
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-neutral-500 opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap">
                    {point.value}
                  </div>
                </div>
                <span className="text-xs text-neutral-400 truncate w-full text-center">{point.date.split(' ')[1]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 存储使用趋势 */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-orange-500" />
            存储使用趋势 (GB)
          </h3>
          <div className="h-64 flex items-end">
            <div className="w-full h-full relative">
              <svg width="100%" height="100%" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="storageGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-warning-500)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--color-warning-500)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={MOCK_STORAGE_TREND.map((p, i, arr) => {
                    const x = (i / (arr.length - 1)) * 100
                    const y = 100 - ((p.value / 10) * 80 + 10)
                    return `${i === 0 ? 'M' : 'L'} ${x},${y}`
                  }).join(' ') + ` L 100,100 L 0,100 Z`}
                  fill="url(#storageGradient)"
                />
                <path
                  d={MOCK_STORAGE_TREND.map((p, i, arr) => {
                    const x = (i / (arr.length - 1)) * 100
                    const y = 100 - ((p.value / 10) * 80 + 10)
                    return `${i === 0 ? 'M' : 'L'} ${x},${y}`
                  }).join(' ')}
                  fill="none"
                  stroke="var(--color-warning-500)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 底部图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 组织活动排行 */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4">组织活跃度 TOP 5</h3>
          <div className="space-y-3">
            {MOCK_ORG_ACTIVITY.map((org, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-sm font-medium text-neutral-500 w-6">{index + 1}</span>
                <span className="text-sm text-neutral-700 dark:text-neutral-300 flex-1 truncate">{org.name}</span>
                <div className="w-32 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                    style={{ width: `${org.activity}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-neutral-900 dark:text-white w-10 text-right">{org.activity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 计划类型分布 */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4">计划类型分布</h3>
          <div className="flex items-center justify-center h-48">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 42 42" className="w-full h-full">
                {MOCK_PLAN_DISTRIBUTION.reduce((acc: { paths: React.ReactNode[]; currentAngle: number }, item, index, arr) => {
                  const total = arr.reduce((sum, d) => sum + d.value, 0)
                  const startAngle = acc.currentAngle
                  const angle = (item.value / total) * 360
                  const endAngle = startAngle + angle
                  const largeArcFlag = angle > 180 ? 1 : 0

                  const x1 = 21 + 16 * Math.cos((Math.PI * startAngle) / 180)
                  const y1 = 21 + 16 * Math.sin((Math.PI * startAngle) / 180)
                  const x2 = 21 + 16 * Math.cos((Math.PI * endAngle) / 180)
                  const y2 = 21 + 16 * Math.sin((Math.PI * endAngle) / 180)

                  acc.paths.push(
                    <path
                      key={index}
                      d={`M 21 21 L ${x1} ${y1} A 16 16 0 ${largeArcFlag} 1 ${x2} ${y2}`}
                      fill={item.color}
                      stroke="#fff"
                      strokeWidth="2"
                    />,
                  )
                  acc.currentAngle = endAngle
                  return acc
                }, { paths: [], currentAngle: 0 }).paths}
                <circle cx="21" cy="21" r="10" fill="white" />
              </svg>
            </div>

            <div className="ml-6 space-y-2">
              {MOCK_PLAN_DISTRIBUTION.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-neutral-700 dark:text-neutral-300">{item.name}</span>
                  <span className="font-medium text-neutral-900 dark:text-white ml-auto">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

OrganizationAnalytics.displayName = 'OrganizationAnalytics'
export default OrganizationAnalytics
