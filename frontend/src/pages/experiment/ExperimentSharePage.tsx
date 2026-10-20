/**
 * 实验分享页 - 公开只读
 */
import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Target, FileText,
  BarChart3, XCircle,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/ui/Common'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { experimentApi } from '@/api/experiment'

/** 安全日期格式化：避免 Invalid Date 抛 RangeError */
function safeDate(raw: string | null | undefined, pattern = 'yyyy-MM-dd HH:mm'): string {
  if (!raw) return '-'
  const dt = new Date(raw)
  if (Number.isNaN(dt.getTime())) return '-'
  return format(dt, pattern, { locale: zhCN })
}

async function fetchSharedExperiment(shareId: string) {
  return experimentApi.getShared(shareId)
}

export default function ExperimentSharePage() {
  const { t, i18n } = useTranslation()
  const { shareId } = useParams<{ shareId: string }>()
  const [dataView, setDataView] = useState<'table' | 'chart'>('table')

  const { data: exp, isLoading, error } = useQuery({
    queryKey: ['shared-experiment', shareId],
    queryFn: () => fetchSharedExperiment(shareId!),
    enabled: !!shareId,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-grid flex items-center justify-center" style={{ backgroundColor: 'var(--bg-canvas)' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-[var(--radius-pill)] animate-spin mx-auto mb-[var(--space-apple-sm)]" />
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentShare.loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !exp) {
    return (
      <div className="min-h-screen bg-grid flex items-center justify-center" style={{ backgroundColor: 'var(--bg-canvas)' }}>
        <div className="text-center max-w-md px-[var(--space-apple-md)]">
          <XCircle size={48} className="mx-auto text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-[var(--space-apple-sm)]" />
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">{t('pages.experimentShare.notExist')}</h1>
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-[var(--space-apple-md)]">{t('pages.experimentShare.notExistDesc')}</p>
          <Link to="/experiments">
            <Button variant="secondary" size="sm">{t('pages.experimentShare.backHome')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  const dataPoints = (exp.data_points || [])
  const hasNumericData = dataPoints.some((d: any) => d.value !== null && !isNaN(Number(d.value)))

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-[var(--space-apple-md)] lg:px-6 py-[var(--space-apple-lg)] space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link to="/experiments" className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft size={16} />
            {t('pages.experimentShare.backHome')}
          </Link>
          <Badge variant="info" size="sm">{t('pages.experimentShare.publicShare')}</Badge>
        </div>

        {/* 基本信息 */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-[var(--space-apple-sm)] mb-2">
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">{exp.title}</h1>
              {exp.status && <StatusBadge status={exp.status} />}
            </div>
            <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-[var(--space-apple-sm)]">{exp.code} · {t('pages.experimentShare.createdOn', { date: safeDate(exp.created_at, 'yyyy-MM-dd') })}</p>
            {exp.description && <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{exp.description}</p>}
          </CardContent>
        </Card>

        {/* 目标和内容 */}
        {(exp.objectives?.length || exp.methodology) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {exp.objectives && exp.objectives.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-[var(--color-primary-container)] flex items-center justify-center">
                      <Target size={16} className="text-[var(--color-primary-text)]0" />
                    </div>
                    <CardTitle as="h2">{t('pages.experimentShare.objectives')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {exp.objectives.map((obj: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary-container)]0 shrink-0" />
                        {obj}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {exp.methodology && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-[var(--color-primary-container)] flex items-center justify-center">
                      <FileText size={16} className="text-[var(--color-primary-text)]0" />
                    </div>
                    <CardTitle as="h2">{t('pages.experimentShare.methodology')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{exp.methodology}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* 数据 */}
        {dataPoints.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-[var(--space-apple-sm)]">
                  <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-[var(--color-primary-container)] flex items-center justify-center">
                    <BarChart3 size={16} className="text-[var(--color-primary-text)]0" />
                  </div>
                  <div>
                    <CardTitle as="h2">{t('pages.experimentShare.data')}</CardTitle>
                    <CardDescription>{t('pages.experimentShare.dataCount', { count: dataPoints.length })}</CardDescription>
                  </div>
                </div>
                <div className="flex bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] p-0.5">
                  <button onClick={() => setDataView('table')} className={cn('px-2.5 py-1 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-colors min-h-[44px] inline-flex items-center', dataView === 'table' ? 'surface-card text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]')}>{t('pages.experimentShare.dataTable')}</button>
                  <button onClick={() => setDataView('chart')} className={cn('px-2.5 py-1 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-colors min-h-[44px] inline-flex items-center', dataView === 'chart' ? 'surface-card text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]')}>{t('pages.experimentShare.chart')}</button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {dataView === 'table' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-color)]">
                        <th className="text-left py-2 px-[var(--space-apple-sm)] text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentShare.colParam')}</th>
                        <th className="text-left py-2 px-[var(--space-apple-sm)] text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentShare.colValue')}</th>
                        <th className="text-left py-2 px-[var(--space-apple-sm)] text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentShare.colUnit')}</th>
                        <th className="text-left py-2 px-[var(--space-apple-sm)] text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentShare.colNotes')}</th>
                        <th className="text-left py-2 px-[var(--space-apple-sm)] text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentShare.colTime')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataPoints.map((d: any) => (
                        <tr key={d.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                          <td className="py-2 px-[var(--space-apple-sm)] font-medium text-[var(--text-primary)]">{d.parameter}</td>
                          <td className="py-2 px-[var(--space-apple-sm)] text-[var(--text-primary)] font-mono">{d.value ?? '-'}</td>
                          <td className="py-2 px-[var(--space-apple-sm)] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{d.unit ?? '-'}</td>
                          <td className="py-2 px-[var(--space-apple-sm)] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] max-w-[200px] truncate">{d.notes ?? '-'}</td>
                          <td className="py-2 px-[var(--space-apple-sm)] text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{safeDate(d.recorded_at, 'MM-dd HH:mm')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : hasNumericData ? (
                <div className="text-center py-8 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentShare.chartComingSoon')}</div>
              ) : (
                <div className="text-center py-8 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentShare.noNumericData')}</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 结论 */}
        {(exp.conclusions || exp.recommendations) && (
          <Card>
            <CardHeader>
              <CardTitle as="h2">{t('pages.experimentShare.conclusion')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {exp.conclusions && (
                <div>
                  <h2 className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider mb-2">{t('pages.experimentShare.conclusionLabel')}</h2>
                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{exp.conclusions}</p>
                </div>
              )}
              {exp.recommendations && (
                <div>
                  <h2 className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider mb-2">{t('pages.experimentShare.improvement')}</h2>
                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{exp.recommendations}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] py-4">
          {t('pages.experimentShare.sharedVia', { code: exp.code })}
        </div>
      </div>
    </div>
  )
}
