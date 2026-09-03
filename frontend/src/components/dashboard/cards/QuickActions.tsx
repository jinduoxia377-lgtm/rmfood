/**
 * 快捷操作卡片 — 支持用户自定义 + 角色适配
 */
import type { FC } from 'react'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, TestTubes, Clock, Brain, Database, ArrowRight, Pencil, Trash2, Check } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'

const STORAGE_KEY = 'rmfood_quick_actions'

interface Action {
  to: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  desc: string
  iconBg: string
  iconColor: string
}

const DEFAULT_ACTIONS: Action[] = [
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

interface StoredAction {
  to: string
  icon: string
  title: string
  desc: string
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Plus,
  TestTubes,
  Clock,
  Brain,
  Database,
  ArrowRight,
}

export const QuickActions: FC = () => {
  const [actions, setActions] = useState<Action[]>([])
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed: StoredAction[] = JSON.parse(stored)
        const mapped: Action[] = parsed.map(a => ({
          to: a.to,
          icon: ICON_MAP[a.icon] || Plus,
          title: a.title,
          desc: a.desc,
          iconBg: 'bg-primary-100 dark:bg-primary-900/30',
          iconColor: 'text-primary-600 dark:text-primary-400',
        }))
        setActions(mapped)
      } catch {
        setActions(DEFAULT_ACTIONS)
      }
    } else {
      setActions(DEFAULT_ACTIONS)
    }
  }, [])

  const saveActions = (newActions: Action[]) => {
    const stored: StoredAction[] = newActions.map(a => ({
      to: a.to,
      icon: Object.keys(ICON_MAP).find(k => ICON_MAP[k] === a.icon) || 'Plus',
      title: a.title,
      desc: a.desc,
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    setActions(newActions)
  }

  const handleAddCustom = () => {
    const to = prompt('请输入跳转路径（如 /formulas）：')
    if (!to) return
    const title = prompt('请输入标题：', '自定义入口') || '自定义入口'
    const desc = prompt('请输入描述：', '') || ''
    const iconKey = prompt('图标（Plus/TestTubes/Clock/Brain/Database/ArrowRight）：', 'Plus') || 'Plus'
    const icon = ICON_MAP[iconKey] || Plus
    const newAction: Action = { to, icon, title, desc, iconBg: 'bg-accent-100 dark:bg-accent-900/30', iconColor: 'text-accent-600 dark:text-accent-400' }
    saveActions([...actions, newAction])
  }

  const handleDelete = (index: number) => {
    saveActions(actions.filter((_, i) => i !== index))
  }

  return (
    <Card>
      <CardHeader className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle as="h3" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">快捷操作</CardTitle>
          <button
            onClick={() => setEditMode(!editMode)}
            className="text-xs text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center gap-1"
            aria-label={editMode ? '完成编辑' : '编辑快捷操作'}
          >
            {editMode ? <Check size={12} /> : <Pencil size={12} />}
            {editMode ? '完成' : '编辑'}
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {actions.map((action, idx) => (
            <div key={action.to} className="relative group">
              <Link
                to={action.to}
                className="flex items-center gap-3 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors duration-200 cursor-pointer"
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
              {editMode && (
                <button
                  onClick={(e) => { e.preventDefault(); handleDelete(idx) }}
                  className="absolute top-1 right-1 p-1 rounded bg-error-100 dark:bg-error-900/40 text-error-600 dark:text-error-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="删除"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
          {editMode && (
            <button
              onClick={handleAddCustom}
              className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:border-primary-400 hover:text-primary-600 dark:hover:border-primary-500 dark:hover:text-primary-400 transition-colors text-sm"
            >
              <Plus size={14} />
              添加快捷入口
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
