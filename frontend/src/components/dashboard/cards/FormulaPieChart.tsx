/**
 * 配方状态分布饼图
 */
import type { FC } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent, ChartSkeleton } from '@/components/ui'
import { PieChartIcon } from 'lucide-react'

interface PieData {
  name: string
  value: number
  key: string
}

interface Props {
  data: PieData[]
  loading?: boolean
}

const COLORS: Record<string, string> = {
  draft: 'var(--color-neutral-400, #9CA3AF)',
  in_progress: 'var(--color-info, #3B82F6)',
  pending_review: 'var(--color-warning, #F59E0B)',
  approved: 'var(--color-primary, #10B981)',
  rejected: 'var(--color-error, #EF4444)',
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'var(--card-bg-solid, #ffffff)',
    borderRadius: '8px',
    border: '1px solid var(--border-color, #e2e8f0)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    padding: '10px 14px',
  },
}

export const FormulaPieChart: FC<Props> = ({ data, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardHeader className="px-6 pt-6 pb-4">
          <CardTitle as="h2" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-3">
            <PieChartIcon size={18} className="text-neutral-600 dark:text-neutral-400" />
            配方状态分布
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          <ChartSkeleton hasLegend={false} />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="px-6 pt-6 pb-4">
          <CardTitle as="h2" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-3">
            <PieChartIcon size={18} className="text-neutral-600 dark:text-neutral-400" />
            配方状态分布
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          <div className="h-[200px] flex items-center justify-center text-neutral-500 dark:text-neutral-400 text-sm">暂无配方数据</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="px-6 pt-6 pb-4">
        <CardTitle as="h2" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-3">
          <PieChartIcon size={18} className="text-neutral-600 dark:text-neutral-400" />
          配方状态分布
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie rootTabIndex={-1} data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ stroke: 'var(--text-muted)', strokeWidth: 0.8, opacity: 0.5 }}>
              {data.map((entry) => (
                <Cell key={entry.key} fill={COLORS[entry.key] ?? 'var(--color-neutral-500)'} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
