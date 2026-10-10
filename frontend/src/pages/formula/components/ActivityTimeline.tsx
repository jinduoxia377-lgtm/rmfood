/**
 * 配方活动时间线组件
 * 展示配方所有操作历史（创建、更新、提交、审核等）
 */
import {
  Plus, Edit3, Send, CheckCircle2, XCircle, Archive,
  MessageSquare, Sparkles, Clock, User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ActivityItem {
  id: number
  type: 'created' | 'updated' | 'submitted' | 'approved' | 'rejected' | 'archived' | 'commented' | 'ai_analysis'
  description: string
  actor?: string
  timestamp: string
  details?: string
}

interface ActivityTimelineProps {
  activities: ActivityItem[]
}

const ACTIVITY_CONFIG = {
  created: { icon: Plus, color: 'text-success-500 bg-success-50 dark:bg-success-300/20', label: '创建配方' },
  updated: { icon: Edit3, color: 'text-secondary-500 bg-secondary-50 dark:bg-secondary-300/20', label: '更新配方' },
  submitted: { icon: Send, color: 'text-warning-500 bg-warning-50 dark:bg-warning-300/20', label: '提交审核' },
  approved: { icon: CheckCircle2, color: 'text-success-500 bg-success-50 dark:bg-success-300/20', label: '审核通过' },
  rejected: { icon: XCircle, color: 'text-error-500 bg-error-50 dark:bg-error-300/20', label: '审核驳回' },
  archived: { icon: Archive, color: 'text-neutral-500 bg-neutral-50 dark:bg-neutral-800', label: '归档配方' },
  commented: { icon: MessageSquare, color: 'text-accent-500 bg-accent-50 dark:bg-accent-300/20', label: '发表评论' },
  ai_analysis: { icon: Sparkles, color: 'text-primary-500 bg-primary-50 dark:bg-primary-300/20', label: 'AI 分析' },
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock size={32} className="mx-auto text-neutral-300 dark:text-neutral-400 mb-2" />
        <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">暂无活动记录</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute right-4 top-0 bottom-0 w-px bg-neutral-200 dark:bg-neutral-700" />
      <div className="space-y-3">
        {activities.map((activity, index) => {
          const actConfig = ACTIVITY_CONFIG[activity.type]
          const Icon = actConfig.icon
          const isFirst = index === 0

          return (
            <div key={activity.id} className="relative pr-10">
              <div className={cn(
                'absolute right-0 w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10',
                actConfig.color,
                isFirst && 'ring-3 ring-primary-100 dark:ring-primary-900/30',
              )}>
                <Icon size={12} />
              </div>
              <div className={cn(
                'bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3',
                'hover:shadow-md transition-shadow',
                isFirst && 'ring-2 ring-primary-200 dark:ring-primary-800/50',
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 text-right">
                    <div className="flex items-center gap-2 mb-1 justify-end">
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">{activity.description}</span>
                      {isFirst && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-300/30 text-primary-700 dark:text-primary-700 rounded order-first">最新</span>
                      )}
                    </div>
                    {activity.details && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5 line-clamp-2">{activity.details}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] justify-end">
                      {activity.actor && (
                        <span className="flex items-center gap-1">{activity.actor}<User size={9} /></span>
                      )}
                      <span className="flex items-center gap-1">
                          {new Date(activity.timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        <Clock size={9} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 根据配方数据生成活动时间线
 */
export function generateMockTimeline(formula: {
  created_at: string
  updated_at: string
  created_by?: string
  status: string
  reviewer_id?: number
  reviewed_at?: string
  review_notes?: string
}): ActivityItem[] {
  const timeline: ActivityItem[] = []
  const created = new Date(formula.created_at)
  const updated = new Date(formula.updated_at)

  timeline.push({
    id: 1,
    type: 'created',
    description: '创建了配方',
    actor: formula.created_by,
    timestamp: created.toISOString(),
    details: '配方基本信息已填写完成',
  })

  if (updated.getTime() - created.getTime() > 60000) {
    timeline.push({
      id: 2,
      type: 'updated',
      description: '更新了配方内容',
      actor: formula.created_by,
      timestamp: updated.toISOString(),
    })
  }

  if (formula.status === 'pending_review') {
    timeline.push({
      id: 3,
      type: 'submitted',
      description: '提交配方审核',
      actor: formula.created_by,
      timestamp: new Date(updated.getTime() + 1000).toISOString(),
    })
  } else if (formula.status === 'approved') {
    timeline.push({
      id: 3, type: 'submitted', description: '提交配方审核', actor: formula.created_by,
      timestamp: new Date(updated.getTime() - 86400000).toISOString(),
    })
    timeline.push({
      id: 4, type: 'approved', description: '审核通过',
      actor: formula.reviewer_id ? `审核员 #${formula.reviewer_id}` : undefined,
      timestamp: formula.reviewed_at || new Date().toISOString(),
      details: formula.review_notes || undefined,
    })
  } else if (formula.status === 'rejected') {
    timeline.push({
      id: 3, type: 'submitted', description: '提交配方审核', actor: formula.created_by,
      timestamp: new Date(updated.getTime() - 86400000).toISOString(),
    })
    timeline.push({
      id: 4, type: 'rejected', description: '审核驳回',
      actor: formula.reviewer_id ? `审核员 #${formula.reviewer_id}` : undefined,
      timestamp: formula.reviewed_at || new Date().toISOString(),
      details: formula.review_notes || undefined,
    })
  }

  return timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}
