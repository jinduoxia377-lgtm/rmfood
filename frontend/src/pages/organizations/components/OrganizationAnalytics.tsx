/**
 * 组织数据分析仪表盘 - KPI 指标 + 趋势图表
 *
 * 数据真实性约束：
 * - 仅展示后端 `/organizations/analytics` 返回的真实数据；
 * - API 失败时显示错误态 + 重试按钮，**绝不回退**硬编码/随机假数据；
 * - 后端未返回的维度（存储趋势等）显示清晰空态。
 */
import React, { memo, useMemo } from 'react'
import {
  Building2, Users, HardDrive, Zap,
  Calendar, AlertCircle, RefreshCw, Loader2,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/api/client'

interface KPIData {
  label: string
  value: number | string
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
}) => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['org-analytics', timeRange],
    queryFn: async () => {
      const res = await api.get('/organizations/analytics', { params: { range: timeRange } })
      const raw = res.data as AnalyticsData
      // 适配后端字段：memberTrend 返回 { date, count }，图表组件使用 value
      return {
        ...raw,
        memberTrend: (raw.memberTrend ?? []).map((p) => ({
          date: p.date,
          value: (p as unknown as { count?: number }).count ?? p.value ?? 0,
        })),
        storageTrend: raw.storageTrend ?? [],
        orgActivity: raw.orgActivity ?? [],
        planDistribution: raw.planDistribution ?? [],
      }
    },
    staleTime: 5 * 60_000,
  })

  const KPIS: KPIData[] = useMemo(() => [
    { label: '总组织数', value: data?.totalOrgs ?? 0, icon: Building2, color: 'blue' },
    { label: '总成员数', value: data?.totalMembers ?? 0, icon: Users, color: 'green' },
    { label: '存储使用率', value: data?.avgStorageUsage ?? 0, icon: HardDrive, color: 'orange', unit: '%', format: 'percent' },
    { label: 'API 调用量', value: data?.monthlyApiCalls ?? 0, icon: Zap, color: 'purple', format: 'k' },
  ], [data])

  const memberTrend = data?.memberTrend ?? []
  const storageTrend = data?.storageTrend ?? []
  const orgActivity = data?.orgActivity ?? []
  const planDistribution = data?.planDistribution ?? []

  const formatValue = (kpi: KPIData): string => {
    if (kpi.format === 'k') return `${(Number(kpi.value) / 1000).toFixed(1)}K`
    if (kpi.format === 'percent') return `${kpi.value}%`
    return String(kpi.value)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-[var(--color-secondary-text)] animate-spin" />
        <span className="ml-3 text-[var(--text-muted)]">加载分析数据...</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-16 h-16 rounded-[var(--radius-pill)] bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/25 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-[var(--color-error-text)]" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">数据加载失败</h2>
        <p className="text-sm text-[var(--text-muted)]">无法获取组织分析数据，请稍后重试。</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-[var(--space-apple-md)] py-2 text-sm font-medium bg-secondary-container text-secondary-main rounded-[var(--radius-Apple-sm)] hover:bg-secondary-container transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[var(--color-primary-text)]" />
          数据概览
        </h2>
      </div>

      {/* KPI 卡片网格（真实数据，无趋势百分比/迷你折线假数据） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {KPIS.map((kpi, index) => {
          const Icon = kpi.icon
          return (
            <div
              key={index}
              className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] p-5 border border-[var(--border-color)] hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-[var(--space-apple-sm)]">
                <div className={`p-2.5 rounded-[var(--radius-Apple-sm)] bg-${kpi.color}-50 dark:bg-${kpi.color}-900/20`}>
                  <Icon className={`w-5 h-5 text-${kpi.color}-600 dark:text-${kpi.color}-400`} />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {formatValue(kpi)}
                </p>
                <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{kpi.label}</p>
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
            <Users className="w-5 h-5 text-[var(--color-secondary-text)]" />
            成员增长趋势
          </h3>
          {memberTrend.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              暂无成员增长数据
            </div>
          ) : (
            <div className="h-64 flex items-end space-x-2">
              {memberTrend.slice(-14).map((point, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/25 rounded-t relative" style={{ height: `${Math.min((point.value / 400) * 100, 100)}%`, minHeight: 8 }}>
                    <div className="absolute -top-[var(--space-apple-lg)] left-1/2 -translate-x-1/2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap">
                      {point.value}
                    </div>
                  </div>
                  <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] truncate w-full text-center">{point.date.split(' ')[1]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 存储使用趋势 */}
        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] border border-[var(--border-color)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-[var(--space-apple-md)] flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-[var(--color-warning-text)]" />
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
          {orgActivity.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              暂无组织活跃度数据
            </div>
          ) : (
            <div className="space-y-[var(--space-apple-sm)]">
              {orgActivity.slice(0, 5).map((org, index) => (
                <div key={index} className="flex items-center gap-[var(--space-apple-sm)]">
                  <span className="text-sm font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] w-6">{index + 1}</span>
                  <span className="text-sm text-[var(--text-primary)] flex-1 truncate">{org.name}</span>
                  <div className="w-32 h-2 bg-[var(--bg-tertiary)] rounded-[var(--radius-pill)] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent-500 to-danger-500 rounded-[var(--radius-pill)]"
                      style={{ width: `${Math.min(org.activity, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)] w-10 text-right">{org.activity}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 计划类型分布 */}
        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] border border-[var(--border-color)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-[var(--space-apple-md)]">计划类型分布</h3>
          {planDistribution.length === 0 || planDistribution.every((d) => !d.value) ? (
            <div className="h-48 flex items-center justify-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              暂无计划分布数据
            </div>
          ) : (
            <div className="flex items-center justify-center h-48">
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 42 42" className="w-full h-full">
                  {planDistribution.reduce((acc: { paths: React.ReactNode[]; currentAngle: number }, item, index, arr) => {
                    const total = arr.reduce((sum, d) => sum + d.value, 0)
                    const startAngle = acc.currentAngle
                    const angle = total > 0 ? (item.value / total) * 360 : 0
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
                        stroke="var(--bg-canvas)"
                        strokeWidth="2"
                      />,
                    )
                    acc.currentAngle = endAngle
                    return acc
                  }, { paths: [], currentAngle: 0 }).paths}
                  <circle cx="21" cy="21" r="10" fill="var(--bg-canvas)" />
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
          )}
        </div>
      </div>
    </div>
  )
})

OrganizationAnalytics.displayName = 'OrganizationAnalytics'
export default OrganizationAnalytics