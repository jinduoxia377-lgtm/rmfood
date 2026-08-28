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
  iconBg: string
  iconColor: string
}

const ACTIONS: Action[] = [
  {
    to: '/formulas/new',
    icon: Plus,
    title: '新建配方',
    desc: '药食同源配方',
    iconBg: 'bg-primary-100 dark:bg-primary-900/30',
    iconColor: 'text-primary-600 dark:text-primary-400',
  },
  {
    to: '/experiments',
    icon: TestTubes,
    title: '实验管理',
    desc: '查看所有实验',
    iconBg: 'bg-secondary-100 dark:bg-secondary-900/30',
    iconColor: 'text-secondary-600 dark:text-secondary-400',
  },
  {
    to: '/formulas?status=pending_review',
    icon: Clock,
    title: '待审核配方',
    desc: '审核配方方案',
    iconBg: 'bg-warning-100 dark:bg-warning-900/30',
    iconColor: 'text-warning-600 dark:text-warning-400',
  },
  {
    to: '/ai',
    icon: Brain,
    title: 'AI智能助手',
    desc: '配方生成/分析',
    iconBg: 'bg-accent-100 dark:bg-accent-900/30',
    iconColor: 'text-accent-600 dark:text-accent-400',
  },
  {
    to: '/databases',
    icon: Database,
    title: '数据库检索',
    desc: 'TCMSP / DFBP',
    iconBg: 'bg-info-100 dark:bg-info-900/30',
    iconColor: 'text-info-600 dark:text-info-400',
  },
]

export const QuickActions: FC = () => (
  <Card>
    <CardHeader className="px-5 pt-5 pb-3">
      <CardTitle as="h3" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">快捷操作</CardTitle>
    </CardHeader>
    <CardContent className="px-5 pb-5 pt-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {ACTIONS.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="flex items-center gap-3 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors duration-200 group cursor-pointer"
          >
            <div className={`w-9 h-9 rounded-lg ${action.iconBg} flex items-center justify-center shrink-0`}>
              <action.icon size={16} className={action.iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-neutral-900 dark:text-white text-sm truncate">{action.title}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{action.desc}</p>
            </div>
            <ArrowRight size={14} className="text-neutral-400 dark:text-neutral-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
          </Link>
        ))}
      </div>
    </CardContent>
  </Card>
)
