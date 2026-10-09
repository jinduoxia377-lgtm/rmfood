/**
 * 实验日历视图
 */
import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Calendar as CalendarIcon, ArrowLeft, Filter, FlaskConical,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useExperiments } from '@/hooks/useQueries'
import { StatusBadge } from '@/components/ui/Common'
import { Button, Card, CardContent } from '@/components/ui'
import { cn } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import { zhCN } from 'date-fns/locale'

type ViewMode = 'month' | 'list'

export default function ExperimentCalendarPage() {
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
      const dateKey = exp.start_date ? format(new Date(exp.start_date), 'YYYY-MM-DD') : null
      if (dateKey) {
        if (!map[dateKey]) map[dateKey] = []
        map[dateKey].push(exp)
      }
    }
    return map
  }, [experiments])

  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

  const prevMonth = () => setDisplayDate(subMonths(displayDate, 1))
  const nextMonth = () => setDisplayDate(addMonths(displayDate, 1))
  const today = () => setDisplayDate(new Date())
  const headerTitle = format(displayDate, 'yyyy年MM月', { locale: zhCN })

  const sortedExperiments = useMemo(() => {
    return [...experiments]
      .filter((e) => e.start_date)
      .sort((a, b) =>
        new Date(a.start_date || "").getTime() - new Date(b.start_date || "").getTime()
      )
  }, [experiments])

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 lg:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/experiments" className="p-2 rounded-lg hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800 transition-colors text-neutral-500">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <CalendarIcon size={20} className="text-violet-500" />
            <h1 className="text-h1 font-semibold text-neutral-900 dark:text-white">实验日历</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('month')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                viewMode === 'month' ? 'surface-card text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500',
              )}
            >
              月视图
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                viewMode === 'list' ? 'surface-card text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500',
              )}
            >
              列表
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'month' ? (
        <>
          {/* 月份导航 */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="sm" icon={<ChevronLeft size={14} />} onClick={prevMonth}>上月</Button>
                <span className="text-lg font-semibold text-neutral-900 dark:text-white">{headerTitle}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={today}>今天</Button>
                  <Button variant="ghost" size="sm" icon={<ChevronRight size={14} />} onClick={nextMonth}>下月</Button>
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
                        'min-h-[100px] p-2 border border-neutral-100 dark:border-neutral-800 transition-colors',
                        !isCurrentMonth && 'opacity-40',
                        isToday && 'bg-violet-50 dark:bg-violet-900/10',
                      )}
                    >
                      <div className={cn(
                        'text-xs font-medium mb-1',
                        isToday ? 'text-violet-600 dark:text-violet-400' : 'text-neutral-500',
                      )}>
                        {format(day, 'd')}
                      </div>
                      {dayExps.map((exp: any) => (
                        <Link
                          key={exp.id}
                          to={`/experiments/${exp.id}`}
                          className={cn(
                            'block px-1.5 py-0.5 rounded text-xs truncate mb-0.5 transition-colors',
                            exp.status === 'in_progress' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-700'
                              : exp.status === 'completed' ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-600'
                              : exp.status === 'failed' ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-700'
                              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
                          )}
                          title={exp.title}
                        >
                          {exp.title}
                        </Link>
                      ))}
                      {dayExps.length > 2 && (
                        <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] pl-1.5">+{dayExps.length - 2} 更多</div>
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
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-1/3 mb-2" /></CardContent></Card>
            ))
          ) : sortedExperiments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarIcon size={32} className="mx-auto text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2" />
                <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">暂无实验数据</p>
                <Link to="/experiments/new">
                  <Button variant="ghost" size="sm" className="mt-2">新建实验</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            sortedExperiments.map((exp: any) => (
              <Link key={exp.id} to={`/experiments/${exp.id}`} className="block">
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-violet-600 dark:text-violet-400">{format(new Date(exp.start_date), 'MM')}</span>
                      <span className="text-xs text-violet-500 dark:text-violet-400 -mt-0.5">{format(new Date(exp.start_date), 'dd')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{exp.title}</span>
                        <StatusBadge status={exp.status} />
                      </div>
                      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{exp.code} · {format(new Date(exp.start_date), 'yyyy-MM-dd', { locale: zhCN })}</p>
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
