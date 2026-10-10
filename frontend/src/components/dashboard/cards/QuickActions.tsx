/**
 * 快捷操作卡片 — 支持用户自定义 + 角色适配
 */
import type { FC } from 'react'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, TestTubes, Clock, Brain, Database, ArrowRight, Pencil, Trash2, Check, X } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Modal, Input } from '@/components/ui'

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
    iconBg: 'bg-primary-100 dark:bg-primary-300/25',
    iconColor: 'text-primary-700 dark:text-primary-700',
  },
  {
    to: '/experiments',
    icon: TestTubes,
    title: '实验管理',
    desc: '查看所有实验',
    iconBg: 'bg-secondary-100 dark:bg-secondary-300/25',
    iconColor: 'text-secondary-600 dark:text-secondary-700',
  },
  {
    to: '/formulas?status=pending_review',
    icon: Clock,
    title: '待审核配方',
    desc: '审核配方方案',
    iconBg: 'bg-warning-100 dark:bg-warning-300/25',
    iconColor: 'text-warning-600 dark:text-warning-700',
  },
  {
    to: '/ai',
    icon: Brain,
    title: 'AI智能助手',
    desc: '配方生成/分析',
    iconBg: 'bg-accent-100 dark:bg-accent-300/25',
    iconColor: 'text-accent-600 dark:text-accent-700',
  },
  {
    to: '/databases',
    icon: Database,
    title: '数据库检索',
    desc: 'TCMSP / DFBP',
    iconBg: 'bg-info-100 dark:bg-info-300/25',
    iconColor: 'text-info-600 dark:text-info-600',
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
  // C-04: 自定义入口 Modal 表单（替代 4 次 prompt()）
  const [showAddModal, setShowAddModal] = useState(false)
  const [draft, setDraft] = useState({ to: '', title: '', desc: '', iconKey: 'Plus' })

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
          iconBg: 'bg-primary-100 dark:bg-primary-300/25',
          iconColor: 'text-primary-700 dark:text-primary-700',
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
    setDraft({ to: '', title: '', desc: '', iconKey: 'Plus' })
    setShowAddModal(true)
  }

  const handleConfirmAdd = () => {
    const to = draft.to.trim()
    if (!to) return
    const icon = ICON_MAP[draft.iconKey] || Plus
    const newAction: Action = {
      to,
      icon,
      title: draft.title.trim() || '自定义入口',
      desc: draft.desc.trim(),
      iconBg: 'bg-accent-100 dark:bg-accent-300/25',
      iconColor: 'text-accent-600 dark:text-accent-700',
    }
    saveActions([...actions, newAction])
    setShowAddModal(false)
  }

  const handleDelete = (index: number) => {
    saveActions(actions.filter((_, i) => i !== index))
  }

  return (
    <Card>
      <CardHeader className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle as="h2" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">快捷操作</CardTitle>
          {/* A-10：原 min-h-[24px] 实测命中区仅 48×24，低于 WCAG 2.5.5 的 44×44。
              抬到 44px 高，用 -my-3.5 / -mx-2 的负外边距抵消，保持视觉位置不变。 */}
          <button
            onClick={() => setEditMode(!editMode)}
            className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-primary-700 dark:hover:text-primary-600 transition-colors flex items-center gap-1 min-h-[44px] px-2 -mx-2 -my-3.5"
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
                <ArrowRight size={14} className="text-neutral-600 dark:text-neutral-400 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors" />
              </Link>
              {editMode && (
                <button
                  onClick={(e) => { e.preventDefault(); handleDelete(idx) }}
                  className="absolute top-1 right-1 p-1 rounded bg-error-100 dark:bg-error-300/30 text-error-600 dark:text-error-600 opacity-0 group-hover:opacity-100 transition-opacity"
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
              className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:border-primary-400 hover:text-primary-700 dark:hover:border-primary-500 dark:hover:text-primary-600 transition-colors text-sm"
            >
              <Plus size={14} />
              添加快捷入口
            </button>
          )}
        </div>
      </CardContent>

      {/* C-04：自定义入口 Modal 表单 */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="添加快捷入口"
        maxWidth="max-w-md"
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">跳转路径 *</label>
            <Input
              value={draft.to}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
              placeholder="如 /formulas"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">标题</label>
            <Input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="自定义入口"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">描述</label>
            <Input
              value={draft.desc}
              onChange={(e) => setDraft((d) => ({ ...d, desc: e.target.value }))}
              placeholder="可选"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">图标</label>
            <select
              value={draft.iconKey}
              onChange={(e) => setDraft((d) => ({ ...d, iconKey: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100"
            >
              {Object.keys(ICON_MAP).map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowAddModal(false)}>取消</Button>
            <Button
              size="sm"
              disabled={!draft.to.trim()}
              onClick={handleConfirmAdd}
            >
              添加
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
