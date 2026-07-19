/**
 * 配方状态分布饼图
 */
import type { FC } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

interface PieData {
  name: string
  value: number
  key: string
}

interface Props {
  data: PieData[]
}

const COLORS: Record<string, string> = {
  draft: 'var(--color-neutral-400, #9CA3AF)',
  in_progress: 'var(--color-info, #007AFF)',
  pending_review: 'var(--color-warning, #FF9F0A)',
  approved: 'var(--color-success, #34C759)',
  rejected: 'var(--color-error, #FF3B30)',
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

export const FormulaPieChart: FC<Props> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="px-6 pt-6 pb-4">
          <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>配方状态分布</CardTitle>
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
        <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>配方状态分布</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value"
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
