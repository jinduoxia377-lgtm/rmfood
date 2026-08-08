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
}

export const ReviewQueueList: FC<Props> = ({ items }) => (
  <Card className="overflow-hidden">
    <CardHeader className="px-6 pt-6 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle size={18} className="text-warning-500" />
          <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>待审核配方</CardTitle>
        </div>
        <Badge variant="neutral" size="sm">{items.length}</Badge>
      </div>
    </CardHeader>
    <CardContent className="p-0">
      <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
        {items.length === 0 ? (
          <div className="px-6 py-10 text-center text-neutral-500 dark:text-neutral-400 text-sm">暂无待审核配方</div>
        ) : (
          items.slice(0, 6).map((item) => (
            <Link
              key={item.id}
              to={`/formulas/${item.id}`}
              className="block px-6 py-3 hover:bg-slate-50 dark:hover:bg-neutral-800/40 transition-colors duration-200 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">{item.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-neutral-400">{item.code}</span>
                    <span className="text-xs text-neutral-300 dark:text-neutral-600">·</span>
                    <span className="text-xs text-neutral-400">{item.creator_name}</span>
                  </div>
                  {item.target_effects.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.target_effects.slice(0, 3).map((e) => (
                        <Badge key={e} variant="primary" size="sm">{e}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <ArrowRight size={14} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
              </div>
            </Link>
          ))
        )}
      </div>
    </CardContent>
  </Card>
)
