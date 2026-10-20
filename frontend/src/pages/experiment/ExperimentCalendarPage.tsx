/**
 * 实验日历视图
 */
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  Calendar as CalendarIcon, ArrowLeft,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useExperiments } from '@/hooks/useQueries'
import { StatusBadge } from '@/components/ui/Common'
import { Button, Card, CardContent } from '@/components/ui'
import { cn } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import { zhCN } from 'date-fns/locale'

type ViewMode = 'month' | 'list'

/** 安全日期格式化：避免 Invalid Date 抛 RangeError */
function safeDate(raw: string | null | undefined, pattern = 'yyyy-MM-dd'): string {
  if (!raw) return '-'
  const dt = new Date(raw)
  if (Number.isNaN(dt.getTime())) return '-'
  return format(dt, pattern, { locale: zhCN })
}

/** 安全获取 Date 对象：无效返回 null */
function safeDateObj(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const dt = new Date(raw)
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

export default function ExperimentCalendarPage() {
  const { t, i18n } = useTranslation()
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [displayDate, setDisplayDate] = useState(new Date())

  const { data, isLoading } = useExperiments({ page_size: 100 })
  const experiments = data?.items ?? []

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(displayDate)
    const end = endOfMonth(displayDate)
    return eachDayOfInterval({ start, end })
  }, [displayDate])

  const experimentsByDate = useMemo(() => {
    const map: Record<string, typeof experiments> = {}
    for (const exp of experiments) {
      const dt = safeDateObj(exp.start_date)
      if (!dt) continue
      const dateKey = format(dt, 'YYYY-MM-DD')
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(exp)
    }
    return map
  }, [experiments])

  const weekDays = [t('pages.experimentCalendar.weekdaySun'), t('pages.experimentCalendar.weekdayMon'), t('pages.experimentCalendar.weekdayTue'), t('pages.experimentCalendar.weekdayWed'), t('pages.experimentCalendar.weekdayThu'), t('pages.experimentCalendar.weekdayFri'), t('pages.experimentCalendar.weekdaySat')]

  const prevMonth = () => setDisplayDate(subMonths(displayDate, 1))
  const nextMonth = () => setDisplayDate(addMonths(displayDate, 1))
  const today = () => setDisplayDate(new Date())
  const headerTitle = format(displayDate, i18n.language === 'zh-CN' ? 'yyyy年MM月' : 'MMM yyyy', { locale: zhCN })

  const sortedExperiments = useMemo(() => {
    return [...experiments]
      .filter((e) => e.start_date)
      .sort((a, b) => {
        const ta = safeDateObj(a.start_date)?.getTime() ?? 0
        const tb = safeDateObj(b.start_date)?.getTime() ?? 0
        return ta - tb
      })
  }, [experiments])

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 px-[var(--space-apple-md)] lg:px-6 py-[var(--space-apple-lg)]">
      {/* 欢迎横幅 */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-[var(--space-apple-md)]">
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <Link
              to="/experiments"
              className="p-2 rounded-[var(--radius-Apple-sm)] hover:bg-white/10 transition-colors text-white/80"
              title={t('pages.experimentCalendar.backToList')}
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-semibold leading-snug tracking-tight">{t('pages.experimentCalendar.title')}</h1>
              <p className="mt-1 text-sm text-white/80">{t('pages.experimentCalendar.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* 视图切换 */}
            <div className="flex bg-black/15 dark:bg-[var(--bg-secondary)]/15 rounded-[var(--radius-Apple-sm)] p-0.5">
              <button
                onClick={() => setViewMode('month')}
                className={cn(
                  'px-[var(--space-apple-sm)] py-1.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-colors',
                  viewMode === 'month'
                    ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-tertiary)] text-[var(--color-primary-text)] dark:text-neutral-50 shadow-sm'
                    : 'text-white/90 hover:text-white',
                )}
              >
                {t('pages.experimentCalendar.monthView')}
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'px-[var(--space-apple-sm)] py-1.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-colors',
                  viewMode === 'list'
                    ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-tertiary)] text-[var(--color-primary-text)] dark:text-neutral-50 shadow-sm'
                    : 'text-white/90 hover:text-white',
                )}
              >
                {t('pages.experimentCalendar.listView')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'month' ? (
        <>
          {/* 月份导航 */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-[var(--space-apple-md)]">
                <Button variant="ghost" size="sm" icon={<ChevronLeft size={14} />} onClick={prevMonth}>{t('pages.experimentCalendar.prevMonth')}</Button>
                <span className="text-lg font-semibold text-[var(--text-primary)]">{headerTitle}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={today}>{t('pages.experimentCalendar.today')}</Button>
                  <Button variant="ghost" size="sm" icon={<ChevronRight size={14} />} onClick={nextMonth}>{t('pages.experimentCalendar.nextMonth')}</Button>
                </div>
              </div>

              {/* 日历网格 */}
              <div className="grid grid-cols-7 gap-px">
                {weekDays.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] py-2">
                    {d}
                  </div>
                ))}
                {daysInMonth.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd')
                  const dayExps = experimentsByDate[dateKey] || []
                  const isToday = isSameDay(day, new Date())
                  const isCurrentMonth = isSameMonth(day, displayDate)

                  return (
                    <div
                      key={dateKey}
                      className={cn(
                        'min-h-[100px] p-2 border border-[var(--border-color)] transition-colors',
                        !isCurrentMonth && 'opacity-40',
                        isToday && 'bg-[var(--color-accent-container)] dark:bg-[var(--color-accent-container)]/15',
                      )}
                    >
                      <div className={cn(
                        'text-xs font-medium mb-1',
                        isToday ? 'text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]' : 'text-[var(--text-muted)]',
                      )}>
                        {format(day, 'd')}
                      </div>
                      {dayExps.map((exp: any) => (
                        <Link
                          key={exp.id}
                          to={`/experiments/${exp.id}`}
                          className={cn(
                            'block px-1.5 py-0.5 rounded text-xs truncate mb-0.5 transition-colors',
                            exp.status === 'in_progress' ? 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)] dark:bg-[var(--color-primary-container)]/25 dark:text-[var(--color-primary-text)]'
                              : exp.status === 'completed' ? 'bg-[var(--color-success-container)] text-[var(--color-success-text)] dark:bg-[var(--color-success-container)]/25 dark:text-[var(--color-success-text)]'
                              : exp.status === 'failed' ? 'bg-[var(--color-warning-container)] text-[var(--color-warning-text)] dark:bg-[var(--color-warning-container)]/25 dark:text-[var(--color-warning-text)]'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]',
                          )}
                          title={exp.title}
                        >
                          {exp.title}
                        </Link>
                      ))}
                      {dayExps.length > 2 && (
                        <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] pl-1.5">{t('pages.experimentCalendar.moreCount', { count: dayExps.length - 2 })}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        /* 列表视图 */
        <div className="space-y-[var(--space-apple-sm)]">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-[var(--space-apple-md)]"><div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/3 mb-2" /></CardContent></Card>
            ))
          ) : sortedExperiments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarIcon size={32} className="mx-auto text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2" />
                <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentCalendar.noExperiments')}</p>
                <Link to="/experiments/new">
                  <Button variant="ghost" size="sm" className="mt-2">{t('pages.experimentCalendar.newExperiment')}</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            sortedExperiments.map((exp: any) => (
              <Link key={exp.id} to={`/experiments/${exp.id}`} className="block">
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-[var(--space-apple-md)] flex items-center gap-4">
                    <div className="w-12 h-12 rounded-[var(--radius-Apple-sm)] bg-[var(--color-accent-container)] flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]">{safeDate(exp.start_date, 'MM')}</span>
                      <span className="text-xs text-[var(--color-accent-text)]0 dark:text-[var(--color-accent-text)] -mt-0.5">{safeDate(exp.start_date, 'dd')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{exp.title}</span>
                        <StatusBadge status={exp.status} />
                      </div>
                      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{exp.code} · {safeDate(exp.start_date, 'yyyy-MM-dd')}</p>
                    </div>
                    <ChevronRight size={16} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
