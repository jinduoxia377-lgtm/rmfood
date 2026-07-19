/**
 * 待办事项列表
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardList } from 'lucide-react'
import { Badge, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { cn } from '@/lib/utils'

interface TodoItem {
  type: string
  id: number | string
  title: string
  detail: string
  priority: 'high' | 'medium' | 'low'
}

interface Props {
  items: TodoItem[]
}

export const TodosList: FC<Props> = ({ items }) => (
  <Card className="overflow-hidden">
    <CardHeader className="px-6 pt-6 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList size={18} className="text-warning-500" />
          <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>待办事项</CardTitle>
        </div>
        <Badge variant="neutral" size="sm">{items.length}</Badge>
      </div>
    </CardHeader>
    <CardContent className="p-0">
      <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
        {items.length === 0 ? (
          <div className="px-6 py-10 text-center text-neutral-500 dark:text-neutral-400 text-sm">暂无待办事项</div>
        ) : (
          items.slice(0, 6).map((todo) => (
            <Link
              key={`${todo.type}-${todo.id}`}
              to={todo.type === 'review_formula' ? `/formulas/${todo.id}` : `/experiments/${todo.id}`}
              className="block px-6 py-3 hover:bg-slate-50 dark:hover:bg-neutral-800/40 transition-colors duration-200 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  todo.priority === 'high' ? 'bg-warning-500' :
                  todo.priority === 'medium' ? 'bg-secondary-500' : 'bg-neutral-300',
                )} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">{todo.title}</p>
                  <p className="text-xs text-neutral-400 mt-1">{todo.detail}</p>
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
