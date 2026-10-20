/**
 * 研发趋势面积图
 */
import type { FC } from 'react'
import { BarChart3, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent, ChartSkeleton } from '@/components/ui'
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
  loading?: boolean
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

export const TrendChart: FC<Props> = ({ data, loading }) => {
  const { t } = useTranslation()

  if (loading) {
    return (
      <Card>
        <CardHeader className="px-6 pt-6 pb-4">
          <CardTitle as="h2" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-3">
            <BarChart3 size={18} className="text-neutral-600" />
            {t('pages.dashboard.cards.trendTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          <ChartSkeleton hasLegend />
        </CardContent>
      </Card>
    )
  }

  const weekdays = t('pages.dashboard.weekdays', { returnObjects: true }) as string[]
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return t('pages.dashboard.dateFormat', {
      month: d.getMonth() + 1,
      day: d.getDate(),
      weekday: weekdays[d.getDay()] ?? '',
    });
  };

  // C-03: X 轴刻度按周期动态稀疏（90d 下逐日显示会重叠）
  const totalDays = data?.length ?? 0
  const tickStep = totalDays <= 14 ? 1 : totalDays <= 35 ? 5 : 15
  const xTickFormatter = (value: string, index: number) => (index % tickStep === 0 ? value : '')

  const newFormulasKey = t('pages.dashboard.cards.newFormulas')
  const newExperimentsKey = t('pages.dashboard.cards.newExperiments')
  const approvedFormulasKey = t('pages.dashboard.cards.approvedFormulas')
  const trendChartData = data?.map((d) => ({
    date: formatDate(d.date),
    [newFormulasKey]: d.formulas_created,
    [newExperimentsKey]: d.experiments_created,
    [approvedFormulasKey]: d.formulas_approved,
  })) ?? []

  return (
    <Card>
      <CardHeader className="px-6 pt-6 pb-4">
        <CardTitle as="h2" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-3">
          <BarChart3 size={18} className="text-neutral-600 dark:text-neutral-400" />
          {t('pages.dashboard.cards.trendTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
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
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" tickFormatter={xTickFormatter} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip {...tooltipStyle} />
              {/* D-53：图例文字不再继承 series stroke（#10B981 白底仅 2.54:1），
                  统一改用 --text-secondary，亮/暗双模式均 ≥ 4.5:1 */}
              <Legend
                wrapperStyle={{ paddingTop: 16, fontSize: 12 }}
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => (
                  <span style={{ color: 'var(--text-secondary, #475569)' }}>{value}</span>
                )}
              />
              <Area type="monotone" dataKey={newFormulasKey} stroke="var(--color-primary-700, #047857)" fill="url(#colorFormula)" strokeWidth={2} />
              <Area type="monotone" dataKey={newExperimentsKey} stroke="var(--color-accent-700, #6D28D9)" fill="url(#colorExp)" strokeWidth={2} />
              <Area type="monotone" dataKey={approvedFormulasKey} stroke="var(--color-secondary-700, #1D4ED8)" fill="none" strokeWidth={1.5} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center">
            <EmptyState
              icon={<BarChart3 size={28} className="text-neutral-600 dark:text-neutral-400" />}
              title={t('pages.dashboard.cards.noTrendData')}
              description={t('pages.dashboard.cards.trendEmptyDesc')}
              action={
                <Link to="/formulas/new" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary-700 dark:text-primary-700 hover:text-primary-700 dark:hover:text-primary-700 font-medium">
                  <Plus size={14} />
                  {t('pages.dashboard.cards.newFormula')}
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
