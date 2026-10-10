/**
 * 实验状态柱状图
 */
import type { FC } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent, ChartSkeleton } from '@/components/ui'
import { EmptyState } from '@/components/ui/Common'
import { BarChart3, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

interface BarData {
  name: string
  count: number
  key: string
}

interface Props {
  data: BarData[]
  loading?: boolean
}

const COLORS: Record<string, string> = {
  in_progress: 'var(--color-info, #3B82F6)',
  completed: 'var(--color-success, #10B981)',
  pending: 'var(--color-warning, #F59E0B)',
  cancelled: 'var(--color-error, #EF4444)',
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

export const ExperimentBarChart: FC<Props> = ({ data, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardHeader className="px-6 pt-6 pb-4">
          <CardTitle as="h2" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-3">
            <BarChart3 size={18} className="text-neutral-600 dark:text-neutral-400" />
            实验状态统计
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
            <BarChart3 size={18} className="text-neutral-600 dark:text-neutral-400" />
            实验状态统计
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          <div className="h-[200px] flex items-center justify-center">
            <EmptyState
              icon={<BarChart3 size={28} className="text-neutral-600 dark:text-neutral-400" />}
              title="暂无实验数据"
              description="创建第一个实验后，这里将显示实验状态分布"
              action={
                <Link to="/experiments" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary-700 dark:text-primary-700 hover:text-primary-700 dark:hover:text-primary-700 font-medium">
                  <Plus size={14} />
                  查看实验
                </Link>
              }
              titleClassName="text-sm"
              descriptionClassName="text-xs"
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="px-6 pt-6 pb-4">
        <CardTitle as="h2" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-3">
          <BarChart3 size={18} className="text-neutral-600 dark:text-neutral-400" />
          实验状态统计
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} opacity={0.3} />
            <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={64} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="count" radius={[4, 4, 4, 4]} barSize={28}>
              {data.map((entry) => (
                <Cell key={entry.key} fill={COLORS[entry.key] ?? 'var(--color-neutral-500)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
