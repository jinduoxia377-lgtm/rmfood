/**
 * 组织数据分析仪表盘 - KPI 指标 + 趋势图表
 */
import React, { memo, useMemo, useState } from 'react'
import {
  Building2, Users, HardDrive, Zap,
  TrendingUp, TrendingDown, Calendar,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'

interface KPIData {
  label: string
  value: number | string
  change: number
  icon: React.ComponentType<any>
  color: string
  unit?: string
  format?: 'number' | 'percent' | 'k'
}

interface ChartDataPoint {
  date: string
  value: number
  value2?: number
}

interface AnalyticsData {
  totalOrgs: number
  totalMembers: number
  avgStorageUsage: number
  monthlyApiCalls: number
  memberTrend: ChartDataPoint[]
  storageTrend: ChartDataPoint[]
  orgActivity: Array<{ name: string; activity: number }>
  planDistribution: Array<{ name: string; value: number; color: string }>
}

interface OrganizationAnalyticsProps {
  timeRange?: '7d' | '30d' | '90d'
  onTimeRangeChange?: (range: '7d' | '30d' | '90d') => void
}

export const OrganizationAnalytics: React.FC<OrganizationAnalyticsProps> = memo(({
  timeRange = '30d',
  onTimeRangeChange,
}) => {
  const [selectedRange, setSelectedRange] = useState(timeRange)

  const { data: analyticsData } = useQuery({
    queryKey: ['org-analytics', timeRange],
    queryFn: async () => {
      const res = await api.get('/organizations/analytics', { params: { range: timeRange } })
      return res.data as AnalyticsData
    },
    staleTime: 5 * 60_000,
  })

  // Fallback to mock data if API not available
  const KPIS: KPIData[] = useMemo(() => [
    { label: '总组织数', value: analyticsData?.totalOrgs ?? 12, change: 8.5, icon: Building2, color: 'blue' },
    { label: '总成员数', value: analyticsData?.totalMembers ?? 356, change: 12.3, icon: Users, color: 'green' },
    { label: '存储使用率', value: analyticsData?.avgStorageUsage ?? 67.3, change: -2.1, icon: HardDrive, color: 'orange', unit: '%', format: 'percent' },
    { label: 'API 调用量', value: analyticsData?.monthlyApiCalls ?? 45200, change: 15.7, icon: Zap, color: 'purple', format: 'k' },
  ], [analyticsData])

  const memberTrend = analyticsData?.memberTrend ?? (Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
    value: 320 + Math.floor(Math.random() * 40 + i * 0.8),
    value2: 300 + Math.floor(Math.random() * 20),
  })))

  const storageTrend = analyticsData?.storageTrend ?? (Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
    value: 5 + Math.random() * 3,
  })))

  const orgActivity = analyticsData?.orgActivity ?? [
    { name: 'RMFOOD 研发中心', activity: 92 },
    { name: '功能性食品项目组', activity: 78 },
    { name: '质量控制部', activity: 65 },
    { name: '市场分析团队', activity: 54 },
    { name: '产品创新实验室', activity: 43 },
  ]

  const planDistribution = analyticsData?.planDistribution ?? [
    { name: '企业版', value: 3, color: 'var(--color-tertiary, var(--color-accent-500))' },
    { name: '专业版', value: 5, color: 'var(--color-secondary, #0A84FF)' },
    { name: '免费版', value: 4, color: 'var(--text-muted, #9A9A9F)' },
  ]

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
    <div className="space-y-8">
      {/* 时间范围选择器 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[var(--color-primary-text)]" />
          数据概览
        </h2>
        <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] p-1">
          {(['7d', '30d', '90d'] as const).map(range => (
            <button
              key={range}
              onClick={() => handleRangeChange(range)}
              className={`px-[var(--space-apple-sm)] py-1.5 text-sm font-medium rounded-[var(--radius-Apple-sm)] transition-all ${
                selectedRange === range
                  ? 'bg-[var(--bg-secondary)] text-[var(--color-primary-text)] shadow-sm'
                  : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {range === '7d' ? '近7天' : range === '30d' ? '近30天' : '近90天'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI 卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {KPIS.map((kpi, index) => {
          const Icon = kpi.icon
          const isPositive = kpi.change >= 0

          return (
            <div
              key={index}
              className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] p-5 border border-[var(--border-color)] hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-[var(--space-apple-sm)]">
                <div className={`p-2.5 rounded-[var(--radius-Apple-sm)] bg-${kpi.color}-50 dark:bg-${kpi.color}-900/20`}>
                  <Icon className={`w-5 h-5 text-${kpi.color}-600 dark:text-${kpi.color}-400`} />
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  isPositive ? 'text-[var(--color-success-text)]' : 'text-[var(--color-error-text)]'
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
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {formatValue(kpi)}
                </p>
                <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{kpi.label}</p>
              </div>

              {/* 迷你趋势线 */}
              <div className="mt-[var(--space-apple-sm)] pt-3 border-t border-[var(--border-color)]">
                <svg width="100%" height="32" className="overflow-visible">
                  <polyline
                    points={Array.from({ length: 12 }, (_, i) =>
                      `${i * (100 / 11)},${16 - Math.random() * 12}`,
                    ).join(' ')}
                    fill="none"
                    stroke={isPositive ? 'var(--color-primary, var(--color-primary-400))' : 'var(--color-error, #FF3B30)'}
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 成员增长趋势 */}
        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] border border-[var(--border-color)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-[var(--space-apple-md)] flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--color-secondary-text)]0" />
            成员增长趋势
          </h3>
          <div className="h-64 flex items-end space-x-2">
            {memberTrend.slice(-14).map((point, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/25 rounded-t relative" style={{ height: `${(point.value / 400) * 100}%`, minHeight: 8 }}>
                  <div className="absolute -top-[var(--space-apple-lg)] left-1/2 -translate-x-1/2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap">
                    {point.value}
                  </div>
                </div>
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] truncate w-full text-center">{point.date.split(' ')[1]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 存储使用趋势 */}
        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] border border-[var(--border-color)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-[var(--space-apple-md)] flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-[var(--color-warning-text)]0" />
            存储使用趋势 (GB)
          </h3>
          <div className="h-64 flex items-end">
            <div className="w-full h-full relative">
              {storageTrend.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  暂无存储使用数据
                </div>
              ) : (
                <svg width="100%" height="100%" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="storageGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-warning-500)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="var(--color-warning-500)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={storageTrend.map((p, i, arr) => {
                      const x = (i / (arr.length - 1)) * 100
                      const y = 100 - ((p.value / 10) * 80 + 10)
                      return `${i === 0 ? 'M' : 'L'} ${x},${y}`
                    }).join(' ') + ` L 100,100 L 0,100 Z`}
                    fill="url(#storageGradient)"
                  />
                  <path
                    d={storageTrend.map((p, i, arr) => {
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
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 底部图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 组织活动排行 */}
        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] border border-[var(--border-color)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-[var(--space-apple-md)]">组织活跃度 TOP 5</h3>
          <div className="space-y-[var(--space-apple-sm)]">
            {orgActivity.map((org, index) => (
              <div key={index} className="flex items-center gap-[var(--space-apple-sm)]">
                <span className="text-sm font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] w-6">{index + 1}</span>
                <span className="text-sm text-[var(--text-primary)] flex-1 truncate">{org.name}</span>
                <div className="w-32 h-2 bg-[var(--bg-tertiary)] rounded-[var(--radius-pill)] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent-500 to-danger-500 rounded-[var(--radius-pill)]"
                    style={{ width: `${org.activity}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-[var(--text-primary)] w-10 text-right">{org.activity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 计划类型分布 */}
        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] border border-[var(--border-color)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-[var(--space-apple-md)]">计划类型分布</h3>
          <div className="flex items-center justify-center h-48">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 42 42" className="w-full h-full">
                {planDistribution.reduce((acc: { paths: React.ReactNode[]; currentAngle: number }, item, index, arr) => {
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
              {planDistribution.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-[var(--radius-pill)]" style={{ backgroundColor: item.color }} />
                  <span className="text-[var(--text-primary)]">{item.name}</span>
                  <span className="font-medium text-[var(--text-primary)] ml-auto">{item.value}</span>
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
