/**
 * 快捷操作卡片
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { Plus, TestTubes, Clock, Brain, Database, ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

interface Action {
  to: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  desc: string
  color: string
}

const ACTIONS: Action[] = [
  { to: '/formulas/new', icon: Plus, title: '新建配方', desc: '药食同源配方', color: 'from-primary-500 to-primary-600' },
  { to: '/experiments', icon: TestTubes, title: '实验管理', desc: '查看所有实验', color: 'from-violet-500 to-purple-600' },
  { to: '/formulas?status=pending_review', icon: Clock, title: '待审核配方', desc: '审核配方方案', color: 'from-amber-500 to-orange-500' },
  { to: '/ai', icon: Brain, title: 'AI智能助手', desc: '配方生成/分析', color: 'from-primary-500 to-teal-600' },
  { to: '/databases', icon: Database, title: '数据库检索', desc: 'TCMSP / DFBP', color: 'from-sky-500 to-blue-600' },
]

export const QuickActions: FC = () => (
  <Card>
    <CardHeader className="px-6 pt-6 pb-4">
      <CardTitle as="h3" className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>快捷操作</CardTitle>
    </CardHeader>
    <CardContent className="px-6 pb-6 pt-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ACTIONS.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="flex items-center gap-3 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer hover:border-primary-200 dark:hover:border-primary-800/60 bg-white dark:bg-neutral-900"
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-md transition-all duration-300 hover:scale-110 text-white`}>
              <action.icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-neutral-900 dark:text-white text-sm">{action.title}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{action.desc}</p>
            </div>
            <ArrowRight size={14} className="text-neutral-400 dark:text-neutral-500 group-hover:text-primary-500 transition-all duration-300" />
          </Link>
        ))}
      </div>
    </CardContent>
  </Card>
)
