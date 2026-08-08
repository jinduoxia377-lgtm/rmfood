/**
 * 实验状态柱状图
 */
import type { FC } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
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
}

const COLORS: Record<string, string> = {
  in_progress: 'var(--color-info, #007AFF)',
  completed: 'var(--color-success, #34C759)',
  pending: 'var(--color-warning, #FF9F0A)',
  cancelled: 'var(--color-error, #FF3B30)',
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'var(--card-bg-solid, rgba(255,255,255,0.98))',
    backdropFilter: 'blur(16px)',
    borderRadius: '14px',
    border: '1px solid var(--border-color, rgba(226,232,240,0.9))',
    boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
    padding: '14px 18px',
  },
}

export const ExperimentBarChart: FC<Props> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="px-6 pt-6 pb-4">
          <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>实验状态统计</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          <div className="h-[200px] flex items-center justify-center">
            <EmptyState
              icon={<BarChart3 size={28} className="text-neutral-400 dark:text-neutral-600" />}
              title="暂无实验数据"
              description="创建第一个实验后，这里将显示实验状态分布"
              action={
                <Link to="/experiments" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
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
        <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>实验状态统计</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} opacity={0.3} />
            <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={64} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={28}>
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
