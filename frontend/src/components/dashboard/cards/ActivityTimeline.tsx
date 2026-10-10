/**
 * 最近动态时间线
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { Activity, FlaskConical, TestTubes, ArrowRight } from 'lucide-react'
import { Badge, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { StatusBadge } from '@/components/ui/Common'
import { cn } from '@/lib/utils'

interface TimelineEvent {
  type: string
  id: number | string
  event: string
  title: string
  created_at: string
  status: string
}

interface Props {
  items: TimelineEvent[]
  loading?: boolean
}

export const ActivityTimeline: FC<Props> = ({ items, loading }) => {
  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-4 w-20 rounded" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-6 py-3 flex items-start gap-3">
                <div className="skeleton w-6 h-6 rounded-full shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="skeleton h-3 w-3/4 rounded" />
                  <div className="skeleton h-2.5 w-1/2 rounded" />
                </div>
                <div className="skeleton h-5 w-12 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity size={18} className="text-primary-700" />
            <CardTitle as="h2" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>最近动态</CardTitle>
          </div>
          {/* C-05：统一「查看全部」入口 */}
          <Link to="/formulas" className="text-xs text-primary-700 hover:text-primary-700 dark:text-primary-700 font-semibold flex items-center gap-1 transition-colors min-h-[44px] px-2 -mx-2 -my-3.5">
            全部 <ArrowRight size={14} />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/40">
          {items.length === 0 ? (
            <div className="px-6 py-10 text-center text-neutral-500 dark:text-neutral-400 text-sm">暂无动态</div>
          ) : (
            items.slice(0, 8).map((event) => (
              <Link
                key={`${event.type}-${event.id}-${event.created_at}`}
                to={event.type === 'formula' ? `/formulas/${event.id}` : `/experiments/${event.id}`}
                className="block px-6 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors duration-200 cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                    event.type === 'formula' ? 'bg-primary-50 dark:bg-primary-300/20' : 'bg-secondary-50 dark:bg-secondary-300/20',
                  )}>
                    {event.type === 'formula' ? (
                      <FlaskConical size={12} className="text-primary-700" />
                    ) : (
                      <TestTubes size={12} className="text-secondary-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-neutral-700 dark:text-neutral-400">
                      <span className="font-semibold">{event.event}</span>: {event.title}
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                      {new Date(event.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <StatusBadge status={event.status} />
                </div>
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
