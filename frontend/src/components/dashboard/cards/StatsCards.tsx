/**
 * 统计卡片 — 配方/实验/进行中/已完成
 */
import type { FC } from 'react'
import { FlaskConical, TestTubes, TrendingUp, CheckCircle2 } from 'lucide-react'
import { StatCard, CardSkeleton } from '@/components/ui'
import { DASHBOARD_CONFIG } from '@/config'

interface Props {
  statIndex: number
  total: number
  loading?: boolean
}

const STAT_ICONS = [FlaskConical, TestTubes, TrendingUp, CheckCircle2]
const STAT_VARIANTS = ['primary' as const, 'secondary' as const, 'info' as const, 'success' as const]
const STAT_KEYS = ['formulas', 'experiments', 'inProgressExperiments', 'completedExperiments'] as const

export const StatsCards: FC<Props> = ({ statIndex, total, loading }) => {
  const stat = STAT_ICONS[statIndex] || FlaskConical
  const variant = STAT_VARIANTS[statIndex] || 'primary'
  const labelKey = STAT_KEYS[statIndex]
  const label = DASHBOARD_CONFIG.statCardLabels[labelKey] || ''

  if (loading) {
    return <CardSkeleton count={1} className="h-full" />
  }

  return (
    <StatCard
      label={label}
      value={total}
      icon={stat}
      variant={variant}
    />
  )
}
