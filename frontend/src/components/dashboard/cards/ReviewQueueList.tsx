/**
 * 待审核配方列表
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, AlertTriangle } from 'lucide-react'
import { Badge, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

interface ReviewItem {
  id: number | string
  name: string
  code: string
  creator_name: string
  target_effects: string[]
}

interface Props {
  items: ReviewItem[]
  loading?: boolean
}

export const ReviewQueueList: FC<Props> = ({ items, loading }) => {
  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="skeleton w-5 h-5 rounded" />
              <div className="skeleton h-4 w-24 rounded" />
            </div>
            <div className="skeleton h-5 w-8 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-6 py-3 flex items-center justify-between">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="skeleton h-3 w-3/4 rounded" />
                  <div className="skeleton h-2.5 w-1/2 rounded" />
                </div>
                <div className="skeleton w-3 h-3 rounded shrink-0 ml-4" />
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
            <AlertTriangle size={18} className="text-warning-500" />
            <CardTitle as="h2" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>待审核配方</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" size="sm">{items.length}</Badge>
            {/* C-05：统一「查看全部」入口 */}
            <Link to="/formulas?status=pending_review" className="text-xs text-primary-700 hover:text-primary-700 dark:text-primary-700 font-semibold flex items-center gap-1 transition-colors min-h-[44px] px-2 -mx-2 -my-3.5">
              全部 <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/40">
          {items.length === 0 ? (
            <div className="px-6 py-10 text-center text-neutral-500 dark:text-neutral-400 text-sm">暂无待审核配方</div>
          ) : (
            items.slice(0, 6).map((item) => (
              <Link
                key={item.id}
                to={`/formulas/${item.id}`}
                className="block px-6 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors duration-200 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-neutral-600">{item.code}</span>
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">·</span>
                      <span className="text-xs text-neutral-600">{item.creator_name}</span>
                    </div>
                    {item.target_effects.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.target_effects.slice(0, 3).map((e) => (
                          <Badge key={e} variant="primary" size="sm">{e}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <ArrowRight size={14} className="text-neutral-600 dark:text-neutral-400 shrink-0" />
                </div>
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
