/**
 * ActivityFeedWidget — 动态信息流渲染器
 *
 * 接收 activities prop，展示最近的操作动态。
 */
import React from 'react'
import { Clock, FlaskConical, Zap, FileText, User } from 'lucide-react'

interface Props {
  title?: string
  limit?: number
  activities?: Array<{ type: string; title: string; timestamp?: string | null; author?: string | null }>
}

const TYPE_CONFIG: Record<string, { icon: React.ComponentType<any>; color: string; dotColor: string }> = {
  formula:    { icon: FileText,   color: 'text-primary-700',   dotColor: 'bg-primary-500' },
  experiment: { icon: FlaskConical, color: 'text-secondary-600', dotColor: 'bg-secondary-500' },
  ai_generation: { icon: Zap, color: 'text-warning-600', dotColor: 'bg-warning-500' },
  user:       { icon: User,       color: 'text-success-600',   dotColor: 'bg-success-500' },
}

export const ActivityFeedWidget: React.FC<Props> = ({ title = '近期动态', limit = 10, activities = [] }) => {
  const items = activities?.slice(0, limit) ?? []

  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-surface border border-border p-5 flex items-center justify-center min-h-[160px]">
        <span className="text-text-muted text-sm">暂无活动记录</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-surface border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-sm text-text-primary flex items-center gap-2">
          <Clock className="w-4 h-4 text-info-500" />
          {title}
        </h4>
        {items.length > 0 && (
          <button className="text-xs text-primary-700 hover:text-primary-700 font-medium">
            查看全部
          </button>
        )}
      </div>

      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
        {items.length > 0 ? items.map((activity, idx) => {
          const cfg = TYPE_CONFIG[activity.type] || TYPE_CONFIG.formula
          const Icon = cfg.icon
          return (
            <div
              key={idx}
              className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer group"
            >
              <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ring-4 ${cfg.dotColor.replace('bg-', 'ring-')}`}>
                <span className={`block w-2 h-2 rounded-full ${cfg.dotColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary group-hover:text-primary-700 transition-colors line-clamp-2">
                  {activity.title}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-text-muted">{activity.author ?? '未知'}</span>
                  {activity.timestamp && (
                    <>
                      <span className="text-text-muted">·</span>
                      <span className="text-xs text-text-muted">
                        {new Date(activity.timestamp).toLocaleString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <Icon className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
          )
        }) : (
          <div className="text-center py-10">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-20 text-text-muted" />
            <p className="text-sm text-text-muted">暂无活动记录</p>
            <p className="text-xs text-text-muted mt-1">当有新操作时将在此显示</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ActivityFeedWidget
