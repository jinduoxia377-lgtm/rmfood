/**
 * 研发趋势面积图
 */
import type { FC } from 'react'
import { BarChart3, Plus } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent } from '@/components/ui'
import { EmptyState } from '@/components/ui/Common'
import { Link } from 'react-router-dom'

interface TrendPoint {
  date: string
  formulas_created: number
  experiments_created: number
  formulas_approved: number
}

interface Props {
  data: TrendPoint[]
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'var(--card-bg-solid, #ffffff)',
    borderRadius: '8px',
    border: '1px solid var(--border-color, #e2e8f0)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    padding: '10px 14px',
  },
  itemStyle: { padding: '4px 0' },
  labelStyle: {
    fontWeight: 600,
    marginBottom: 6,
    color: 'var(--text-primary)',
  },
}

export const TrendChart: FC<Props> = ({ data }) => {
  const trendChartData = data?.map((d) => ({
    date: d.date.slice(5),
    '新增配方': d.formulas_created,
    '新增实验': d.experiments_created,
    '批准配方': d.formulas_approved,
  })) ?? []

  return (
    <Card>
      <CardContent className="px-6 pt-6 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 size={20} className="text-neutral-500 dark:text-neutral-400" />
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">研发趋势</h3>
        </div>
        {trendChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <defs>
                <linearGradient id="colorFormula" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-accent, #8B5CF6)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-accent, #8B5CF6)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12 }} iconType="circle" iconSize={8} />
              <Area type="monotone" dataKey="新增配方" stroke="var(--color-primary, #10B981)" fill="url(#colorFormula)" strokeWidth={2} />
              <Area type="monotone" dataKey="新增实验" stroke="var(--color-accent, #8B5CF6)" fill="url(#colorExp)" strokeWidth={2} />
              <Area type="monotone" dataKey="批准配方" stroke="var(--color-secondary, #3B82F6)" fill="none" strokeWidth={1.5} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center">
            <EmptyState
              icon={<BarChart3 size={28} className="text-neutral-400 dark:text-neutral-600" />}
              title="暂无趋势数据"
              description="创建第一个配方后，这里将显示研发趋势"
              action={
                <Link to="/formulas/new" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
                  <Plus size={14} />
                  新建配方
                </Link>
              }
              titleClassName="text-sm"
              descriptionClassName="text-xs"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
